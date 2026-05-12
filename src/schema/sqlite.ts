/**
 * Drizzle schema for the SQLite backend. Mirrors the hand-rolled CREATE
 * TABLE statements that the original better-sqlite3 store used so the
 * v0.2.x → v0.3.x migration is a no-op for existing operators.
 *
 * Postgres / MySQL get their own schema files using the same logical
 * shape but with each dialect's column types and identity strategy.
 */

import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const messages = sqliteTable(
  "messages",
  {
    messageId: text("message_id").primaryKey(),
    user: text("user").notNull(),
    machine: text("machine").notNull(),
    model: text("model").notNull(),
    modelFamily: text("model_family").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    cacheCreation: integer("cache_creation").notNull().default(0),
    cacheRead: integer("cache_read").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: real("cost_usd").notNull().default(0),
    ts: integer("ts").notNull(),
  },
  (t) => ({
    tsIdx: index("idx_messages_ts").on(t.ts),
    userIdx: index("idx_messages_user").on(t.user),
    familyIdx: index("idx_messages_family").on(t.modelFamily),
  })
);

export const tokens = sqliteTable(
  "tokens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tokenHash: text("token_hash").notNull(),
    user: text("user").notNull(),
    scope: text("scope").notNull(),
    label: text("label"),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at"),
    revokedAt: integer("revoked_at"),
    lastUsedAt: integer("last_used_at"),
  },
  (t) => ({
    hashIdx: uniqueIndex("uq_tokens_hash").on(t.tokenHash),
  })
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ts: integer("ts").notNull(),
    tokenId: integer("token_id"),
    action: text("action").notNull(),
    user: text("user"),
    ip: text("ip"),
    metaJson: text("meta_json"),
  },
  (t) => ({
    tsIdx: index("idx_audit_ts").on(t.ts),
  })
);

export const embedOrigins = sqliteTable(
  "embed_origins",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    origin: text("origin").notNull(),
    label: text("label"),
    createdAt: integer("created_at").notNull(),
    createdBy: integer("created_by"),
  },
  (t) => ({
    originIdx: uniqueIndex("uq_embed_origins_origin").on(t.origin),
  })
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const schema = { messages, tokens, auditLog, embedOrigins, settings };
export type SqliteSchema = typeof schema;

// Marker so the generated drizzle-kit SQL matches what runtime expects
// even before the first message lands.
export const SCHEMA_VERSION = 1;

// Convenience: a place to keep raw initial CREATE TABLE statements in
// case we want to ship them as bundled migrations rather than depend
// on drizzle-kit at runtime.
export const initialDdl = sql`SELECT 1`;
