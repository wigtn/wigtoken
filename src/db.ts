import type Database from "better-sqlite3";
import type { ParsedUsage } from "./parser.ts";
import { modelFamily, weightedInputEquivalent } from "./pricing.ts";

export interface Totals {
  input: number;
  cacheCreation: number;
  cacheRead: number;
  output: number;
  sum: number;
  messages: number;
  costUsd: number;
}

export interface Labels {
  user: string;
  machine: string;
}

export interface BreakdownRow {
  user: string;
  machine: string;
  model: string;
  modelFamily: string;
  kind: string;          // input/cache_creation/cache_read/output
  tokens: number;
}

export interface CostBreakdownRow {
  user: string;
  machine: string;
  modelFamily: string;
  messages: number;
  costUsd: number;
  weightedInputEq: number;
}

export interface TimeseriesBucket {
  ts: number;                // bucket start (epoch ms)
  messages: number;
  tokensRaw: number;
  tokensWeighted: number;
  costUsd: number;
}

export interface LeaderboardEntry {
  key: string;               // user / machine / model_family value
  messages: number;
  costUsd: number;
  weightedInputEq: number;
}

export interface UserDetail {
  user: string;
  totals: {
    messages: number;
    costUsd: number;
    weightedInputEq: number;
  };
  perFamily: Array<{
    modelFamily: string;
    messages: number;
    costUsd: number;
    weightedInputEq: number;
  }>;
  perMachine: Array<{
    machine: string;
    messages: number;
    costUsd: number;
  }>;
}

// Cost is stored as integer micro-USD (USD * 1_000_000) inside `totals.value`
// to avoid floating-point drift across millions of incremental updates. We
// expose it as a regular USD float in the public Totals shape.
const TOTAL_KEYS_INT = [
  "input",
  "cacheCreation",
  "cacheRead",
  "output",
  "sum",
  "messages",
  "costUsdMicros",
] as const;

export class Store {
  private upsertOffsetStmt: Database.Statement;
  private getOffsetStmt: Database.Statement;
  private insertMsgStmt: Database.Statement;
  private insertLabeledStmt: Database.Statement;
  private incrementStmt: Database.Statement;
  private getTotalsStmt: Database.Statement;
  private breakdownTokensStmt: Database.Statement;
  private breakdownCostStmt: Database.Statement;

  constructor(private db: Database.Database) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS file_offsets (
        path TEXT PRIMARY KEY,
        offset INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS processed_messages (
        message_id TEXT PRIMARY KEY,
        added_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS totals (
        key TEXT PRIMARY KEY,
        value INTEGER NOT NULL
      );

      -- P4: per-message labelled rows. Aggregates roll up at query time.
      CREATE TABLE IF NOT EXISTS messages (
        message_id          TEXT PRIMARY KEY,
        user                TEXT NOT NULL,
        machine             TEXT NOT NULL,
        model               TEXT NOT NULL,
        model_family        TEXT NOT NULL,
        input_tokens        INTEGER NOT NULL,
        cache_creation      INTEGER NOT NULL,
        cache_read          INTEGER NOT NULL,
        output_tokens       INTEGER NOT NULL,
        cost_usd_micros     INTEGER NOT NULL,
        weighted_input_eq   INTEGER NOT NULL,
        ts                  INTEGER NOT NULL,
        ingested_at         INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ix_messages_time
        ON messages(ts);
      CREATE INDEX IF NOT EXISTS ix_messages_user_time
        ON messages(user, ts);
      CREATE INDEX IF NOT EXISTS ix_messages_label
        ON messages(user, machine, model_family, ts);
    `);

    const seed = this.db.prepare(
      "INSERT OR IGNORE INTO totals(key, value) VALUES(?, 0)"
    );
    for (const k of TOTAL_KEYS_INT) seed.run(k);

    this.upsertOffsetStmt = this.db.prepare(
      "INSERT INTO file_offsets(path, offset) VALUES(?, ?) ON CONFLICT(path) DO UPDATE SET offset=excluded.offset"
    );
    this.getOffsetStmt = this.db.prepare(
      "SELECT offset FROM file_offsets WHERE path = ?"
    );
    this.insertMsgStmt = this.db.prepare(
      "INSERT OR IGNORE INTO processed_messages(message_id, added_at) VALUES(?, ?)"
    );
    this.insertLabeledStmt = this.db.prepare(`
      INSERT OR IGNORE INTO messages (
        message_id, user, machine, model, model_family,
        input_tokens, cache_creation, cache_read, output_tokens,
        cost_usd_micros, weighted_input_eq, ts, ingested_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.incrementStmt = this.db.prepare(
      "UPDATE totals SET value = value + ? WHERE key = ?"
    );
    this.getTotalsStmt = this.db.prepare("SELECT key, value FROM totals");

    // Breakdown for /metrics: for each (user, machine, model_family),
    // emit four rows — one per token kind. Easier than four UNIONs.
    this.breakdownTokensStmt = this.db.prepare(`
      SELECT
        user,
        machine,
        model,
        model_family,
        SUM(input_tokens)    AS input,
        SUM(cache_creation)  AS cache_creation,
        SUM(cache_read)      AS cache_read,
        SUM(output_tokens)   AS output
      FROM messages
      GROUP BY user, machine, model, model_family
    `);

    this.breakdownCostStmt = this.db.prepare(`
      SELECT
        user,
        machine,
        model_family,
        COUNT(*)                   AS messages,
        SUM(cost_usd_micros)       AS cost_usd_micros,
        SUM(weighted_input_eq)     AS weighted_input_eq
      FROM messages
      GROUP BY user, machine, model_family
    `);
  }

  getFileOffset(path: string): number {
    const row = this.getOffsetStmt.get(path) as { offset: number } | undefined;
    return row?.offset ?? 0;
  }

  setFileOffset(path: string, offset: number): void {
    this.upsertOffsetStmt.run(path, offset);
  }

  /**
   * Insert a usage record. Returns true when the message_id is new
   * (and therefore counted), false when it was already seen.
   *
   * `labels` carries the user/machine attribution. The watcher derives
   * them from the file path; the ingest API takes user from the bearer
   * token and machine from the payload.
   */
  applyUsage(u: ParsedUsage, labels: Labels): boolean {
    const res = this.insertMsgStmt.run(u.messageId, Date.now());
    if (res.changes === 0) return false;

    const family = modelFamily(u.model);
    const weighted = weightedInputEquivalent(
      u.input,
      u.cacheCreation,
      u.cacheRead,
      u.output
    );
    const costMicros = Math.round(u.costUsd * 1_000_000);
    const ts = u.timestamp ? Date.parse(u.timestamp) : Date.now();
    this.insertLabeledStmt.run(
      u.messageId,
      labels.user,
      labels.machine,
      u.model ?? "unknown",
      family,
      u.input,
      u.cacheCreation,
      u.cacheRead,
      u.output,
      costMicros,
      weighted,
      Number.isFinite(ts) ? ts : Date.now(),
      Date.now()
    );

    this.incrementStmt.run(u.input, "input");
    this.incrementStmt.run(u.cacheCreation, "cacheCreation");
    this.incrementStmt.run(u.cacheRead, "cacheRead");
    this.incrementStmt.run(u.output, "output");
    this.incrementStmt.run(u.sum, "sum");
    this.incrementStmt.run(1, "messages");
    this.incrementStmt.run(costMicros, "costUsdMicros");
    return true;
  }

  getTotals(): Totals {
    const rows = this.getTotalsStmt.all() as { key: string; value: number }[];
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
  }

  /** Per-(user, machine, model, model_family, kind) token counts. */
  tokenBreakdown(): BreakdownRow[] {
    const rows = this.breakdownTokensStmt.all() as Array<{
      user: string;
      machine: string;
      model: string;
      model_family: string;
      input: number;
      cache_creation: number;
      cache_read: number;
      output: number;
    }>;
    const out: BreakdownRow[] = [];
    for (const r of rows) {
      out.push(
        ...(["input", "cache_creation", "cache_read", "output"] as const).map(
          (kind) => ({
            user: r.user,
            machine: r.machine,
            model: r.model,
            modelFamily: r.model_family,
            kind,
            tokens: (r as any)[kind] as number,
          })
        )
      );
    }
    return out;
  }

  /** Per-(user, machine, model_family) cost + weighted equivalents. */
  costBreakdown(): CostBreakdownRow[] {
    const rows = this.breakdownCostStmt.all() as Array<{
      user: string;
      machine: string;
      model_family: string;
      messages: number;
      cost_usd_micros: number;
      weighted_input_eq: number;
    }>;
    return rows.map((r) => ({
      user: r.user,
      machine: r.machine,
      modelFamily: r.model_family,
      messages: r.messages,
      costUsd: r.cost_usd_micros / 1_000_000,
      weightedInputEq: r.weighted_input_eq,
    }));
  }

  /**
   * Time-bucketed aggregate for line charts. `stepMs` rounds messages
   * to the nearest multiple of itself, so step=86400000 (1 day) groups
   * everything from that day into one bucket.
   */
  timeseries(fromMs: number, toMs: number, stepMs: number): TimeseriesBucket[] {
    const rows = this.db
      .prepare(
        `SELECT
           (ts / @step) * @step                       AS bucket,
           COUNT(*)                                   AS messages,
           SUM(input_tokens + cache_creation + cache_read + output_tokens) AS raw,
           SUM(weighted_input_eq)                     AS weighted,
           SUM(cost_usd_micros)                       AS cost_micros
         FROM messages
         WHERE ts >= @from AND ts < @to
         GROUP BY bucket
         ORDER BY bucket ASC`
      )
      .all({ from: fromMs, to: toMs, step: stepMs }) as Array<{
      bucket: number;
      messages: number;
      raw: number;
      weighted: number;
      cost_micros: number;
    }>;
    return rows.map((r) => ({
      ts: r.bucket,
      messages: r.messages,
      tokensRaw: r.raw ?? 0,
      tokensWeighted: r.weighted ?? 0,
      costUsd: (r.cost_micros ?? 0) / 1_000_000,
    }));
  }

  /** Top-N entries grouped by one of: user / machine / model_family. */
  leaderboard(
    by: "user" | "machine" | "model_family",
    limit = 20
  ): LeaderboardEntry[] {
    const col =
      by === "user"
        ? "user"
        : by === "machine"
          ? "machine"
          : "model_family";
    const rows = this.db
      .prepare(
        `SELECT
           ${col}                          AS key,
           COUNT(*)                        AS messages,
           SUM(cost_usd_micros)            AS cost_micros,
           SUM(weighted_input_eq)          AS weighted
         FROM messages
         GROUP BY ${col}
         ORDER BY cost_micros DESC
         LIMIT ?`
      )
      .all(limit) as Array<{
      key: string;
      messages: number;
      cost_micros: number;
      weighted: number;
    }>;
    return rows.map((r) => ({
      key: r.key,
      messages: r.messages,
      costUsd: (r.cost_micros ?? 0) / 1_000_000,
      weightedInputEq: r.weighted ?? 0,
    }));
  }

  userDetail(user: string): UserDetail {
    const totals = this.db
      .prepare(
        `SELECT
           COUNT(*) AS messages,
           SUM(cost_usd_micros) AS cost_micros,
           SUM(weighted_input_eq) AS weighted
         FROM messages WHERE user = ?`
      )
      .get(user) as {
      messages: number;
      cost_micros: number;
      weighted: number;
    };

    const perFamily = this.db
      .prepare(
        `SELECT
           model_family,
           COUNT(*) AS messages,
           SUM(cost_usd_micros) AS cost_micros,
           SUM(weighted_input_eq) AS weighted
         FROM messages WHERE user = ?
         GROUP BY model_family
         ORDER BY cost_micros DESC`
      )
      .all(user) as Array<{
      model_family: string;
      messages: number;
      cost_micros: number;
      weighted: number;
    }>;

    const perMachine = this.db
      .prepare(
        `SELECT
           machine,
           COUNT(*) AS messages,
           SUM(cost_usd_micros) AS cost_micros
         FROM messages WHERE user = ?
         GROUP BY machine
         ORDER BY cost_micros DESC`
      )
      .all(user) as Array<{
      machine: string;
      messages: number;
      cost_micros: number;
    }>;

    return {
      user,
      totals: {
        messages: totals?.messages ?? 0,
        costUsd: (totals?.cost_micros ?? 0) / 1_000_000,
        weightedInputEq: totals?.weighted ?? 0,
      },
      perFamily: perFamily.map((r) => ({
        modelFamily: r.model_family,
        messages: r.messages,
        costUsd: r.cost_micros / 1_000_000,
        weightedInputEq: r.weighted,
      })),
      perMachine: perMachine.map((r) => ({
        machine: r.machine,
        messages: r.messages,
        costUsd: r.cost_micros / 1_000_000,
      })),
    };
  }

  /**
   * Recent activity — last N rows from messages, newest first. Used by
   * Sessions / activity feed views.
   */
  recentMessages(limit = 50): Array<{
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
  }> {
    const rows = this.db
      .prepare(
        `SELECT
           user, machine, model, model_family,
           input_tokens, cache_creation, cache_read, output_tokens,
           cost_usd_micros, weighted_input_eq, ts
         FROM messages
         ORDER BY ts DESC
         LIMIT ?`
      )
      .all(limit) as Array<{
      user: string;
      machine: string;
      model: string;
      model_family: string;
      input_tokens: number;
      cache_creation: number;
      cache_read: number;
      output_tokens: number;
      cost_usd_micros: number;
      weighted_input_eq: number;
      ts: number;
    }>;
    return rows.map((r) => ({
      user: r.user,
      machine: r.machine,
      model: r.model,
      modelFamily: r.model_family,
      inputTokens: r.input_tokens,
      cacheCreation: r.cache_creation,
      cacheRead: r.cache_read,
      outputTokens: r.output_tokens,
      costUsd: r.cost_usd_micros / 1_000_000,
      weightedInputEq: r.weighted_input_eq,
      ts: r.ts,
    }));
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }
}
