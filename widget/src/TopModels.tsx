import { Leaderboard } from "./TopUsers";
import { useLeaderboard } from "./hooks";
import type { TopUsersProps } from "./TopUsers";

export type TopModelsProps = Omit<TopUsersProps, "title"> & { title?: string };

/**
 * Top model families ranked by the picked metric. Visually identical
 * to TopUsers — same Leaderboard renderer — but fed from the
 * `by=model_family` leaderboard endpoint.
 */
export function TopModels({
  limit = 5,
  metric = "costUsd",
  size = "md",
  theme = "auto",
  density = "normal",
  title = "Top model families",
  locale,
  containerStyle,
  className,
}: TopModelsProps) {
  const { data } = useLeaderboard({ by: "model_family", limit });
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
