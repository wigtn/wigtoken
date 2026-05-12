/**
 * Postgres-backed Storage. Uses drizzle-orm/postgres-js so the
 * exact same query DSL we used for SQLite metadata stores in Phase 2b
 * applies here — just against the pg dialect schema.
 *
 * Driver is lazy-imported: `postgres` is in optionalDependencies so a
 * sqlite-only install doesn't have to pull it in. We surface a
 * clear error if DB_URL points at postgres but the driver isn't on
 * disk.
 */

import { createHash, randomBytes } from "node:crypto";
import { and, count, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
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
  fileOffsets,
  messages,
  processedMessages,
  settings,
  tokens,
  totals,
} from "./schema/pg.ts";

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

/**
 * Bring up the schema. drizzle-kit can generate migrations, but for
 * v0.3 we ship a single idempotent CREATE-TABLE-IF-NOT-EXISTS pass —
 * keeps deployments simple, no kit binary required at runtime.
 */
async function ensureSchema(db: PostgresJsDatabase): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS file_offsets (
      path TEXT PRIMARY KEY,
      "offset" BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS processed_messages (
      message_id TEXT PRIMARY KEY,
      added_at BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS totals (
      key TEXT PRIMARY KEY,
      value BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      message_id        TEXT PRIMARY KEY,
      "user"            TEXT NOT NULL,
      machine           TEXT NOT NULL,
      model             TEXT NOT NULL,
      model_family      TEXT NOT NULL,
      input_tokens      BIGINT NOT NULL DEFAULT 0,
      cache_creation    BIGINT NOT NULL DEFAULT 0,
      cache_read        BIGINT NOT NULL DEFAULT 0,
      output_tokens     BIGINT NOT NULL DEFAULT 0,
      cost_usd_micros   BIGINT NOT NULL DEFAULT 0,
      weighted_input_eq BIGINT NOT NULL DEFAULT 0,
      cost_usd          DOUBLE PRECISION NOT NULL DEFAULT 0,
      ts                BIGINT NOT NULL,
      ingested_at       BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_ts ON messages(ts);
    CREATE INDEX IF NOT EXISTS idx_messages_user ON messages("user");
    CREATE INDEX IF NOT EXISTS idx_messages_family ON messages(model_family);
    CREATE TABLE IF NOT EXISTS tokens (
      id SERIAL PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      "user" TEXT NOT NULL,
      scope TEXT NOT NULL,
      label TEXT,
      created_at BIGINT NOT NULL,
      expires_at BIGINT,
      revoked_at BIGINT,
      last_used_at BIGINT
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      ts BIGINT NOT NULL,
      token_id INTEGER,
      action TEXT NOT NULL,
      "user" TEXT,
      ip TEXT,
      meta_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts);
    CREATE TABLE IF NOT EXISTS embed_origins (
      id SERIAL PRIMARY KEY,
      origin TEXT NOT NULL UNIQUE,
      label TEXT,
      created_at BIGINT NOT NULL,
      created_by INTEGER
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Seed the totals materialised counters once. Subsequent runs are
  // no-ops thanks to ON CONFLICT DO NOTHING.
  for (const k of TOTAL_KEYS) {
    await db.execute(sql`
      INSERT INTO totals (key, value) VALUES (${k}, 0)
      ON CONFLICT (key) DO NOTHING;
    `);
  }
}

/**
 * Lazy-load `postgres` (the postgres-js driver). Throws a friendly
 * error if it's missing — operators see actionable text instead of a
 * cryptic module-not-found.
 */
async function openPgDriver(url: string) {
  let postgres: any;
  try {
    postgres = (await import("postgres" as string)).default;
  } catch (err) {
    throw new Error(
      "wigtoken: DB_URL points at Postgres but the `postgres` driver " +
        "is not installed. Run `npm install postgres` and retry.\n" +
        `(underlying error: ${(err as Error).message})`
    );
  }
  // ssl: prefer enabled when the URL says so, allow override via the
  // standard libpq query string. postgres-js handles ssl=require etc.
  const client = postgres(url, { max: 10, idle_timeout: 20 });
  const drizzle = (await import("drizzle-orm/postgres-js")).drizzle;
  return { client, db: drizzle(client) };
}

export async function openPgStorage(url: string): Promise<Storage> {
  const { client, db } = await openPgDriver(url);
  await ensureSchema(db);

  // ───── Settings ─────
  const settingsStore = {
    async get(key: string) {
      const row = await db
        .select({ value: settings.value })
        .from(settings)
        .where(eq(settings.key, key))
        .limit(1);
      return row[0]?.value ?? null;
    },
    async set(key: string, value: string) {
      await db
        .insert(settings)
        .values({ key, value })
        .onConflictDoUpdate({ target: settings.key, set: { value } });
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
      const [row] = await db
        .insert(embedOrigins)
        .values({ origin, label, createdAt, createdBy })
        .returning();
      return {
        id: row.id,
        origin: row.origin,
        label: row.label,
        createdAt: row.createdAt,
        createdBy: row.createdBy,
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
      const res = await db
        .delete(embedOrigins)
        .where(eq(embedOrigins.id, id))
        .returning({ id: embedOrigins.id });
      return res.length > 0;
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
      const [row] = await db
        .insert(tokens)
        .values({
          tokenHash: hash,
          user: args.user,
          scope: args.scope,
          label: args.label ?? null,
          createdAt,
          expiresAt: args.expiresAt ?? null,
        })
        .returning({ id: tokens.id });
      return {
        id: row.id,
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
      await db
        .update(tokens)
        .set({ lastUsedAt: Date.now() })
        .where(eq(tokens.id, row.id));
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
      const rows = await db
        .select()
        .from(tokens)
        .orderBy(desc(tokens.createdAt));
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
        .where(and(eq(tokens.id, id), isNull(tokens.revokedAt)))
        .returning({ id: tokens.id });
      return res.length > 0;
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
    async getFileOffset(path: string) {
      const rows = await db
        .select({ offset: fileOffsets.offset })
        .from(fileOffsets)
        .where(eq(fileOffsets.path, path))
        .limit(1);
      return rows[0]?.offset ?? 0;
    },
    async setFileOffset(path: string, offset: number) {
      await db
        .insert(fileOffsets)
        .values({ path, offset })
        .onConflictDoUpdate({
          target: fileOffsets.path,
          set: { offset },
        });
    },
    async applyUsage(u: ParsedUsage, labels: Labels) {
      // Insert into processed_messages first; if conflict, this is a
      // duplicate and we bail. ON CONFLICT DO NOTHING + checking
      // affected count via returning() id is the idempotency idiom.
      const dedup = await db
        .insert(processedMessages)
        .values({ messageId: u.messageId, addedAt: Date.now() })
        .onConflictDoNothing()
        .returning({ id: processedMessages.messageId });
      if (dedup.length === 0) return false;

      const family = modelFamily(u.model);
      const weighted = weightedInputEquivalent(
        u.input,
        u.cacheCreation,
        u.cacheRead,
        u.output
      );
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
          sql`UPDATE totals SET value = value + ${by} WHERE key = ${key}`
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
      const rows = await db.select().from(totals);
      const out: Record<string, number> = {};
      for (const r of rows) out[r.key] = r.value;
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
      const rows = await db.execute<{
        user: string;
        machine: string;
        model: string;
        model_family: string;
        input: number;
        cache_creation: number;
        cache_read: number;
        output: number;
      }>(sql`
        SELECT
          "user", machine, model, model_family,
          SUM(input_tokens)   AS input,
          SUM(cache_creation) AS cache_creation,
          SUM(cache_read)     AS cache_read,
          SUM(output_tokens)  AS output
        FROM messages
        GROUP BY "user", machine, model, model_family
      `);
      const out: BreakdownRow[] = [];
      for (const r of rows as any) {
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
      const rows = await db.execute<{
        user: string;
        machine: string;
        model_family: string;
        messages: number;
        cost_usd_micros: number;
        weighted_input_eq: number;
      }>(sql`
        SELECT
          "user", machine, model_family,
          COUNT(*)               AS messages,
          SUM(cost_usd_micros)   AS cost_usd_micros,
          SUM(weighted_input_eq) AS weighted_input_eq
        FROM messages
        GROUP BY "user", machine, model_family
      `);
      return (rows as any).map((r: any) => ({
        user: r.user,
        machine: r.machine,
        modelFamily: r.model_family,
        messages: Number(r.messages),
        costUsd: Number(r.cost_usd_micros) / 1_000_000,
        weightedInputEq: Number(r.weighted_input_eq),
      }));
    },
    async timeseries(fromMs: number, toMs: number, stepMs: number): Promise<TimeseriesBucket[]> {
      const rows = await db.execute<{
        bucket: number;
        messages: number;
        raw: number;
        weighted: number;
        cost_micros: number;
      }>(sql`
        SELECT
          (ts / ${stepMs}) * ${stepMs}                                            AS bucket,
          COUNT(*)                                                                AS messages,
          SUM(input_tokens + cache_creation + cache_read + output_tokens)         AS raw,
          SUM(weighted_input_eq)                                                  AS weighted,
          SUM(cost_usd_micros)                                                    AS cost_micros
        FROM messages
        WHERE ts >= ${fromMs} AND ts < ${toMs}
        GROUP BY bucket
        ORDER BY bucket ASC
      `);
      return (rows as any).map((r: any) => ({
        ts: Number(r.bucket),
        messages: Number(r.messages),
        tokensRaw: Number(r.raw ?? 0),
        tokensWeighted: Number(r.weighted ?? 0),
        costUsd: Number(r.cost_micros ?? 0) / 1_000_000,
      }));
    },
    async leaderboard(by: "user" | "machine" | "model_family", limit = 20): Promise<LeaderboardEntry[]> {
      // Column name has to be interpolated; whitelist enforced above
      // by the caller (server.ts validates the `by` query param).
      const colSql =
        by === "user"
          ? sql`"user"`
          : by === "machine"
            ? sql`machine`
            : sql`model_family`;
      const rows = await db.execute<{
        key: string;
        messages: number;
        cost_micros: number;
        weighted: number;
      }>(sql`
        SELECT
          ${colSql}            AS key,
          COUNT(*)             AS messages,
          SUM(cost_usd_micros) AS cost_micros,
          SUM(weighted_input_eq) AS weighted
        FROM messages
        GROUP BY ${colSql}
        ORDER BY cost_micros DESC
        LIMIT ${limit}
      `);
      return (rows as any).map((r: any) => ({
        key: r.key,
        messages: Number(r.messages),
        costUsd: Number(r.cost_micros ?? 0) / 1_000_000,
        weightedInputEq: Number(r.weighted ?? 0),
      }));
    },
    async userDetail(user: string): Promise<UserDetail> {
      const [t, perFamily, perMachine] = await Promise.all([
        db.execute<{
          messages: number;
          cost_micros: number;
          weighted: number;
        }>(sql`
          SELECT COUNT(*) AS messages,
                 SUM(cost_usd_micros) AS cost_micros,
                 SUM(weighted_input_eq) AS weighted
          FROM messages WHERE "user" = ${user}
        `),
        db.execute<{
          model_family: string;
          messages: number;
          cost_micros: number;
          weighted: number;
        }>(sql`
          SELECT model_family,
                 COUNT(*) AS messages,
                 SUM(cost_usd_micros) AS cost_micros,
                 SUM(weighted_input_eq) AS weighted
          FROM messages WHERE "user" = ${user}
          GROUP BY model_family
          ORDER BY cost_micros DESC
        `),
        db.execute<{
          machine: string;
          messages: number;
          cost_micros: number;
        }>(sql`
          SELECT machine,
                 COUNT(*) AS messages,
                 SUM(cost_usd_micros) AS cost_micros
          FROM messages WHERE "user" = ${user}
          GROUP BY machine
          ORDER BY cost_micros DESC
        `),
      ]);
      const tot = (t as any)[0] ?? { messages: 0, cost_micros: 0, weighted: 0 };
      return {
        user,
        totals: {
          messages: Number(tot.messages ?? 0),
          costUsd: Number(tot.cost_micros ?? 0) / 1_000_000,
          weightedInputEq: Number(tot.weighted ?? 0),
        },
        perFamily: (perFamily as any).map((r: any) => ({
          modelFamily: r.model_family,
          messages: Number(r.messages),
          costUsd: Number(r.cost_micros) / 1_000_000,
          weightedInputEq: Number(r.weighted),
        })),
        perMachine: (perMachine as any).map((r: any) => ({
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
    kind: "postgres",
    store: usageStore,
    tokens: tokensStore,
    audit: auditStore,
    embedOrigins: embedOriginsStore,
    settings: settingsStore,
    raw: null, // No sync ingest path on PG — handlers use the async store.
    async close() {
      await client.end({ timeout: 5 });
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
// Keep `lt` import alive for future range queries.
void lt;
