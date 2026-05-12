"use client";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

export interface Feature {
  icon?: ReactNode;
  title: string;
  body: string;
  accent?: string;
}

interface FeatureGridProps {
  features: Feature[];
}

/**
 * Responsive 1→2→3-col feature grid. Each card has a subtle accent
 * glow on hover (matches the widget's MetricCard vibe) and animates
 * in with a stagger.
 */
export default function FeatureGrid({ features }: FeatureGridProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
        gap: 16,
        margin: "2rem 0",
      }}
    >
      {features.map((f, i) => (
        <FeatureCard key={f.title} feature={f} index={i} />
      ))}
    </div>
  );
}

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const accent = feature.accent ?? "#a78bfa";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{
        y: -3,
        boxShadow: `0 12px 40px -10px ${accent}55`,
      }}
      style={{
        position: "relative",
        padding: "1.25rem",
        borderRadius: 14,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.08)",
        overflow: "hidden",
        transition: "border-color 200ms ease",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent 0%, ${accent} 50%, transparent 100%)`,
          opacity: 0.5,
        }}
      />
      {feature.icon && (
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: `${accent}1a`,
            border: `1px solid ${accent}40`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 12,
            color: accent,
          }}
        >
          {feature.icon}
        </div>
      )}
      <h3
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: "#fafafa",
        }}
      >
        {feature.title}
      </h3>
      <p
        style={{
          margin: "6px 0 0 0",
          fontSize: 13.5,
          lineHeight: 1.55,
          color: "#a3a3a3",
        }}
      >
        {feature.body}
      </p>
    </motion.div>
  );
}
