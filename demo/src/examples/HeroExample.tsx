import {
  StatGrid,
  MetricCard,
  WeightedTokenCounter,
  CostCounter,
  MessageCounter,
  EmbedPulseDot,
  BurnSparkline,
} from "@wigtoken/widget";

export default function HeroExample() {
  return (
    <div>
      <h1 className="text-2xl font-semibold leading-tight">
        Our crew has processed{" "}
        <span className="text-purple-300">
          <WeightedTokenCounter />
        </span>{" "}
        input-equivalent tokens.
      </h1>

      <div className="mt-6">
        <StatGrid>
          <MetricCard
            label="Tokens (weighted)"
            value={<WeightedTokenCounter />}
          />
          <MetricCard label="Cost" value={<CostCounter />} />
          <MetricCard label="Messages" value={<MessageCounter />} />
          <MetricCard label="Status" value={<EmbedPulseDot size="md" />} />
        </StatGrid>
      </div>

      <div className="mt-6">
        <div className="mb-2 text-xs uppercase tracking-wider text-neutral-500">
          Burn (24h)
        </div>
        <BurnSparkline window="24h" height={72} />
      </div>
    </div>
  );
}
