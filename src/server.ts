import { Hono } from "hono";
import type { Context, Next } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Storage } from "./storage.ts";
import type { Scope, TokenRow } from "./tokens.ts";
import { bus, EVENT_UPDATED } from "./events.ts";
import { applyIngestPayload, validateIngestPayload } from "./ingest.ts";
import type { RateLimiter } from "./rate-limit.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const PUBLIC_DIR = resolve(REPO_ROOT, "public");

interface ServerDeps {
  storage: Storage;
  allowedOrigins: string[];
  rateLimiter: RateLimiter;
  headless: boolean;
}

declare module "hono" {
  interface ContextVariableMap {
    token: TokenRow;
  }
}

export function buildApp(deps: ServerDeps) {
  const { storage, allowedOrigins, rateLimiter, headless } = deps;
  const { store, tokens, audit, embedOrigins, settings } = storage;
  const app = new Hono();

  // CORS: env-configured ALLOWED_ORIGINS plus any origin admin has
  // registered via /api/admin/embed-origins. The check is dynamic so
  // adding a new embed origin doesn't require a restart.
  app.use(
    "*",
    cors({
      origin: async (origin) => {
        if (!origin) return null;
        if (allowedOrigins.includes(origin)) return origin;
        if (await embedOrigins.isAllowed(origin)) return origin;
        return null;
      },
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowHeaders: ["Authorization", "Content-Type"],
    })
  );

  // ───── Public ─────
  app.get("/health", (c) => c.text("ok"));

  app.get("/api/usage/totals", async (c) =>
    c.json({ totals: await store.getTotals(), timestamp: Date.now() })
  );

  // Prometheus exposition. Labels are bounded by the regex on machine
  // (^[\w.\-]+$) and the small set of model families, so explicit
  // escaping isn't strictly necessary — but cheap to do anyway.
  app.get("/metrics", async (c) => {
    const [tokensRows, cost] = await Promise.all([
      store.tokenBreakdown(),
      store.costBreakdown(),
    ]);
    const lines: string[] = [];

    lines.push("# HELP wigtn_tokens_total Total tokens processed by kind");
    lines.push("# TYPE wigtn_tokens_total counter");
    for (const r of tokensRows) {
      lines.push(
        `wigtn_tokens_total{user=${q(r.user)},machine=${q(r.machine)},model=${q(r.model)},model_family=${q(r.modelFamily)},kind=${q(r.kind)}} ${r.tokens}`
      );
    }

    lines.push("# HELP wigtn_messages_total Total assistant messages ingested");
    lines.push("# TYPE wigtn_messages_total counter");
    for (const r of cost) {
      lines.push(
        `wigtn_messages_total{user=${q(r.user)},machine=${q(r.machine)},model_family=${q(r.modelFamily)}} ${r.messages}`
      );
    }

    lines.push("# HELP wigtn_cost_usd_total Estimated USD cost (public API rates)");
    lines.push("# TYPE wigtn_cost_usd_total counter");
    for (const r of cost) {
      lines.push(
        `wigtn_cost_usd_total{user=${q(r.user)},machine=${q(r.machine)},model_family=${q(r.modelFamily)}} ${r.costUsd}`
      );
    }

    lines.push(
      "# HELP wigtn_tokens_weighted_total Input-token-equivalent weighted total"
    );
    lines.push("# TYPE wigtn_tokens_weighted_total counter");
    for (const r of cost) {
      lines.push(
        `wigtn_tokens_weighted_total{user=${q(r.user)},machine=${q(r.machine)},model_family=${q(r.modelFamily)}} ${r.weightedInputEq}`
      );
    }

    return c.text(lines.join("\n") + "\n", 200, {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    });
  });

  app.get("/api/usage/breakdown", async (c) => {
    const [tokensRows, cost] = await Promise.all([
      store.tokenBreakdown(),
      store.costBreakdown(),
    ]);
    return c.json({
      tokens: tokensRows,
      cost,
      timestamp: Date.now(),
    });
  });

  // CSV export — operator-facing, no auth in v1 (same as /breakdown).
  app.get("/api/usage/breakdown.csv", async (c) => {
    const rows = await store.costBreakdown();
    const header = "user,machine,model_family,messages,cost_usd,weighted_input_eq";
    const body = rows
      .map(
        (r) =>
          `${csv(r.user)},${csv(r.machine)},${csv(r.modelFamily)},${r.messages},${r.costUsd.toFixed(6)},${r.weightedInputEq}`
      )
      .join("\n");
    return c.text(header + "\n" + body + "\n", 200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="wigtoken-breakdown.csv"',
    });
  });

  // Time-bucketed series for line charts. Defaults: last 7d, 1h step.
  app.get("/api/usage/timeseries", async (c) => {
    const now = Date.now();
    const fromMs = Number(c.req.query("from")) || now - 7 * 24 * 60 * 60 * 1000;
    const toMs = Number(c.req.query("to")) || now;
    const stepMs = Number(c.req.query("step")) || 60 * 60 * 1000;
    if (stepMs < 60_000) {
      return c.json({ error: "step must be >= 60000 (1 minute)" }, 400);
    }
    return c.json({
      from: fromMs,
      to: toMs,
      step: stepMs,
      buckets: await store.timeseries(fromMs, toMs, stepMs),
    });
  });

  // Top-N leaderboard by user / machine / model_family.
  app.get("/api/usage/leaderboard", async (c) => {
    const by = (c.req.query("by") ?? "user") as
      | "user"
      | "machine"
      | "model_family";
    if (!["user", "machine", "model_family"].includes(by)) {
      return c.json({ error: "by must be user/machine/model_family" }, 400);
    }
    const limit = Math.min(Number(c.req.query("limit")) || 20, 100);
    return c.json({ by, entries: await store.leaderboard(by, limit) });
  });

  // Per-user detail.
  app.get("/api/usage/users/:name", async (c) => {
    const name = c.req.param("name");
    return c.json(await store.userDetail(name));
  });

  // Recent messages for activity feed / sessions placeholder view.
  app.get("/api/usage/recent", async (c) => {
    const limit = Math.min(Number(c.req.query("limit")) || 50, 500);
    return c.json({ entries: await store.recentMessages(limit) });
  });

  app.get("/api/usage/stream", (c) =>
    streamSSE(c, async (stream) => {
      const send = async () =>
        stream.writeSSE({
          event: "totals",
          data: JSON.stringify({
            totals: await store.getTotals(),
            timestamp: Date.now(),
          }),
        });
      await send();
      const onUpdate = () => {
        send().catch(() => {});
      };
      bus.on(EVENT_UPDATED, onUpdate);
      const heartbeat = setInterval(() => {
        stream.writeSSE({ event: "ping", data: "" }).catch(() => {});
      }, 25_000);
      await new Promise<void>((resolve) => {
        stream.onAbort(() => {
          bus.off(EVENT_UPDATED, onUpdate);
          clearInterval(heartbeat);
          resolve();
        });
      });
    })
  );

  // ───── Auth middleware ─────
  const requireScope =
    (...required: Scope[]) =>
    async (c: Context, next: Next) => {
      const auth = c.req.header("Authorization") ?? "";
      let plain = "";
      if (auth.startsWith("Bearer ")) {
        plain = auth.slice("Bearer ".length).trim();
      } else if (required.includes("embed")) {
        plain = c.req.query("token") ?? "";
      }
      if (!plain) {
        return c.json({ error: "unauthorized" }, 401);
      }
      const row = await tokens.resolve(plain);
      if (!row) {
        await audit.record({
          ts: Date.now(),
          tokenId: null,
          action: "auth_failed",
          user: null,
          ip: clientIp(c),
          meta: { path: c.req.path },
        });
        return c.json({ error: "invalid token" }, 401);
      }
      const allowed =
        row.scope === "admin" || required.includes(row.scope as Scope);
      if (!allowed) {
        return c.json({ error: "forbidden" }, 403);
      }

      const rateKey = `token:${row.id}`;
      const rate = rateLimiter.check(rateKey);
      if (!rate.allowed) {
        c.header("Retry-After", String(Math.ceil(rate.retryAfterMs / 1000)));
        return c.json({ error: "rate_limited" }, 429);
      }

      c.set("token", row);
      await next();
    };

  // ───── Embed-scope endpoints ─────
  app.get("/embed/totals", requireScope("embed"), async (c) =>
    c.json({ totals: await store.getTotals(), timestamp: Date.now() })
  );

  app.get("/embed/stream", requireScope("embed"), (c) =>
    streamSSE(c, async (stream) => {
      const send = async () =>
        stream.writeSSE({
          event: "totals",
          data: JSON.stringify({
            totals: await store.getTotals(),
            timestamp: Date.now(),
          }),
        });
      await send();
      const onUpdate = () => {
        send().catch(() => {});
      };
      bus.on(EVENT_UPDATED, onUpdate);
      const heartbeat = setInterval(() => {
        stream.writeSSE({ event: "ping", data: "" }).catch(() => {});
      }, 25_000);
      await new Promise<void>((resolve) => {
        stream.onAbort(() => {
          bus.off(EVENT_UPDATED, onUpdate);
          clearInterval(heartbeat);
          resolve();
        });
      });
    })
  );

  // ───── Ingest ─────
  // Goes through the raw sync sqlite Store because better-sqlite3
  // transactions are synchronous (drizzle/better-sqlite3 likewise).
  // Non-sqlite backends will get their own ingest path when those
  // drivers land — for now openStorage() throws at startup for them.
  app.post("/api/ingest/messages", requireScope("ingest"), async (c) => {
    const token = c.get("token");
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid json" }, 400);
    }
    const result = validateIngestPayload(body);
    if (!result.ok) {
      await audit.record({
        ts: Date.now(),
        tokenId: token.id,
        action: "ingest_rejected",
        user: token.user,
        ip: clientIp(c),
        meta: { reason: result.reason },
      });
      return c.json({ error: result.reason }, result.status as 400 | 413);
    }

    if (!storage.raw) {
      return c.json(
        { error: "ingest not supported on this backend yet" },
        503
      );
    }
    const summary = applyIngestPayload(
      result.payload,
      storage.raw.store,
      token.user
    );
    if (summary.applied > 0) bus.emit(EVENT_UPDATED);

    await audit.record({
      ts: Date.now(),
      tokenId: token.id,
      action: "ingest",
      user: token.user,
      ip: clientIp(c),
      meta: {
        machine: result.payload.machine,
        ...summary,
      },
    });
    return c.json({ ok: true, ...summary });
  });

  // ───── Admin: token management ─────
  app.get("/api/admin/tokens", requireScope("admin"), async (c) =>
    c.json({ tokens: await tokens.list() })
  );

  app.post("/api/admin/tokens", requireScope("admin"), async (c) => {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid json" }, 400);
    }
    if (typeof body?.user !== "string" || !body.user) {
      return c.json({ error: "user required" }, 400);
    }
    const scope = body.scope as Scope | undefined;
    if (!scope || !["ingest", "read", "admin", "embed"].includes(scope)) {
      return c.json({ error: "scope must be ingest/read/admin/embed" }, 400);
    }
    const issued = await tokens.issue({
      user: body.user,
      scope,
      label: typeof body.label === "string" ? body.label : undefined,
      expiresAt: typeof body.expiresAt === "number" ? body.expiresAt : undefined,
    });
    await audit.record({
      ts: Date.now(),
      tokenId: issued.id,
      action: "token_issued",
      user: issued.user,
      ip: clientIp(c),
      meta: { scope: issued.scope, label: issued.label },
    });
    return c.json(issued);
  });

  app.delete("/api/admin/tokens/:id", requireScope("admin"), async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return c.json({ error: "bad id" }, 400);
    const token = c.get("token");
    const revoked = await tokens.revoke(id);
    if (revoked) {
      await audit.record({
        ts: Date.now(),
        tokenId: id,
        action: "token_revoked",
        user: token.user,
        ip: clientIp(c),
        meta: null,
      });
    }
    return c.json({ revoked });
  });

  app.get("/api/admin/audit", requireScope("admin"), async (c) => {
    const since = Number(c.req.query("since")) || undefined;
    const limit = Number(c.req.query("limit")) || undefined;
    return c.json({
      entries: await audit.list({ sinceMs: since, limit }),
    });
  });

  // ───── Admin: embed origin whitelist + embed-scope tokens ─────
  app.get("/api/admin/embed-origins", requireScope("admin"), async (c) =>
    c.json({ origins: await embedOrigins.list() })
  );

  app.post("/api/admin/embed-origins", requireScope("admin"), async (c) => {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid json" }, 400);
    }
    const origin = typeof body?.origin === "string" ? body.origin.trim() : "";
    if (!origin || !/^https?:\/\/[^\s/]+(?::\d+)?\/?$/.test(origin)) {
      return c.json(
        { error: "origin must look like https://example.com" },
        400
      );
    }
    if (await embedOrigins.isAllowed(origin)) {
      return c.json({ error: "origin already exists" }, 409);
    }
    const tokenRow = c.get("token");
    const created = await embedOrigins.add(
      origin,
      typeof body.label === "string" ? body.label : null,
      tokenRow?.id ?? null
    );
    await audit.record({
      ts: Date.now(),
      tokenId: tokenRow?.id ?? null,
      action: "embed_origin_added",
      user: tokenRow?.user ?? null,
      ip: clientIp(c),
      meta: { origin, label: created.label },
    });
    return c.json(created);
  });

  app.delete(
    "/api/admin/embed-origins/:id",
    requireScope("admin"),
    async (c) => {
      const id = Number(c.req.param("id"));
      if (!Number.isFinite(id)) return c.json({ error: "bad id" }, 400);
      const tokenRow = c.get("token");
      const removed = await embedOrigins.remove(id);
      if (removed) {
        await audit.record({
          ts: Date.now(),
          tokenId: tokenRow?.id ?? null,
          action: "embed_origin_removed",
          user: tokenRow?.user ?? null,
          ip: clientIp(c),
          meta: { id },
        });
      }
      return c.json({ removed });
    }
  );

  // ───── Setup status / wizard endpoints ─────
  app.get("/api/setup/status", async (c) =>
    c.json({
      complete: await settings.getBool("setup.complete"),
      scenario: await settings.get("setup.scenario"),
      infra: await settings.get("setup.infra"),
      completedAt: Number(await settings.get("setup.completedAt")) || null,
      headless,
      db: {
        kind: storage.kind,
      },
    })
  );

  app.post("/api/setup/complete", requireScope("admin"), async (c) => {
    let body: any = {};
    try {
      body = await c.req.json();
    } catch {
      /* allow empty body */
    }
    const scenario = typeof body?.scenario === "string" ? body.scenario : null;
    const infra = typeof body?.infra === "string" ? body.infra : null;
    if (scenario) await settings.set("setup.scenario", scenario);
    if (infra) await settings.set("setup.infra", infra);
    await settings.setBool("setup.complete", true);
    await settings.set("setup.completedAt", String(Date.now()));
    const tokenRow = c.get("token");
    await audit.record({
      ts: Date.now(),
      tokenId: tokenRow?.id ?? null,
      action: "setup_completed",
      user: tokenRow?.user ?? null,
      ip: clientIp(c),
      meta: { scenario, infra },
    });
    return c.json({ ok: true });
  });

  app.post("/api/setup/reset", requireScope("admin"), async (c) => {
    await settings.setBool("setup.complete", false);
    await settings.set("setup.scenario", "");
    await settings.set("setup.infra", "");
    await settings.set("setup.completedAt", "");
    return c.json({ ok: true });
  });

  // ───── Operator dashboard SPA ─────
  if (headless) {
    app.get("/", (c) =>
      c.text(
        "wigtoken (headless). Ingest + embed endpoints only. " +
          "Set HEADLESS=false and re-deploy to enable the dashboard.\n",
        200,
        { "Content-Type": "text/plain; charset=utf-8" }
      )
    );
  } else if (existsSync(PUBLIC_DIR)) {
    // Static SPA served from the absolute PUBLIC_DIR (resolved at
    // module load from import.meta.url so it works whether the binary
    // is invoked from npm-install-g, npx, a Docker image, or `tsx
    // src/index.ts` for dev. cwd-relative paths break with
    // `npm install -g`.
    const serveFile = (absPath: string): Response | null => {
      try {
        const st = statSync(absPath);
        if (!st.isFile()) return null;
        const data = readFileSync(absPath);
        return new Response(new Uint8Array(data), {
          status: 200,
          headers: {
            "Content-Type": contentTypeFor(absPath),
            "Cache-Control": absPath.endsWith("index.html")
              ? "no-cache"
              : "public, max-age=31536000, immutable",
          },
        });
      } catch {
        return null;
      }
    };

    const tryServe = (relPath: string) => {
      // Defence against path traversal — resolve normalised, ensure
      // it still lives under PUBLIC_DIR.
      const abs = normalize(join(PUBLIC_DIR, relPath));
      if (!abs.startsWith(PUBLIC_DIR)) return null;
      return serveFile(abs);
    };

    app.get("/", (c) => {
      const resp = serveFile(join(PUBLIC_DIR, "index.html"));
      return resp ?? c.text("SPA index missing", 500);
    });
    app.get("/favicon.ico", (c) => {
      const resp = serveFile(join(PUBLIC_DIR, "favicon.ico"));
      return resp ?? c.notFound();
    });
    app.get("/assets/*", (c) => {
      // path like /assets/index-abc.js → relative public/assets/index-abc.js
      const url = new URL(c.req.url);
      const resp = tryServe(url.pathname.slice(1));
      return resp ?? c.notFound();
    });
    app.get("*", async (c, next) => {
      if (c.req.method !== "GET") return next();
      const accept = c.req.header("accept") ?? "";
      if (!accept.includes("text/html")) return next();
      const resp = serveFile(join(PUBLIC_DIR, "index.html"));
      return resp ?? c.text("SPA index missing", 500);
    });
  } else {
    app.get("/", (c) =>
      c.text(
        "wigtoken server is running.\n" +
          "The operator dashboard isn't built — run `cd web && npm install && npm run build`\n" +
          "to populate ./public, then refresh.\n",
        200,
        { "Content-Type": "text/plain; charset=utf-8" }
      )
    );
  }

  return app;
}

function q(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
}

/** Minimal RFC 4180 escaping. */
function csv(s: string): string {
  if (s === null || s === undefined) return "";
  const needsQuote = /[",\n]/.test(s);
  return needsQuote ? `"${s.replace(/"/g, '""')}"` : s;
}

function clientIp(c: Context): string | null {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    null
  );
}

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
};

function contentTypeFor(path: string): string {
  const ext = path.slice(path.lastIndexOf("."));
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}
