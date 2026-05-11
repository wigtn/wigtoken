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
} from "@wigtoken/widget";
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

export default function App() {
  const [cfg, setCfg] = useState<Config>(DEFAULT_CONFIG);

  return (
    <div className="min-h-screen">
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
            <a className="hover:text-neutral-200" href="https://www.npmjs.com/package/@wigtoken/widget">
              npm
            </a>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-8 py-8">
        <ConfigBar config={cfg} onChange={setCfg} />

        <ProviderConfig
          server={cfg.server}
          token={cfg.token}
          theme={cfg.theme}
          density={cfg.density}
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
<BurnSparkline window="24h" />`}
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
            blurb="SVG-only, no chart dependency. Configurable window."
            code={`<BurnSparkline window="1h" />
<BurnSparkline window="24h" />
<BurnSparkline window="7d" />`}
          >
            <div className="grid gap-4 md:grid-cols-3">
              <BurnSparkline window="1h" height={64} />
              <BurnSparkline window="24h" height={64} />
              <BurnSparkline window="7d" height={64} />
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
            code={`<EmbedPulseDot size="sm" />
<EmbedPulseDot size="md" />
<EmbedPulseDot size="lg" />
<ModelLegend />`}
          >
            <div className="space-y-4">
              <div className="flex items-center gap-6">
                <EmbedPulseDot size="sm" />
                <EmbedPulseDot size="md" />
                <EmbedPulseDot size="lg" />
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
              <MetricCard label="Today" value="12,418" delta="+8%" />
              <MetricCard label="This week" value="68,201" delta="+22%" />
              <MetricCard label="This month" value="284,910" delta="+11%" />
              <MetricCard label="All time" value="1.2M" />
            </StatGrid>
          </Section>
        </ProviderConfig>

        <footer className="mt-16 border-t border-neutral-900 pt-6 text-xs text-neutral-500">
          MIT licensed — fork it, theme it, ship it.
        </footer>
      </div>
    </div>
  );
}
