/**
 * Stub network layer for the showcase. When the configured server is
 * the default placeholder (`demo.wigtoken.dev`), we intercept fetch
 * and EventSource calls and return realistic-looking fixture data so
 * the components render without network errors.
 *
 * If the user (or a CI env) sets VITE_DEMO_SERVER to a real wigtoken
 * server, this passes through to the real network.
 */

const PLACEHOLDER_HOST = "demo.wigtoken.dev";

function isPlaceholder(url: string): boolean {
  try {
    return new URL(url, window.location.origin).host === PLACEHOLDER_HOST;
  } catch {
    return false;
  }
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// ─── Fixtures ──────────────────────────────────────────────────────
const NOW = Date.now();

const TOTALS = {
  input: 1834521,
  cacheCreation: 845231,
  cacheRead: 9234123,
  output: 423567,
  sum: 12337442,
  messages: 8421,
  costUsd: 247.83,
};

const USERS = [
  { key: "alice", messages: 2841, costUsd: 88.42, weightedInputEq: 4123412 },
  { key: "bob", messages: 1923, costUsd: 62.18, weightedInputEq: 2934512 },
  { key: "carol", messages: 1402, costUsd: 41.93, weightedInputEq: 1893421 },
  { key: "dave", messages: 1218, costUsd: 31.04, weightedInputEq: 1421983 },
  { key: "eve", messages: 1037, costUsd: 24.26, weightedInputEq: 964114 },
];

const MODELS = [
  { key: "opus", messages: 3214, costUsd: 168.92, weightedInputEq: 6234123 },
  { key: "sonnet", messages: 4012, costUsd: 71.04, weightedInputEq: 4892341 },
  { key: "haiku", messages: 1195, costUsd: 7.87, weightedInputEq: 1210978 },
];

const MACHINES = [
  { key: "alice-mbp", messages: 2102, costUsd: 64.31, weightedInputEq: 3142123 },
  { key: "macmini-1", messages: 3924, costUsd: 124.83, weightedInputEq: 5293421 },
  { key: "bob-thinkpad", messages: 1421, costUsd: 39.87, weightedInputEq: 2123456 },
  { key: "carol-mbp", messages: 974, costUsd: 18.82, weightedInputEq: 1778442 },
];

const MODEL_NAMES = [
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
];

function recentMessages(limit = 50) {
  const out = [];
  for (let i = 0; i < limit; i++) {
    const m = i % 3;
    out.push({
      user: USERS[i % USERS.length].key,
      machine: MACHINES[i % MACHINES.length].key,
      model: MODEL_NAMES[m],
      modelFamily: ["opus", "sonnet", "haiku"][m],
      inputTokens: 320 + (i * 37) % 800,
      cacheCreation: i % 4 === 0 ? 1200 + (i * 19) % 600 : 0,
      cacheRead: 4000 + (i * 211) % 12000,
      outputTokens: 240 + (i * 53) % 700,
      costUsd: 0.018 + ((i * 7) % 30) / 100,
      weightedInputEq: 1400 + (i * 311) % 8000,
      ts: NOW - i * 28_000,
    });
  }
  return out;
}

function timeseries(from: number, to: number, step: number) {
  const buckets = [];
  for (let t = from; t < to; t += step) {
    const phase = ((t - from) / step) % 24;
    const burst = 1 + Math.sin(phase / 3) * 0.7 + Math.random() * 0.3;
    buckets.push({
      ts: t,
      messages: Math.round(40 * burst),
      tokensRaw: Math.round(180_000 * burst),
      tokensWeighted: Math.round(220_000 * burst),
      costUsd: 3.4 * burst,
    });
  }
  return buckets;
}

// ─── Fetch interception ────────────────────────────────────────────
const realFetch = window.fetch.bind(window);

window.fetch = async function patchedFetch(input, init) {
  const urlStr =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;

  if (!isPlaceholder(urlStr)) {
    return realFetch(input as any, init);
  }

  const u = new URL(urlStr);
  const p = u.pathname;

  if (p === "/embed/totals" || p === "/api/usage/totals") {
    return json({ totals: TOTALS, timestamp: NOW });
  }

  if (p === "/api/usage/leaderboard") {
    const by = u.searchParams.get("by") ?? "user";
    const limit = Number(u.searchParams.get("limit") ?? 10);
    const table = by === "model_family" ? MODELS : by === "machine" ? MACHINES : USERS;
    return json({ by, entries: table.slice(0, limit) });
  }

  if (p === "/api/usage/timeseries") {
    const from = Number(u.searchParams.get("from") ?? NOW - 24 * 3600_000);
    const to = Number(u.searchParams.get("to") ?? NOW);
    const step = Number(u.searchParams.get("step") ?? 3600_000);
    return json({ from, to, step, buckets: timeseries(from, to, step) });
  }

  if (p === "/api/usage/recent") {
    const limit = Number(u.searchParams.get("limit") ?? 50);
    return json({ entries: recentMessages(limit) });
  }

  if (p.startsWith("/api/usage/users/")) {
    const name = decodeURIComponent(p.slice("/api/usage/users/".length));
    return json({
      user: name,
      totals: { messages: 2841, costUsd: 88.42, weightedInputEq: 4123412 },
      perFamily: MODELS.map(({ key, messages, costUsd, weightedInputEq }) => ({
        modelFamily: key,
        messages: Math.round(messages / 3),
        costUsd: costUsd / 3,
        weightedInputEq: Math.round(weightedInputEq / 3),
      })),
      perMachine: MACHINES.slice(0, 2).map(({ key, messages, costUsd }) => ({
        machine: key,
        messages: Math.round(messages / 2),
        costUsd: costUsd / 2,
      })),
    });
  }

  // Unknown paths under the placeholder host — return empty 200 to
  // avoid layout-breaking errors.
  return json({});
};

// ─── EventSource interception ──────────────────────────────────────
const RealEventSource = window.EventSource;

class MockEventSource extends EventTarget {
  url: string;
  readyState = 1;
  withCredentials = false;
  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  private timer: number;

  constructor(url: string | URL) {
    super();
    this.url = url.toString();
    // Push a fresh "totals updated" event every 6s so the UI feels
    // alive — counters tick, LiveTicker prepends, pulse stays green.
    this.timer = window.setInterval(() => this.emit(), 6000);
    setTimeout(() => this.emit(), 200);
  }

  private emit() {
    const event = new MessageEvent("message", {
      data: JSON.stringify({
        totals: {
          ...TOTALS,
          sum: TOTALS.sum + Math.floor(Math.random() * 8000),
          messages: TOTALS.messages + Math.floor(Math.random() * 5),
          costUsd: TOTALS.costUsd + Math.random() * 0.4,
        },
        timestamp: Date.now(),
      }),
    });
    this.onmessage?.(event);
    this.dispatchEvent(event);
  }

  close() {
    this.readyState = 2;
    window.clearInterval(this.timer);
  }
}

window.EventSource = new Proxy(RealEventSource, {
  construct(target, args) {
    const url = String(args[0] ?? "");
    if (isPlaceholder(url)) {
      return new MockEventSource(args[0] as string | URL) as unknown as EventSource;
    }
    return new target(...(args as [string | URL, EventSourceInit?]));
  },
}) as typeof EventSource;

// eslint-disable-next-line no-console
console.info(
  "[wigtoken demo] mock backend active for",
  PLACEHOLDER_HOST,
  "— set VITE_DEMO_SERVER to point at a real server."
);
