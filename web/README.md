# wigtoken — operator dashboard (web)

React SPA that lives at the root of a wigtoken server. Built with Vite, output goes to `../public/` and is served by the Hono backend as static assets.

## Layout

```
web/
├── src/
│   ├── api/          # client.ts (fetch wrapper) + stream.ts (SSE)
│   ├── components/   # Layout, Placeholder, plus chart/panel components
│   ├── routes/       # one file per route, mirrors the URL structure
│   └── main.tsx      # entry — QueryClient + Router boilerplate
├── index.html
├── vite.config.ts    # build -> ../public, dev proxies /api → :10103
├── tailwind.config.ts
└── tsconfig.json
```

## Dev

```bash
npm install
npm run dev          # http://localhost:5173, proxies /api to the daemon
```

The daemon (root `npm start`) must be running on `:10103` for the dashboard's API calls to resolve.

## Build

```bash
npm run build        # writes the production bundle to ../public/
```

The Hono server picks it up automatically — `serveStatic({ root: "./public" })` plus an SPA-fallback to `index.html`.

## Routing convention

| Route | Purpose |
|---|---|
| `/` | Overview — top-level counters + nav into details |
| `/users`, `/users/:name` | Per-user ranking + drill-down |
| `/models`, `/models/:family` | Opus / Sonnet / Haiku breakdown |
| `/machines` | Cost by machine |
| `/timeseries` | Long-range burn rate charts |
| `/sessions` | Top heavy sessions |
| `/admin/tokens` | Token CRUD (ingest / read / admin) |
| `/admin/embeds` | Embed-scope tokens + allowed origins |
| `/admin/audit` | Audit log viewer |

## Notes

- The bearer token is held in `localStorage` (`wigtoken-bearer`). `getToken()/setToken()/clearToken()` live in `api/client.ts`.
- Public counter endpoints (totals, stream) work without a token; admin endpoints return 401 if absent.
- Theme is dark by default; `prefers-color-scheme` decides between dark and light Tailwind classes.
