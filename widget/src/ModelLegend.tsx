import type { CSSProperties } from "react";
import { useLeaderboard } from "./hooks";
import { formatCurrency } from "./format";
import { labelStyle, numberStyle, sharedFontStyle, type Size, type Theme } from "./theme";

export interface ModelLegendProps {
  size?: Size;
  theme?: Theme;
  title?: string;
  locale?: string;
  containerStyle?: CSSProperties;
  className?: string;
}

const FAMILY_COLOR: Record<string, string> = {
  opus: "#8b5cf6",
  sonnet: "#14b8a6",
  haiku: "#f59e0b",
  unknown: "#737373",
};

/** Inline legend that shows each model family with its share of cost. */
export function ModelLegend({
  size: _size = "md",
  theme: _theme = "auto",
  title = "Models",
  locale,
  containerStyle,
  className,
}: ModelLegendProps) {
  const { data } = useLeaderboard({ by: "model_family", limit: 10 });
  const entries = data?.entries ?? [];
  const total = entries.reduce((s, e) => s + e.costUsd, 0) || 1;

  return (
    <div
      style={{
        ...sharedFontStyle,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        ...containerStyle,
      }}
      className={className}
    >
      {title && <div style={labelStyle}>{title}</div>}
      {entries.map((e) => {
        const pct = ((e.costUsd / total) * 100).toFixed(1);
        return (
          <div
            key={e.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "0.8125rem",
              ...numberStyle,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: FAMILY_COLOR[e.key] ?? "#737373",
                flexShrink: 0,
              }}
            />
            <span style={{ flex: 1, fontWeight: 500 }}>{e.key}</span>
            <span style={{ opacity: 0.7, width: 64, textAlign: "right" }}>
              {formatCurrency(e.costUsd, "USD", locale)}
            </span>
            <span style={{ opacity: 0.4, width: 44, textAlign: "right" }}>
              {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
