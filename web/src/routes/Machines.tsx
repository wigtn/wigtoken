import { useQuery } from "@tanstack/react-query";
import { usage } from "@/api/client";
import Panel from "@/components/Panel";
import RankingBar from "@/components/charts/RankingBar";
import { fmtCost, fmtNumber } from "@/lib/format";

export default function Machines() {
  const { data } = useQuery({
    queryKey: ["usage", "leaderboard", "machine"],
    queryFn: () => usage.leaderboard("machine", 50),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Machines</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Compare cost contribution across hosts (CI runners vs personal
          laptops, e.g.).
        </p>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="By cost (USD)">
          <RankingBar
            entries={(data?.entries ?? []).map((e) => ({
              key: e.key,
              value: e.costUsd,
            }))}
            field="cost"
            formatter={fmtCost}
          />
        </Panel>
        <Panel title="By weighted tokens">
          <RankingBar
            entries={(data?.entries ?? []).map((e) => ({
              key: e.key,
              value: e.weightedInputEq,
            }))}
            field="weighted tokens"
          />
        </Panel>
      </section>

      <Panel title="All machines">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-xs uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="text-left py-2">Machine</th>
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
    </div>
  );
}
