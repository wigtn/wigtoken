import type { CSSProperties } from "react";

export type Theme = "purple" | "teal" | "amber" | "mono" | "cyan" | "rose" | "auto";
export type Size = "xs" | "sm" | "md" | "lg" | "xl";
export type Variant = "solid" | "outline" | "ghost" | "glass" | "neon";
export type Density = "compact" | "normal" | "spacious";
export type FormatMode = "short" | "full" | "compact" | "scientific";

interface ThemeColors {
  /** Solid accent (links, dot, primary button) */
  accent: string;
  /** Foreground color for digit / label text */
  fg: string;
  /** Dimmer label / muted text */
  muted: string;
  /** Card background base */
  surface: string;
  /** Subtle border */
  border: string;
  /** Glow color (used in box-shadow with alpha) */
  glow: string;
  /** Linear-gradient string used for chart fills, value text, etc. */
  gradient: string;
}

const THEME_PALETTES: Record<Theme, ThemeColors> = {
  purple: {
    accent: "#a78bfa",
    fg: "#f5f3ff",
    muted: "#a3a3a3",
    surface: "rgba(124, 58, 237, 0.04)",
    border: "rgba(167, 139, 250, 0.15)",
    glow: "rgba(167, 139, 250, 0.35)",
    gradient: "linear-gradient(135deg, #a78bfa 0%, #f472b6 100%)",
  },
  teal: {
    accent: "#5eead4",
    fg: "#ecfeff",
    muted: "#94a3b8",
    surface: "rgba(13, 148, 136, 0.04)",
    border: "rgba(94, 234, 212, 0.15)",
    glow: "rgba(94, 234, 212, 0.35)",
    gradient: "linear-gradient(135deg, #5eead4 0%, #38bdf8 100%)",
  },
  amber: {
    accent: "#fbbf24",
    fg: "#fefce8",
    muted: "#a8a29e",
    surface: "rgba(217, 119, 6, 0.04)",
    border: "rgba(251, 191, 36, 0.15)",
    glow: "rgba(251, 191, 36, 0.35)",
    gradient: "linear-gradient(135deg, #fbbf24 0%, #f97316 100%)",
  },
  cyan: {
    accent: "#22d3ee",
    fg: "#ecfeff",
    muted: "#94a3b8",
    surface: "rgba(8, 145, 178, 0.04)",
    border: "rgba(34, 211, 238, 0.15)",
    glow: "rgba(34, 211, 238, 0.4)",
    gradient: "linear-gradient(135deg, #22d3ee 0%, #6366f1 100%)",
  },
  rose: {
    accent: "#fb7185",
    fg: "#fff1f2",
    muted: "#a8a29e",
    surface: "rgba(244, 63, 94, 0.04)",
    border: "rgba(251, 113, 133, 0.15)",
    glow: "rgba(251, 113, 133, 0.35)",
    gradient: "linear-gradient(135deg, #fb7185 0%, #c084fc 100%)",
  },
  mono: {
    accent: "#a3a3a3",
    fg: "#fafafa",
    muted: "#737373",
    surface: "rgba(115, 115, 115, 0.04)",
    border: "rgba(163, 163, 163, 0.15)",
    glow: "rgba(163, 163, 163, 0.25)",
    gradient: "linear-gradient(135deg, #d4d4d4 0%, #737373 100%)",
  },
  auto: {
    accent: "var(--wigtoken-accent, #a78bfa)",
    fg: "var(--wigtoken-fg, currentColor)",
    muted: "var(--wigtoken-muted, #a3a3a3)",
    surface: "var(--wigtoken-surface, rgba(124, 58, 237, 0.04))",
    border: "var(--wigtoken-border, rgba(167, 139, 250, 0.15))",
    glow: "var(--wigtoken-glow, rgba(167, 139, 250, 0.35))",
    gradient:
      "var(--wigtoken-gradient, linear-gradient(135deg, #a78bfa 0%, #f472b6 100%))",
  },
};

interface SizeTokens {
  number: string;
  label: string;
  gap: number;
  padding: number;
  radius: number;
}

const SIZE_MAP: Record<Size, SizeTokens> = {
  xs: { number: "clamp(0.875rem, 1.4vw, 1rem)", label: "0.625rem", gap: 1, padding: 6, radius: 8 },
  sm: { number: "clamp(1.125rem, 1.8vw, 1.375rem)", label: "0.6875rem", gap: 2, padding: 8, radius: 10 },
  md: { number: "clamp(1.5rem, 2.6vw, 2rem)", label: "0.75rem", gap: 4, padding: 12, radius: 12 },
  lg: { number: "clamp(2rem, 4vw, 3rem)", label: "0.8125rem", gap: 6, padding: 16, radius: 14 },
  xl: { number: "clamp(2.75rem, 6vw, 4.5rem)", label: "0.875rem", gap: 8, padding: 20, radius: 16 },
};

const DENSITY_GAP: Record<Density, number> = {
  compact: 1,
  normal: 4,
  spacious: 8,
};

/**
 * Motion preset — spring config tuned to feel "alive" but not janky.
 * Used by every component's mount animation and value-change pulse.
 */
export const MOTION = {
  spring: { type: "spring" as const, stiffness: 280, damping: 26, mass: 0.6 },
  pulseSpring: { type: "spring" as const, stiffness: 360, damping: 18 },
  ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
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
  const variant = opts.variant ?? "glass";
  const density = opts.density ?? "normal";
  return {
    colors: THEME_PALETTES[theme],
    sizes: SIZE_MAP[size],
    variant,
    densityGap: DENSITY_GAP[density],
  };
}

/**
 * Container background / border for each `variant`. Returns a partial
 * style object that's merged after layout style. Reaches for the
 * resolved size's radius so different sizes look proportional.
 */
export function variantStyle(
  variant: Variant,
  colors: ThemeColors,
  sizes?: SizeTokens
): CSSProperties {
  const radius = sizes?.radius ?? 12;
  const padding = sizes?.padding ?? 12;
  switch (variant) {
    case "solid":
      return {
        background: colors.gradient,
        color: "#ffffff",
        padding,
        borderRadius: radius,
        boxShadow: `0 8px 32px ${colors.glow}, inset 0 1px 0 rgba(255,255,255,0.1)`,
      };
    case "outline":
      return {
        border: `1px solid ${colors.border}`,
        background: colors.surface,
        padding,
        borderRadius: radius,
      };
    case "glass":
      return {
        background: colors.surface,
        backdropFilter: "blur(12px) saturate(140%)",
        WebkitBackdropFilter: "blur(12px) saturate(140%)",
        border: `1px solid ${colors.border}`,
        padding,
        borderRadius: radius,
        boxShadow: `0 4px 24px ${colors.glow}, inset 0 1px 0 rgba(255,255,255,0.04)`,
      };
    case "neon":
      return {
        background: "rgba(0,0,0,0.55)",
        border: `1px solid ${colors.accent}`,
        padding,
        borderRadius: radius,
        boxShadow: `0 0 0 1px ${colors.glow}, 0 0 24px ${colors.glow}, inset 0 0 24px ${colors.glow}`,
      };
    case "ghost":
    default:
      return { padding: 0 };
  }
}

export const sharedFontStyle: CSSProperties = {
  fontFamily:
    "var(--wigtoken-font, 'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif)",
  color: "var(--wigtoken-fg, currentColor)",
  lineHeight: 1.15,
  letterSpacing: "-0.01em",
};

/** Tabular numbers + lining figures so counters don't jitter. */
export const numberStyle: CSSProperties = {
  fontFeatureSettings: '"tnum" on, "lnum" on, "cv11" on',
  fontVariantNumeric: "tabular-nums",
  fontWeight: 600,
};

export const labelStyle: CSSProperties = {
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  opacity: 0.55,
  fontWeight: 500,
  fontSize: "0.6875rem",
};

/**
 * Apply a theme's gradient as the text fill — used by hero counters
 * and section titles. Falls back to plain color if the host doesn't
 * support background-clip:text (rare in 2025+).
 */
export function gradientTextStyle(colors: ThemeColors): CSSProperties {
  return {
    backgroundImage: colors.gradient,
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    color: "transparent",
    WebkitTextFillColor: "transparent",
  };
}
