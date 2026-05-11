import Counter, { type CounterBaseProps } from "./components/Counter";
import { useTotals } from "./ProviderConfig";
import { formatNumber } from "./format";
import type { FormatMode } from "./theme";
import type { Totals } from "./types";

export interface TokenCounterProps extends Omit<CounterBaseProps, "value"> {
  /** Which totals field to count. */
  metric?: "weighted" | "raw" | "input" | "cacheCreation" | "cacheRead" | "output";
  formatMode?: FormatMode;
  locale?: string;
}

function pickValue(
  totals: Totals,
  metric: NonNullable<TokenCounterProps["metric"]>
): number {
  switch (metric) {
    case "raw":
      return totals.sum;
    case "input":
      return totals.input;
    case "cacheCreation":
      return totals.cacheCreation;
    case "cacheRead":
      return totals.cacheRead;
    case "output":
      return totals.output;
    case "weighted":
    default:
      return Math.round(
        totals.input + totals.cacheCreation * 1.25 + totals.cacheRead * 0.1 + totals.output * 5
      );
  }
}

export function TokenCounter({
  metric = "weighted",
  formatMode,
  locale,
  formatter,
  label = "tokens processed by the crew",
  ...rest
}: TokenCounterProps) {
  const totals = useTotals();
  const value = pickValue(totals, metric);
  const fmt =
    formatter ?? ((v: number) => formatNumber(v, formatMode ?? "full", locale));
  return <Counter value={value} formatter={fmt} label={label} {...rest} />;
}
