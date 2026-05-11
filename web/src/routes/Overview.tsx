import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usage, type Totals } from "@/api/client";
import { subscribeToUsageStream } from "@/api/stream";
import Stat from "@/components/Stat";
import Panel from "@/components/Panel";
import BurnRateChart from "@/components/charts/BurnRateChart";
import ModelDonut from "@/components/charts/ModelDonut";
import RankingBar from "@/components/charts/RankingBar";
import TimeRangePicker, {
  timeRangeFor,
  type TimeRangeKey,
} from "@/components/TimeRangePicker";
import { fmtCost, fmtNumber, weightedTokens } from "@/lib/format";

const ZERO: Totals = {
  input: 0,
  cacheCreation: 0,
  cacheRead: 0,
  output: 0,
  sum: 0,
  messages: 0,
  costUsd: 0,
};

export default function Overview() {
  const [range, setRange] = useState<TimeRangeKey>("7d");

  // REST snapshot + SSE for live totals.
  const { data } = useQuery({
    queryKey: ["usage", "totals"],
    queryFn: usage.totals,
  });
  const [live, setLive] = useState<Totals | null>(null);
  useEffect(() => {
    const off = subscribeToUsageStream((msg) => setLive(msg.totals));
    return off;
  }, []);
  const totals = live ?? data?.totals ?? ZERO;

  const { data: tsData } = useQuery({
    queryKey: ["usage", "timeseries", range],
    queryFn: () => usage.timeseries(timeRangeFor(range)),
    refetchInterval: 30_000,
  });

  const { data: userLb } = useQuery({
    queryKey: ["usage", "leaderboard", "user"],
    queryFn: () => usage.leaderboard("user", 10),
    refetchInterval: 30_000,
  });

  const { data: familyLb } = useQuery({
    queryKey: ["usage", "leaderboard", "model_family"],
    queryFn: () => usage.leaderboard("model_family", 10),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Overview</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Live aggregated usage across every connected machine and user.
          </p>
        </div>
        <TimeRangePicker value={range} onChange={setRange} />
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Messages" value={fmtNumber(totals.messages)} />
        <Stat
          label="Tokens (raw)"
          value={fmtNumber(totals.sum)}
          sub="input + cache_creation + cache_read + output"
        />
        <Stat
          label="Tokens (weighted)"
          value={fmtNumber(weightedTokens(totals))}
          sub="cache_read ×0.1, output ×5 (vs input)"
        />
        <Stat
          label="Estimated cost"
          value={fmtCost(totals.costUsd)}
          sub="public API rates · estimate only"
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel
          title="Burn rate"
          hint={range}
          className="lg:col-span-2"
        >
          <BurnRateChart
            buckets={tsData?.buckets ?? []}
            field="tokensWeighted"
            height={240}
          />
        </Panel>
        <Panel title="Cost by model family">
          <ModelDonut
            entries={(familyLb?.entries ?? []).map((e) => ({
              family: e.key,
              value: e.costUsd,
            }))}
            unit=" USD"
          />
        </Panel>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Top users by cost (USD)">
          <RankingBar
            entries={(userLb?.entries ?? []).map((e) => ({
              key: e.key,
              value: e.costUsd,
            }))}
            field="cost"
            formatter={fmtCost}
          />
        </Panel>
        <Panel title="Top users by weighted tokens">
          <RankingBar
            entries={(userLb?.entries ?? []).map((e) => ({
              key: e.key,
              value: e.weightedInputEq,
            }))}
            field="weighted tokens"
          />
        </Panel>
      </section>
    </div>
  );
}
