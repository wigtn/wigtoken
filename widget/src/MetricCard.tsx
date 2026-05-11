import type { CSSProperties, ReactNode } from "react";
import {
  labelStyle,
  numberStyle,
  resolveTheme,
  sharedFontStyle,
  type Size,
  type Theme,
  type Variant,
} from "./theme";

export interface MetricCardProps {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  size?: Size;
  theme?: Theme;
  variant?: Variant;
  containerStyle?: CSSProperties;
  className?: string;
}

/**
 * Layout primitive used by dashboards composed out of widget pieces.
 * Combines a label, a large value, and an optional sub-line. Pass any
 * counter component as `value` to compose:
 *
 *   <MetricCard
 *     label="weighted tokens"
 *     value={<WeightedTokenCounter size="lg" />}
 *     sub="last 7 days"
 *   />
 */
export function MetricCard({
  label,
  value,
  sub,
  size = "md",
  theme = "auto",
  variant = "outline",
  containerStyle,
  className,
}: MetricCardProps) {
  const { colors, sizes } = resolveTheme({ size, theme, variant });
  const wrapper: CSSProperties = {
    ...sharedFontStyle,
    display: "inline-flex",
    flexDirection: "column",
    gap: sizes.gap,
    padding: sizes.padding * 1.5,
    borderRadius: "var(--wigtoken-radius, 12px)",
    border: variant === "outline" ? `1px solid color-mix(in srgb, currentColor 12%, transparent)` : "none",
    background: variant === "glass" ? "color-mix(in srgb, currentColor 6%, transparent)" : undefined,
    ...containerStyle,
  };
  void colors;
  return (
    <div style={wrapper} className={className}>
      <div style={{ ...labelStyle, fontSize: sizes.label }}>{label}</div>
      <div style={{ ...numberStyle, fontSize: sizes.number, fontWeight: 600 }}>
        {value}
      </div>
      {sub && (
        <div style={{ ...numberStyle, fontSize: sizes.label, opacity: 0.6 }}>
          {sub}
        </div>
      )}
    </div>
  );
}
