import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { useWigtnContext } from "./ProviderConfig";
import { formatCurrency } from "./format";
import {
  labelStyle,
  numberStyle,
  sharedFontStyle,
  type Size,
  type Theme,
} from "./theme";

export interface LiveTickerProps {
  /** Maximum rows kept on screen. */
  capacity?: number;
  size?: Size;
  theme?: Theme;
  title?: string;
  locale?: string;
  containerStyle?: CSSProperties;
  className?: string;
}

interface Item {
  id: string;
  text: string;
  costUsd: number;
  family: string;
  ts: number;
}

/**
 * Tiny live ticker that prepends a row whenever totals change. The row
 * shows an inferred delta — `costUsd` change since last update — and a
 * short "[user @ machine]" placeholder. For a richer feed use
 * <RecentActivity />.
 */
export function LiveTicker({
  capacity = 6,
  size = "md",
  theme: _theme = "auto",
  title = "Live ticker",
  locale,
  containerStyle,
  className,
}: LiveTickerProps) {
  const { totals, lastUpdate } = useWigtnContext();
  const [items, setItems] = useState<Item[]>([]);
  const prevCost = useRef<number | null>(null);
  const prevMessages = useRef<number | null>(null);

  useEffect(() => {
    if (!totals) return;
    const lastCost = prevCost.current;
    const lastMsg = prevMessages.current;
    prevCost.current = totals.costUsd;
    prevMessages.current = totals.messages;
    if (lastCost === null || lastMsg === null) return;
    const dMsg = totals.messages - lastMsg;
    const dCost = totals.costUsd - lastCost;
    if (dMsg <= 0) return;
    const item: Item = {
      id: `${lastUpdate ?? Date.now()}-${totals.messages}`,
      text: `+${dMsg} message${dMsg > 1 ? "s" : ""}`,
      costUsd: dCost,
      family: "unknown",
      ts: lastUpdate ?? Date.now(),
    };
    setItems((prev) => [item, ...prev].slice(0, capacity));
  }, [totals, lastUpdate, capacity]);

  void size;
  const wrapper: CSSProperties = {
    ...sharedFontStyle,
    display: "flex",
    flexDirection: "column",
    gap: 4,
    ...containerStyle,
  };

  return (
    <div style={wrapper} className={className}>
      {title && <div style={labelStyle}>{title}</div>}
      {items.length === 0 ? (
        <div style={{ fontSize: "0.75rem", opacity: 0.4 }}>
          waiting for first update…
        </div>
      ) : (
        items.map((it) => (
          <div
            key={it.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.8125rem",
              ...numberStyle,
              opacity: 1,
              transition: "opacity 240ms ease-out",
            }}
          >
            <span>{it.text}</span>
            <span style={{ opacity: 0.7 }}>
              {formatCurrency(it.costUsd, "USD", locale, 4)}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
