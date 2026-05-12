import { motion } from "framer-motion";
import { useEffect, useState, type CSSProperties } from "react";
import { useWigtnContext } from "./ProviderConfig";

export interface EmbedPulseDotProps {
  size?: number;
  /** When true, shows status text ("live" / "offline") next to the dot. */
  withLabel?: boolean;
  /** Override colours. */
  connectedColor?: string;
  disconnectedColor?: string;
  containerStyle?: CSSProperties;
  className?: string;
}

/**
 * Connection-status indicator. Renders an emerald/grey dot with two
 * pulsing rings around it while SSE is alive — the rings ride a slow
 * Framer Motion scale loop so the page never goes fully still. When
 * SSE drops, the rings fade and the dot dims to grey.
 */
export function EmbedPulseDot({
  size = 8,
  withLabel = false,
  connectedColor = "var(--wigtoken-accent, #34d399)",
  disconnectedColor = "#a3a3a3",
  containerStyle,
  className,
}: EmbedPulseDotProps) {
  const { isConnected, lastUpdate } = useWigtnContext();
  const [bump, setBump] = useState(false);

  // Quick pop on each new totals payload.
  useEffect(() => {
    if (!lastUpdate) return;
    setBump(true);
    const t = setTimeout(() => setBump(false), 360);
    return () => clearTimeout(t);
  }, [lastUpdate]);

  const color = isConnected ? connectedColor : disconnectedColor;
  const ringSize = size * 2.4;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        position: "relative",
        ...containerStyle,
      }}
      className={className}
    >
      <span
        aria-hidden
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: ringSize,
          height: ringSize,
        }}
      >
        {/* Slow ambient ring */}
        {isConnected && (
          <motion.span
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
              opacity: 0.5,
            }}
            animate={{ scale: [0.7, 1.2, 0.7], opacity: [0.25, 0.5, 0.25] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        {/* Bump ring on each update */}
        {isConnected && bump && (
          <motion.span
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: `1px solid ${color}`,
            }}
            initial={{ scale: 0.7, opacity: 0.8 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        )}
        {/* Core dot */}
        <motion.span
          animate={{ scale: bump ? 1.25 : 1 }}
          transition={{ duration: 0.24 }}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: color,
            boxShadow: isConnected
              ? `0 0 8px ${color}, 0 0 16px color-mix(in srgb, ${color} 35%, transparent)`
              : "none",
          }}
        />
      </span>
      {withLabel && (
        <span
          style={{
            fontSize: "0.6875rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: isConnected ? color : disconnectedColor,
            opacity: 0.9,
          }}
        >
          {isConnected ? "live" : "offline"}
        </span>
      )}
    </span>
  );
}
