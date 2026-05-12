import { motion } from "framer-motion";
import type { CSSProperties } from "react";
import { useLeaderboard } from "./hooks";
import { formatCurrency, formatNumber } from "./format";
import {
  labelStyle,
  numberStyle,
  resolveTheme,
  sharedFontStyle,
  MOTION,
  type Density,
  type Size,
  type Theme,
} from "./theme";

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

/**
 * Horizontal bar list of top users by the picked metric. Pulled from
 * /api/usage/leaderboard?by=user via useLeaderboard(). Bars grow in
 * with a staggered animation; values use tabular figures so the right
 * edge stays aligned.
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
  return (
    <Leaderboard
      entries={data?.entries ?? []}
      metric={metric}
      size={size}
      theme={theme}
      density={density}
      title={title}
      locale={locale}
      containerStyle={containerStyle}
      className={className}
    />
  );
}

interface LeaderboardProps extends TopUsersProps {
  entries: { key: string; messages: number; costUsd: number; weightedInputEq: number }[];
}

export function Leaderboard({
  entries,
  metric = "costUsd",
  size = "md",
  theme = "auto",
  density = "normal",
  title,
  locale,
  containerStyle,
  className,
}: LeaderboardProps) {
  const { colors, densityGap } = resolveTheme({ size, theme, density });
  void size;
  const max = Math.max(1, ...entries.map((e) => (e as any)[metric] as number));

  const wrapperStyle: CSSProperties = {
    ...sharedFontStyle,
    display: "flex",
    flexDirection: "column",
    gap: densityGap + 6,
    color: colors.fg,
    ...containerStyle,
  };

  return (
    <div style={wrapperStyle} className={className}>
      {title && (
        <div style={{ ...labelStyle, color: colors.muted }}>{title}</div>
      )}
      {entries.length === 0 ? (
        <div style={{ fontSize: "0.75rem", color: colors.muted, opacity: 0.6 }}>
          no data
        </div>
      ) : (
        entries.map((e, idx) => {
          const v = (e as any)[metric] as number;
          const pct = (v / max) * 100;
          return (
            <motion.div
              key={e.key}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...MOTION.spring, delay: idx * 0.05 }}
              style={{ display: "flex", flexDirection: "column", gap: 4 }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  fontSize: "0.8125rem",
                  ...numberStyle,
                }}
              >
                <span
                  style={{
                    fontWeight: 500,
                    color: colors.fg,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "70%",
                  }}
                >
                  {e.key}
                </span>
                <span style={{ color: colors.muted, fontWeight: 400 }}>
                  {metric === "costUsd"
                    ? formatCurrency(v, "USD", locale)
                    : formatNumber(v, "full", locale)}
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  borderRadius: 3,
                  background: "color-mix(in srgb, currentColor 8%, transparent)",
                  overflow: "hidden",
                }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ ...MOTION.spring, delay: idx * 0.05 + 0.1 }}
                  style={{
                    height: "100%",
                    background: colors.gradient,
                    borderRadius: 3,
                    boxShadow: `0 0 8px ${colors.glow}`,
                  }}
                />
              </div>
            </motion.div>
          );
        })
      )}
    </div>
  );
}
