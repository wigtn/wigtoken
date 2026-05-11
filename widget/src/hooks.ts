/**
 * Headless data hooks for users who want to build their own UI off
 * the same wigtoken data the bundled components use. All hooks
 * pull credentials from <ProviderConfig> via useWigtnContext().
 */

import { useEffect, useRef, useState } from "react";
import { useWigtnContext } from "./ProviderConfig";

const DEFAULT_POLL_MS = 30_000;

async function authedJson<T>(server: string, path: string, token: string): Promise<T> {
  const res = await fetch(`${server}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${await res.text().catch(() => "")}`);
  }
  return (await res.json()) as T;
}

function usePolled<T>(
  fetcher: (() => Promise<T>) | null,
  intervalMs: number
): { data: T | null; error: Error | null; isLoading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!fetcherRef.current) return;
    let cancelled = false;

    const run = async () => {
      try {
        const value = await fetcherRef.current!();
        if (!cancelled) {
          setData(value);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err as Error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void run();
    const timer = window.setInterval(run, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [intervalMs]);

  return { data, error, isLoading };
}

// ───── Timeseries ─────

export interface TimeseriesBucket {
  ts: number;
  messages: number;
  tokensRaw: number;
  tokensWeighted: number;
  costUsd: number;
}

export interface UseTimeseriesOpts {
  /** Preset range in ms — `range` overrides explicit from/to. */
  range?: "1h" | "24h" | "7d" | "30d";
  step?: number; // ms
  pollIntervalMs?: number;
}

const RANGE_MS: Record<NonNullable<UseTimeseriesOpts["range"]>, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export function useTimeseries(opts: UseTimeseriesOpts = {}) {
  const { server, token } = useWigtnContext();
  const enabled = !!server && !!token;
  const fetcher = enabled
    ? async () => {
        const now = Date.now();
        const rangeMs = RANGE_MS[opts.range ?? "7d"];
        const from = now - rangeMs;
        const step = opts.step ?? Math.max(60_000, Math.floor(rangeMs / 100));
        const q = new URLSearchParams({
          from: String(from),
          to: String(now),
          step: String(step),
        });
        return authedJson<{
          from: number;
          to: number;
          step: number;
          buckets: TimeseriesBucket[];
        }>(server, `/api/usage/timeseries?${q}`, token);
      }
    : null;
  return usePolled(fetcher, opts.pollIntervalMs ?? DEFAULT_POLL_MS);
}

// ───── Leaderboard ─────

export interface LeaderboardEntry {
  key: string;
  messages: number;
  costUsd: number;
  weightedInputEq: number;
}

export interface UseLeaderboardOpts {
  by: "user" | "machine" | "model_family";
  limit?: number;
  pollIntervalMs?: number;
}

export function useLeaderboard(opts: UseLeaderboardOpts) {
  const { server, token } = useWigtnContext();
  const enabled = !!server && !!token;
  const fetcher = enabled
    ? () =>
        authedJson<{ by: string; entries: LeaderboardEntry[] }>(
          server,
          `/api/usage/leaderboard?by=${opts.by}&limit=${opts.limit ?? 10}`,
          token
        )
    : null;
  return usePolled(fetcher, opts.pollIntervalMs ?? DEFAULT_POLL_MS);
}

// ───── Recent activity ─────

export interface RecentMessage {
  user: string;
  machine: string;
  model: string;
  modelFamily: string;
  inputTokens: number;
  cacheCreation: number;
  cacheRead: number;
  outputTokens: number;
  costUsd: number;
  weightedInputEq: number;
  ts: number;
}

export function useRecent(opts: { limit?: number; pollIntervalMs?: number } = {}) {
  const { server, token } = useWigtnContext();
  const enabled = !!server && !!token;
  const fetcher = enabled
    ? () =>
        authedJson<{ entries: RecentMessage[] }>(
          server,
          `/api/usage/recent?limit=${opts.limit ?? 50}`,
          token
        )
    : null;
  return usePolled(fetcher, opts.pollIntervalMs ?? 15_000);
}
