/**
 * Drizzle schema for the Postgres backend. Logically identical to the
 * SQLite schema (same column names, same indexes), expressed in
 * pg-core dialect — bigint for timestamps, doublePrecision for cost,
 * serial for autoincrement.
 */

import {
  bigint,
  doublePrecision,
  index,
  integer,
  pgTable,
  serial,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const messages = pgTable(
  "messages",
  {
    messageId: text("message_id").primaryKey(),
    user: text("user").notNull(),
    machine: text("machine").notNull(),
    model: text("model").notNull(),
    modelFamily: text("model_family").notNull(),
    inputTokens: bigint("input_tokens", { mode: "number" }).notNull().default(0),
    cacheCreation: bigint("cache_creation", { mode: "number" }).notNull().default(0),
    cacheRead: bigint("cache_read", { mode: "number" }).notNull().default(0),
    outputTokens: bigint("output_tokens", { mode: "number" }).notNull().default(0),
    costUsd: doublePrecision("cost_usd").notNull().default(0),
    ts: bigint("ts", { mode: "number" }).notNull(),
  },
  (t) => ({
    tsIdx: index("idx_messages_ts").on(t.ts),
    userIdx: index("idx_messages_user").on(t.user),
    familyIdx: index("idx_messages_family").on(t.modelFamily),
  })
);

export const tokens = pgTable(
  "tokens",
  {
    id: serial("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    user: text("user").notNull(),
    scope: text("scope").notNull(),
    label: text("label"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    expiresAt: bigint("expires_at", { mode: "number" }),
    revokedAt: bigint("revoked_at", { mode: "number" }),
    lastUsedAt: bigint("last_used_at", { mode: "number" }),
  },
  (t) => ({
    hashIdx: uniqueIndex("uq_tokens_hash").on(t.tokenHash),
  })
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    ts: bigint("ts", { mode: "number" }).notNull(),
    tokenId: integer("token_id"),
    action: text("action").notNull(),
    user: text("user"),
    ip: text("ip"),
    meta: text("meta"),
  },
  (t) => ({
    tsIdx: index("idx_audit_ts").on(t.ts),
  })
);

export const embedOrigins = pgTable(
  "embed_origins",
  {
    id: serial("id").primaryKey(),
    origin: text("origin").notNull(),
    label: text("label"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    createdBy: integer("created_by"),
  },
  (t) => ({
    originIdx: uniqueIndex("uq_embed_origins_origin").on(t.origin),
  })
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const schema = { messages, tokens, auditLog, embedOrigins, settings };
export type PgSchema = typeof schema;
