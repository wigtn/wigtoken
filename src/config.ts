/**
 * Centralised env-var driven configuration. The daemon supports two
 * shapes of deployment, both backed by the same code:
 *
 *   - Solo:   one user, watch their own ~/.claude/projects directly.
 *             Zero config — `npm start` just works on a personal
 *             machine. The implicit user label is the OS account.
 *   - Team:   one shared root that holds <user>/<machine?>/projects/
 *             sub-trees, populated either via symlinks (single host)
 *             or pushed by the cross-platform agent (P3+).
 *
 * Mode is auto-detected from the directory layout, but `MODE=solo|team`
 * forces it explicitly. Everything else (paths, port, CORS, watcher
 * tuning) is also env-overridable so we can ship a single artifact.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

export type Mode = "solo" | "team";
export type DbKind = "sqlite" | "postgres" | "mysql";

export interface DbConfig {
  /**
   * Engine to use. Inferred from DB_URL prefix when set, falls back
   * to DB_KIND env, then to "sqlite" so zero-config solo installs
   * keep working without any DB env vars.
   */
  kind: DbKind;
  /**
   * Connection string. Forms accepted:
   *   - sqlite:./data/stats.db   (or just a bare path)
   *   - postgres://user:pass@host:5432/db
   *   - mysql://user:pass@host:3306/db
   * For sqlite the path is the file; for the others it's a libpq /
   * libmysqlclient-style URL parsed by the respective driver.
   */
  url: string;
}

export interface AppConfig {
  mode: Mode;
  projectsDir: string;
  /** Legacy alias — DB file path for sqlite. Prefer `db.url`. */
  dbPath: string;
  /** Resolved DB target (engine + connection string). */
  db: DbConfig;
  port: number;
  allowedOrigins: string[];
  watcher: {
    usePolling: boolean;
    intervalMs: number;
  };
  scanIntervalMs: number;
  /** Default user label when running in solo mode. */
  defaultUser: string;
  /**
   * Headless deployment — server still ingests + exposes embed/read
   * endpoints, but doesn't ship the SPA or the admin web UI. Operators
   * manage tokens via CLI / direct DB / scripts.
   */
  headless: boolean;
}

function envBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const v = value.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return fallback;
}

function envList(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Parse DB_URL into kind + url. Falls back to DB_KIND + a synthesised
 * URL for backwards compatibility. When nothing is set, returns a
 * sqlite config pointed at `<repo>/data/stats.db` (legacy default).
 */
function resolveDb(legacySqlitePath: string): DbConfig {
  const url = (process.env.DB_URL ?? "").trim();
  const kindEnv = (process.env.DB_KIND ?? "").trim().toLowerCase() as DbKind;

  if (url) {
    if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
      return { kind: "postgres", url };
    }
    if (url.startsWith("mysql://")) {
      return { kind: "mysql", url };
    }
    if (url.startsWith("sqlite:")) {
      return { kind: "sqlite", url: url.slice("sqlite:".length) };
    }
    // Bare path treated as sqlite file.
    if (url.startsWith("/") || url.startsWith(".") || url.endsWith(".db")) {
      return { kind: "sqlite", url };
    }
    // Unknown scheme — let driver-loading fail loudly later.
    return { kind: kindEnv || "sqlite", url };
  }

  if (kindEnv === "postgres" || kindEnv === "mysql") {
    throw new Error(
      `DB_KIND=${kindEnv} requires DB_URL to be set with a connection string.`
    );
  }
  return { kind: "sqlite", url: legacySqlitePath };
}

/**
 * Decide solo vs team layout. Heuristic:
 *   - If projectsDir directly contains *.jsonl files anywhere under it
 *     and the immediate sub-directories look like Claude Code's own
 *     `-encoded-cwd` pattern (start with a dash), this is a solo
 *     ~/.claude/projects tree.
 *   - Otherwise, if the immediate sub-directories look like usernames
 *     (no leading dash, no .jsonl files inside themselves), it's a
 *     team root.
 *   - Empty / missing dir → assume solo (zero-config path).
 *
 * MODE env var always wins.
 */
function detectMode(projectsDir: string): Mode {
  const explicit = (process.env.MODE ?? "").toLowerCase();
  if (explicit === "solo" || explicit === "team") return explicit;

  if (!existsSync(projectsDir)) return "solo";

  let entries: string[] = [];
  try {
    entries = readdirSync(projectsDir);
  } catch {
    return "solo";
  }

  const dirs = entries
    .filter((name) => {
      try {
        return statSync(join(projectsDir, name)).isDirectory();
      } catch {
        return false;
      }
    });

  const looksLikeSolo = dirs.some((name) => name.startsWith("-"));
  if (looksLikeSolo) return "solo";

  const looksLikeTeam = dirs.length > 0 && dirs.every((name) => !name.startsWith("-"));
  return looksLikeTeam ? "team" : "solo";
}

export function loadConfig(): AppConfig {
  const projectsDir =
    process.env.CLAUDE_PROJECTS_DIR ?? join(homedir(), ".claude", "projects");

  const mode = detectMode(projectsDir);
  const dbPath = process.env.STATS_DB_PATH ?? join(ROOT, "data", "stats.db");
  const db = resolveDb(dbPath);

  return {
    mode,
    projectsDir,
    dbPath,
    db,
    port: Number(process.env.PORT ?? 10103),
    allowedOrigins: envList(process.env.ALLOWED_ORIGINS, [
      "http://localhost:3000",
    ]),
    watcher: {
      usePolling: envBool(process.env.WATCH_POLLING, true),
      intervalMs: Number(process.env.WATCH_INTERVAL_MS ?? 1000),
    },
    scanIntervalMs: Number(process.env.SCAN_INTERVAL_MS ?? 5000),
    defaultUser: process.env.DEFAULT_USER ?? userInfo().username,
    headless: envBool(process.env.HEADLESS, false),
  };
}
