/**
 * Send batches to the wigtoken server with bounded exponential
 * backoff and a file-backed offline queue. Order is preserved: a
 * batch is only "done" when the server has acknowledged it; while
 * the queue isn't empty the next live batch goes to the back of it.
 */

import type { BatchQueue } from "./queue.ts";
import type { IngestMessage } from "./parser.ts";

export interface UploaderOpts {
  serverUrl: string;
  token: string;
  machine: string;
  queue: BatchQueue;
  /** Initial backoff between retries; doubles up to maxBackoffMs. */
  baseBackoffMs?: number;
  maxBackoffMs?: number;
}

export class Uploader {
  private draining = false;

  constructor(private opts: UploaderOpts) {}

  /** Push one batch. Falls back to queue on failure; never throws. */
  async push(messages: IngestMessage[]): Promise<void> {
    if (messages.length === 0) return;
    const body = JSON.stringify({
      machine: this.opts.machine,
      messages,
    });

    // If a queue already exists, our batch belongs at the back.
    if (this.opts.queue.size() > 0) {
      this.opts.queue.enqueue(body);
      this.drain().catch(() => {});
      return;
    }

    const ok = await this.send(body);
    if (!ok) {
      this.opts.queue.enqueue(body);
      this.drain().catch(() => {});
    }
  }

  /** Drain pending batches until the queue is empty or the server stays down. */
  async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      let backoff = this.opts.baseBackoffMs ?? 1000;
      const maxBackoff = this.opts.maxBackoffMs ?? 60_000;

      while (true) {
        const batches = this.opts.queue.list();
        if (batches.length === 0) return;
        const next = batches[0]!;
        const ok = await this.send(next.body);
        if (ok) {
          this.opts.queue.drop(next.id);
          backoff = this.opts.baseBackoffMs ?? 1000;
          continue;
        }
        await sleep(backoff);
        backoff = Math.min(maxBackoff, backoff * 2);
      }
    } finally {
      this.draining = false;
    }
  }

  private async send(body: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.opts.serverUrl}/api/ingest/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.opts.token}`,
        },
        body,
      });
      if (res.ok) return true;
      // 4xx: payload is wrong shape. Drop it — retrying won't help.
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        const text = await res.text().catch(() => "");
        console.error(
          `[uploader] server rejected batch: ${res.status} ${text}`
        );
        return true;
      }
      const text = await res.text().catch(() => "");
      console.error(`[uploader] retryable error ${res.status} ${text}`);
      return false;
    } catch (err) {
      console.error(`[uploader] network error: ${(err as Error).message}`);
      return false;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
