import { Leaderboard } from "./TopUsers";
import { useLeaderboard } from "./hooks";
import type { TopUsersProps } from "./TopUsers";

export type TopMachinesProps = Omit<TopUsersProps, "title"> & { title?: string };

/**
 * Top machines (per-host aggregation). Visually identical to TopUsers
 * — same Leaderboard renderer — but fed from `by=machine`.
 */
export function TopMachines({
  limit = 5,
  metric = "costUsd",
  size = "md",
  theme = "auto",
  density = "normal",
  title = "Top machines",
  locale,
  containerStyle,
  className,
}: TopMachinesProps) {
  const { data } = useLeaderboard({ by: "machine", limit });
  return (
    <Leaderboard
      entries={data?.entries ?? []}
      metric={metric}
      size={size}
      theme={theme}
      density={density}
      title={title}
      locale={locale}
      containerStyle={containerStyle}
      className={className}
    />
  );
}
