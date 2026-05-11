export type TimeRangeKey = "1h" | "24h" | "7d" | "30d" | "all";

const PRESETS: Record<TimeRangeKey, { label: string; ms: number; step: number }> = {
  "1h": { label: "1h", ms: 60 * 60 * 1000, step: 60 * 1000 },          // 1m buckets
  "24h": { label: "24h", ms: 24 * 60 * 60 * 1000, step: 15 * 60 * 1000 }, // 15m
  "7d": { label: "7d", ms: 7 * 24 * 60 * 60 * 1000, step: 60 * 60 * 1000 }, // 1h
  "30d": { label: "30d", ms: 30 * 24 * 60 * 60 * 1000, step: 6 * 60 * 60 * 1000 }, // 6h
  all: { label: "all", ms: 365 * 24 * 60 * 60 * 1000, step: 24 * 60 * 60 * 1000 }, // 1d
};

interface Props {
  value: TimeRangeKey;
  onChange: (v: TimeRangeKey) => void;
}

export default function TimeRangePicker({ value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-md border border-neutral-800 bg-neutral-900 p-0.5 text-xs">
      {(Object.keys(PRESETS) as TimeRangeKey[]).map((k) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={`px-3 py-1 rounded ${
            value === k
              ? "bg-neutral-700 text-neutral-50"
              : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          {PRESETS[k].label}
        </button>
      ))}
    </div>
  );
}

export function timeRangeFor(key: TimeRangeKey): {
  from: number;
  to: number;
  step: number;
} {
  const now = Date.now();
  const p = PRESETS[key];
  return { from: now - p.ms, to: now, step: p.step };
}
