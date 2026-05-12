import { useState } from "react";
import {
  ProviderConfig,
  TokenCounter,
  CostCounter,
  WeightedTokenCounter,
  MessageCounter,
  BurnSparkline,
  TopUsers,
  TopModels,
  TopMachines,
  RecentActivity,
  LiveTicker,
  EmbedPulseDot,
  ModelLegend,
  MetricCard,
  StatGrid,
} from "@wigtoken-temp/widget";
import Section from "./components/Section.tsx";
import HeroExample from "./examples/HeroExample.tsx";
import ConfigBar, { type Config } from "./components/ConfigBar.tsx";

const DEFAULT_CONFIG: Config = {
  server:
    (import.meta as any).env?.VITE_DEMO_SERVER ?? "https://demo.wigtoken.dev",
  token: (import.meta as any).env?.VITE_DEMO_TOKEN ?? "we_demo_public",
  theme: "purple",
  density: "comfortable",
};

/**
 * Theme presets — each value is a set of CSS custom properties the
 * widget reads when its `theme` prop is "auto" (the default). We
 * apply them on the demo wrapper so every widget below picks up the
 * palette without each prop being threaded through.
 */
const THEME_VAR_MAP: Record<
  Config["theme"],
  Partial<Record<
    | "--wigtoken-accent"
    | "--wigtoken-fg"
    | "--wigtoken-muted"
    | "--wigtoken-surface"
    | "--wigtoken-border"
    | "--wigtoken-glow"
    | "--wigtoken-gradient",
    string
  >>
> = {
  purple: {
    "--wigtoken-accent": "#a78bfa",
    "--wigtoken-fg": "#f5f3ff",
    "--wigtoken-muted": "#a3a3a3",
    "--wigtoken-surface": "rgba(124, 58, 237, 0.04)",
    "--wigtoken-border": "rgba(167, 139, 250, 0.15)",
    "--wigtoken-glow": "rgba(167, 139, 250, 0.35)",
    "--wigtoken-gradient": "linear-gradient(135deg, #a78bfa 0%, #f472b6 100%)",
  },
  teal: {
    "--wigtoken-accent": "#5eead4",
    "--wigtoken-fg": "#ecfeff",
    "--wigtoken-muted": "#94a3b8",
    "--wigtoken-surface": "rgba(13, 148, 136, 0.04)",
    "--wigtoken-border": "rgba(94, 234, 212, 0.15)",
    "--wigtoken-glow": "rgba(94, 234, 212, 0.35)",
    "--wigtoken-gradient": "linear-gradient(135deg, #5eead4 0%, #38bdf8 100%)",
  },
  amber: {
    "--wigtoken-accent": "#fbbf24",
    "--wigtoken-fg": "#fefce8",
    "--wigtoken-muted": "#a8a29e",
    "--wigtoken-surface": "rgba(217, 119, 6, 0.04)",
    "--wigtoken-border": "rgba(251, 191, 36, 0.15)",
    "--wigtoken-glow": "rgba(251, 191, 36, 0.35)",
    "--wigtoken-gradient": "linear-gradient(135deg, #fbbf24 0%, #f97316 100%)",
  },
  mono: {
    "--wigtoken-accent": "#a3a3a3",
    "--wigtoken-fg": "#fafafa",
    "--wigtoken-muted": "#737373",
    "--wigtoken-surface": "rgba(115, 115, 115, 0.04)",
    "--wigtoken-border": "rgba(163, 163, 163, 0.15)",
    "--wigtoken-glow": "rgba(163, 163, 163, 0.25)",
    "--wigtoken-gradient": "linear-gradient(135deg, #d4d4d4 0%, #737373 100%)",
  },
  auto: {},
};

/**
 * When the URL has ?focus=<section-id>, we render in "embed mode":
 * no header, no ConfigBar, no footer, no Section chrome — just the
 * matching component group. Used by the docs site to inline live
 * previews per section without iframing the whole showcase.
 *
 * `?theme=<id>` also overrides the default theme when supplied, so
 * the docs Playground can swap themes via URL.
 */
function useUrlParams() {
  if (typeof window === "undefined") return { focus: null, theme: null };
  const sp = new URLSearchParams(window.location.search);
  return {
    focus: sp.get("focus"),
    theme: sp.get("theme") as Config["theme"] | null,
  };
}

export default function App() {
  const params = useUrlParams();
  const [cfg, setCfg] = useState<Config>(() => ({
    ...DEFAULT_CONFIG,
    theme: params.theme ?? DEFAULT_CONFIG.theme,
  }));
  const focus = params.focus;
  const embed = focus !== null;

  const themeVars = THEME_VAR_MAP[cfg.theme] ?? {};
  return (
    <div
      className={embed ? "p-4" : "min-h-screen"}
      style={themeVars as React.CSSProperties}
    >
      {!embed && (
        <header className="border-b border-neutral-900 px-8 py-5">
          <div className="mx-auto max-w-6xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-md bg-gradient-to-br from-purple-500 to-fuchsia-400" />
              <div>
                <div className="text-sm font-semibold">
                  wigtoken <span className="text-neutral-500">widget showcase</span>
                </div>
                <div className="text-[11px] uppercase tracking-wider text-neutral-500">
                  live components, 5 themes, 16+ widgets
                </div>
              </div>
            </div>
            <nav className="flex items-center gap-4 text-xs text-neutral-400">
              <a className="hover:text-neutral-200" href="https://github.com/wigtn/wigtoken">
                GitHub
              </a>
              <a className="hover:text-neutral-200" href="/wigtoken/">
                Docs
              </a>
              <a className="hover:text-neutral-200" href="https://www.npmjs.com/package/@wigtoken-temp/widget">
                npm
              </a>
            </nav>
          </div>
        </header>
      )}

      <div className={embed ? "" : "mx-auto max-w-6xl px-8 py-8"}>
        {!embed && <ConfigBar config={cfg} onChange={setCfg} />}

        <ProviderConfig
          server={cfg.server}
          token={cfg.token}
        >
          <Section
            id="hero"
            title="Hero composition"
            blurb="What this looks like on a real marketing site, end-to-end."
            code={`<StatGrid>
  <MetricCard label="Tokens (weighted)" value={<WeightedTokenCounter />} />
  <MetricCard label="Cost" value={<CostCounter />} />
  <MetricCard label="Messages" value={<MessageCounter />} />
  <MetricCard label="Status" value={<EmbedPulseDot />} />
</StatGrid>
<BurnSparkline range="24h" />`}
          >
            <HeroExample />
          </Section>

          <Section
            id="counters"
            title="Counters"
            blurb="Animated count-up. Re-renders on every SSE update."
            code={`<TokenCounter />
<TokenCounter mode="weighted" />
<CostCounter />
<MessageCounter />`}
          >
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Tokens (raw)" value={<TokenCounter />} />
              <MetricCard
                label="Tokens (weighted)"
                value={<WeightedTokenCounter />}
              />
              <MetricCard label="Cost USD" value={<CostCounter />} />
              <MetricCard label="Messages" value={<MessageCounter />} />
            </div>
          </Section>

          <Section
            id="sparkline"
            title="Burn sparkline"
            blurb="SVG-only, no chart dependency. Configurable range."
            code={`<BurnSparkline range="1h" />
<BurnSparkline range="24h" />
<BurnSparkline range="7d" />`}
          >
            <div className="grid gap-4 md:grid-cols-3">
              <BurnSparkline range="1h" />
              <BurnSparkline range="24h" />
              <BurnSparkline range="7d" />
            </div>
          </Section>

          <Section
            id="rankings"
            title="Leaderboards"
            blurb="Top-N grouped by user, model family, or machine."
            code={`<TopUsers limit={5} />
<TopModels limit={5} />
<TopMachines limit={5} />`}
          >
            <div className="grid gap-4 md:grid-cols-3">
              <TopUsers limit={5} />
              <TopModels limit={5} />
              <TopMachines limit={5} />
            </div>
          </Section>

          <Section
            id="activity"
            title="Live activity"
            blurb="RecentActivity polls; LiveTicker streams via SSE."
            code={`<RecentActivity limit={6} />
<LiveTicker />`}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <RecentActivity limit={6} />
              <LiveTicker />
            </div>
          </Section>

          <Section
            id="status"
            title="Status & legend"
            blurb="Quick visual cues for SSE health and model-family colour mapping."
            code={`<EmbedPulseDot size={6} />
<EmbedPulseDot size={10} />
<EmbedPulseDot size={14} withLabel />
<ModelLegend />`}
          >
            <div className="space-y-4">
              <div className="flex items-center gap-6">
                <EmbedPulseDot size={6} />
                <EmbedPulseDot size={10} />
                <EmbedPulseDot size={14} withLabel />
              </div>
              <ModelLegend />
            </div>
          </Section>

          <Section
            id="layout"
            title="Layout primitives"
            blurb="StatGrid wraps cards in a responsive 2/4-col grid."
            code={`<StatGrid>
  <MetricCard label="…" value="…" />
  …
</StatGrid>`}
          >
            <StatGrid>
              <MetricCard label="Today" value="12,418" sub="+8%" />
              <MetricCard label="This week" value="68,201" sub="+22%" />
              <MetricCard label="This month" value="284,910" sub="+11%" />
              <MetricCard label="All time" value="1.2M" />
            </StatGrid>
          </Section>
        </ProviderConfig>

        {!embed && (
          <footer className="mt-16 border-t border-neutral-900 pt-6 text-xs text-neutral-500">
            MIT licensed — fork it, theme it, ship it.
          </footer>
        )}
      </div>
    </div>
  );
}
