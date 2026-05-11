import { useQuery } from "@tanstack/react-query";
import { usage } from "@/api/client";
import Panel from "@/components/Panel";
import { fmtCost, fmtNumber, fmtRelativeTime } from "@/lib/format";

export default function Sessions() {
  const { data } = useQuery({
    queryKey: ["usage", "recent"],
    queryFn: () => usage.recent(100),
    refetchInterval: 15_000,
  });

  const entries = data?.entries ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Recent activity</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Last 100 messages — newest first. Per-session aggregation lands in P12.
        </p>
      </header>

      <Panel title="Activity feed" hint={`${entries.length} entries`}>
        {entries.length === 0 ? (
          <div className="text-sm text-neutral-500">No messages yet.</div>
        ) : (
          <div className="divide-y divide-neutral-900">
            {entries.map((m, i) => (
              <div
                key={`${m.ts}-${i}`}
                className="py-2 flex items-baseline justify-between text-sm"
              >
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="font-medium text-neutral-200 truncate">
                    {m.user}
                  </span>
                  <span className="text-xs text-neutral-500">
                    @ {m.machine}
                  </span>
                  <span
                    className={
                      "text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 " +
                      (m.modelFamily === "opus"
                        ? "bg-violet-500/15 text-violet-300"
                        : m.modelFamily === "sonnet"
                          ? "bg-teal-500/15 text-teal-300"
                          : m.modelFamily === "haiku"
                            ? "bg-amber-500/15 text-amber-300"
                            : "bg-neutral-700/40 text-neutral-300")
                    }
                  >
                    {m.modelFamily}
                  </span>
                </div>
                <div className="flex items-baseline gap-4 text-xs tabular-nums">
                  <span className="text-neutral-500">
                    {fmtNumber(m.weightedInputEq)} weighted
                  </span>
                  <span className="text-neutral-300">{fmtCost(m.costUsd)}</span>
                  <span className="text-neutral-600 w-16 text-right">
                    {fmtRelativeTime(m.ts)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
