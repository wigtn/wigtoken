import { useEffect, useState, type CSSProperties } from "react";
import { useWigtnContext } from "./ProviderConfig";

export interface EmbedPulseDotProps {
  size?: number;
  /** When true, shows the relative time of the last update next to the dot. */
  withLabel?: boolean;
  /** Override colours. */
  connectedColor?: string;
  disconnectedColor?: string;
  containerStyle?: CSSProperties;
  className?: string;
}

/**
 * Connection-status indicator. Renders a small coloured dot that pulses
 * for ~400ms whenever a new totals payload arrives, and switches to a
 * dim grey when SSE drops.
 */
export function EmbedPulseDot({
  size = 8,
  withLabel = false,
  connectedColor = "var(--wigtoken-accent, #7c3aed)",
  disconnectedColor = "#a3a3a3",
  containerStyle,
  className,
}: EmbedPulseDotProps) {
  const { isConnected, lastUpdate } = useWigtnContext();
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!lastUpdate) return;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 400);
    return () => clearTimeout(t);
  }, [lastUpdate]);

  const color = isConnected ? connectedColor : disconnectedColor;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        ...containerStyle,
      }}
      className={className}
    >
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: size,
          height: size,
          borderRadius: "50%",
          background: color,
          transform: pulse ? "scale(1.6)" : "scale(1)",
          boxShadow: pulse
            ? `0 0 0 6px color-mix(in srgb, ${color} 20%, transparent)`
            : "none",
          transition:
            "transform 240ms ease-out, box-shadow 240ms ease-out, background-color 200ms",
        }}
      />
      {withLabel && (
        <span style={{ fontSize: "0.6875rem", opacity: 0.7 }}>
          {isConnected ? "live" : "offline"}
        </span>
      )}
    </span>
  );
}
