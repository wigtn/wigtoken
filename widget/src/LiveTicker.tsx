import { AnimatePresence, motion } from "framer-motion";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { useWigtnContext } from "./ProviderConfig";
import { formatCurrency } from "./format";
import {
  labelStyle,
  numberStyle,
  resolveTheme,
  sharedFontStyle,
  MOTION,
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
  ts: number;
}

/**
 * Tiny live ticker that prepends a row whenever totals change. Rows
 * slide in from above with a brief glow, then settle. Older rows fade
 * out as new ones bump them past `capacity`.
 */
export function LiveTicker({
  capacity = 6,
  size = "md",
  theme = "auto",
  title = "Live ticker",
  locale,
  containerStyle,
  className,
}: LiveTickerProps) {
  const { totals, lastUpdate } = useWigtnContext();
  const { colors } = resolveTheme({ size, theme });
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
      ts: lastUpdate ?? Date.now(),
    };
    setItems((prev) => [item, ...prev].slice(0, capacity));
  }, [totals, lastUpdate, capacity]);

  const wrapper: CSSProperties = {
    ...sharedFontStyle,
    display: "flex",
    flexDirection: "column",
    gap: 4,
    color: colors.fg,
    ...containerStyle,
  };

  return (
    <div style={wrapper} className={className}>
      {title && <div style={{ ...labelStyle, color: colors.muted }}>{title}</div>}
      {items.length === 0 ? (
        <div style={{ fontSize: "0.75rem", color: colors.muted, opacity: 0.5 }}>
          waiting for first update…
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {items.map((it, idx) => (
            <motion.div
              key={it.id}
              initial={{
                opacity: 0,
                y: -12,
                background: `linear-gradient(90deg, ${colors.glow} 0%, transparent 80%)`,
              }}
              animate={{
                opacity: idx === 0 ? 1 : Math.max(0.3, 1 - idx * 0.13),
                y: 0,
                background: "transparent",
              }}
              exit={{ opacity: 0, x: 20 }}
              transition={MOTION.spring}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.8125rem",
                padding: "4px 6px",
                borderRadius: 6,
                ...numberStyle,
              }}
            >
              <span style={{ color: colors.fg, fontWeight: 500 }}>{it.text}</span>
              <span style={{ color: colors.muted }}>
                {it.costUsd > 0
                  ? formatCurrency(it.costUsd, "USD", locale, 4)
                  : ""}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
