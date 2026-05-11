import type { CSSProperties } from "react";
import { useLeaderboard } from "./hooks";
import { formatCurrency, formatNumber } from "./format";
import { labelStyle, numberStyle, resolveTheme, sharedFontStyle, type Density, type Size, type Theme } from "./theme";

export interface TopUsersProps {
  limit?: number;
  metric?: "costUsd" | "weightedInputEq" | "messages";
  size?: Size;
  theme?: Theme;
  density?: Density;
  title?: string;
  locale?: string;
  containerStyle?: CSSProperties;
  className?: string;
}

const METRIC_LABEL: Record<NonNullable<TopUsersProps["metric"]>, string> = {
  costUsd: "cost",
  weightedInputEq: "weighted tokens",
  messages: "messages",
};

/**
 * Horizontal bar list of top users by the picked metric. Pulled from
 * /api/usage/leaderboard?by=user via useLeaderboard().
 */
export function TopUsers({
  limit = 5,
  metric = "costUsd",
  size = "md",
  theme = "auto",
  density = "normal",
  title = "Top users",
  locale,
  containerStyle,
  className,
}: TopUsersProps) {
  const { data } = useLeaderboard({ by: "user", limit });
  const { colors, densityGap } = resolveTheme({ size, theme, density });
  const entries = data?.entries ?? [];
  const max = Math.max(1, ...entries.map((e) => (e as any)[metric] as number));

  const wrapperStyle: CSSProperties = {
    ...sharedFontStyle,
    display: "flex",
    flexDirection: "column",
    gap: densityGap + 4,
    ...containerStyle,
  };

  return (
    <div style={wrapperStyle} className={className}>
      {title && <div style={labelStyle}>{title}</div>}
      {entries.length === 0 ? (
        <div style={{ fontSize: "0.75rem", opacity: 0.4 }}>no data</div>
      ) : (
        entries.map((e) => {
          const v = (e as any)[metric] as number;
          const pct = (v / max) * 100;
          return (
            <div key={e.key} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.8125rem",
                  ...numberStyle,
                }}
              >
                <span style={{ fontWeight: 500 }}>{e.key}</span>
                <span style={{ opacity: 0.7 }}>
                  {metric === "costUsd"
                    ? formatCurrency(v, "USD", locale)
                    : formatNumber(v, "full", locale)}
                </span>
              </div>
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: "color-mix(in srgb, currentColor 10%, transparent)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: colors.accent,
                    borderRadius: 2,
                    transition: "width 240ms ease-out",
                  }}
                  aria-label={`${e.key}: ${METRIC_LABEL[metric]} ${v}`}
                />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
