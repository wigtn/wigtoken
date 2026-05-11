import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Store } from "./db.ts";
import { TokenStore } from "./tokens.ts";
import { AuditLog } from "./audit.ts";
import { EmbedOriginStore } from "./embed-origins.ts";
import { SettingsStore } from "./settings.ts";

export interface Storage {
  db: Database.Database;
  store: Store;
  tokens: TokenStore;
  audit: AuditLog;
  embedOrigins: EmbedOriginStore;
  settings: SettingsStore;
  close: () => void;
}

/**
 * Open the SQLite file once and hand the connection to every store
 * implementation that needs it. Centralised so PRAGMAs (WAL, foreign
 * keys) and migrations live in one place.
 */
export function openStorage(dbPath: string): Storage {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  return {
    db,
    store: new Store(db),
    tokens: new TokenStore(db),
    audit: new AuditLog(db),
    embedOrigins: new EmbedOriginStore(db),
    settings: new SettingsStore(db),
    close: () => db.close(),
  };
}
