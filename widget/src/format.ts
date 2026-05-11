import type { FormatMode } from "./theme";

export function formatNumber(
  n: number,
  mode: FormatMode = "full",
  locale?: string
): string {
  switch (mode) {
    case "compact":
      return new Intl.NumberFormat(locale, {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(n);
    case "scientific":
      return n.toExponential(2);
    case "short":
      if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
      if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
      if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
      return String(n);
    case "full":
    default:
      return n.toLocaleString(locale);
  }
}

export function formatCurrency(
  n: number,
  currency = "USD",
  locale?: string,
  precision = 2
): string {
  // Try Intl currency formatter; fall back to a custom symbol for the
  // unusual case where it doesn't recognise the code.
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(precision)}`;
  }
}

export function formatRelativeTime(ts: number, locale?: string): string {
  const diff = ts - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (abs < 60_000) return rtf.format(Math.round(diff / 1000), "second");
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), "hour");
  return rtf.format(Math.round(diff / 86_400_000), "day");
}
