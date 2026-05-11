import { useState, type ReactNode } from "react";

interface Props {
  id: string;
  title: string;
  blurb?: string;
  code?: string;
  children: ReactNode;
}

export default function Section({ id, title, blurb, code, children }: Props) {
  const [showCode, setShowCode] = useState(false);
  return (
    <section id={id} className="mt-10 first:mt-6">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {blurb && (
            <p className="mt-0.5 text-xs text-neutral-500">{blurb}</p>
          )}
        </div>
        {code && (
          <button
            type="button"
            onClick={() => setShowCode((v) => !v)}
            className="rounded-md border border-neutral-800 px-2 py-1 text-[11px] text-neutral-400 hover:text-neutral-200"
          >
            {showCode ? "Hide code" : "Show code"}
          </button>
        )}
      </div>
      <div className="rounded-xl border border-neutral-900 bg-neutral-950/60 p-6">
        {children}
      </div>
      {showCode && code && (
        <pre className="mt-2 overflow-x-auto rounded-lg border border-neutral-900 bg-neutral-950 p-4 text-[11px] text-neutral-300">
          <code>{code}</code>
        </pre>
      )}
    </section>
  );
}
