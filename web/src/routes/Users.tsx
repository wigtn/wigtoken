import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { usage } from "@/api/client";
import Panel from "@/components/Panel";
import Stat from "@/components/Stat";
import RankingBar from "@/components/charts/RankingBar";
import ModelDonut from "@/components/charts/ModelDonut";
import { fmtCost, fmtNumber } from "@/lib/format";

export default function Users() {
  const { name } = useParams();
  return name ? <UserDetail user={name} /> : <UsersList />;
}

function UsersList() {
  const { data, isLoading } = useQuery({
    queryKey: ["usage", "leaderboard", "user", "full"],
    queryFn: () => usage.leaderboard("user", 100),
    refetchInterval: 30_000,
  });
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Click any user for per-machine and per-model breakdown.
        </p>
      </header>
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
      <Panel title="All users">
        {isLoading ? (
          <div className="text-sm text-neutral-500">Loading…</div>
        ) : (
          <table className="w-full text-sm tabular-nums">
            <thead className="text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="text-left py-2">User</th>
                <th className="text-right py-2">Messages</th>
                <th className="text-right py-2">Cost USD</th>
                <th className="text-right py-2">Weighted tokens</th>
              </tr>
            </thead>
            <tbody>
              {(data?.entries ?? []).map((e) => (
                <tr
                  key={e.key}
                  className="border-t border-neutral-900 hover:bg-neutral-900/50"
                >
                  <td className="py-2">
                    <Link
                      to={`/users/${encodeURIComponent(e.key)}`}
                      className="text-accent-fg underline underline-offset-2"
                    >
                      {e.key}
                    </Link>
                  </td>
                  <td className="text-right py-2">{fmtNumber(e.messages)}</td>
                  <td className="text-right py-2">{fmtCost(e.costUsd)}</td>
                  <td className="text-right py-2">
                    {fmtNumber(e.weightedInputEq)}
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

function UserDetail({ user }: { user: string }) {
  const { data } = useQuery({
    queryKey: ["usage", "users", user],
    queryFn: () => usage.userDetail(user),
    refetchInterval: 30_000,
  });

  if (!data) {
    return <div className="text-sm text-neutral-500">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <header>
        <Link
          to="/users"
          className="text-xs text-neutral-500 hover:text-neutral-300"
        >
          ← back to users
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{user}</h1>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Messages" value={fmtNumber(data.totals.messages)} />
        <Stat
          label="Tokens (weighted)"
          value={fmtNumber(data.totals.weightedInputEq)}
        />
        <Stat
          label="Estimated cost"
          value={fmtCost(data.totals.costUsd)}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="By model family">
          <ModelDonut
            entries={data.perFamily.map((f) => ({
              family: f.modelFamily,
              value: f.costUsd,
            }))}
            unit=" USD"
          />
        </Panel>
        <Panel title="By machine">
          <RankingBar
            entries={data.perMachine.map((m) => ({
              key: m.machine,
              value: m.costUsd,
            }))}
            field="cost"
            formatter={fmtCost}
          />
        </Panel>
      </section>
    </div>
  );
}
