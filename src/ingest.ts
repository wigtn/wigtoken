import type { Labels, Store } from "./db.ts";
import type { ParsedUsage } from "./parser.ts";
import { costUsdFor } from "./pricing.ts";

interface RawIngestMessage {
  message_id?: unknown;
  model?: unknown;
  input_tokens?: unknown;
  cache_creation_input_tokens?: unknown;
  cache_read_input_tokens?: unknown;
  output_tokens?: unknown;
  ts?: unknown;
}

export interface IngestPayload {
  machine: string;
  messages: ParsedUsage[];
}

export type ValidationResult =
  | { ok: true; payload: IngestPayload }
  | { ok: false; status: number; reason: string };

const MAX_MESSAGES_PER_BATCH = 1000;

/**
 * Strict-but-forgiving validator: the agent could conceivably get
 * out of sync with new message shapes, so we reject the obviously
 * malformed batches and silently skip individual messages that
 * lack a message_id (they couldn't be deduped anyway).
 */
export function validateIngestPayload(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, status: 400, reason: "body must be an object" };
  }
  const b = body as { machine?: unknown; messages?: unknown };

  if (typeof b.machine !== "string" || !b.machine) {
    return { ok: false, status: 400, reason: "machine is required" };
  }
  if (b.machine.length > 100 || !/^[\w.\-]+$/.test(b.machine)) {
    return { ok: false, status: 400, reason: "machine label invalid" };
  }
  if (!Array.isArray(b.messages)) {
    return { ok: false, status: 400, reason: "messages must be an array" };
  }
  if (b.messages.length > MAX_MESSAGES_PER_BATCH) {
    return {
      ok: false,
      status: 413,
      reason: `too many messages (max ${MAX_MESSAGES_PER_BATCH})`,
    };
  }

  const parsed: ParsedUsage[] = [];
  for (const raw of b.messages as RawIngestMessage[]) {
    if (typeof raw !== "object" || raw === null) continue;
    if (typeof raw.message_id !== "string" || !raw.message_id) continue;
    const input = num(raw.input_tokens);
    const cacheCreation = num(raw.cache_creation_input_tokens);
    const cacheRead = num(raw.cache_read_input_tokens);
    const output = num(raw.output_tokens);
    const model = typeof raw.model === "string" ? raw.model : null;
    parsed.push({
      messageId: raw.message_id,
      model,
      input,
      cacheCreation,
      cacheRead,
      output,
      sum: input + cacheCreation + cacheRead + output,
      costUsd: costUsdFor(model, input, cacheCreation, cacheRead, output),
      timestamp:
        typeof raw.ts === "string"
          ? raw.ts
          : typeof raw.ts === "number"
            ? new Date(raw.ts).toISOString()
            : null,
    });
  }

  return { ok: true, payload: { machine: b.machine, messages: parsed } };
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export interface IngestResult {
  received: number;
  applied: number;
  duplicates: number;
}

/**
 * Apply a validated batch through the same path the file watcher uses.
 * The `user` label is taken from the bearer token, never from the
 * payload — that's what makes a leaked ingest token incapable of
 * forging data under someone else's user.
 */
export function applyIngestPayload(
  payload: IngestPayload,
  store: Store,
  user: string
): IngestResult {
  let applied = 0;
  let duplicates = 0;
  const labels: Labels = { user, machine: payload.machine };
  store.transaction(() => {
    for (const usage of payload.messages) {
      if (store.applyUsage(usage, labels)) {
        applied++;
      } else {
        duplicates++;
      }
    }
  });
  return { received: payload.messages.length, applied, duplicates };
}
