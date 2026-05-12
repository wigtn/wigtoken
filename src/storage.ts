/**
 * Storage facade — every store exposed via an async interface so a
 * single set of consumers (server.ts handlers, CLI commands) works
 * against either the sync SQLite path (drizzle-orm/better-sqlite3)
 * or the truly-async Postgres path (drizzle-orm/postgres-js).
 *
 * Scanner.ts intentionally keeps using the sync `Store` class via
 * `storage.raw.store` — better-sqlite3 transactions are synchronous
 * and the hot ingest loop is faster without async overhead. The async
 * facade above is only used at HTTP handler boundaries where I/O is
 * already async anyway.
 *
 * Phase 2c: async-uniform interface in place; Postgres / MySQL still
 * throw a clear error at startup. Phase 2d will fill in those
 * backends behind the same Storage type.
 */

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Store as SqliteStore } from "./db.ts";
import {
  TokenStore as SqliteTokenStore,
  type IssuedToken,
  type Scope,
  type TokenRow,
} from "./tokens.ts";
import { AuditLog as SqliteAuditLog, type AuditEntry } from "./audit.ts";
import {
  EmbedOriginStore as SqliteEmbedOriginStore,
  type EmbedOriginRow,
} from "./embed-origins.ts";
import { SettingsStore as SqliteSettingsStore } from "./settings.ts";
import type { DbConfig } from "./config.ts";
import type { ParsedUsage } from "./parser.ts";
import type {
  Totals,
  Labels,
  BreakdownRow,
  CostBreakdownRow,
  TimeseriesBucket,
  LeaderboardEntry,
  UserDetail,
} from "./db.ts";

// ───── Async store interfaces ─────────────────────────────────────

export interface IStore {
  getFileOffset(path: string): Promise<number>;
  setFileOffset(path: string, offset: number): Promise<void>;
  applyUsage(u: ParsedUsage, labels: Labels): Promise<boolean>;
  getTotals(): Promise<Totals>;
  tokenBreakdown(): Promise<BreakdownRow[]>;
  costBreakdown(): Promise<CostBreakdownRow[]>;
  timeseries(fromMs: number, toMs: number, stepMs: number): Promise<TimeseriesBucket[]>;
  leaderboard(by: "user" | "machine" | "model_family", limit?: number): Promise<LeaderboardEntry[]>;
  userDetail(user: string): Promise<UserDetail>;
  recentMessages(limit?: number): Promise<
    Array<{
      user: string;
      machine: string;
      model: string;
      modelFamily: string;
      inputTokens: number;
      cacheCreation: number;
      cacheRead: number;
      outputTokens: number;
      costUsd: number;
      weightedInputEq: number;
      ts: number;
    }>
  >;
}

export interface ITokenStore {
  issue(args: { user: string; scope: Scope; label?: string; expiresAt?: number }): Promise<IssuedToken>;
  resolve(plainToken: string): Promise<TokenRow | null>;
  list(): Promise<TokenRow[]>;
  revoke(id: number): Promise<boolean>;
  needsBootstrapAdmin(): Promise<boolean>;
}

export interface IAuditLog {
  record(entry: AuditEntry): Promise<void>;
  list(opts?: { sinceMs?: number; limit?: number }): Promise<AuditEntry[]>;
}

export interface IEmbedOriginStore {
  add(origin: string, label: string | null, createdBy: number | null): Promise<EmbedOriginRow>;
  list(): Promise<EmbedOriginRow[]>;
  remove(id: number): Promise<boolean>;
  isAllowed(origin: string): Promise<boolean>;
}

export interface ISettingsStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  getBool(key: string): Promise<boolean>;
  setBool(key: string, value: boolean): Promise<void>;
}

/**
 * Sync stores still exposed for hot-path consumers (scanner.ts uses
 * better-sqlite3 transactions which are synchronous). Only available
 * for the SQLite backend — kind="postgres"/"mysql" returns null.
 */
export interface RawStores {
  store: SqliteStore;
}

export interface Storage {
  kind: DbConfig["kind"];
  store: IStore;
  tokens: ITokenStore;
  audit: IAuditLog;
  embedOrigins: IEmbedOriginStore;
  settings: ISettingsStore;
  /** Sync stores for the SQLite path. null for other engines. */
  raw: RawStores | null;
  close: () => Promise<void>;
}

// ───── SQLite adapter ─────────────────────────────────────────────

function wrapSqlite(rawDb: Database.Database): Storage {
  const sync = {
    store: new SqliteStore(rawDb),
    tokens: new SqliteTokenStore(rawDb),
    audit: new SqliteAuditLog(rawDb),
    embedOrigins: new SqliteEmbedOriginStore(rawDb),
    settings: new SqliteSettingsStore(rawDb),
  };

  return {
    kind: "sqlite",
    store: {
      async getFileOffset(path) { return sync.store.getFileOffset(path); },
      async setFileOffset(path, off) { sync.store.setFileOffset(path, off); },
      async applyUsage(u, l) { return sync.store.applyUsage(u, l); },
      async getTotals() { return sync.store.getTotals(); },
      async tokenBreakdown() { return sync.store.tokenBreakdown(); },
      async costBreakdown() { return sync.store.costBreakdown(); },
      async timeseries(f, t, s) { return sync.store.timeseries(f, t, s); },
      async leaderboard(by, limit) { return sync.store.leaderboard(by, limit); },
      async userDetail(u) { return sync.store.userDetail(u); },
      async recentMessages(limit) { return sync.store.recentMessages(limit); },
    },
    tokens: {
      async issue(args) { return sync.tokens.issue(args); },
      async resolve(t) { return sync.tokens.resolve(t); },
      async list() { return sync.tokens.list(); },
      async revoke(id) { return sync.tokens.revoke(id); },
      async needsBootstrapAdmin() { return sync.tokens.needsBootstrapAdmin(); },
    },
    audit: {
      async record(e) { sync.audit.record(e); },
      async list(o) { return sync.audit.list(o); },
    },
    embedOrigins: {
      async add(o, l, c) { return sync.embedOrigins.add(o, l, c); },
      async list() { return sync.embedOrigins.list(); },
      async remove(id) { return sync.embedOrigins.remove(id); },
      async isAllowed(o) { return sync.embedOrigins.isAllowed(o); },
    },
    settings: {
      async get(k) { return sync.settings.get(k); },
      async set(k, v) { sync.settings.set(k, v); },
      async getBool(k) { return sync.settings.getBool(k); },
      async setBool(k, v) { sync.settings.setBool(k, v); },
    },
    raw: { store: sync.store },
    async close() { rawDb.close(); },
  };
}

// ───── Factory ────────────────────────────────────────────────────

export function openStorage(input: string | DbConfig): Storage {
  const cfg: DbConfig =
    typeof input === "string" ? { kind: "sqlite", url: input } : input;

  if (cfg.kind === "postgres" || cfg.kind === "mysql") {
    throw new Error(
      `wigtoken: ${cfg.kind} backend is not implemented yet (coming in a v0.3.x patch). ` +
        `Set DB_URL to a sqlite path or omit it to use the default.`
    );
  }

  mkdirSync(dirname(cfg.url), { recursive: true });
  const db = new Database(cfg.url);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return wrapSqlite(db);
}
