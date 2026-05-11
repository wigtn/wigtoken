import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { admin } from "@/api/client";
import Panel from "@/components/Panel";
import { fmtDateTime, fmtRelativeTime } from "@/lib/format";

export default function AdminAudit() {
  const [limit, setLimit] = useState(200);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "audit", limit],
    queryFn: () => admin.audit(undefined, limit),
    refetchInterval: 30_000,
  });

  if (isError) {
    return (
      <Panel title="Audit log">
        <div className="text-sm text-rose-300">
          Unauthorised. Set an admin bearer token first.
        </div>
      </Panel>
    );
  }

  const entries = data?.entries ?? [];

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Audit log</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Token issuance, ingest calls, auth failures — newest first.
          </p>
        </div>
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs"
        >
          {[50, 200, 500, 1000].map((n) => (
            <option key={n} value={n}>
              last {n}
            </option>
          ))}
        </select>
      </header>

      <Panel title="Entries" hint={`${entries.length}`}>
        {isLoading ? (
          <div className="text-sm text-neutral-500">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="text-sm text-neutral-500">No entries.</div>
        ) : (
          <table className="w-full text-xs tabular-nums">
            <thead className="text-[10px] uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="text-left py-2">When</th>
                <th className="text-left py-2">Action</th>
                <th className="text-left py-2">User</th>
                <th className="text-left py-2">IP</th>
                <th className="text-left py-2">Meta</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr
                  key={`${e.ts}-${i}`}
                  className="border-t border-neutral-900 align-top"
                >
                  <td className="py-1.5 text-neutral-500 whitespace-nowrap">
                    <div>{fmtRelativeTime(e.ts)}</div>
                    <div className="text-[10px] text-neutral-700">
                      {fmtDateTime(e.ts)}
                    </div>
                  </td>
                  <td className="py-1.5">
                    <span
                      className={
                        "rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider " +
                        (e.action === "auth_failed"
                          ? "bg-rose-500/15 text-rose-300"
                          : e.action.startsWith("token")
                            ? "bg-violet-500/15 text-violet-300"
                            : "bg-neutral-800 text-neutral-300")
                      }
                    >
                      {e.action}
                    </span>
                  </td>
                  <td className="py-1.5">{e.user ?? "—"}</td>
                  <td className="py-1.5 font-mono text-[11px] text-neutral-500">
                    {e.ip ?? "—"}
                  </td>
                  <td className="py-1.5 text-neutral-400">
                    {e.meta ? (
                      <code className="text-[11px]">
                        {JSON.stringify(e.meta)}
                      </code>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
