import { useQuery } from "@tanstack/react-query";
import { usage } from "@/api/client";
import Panel from "@/components/Panel";
import ModelDonut from "@/components/charts/ModelDonut";
import RankingBar from "@/components/charts/RankingBar";
import { fmtCost, fmtNumber } from "@/lib/format";

export default function Models() {
  const { data } = useQuery({
    queryKey: ["usage", "leaderboard", "model_family", "full"],
    queryFn: () => usage.leaderboard("model_family", 50),
    refetchInterval: 30_000,
  });

  const { data: breakdown } = useQuery({
    queryKey: ["usage", "breakdown"],
    queryFn: usage.breakdown,
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Models</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Cost and message distribution across Opus / Sonnet / Haiku families.
        </p>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Cost by family">
          <ModelDonut
            entries={(data?.entries ?? []).map((e) => ({
              family: e.key,
              value: e.costUsd,
            }))}
            unit=" USD"
          />
        </Panel>
        <Panel title="Messages by family">
          <RankingBar
            entries={(data?.entries ?? []).map((e) => ({
              key: e.key,
              value: e.messages,
            }))}
            field="messages"
          />
        </Panel>
      </section>

      <Panel title="Cost by family (table)">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-xs uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="text-left py-2">Family</th>
              <th className="text-right py-2">Messages</th>
              <th className="text-right py-2">Cost USD</th>
              <th className="text-right py-2">Weighted tokens</th>
            </tr>
          </thead>
          <tbody>
            {(data?.entries ?? []).map((e) => (
              <tr key={e.key} className="border-t border-neutral-900">
                <td className="py-2">{e.key}</td>
                <td className="text-right py-2">{fmtNumber(e.messages)}</td>
                <td className="text-right py-2">{fmtCost(e.costUsd)}</td>
                <td className="text-right py-2">
                  {fmtNumber(e.weightedInputEq)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Per-model token kind breakdown">
        <table className="w-full text-xs tabular-nums">
          <thead className="text-[10px] uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="text-left py-2">User</th>
              <th className="text-left py-2">Machine</th>
              <th className="text-left py-2">Model</th>
              <th className="text-left py-2">Kind</th>
              <th className="text-right py-2">Tokens</th>
            </tr>
          </thead>
          <tbody>
            {(breakdown?.tokens ?? []).map((r, i) => (
              <tr
                key={`${r.user}-${r.machine}-${r.model}-${r.kind}-${i}`}
                className="border-t border-neutral-900"
              >
                <td className="py-1.5">{r.user}</td>
                <td>{r.machine}</td>
                <td>{r.model}</td>
                <td>{r.kind}</td>
                <td className="text-right">{fmtNumber(r.tokens)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
