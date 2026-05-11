import type Database from "better-sqlite3";

/**
 * Key-value settings table for cross-cutting state that doesn't fit
 * the per-message / per-token / per-audit shape. Used so far for the
 * setup-wizard completion flag, but intended to absorb future global
 * toggles too (default time range, marketing label override, etc).
 */
export class SettingsStore {
  private getStmt: Database.Statement;
  private setStmt: Database.Statement;

  constructor(db: Database.Database) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    this.getStmt = db.prepare("SELECT value FROM settings WHERE key = ?");
    this.setStmt = db.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) " +
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    );
  }

  get(key: string): string | null {
    const row = this.getStmt.get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  set(key: string, value: string): void {
    this.setStmt.run(key, value);
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
