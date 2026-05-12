import type Database from "better-sqlite3";
import { createHash, randomBytes } from "node:crypto";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { tokens as tokensTable } from "./schema/sqlite.ts";

export type Scope = "ingest" | "read" | "admin" | "embed";
export const SCOPES: Scope[] = ["ingest", "read", "admin", "embed"];

/**
 * Returned only at creation time — the hash is what we keep on disk.
 */
export interface IssuedToken {
  id: number;
  user: string;
  scope: Scope;
  label: string | null;
  /** Plain-text bearer value, shown to the operator ONCE. */
  token: string;
  createdAt: number;
  expiresAt: number | null;
}

export interface TokenRow {
  id: number;
  user: string;
  scope: Scope;
  label: string | null;
  createdAt: number;
  expiresAt: number | null;
  revokedAt: number | null;
  lastUsedAt: number | null;
}

const PREFIX = "wts_";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateToken(): string {
  return PREFIX + randomBytes(32).toString("hex");
}

export class TokenStore {
  private db: ReturnType<typeof drizzle>;

  constructor(raw: Database.Database) {
    raw.exec(`
      CREATE TABLE IF NOT EXISTS tokens (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        token_hash   TEXT UNIQUE NOT NULL,
        user         TEXT NOT NULL,
        scope        TEXT NOT NULL,
        label        TEXT,
        created_at   INTEGER NOT NULL,
        expires_at   INTEGER,
        revoked_at   INTEGER,
        last_used_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS ix_tokens_user ON tokens(user);
    `);
    this.db = drizzle(raw);
  }

  issue(args: {
    user: string;
    scope: Scope;
    label?: string;
    expiresAt?: number;
  }): IssuedToken {
    if (!SCOPES.includes(args.scope)) {
      throw new Error(`unknown scope: ${args.scope}`);
    }
    const token = generateToken();
    const hash = hashToken(token);
    const createdAt = Date.now();
    const inserted = this.db
      .insert(tokensTable)
      .values({
        tokenHash: hash,
        user: args.user,
        scope: args.scope,
        label: args.label ?? null,
        createdAt,
        expiresAt: args.expiresAt ?? null,
      })
      .returning({ id: tokensTable.id })
      .get();
    return {
      id: inserted.id,
      user: args.user,
      scope: args.scope,
      label: args.label ?? null,
      token,
      createdAt,
      expiresAt: args.expiresAt ?? null,
    };
  }

  /**
   * Resolve a bearer token to its DB row. Returns null when the token
   * is unknown, revoked, or expired. Updates last_used_at on success.
   */
  resolve(plainToken: string): TokenRow | null {
    if (!plainToken.startsWith(PREFIX)) return null;
    const row = this.db
      .select()
      .from(tokensTable)
      .where(eq(tokensTable.tokenHash, hashToken(plainToken)))
      .get();
    if (!row) return null;
    if (row.revokedAt !== null) return null;
    if (row.expiresAt !== null && row.expiresAt < Date.now()) return null;

    this.db
      .update(tokensTable)
      .set({ lastUsedAt: Date.now() })
      .where(eq(tokensTable.id, row.id))
      .run();

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
  }

  list(): TokenRow[] {
    const rows = this.db
      .select()
      .from(tokensTable)
      .orderBy(desc(tokensTable.createdAt))
      .all();
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
  }

  revoke(id: number): boolean {
    const result = this.db
      .update(tokensTable)
      .set({ revokedAt: Date.now() })
      .where(and(eq(tokensTable.id, id), isNull(tokensTable.revokedAt)))
      .run();
    return result.changes > 0;
  }

  /** True when no live admin token exists — caller should bootstrap one. */
  needsBootstrapAdmin(): boolean {
    const row = this.db
      .select({ n: count() })
      .from(tokensTable)
      .where(and(eq(tokensTable.scope, "admin"), isNull(tokensTable.revokedAt)))
      .get();
    return (row?.n ?? 0) === 0;
  }
}

