"use client";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface HeroProps {
  eyebrow?: string;
  title: ReactNode;
  subtitle: ReactNode;
  ctas?: { label: string; href: string; variant?: "primary" | "ghost" }[];
}

/**
 * Marketing-grade hero for the docs landing. Animated gradient
 * background, gradient text fill, staggered fade-in on copy + CTAs.
 * Sized to feel "wide-screen first" but degrades to mobile (single
 * column, smaller type) via CSS clamp().
 */
export default function Hero({ eyebrow, title, subtitle, ctas = [] }: HeroProps) {
  return (
    <section
      style={{
        position: "relative",
        marginTop: "1.5rem",
        marginBottom: "3rem",
        padding: "clamp(2rem, 5vw, 4rem) clamp(1.25rem, 4vw, 3rem)",
        borderRadius: 20,
        overflow: "hidden",
        background:
          "radial-gradient(120% 80% at 0% 0%, rgba(167, 139, 250, 0.18), transparent 55%), radial-gradient(80% 100% at 100% 100%, rgba(94, 234, 212, 0.12), transparent 60%), #0a0a0a",
        border: "1px solid rgba(167, 139, 250, 0.2)",
        boxShadow:
          "0 30px 80px -30px rgba(167, 139, 250, 0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      <FloatingGrain />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 720 }}>
        {eyebrow && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 12px",
              borderRadius: 999,
              border: "1px solid rgba(167, 139, 250, 0.3)",
              background: "rgba(167, 139, 250, 0.08)",
              fontSize: 12,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#c4b5fd",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#a78bfa",
                boxShadow: "0 0 8px #a78bfa",
              }}
            />
            {eyebrow}
          </motion.div>
        )}

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          style={{
            marginTop: "1.25rem",
            marginBottom: "1rem",
            fontSize: "clamp(2.25rem, 5vw, 3.75rem)",
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.025em",
            backgroundImage:
              "linear-gradient(135deg, #f5f3ff 0%, #c4b5fd 40%, #f472b6 100%)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            color: "transparent",
            WebkitTextFillColor: "transparent",
          }}
        >
          {title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontSize: "clamp(0.95rem, 1.6vw, 1.125rem)",
            lineHeight: 1.6,
            color: "#a3a3a3",
            maxWidth: 560,
            margin: 0,
          }}
        >
          {subtitle}
        </motion.p>

        {ctas.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{
              marginTop: "1.75rem",
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            {ctas.map((c) => (
              <a
                key={c.href}
                href={c.href}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 18px",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 500,
                  textDecoration: "none",
                  transition: "transform 200ms ease, box-shadow 200ms ease",
                  ...(c.variant === "ghost"
                    ? {
                        color: "#e5e5e5",
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "rgba(255,255,255,0.02)",
                      }
                    : {
                        color: "#0a0a0a",
                        background:
                          "linear-gradient(135deg, #a78bfa 0%, #f472b6 100%)",
                        boxShadow:
                          "0 8px 24px -6px rgba(167, 139, 250, 0.5), inset 0 1px 0 rgba(255,255,255,0.2)",
                      }),
                }}
              >
                {c.label} <span aria-hidden>→</span>
              </a>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
}

/**
 * Subtle drifting grain overlay — gives the hero a hand-made quality
 * without distracting from the copy. Pure SVG, no images.
 */
function FloatingGrain() {
  return (
    <svg
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity: 0.18,
        mixBlendMode: "overlay",
        pointerEvents: "none",
      }}
    >
      <filter id="hero-noise">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.9"
          numOctaves="2"
          stitchTiles="stitch"
        />
        <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#hero-noise)" />
    </svg>
  );
}
