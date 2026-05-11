// Per-token USD pricing (Anthropic public rates, May 2026).
// Numbers are in USD per single token, derived from per-million figures.

interface ModelRates {
  input: number;
  cacheCreation: number;
  cacheRead: number;
  output: number;
}

const M = 1_000_000;

const OPUS: ModelRates = {
  input: 15 / M,
  cacheCreation: 18.75 / M,
  cacheRead: 1.5 / M,
  output: 75 / M,
};

const SONNET: ModelRates = {
  input: 3 / M,
  cacheCreation: 3.75 / M,
  cacheRead: 0.3 / M,
  output: 15 / M,
};

const HAIKU: ModelRates = {
  input: 0.8 / M,
  cacheCreation: 1.0 / M,
  cacheRead: 0.08 / M,
  output: 4 / M,
};

// Family-level fallback used when a model id doesn't match an explicit
// entry. Sonnet is the safest default for "unknown new model" because
// it sits in the middle of the pricing range.
const FALLBACK = SONNET;

const EXPLICIT: Record<string, ModelRates> = {
  // Opus
  "claude-opus-4": OPUS,
  "claude-opus-4-5": OPUS,
  "claude-opus-4-6": OPUS,
  "claude-opus-4-7": OPUS,
  // Sonnet
  "claude-sonnet-4": SONNET,
  "claude-sonnet-4-5": SONNET,
  "claude-sonnet-4-6": SONNET,
  // Haiku
  "claude-haiku-4-5": HAIKU,
};

export function ratesFor(model: string | null): ModelRates {
  if (!model) return FALLBACK;
  // Exact match first
  const exact = EXPLICIT[model];
  if (exact) return exact;
  // Prefix match (e.g. "claude-haiku-4-5-20251001" → "claude-haiku-4-5")
  for (const [key, rates] of Object.entries(EXPLICIT)) {
    if (model.startsWith(key)) return rates;
  }
  // Family fallback by substring
  if (model.includes("opus")) return OPUS;
  if (model.includes("haiku")) return HAIKU;
  if (model.includes("sonnet")) return SONNET;
  return FALLBACK;
}

export function costUsdFor(
  model: string | null,
  input: number,
  cacheCreation: number,
  cacheRead: number,
  output: number
): number {
  const r = ratesFor(model);
  return (
    input * r.input +
    cacheCreation * r.cacheCreation +
    cacheRead * r.cacheRead +
    output * r.output
  );
}

export type ModelFamily = "opus" | "sonnet" | "haiku" | "unknown";

export function modelFamily(model: string | null): ModelFamily {
  if (!model) return "unknown";
  if (model.includes("opus")) return "opus";
  if (model.includes("haiku")) return "haiku";
  if (model.includes("sonnet")) return "sonnet";
  return "unknown";
}

/**
 * Weight of one token kind expressed in input-token equivalents. Comes
 * straight from the input-relative ratios baked into the rate tables
 * (input=1, cache_creation=1.25, cache_read=0.1, output=5) — they're
 * the same across families.
 */
export function weightedInputEquivalent(
  input: number,
  cacheCreation: number,
  cacheRead: number,
  output: number
): number {
  return Math.round(
    input + cacheCreation * 1.25 + cacheRead * 0.1 + output * 5
  );
}
