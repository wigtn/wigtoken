// Provider + headless hooks
export {
  ProviderConfig,
  useTotals,
  useProviderStatus,
  useWigtnContext,
} from "./ProviderConfig";
export type { ProviderConfigProps } from "./ProviderConfig";

export { useTimeseries, useLeaderboard, useRecent } from "./hooks";
export type {
  TimeseriesBucket,
  UseTimeseriesOpts,
  LeaderboardEntry,
  UseLeaderboardOpts,
  RecentMessage,
} from "./hooks";

// Counter components
export { TokenCounter } from "./TokenCounter";
export type { TokenCounterProps } from "./TokenCounter";

export { CostCounter } from "./CostCounter";
export type { CostCounterProps } from "./CostCounter";

export { WeightedTokenCounter } from "./WeightedTokenCounter";

export { MessageCounter } from "./MessageCounter";
export type { MessageCounterProps } from "./MessageCounter";

// Charts / lists
export { BurnSparkline } from "./BurnSparkline";
export type { BurnSparklineProps } from "./BurnSparkline";

export { TopUsers } from "./TopUsers";
export type { TopUsersProps } from "./TopUsers";

export { TopModels } from "./TopModels";
export type { TopModelsProps } from "./TopModels";

export { TopMachines } from "./TopMachines";
export type { TopMachinesProps } from "./TopMachines";

export { RecentActivity } from "./RecentActivity";
export type { RecentActivityProps } from "./RecentActivity";

export { LiveTicker } from "./LiveTicker";
export type { LiveTickerProps } from "./LiveTicker";

export { ModelLegend } from "./ModelLegend";
export type { ModelLegendProps } from "./ModelLegend";

// Status / chrome
export { EmbedPulseDot } from "./EmbedPulseDot";
export type { EmbedPulseDotProps } from "./EmbedPulseDot";

// Layout primitives
export { MetricCard } from "./MetricCard";
export type { MetricCardProps } from "./MetricCard";

export { StatGrid } from "./StatGrid";
export type { StatGridProps } from "./StatGrid";

// Theme tokens (consumers wiring their own styles)
export type { Theme, Size, Variant, Density, FormatMode } from "./theme";

// Public types
export type { Totals, TotalsEnvelope, CounterStyle } from "./types";
