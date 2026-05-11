/**
 * Agent configuration. CLI flags > env vars > defaults.
 */

import { homedir, hostname } from "node:os";
import { join } from "node:path";

export interface AgentConfig {
  serverUrl: string;
  token: string;
  machine: string;
  projectsDir: string;
  /** Where the agent persists per-file byte offsets (resume on restart). */
  stateFile: string;
  /** Where pending payloads land when the server is unreachable. */
  queueDir: string;
  /** chokidar polling fallback (true on macOS Docker bind mounts etc). */
  usePolling: boolean;
  pollIntervalMs: number;
  /** Max messages per outbound POST. */
  batchSize: number;
  /** Min wait between batch flushes (ms) — coalesces rapid line appends. */
  flushIntervalMs: number;
}

export interface CliInputs {
  serverUrl?: string;
  token?: string;
  machine?: string;
  projectsDir?: string;
  stateDir?: string;
  usePolling?: boolean;
}

export function buildConfig(cli: CliInputs): AgentConfig {
  const serverUrl =
    cli.serverUrl ?? process.env.WIGTOKEN_TOKEN_SERVER ?? "";
  const token = cli.token ?? process.env.WIGTOKEN_TOKEN ?? "";

  if (!serverUrl) {
    throw new Error(
      "server URL required (--server or WIGTOKEN_TOKEN_SERVER env var)"
    );
  }
  if (!token) {
    throw new Error(
      "token required (--token or WIGTOKEN_TOKEN env var, or `wigtoken-agent login`)"
    );
  }

  const machine = cli.machine ?? process.env.WIGTOKEN_MACHINE ?? hostname();
  const projectsDir =
    cli.projectsDir ??
    process.env.CLAUDE_PROJECTS_DIR ??
    join(homedir(), ".claude", "projects");

  const stateDir =
    cli.stateDir ?? join(homedir(), ".wigtoken-agent");

  return {
    serverUrl: serverUrl.replace(/\/+$/, ""),
    token,
    machine,
    projectsDir,
    stateFile: join(stateDir, "offsets.json"),
    queueDir: join(stateDir, "queue"),
    usePolling: cli.usePolling ?? envBool(process.env.WATCH_POLLING, false),
    pollIntervalMs: Number(process.env.WATCH_INTERVAL_MS ?? 1000),
    batchSize: Number(process.env.AGENT_BATCH_SIZE ?? 200),
    flushIntervalMs: Number(process.env.AGENT_FLUSH_MS ?? 1000),
  };
}

function envBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const v = value.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return fallback;
}
