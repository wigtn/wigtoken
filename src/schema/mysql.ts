/**
 * Drizzle schema for the MySQL backend. Same logical shape as sqlite/
 * pg with MySQL's column type peculiarities — varchar primary keys
 * (since BLOB/TEXT can't be primary keys cleanly), bigint for ts,
 * double for cost, auto-increment ints for surrogate keys.
 */

import {
  bigint,
  double,
  index,
  int,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const messages = mysqlTable(
  "messages",
  {
    messageId: varchar("message_id", { length: 191 }).primaryKey(),
    user: varchar("user", { length: 191 }).notNull(),
    machine: varchar("machine", { length: 191 }).notNull(),
    model: varchar("model", { length: 191 }).notNull(),
    modelFamily: varchar("model_family", { length: 64 }).notNull(),
    inputTokens: bigint("input_tokens", { mode: "number" }).notNull().default(0),
    cacheCreation: bigint("cache_creation", { mode: "number" }).notNull().default(0),
    cacheRead: bigint("cache_read", { mode: "number" }).notNull().default(0),
    outputTokens: bigint("output_tokens", { mode: "number" }).notNull().default(0),
    costUsd: double("cost_usd").notNull().default(0),
    ts: bigint("ts", { mode: "number" }).notNull(),
  },
  (t) => ({
    tsIdx: index("idx_messages_ts").on(t.ts),
    userIdx: index("idx_messages_user").on(t.user),
    familyIdx: index("idx_messages_family").on(t.modelFamily),
  })
);

export const tokens = mysqlTable(
  "tokens",
  {
    id: int("id").autoincrement().primaryKey(),
    tokenHash: varchar("token_hash", { length: 191 }).notNull(),
    user: varchar("user", { length: 191 }).notNull(),
    scope: varchar("scope", { length: 32 }).notNull(),
    label: varchar("label", { length: 191 }),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    expiresAt: bigint("expires_at", { mode: "number" }),
    revokedAt: bigint("revoked_at", { mode: "number" }),
    lastUsedAt: bigint("last_used_at", { mode: "number" }),
  },
  (t) => ({
    hashIdx: uniqueIndex("uq_tokens_hash").on(t.tokenHash),
  })
);

export const auditLog = mysqlTable(
  "audit_log",
  {
    id: int("id").autoincrement().primaryKey(),
    ts: bigint("ts", { mode: "number" }).notNull(),
    tokenId: int("token_id"),
    action: varchar("action", { length: 64 }).notNull(),
    user: varchar("user", { length: 191 }),
    ip: varchar("ip", { length: 64 }),
    metaJson: text("meta_json"),
  },
  (t) => ({
    tsIdx: index("idx_audit_ts").on(t.ts),
  })
);

export const embedOrigins = mysqlTable(
  "embed_origins",
  {
    id: int("id").autoincrement().primaryKey(),
    origin: varchar("origin", { length: 191 }).notNull(),
    label: varchar("label", { length: 191 }),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    createdBy: int("created_by"),
  },
  (t) => ({
    originIdx: uniqueIndex("uq_embed_origins_origin").on(t.origin),
  })
);

export const settings = mysqlTable("settings", {
  key: varchar("key", { length: 191 }).primaryKey(),
  value: text("value").notNull(),
});

export const schema = { messages, tokens, auditLog, embedOrigins, settings };
export type MysqlSchema = typeof schema;
