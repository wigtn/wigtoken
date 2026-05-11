import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface Props {
  entries: Array<{ family: string; value: number }>;
  unit?: string;
  height?: number;
}

const COLOR: Record<string, string> = {
  opus: "#8b5cf6",
  sonnet: "#14b8a6",
  haiku: "#f59e0b",
  unknown: "#6b7280",
};

export default function ModelDonut({ entries, unit = "", height = 240 }: Props) {
  const data = entries.filter((e) => e.value > 0);
  if (data.length === 0) {
    return (
      <div className="text-sm text-neutral-500 text-center py-12">
        No usage recorded yet.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="family"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
          stroke="#0a0a0a"
        >
          {data.map((entry) => (
            <Cell
              key={entry.family}
              fill={COLOR[entry.family] ?? "#6b7280"}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "#0a0a0a",
            border: "1px solid #262626",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v: number) => [`${v.toLocaleString()}${unit}`, "value"]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
