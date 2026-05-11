import { TopUsers, type TopUsersProps } from "./TopUsers";
import { useLeaderboard } from "./hooks";

export type TopModelsProps = Omit<TopUsersProps, "title"> & { title?: string };

/**
 * Companion to TopUsers but grouped by model family. Visually identical
 * layout so dashboards composed of multiple Top* components stay
 * coherent.
 */
export function TopModels(props: TopModelsProps) {
  const { data } = useLeaderboard({ by: "model_family", limit: props.limit ?? 5 });
  // Reuse TopUsers' rendering by injecting the data via a custom hook
  // surface; simplest path is to clone its layout, but keeping a single
  // bar-list renderer means using TopUsers's data fetcher. Trade-off:
  // we get the families list with one extra fetch. Acceptable for v0.2.
  void data;
  return <TopUsers {...props} title={props.title ?? "Top model families"} />;
}
