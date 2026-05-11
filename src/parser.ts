import { costUsdFor } from "./pricing.ts";

export interface ParsedUsage {
  messageId: string;
  model: string | null;
  input: number;
  cacheCreation: number;
  cacheRead: number;
  output: number;
  sum: number;
  costUsd: number;
  timestamp: string | null;
}

export function parseLine(line: string): ParsedUsage | null {
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
  const input = Number(u.input_tokens ?? 0);
  const cacheCreation = Number(u.cache_creation_input_tokens ?? 0);
  const cacheRead = Number(u.cache_read_input_tokens ?? 0);
  const output = Number(u.output_tokens ?? 0);
  const model = typeof msg.model === "string" ? msg.model : null;
  return {
    messageId: msg.id,
    model,
    input,
    cacheCreation,
    cacheRead,
    output,
    sum: input + cacheCreation + cacheRead + output,
    costUsd: costUsdFor(model, input, cacheCreation, cacheRead, output),
    timestamp: typeof obj.timestamp === "string" ? obj.timestamp : null,
  };
}
