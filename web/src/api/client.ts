/**
 * Minimal client for the wigtoken server. All requests are same-origin
 * by default (the Vite dev server proxies /api → :10103). Bearer tokens
 * are read from localStorage; the admin/login flow will set them. Public
 * read endpoints don't need a token.
 */

const TOKEN_KEY = "wigtoken-bearer";

export function getToken(): string | null {
  return typeof localStorage !== "undefined"
    ? localStorage.getItem(TOKEN_KEY)
    : null;
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

// ───── Types ─────

export interface Totals {
  input: number;
  cacheCreation: number;
  cacheRead: number;
  output: number;
  sum: number;
  messages: number;
  costUsd: number;
}

export interface TotalsResponse {
  totals: Totals;
  timestamp: number;
}

export interface TokenBreakdownRow {
  user: string;
  machine: string;
  model: string;
  modelFamily: string;
  kind: string;
  tokens: number;
}

export interface CostBreakdownRow {
  user: string;
  machine: string;
  modelFamily: string;
  messages: number;
  costUsd: number;
  weightedInputEq: number;
}

export interface TimeseriesBucket {
  ts: number;
  messages: number;
  tokensRaw: number;
  tokensWeighted: number;
  costUsd: number;
}

export interface LeaderboardEntry {
  key: string;
  messages: number;
  costUsd: number;
  weightedInputEq: number;
}

export interface UserDetailResponse {
  user: string;
  totals: { messages: number; costUsd: number; weightedInputEq: number };
  perFamily: Array<{
    modelFamily: string;
    messages: number;
    costUsd: number;
    weightedInputEq: number;
  }>;
  perMachine: Array<{ machine: string; messages: number; costUsd: number }>;
}

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

export interface TokenRow {
  id: number;
  user: string;
  scope: "ingest" | "read" | "admin" | "embed";
  label: string | null;
  createdAt: number;
  expiresAt: number | null;
  revokedAt: number | null;
  lastUsedAt: number | null;
}

export interface IssuedToken extends TokenRow {
  token: string; // plain text, returned once
}

export interface EmbedOrigin {
  id: number;
  origin: string;
  label: string | null;
  createdAt: number;
  createdBy: number | null;
}

export interface AuditEntry {
  ts: number;
  tokenId: number | null;
  action: string;
  user: string | null;
  ip: string | null;
  meta?: unknown;
}

// ───── Endpoints ─────

export const usage = {
  totals: () => api<TotalsResponse>("/api/usage/totals"),

  breakdown: () =>
    api<{
      tokens: TokenBreakdownRow[];
      cost: CostBreakdownRow[];
      timestamp: number;
    }>("/api/usage/breakdown"),

  timeseries: (params: { from?: number; to?: number; step?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.from) q.set("from", String(params.from));
    if (params.to) q.set("to", String(params.to));
    if (params.step) q.set("step", String(params.step));
    return api<{
      from: number;
      to: number;
      step: number;
      buckets: TimeseriesBucket[];
    }>(`/api/usage/timeseries?${q}`);
  },

  leaderboard: (by: "user" | "machine" | "model_family", limit = 20) =>
    api<{ by: string; entries: LeaderboardEntry[] }>(
      `/api/usage/leaderboard?by=${by}&limit=${limit}`
    ),

  userDetail: (name: string) =>
    api<UserDetailResponse>(`/api/usage/users/${encodeURIComponent(name)}`),

  recent: (limit = 50) =>
    api<{ entries: RecentMessage[] }>(`/api/usage/recent?limit=${limit}`),
};

export interface SetupStatus {
  complete: boolean;
  scenario: string | null;
  infra: string | null;
  completedAt: number | null;
  headless: boolean;
  db?: {
    kind: "sqlite" | "postgres" | "mysql";
  };
}

export const setup = {
  status: () => api<SetupStatus>("/api/setup/status"),

  complete: (body: { scenario: string; infra: string }) =>
    api<{ ok: true }>("/api/setup/complete", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  reset: () =>
    api<{ ok: true }>("/api/setup/reset", { method: "POST" }),
};

export const admin = {
  listTokens: () => api<{ tokens: TokenRow[] }>("/api/admin/tokens"),

  issueToken: (body: {
    user: string;
    scope: TokenRow["scope"];
    label?: string;
    expiresAt?: number;
  }) =>
    api<IssuedToken>("/api/admin/tokens", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  revokeToken: (id: number) =>
    api<{ revoked: boolean }>(`/api/admin/tokens/${id}`, { method: "DELETE" }),

  listEmbedOrigins: () =>
    api<{ origins: EmbedOrigin[] }>("/api/admin/embed-origins"),

  addEmbedOrigin: (body: { origin: string; label?: string }) =>
    api<EmbedOrigin>("/api/admin/embed-origins", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  removeEmbedOrigin: (id: number) =>
    api<{ removed: boolean }>(`/api/admin/embed-origins/${id}`, {
      method: "DELETE",
    }),

  audit: (sinceMs?: number, limit?: number) => {
    const q = new URLSearchParams();
    if (sinceMs) q.set("since", String(sinceMs));
    if (limit) q.set("limit", String(limit));
    return api<{ entries: AuditEntry[] }>(`/api/admin/audit?${q}`);
  },
};
