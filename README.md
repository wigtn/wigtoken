# wigtoken

Self-host aggregator for [Claude Code](https://claude.com/claude-code) token usage. Watches the JSONL transcripts Claude Code writes locally, runs them through a single SQLite store with per-user / per-machine / per-model labels, and exposes:

- **Public SSE counter** — drop a single live number on a marketing page (`/api/usage/totals`, `/api/usage/stream`)
- **Prometheus `/metrics`** — labelled counters for Grafana dashboards
- **Authenticated ingestion API** — agents on remote dev machines push their own transcripts in (`POST /api/ingest/messages`)

Works for one developer on a laptop (zero-config) and for a team of N machines, with the same binary.

## Quickstart — solo

You're a single developer; just want a personal cost dashboard for your own Claude Code usage.

```bash
git clone https://github.com/wigtn/wigtoken
cd wigtoken
npm install
npm start
```

That's it. The daemon picks up `~/.claude/projects` automatically and starts on `http://localhost:10103`.

```bash
curl http://localhost:10103/api/usage/totals | jq
curl http://localhost:10103/metrics
```

Point a Grafana → Prometheus stack at `localhost:10103` and import [`grafana/dashboard.json`](./grafana/README.md) for the full breakdown. Or just open the JSON endpoints in a browser.

## Quickstart — team

You have multiple developers on multiple machines and want one consolidated view.

1. **Run the server somewhere reachable** (Linux box, NAS, container in your cluster):

   ```bash
   docker run -d --name wigtoken \
     -p 10103:10103 \
     -e MODE=team \
     -e ALLOWED_ORIGINS=https://your-site.com \
     -v $PWD/data:/data/db \
     ghcr.io/wigtn/wigtoken:latest
   ```

   Or use [`docker-compose.example.yml`](./docker-compose.example.yml).

2. **Issue an admin bootstrap token** (printed once on first run) and use it to mint per-developer ingest tokens:

   ```bash
   ADMIN=wts_xxx
   curl -X POST https://your-server/api/admin/tokens \
     -H "Authorization: Bearer $ADMIN" \
     -H "Content-Type: application/json" \
     -d '{"user":"alice","scope":"ingest","label":"alice-laptop"}'
   ```

3. **Each developer runs the agent** on their machine:

   ```bash
   npx @wigtoken-temp/agent \
     --server https://your-server \
     --token wts_alice_token \
     --machine $(hostname)
   ```

   Or as a launchd / systemd service — see [`agent/README.md`](./agent/README.md).

The agent watches `~/.claude/projects` on each machine and streams new messages over HTTPS. Server-side dedupe by `message_id` makes it safe to restart, retry, or run multiple agents against the same transcripts.

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│   ┌─────────────┐ scrape ┌──────────────┐ → ┌──────────┐   │
│   │ wigtoken │←──────│ Prometheus   │ →│ Grafana  │   │
│   │   server    │        └──────────────┘   └──────────┘   │
│   │             │                                          │
│   │ /api/ingest │←── HTTPS+Bearer ──┐                       │
│   │ /api/usage/*│                   │                       │
│   │ /metrics    │←── public reads ──┐│                      │
│   │ SQLite      │                   ││                      │
│   └─────────────┘                   ││                      │
└─────────────────────────────────────┼┼──────────────────────┘
                                      ││
                                      ││
┌────────────────┐ ┌────────────────┐ │ ┌──────────────────┐
│  agent (mac)   │ │ agent (linux)  │ │ │ public web hero  │
│ ~/.claude/...  │ │ ~/.claude/...  │ │ │ counter          │
│ → push batches │ │ → push batches │ │ └──────────────────┘
└────────┬───────┘ └────────┬───────┘ │
         └──────────────────┴─────────┘
                  per-user tokens
```

For solo: agent and server run as one process on the same box, no token, no HTTPS.

## Two ways to push from a developer machine

Both end up calling `POST /api/ingest/messages` with an ingest-scope bearer token; you pick the trade-off:

| | Agent | Hook |
|---|---|---|
| Footprint | LaunchAgent / systemd unit running `@wigtoken-temp/agent` | one block in `~/.claude/settings.json` |
| Offline retry | ✅ disk queue + backoff | ❌ one-shot POST per turn |
| Setup | npm install + token + plist | settings.json edit |
| Best for | shared/public networks, critical usage | trusted networks, quick demos |

Full hook walkthrough → [docs/HOOKS.md](./docs/HOOKS.md). Agent → [`agent/README.md`](./agent/README.md).

## API

### Public (no auth)

| Method | Path | Notes |
|---|---|---|
| `GET` | `/health` | Liveness probe |
| `GET` | `/api/usage/totals` | Single-snapshot JSON — drives the hero counter |
| `GET` | `/api/usage/stream` | SSE stream; pushes a `totals` event whenever new tokens land |
| `GET` | `/api/usage/breakdown` | JSON view of the per-label breakdown the metrics endpoint exposes |
| `GET` | `/metrics` | Prometheus exposition; labels: `user`, `machine`, `model`, `model_family`, `kind` |

### Authenticated (`Authorization: Bearer <token>`)

| Method | Path | Required scope |
|---|---|---|
| `POST` | `/api/ingest/messages` | `ingest` |
| `GET` | `/api/admin/tokens` | `admin` |
| `POST` | `/api/admin/tokens` | `admin` |
| `DELETE` | `/api/admin/tokens/:id` | `admin` |
| `GET` | `/api/admin/audit` | `admin` |

`admin` scope implicitly satisfies any other scope.

## Configuration

Every knob is an environment variable; flags are on the agent side only. See [`.env.example`](./.env.example) for the full list. Highlights:

| Var | Default | Purpose |
|---|---|---|
| `MODE` | auto-detected | `solo` or `team` |
| `CLAUDE_PROJECTS_DIR` | `~/.claude/projects` | Where to watch (solo) or the multi-tenant root (team) |
| `STATS_DB_PATH` | `<repo>/data/stats.db` | SQLite location |
| `PORT` | `10103` | HTTP port |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | CORS allowlist |
| `WATCH_POLLING` | `true` | Force chokidar polling — `false` on native Linux/macOS for fsevents |
| `SCAN_INTERVAL_MS` | `5000` | Backup readdir walk |

### Solo vs team mode

The daemon auto-detects from `CLAUDE_PROJECTS_DIR`'s top-level layout:

- Subdirectories starting with `-` (Claude Code's `-encoded-cwd/` pattern) → **solo**
- Subdirectories that look like usernames (no leading dash) → **team**

`MODE=solo|team` overrides the heuristic.

## Cost model

Costs are estimated against Anthropic's [public per-token rates](https://www.anthropic.com/pricing). All values flow from one rate table in [`src/pricing.ts`](./src/pricing.ts):

| Family | input | cache_creation | cache_read | output |
|---|---:|---:|---:|---:|
| Opus 4.x | $15 / Mtok | $18.75 | $1.50 | $75 |
| Sonnet 4.x | $3 | $3.75 | $0.30 | $15 |
| Haiku 4.5 | $0.80 | $1.00 | $0.08 | $4 |

The input-equivalent weight (used for `wigtn_tokens_weighted_total`) follows the input-relative ratios — `1 : 1.25 : 0.1 : 5`, identical across families.

> **These are estimates, not your bill.** Max-plan flat-rate users won't pay the USD numbers shown here; the metric is for relative comparison and waste-spotting, not accounting.

## Privacy

- The daemon stores **counts**, **model identifiers**, and **message IDs**. Message bodies are never persisted — `parseLine()` doesn't even read them.
- The agent ships only what's already in the request payload schema (`agent/src/parser.ts`); same guarantee.
- `/api/admin/audit` records every ingest call with token id, IP, byte count — stored in the same SQLite file, no remote logs.

## Security

- HTTPS strongly recommended for any non-loopback deployment. The daemon itself binds plain HTTP — terminate TLS at nginx, Caddy, or Cloudflare.
- Bearer tokens are 256-bit random; only the SHA-256 hash is on disk.
- `ingest`-scope tokens can only forge data under their own user label (the user is taken from the token, never from the payload).
- Per-token rate limit defaults to ~100 req/min sustained; raise it for noisy CI.

## Development

```bash
npm install
npm run dev          # hot-reload via tsx watch
npm run typecheck    # tsc --noEmit
```

Single-file modules; deliberately no build step. The agent is a separate package under `agent/` with its own `package.json`.

## License

[MIT](./LICENSE).
