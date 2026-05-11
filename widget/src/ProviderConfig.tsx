import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Totals, TotalsEnvelope } from "./types";

interface ContextValue {
  /** Server base URL, normalised (no trailing slash). */
  server: string;
  /** Bearer token (embed scope). */
  token: string;
  totals: Totals | null;
  lastUpdate: number | null;
  isConnected: boolean;
  error: string | null;
}

const ZERO: Totals = {
  input: 0,
  cacheCreation: 0,
  cacheRead: 0,
  output: 0,
  sum: 0,
  messages: 0,
  costUsd: 0,
};

const Ctx = createContext<ContextValue>({
  server: "",
  token: "",
  totals: null,
  lastUpdate: null,
  isConnected: false,
  error: null,
});

export interface ProviderConfigProps {
  /** Base URL of the wigtoken server, e.g. https://token.example.com */
  server: string;
  /** Embed-scope bearer token. */
  token: string;
  /** Falls back to plain polling when true (default: false → SSE). */
  poll?: boolean;
  pollIntervalMs?: number;
  children: ReactNode;
}

export function ProviderConfig({
  server,
  token,
  poll,
  pollIntervalMs = 30_000,
  children,
}: ProviderConfigProps) {
  const [totals, setTotals] = useState<Totals | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = useMemo(() => server.replace(/\/+$/, ""), [server]);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => {
    if (!base || !token) {
      setError("server and token are required");
      return;
    }

    let cancelled = false;
    let es: EventSource | null = null;
    let pollTimer: number | null = null;

    const apply = (envelope: TotalsEnvelope) => {
      if (cancelled) return;
      setTotals(envelope.totals);
      setLastUpdate(envelope.timestamp ?? Date.now());
      setIsConnected(true);
      setError(null);
    };

    const startPolling = () => {
      if (pollTimer != null) return;
      const tick = async () => {
        try {
          const res = await fetch(`${base}/embed/totals`, {
            headers: { Authorization: `Bearer ${tokenRef.current}` },
            cache: "no-store",
          });
          if (!res.ok) {
            setError(`HTTP ${res.status}`);
            setIsConnected(false);
            return;
          }
          apply((await res.json()) as TotalsEnvelope);
        } catch (err) {
          setError((err as Error).message);
          setIsConnected(false);
        }
      };
      void tick();
      pollTimer = window.setInterval(tick, pollIntervalMs);
    };

    if (poll) {
      startPolling();
    } else {
      try {
        es = new EventSource(
          `${base}/embed/stream?token=${encodeURIComponent(token)}`
        );
        es.addEventListener("totals", (ev) => {
          try {
            apply(JSON.parse((ev as MessageEvent).data) as TotalsEnvelope);
          } catch {
            /* malformed — ignore */
          }
        });
        es.onerror = () => {
          setIsConnected(false);
          es?.close();
          es = null;
          startPolling();
        };
      } catch {
        startPolling();
      }
    }

    return () => {
      cancelled = true;
      es?.close();
      if (pollTimer != null) clearInterval(pollTimer);
    };
  }, [base, token, poll, pollIntervalMs]);

  const value = useMemo(
    () => ({
      server: base,
      token,
      totals,
      lastUpdate,
      isConnected,
      error,
    }),
    [base, token, totals, lastUpdate, isConnected, error]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWigtnContext(): ContextValue {
  return useContext(Ctx);
}

/** Public — raw access to live totals. Falls back to all-zeros on first render. */
export function useTotals(): Totals {
  return useWigtnContext().totals ?? ZERO;
}

/** Public — connection state, useful for status indicators. */
export function useProviderStatus(): {
  isConnected: boolean;
  lastUpdate: number | null;
  error: string | null;
} {
  const { isConnected, lastUpdate, error } = useWigtnContext();
  return { isConnected, lastUpdate, error };
}
