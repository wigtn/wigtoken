/**
 * Wire format the server returns from /embed/totals and /embed/stream.
 * Kept narrow to what the widget actually reads.
 */
export interface Totals {
  input: number;
  cacheCreation: number;
  cacheRead: number;
  output: number;
  sum: number;
  messages: number;
  costUsd: number;
}

export interface TotalsEnvelope {
  totals: Totals;
  timestamp: number;
}

export type CounterStyle = "hero" | "minimal" | "full";
