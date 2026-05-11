import type { CSSProperties, ReactNode } from "react";

export interface StatGridProps {
  children: ReactNode;
  columns?: number;
  gap?: number;
  containerStyle?: CSSProperties;
  className?: string;
}

/** CSS grid layout helper for arranging MetricCards. */
export function StatGrid({
  children,
  columns = 4,
  gap = 12,
  containerStyle,
  className,
}: StatGridProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap,
        ...containerStyle,
      }}
      className={className}
    >
      {children}
    </div>
  );
}
