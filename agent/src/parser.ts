/**
 * Lift the bits of a Claude Code JSONL line that the server's ingest
 * endpoint expects. We deliberately keep this thin — the server still
 * does the dedupe by message id, the cost calculation, and any cross-
 * model normalisation. The agent just shovels the raw counts.
 */

export interface IngestMessage {
  message_id: string;
  model: string | null;
  input_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  output_tokens: number;
  ts: string | null;
}

export function parseLine(line: string): IngestMessage | null {
  if (!line || !line.trim()) return null;
  let obj: any;
  try {
    obj = JSON.parse(line);
  } catch {
    return null;
  }
  if (obj?.type !== "assistant") return null;
  const msg = obj.message;
  if (!msg || typeof msg.id !== "string" || !msg.usage) return null;
  const u = msg.usage;
  return {
    message_id: msg.id,
    model: typeof msg.model === "string" ? msg.model : null,
    input_tokens: Number(u.input_tokens ?? 0),
    cache_creation_input_tokens: Number(u.cache_creation_input_tokens ?? 0),
    cache_read_input_tokens: Number(u.cache_read_input_tokens ?? 0),
    output_tokens: Number(u.output_tokens ?? 0),
    ts: typeof obj.timestamp === "string" ? obj.timestamp : null,
  };
}
