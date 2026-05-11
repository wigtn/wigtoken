import type { ReactNode } from "react";

interface Props {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

export default function Panel({ title, hint, children, className = "" }: Props) {
  return (
    <div className={`panel ${className}`}>
      <div className="flex items-baseline justify-between">
        <div className="panel-title">{title}</div>
        {hint && (
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">
            {hint}
          </div>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
