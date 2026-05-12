import { motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";
import {
  labelStyle,
  numberStyle,
  resolveTheme,
  sharedFontStyle,
  variantStyle,
  MOTION,
  type Size,
  type Theme,
  type Variant,
} from "./theme";

export interface MetricCardProps {
  label: ReactNode;
  /** Big focal value — typically a counter component. */
  value: ReactNode;
  /** Smaller line below the value (delta, "last 7d", etc). */
  sub?: ReactNode;
  /** Optional icon rendered before the label (12-16px sized). */
  icon?: ReactNode;
  /** Optional element rendered after the value on the same row (badge). */
  trailing?: ReactNode;
  size?: Size;
  theme?: Theme;
  variant?: Variant;
  /** Enable per-card hover lift. Default true. */
  interactive?: boolean;
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
 *     icon={<Sparkles />}
 *   />
 *
 * Animates in with a subtle slide+fade, and lifts on hover when
 * `interactive` (default true). Honors size/theme/variant tokens —
 * pass variant="ghost" for unstyled output.
 */
export function MetricCard({
  label,
  value,
  sub,
  icon,
  trailing,
  size = "md",
  theme = "auto",
  variant = "glass",
  interactive = true,
  containerStyle,
  className,
}: MetricCardProps) {
  const { colors, sizes } = resolveTheme({ size, theme, variant });

  const wrapper: CSSProperties = {
    ...sharedFontStyle,
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: sizes.gap,
    overflow: "hidden",
    minWidth: 0,
    ...variantStyle(variant, colors, sizes),
    ...containerStyle,
  };

  // Subtle gradient ring on the top edge — react-bits-ish "alive" cue.
  const topRing: CSSProperties =
    variant === "ghost"
      ? {}
      : {
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent 0%, ${colors.accent} 50%, transparent 100%)`,
          opacity: 0.5,
          pointerEvents: "none",
        };

  const labelRow: CSSProperties = {
    ...labelStyle,
    fontSize: sizes.label,
    color: colors.muted,
    display: "flex",
    alignItems: "center",
    gap: 6,
  };

  const valueRow: CSSProperties = {
    ...numberStyle,
    fontSize: sizes.number,
    color: colors.fg,
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
    minWidth: 0,
  };

  return (
    <motion.div
      className={className}
      style={wrapper}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={MOTION.spring}
      whileHover={
        interactive
          ? {
              y: -2,
              boxShadow: `0 12px 40px ${colors.glow}, inset 0 1px 0 rgba(255,255,255,0.06)`,
            }
          : undefined
      }
    >
      <span style={topRing} aria-hidden="true" />
      <div style={labelRow}>
        {icon && <span style={{ display: "inline-flex" }}>{icon}</span>}
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
      </div>
      <div style={valueRow}>
        <span style={{ minWidth: 0 }}>{value}</span>
        {trailing && <span style={{ flexShrink: 0 }}>{trailing}</span>}
      </div>
      {sub && (
        <div
          style={{
            fontSize: sizes.label,
            color: colors.muted,
            opacity: 0.85,
          }}
        >
          {sub}
        </div>
      )}
    </motion.div>
  );
}
