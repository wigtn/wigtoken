import { motion } from "framer-motion";
import type { CSSProperties } from "react";
import { useRecent } from "./hooks";
import { formatCurrency, formatNumber, formatRelativeTime } from "./format";
import {
  labelStyle,
  numberStyle,
  resolveTheme,
  sharedFontStyle,
  MOTION,
  type Size,
  type Theme,
} from "./theme";

export interface RecentActivityProps {
  limit?: number;
  size?: Size;
  theme?: Theme;
  showCost?: boolean;
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

export function RecentActivity({
  limit = 12,
  size = "md",
  theme = "auto",
  showCost = true,
  title = "Recent activity",
  locale,
  containerStyle,
  className,
}: RecentActivityProps) {
  const { data } = useRecent({ limit });
  const { sizes, colors } = resolveTheme({ size, theme });
  const entries = data?.entries ?? [];

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
      {title && (
        <div style={{ ...labelStyle, color: colors.muted, marginBottom: 4 }}>
          {title}
        </div>
      )}
      {entries.length === 0 ? (
        <div style={{ fontSize: sizes.label, color: colors.muted, opacity: 0.5 }}>
          nothing yet
        </div>
      ) : (
        entries.map((m, i) => (
          <motion.div
            key={`${m.ts}-${i}`}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...MOTION.spring, delay: i * 0.03 }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: sizes.label,
              padding: "4px 6px",
              borderRadius: 6,
              ...numberStyle,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: FAMILY_COLOR[m.modelFamily] ?? "#737373",
                boxShadow: `0 0 6px ${FAMILY_COLOR[m.modelFamily] ?? "#737373"}55`,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              <strong style={{ fontWeight: 600, color: colors.fg }}>{m.user}</strong>
              <span style={{ color: colors.muted }}> · {m.machine}</span>
              <span style={{ color: colors.muted }}> · {m.modelFamily}</span>
            </span>
            {showCost && (
              <span style={{ color: colors.muted, fontWeight: 500 }}>
                {formatCurrency(m.costUsd, "USD", locale, 3)}
              </span>
            )}
            <span
              style={{
                color: colors.muted,
                opacity: 0.7,
                width: 70,
                textAlign: "right",
              }}
            >
              {formatRelativeTime(m.ts, locale)}
            </span>
          </motion.div>
        ))
      )}
      <span
        style={{
          fontSize: "0.625rem",
          color: colors.muted,
          opacity: 0.5,
          marginTop: 4,
        }}
      >
        {formatNumber(entries.length, "full", locale)} of last {limit}
      </span>
    </div>
  );
}
