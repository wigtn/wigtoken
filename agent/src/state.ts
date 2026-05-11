/**
 * Per-file byte offsets on disk so the agent picks up exactly where
 * it left off after a restart, without re-uploading anything the
 * server has already seen. Server-side dedupe by message_id is the
 * authoritative defence; this just keeps things efficient.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

interface State {
  offsets: Record<string, number>;
}

export class OffsetStore {
  private state: State;

  constructor(private file: string) {
    this.state = load(file);
  }

  get(path: string): number {
    return this.state.offsets[path] ?? 0;
  }

  set(path: string, offset: number): void {
    this.state.offsets[path] = offset;
    this.persist();
  }

  /** Bulk update wrapped in a single fsync. */
  batch(entries: Array<[string, number]>): void {
    for (const [path, offset] of entries) {
      this.state.offsets[path] = offset;
    }
    this.persist();
  }

  private persist(): void {
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(this.state, null, 2), "utf8");
  }
}

function load(file: string): State {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as State;
  } catch {
    return { offsets: {} };
  }
}
