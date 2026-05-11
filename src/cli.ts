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
  STATS_DB_PATH         SQLite file path (default ./data/stats.db)
  ALLOWED_ORIGINS       Comma-separated CORS allowlist
  HEADLESS              true → no dashboard, ingest+embed only
  MODE                  solo | team (auto-detected when unset)

Docs: https://wigtn.github.io/wigtoken/
`;

declare const __VERSION__: string;
const VERSION = typeof __VERSION__ !== "undefined" ? __VERSION__ : "dev";

function ensureDataDir(dbPath: string) {
  const dir = dirname(resolve(dbPath));
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    console.log(`Created data dir: ${dir}`);
  }
}

async function cmdInit() {
  const cfg = loadConfig();
  ensureDataDir(cfg.dbPath);
  const storage = openStorage(cfg.dbPath);
  const issued = bootstrapAdmin(storage);
  if (!issued) {
    console.log("Database already initialized — no new admin token issued.");
    console.log(`DB: ${cfg.dbPath}`);
    console.log("Use the existing admin token, or rotate via /admin/tokens.");
  }
  storage.close();
}

function cmdDoctor() {
  const cfg = loadConfig();
  console.log("wigtoken doctor");
  console.log("───────────────");
  console.log(`mode               ${cfg.mode}`);
  console.log(`projectsDir        ${cfg.projectsDir}`);
  console.log(`  exists           ${existsSync(cfg.projectsDir)}`);
  console.log(`dbPath             ${cfg.dbPath}`);
  console.log(`  dir exists       ${existsSync(dirname(cfg.dbPath))}`);
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
  ensureDataDir(cfg.dbPath);
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
