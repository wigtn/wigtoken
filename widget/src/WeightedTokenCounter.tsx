import { TokenCounter, type TokenCounterProps } from "./TokenCounter";

/** Convenience wrapper for the most common metric. */
export function WeightedTokenCounter(props: Omit<TokenCounterProps, "metric">) {
  return <TokenCounter {...props} metric="weighted" />;
}
