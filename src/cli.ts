import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { bootstrapAdmin, startDaemon } from "./index.ts";
import { loadConfig } from "./config.ts";
import { openStorage } from "./storage.ts";

const HELP = `wigtoken — self-host aggregator for Claude Code token usage

Usage:
  wigtoken [start]      Start the daemon (default).
  wigtoken init         Create data dir + issue bootstrap admin token, then exit.
  wigtoken doctor       Print resolved config + sanity-check paths.
  wigtoken version      Print version and exit.
  wigtoken help         Show this message.

Environment:
  PORT                  HTTP port (default 10103)
  CLAUDE_PROJECTS_DIR   Path to ~/.claude/projects (or shared multi-user root)
  DB_URL                sqlite:./data/stats.db (default), postgres://…, mysql://…
  STATS_DB_PATH         (legacy) SQLite file path, used when DB_URL is unset
  ALLOWED_ORIGINS       Comma-separated CORS allowlist
  HEADLESS              true → no dashboard, ingest+embed only
  MODE                  solo | team (auto-detected when unset)

Docs: https://wigtn.github.io/wigtoken/
`;

declare const __VERSION__: string;
const VERSION = typeof __VERSION__ !== "undefined" ? __VERSION__ : "dev";

function ensureSqliteDir(url: string) {
  const dir = dirname(resolve(url));
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    console.log(`Created data dir: ${dir}`);
  }
}

async function cmdInit() {
  const cfg = loadConfig();
  if (cfg.db.kind === "sqlite") ensureSqliteDir(cfg.db.url);
  const storage = openStorage(cfg.db);
  const issued = await bootstrapAdmin(storage);
  if (!issued) {
    console.log("Database already initialized — no new admin token issued.");
    console.log(`DB: ${cfg.db.kind} → ${cfg.db.url}`);
    console.log("Use the existing admin token, or rotate via /admin/tokens.");
  }
  await storage.close();
}

function cmdDoctor() {
  const cfg = loadConfig();
  console.log("wigtoken doctor");
  console.log("───────────────");
  console.log(`mode               ${cfg.mode}`);
  console.log(`projectsDir        ${cfg.projectsDir}`);
  console.log(`  exists           ${existsSync(cfg.projectsDir)}`);
  console.log(`db.kind            ${cfg.db.kind}`);
  console.log(`db.url             ${cfg.db.url}`);
  if (cfg.db.kind === "sqlite") {
    console.log(`  dir exists       ${existsSync(dirname(cfg.db.url))}`);
  }
  console.log(`port               ${cfg.port}`);
  console.log(`allowedOrigins     ${cfg.allowedOrigins.join(", ") || "(none)"}`);
  console.log(`headless           ${cfg.headless}`);
  console.log(`watcher.usePolling ${cfg.watcher.usePolling}`);
  console.log(`watcher.intervalMs ${cfg.watcher.intervalMs}`);
  console.log(`scanIntervalMs     ${cfg.scanIntervalMs}`);
  console.log(`defaultUser        ${cfg.defaultUser}`);
  console.log(`HOME               ${homedir()}`);
}

async function cmdStart() {
  const cfg = loadConfig();
  if (cfg.db.kind === "sqlite") ensureSqliteDir(cfg.db.url);
  const daemon = await startDaemon(cfg);
  const shutdown = (signal: string) => {
    console.log(`Received ${signal}, shutting down`);
    daemon.stop().finally(() => process.exit(0));
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

async function main() {
  const cmd = process.argv[2] ?? "start";
  switch (cmd) {
    case "start":
    case undefined:
      await cmdStart();
      break;
    case "init":
      await cmdInit();
      break;
    case "doctor":
      cmdDoctor();
      break;
    case "version":
    case "--version":
    case "-v":
      console.log(VERSION);
      break;
    case "help":
    case "--help":
    case "-h":
      console.log(HELP);
      break;
    default:
      console.error(`Unknown command: ${cmd}\n`);
      console.error(HELP);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("wigtoken failed:", err);
  process.exit(1);
});
