import type Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { and, desc, gte } from "drizzle-orm";
import { auditLog } from "./schema/sqlite.ts";

export interface AuditEntry {
  ts: number;
  tokenId: number | null;
  action: string;
  user: string | null;
  ip: string | null;
  meta?: unknown;
}

export class AuditLog {
  private db: ReturnType<typeof drizzle>;

  constructor(raw: Database.Database) {
    raw.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        ts        INTEGER NOT NULL,
        token_id  INTEGER,
        action    TEXT NOT NULL,
        user      TEXT,
        ip        TEXT,
        meta_json TEXT
      );
      CREATE INDEX IF NOT EXISTS ix_audit_ts ON audit_log(ts);
      CREATE INDEX IF NOT EXISTS ix_audit_user ON audit_log(user);
    `);
    this.db = drizzle(raw);
  }

  record(entry: AuditEntry): void {
    this.db
      .insert(auditLog)
      .values({
        ts: entry.ts,
        tokenId: entry.tokenId,
        action: entry.action,
        user: entry.user,
        ip: entry.ip,
        metaJson: entry.meta === undefined ? null : JSON.stringify(entry.meta),
      })
      .run();
  }

  list(opts: { sinceMs?: number; limit?: number } = {}): AuditEntry[] {
    const since = opts.sinceMs ?? Date.now() - 7 * 24 * 60 * 60 * 1000;
    const limit = opts.limit ?? 500;
    const rows = this.db
      .select()
      .from(auditLog)
      .where(and(gte(auditLog.ts, since)))
      .orderBy(desc(auditLog.ts))
      .limit(limit)
      .all();
    return rows.map((r) => ({
      ts: r.ts,
      tokenId: r.tokenId,
      action: r.action,
      user: r.user,
      ip: r.ip,
      meta: r.metaJson ? safeParse(r.metaJson) : undefined,
    }));
  }
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
