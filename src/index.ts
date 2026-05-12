import { serve } from "@hono/node-server";
import chokidar from "chokidar";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { deriveLabels, processFile } from "./scanner.ts";
import { buildApp } from "./server.ts";
import { bus, EVENT_UPDATED } from "./events.ts";
import { loadConfig, type AppConfig } from "./config.ts";
import { openStorage, type Storage } from "./storage.ts";
import { RateLimiter } from "./rate-limit.ts";

export { buildApp } from "./server.ts";
export { loadConfig } from "./config.ts";
export { openStorage } from "./storage.ts";
export type { AppConfig } from "./config.ts";
export type { Storage } from "./storage.ts";

/**
 * Issue an admin token if no tokens exist yet, and print it to stdout
 * once. Idempotent — does nothing on subsequent runs. Returned value
 * is the plaintext token if a fresh one was issued, otherwise null.
 */
export async function bootstrapAdmin(storage: Storage): Promise<string | null> {
  const { tokens, audit } = storage;
  if (!(await tokens.needsBootstrapAdmin())) return null;
  const issued = await tokens.issue({
    user: "admin",
    scope: "admin",
    label: "bootstrap",
  });
  console.log("");
  console.log("─".repeat(60));
  console.log("First run detected — issued bootstrap admin token:");
  console.log("");
  console.log(`  ${issued.token}`);
  console.log("");
  console.log("Save this somewhere safe. It won't be shown again.");
  console.log("Use it from the /setup wizard or POST /api/admin/tokens.");
  console.log("─".repeat(60));
  console.log("");
  await audit.record({
    ts: Date.now(),
    tokenId: issued.id,
    action: "token_issued",
    user: "admin",
    ip: null,
    meta: { scope: "admin", label: "bootstrap" },
  });
  return issued.token;
}

/**
 * Start the wigtoken daemon. Resolves once the HTTP server is
 * listening; the returned `stop()` releases the watcher + DB and
 * exits the event loop.
 */
export async function startDaemon(cfg: AppConfig = loadConfig()) {
  const storage = openStorage(cfg.db);
  await bootstrapAdmin(storage);

  if (!storage.raw) {
    // PG / MySQL backends would need their own scanner / ingest path;
    // not yet implemented.
    throw new Error(
      `wigtoken: daemon mode requires SQLite for the moment. ` +
        `Run with DB_URL pointing at a sqlite file.`
    );
  }
  const rawStore = storage.raw.store;

  const rateLimiter = new RateLimiter(100, 100 / 60);
  const rateLimiterPrune = setInterval(
    () => rateLimiter.prune(10 * 60 * 1000),
    5 * 60 * 1000
  );

  const watcherDefaults = {
    user: cfg.defaultUser,
    machine: cfg.mode === "solo" ? "local" : "host",
  };

  function ingest(path: string, label: string) {
    if (!path.endsWith(".jsonl")) return;
    const labels = deriveLabels(path, cfg.projectsDir, watcherDefaults);
    try {
      const result = processFile(path, rawStore, labels);
      if (result.newMessages.length > 0) {
        console.log(
          `[${label}] (${labels.user}/${labels.machine}) ${path} → +${result.newMessages.length} msgs (+${result.bytesAdvanced} bytes)`
        );
        bus.emit(EVENT_UPDATED);
      }
    } catch (err) {
      console.error(`[${label}] failed for ${path}:`, err);
    }
  }

  console.log(`Mode: ${cfg.mode}`);
  console.log(`Watching ${cfg.projectsDir}`);
  console.log(`DB: ${cfg.db.kind} → ${cfg.db.url}`);
  console.log(`Allowed origins: ${cfg.allowedOrigins.join(", ")}`);

  const watcher = chokidar.watch(cfg.projectsDir, {
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: false,
    usePolling: cfg.watcher.usePolling,
    interval: cfg.watcher.intervalMs,
    binaryInterval: cfg.watcher.intervalMs,
  });

  console.log(
    `Watcher: ${cfg.watcher.usePolling ? `polling (${cfg.watcher.intervalMs}ms)` : "fsevents"}`
  );

  watcher.on("add", (p) => ingest(p, "add"));
  watcher.on("change", (p) => ingest(p, "change"));
  watcher.on("error", (e) => console.error("watcher error:", e));

  async function* walkJsonl(dir: string): AsyncGenerator<string> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        yield* walkJsonl(full);
      } else if (e.isFile() && e.name.endsWith(".jsonl")) {
        yield full;
      }
    }
  }

  let scanInFlight = false;
  async function backupScan() {
    if (scanInFlight) return;
    scanInFlight = true;
    try {
      for await (const f of walkJsonl(cfg.projectsDir)) {
        ingest(f, "scan");
      }
    } catch (err) {
      console.error("backup scan failed:", err);
    } finally {
      scanInFlight = false;
    }
  }

  let scanTimer: NodeJS.Timeout | null = null;
  await new Promise<void>((resolveReady) => {
    watcher.on("ready", () => {
      console.log("Initial scan complete. Totals:", rawStore.getTotals());
      console.log(`Backup walk: every ${cfg.scanIntervalMs}ms`);
      scanTimer = setInterval(() => {
        backupScan().catch(() => {});
      }, cfg.scanIntervalMs);

      const app = buildApp({
        storage,
        allowedOrigins: cfg.allowedOrigins,
        rateLimiter,
        headless: cfg.headless,
      });
      serve({ fetch: app.fetch, port: cfg.port }, (info) => {
        console.log(`wigtoken listening on http://localhost:${info.port}`);
        resolveReady();
      });
    });
  });

  return {
    stop: async () => {
      if (scanTimer) clearInterval(scanTimer);
      clearInterval(rateLimiterPrune);
      await watcher.close();
      await storage.close();
    },
  };
}

// Direct-run path: `tsx src/index.ts` or `node dist/index.js` (legacy).
// In production we expect callers to go through dist/cli.js.
const isDirectRun = (() => {
  try {
    const entry = process.argv[1] ?? "";
    return /index\.(ts|js)$/.test(entry);
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  startDaemon().catch((err) => {
    console.error("startup failed:", err);
    process.exit(1);
  });
  const shutdown = (signal: string) => {
    console.log(`Received ${signal}, shutting down`);
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}
