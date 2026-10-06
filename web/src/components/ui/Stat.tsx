import type { ReactNode } from "react";
import { cx } from "./cx";

export interface StatProps {
  label: ReactNode;
  value: ReactNode;
  /** Unit after the value, smaller ("beds", "/ month"). */
  unit?: ReactNode;
  /** Secondary line under the value. */
  hint?: ReactNode;
  /** e.g. <SourceBadge …/> */
  source?: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/** Number tile: label above, big tabular number, optional hint + source. Put several in a grid. */
export function Stat({ label, value, unit, hint, source, size = "md", className }: StatProps) {
  return (
    <div className={cx("min-w-0", className)}>
      <div className="text-[12.5px] font-medium text-muted">{label}</div>
      <div className={cx("num mt-1 flex items-baseline gap-1 font-semibold tracking-tight text-ink", size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-2xl")}>
        {value}
        {unit && <span className="text-sm font-medium tracking-normal text-muted">{unit}</span>}
      </div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
      {source && <div className="mt-1.5">{source}</div>}
    </div>
  );
}

/** Row of stats separated by hairlines; wraps to a 2-column grid on phones. */
export function StatGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("grid grid-cols-2 gap-x-6 gap-y-5 sm:flex sm:flex-wrap sm:gap-x-0 sm:divide-x sm:divide-line [&>*]:sm:px-6 [&>*:first-child]:sm:pl-0", className)}>
      {children}
    </div>
  );
}
