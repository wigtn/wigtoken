import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Entry {
  key: string;
  value: number;
}

interface Props {
  entries: Entry[];
  field: string;
  formatter?: (v: number) => string;
  height?: number;
}

export default function RankingBar({
  entries,
  field,
  formatter,
  height,
}: Props) {
  const data = entries.filter((e) => e.value > 0);
  if (data.length === 0) {
    return (
      <div className="text-sm text-neutral-500 text-center py-12">
        No data yet.
      </div>
    );
  }
  const computedHeight = height ?? Math.max(160, data.length * 32);
  return (
    <ResponsiveContainer width="100%" height={computedHeight}>
      <BarChart data={data} layout="vertical" margin={{ left: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
        <XAxis
          type="number"
          stroke="#525252"
          fontSize={11}
          tickFormatter={(v) => (formatter ? formatter(v) : v.toLocaleString())}
        />
        <YAxis
          type="category"
          dataKey="key"
          stroke="#a3a3a3"
          fontSize={12}
          width={100}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#0a0a0a",
            border: "1px solid #262626",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v: number) => [
            formatter ? formatter(v) : v.toLocaleString(),
            field,
          ]}
        />
        <Bar dataKey="value" fill="#7c3aed" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
