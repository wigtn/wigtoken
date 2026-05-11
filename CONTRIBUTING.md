# Contributing

Thanks for digging into wigtoken. Here's the short version.

## Repo layout

```
/                # server (Node + Hono + SQLite)
  src/           # daemon code
  public/        # built operator dashboard (generated; gitignored)
  data/          # SQLite + WAL files (generated; gitignored)
  Dockerfile
  docker-compose.example.yml
agent/           # @wigtoken-temp/agent  (cross-platform CLI)
widget/          # @wigtoken-temp/widget (React components)
web/             # operator dashboard SPA (Vite + React + Tailwind)
docs/            # PRD.md, HOOKS.md, …
grafana/         # legacy Grafana dashboard template
scripts/         # multi-tenant host setup helpers
.github/workflows/
                 # deploy.yml (push to main), release.yml (tags)
```

Each package has its own `package.json` and is published separately. The dashboard SPA isn't a published package — it builds into `public/` and the server serves it.

## Local dev loop

Run the daemon and the dashboard against each other:

```bash
# terminal 1
npm install
npm run dev                 # http://localhost:10103

# terminal 2
cd web
npm install
npm run dev                 # http://localhost:5173, proxies /api to 10103
```

The agent:

```bash
cd agent
npm install
npm run dev -- --server http://localhost:10103 --token wts_…
```

The widget package:

```bash
cd widget
npm install
npm run dev                 # tsup watch
```

## Typechecks

```bash
npm run typecheck                 # server
cd web && npm run typecheck
cd widget && npm run typecheck
cd agent && npx tsc --noEmit
```

CI runs all four.

## Commit / PR conventions

- Conventional-commit-ish prefixes (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`). Phase suffixes when relevant: `feat(p7-c): …`.
- Keep PRs vertical: one user-visible behaviour at a time. Don't bundle a refactor with a feature unless the refactor is required.
- Update `docs/PRD.md` when the contract changes (new endpoint, new component prop, new auth scope).

## Releasing

Push a tag like `v0.1.1` on `main` and the **Release** workflow handles npm publishes (`@wigtoken-temp/widget`, `@wigtoken-temp/agent`, root server package) + a GHCR Docker image + a GitHub release. The release notes are scraped from the matching block in `CHANGELOG.md`.

Required repository secrets:

- `NPM_TOKEN` — automation token with publish access for the `@wigtn` scope (or omit and let the workflow skip publishes via `continue-on-error`).
- `GITHUB_TOKEN` — provided automatically.

## Code style

- TypeScript strict everywhere.
- Inline comments only when the *why* isn't obvious from the code — never to restate what the code does.
- No emoji in code or docs unless we already used them in the surrounding section.
- `import` first-party with relative paths (or `@/` alias in `web/`); never reach across packages directly — go through the published API.

## Reporting

- Crashy or sensitive bugs → GitHub Security Advisories.
- Anything else → regular GitHub issues with reproduction steps. Logs from the daemon (`docker logs wigtoken`, `tail data/stderr.log`) and the affected env vars / token scope help.
