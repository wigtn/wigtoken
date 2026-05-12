import { motion } from "framer-motion";
import { useId, type CSSProperties } from "react";
import { useTimeseries } from "./hooks";
import {
  resolveTheme,
  sharedFontStyle,
  MOTION,
  type Size,
  type Theme,
} from "./theme";

export interface BurnSparklineProps {
  range?: "1h" | "24h" | "7d" | "30d";
  metric?: "tokensWeighted" | "tokensRaw" | "costUsd" | "messages";
  size?: Size;
  theme?: Theme;
  width?: number;
  height?: number;
  strokeWidth?: number;
  /** Smooth curve through points (bezier). Default true. */
  smooth?: boolean;
  /** Render the gradient area under the curve. Default true. */
  showArea?: boolean;
  /** Show pulsing dot at the last data point. Default true. */
  showHead?: boolean;
  containerStyle?: CSSProperties;
  className?: string;
}

const SIZE_DEFAULTS: Record<Size, { w: number; h: number }> = {
  xs: { w: 80, h: 28 },
  sm: { w: 140, h: 40 },
  md: { w: "100%" as any, h: 64 },
  lg: { w: "100%" as any, h: 88 },
  xl: { w: "100%" as any, h: 120 },
};

/**
 * Inline-SVG burn-rate sparkline. Pulls timeseries via useTimeseries(),
 * draws the stroke with an animated dash-offset (Framer Motion) so it
 * pencil-traces in on mount, fills the area with a vertical gradient
 * that fades to transparent, and pulses a halo at the latest data
 * point. Zero chart-library dependency.
 *
 * Width defaults to 100% for md+, so this is responsive when dropped
 * inside any flex/grid cell.
 */
export function BurnSparkline({
  range = "24h",
  metric = "tokensWeighted",
  size = "md",
  theme = "auto",
  width,
  height,
  strokeWidth = 2,
  smooth = true,
  showArea = true,
  showHead = true,
  containerStyle,
  className,
}: BurnSparklineProps) {
  const { data } = useTimeseries({ range });
  const { colors } = resolveTheme({ theme });
  const dims = SIZE_DEFAULTS[size];
  const w = (width as any) ?? dims.w;
  const h = height ?? dims.h;
  const isResponsive = w === "100%";
  const viewW = 600;
  const viewH = h;
  const gradId = useId();
  const buckets = data?.buckets ?? [];

  if (buckets.length < 2) {
    return (
      <div
        style={{
          ...sharedFontStyle,
          width: w,
          height: h,
          fontSize: "0.7rem",
          opacity: 0.4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: colors.muted,
          ...containerStyle,
        }}
        className={className}
      >
        ─── no data ───
      </div>
    );
  }

  const ys = buckets.map((b) => (b as any)[metric] as number);
  const max = Math.max(...ys);
  const min = Math.min(...ys);
  const pad = strokeWidth * 2;
  const span = max - min || 1;
  const stepX = viewW / Math.max(1, buckets.length - 1);
  const points = ys.map((y, i) => {
    const x = i * stepX;
    const yPx = viewH - ((y - min) / span) * (viewH - pad * 2) - pad;
    return [x, yPx] as const;
  });

  const linePath = smooth ? smoothPath(points) : straightPath(points);
  const areaPath = `${linePath} L ${viewW} ${viewH} L 0 ${viewH} Z`;
  const head = points[points.length - 1];

  return (
    <svg
      width={w as any}
      height={h}
      viewBox={`0 0 ${viewW} ${viewH}`}
      preserveAspectRatio={isResponsive ? "none" : "xMidYMid meet"}
      style={{ display: "block", overflow: "visible", ...containerStyle }}
      className={className}
      role="img"
      aria-label={`${metric} sparkline over the last ${range}`}
    >
      <defs>
        <linearGradient id={`fill-${gradId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.accent} stopOpacity="0.4" />
          <stop offset="100%" stopColor={colors.accent} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`stroke-${gradId}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={colors.accent} stopOpacity="0.4" />
          <stop offset="100%" stopColor={colors.accent} stopOpacity="1" />
        </linearGradient>
      </defs>
      {showArea && (
        <motion.path
          d={areaPath}
          fill={`url(#fill-${gradId})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3, ease: MOTION.ease }}
        />
      )}
      <motion.path
        d={linePath}
        fill="none"
        stroke={`url(#stroke-${gradId})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: MOTION.ease }}
      />
      {showHead && head && (
        <>
          <motion.circle
            cx={head[0]}
            cy={head[1]}
            r={strokeWidth * 1.6}
            fill={colors.accent}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1, ...MOTION.spring }}
          />
          <motion.circle
            cx={head[0]}
            cy={head[1]}
            r={strokeWidth * 1.6}
            fill="none"
            stroke={colors.accent}
            strokeOpacity={0.6}
            animate={{ r: [strokeWidth * 1.6, strokeWidth * 4, strokeWidth * 1.6] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 1.2 }}
            style={{ mixBlendMode: "screen" }}
          />
        </>
      )}
    </svg>
  );
}

function straightPath(points: readonly (readonly [number, number])[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
}

/**
 * Catmull-Rom → cubic bezier so the line is smooth without spiking.
 * Tension ~0.5 — gentle curves, not bezier-soup.
 */
function smoothPath(points: readonly (readonly [number, number])[]): string {
  if (points.length < 2) return "";
  if (points.length === 2) return `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]}`;
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}
