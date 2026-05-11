import Counter, { type CounterBaseProps } from "./components/Counter";
import { useTotals } from "./ProviderConfig";
import { formatCurrency } from "./format";

export interface CostCounterProps extends Omit<CounterBaseProps, "value" | "formatter"> {
  currency?: string;
  precision?: number;
  locale?: string;
}

export function CostCounter({
  currency = "USD",
  precision = 2,
  locale,
  label = "estimated cost",
  ...rest
}: CostCounterProps) {
  const totals = useTotals();
  // Animate in integer cents so the count-up doesn't blink between
  // floating-point values; divide back in the formatter.
  const scaled = Math.round(totals.costUsd * 100);
  return (
    <Counter
      value={scaled}
      formatter={(v) => formatCurrency(v / 100, currency, locale, precision)}
      label={label}
      {...rest}
    />
  );
}
