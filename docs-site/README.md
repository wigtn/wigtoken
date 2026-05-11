# wigtoken docs site

Nextra v3 / Next.js 14, static export. Published to GitHub Pages at
https://wigtn.github.io/wigtoken/ on every push to `main` that touches
`docs-site/`.

## Local development

```bash
cd docs-site
npm install
npm run dev   # http://localhost:4567
```

## Build

```bash
npm run build           # → docs-site/out/
DOCS_BASE_PATH=/wigtoken npm run build   # for GitHub Pages
```

## Add a page

1. Create `pages/<slug>.mdx`.
2. Add an entry in `pages/_meta.json`.
3. Push — the workflow rebuilds and deploys.

## Conventions

- Lowercase slugs (kebab-case if multi-word).
- Each page starts with `--- title: … ---` frontmatter.
- Code blocks: triple-fenced with language. `defaultShowCopyCode` is on globally.
- Tables use raw HTML if you need column alignment; GitHub-flavored Markdown otherwise.

## Pages

| Slug | Source of truth | Notes |
| --- | --- | --- |
| `index` | this file | High-level overview |
| `quickstart` | docs/HOOKS.md + README | Solo / team / org paths |
| `deploy` | new | Native / Docker / Compose / K8s |
| `self-host` | new | TLS, scopes, embedding, headless |
| `widget` | widget/README.md | Component reference |
| `agent` | agent/README.md | CLI flags + install |
| `hooks` | docs/HOOKS.md | Mirrored — keep in sync |
| `api` | src/server.ts | Endpoint reference |
| `comparison` | docs/PRD.md | vs ccusage / CodeBurn |
