import type Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, sql } from "drizzle-orm";
import { settings } from "./schema/sqlite.ts";

/**
 * Key-value settings table for cross-cutting state that doesn't fit
 * the per-message / per-token / per-audit shape. Used so far for the
 * setup-wizard completion flag, but intended to absorb future global
 * toggles too (default time range, marketing label override, etc).
 *
 * Backed by Drizzle on top of better-sqlite3. The drizzle-sqlite path
 * is synchronous, so the public API stays sync (matches v0.1.x).
 * Postgres / MySQL backends will get their own async implementation
 * in Phase 2c — `openStorage` dispatches based on cfg.db.kind.
 */
export class SettingsStore {
  private db: ReturnType<typeof drizzle>;

  constructor(raw: Database.Database) {
    raw.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    this.db = drizzle(raw);
  }

  get(key: string): string | null {
    const row = this.db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, key))
      .get();
    return row?.value ?? null;
  }

  set(key: string, value: string): void {
    this.db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value: sql`excluded.value` } })
      .run();
  }

  getBool(key: string): boolean {
    return this.get(key) === "true";
  }

  setBool(key: string, value: boolean): void {
    this.set(key, value ? "true" : "false");
  }

  getJson<T>(key: string): T | null {
    const raw = this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  setJson(key: string, value: unknown): void {
    this.set(key, JSON.stringify(value));
  }
}

export const KEYS = {
  setupComplete: "setup.complete",
  setupScenario: "setup.scenario",
  setupInfra: "setup.infra",
  setupCompletedAt: "setup.completedAt",
} as const;
