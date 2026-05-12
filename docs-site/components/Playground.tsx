"use client";
import { useState, useMemo } from "react";

const THEMES = ["purple", "teal", "amber", "mono"] as const;
type Theme = (typeof THEMES)[number];

const SECTIONS = [
  { id: "hero", label: "Hero", height: 480 },
  { id: "counters", label: "Counters", height: 220 },
  { id: "sparkline", label: "Sparkline", height: 180 },
  { id: "rankings", label: "Leaderboards", height: 300 },
  { id: "activity", label: "Activity", height: 280 },
  { id: "status", label: "Status", height: 200 },
  { id: "layout", label: "Layout", height: 220 },
];

const THEME_SWATCH: Record<Theme, string> = {
  purple: "linear-gradient(135deg, #a78bfa, #f472b6)",
  teal: "linear-gradient(135deg, #5eead4, #38bdf8)",
  amber: "linear-gradient(135deg, #fbbf24, #f97316)",
  mono: "linear-gradient(135deg, #d4d4d4, #737373)",
};

interface Props {
  basePath?: string;
  defaultSection?: string;
  defaultTheme?: Theme;
}

/**
 * Interactive playground that lets readers swap theme and component
 * group on a live <iframe> embed of the demo site. The demo's App.tsx
 * reads ?theme= and ?focus= from the URL, so we just rebuild the src
 * when state changes — no postMessage plumbing needed.
 */
export default function Playground({
  basePath = "/wigtoken",
  defaultSection = "hero",
  defaultTheme = "purple",
}: Props) {
  const [theme, setTheme] = useState<Theme>(defaultTheme);
  const [section, setSection] = useState(defaultSection);

  const meta = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];
  const src = useMemo(
    () => `${basePath}/demo/?focus=${section}&theme=${theme}`,
    [basePath, section, theme]
  );

  return (
    <div
      style={{
        marginTop: "1.5rem",
        marginBottom: "1.5rem",
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(0,0,0,0.4)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
          padding: "10px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              style={{
                padding: "5px 10px",
                borderRadius: 8,
                border: "1px solid",
                borderColor:
                  section === s.id
                    ? "rgba(167, 139, 250, 0.6)"
                    : "rgba(255,255,255,0.08)",
                background:
                  section === s.id
                    ? "rgba(167, 139, 250, 0.12)"
                    : "transparent",
                color: section === s.id ? "#c4b5fd" : "#a3a3a3",
                fontSize: 12,
                cursor: "pointer",
                transition: "all 160ms ease",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {THEMES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              aria-label={`theme ${t}`}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: THEME_SWATCH[t],
                border: theme === t ? "2px solid #fff" : "2px solid rgba(255,255,255,0.15)",
                cursor: "pointer",
                transition: "transform 160ms ease, border-color 160ms ease",
                transform: theme === t ? "scale(1.05)" : "scale(1)",
              }}
            />
          ))}
        </div>
      </div>

      <iframe
        key={src}
        src={src}
        title={`${section} playground`}
        loading="lazy"
        style={{
          width: "100%",
          height: meta.height,
          border: "none",
          display: "block",
          background: "#0a0a0a",
        }}
      />

      <div
        style={{
          padding: "8px 14px",
          fontSize: 11,
          color: "#737373",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(255,255,255,0.01)",
        }}
      >
        <span>
          Theme: <code style={{ color: "#c4b5fd" }}>{theme}</code> · Section:{" "}
          <code style={{ color: "#c4b5fd" }}>{section}</code>
        </span>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#737373", textDecoration: "underline" }}
        >
          open in new tab ↗
        </a>
      </div>
    </div>
  );
}
