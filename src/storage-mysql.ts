/**
 * MySQL-backed Storage. Mirrors storage-pg.ts but against the mysql
 * dialect schema. Uses drizzle-orm/mysql2 with the mysql2/promise
 * client — both lazy-imported so a sqlite-only install stays lean.
 */

import { createHash, randomBytes } from "node:crypto";
import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type { Storage } from "./storage.ts";
import type {
  BreakdownRow,
  CostBreakdownRow,
  Labels,
  LeaderboardEntry,
  TimeseriesBucket,
  Totals,
  UserDetail,
} from "./db.ts";
import type { ParsedUsage } from "./parser.ts";
import type { Scope, IssuedToken, TokenRow } from "./tokens.ts";
import type { AuditEntry } from "./audit.ts";
import type { EmbedOriginRow } from "./embed-origins.ts";
import { modelFamily, weightedInputEquivalent } from "./pricing.ts";
import {
  auditLog,
  embedOrigins,
  messages,
  settings,
  tokens,
} from "./schema/mysql.ts";

const TOKEN_PREFIX = "wts_";
const TOTAL_KEYS = [
  "input",
  "cacheCreation",
  "cacheRead",
  "output",
  "sum",
  "messages",
  "costUsdMicros",
] as const;

function hashToken(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

function generateToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString("hex");
}

async function ensureSchema(db: MySql2Database): Promise<void> {
  const ddl = [
    `CREATE TABLE IF NOT EXISTS file_offsets (
       path VARCHAR(255) PRIMARY KEY,
       offset BIGINT NOT NULL
     )`,
    `CREATE TABLE IF NOT EXISTS processed_messages (
       message_id VARCHAR(191) PRIMARY KEY,
       added_at BIGINT NOT NULL
     )`,
    `CREATE TABLE IF NOT EXISTS totals (
       \`key\` VARCHAR(64) PRIMARY KEY,
       value BIGINT NOT NULL
     )`,
    `CREATE TABLE IF NOT EXISTS messages (
       message_id        VARCHAR(191) PRIMARY KEY,
       user              VARCHAR(191) NOT NULL,
       machine           VARCHAR(191) NOT NULL,
       model             VARCHAR(191) NOT NULL,
       model_family      VARCHAR(64)  NOT NULL,
       input_tokens      BIGINT NOT NULL DEFAULT 0,
       cache_creation    BIGINT NOT NULL DEFAULT 0,
       cache_read        BIGINT NOT NULL DEFAULT 0,
       output_tokens     BIGINT NOT NULL DEFAULT 0,
       cost_usd_micros   BIGINT NOT NULL DEFAULT 0,
       weighted_input_eq BIGINT NOT NULL DEFAULT 0,
       cost_usd          DOUBLE NOT NULL DEFAULT 0,
       ts                BIGINT NOT NULL,
       ingested_at       BIGINT NOT NULL,
       INDEX idx_messages_ts (ts),
       INDEX idx_messages_user (user),
       INDEX idx_messages_family (model_family)
     )`,
    `CREATE TABLE IF NOT EXISTS tokens (
       id INT AUTO_INCREMENT PRIMARY KEY,
       token_hash VARCHAR(64) NOT NULL UNIQUE,
       user VARCHAR(191) NOT NULL,
       scope VARCHAR(32) NOT NULL,
       label VARCHAR(191),
       created_at BIGINT NOT NULL,
       expires_at BIGINT,
       revoked_at BIGINT,
       last_used_at BIGINT
     )`,
    `CREATE TABLE IF NOT EXISTS audit_log (
       id INT AUTO_INCREMENT PRIMARY KEY,
       ts BIGINT NOT NULL,
       token_id INT,
       action VARCHAR(64) NOT NULL,
       user VARCHAR(191),
       ip VARCHAR(64),
       meta_json TEXT,
       INDEX idx_audit_ts (ts)
     )`,
    `CREATE TABLE IF NOT EXISTS embed_origins (
       id INT AUTO_INCREMENT PRIMARY KEY,
       origin VARCHAR(191) NOT NULL UNIQUE,
       label VARCHAR(191),
       created_at BIGINT NOT NULL,
       created_by INT
     )`,
    `CREATE TABLE IF NOT EXISTS settings (
       \`key\` VARCHAR(191) PRIMARY KEY,
       value TEXT NOT NULL
     )`,
  ];
  for (const stmt of ddl) {
    await db.execute(sql.raw(stmt));
  }
  for (const k of TOTAL_KEYS) {
    await db.execute(sql`INSERT IGNORE INTO totals (\`key\`, value) VALUES (${k}, 0)`);
  }
}

async function openMysqlDriver(url: string) {
  let mysql: any;
  try {
    mysql = (await import("mysql2/promise" as string)).default ?? (await import("mysql2/promise" as string));
  } catch (err) {
    throw new Error(
      "wigtoken: DB_URL points at MySQL but the `mysql2` driver " +
        "is not installed. Run `npm install mysql2` and retry.\n" +
        `(underlying error: ${(err as Error).message})`
    );
  }
  const pool = mysql.createPool(url);
  const drizzle = (await import("drizzle-orm/mysql2")).drizzle;
  return { pool, db: drizzle(pool) };
}

export async function openMysqlStorage(url: string): Promise<Storage> {
  const { pool, db } = await openMysqlDriver(url);
  await ensureSchema(db);

  // ───── Settings ─────
  const settingsStore = {
    async get(key: string) {
      const rows = await db
        .select({ value: settings.value })
        .from(settings)
        .where(eq(settings.key, key))
        .limit(1);
      return rows[0]?.value ?? null;
    },
    async set(key: string, value: string) {
      await db
        .insert(settings)
        .values({ key, value })
        .onDuplicateKeyUpdate({ set: { value } });
    },
    async getBool(key: string) {
      return (await settingsStore.get(key)) === "true";
    },
    async setBool(key: string, value: boolean) {
      await settingsStore.set(key, value ? "true" : "false");
    },
  };

  // ───── Embed origins ─────
  const embedOriginsStore = {
    async add(origin: string, label: string | null, createdBy: number | null): Promise<EmbedOriginRow> {
      const createdAt = Date.now();
      await db.insert(embedOrigins).values({ origin, label, createdAt, createdBy });
      // MySQL doesn't support RETURNING — pull the id back via the
      // unique origin we just inserted.
      const rows = await db
        .select()
        .from(embedOrigins)
        .where(eq(embedOrigins.origin, origin))
        .limit(1);
      const r = rows[0]!;
      return {
        id: r.id,
        origin: r.origin,
        label: r.label,
        createdAt: r.createdAt,
        createdBy: r.createdBy,
      };
    },
    async list() {
      const rows = await db
        .select()
        .from(embedOrigins)
        .orderBy(desc(embedOrigins.createdAt));
      return rows.map((r) => ({
        id: r.id,
        origin: r.origin,
        label: r.label,
        createdAt: r.createdAt,
        createdBy: r.createdBy,
      }));
    },
    async remove(id: number) {
      const result = await db.delete(embedOrigins).where(eq(embedOrigins.id, id));
      return (result as any)?.[0]?.affectedRows > 0 || (result as any)?.affectedRows > 0;
    },
    async isAllowed(origin: string) {
      const rows = await db
        .select({ id: embedOrigins.id })
        .from(embedOrigins)
        .where(eq(embedOrigins.origin, origin))
        .limit(1);
      return rows.length > 0;
    },
  };

  // ───── Audit ─────
  const auditStore = {
    async record(entry: AuditEntry) {
      await db.insert(auditLog).values({
        ts: entry.ts,
        tokenId: entry.tokenId,
        action: entry.action,
        user: entry.user,
        ip: entry.ip,
        metaJson:
          entry.meta === undefined ? null : JSON.stringify(entry.meta),
      });
    },
    async list(opts: { sinceMs?: number; limit?: number } = {}) {
      const since = opts.sinceMs ?? Date.now() - 7 * 24 * 60 * 60 * 1000;
      const limit = opts.limit ?? 500;
      const rows = await db
        .select()
        .from(auditLog)
        .where(gte(auditLog.ts, since))
        .orderBy(desc(auditLog.ts))
        .limit(limit);
      return rows.map((r) => ({
        ts: r.ts,
        tokenId: r.tokenId,
        action: r.action,
        user: r.user,
        ip: r.ip,
        meta: r.metaJson ? safeParse(r.metaJson) : undefined,
      }));
    },
  };

  // ───── Tokens ─────
  const tokensStore = {
    async issue(args: { user: string; scope: Scope; label?: string; expiresAt?: number }): Promise<IssuedToken> {
      const token = generateToken();
      const hash = hashToken(token);
      const createdAt = Date.now();
      await db.insert(tokens).values({
        tokenHash: hash,
        user: args.user,
        scope: args.scope,
        label: args.label ?? null,
        createdAt,
        expiresAt: args.expiresAt ?? null,
      });
      const rows = await db
        .select({ id: tokens.id })
        .from(tokens)
        .where(eq(tokens.tokenHash, hash))
        .limit(1);
      return {
        id: rows[0]!.id,
        user: args.user,
        scope: args.scope,
        label: args.label ?? null,
        token,
        createdAt,
        expiresAt: args.expiresAt ?? null,
      };
    },
    async resolve(plain: string): Promise<TokenRow | null> {
      if (!plain.startsWith(TOKEN_PREFIX)) return null;
      const hash = hashToken(plain);
      const rows = await db
        .select()
        .from(tokens)
        .where(eq(tokens.tokenHash, hash))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      if (row.revokedAt !== null) return null;
      if (row.expiresAt !== null && row.expiresAt < Date.now()) return null;
      await db.update(tokens).set({ lastUsedAt: Date.now() }).where(eq(tokens.id, row.id));
      return {
        id: row.id,
        user: row.user,
        scope: row.scope as Scope,
        label: row.label,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
        revokedAt: row.revokedAt,
        lastUsedAt: row.lastUsedAt,
      };
    },
    async list() {
      const rows = await db.select().from(tokens).orderBy(desc(tokens.createdAt));
      return rows.map((r) => ({
        id: r.id,
        user: r.user,
        scope: r.scope as Scope,
        label: r.label,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
        revokedAt: r.revokedAt,
        lastUsedAt: r.lastUsedAt,
      }));
    },
    async revoke(id: number) {
      const res = await db
        .update(tokens)
        .set({ revokedAt: Date.now() })
        .where(and(eq(tokens.id, id), isNull(tokens.revokedAt)));
      return (res as any)?.[0]?.affectedRows > 0 || (res as any)?.affectedRows > 0;
    },
    async needsBootstrapAdmin() {
      const rows = await db
        .select({ n: count() })
        .from(tokens)
        .where(and(eq(tokens.scope, "admin"), isNull(tokens.revokedAt)));
      return (rows[0]?.n ?? 0) === 0;
    },
  };

  // ───── Store (usage data) ─────
  const usageStore = {
    async getFileOffset(path: string): Promise<number> {
      const rows = await db.execute<{ offset: number }>(
        sql`SELECT offset FROM file_offsets WHERE path = ${path} LIMIT 1`
      );
      return Number((rows as any)?.[0]?.offset ?? 0);
    },
    async setFileOffset(path: string, offset: number) {
      await db.execute(
        sql`INSERT INTO file_offsets (path, offset) VALUES (${path}, ${offset})
             ON DUPLICATE KEY UPDATE offset = ${offset}`
      );
    },
    async applyUsage(u: ParsedUsage, labels: Labels) {
      // INSERT IGNORE for the dedup; affectedRows tells us whether
      // the row was actually accepted.
      const dedup = await db.execute(
        sql`INSERT IGNORE INTO processed_messages (message_id, added_at)
            VALUES (${u.messageId}, ${Date.now()})`
      );
      const affected = (dedup as any)?.[0]?.affectedRows ?? (dedup as any)?.affectedRows ?? 0;
      if (affected === 0) return false;

      const family = modelFamily(u.model);
      const weighted = weightedInputEquivalent(u.input, u.cacheCreation, u.cacheRead, u.output);
      const costMicros = Math.round(u.costUsd * 1_000_000);
      const ts = u.timestamp ? Date.parse(u.timestamp) : Date.now();

      await db.insert(messages).values({
        messageId: u.messageId,
        user: labels.user,
        machine: labels.machine,
        model: u.model ?? "unknown",
        modelFamily: family,
        inputTokens: u.input,
        cacheCreation: u.cacheCreation,
        cacheRead: u.cacheRead,
        outputTokens: u.output,
        costUsdMicros: costMicros,
        weightedInputEq: weighted,
        costUsd: u.costUsd,
        ts: Number.isFinite(ts) ? ts : Date.now(),
        ingestedAt: Date.now(),
      });

      const inc = async (key: string, by: number) => {
        await db.execute(
          sql`UPDATE totals SET value = value + ${by} WHERE \`key\` = ${key}`
        );
      };
      await Promise.all([
        inc("input", u.input),
        inc("cacheCreation", u.cacheCreation),
        inc("cacheRead", u.cacheRead),
        inc("output", u.output),
        inc("sum", u.sum),
        inc("messages", 1),
        inc("costUsdMicros", costMicros),
      ]);

      return true;
    },
    async getTotals(): Promise<Totals> {
      const rows = await db.execute<{ key: string; value: number }>(
        sql`SELECT \`key\`, value FROM totals`
      );
      const list = (rows as any) as Array<{ key: string; value: number }>;
      const out: Record<string, number> = {};
      for (const r of list) out[r.key] = Number(r.value);
      return {
        input: out.input ?? 0,
        cacheCreation: out.cacheCreation ?? 0,
        cacheRead: out.cacheRead ?? 0,
        output: out.output ?? 0,
        sum: out.sum ?? 0,
        messages: out.messages ?? 0,
        costUsd: (out.costUsdMicros ?? 0) / 1_000_000,
      };
    },
    async tokenBreakdown(): Promise<BreakdownRow[]> {
      const rows = await db.execute(sql`
        SELECT user, machine, model, model_family,
               SUM(input_tokens)   AS input,
               SUM(cache_creation) AS cache_creation,
               SUM(cache_read)     AS cache_read,
               SUM(output_tokens)  AS output
        FROM messages
        GROUP BY user, machine, model, model_family
      `);
      const out: BreakdownRow[] = [];
      for (const r of (rows as any) as any[]) {
        for (const kind of ["input", "cache_creation", "cache_read", "output"] as const) {
          out.push({
            user: r.user,
            machine: r.machine,
            model: r.model,
            modelFamily: r.model_family,
            kind,
            tokens: Number(r[kind] ?? 0),
          });
        }
      }
      return out;
    },
    async costBreakdown(): Promise<CostBreakdownRow[]> {
      const rows = await db.execute(sql`
        SELECT user, machine, model_family,
               COUNT(*) AS messages,
               SUM(cost_usd_micros) AS cost_usd_micros,
               SUM(weighted_input_eq) AS weighted_input_eq
        FROM messages
        GROUP BY user, machine, model_family
      `);
      return ((rows as any) as any[]).map((r) => ({
        user: r.user,
        machine: r.machine,
        modelFamily: r.model_family,
        messages: Number(r.messages),
        costUsd: Number(r.cost_usd_micros) / 1_000_000,
        weightedInputEq: Number(r.weighted_input_eq),
      }));
    },
    async timeseries(fromMs: number, toMs: number, stepMs: number): Promise<TimeseriesBucket[]> {
      const rows = await db.execute(sql`
        SELECT (ts DIV ${stepMs}) * ${stepMs} AS bucket,
               COUNT(*)                       AS messages,
               SUM(input_tokens + cache_creation + cache_read + output_tokens) AS raw,
               SUM(weighted_input_eq)         AS weighted,
               SUM(cost_usd_micros)           AS cost_micros
        FROM messages
        WHERE ts >= ${fromMs} AND ts < ${toMs}
        GROUP BY bucket
        ORDER BY bucket ASC
      `);
      return ((rows as any) as any[]).map((r) => ({
        ts: Number(r.bucket),
        messages: Number(r.messages),
        tokensRaw: Number(r.raw ?? 0),
        tokensWeighted: Number(r.weighted ?? 0),
        costUsd: Number(r.cost_micros ?? 0) / 1_000_000,
      }));
    },
    async leaderboard(by: "user" | "machine" | "model_family", limit = 20): Promise<LeaderboardEntry[]> {
      const colSql =
        by === "user"
          ? sql`user`
          : by === "machine"
            ? sql`machine`
            : sql`model_family`;
      const rows = await db.execute(sql`
        SELECT ${colSql}            AS \`key\`,
               COUNT(*)             AS messages,
               SUM(cost_usd_micros) AS cost_micros,
               SUM(weighted_input_eq) AS weighted
        FROM messages
        GROUP BY ${colSql}
        ORDER BY cost_micros DESC
        LIMIT ${limit}
      `);
      return ((rows as any) as any[]).map((r) => ({
        key: r.key,
        messages: Number(r.messages),
        costUsd: Number(r.cost_micros ?? 0) / 1_000_000,
        weightedInputEq: Number(r.weighted ?? 0),
      }));
    },
    async userDetail(user: string): Promise<UserDetail> {
      const [tRows, fRows, mRows] = await Promise.all([
        db.execute(sql`
          SELECT COUNT(*) AS messages,
                 SUM(cost_usd_micros) AS cost_micros,
                 SUM(weighted_input_eq) AS weighted
          FROM messages WHERE user = ${user}
        `),
        db.execute(sql`
          SELECT model_family,
                 COUNT(*) AS messages,
                 SUM(cost_usd_micros) AS cost_micros,
                 SUM(weighted_input_eq) AS weighted
          FROM messages WHERE user = ${user}
          GROUP BY model_family
          ORDER BY cost_micros DESC
        `),
        db.execute(sql`
          SELECT machine,
                 COUNT(*) AS messages,
                 SUM(cost_usd_micros) AS cost_micros
          FROM messages WHERE user = ${user}
          GROUP BY machine
          ORDER BY cost_micros DESC
        `),
      ]);
      const tot = ((tRows as any) as any[])[0] ?? { messages: 0, cost_micros: 0, weighted: 0 };
      return {
        user,
        totals: {
          messages: Number(tot.messages ?? 0),
          costUsd: Number(tot.cost_micros ?? 0) / 1_000_000,
          weightedInputEq: Number(tot.weighted ?? 0),
        },
        perFamily: ((fRows as any) as any[]).map((r) => ({
          modelFamily: r.model_family,
          messages: Number(r.messages),
          costUsd: Number(r.cost_micros) / 1_000_000,
          weightedInputEq: Number(r.weighted),
        })),
        perMachine: ((mRows as any) as any[]).map((r) => ({
          machine: r.machine,
          messages: Number(r.messages),
          costUsd: Number(r.cost_micros) / 1_000_000,
        })),
      };
    },
    async recentMessages(limit = 50) {
      const rows = await db
        .select()
        .from(messages)
        .orderBy(desc(messages.ts))
        .limit(limit);
      return rows.map((r) => ({
        user: r.user,
        machine: r.machine,
        model: r.model,
        modelFamily: r.modelFamily,
        inputTokens: r.inputTokens,
        cacheCreation: r.cacheCreation,
        cacheRead: r.cacheRead,
        outputTokens: r.outputTokens,
        costUsd: r.costUsdMicros / 1_000_000,
        weightedInputEq: r.weightedInputEq,
        ts: r.ts,
      }));
    },
  };

  return {
    kind: "mysql",
    store: usageStore,
    tokens: tokensStore,
    audit: auditStore,
    embedOrigins: embedOriginsStore,
    settings: settingsStore,
    raw: null,
    async close() {
      await pool.end();
    },
  };
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
