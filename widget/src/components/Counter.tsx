/**
 * Lowest-common-denominator counter used by every TokenCounter /
 * CostCounter / MessageCounter etc. Handles the inline-style merging
 * and the count-up animation; subject-specific components just pick
 * which Totals field to feed in.
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  labelStyle as defaultLabelStyle,
  numberStyle,
  resolveTheme,
  sharedFontStyle,
  variantStyle,
  type Density,
  type Size,
  type Theme,
  type Variant,
} from "../theme";

export interface CounterBaseProps {
  /** Pre-formatted current value. */
  value: number;
  /** Optional formatter for the displayed number. */
  formatter?: (v: number) => string;
  label?: ReactNode;
  sub?: ReactNode;
  durationMs?: number;
  size?: Size;
  theme?: Theme;
  variant?: Variant;
  density?: Density;
  pulseOnUpdate?: boolean;
  containerStyle?: CSSProperties;
  className?: string;
}

export default function Counter({
  value,
  formatter,
  label,
  sub,
  durationMs = 1400,
  size = "md",
  theme = "auto",
  variant = "ghost",
  density = "normal",
  pulseOnUpdate = false,
  containerStyle,
  className,
}: CounterBaseProps) {
  const [display, setDisplay] = useState(value);
  const [pulsing, setPulsing] = useState(false);
  const prev = useRef(value);

  useEffect(() => {
    const from = prev.current;
    if (from === value) return;
    if (pulseOnUpdate) {
      setPulsing(true);
      const t = setTimeout(() => setPulsing(false), 400);
      // Don't cancel the count-up below; both effects can run.
      return () => clearTimeout(t);
    }
  }, [value, pulseOnUpdate]);

  useEffect(() => {
    const from = prev.current;
    if (from === value) return;
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 4);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) {
        raf = requestAnimationFrame(step);
      } else {
        prev.current = value;
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  const { colors, sizes, densityGap } = resolveTheme({
    size,
    theme,
    variant,
    density,
  });

  const wrapperStyle: CSSProperties = {
    ...sharedFontStyle,
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: densityGap,
    transition: "transform 240ms ease-out, opacity 240ms ease-out",
    transform: pulsing ? "scale(1.03)" : "scale(1)",
    ...variantStyle(variant, colors),
    ...containerStyle,
  };

  return (
    <div style={wrapperStyle} className={className}>
      <span
        style={{
          ...numberStyle,
          fontSize: sizes.number,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: variant === "solid" ? "#ffffff" : "currentColor",
        }}
      >
        {formatter ? formatter(display) : display.toLocaleString()}
      </span>
      {label && (
        <span
          style={{
            ...defaultLabelStyle,
            fontSize: sizes.label,
          }}
        >
          {label}
        </span>
      )}
      {sub && (
        <span
          style={{
            ...numberStyle,
            fontSize: sizes.label,
            opacity: 0.7,
          }}
        >
          {sub}
        </span>
      )}
    </div>
  );
}
