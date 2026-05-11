interface Props {
  label: string;
  value: string;
  sub?: string;
}

export default function Stat({ label, value, sub }: Props) {
  return (
    <div className="panel">
      <div className="panel-title">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
