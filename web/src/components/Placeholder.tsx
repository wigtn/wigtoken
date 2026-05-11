/**
 * Stub panel used by routes that aren't fleshed out yet. Lets the side
 * nav and routing settle into place before each detail view is wired
 * up against the real API.
 */

interface Props {
  title: string;
  description: string;
}

export default function Placeholder({ title, description }: Props) {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-neutral-400">{description}</p>
      </header>
      <div className="panel">
        <div className="panel-title">coming soon</div>
        <div className="mt-2 text-sm text-neutral-500">
          This view is part of P7's second pass. The data path is already
          available via <code className="text-neutral-300">/api/usage/breakdown</code>{" "}
          and <code className="text-neutral-300">/api/usage/timeseries</code>;
          the UI is just stubbed for now.
        </div>
      </div>
    </div>
  );
}
