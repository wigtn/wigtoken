import Database from "better-sqlite3";
import { createHash, randomBytes } from "node:crypto";

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
  private insertStmt: Database.Statement;
  private findByHashStmt: Database.Statement;
  private listStmt: Database.Statement;
  private revokeStmt: Database.Statement;
  private touchStmt: Database.Statement;
  private bootstrapStmt: Database.Statement;

  constructor(private db: Database.Database) {
    db.exec(`
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

    this.insertStmt = db.prepare(
      `INSERT INTO tokens (token_hash, user, scope, label, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    this.findByHashStmt = db.prepare(
      `SELECT id, user, scope, label, created_at, expires_at, revoked_at, last_used_at
       FROM tokens WHERE token_hash = ?`
    );
    this.listStmt = db.prepare(
      `SELECT id, user, scope, label, created_at, expires_at, revoked_at, last_used_at
       FROM tokens
       ORDER BY created_at DESC`
    );
    this.revokeStmt = db.prepare(
      `UPDATE tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL`
    );
    this.touchStmt = db.prepare(
      `UPDATE tokens SET last_used_at = ? WHERE id = ?`
    );
    this.bootstrapStmt = db.prepare(
      `SELECT COUNT(*) AS n FROM tokens WHERE scope = 'admin' AND revoked_at IS NULL`
    );
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
    const result = this.insertStmt.run(
      hash,
      args.user,
      args.scope,
      args.label ?? null,
      createdAt,
      args.expiresAt ?? null
    );
    return {
      id: Number(result.lastInsertRowid),
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
    const row = this.findByHashStmt.get(hashToken(plainToken)) as
      | {
          id: number;
          user: string;
          scope: Scope;
          label: string | null;
          created_at: number;
          expires_at: number | null;
          revoked_at: number | null;
          last_used_at: number | null;
        }
      | undefined;
    if (!row) return null;
    if (row.revoked_at !== null) return null;
    if (row.expires_at !== null && row.expires_at < Date.now()) return null;

    this.touchStmt.run(Date.now(), row.id);

    return {
      id: row.id,
      user: row.user,
      scope: row.scope,
      label: row.label,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      lastUsedAt: row.last_used_at,
    };
  }

  list(): TokenRow[] {
    const rows = this.listStmt.all() as Array<{
      id: number;
      user: string;
      scope: Scope;
      label: string | null;
      created_at: number;
      expires_at: number | null;
      revoked_at: number | null;
      last_used_at: number | null;
    }>;
    return rows.map((r) => ({
      id: r.id,
      user: r.user,
      scope: r.scope,
      label: r.label,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      revokedAt: r.revoked_at,
      lastUsedAt: r.last_used_at,
    }));
  }

  revoke(id: number): boolean {
    const result = this.revokeStmt.run(Date.now(), id);
    return result.changes > 0;
  }

  /** True when no live admin token exists — caller should bootstrap one. */
  needsBootstrapAdmin(): boolean {
    const row = this.bootstrapStmt.get() as { n: number };
    return row.n === 0;
  }
}
