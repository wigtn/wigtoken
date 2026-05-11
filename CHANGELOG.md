# Changelog

All notable changes here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-05-12

First public release.

### Added

- **Server** (Node + Hono + SQLite). Watches `~/.claude/projects/*.jsonl` (Solo) or a shared multi-tenant root (Team), de-duplicates messages by id, computes per-model USD cost + input-equivalent weighted totals, and persists to SQLite.
- **Public read API**: `/health`, `/api/usage/totals`, `/api/usage/stream` (SSE).
- **Authenticated API** with Bearer-token scopes (`ingest` / `read` / `admin` / `embed`):
  - `POST /api/ingest/messages` for distributed agents to push usage records.
  - `GET /api/usage/{breakdown,breakdown.csv,timeseries,leaderboard,recent,users/:name}` for analytics.
  - `GET /metrics` Prometheus exporter (`wigtn_tokens_total{user,machine,model,model_family,kind}` etc.).
  - `GET|POST|DELETE /api/admin/{tokens,embed-origins,audit}`.
- **Embed-scope API**: `/embed/totals`, `/embed/stream` — two-layer security with CORS origin allow-list (`embed_origins` table, managed via admin UI) + bearer token.
- **Operator dashboard** (`web/`) — Vite + React 19 + Tailwind, served as static assets from `./public`. Routes: Overview, Users, Models, Machines, Timeseries, Sessions, plus Admin (Tokens, Embeds, Audit). Sidebar TokenGate for setting the bearer token.
- **Agent** (`agent/`) — cross-platform Node CLI (`@wigtoken-temp/agent`) that watches `~/.claude/projects` on developer machines, batches assistant messages, and pushes via `/api/ingest/messages` with an on-disk offline queue.
- **Widget package** (`widget/`) — publishable React library (`@wigtoken-temp/widget`) with `<ProviderConfig>`, `<TokenCounter>`, `<CostCounter>`, `<WeightedTokenCounter>` and a `useTotals()` hook. Tree-shakeable, ESM + CJS dual, ~7 KB gzipped.
- **Claude Code hook** alternative to the agent — documented in `docs/HOOKS.md`. One block in `~/.claude/settings.json` pushes every turn via `curl` + `jq`.
- **Multi-tenant scripts** (`scripts/`) — `setup-data-root.sh`, `setup-user-symlinks.sh` for single-host deployments where multiple OS users share one server.
- **Grafana dashboard** template (`grafana/dashboard.json`) — kept for operators who already run Prometheus + Grafana and prefer those over the bundled web UI.
- **PRD** (`docs/PRD.md`) — captures the open-source vision (solo + team + org tiers, self-hosted web UI, embed widget, hook alternative).
- **Docker** — minimal `Dockerfile` plus `docker-compose.example.yml`.

### Security

- Bearer tokens stored only as SHA-256 hashes.
- Per-token user label is enforced server-side on ingest — a leaked ingest token can only forge data under its own user.
- Origin allow-list on the CORS layer (env `ALLOWED_ORIGINS` + `embed_origins` table).
- Per-token rate limiting (~100 req/min sustained, configurable).
- Audit log for every ingest call, token issue/revoke, embed-origin change, and auth failure.

### Notes

- This release targets Claude Code only. Codex / Cursor support is on the roadmap (PRD §4 non-goal for v1).
- Cost numbers are estimates against Anthropic's public per-token rates; users on flat-rate Max plans will see USD numbers that don't match their bill.

[Unreleased]: https://github.com/wigtn/wigtoken/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/wigtn/wigtoken/releases/tag/v0.1.0
