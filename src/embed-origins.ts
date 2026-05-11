import type Database from "better-sqlite3";

export interface EmbedOriginRow {
  id: number;
  origin: string;
  label: string | null;
  createdAt: number;
  createdBy: number | null;
}

export class EmbedOriginStore {
  private insertStmt: Database.Statement;
  private listStmt: Database.Statement;
  private deleteStmt: Database.Statement;
  private findStmt: Database.Statement;

  constructor(private db: Database.Database) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS embed_origins (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        origin     TEXT UNIQUE NOT NULL,
        label      TEXT,
        created_at INTEGER NOT NULL,
        created_by INTEGER
      );
      CREATE INDEX IF NOT EXISTS ix_embed_origins_origin
        ON embed_origins(origin);
    `);

    this.insertStmt = db.prepare(
      `INSERT INTO embed_origins (origin, label, created_at, created_by)
       VALUES (?, ?, ?, ?)`
    );
    this.listStmt = db.prepare(
      `SELECT id, origin, label, created_at, created_by
       FROM embed_origins
       ORDER BY created_at DESC`
    );
    this.deleteStmt = db.prepare(`DELETE FROM embed_origins WHERE id = ?`);
    this.findStmt = db.prepare(
      `SELECT id FROM embed_origins WHERE origin = ?`
    );
  }

  add(origin: string, label: string | null, createdBy: number | null): EmbedOriginRow {
    const createdAt = Date.now();
    const res = this.insertStmt.run(origin, label, createdAt, createdBy);
    return {
      id: Number(res.lastInsertRowid),
      origin,
      label,
      createdAt,
      createdBy,
    };
  }

  list(): EmbedOriginRow[] {
    const rows = this.listStmt.all() as Array<{
      id: number;
      origin: string;
      label: string | null;
      created_at: number;
      created_by: number | null;
    }>;
    return rows.map((r) => ({
      id: r.id,
      origin: r.origin,
      label: r.label,
      createdAt: r.created_at,
      createdBy: r.created_by,
    }));
  }

  remove(id: number): boolean {
    return this.deleteStmt.run(id).changes > 0;
  }

  isAllowed(origin: string): boolean {
    return this.findStmt.get(origin) !== undefined;
  }
}
