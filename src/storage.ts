import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Store } from "./db.ts";
import { TokenStore } from "./tokens.ts";
import { AuditLog } from "./audit.ts";
import { EmbedOriginStore } from "./embed-origins.ts";
import { SettingsStore } from "./settings.ts";
import type { DbConfig } from "./config.ts";

export interface Storage {
  db: Database.Database;
  kind: DbConfig["kind"];
  store: Store;
  tokens: TokenStore;
  audit: AuditLog;
  embedOrigins: EmbedOriginStore;
  settings: SettingsStore;
  close: () => void;
}

/**
 * Open the configured database and hand the connection to every store
 * implementation that needs it. Centralised so PRAGMAs (WAL, foreign
 * keys) and migrations live in one place.
 *
 * Accepts either a bare file path (legacy v0.1.x — implied sqlite) or
 * a full DbConfig object. Postgres / MySQL backends are scaffolded but
 * will land in the next release — they throw a clear error today so
 * operators don't accidentally point production at a TODO impl.
 */
export function openStorage(input: string | DbConfig): Storage {
  const cfg: DbConfig =
    typeof input === "string" ? { kind: "sqlite", url: input } : input;

  if (cfg.kind === "postgres" || cfg.kind === "mysql") {
    throw new Error(
      `wigtoken: ${cfg.kind} backend is not implemented yet (coming in v0.3). ` +
        `Set DB_URL to a sqlite path or omit it to use the default.`
    );
  }

  // sqlite path — same shape as v0.1.x.
  mkdirSync(dirname(cfg.url), { recursive: true });
  const db = new Database(cfg.url);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  return {
    db,
    kind: cfg.kind,
    store: new Store(db),
    tokens: new TokenStore(db),
    audit: new AuditLog(db),
    embedOrigins: new EmbedOriginStore(db),
    settings: new SettingsStore(db),
    close: () => db.close(),
  };
}
