import type { CSSProperties } from "react";
import { useRecent } from "./hooks";
import { formatCurrency, formatNumber, formatRelativeTime } from "./format";
import {
  labelStyle,
  numberStyle,
  resolveTheme,
  sharedFontStyle,
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
  opus: "#8b5cf6",
  sonnet: "#14b8a6",
  haiku: "#f59e0b",
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
  const { sizes } = resolveTheme({ size, theme });
  const entries = data?.entries ?? [];

  const wrapper: CSSProperties = {
    ...sharedFontStyle,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    ...containerStyle,
  };

  return (
    <div style={wrapper} className={className}>
      {title && <div style={labelStyle}>{title}</div>}
      {entries.length === 0 ? (
        <div style={{ fontSize: sizes.label, opacity: 0.4 }}>nothing yet</div>
      ) : (
        entries.map((m, i) => (
          <div
            key={`${m.ts}-${i}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: sizes.label,
              ...numberStyle,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: FAMILY_COLOR[m.modelFamily] ?? "#737373",
                flexShrink: 0,
              }}
            />
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <strong style={{ fontWeight: 500 }}>{m.user}</strong>
              <span style={{ opacity: 0.5 }}> · {m.machine}</span>
              <span style={{ opacity: 0.5 }}> · {m.modelFamily}</span>
            </span>
            {showCost && (
              <span style={{ opacity: 0.7, fontWeight: 500 }}>
                {formatCurrency(m.costUsd, "USD", locale, 3)}
              </span>
            )}
            <span style={{ opacity: 0.4, width: 70, textAlign: "right" }}>
              {formatRelativeTime(m.ts, locale)}
            </span>
          </div>
        ))
      )}
      <span style={{ fontSize: "0.625rem", opacity: 0.4 }}>
        {formatNumber(entries.length, "full", locale)} of last {limit}
      </span>
    </div>
  );
}
