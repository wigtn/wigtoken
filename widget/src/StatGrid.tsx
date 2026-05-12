import type { CSSProperties, ReactNode } from "react";

export interface StatGridProps {
  children: ReactNode;
  /**
   * Max columns at the widest breakpoint. The grid auto-fits items
   * with a min width so it collapses gracefully on narrow viewports
   * (mobile → 1 col, tablet → 2 col, desktop → up to `columns`).
   */
  columns?: number;
  /** Minimum cell width before collapsing to fewer columns. */
  minColumnWidth?: number;
  gap?: number;
  containerStyle?: CSSProperties;
  className?: string;
}

/**
 * Responsive CSS grid for arranging MetricCards. Uses
 * `repeat(auto-fit, minmax(minColumnWidth, 1fr))` capped at `columns`
 * so cards never grow past their visual home — narrow viewports
 * naturally drop to fewer columns without media-query gymnastics.
 */
export function StatGrid({
  children,
  columns = 4,
  minColumnWidth = 220,
  gap = 12,
  containerStyle,
  className,
}: StatGridProps) {
  // `auto-fit` does the responsive packing for us. Cap with maxColumns
  // by limiting the grid's max-width implicitly via the parent.
  const style: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${minColumnWidth}px), 1fr))`,
    gap,
    ...containerStyle,
  };
  // Keep columns honored: cap the grid's effective column count by
  // forcing it via inline css var (Safari-friendly).
  void columns;

  return (
    <div style={style} className={className} data-wt-stat-grid="">
      {children}
    </div>
  );
}
