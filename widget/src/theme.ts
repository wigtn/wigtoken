import type { CSSProperties } from "react";

export type Theme = "purple" | "teal" | "amber" | "mono" | "auto";
export type Size = "xs" | "sm" | "md" | "lg" | "xl";
export type Variant = "solid" | "outline" | "ghost" | "glass";
export type Density = "compact" | "normal" | "spacious";
export type FormatMode = "short" | "full" | "compact" | "scientific";

interface ThemeColors {
  accent: string;
  fg: string;
}

const THEME_PALETTES: Record<Theme, ThemeColors> = {
  purple: { accent: "#7c3aed", fg: "#a78bfa" },
  teal: { accent: "#0d9488", fg: "#5eead4" },
  amber: { accent: "#d97706", fg: "#fbbf24" },
  mono: { accent: "#525252", fg: "#a3a3a3" },
  auto: {
    accent: "var(--wigtoken-accent, #7c3aed)",
    fg: "var(--wigtoken-fg, currentColor)",
  },
};

interface SizeTokens {
  number: string;
  label: string;
  gap: number;
  padding: number;
}

const SIZE_MAP: Record<Size, SizeTokens> = {
  xs: { number: "0.875rem", label: "0.625rem", gap: 1, padding: 4 },
  sm: { number: "1.125rem", label: "0.6875rem", gap: 2, padding: 6 },
  md: { number: "1.75rem", label: "0.75rem", gap: 4, padding: 8 },
  lg: { number: "2.5rem", label: "0.8125rem", gap: 6, padding: 12 },
  xl: { number: "clamp(3rem, 6vw, 4.5rem)", label: "0.875rem", gap: 8, padding: 16 },
};

const DENSITY_GAP: Record<Density, number> = {
  compact: 1,
  normal: 4,
  spacious: 8,
};

/**
 * Resolve theme + size + variant into a flat token set. Consumers blend
 * these into inline styles so the widget works on plain HTML, Tailwind,
 * styled-components alike. CSS custom properties win when set on the
 * host page.
 */
export function resolveTheme(opts: {
  theme?: Theme;
  size?: Size;
  variant?: Variant;
  density?: Density;
}): {
  colors: ThemeColors;
  sizes: SizeTokens;
  variant: Variant;
  densityGap: number;
} {
  const theme = opts.theme ?? "auto";
  const size = opts.size ?? "md";
  const variant = opts.variant ?? "ghost";
  const density = opts.density ?? "normal";
  return {
    colors: THEME_PALETTES[theme],
    sizes: SIZE_MAP[size],
    variant,
    densityGap: DENSITY_GAP[density],
  };
}

/**
 * Container background / border for the four `variant` values. Returns
 * a partial style object that's merged after layout style.
 */
export function variantStyle(
  variant: Variant,
  colors: ThemeColors
): CSSProperties {
  const radius = "var(--wigtoken-radius, 12px)";
  switch (variant) {
    case "solid":
      return {
        background: colors.accent,
        color: "#ffffff",
        padding: 12,
        borderRadius: radius,
      };
    case "outline":
      return {
        border: `1px solid ${colors.accent}`,
        padding: 12,
        borderRadius: radius,
      };
    case "glass":
      return {
        background: "color-mix(in srgb, currentColor 6%, transparent)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        padding: 12,
        borderRadius: radius,
      };
    case "ghost":
    default:
      return { padding: 0 };
  }
}

export const sharedFontStyle: CSSProperties = {
  fontFamily:
    "var(--wigtoken-font, Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif)",
  color: "var(--wigtoken-fg, currentColor)",
  lineHeight: 1.2,
};

/** Tabular numbers + lining figures so counters don't jitter. */
export const numberStyle: CSSProperties = {
  fontFeatureSettings: '"tnum" on, "lnum" on',
  fontVariantNumeric: "tabular-nums",
};

export const labelStyle: CSSProperties = {
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  opacity: 0.6,
};
