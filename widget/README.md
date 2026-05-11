# @wigtoken-temp/widget

React components that embed live token-usage counters from a [wigtoken](https://github.com/wigtn/wigtoken) server on any page.

```tsx
import {
  ProviderConfig,
  TokenCounter,
  CostCounter,
  WeightedTokenCounter,
} from "@wigtoken-temp/widget";

export default function HeroSection() {
  return (
    <ProviderConfig
      server="https://token.your-company.com"
      token={import.meta.env.PUBLIC_WIGTN_EMBED_TOKEN}
    >
      <TokenCounter style="hero" />
    </ProviderConfig>
  );
}
```

The counter animates up in real time as new messages stream in from any agent / hook / file-watcher attached to your wigtoken server. No polling boilerplate, no chart library, no peer dependency beyond React.

## Install

```bash
npm install @wigtoken-temp/widget
# peer deps:
npm install react react-dom
```

## How it works

`<ProviderConfig>` opens a single SSE connection to `${server}/embed/stream?token=…` and keeps the descendant tree updated through React context. The token must be:

1. **Embed scope** — issued from `/admin/tokens` on your server with `scope: "embed"`.
2. **Used from a registered origin** — add your site's URL in `/admin/embeds` first; the server's CORS gate rejects unknown origins even when the token is valid.

If SSE fails (e.g. behind a buffering proxy), `<ProviderConfig poll>` falls back to plain polling.

## Components

### `<ProviderConfig>`

```tsx
<ProviderConfig
  server="https://token.example.com"
  token="emb_…"
  poll={false}          // optional, force polling
  pollIntervalMs={30000}
>
  {children}
</ProviderConfig>
```

| Prop | Type | Default | Notes |
|---|---|---|---|
| `server` | `string` | required | Base URL, no trailing slash needed |
| `token` | `string` | required | Embed-scope bearer token |
| `poll` | `boolean` | `false` | Skip SSE, poll `/embed/totals` instead |
| `pollIntervalMs` | `number` | `30000` | Poll interval when `poll` is true |

### `<TokenCounter>`

```tsx
<TokenCounter
  style="hero" | "minimal" | "full"   // default: hero
  metric="weighted" | "raw" | "messages"  // default: weighted
  label="tokens processed by the crew"
  formatter={(n) => `${(n/1e6).toFixed(1)}M`}
  durationMs={1400}
  containerStyle={{ color: "#a78bfa" }}
  className="my-tailwind-class"
/>
```

| `style` | What it renders |
|---|---|
| `hero` | Large count-up + small uppercase label |
| `minimal` | Single inline span, no label |
| `full` | Hero variant + estimated cost & message count sub-line |

### `<CostCounter>`

```tsx
<CostCounter
  style="hero" | "minimal"   // default: hero
  currency="$"               // default
  precision={2}
  label="estimated cost"
/>
```

### `<WeightedTokenCounter>`

Convenience wrapper for `<TokenCounter metric="weighted" />`.

### `useTotals()`

Hook for users who want raw access to the live totals (build your own visualisation):

```tsx
import { useTotals } from "@wigtoken-temp/widget";

function Custom() {
  const t = useTotals();
  return <span>{t.messages.toLocaleString()} messages so far</span>;
}
```

## Styling

Components ship with **inline styles** — no Tailwind required, no stylesheet to import, no CSS conflicts on host pages. Override with either:

- `containerStyle={...}` — merged into the outer wrapper
- `className="..."` — passed through, lets Tailwind / styled-components users keep their own conventions

The default palette uses `color: currentColor` so the counter inherits text color from the surrounding context (works on dark/light pages out of the box).

## Bundle size

Built with `tsup`, dual ESM/CJS, tree-shakeable. The full widget set is ~6 KB gzipped. React is a peer dep, not bundled.

## Privacy

Same guarantee as the server: **no message content is ever sent over the wire**. The widget only displays counts and the estimated-cost number computed server-side.

## License

[MIT](./LICENSE)
