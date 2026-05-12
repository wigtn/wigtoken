/**
 * Lowest-common-denominator counter used by every TokenCounter /
 * CostCounter / MessageCounter etc. Animates a smooth count-up, adds
 * a brief glow pulse on each update, and exposes the resolved theme
 * so callers (and the slot-machine digit renderer that lives here)
 * can layer their own treatments on top.
 *
 * This is the v0.2.0 react-bits redesign — the lift is in `numberFx`
 * which sets up a gradient-text fill + per-digit slot-machine animation
 * via Framer Motion. Pass `useSlotMachine={false}` to keep the
 * pre-v0.2 plain count-up (smaller bundle, less motion).
 */

import {
  AnimatePresence,
  motion,
} from "framer-motion";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  labelStyle as defaultLabelStyle,
  gradientTextStyle,
  numberStyle,
  resolveTheme,
  sharedFontStyle,
  variantStyle,
  MOTION,
  type Density,
  type Size,
  type Theme,
  type Variant,
} from "../theme";

export interface CounterBaseProps {
  /** Current value to animate towards. */
  value: number;
  /** Optional formatter for the displayed number. Default: en-US thousands. */
  formatter?: (v: number) => string;
  label?: ReactNode;
  sub?: ReactNode;
  durationMs?: number;
  size?: Size;
  theme?: Theme;
  variant?: Variant;
  density?: Density;
  /** Brief scale + glow pulse on each value change. Default true. */
  pulseOnUpdate?: boolean;
  /** Apply theme gradient to the digits. Default true. */
  gradient?: boolean;
  /** Per-digit slot-machine flip on each change. Default true. */
  useSlotMachine?: boolean;
  containerStyle?: CSSProperties;
  numberStyle?: CSSProperties;
  className?: string;
}

export default function Counter({
  value,
  formatter,
  label,
  sub,
  durationMs = 1100,
  size = "md",
  theme = "auto",
  variant = "ghost",
  density = "normal",
  pulseOnUpdate = true,
  gradient = true,
  useSlotMachine = true,
  containerStyle,
  numberStyle: numberStyleOverride,
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
      const t = setTimeout(() => setPulsing(false), 450);
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
    position: "relative",
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: densityGap,
    ...variantStyle(variant, colors, sizes),
    ...containerStyle,
  };

  const formatted = formatter ? formatter(display) : display.toLocaleString();
  const digitColor = variant === "solid" ? "#ffffff" : colors.fg;

  const numberStyleResolved: CSSProperties = {
    ...numberStyle,
    fontSize: sizes.number,
    letterSpacing: "-0.02em",
    color: digitColor,
    ...(gradient && variant !== "solid" ? gradientTextStyle(colors) : {}),
    ...numberStyleOverride,
  };

  return (
    <motion.div
      style={wrapperStyle}
      className={className}
      animate={
        pulsing
          ? {
              scale: 1.04,
              filter: `drop-shadow(0 0 12px ${colors.glow})`,
            }
          : { scale: 1, filter: "drop-shadow(0 0 0px rgba(0,0,0,0))" }
      }
      transition={MOTION.pulseSpring}
    >
      {useSlotMachine ? (
        <SlotMachine text={formatted} style={numberStyleResolved} />
      ) : (
        <span style={numberStyleResolved}>{formatted}</span>
      )}
      {label && (
        <span style={{ ...defaultLabelStyle, fontSize: sizes.label, color: colors.muted }}>
          {label}
        </span>
      )}
      {sub && (
        <span
          style={{
            ...numberStyle,
            fontSize: sizes.label,
            opacity: 0.7,
            color: colors.muted,
          }}
        >
          {sub}
        </span>
      )}
    </motion.div>
  );
}

/**
 * Render `text` so each character animates independently when it
 * changes. Digits and punctuation that stay put don't re-animate —
 * only the chars that actually changed flip. Inspired by react-bits'
 * "CountUp" / "Variable Slot" components.
 */
function SlotMachine({ text, style }: { text: string; style: CSSProperties }) {
  return (
    <span style={{ display: "inline-flex", ...style }} aria-label={text}>
      {Array.from(text).map((ch, i) => (
        <Slot key={`${i}-${ch}`} char={ch} />
      ))}
    </span>
  );
}

function Slot({ char }: { char: string }) {
  // Non-digits don't need animation — they're stable.
  if (!/[0-9]/.test(char)) {
    return <span aria-hidden="true">{char}</span>;
  }
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        position: "relative",
        overflow: "hidden",
        verticalAlign: "baseline",
        height: "1em",
        width: "0.6em",
        textAlign: "center",
        justifyContent: "center",
      }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={char}
          initial={{ y: "-100%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={MOTION.spring}
          style={{
            position: "absolute",
            inset: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
          }}
        >
          {char}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
