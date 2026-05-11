import Counter, { type CounterBaseProps } from "./components/Counter";
import { useTotals } from "./ProviderConfig";
import { formatNumber } from "./format";
import type { FormatMode } from "./theme";

export interface MessageCounterProps extends Omit<CounterBaseProps, "value"> {
  formatMode?: FormatMode;
  locale?: string;
}

export function MessageCounter({
  formatMode,
  locale,
  formatter,
  label = "assistant messages",
  ...rest
}: MessageCounterProps) {
  const totals = useTotals();
  const fmt =
    formatter ?? ((v: number) => formatNumber(v, formatMode ?? "full", locale));
  return (
    <Counter value={totals.messages} formatter={fmt} label={label} {...rest} />
  );
}
