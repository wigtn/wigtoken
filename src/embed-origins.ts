import type Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { desc, eq } from "drizzle-orm";
import { embedOrigins } from "./schema/sqlite.ts";

export interface EmbedOriginRow {
  id: number;
  origin: string;
  label: string | null;
  createdAt: number;
  createdBy: number | null;
}

export class EmbedOriginStore {
  private db: ReturnType<typeof drizzle>;

  constructor(raw: Database.Database) {
    raw.exec(`
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
    this.db = drizzle(raw);
  }

  add(origin: string, label: string | null, createdBy: number | null): EmbedOriginRow {
    const createdAt = Date.now();
    const inserted = this.db
      .insert(embedOrigins)
      .values({ origin, label, createdAt, createdBy })
      .returning()
      .get();
    return {
      id: inserted.id,
      origin: inserted.origin,
      label: inserted.label,
      createdAt: inserted.createdAt,
      createdBy: inserted.createdBy,
    };
  }

  list(): EmbedOriginRow[] {
    const rows = this.db
      .select()
      .from(embedOrigins)
      .orderBy(desc(embedOrigins.createdAt))
      .all();
    return rows.map((r) => ({
      id: r.id,
      origin: r.origin,
      label: r.label,
      createdAt: r.createdAt,
      createdBy: r.createdBy,
    }));
  }

  remove(id: number): boolean {
    const result = this.db.delete(embedOrigins).where(eq(embedOrigins.id, id)).run();
    return result.changes > 0;
  }

  isAllowed(origin: string): boolean {
    const row = this.db
      .select({ id: embedOrigins.id })
      .from(embedOrigins)
      .where(eq(embedOrigins.origin, origin))
      .get();
    return row !== undefined;
  }
}
