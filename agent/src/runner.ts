/**
 * The watch loop: reconcile an offsets file with what's on disk,
 * tail incoming JSONL lines, and hand parsed batches to the uploader.
 *
 * A periodic readdir-recurse walk runs alongside chokidar so that we
 * recover from missed events (a known problem on macOS Docker bind
 * mounts and similar environments where the agent itself runs inside
 * a container; native macOS is fine without it but the cost is tiny).
 */

import chokidar from "chokidar";
import { readFileSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { AgentConfig } from "./config.ts";
import { parseLine, type IngestMessage } from "./parser.ts";
import { OffsetStore } from "./state.ts";
import { BatchQueue } from "./queue.ts";
import { Uploader } from "./uploader.ts";

export async function run(cfg: AgentConfig): Promise<void> {
  const offsets = new OffsetStore(cfg.stateFile);
  const queue = new BatchQueue(cfg.queueDir);
  const uploader = new Uploader({
    serverUrl: cfg.serverUrl,
    token: cfg.token,
    machine: cfg.machine,
    queue,
  });

  // Outbound coalescing buffer: rapid file appends collapse into one
  // batch instead of one POST per line.
  let buffer: IngestMessage[] = [];
  let flushTimer: NodeJS.Timeout | null = null;

  const flush = () => {
    if (buffer.length === 0) return;
    const batch = buffer;
    buffer = [];
    flushTimer = null;
    uploader.push(batch).catch(() => {});
  };

  const queueFlush = () => {
    if (flushTimer) return;
    flushTimer = setTimeout(flush, cfg.flushIntervalMs);
  };

  function processFile(path: string): void {
    if (!path.endsWith(".jsonl")) return;
    let stat;
    try {
      stat = statSync(path);
    } catch {
      return;
    }
    const recorded = offsets.get(path);
    const start = recorded > stat.size ? 0 : recorded;
    if (start >= stat.size) return;

    const slice = readFileSync(path).subarray(start);
    let lastNl = -1;
    for (let i = slice.length - 1; i >= 0; i--) {
      if (slice[i] === 0x0a) {
        lastNl = i;
        break;
      }
    }
    if (lastNl < 0) return;

    const consumable = lastNl + 1;
    const text = slice.subarray(0, consumable).toString("utf8");
    const lines = text.split("\n");

    for (const line of lines) {
      const m = parseLine(line);
      if (!m) continue;
      buffer.push(m);
      if (buffer.length >= cfg.batchSize) {
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
        flush();
      }
    }
    offsets.set(path, start + consumable);
    queueFlush();
  }

  console.log(`agent: server=${cfg.serverUrl}`);
  console.log(`agent: machine=${cfg.machine}`);
  console.log(`agent: watching ${cfg.projectsDir}`);
  if (queue.size() > 0) {
    console.log(`agent: ${queue.size()} pending batches in queue`);
    uploader.drain().catch(() => {});
  }

  const watcher = chokidar.watch(cfg.projectsDir, {
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: false,
    usePolling: cfg.usePolling,
    interval: cfg.pollIntervalMs,
    binaryInterval: cfg.pollIntervalMs,
  });
  watcher.on("add", processFile);
  watcher.on("change", processFile);
  watcher.on("error", (err) => console.error("[watcher]", err));

  // Backup periodic walk
  const SCAN_INTERVAL = 30_000;
  let scanInFlight = false;
  setInterval(async () => {
    if (scanInFlight) return;
    scanInFlight = true;
    try {
      for await (const f of walk(cfg.projectsDir)) processFile(f);
    } catch {
      /* ignore */
    } finally {
      scanInFlight = false;
    }
  }, SCAN_INTERVAL);

  const shutdown = (signal: string) => {
    console.log(`agent: ${signal}, flushing…`);
    flush();
    watcher.close().finally(() => {
      uploader.drain().finally(() => process.exit(0));
    });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

async function* walk(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      yield* walk(full);
    } else if (e.isFile() && e.name.endsWith(".jsonl")) {
      yield full;
    }
  }
}
