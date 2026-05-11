# wigtoken widget showcase

Vite + React app that renders every component from `@wigtoken/widget`
against a configurable server. Useful for screenshots, theme tuning,
and as a "buy" page link from the docs site.

## Dev

```bash
cd demo
npm install
VITE_DEMO_SERVER=https://your-server VITE_DEMO_TOKEN=we_… npm run dev
# http://localhost:4577
```

The local widget package is consumed via `file:../widget`. If you change
widget source, run `npm run build` in `widget/` to refresh the bundle
that the demo consumes.

## Build

```bash
npm run build              # → demo/dist/
DEMO_BASE_PATH=/wigtoken/demo npm run build   # for GitHub Pages sub-path
```

## What's covered

- Hero composition (Counter + Sparkline + StatGrid)
- All four counters with raw & weighted modes
- BurnSparkline at 1h, 24h, 7d
- TopUsers / TopModels / TopMachines
- RecentActivity + LiveTicker
- EmbedPulseDot sizes
- ModelLegend
- StatGrid + MetricCard with `delta` prop
- Theme switcher (purple, teal, amber, mono, auto)
- Density toggle (compact, comfortable)
