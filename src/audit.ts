import Database from "better-sqlite3";

export interface AuditEntry {
  ts: number;
  tokenId: number | null;
  action: string;
  user: string | null;
  ip: string | null;
  meta?: unknown;
}

export class AuditLog {
  private insertStmt: Database.Statement;
  private listStmt: Database.Statement;

  constructor(private db: Database.Database) {
    db.exec(`
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

    this.insertStmt = db.prepare(
      `INSERT INTO audit_log (ts, token_id, action, user, ip, meta_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    this.listStmt = db.prepare(
      `SELECT ts, token_id, action, user, ip, meta_json
       FROM audit_log
       WHERE ts >= ?
       ORDER BY ts DESC
       LIMIT ?`
    );
  }

  record(entry: AuditEntry): void {
    this.insertStmt.run(
      entry.ts,
      entry.tokenId,
      entry.action,
      entry.user,
      entry.ip,
      entry.meta === undefined ? null : JSON.stringify(entry.meta)
    );
  }

  list(opts: { sinceMs?: number; limit?: number } = {}): AuditEntry[] {
    const since = opts.sinceMs ?? Date.now() - 7 * 24 * 60 * 60 * 1000;
    const limit = opts.limit ?? 500;
    const rows = this.listStmt.all(since, limit) as Array<{
      ts: number;
      token_id: number | null;
      action: string;
      user: string | null;
      ip: string | null;
      meta_json: string | null;
    }>;
    return rows.map((r) => ({
      ts: r.ts,
      tokenId: r.token_id,
      action: r.action,
      user: r.user,
      ip: r.ip,
      meta: r.meta_json ? safeParse(r.meta_json) : undefined,
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
