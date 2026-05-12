import { motion } from "framer-motion";
import type { CSSProperties } from "react";
import { useLeaderboard } from "./hooks";
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

export interface ModelLegendProps {
  size?: Size;
  theme?: Theme;
  title?: string;
  locale?: string;
  containerStyle?: CSSProperties;
  className?: string;
}

const FAMILY_COLOR: Record<string, string> = {
  opus: "#a78bfa",
  sonnet: "#5eead4",
  haiku: "#fbbf24",
  unknown: "#737373",
};

/** Inline legend that shows each model family with its share of cost. */
export function ModelLegend({
  size = "md",
  theme = "auto",
  title = "Models",
  locale,
  containerStyle,
  className,
}: ModelLegendProps) {
  const { data } = useLeaderboard({ by: "model_family", limit: 10 });
  const { colors } = resolveTheme({ size, theme });
  const entries = data?.entries ?? [];
  const total = entries.reduce((s, e) => s + e.costUsd, 0) || 1;

  return (
    <div
      style={{
        ...sharedFontStyle,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        color: colors.fg,
        ...containerStyle,
      }}
      className={className}
    >
      {title && (
        <div style={{ ...labelStyle, color: colors.muted, marginBottom: 4 }}>
          {title}
        </div>
      )}
      {entries.map((e, idx) => {
        const pct = ((e.costUsd / total) * 100).toFixed(1);
        const color = FAMILY_COLOR[e.key] ?? "#737373";
        return (
          <motion.div
            key={e.key}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...MOTION.spring, delay: idx * 0.05 }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: "0.8125rem",
              ...numberStyle,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: color,
                boxShadow: `0 0 8px ${color}55`,
                flexShrink: 0,
              }}
            />
            <span style={{ flex: 1, fontWeight: 600, color: colors.fg }}>
              {e.key}
            </span>
            <span style={{ color: colors.muted, width: 70, textAlign: "right" }}>
              {formatCurrency(e.costUsd, "USD", locale)}
            </span>
            <span
              style={{
                color: colors.muted,
                opacity: 0.7,
                width: 48,
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {pct}%
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
