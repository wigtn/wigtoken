import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usage } from "@/api/client";
import Panel from "@/components/Panel";
import BurnRateChart from "@/components/charts/BurnRateChart";
import TimeRangePicker, {
  timeRangeFor,
  type TimeRangeKey,
} from "@/components/TimeRangePicker";

type Field = "tokensWeighted" | "tokensRaw" | "costUsd" | "messages";

const FIELDS: Array<{ key: Field; label: string }> = [
  { key: "tokensWeighted", label: "Weighted tokens" },
  { key: "tokensRaw", label: "Raw tokens" },
  { key: "costUsd", label: "Cost (USD)" },
  { key: "messages", label: "Messages" },
];

export default function Timeseries() {
  const [range, setRange] = useState<TimeRangeKey>("7d");
  const [field, setField] = useState<Field>("tokensWeighted");

  const { data } = useQuery({
    queryKey: ["usage", "timeseries", range],
    queryFn: () => usage.timeseries(timeRangeFor(range)),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Timeseries</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Burn rate over time, bucketed by the picked range.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={field}
            onChange={(e) => setField(e.target.value as Field)}
            className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs"
          >
            {FIELDS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
          <TimeRangePicker value={range} onChange={setRange} />
        </div>
      </header>

      <Panel title={FIELDS.find((f) => f.key === field)!.label} hint={range}>
        <BurnRateChart
          buckets={data?.buckets ?? []}
          field={field}
          height={360}
        />
      </Panel>
    </div>
  );
}
