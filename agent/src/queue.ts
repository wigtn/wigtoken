/**
 * File-backed pending-batch queue. When the server is unreachable or
 * 5xx-ing, batches land here; the uploader drains them in order on
 * the next successful send. Each batch is a single JSON file named
 * by ms-timestamp, so sorting by name == FIFO.
 */

import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface QueuedBatch {
  id: string;
  body: string; // already-stringified payload, ready to POST
}

export class BatchQueue {
  constructor(private dir: string) {
    mkdirSync(dir, { recursive: true });
  }

  enqueue(body: string): QueuedBatch {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
    const path = join(this.dir, id);
    writeFileSync(path, body, "utf8");
    return { id, body };
  }

  list(): QueuedBatch[] {
    let files: string[];
    try {
      files = readdirSync(this.dir).filter((f) => f.endsWith(".json"));
    } catch {
      return [];
    }
    files.sort();
    return files.map((id) => ({
      id,
      body: readFileSync(join(this.dir, id), "utf8"),
    }));
  }

  drop(id: string): void {
    try {
      unlinkSync(join(this.dir, id));
    } catch {
      /* already gone */
    }
  }

  size(): number {
    try {
      return readdirSync(this.dir).filter((f) => f.endsWith(".json")).length;
    } catch {
      return 0;
    }
  }
}
