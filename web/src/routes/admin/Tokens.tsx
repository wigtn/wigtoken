import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { admin, type TokenRow } from "@/api/client";
import Panel from "@/components/Panel";
import { fmtDateTime, fmtRelativeTime } from "@/lib/format";

export default function AdminTokens() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "tokens"],
    queryFn: admin.listTokens,
  });

  const [newToken, setNewToken] = useState<string | null>(null);

  const issue = useMutation({
    mutationFn: admin.issueToken,
    onSuccess: (res) => {
      setNewToken(res.token);
      qc.invalidateQueries({ queryKey: ["admin", "tokens"] });
    },
  });

  const revoke = useMutation({
    mutationFn: admin.revokeToken,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "tokens"] }),
  });

  if (isError) {
    return (
      <Panel title="Tokens">
        <div className="text-sm text-rose-300">
          Unauthorised. Set an admin bearer token via the login flow first.
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Tokens</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Issue and revoke ingest / read / admin / embed scope bearer tokens.
        </p>
      </header>

      <IssueForm onSubmit={(b) => issue.mutate(b)} disabled={issue.isPending} />

      {newToken && (
        <Panel title="New token issued (shown once)">
          <div className="font-mono text-xs break-all bg-neutral-950 border border-neutral-800 rounded p-3">
            {newToken}
          </div>
          <button
            className="mt-3 text-xs text-neutral-400 hover:text-neutral-200"
            onClick={() => setNewToken(null)}
          >
            Done · dismiss
          </button>
        </Panel>
      )}

      <Panel title="All tokens" hint={`${data?.tokens?.length ?? 0} rows`}>
        {isLoading ? (
          <div className="text-sm text-neutral-500">Loading…</div>
        ) : (
          <TokenTable
            rows={data?.tokens ?? []}
            onRevoke={(id) => revoke.mutate(id)}
            revoking={revoke.isPending}
          />
        )}
      </Panel>
    </div>
  );
}

function IssueForm({
  onSubmit,
  disabled,
}: {
  onSubmit: (body: {
    user: string;
    scope: TokenRow["scope"];
    label?: string;
  }) => void;
  disabled?: boolean;
}) {
  const [user, setUser] = useState("");
  const [scope, setScope] = useState<TokenRow["scope"]>("ingest");
  const [label, setLabel] = useState("");

  return (
    <Panel title="Issue new token">
      <form
        className="flex flex-wrap gap-3 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!user) return;
          onSubmit({ user, scope, label: label || undefined });
          setUser("");
          setLabel("");
        }}
      >
        <Field label="User">
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            className="input"
            placeholder="alice"
            required
          />
        </Field>
        <Field label="Scope">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as TokenRow["scope"])}
            className="input"
          >
            <option value="ingest">ingest</option>
            <option value="read">read</option>
            <option value="admin">admin</option>
            <option value="embed">embed</option>
          </select>
        </Field>
        <Field label="Label (optional)">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="input"
            placeholder="alice-laptop"
          />
        </Field>
        <button
          type="submit"
          disabled={disabled}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium hover:bg-accent-fg disabled:opacity-50"
        >
          Issue
        </button>
      </form>

      <style>{`
        .input {
          background: #0a0a0a;
          border: 1px solid #262626;
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 13px;
          color: #fafafa;
        }
        .input:focus { outline: 2px solid #7c3aed; outline-offset: -1px; }
      `}</style>
    </Panel>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-neutral-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function TokenTable({
  rows,
  onRevoke,
  revoking,
}: {
  rows: TokenRow[];
  onRevoke: (id: number) => void;
  revoking?: boolean;
}) {
  if (rows.length === 0) {
    return <div className="text-sm text-neutral-500">No tokens yet.</div>;
  }
  return (
    <table className="w-full text-sm tabular-nums">
      <thead className="text-xs uppercase tracking-wider text-neutral-500">
        <tr>
          <th className="text-left py-2">User</th>
          <th className="text-left py-2">Scope</th>
          <th className="text-left py-2">Label</th>
          <th className="text-left py-2">Created</th>
          <th className="text-left py-2">Last used</th>
          <th className="text-right py-2">Status</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-neutral-900">
            <td className="py-2">{r.user}</td>
            <td className="py-2">
              <span className="text-[10px] uppercase tracking-wider rounded bg-neutral-800 px-1.5 py-0.5">
                {r.scope}
              </span>
            </td>
            <td className="py-2 text-neutral-400">{r.label ?? "—"}</td>
            <td className="py-2 text-neutral-500 text-xs">
              {fmtDateTime(r.createdAt)}
            </td>
            <td className="py-2 text-neutral-500 text-xs">
              {r.lastUsedAt ? fmtRelativeTime(r.lastUsedAt) : "—"}
            </td>
            <td className="py-2 text-right">
              {r.revokedAt ? (
                <span className="text-rose-400">revoked</span>
              ) : (
                <span className="text-emerald-400">active</span>
              )}
            </td>
            <td className="py-2 text-right">
              {!r.revokedAt && (
                <button
                  disabled={revoking}
                  onClick={() => {
                    if (
                      confirm(
                        `Revoke token for ${r.user} (scope: ${r.scope})?`
                      )
                    )
                      onRevoke(r.id);
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300"
                >
                  revoke
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
