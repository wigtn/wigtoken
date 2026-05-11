import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimeseriesBucket } from "@/api/client";

interface Props {
  buckets: TimeseriesBucket[];
  field?: "tokensWeighted" | "tokensRaw" | "costUsd" | "messages";
  height?: number;
}

const LABEL: Record<NonNullable<Props["field"]>, string> = {
  tokensWeighted: "weighted tokens",
  tokensRaw: "raw tokens",
  costUsd: "cost (USD)",
  messages: "messages",
};

export default function BurnRateChart({
  buckets,
  field = "tokensWeighted",
  height = 240,
}: Props) {
  if (buckets.length === 0) {
    return (
      <div className="text-sm text-neutral-500 text-center py-12">
        No data in this time range yet — try a wider window or wait for new sessions.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={buckets}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis
          dataKey="ts"
          tickFormatter={(v) =>
            new Date(v).toLocaleString(undefined, {
              month: "short",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })
          }
          stroke="#525252"
          fontSize={11}
        />
        <YAxis
          stroke="#525252"
          fontSize={11}
          tickFormatter={(v) =>
            field === "costUsd"
              ? `$${Number(v).toFixed(0)}`
              : Number(v).toLocaleString()
          }
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#0a0a0a",
            border: "1px solid #262626",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(v) => new Date(v).toLocaleString()}
          formatter={(v: number) => [
            field === "costUsd"
              ? `$${v.toFixed(4)}`
              : v.toLocaleString(),
            LABEL[field],
          ]}
        />
        <Line
          type="monotone"
          dataKey={field}
          stroke="#a78bfa"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
