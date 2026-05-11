import type { CSSProperties } from "react";
import { useTimeseries } from "./hooks";
import { resolveTheme, sharedFontStyle, type Size, type Theme } from "./theme";

export interface BurnSparklineProps {
  range?: "1h" | "24h" | "7d" | "30d";
  metric?: "tokensWeighted" | "tokensRaw" | "costUsd" | "messages";
  size?: Size;
  theme?: Theme;
  width?: number;
  height?: number;
  strokeWidth?: number;
  showArea?: boolean;
  containerStyle?: CSSProperties;
  className?: string;
}

const SIZE_DEFAULTS: Record<Size, { w: number; h: number }> = {
  xs: { w: 80, h: 24 },
  sm: { w: 120, h: 32 },
  md: { w: 180, h: 48 },
  lg: { w: 240, h: 64 },
  xl: { w: 320, h: 80 },
};

/**
 * Inline-SVG burn-rate sparkline. Pulls timeseries data via
 * useTimeseries() so it's safe to drop in anywhere under
 * <ProviderConfig>. Zero chart dependency.
 */
export function BurnSparkline({
  range = "24h",
  metric = "tokensWeighted",
  size = "md",
  theme = "auto",
  width,
  height,
  strokeWidth = 2,
  showArea = true,
  containerStyle,
  className,
}: BurnSparklineProps) {
  const { data } = useTimeseries({ range });
  const { colors } = resolveTheme({ theme });
  const dims = SIZE_DEFAULTS[size];
  const w = width ?? dims.w;
  const h = height ?? dims.h;
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
          ...containerStyle,
        }}
        className={className}
      >
        no data
      </div>
    );
  }

  const ys = buckets.map((b) => (b as any)[metric] as number);
  const max = Math.max(...ys);
  const min = Math.min(...ys);
  const span = max - min || 1;
  const stepX = w / Math.max(1, buckets.length - 1);
  const points = ys.map((y, i) => {
    const x = i * stepX;
    const yPx = h - ((y - min) / span) * (h - strokeWidth * 2) - strokeWidth;
    return [x, yPx] as const;
  });
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`)
    .join(" ");
  const areaPath = `${linePath} L ${w} ${h} L 0 ${h} Z`;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={containerStyle}
      className={className}
      role="img"
      aria-label={`${metric} sparkline over the last ${range}`}
    >
      {showArea && (
        <path
          d={areaPath}
          fill={colors.accent}
          fillOpacity={0.12}
        />
      )}
      <path
        d={linePath}
        fill="none"
        stroke={colors.accent}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
