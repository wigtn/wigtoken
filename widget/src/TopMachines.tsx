import { TopUsers, type TopUsersProps } from "./TopUsers";

export type TopMachinesProps = Omit<TopUsersProps, "title"> & { title?: string };

export function TopMachines(props: TopMachinesProps) {
  return <TopUsers {...props} title={props.title ?? "Top machines"} />;
}
