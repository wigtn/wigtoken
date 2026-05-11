# wigtoken — Grafana dashboard

A pre-built dashboard that visualises the `/metrics` endpoint of any wigtoken deployment. Eight panels covering team totals, burn rate over time, per-model / per-user / per-machine cost share, and a cross-cutting breakdown table — all driven by the labelled Prometheus counters the daemon emits in P4.

## Prerequisites

1. **Prometheus** scraping `host:10103/metrics`. Add a job to your `prometheus.yml`:

   ```yaml
   scrape_configs:
     - job_name: wigtoken
       scrape_interval: 15s
       static_configs:
         - targets: ["host.docker.internal:10103"]
   ```

   (`host.docker.internal` if your Prometheus runs in a container; replace with the actual hostname/IP otherwise.)

2. **Grafana** with the Prometheus data source configured.

## Importing

1. Grafana sidebar → **Dashboards → Import**
2. Upload `dashboard.json`
3. Pick your Prometheus data source when prompted
4. Save

## Dashboard layout

| # | Panel | What it answers |
|---|---|---|
| 1 | Total tokens (weighted) | "How much work has the team done, in input-token equivalents?" |
| 2 | Messages | "How many assistant messages have been processed?" |
| 3 | Estimated cost (USD) | "What would this have cost on the public API?" |
| 4 | Raw tokens (incl. cache reads) | "What's the total of all 4 token kinds the API saw?" |
| 5 | Burn rate by user (5m) | "Who's burning fast right now?" |
| 6 | Cost rate by model family (5m) | "How is cost distributed across Opus / Sonnet / Haiku over time?" |
| 7 | Cost share by model family | Same as #6 but as a single-instant pie |
| 8 | Cost by user | Per-user cumulative — find heavy users |
| 9 | Cost by machine | Compare CI host vs personal laptops, e.g. |
| 10 | Per-user breakdown table | The whole label cube (user × machine × model_family) at a glance |

The variables at the top (`user`, `machine`, `model_family`) are query templates pulled from the live label values, so the dashboard automatically picks up new users/machines without edits.

## What the metrics map to

Both views read the same underlying counters:

```
wigtn_tokens_total{user, machine, model, model_family, kind}     counter
wigtn_messages_total{user, machine, model_family}                counter
wigtn_cost_usd_total{user, machine, model_family}                counter
wigtn_tokens_weighted_total{user, machine, model_family}         counter
```

The cost numbers are estimates against Anthropic's public API rates (see `src/pricing.ts`). They are not your bill; Max-plan flat-rate users will see numbers that don't match anything Anthropic charges them.

## Caveats

- Existing data the daemon ingested *before* P4 lives in the legacy `totals` table only and won't show up under labels. To backfill cleanly: stop the daemon, `rm -rf data/`, restart — every transcript gets re-walked and re-labelled.
- Cardinality: `model` is included on `wigtn_tokens_total` (so the table panel can drill in), but the rest of the metrics use `model_family` to keep it bounded.
