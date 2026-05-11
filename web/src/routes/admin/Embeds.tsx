import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { admin } from "@/api/client";
import Panel from "@/components/Panel";
import { fmtDateTime } from "@/lib/format";

export default function AdminEmbeds() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "embed-origins"],
    queryFn: admin.listEmbedOrigins,
  });

  const add = useMutation({
    mutationFn: admin.addEmbedOrigin,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin", "embed-origins"] }),
  });

  const remove = useMutation({
    mutationFn: admin.removeEmbedOrigin,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin", "embed-origins"] }),
  });

  const [origin, setOrigin] = useState("");
  const [label, setLabel] = useState("");

  if (isError) {
    return (
      <Panel title="Embed origins">
        <div className="text-sm text-rose-300">
          Unauthorised. Set an admin bearer token first.
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Embed origins</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Domains allowed to consume the public read / SSE endpoints when an
          embed-scope token is presented. Used by{" "}
          <code className="text-neutral-300">@wigtoken-temp/widget</code>.
        </p>
      </header>

      <Panel title="Add origin">
        <form
          className="flex flex-wrap gap-3 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (!origin) return;
            add.mutate(
              { origin, label: label || undefined },
              {
                onSuccess: () => {
                  setOrigin("");
                  setLabel("");
                },
              }
            );
          }}
        >
          <Field label="Origin">
            <input
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="https://example.com"
              required
              className="input min-w-[280px]"
            />
          </Field>
          <Field label="Label (optional)">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="company hero page"
              className="input"
            />
          </Field>
          <button
            disabled={add.isPending}
            type="submit"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium hover:bg-accent-fg disabled:opacity-50"
          >
            Add
          </button>
        </form>
        {add.isError && (
          <div className="mt-3 text-xs text-rose-400">
            {(add.error as Error)?.message ?? "Failed to add origin."}
          </div>
        )}
        <style>{`
          .input { background: #0a0a0a; border: 1px solid #262626; border-radius: 6px; padding: 6px 10px; font-size: 13px; color: #fafafa; }
          .input:focus { outline: 2px solid #7c3aed; outline-offset: -1px; }
        `}</style>
      </Panel>

      <Panel title="Allowed origins" hint={`${data?.origins?.length ?? 0}`}>
        {isLoading ? (
          <div className="text-sm text-neutral-500">Loading…</div>
        ) : (data?.origins ?? []).length === 0 ? (
          <div className="text-sm text-neutral-500">
            No origins yet. Add one to allow a widget host to read.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="text-left py-2">Origin</th>
                <th className="text-left py-2">Label</th>
                <th className="text-left py-2">Added</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(data?.origins ?? []).map((o) => (
                <tr key={o.id} className="border-t border-neutral-900">
                  <td className="py-2 font-mono text-xs">{o.origin}</td>
                  <td className="py-2 text-neutral-400">{o.label ?? "—"}</td>
                  <td className="py-2 text-neutral-500 text-xs">
                    {fmtDateTime(o.createdAt)}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${o.origin}?`)) remove.mutate(o.id);
                      }}
                      className="text-xs text-rose-400 hover:text-rose-300"
                    >
                      remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="Embed snippet">
        <p className="text-sm text-neutral-400 mb-3">
          Once an origin is whitelisted, embed the widget on that domain with a
          React app:
        </p>
        <pre className="bg-neutral-950 border border-neutral-800 rounded p-3 text-xs overflow-auto">
{`import { TokenCounter, ProviderConfig } from '@wigtoken-temp/widget';

<ProviderConfig server="${typeof window !== "undefined" ? window.location.origin : "https://your-server"}" token="emb_…">
  <TokenCounter style="hero" />
</ProviderConfig>`}
        </pre>
      </Panel>
    </div>
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
