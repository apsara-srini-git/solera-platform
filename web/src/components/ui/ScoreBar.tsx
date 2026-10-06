import { scoreColor } from "@/lib/score-scale";
import { cx } from "./cx";

export interface ScoreBarProps {
  /** 0–100 */
  value: number;
  size?: "xs" | "sm" | "md";
  /** "score" colours by the shared score scale; "neutral" uses one quiet brand tone (for shares / magnitudes that are not scores). */
  tone?: "score" | "neutral";
  /** Accessible name, e.g. "Recruitment experience". */
  label?: string;
  className?: string;
}

/** Thin horizontal meter with rounded data end. */
export function ScoreBar({ value, size = "md", tone = "score", label, className }: ScoreBarProps) {
  const v = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  const fill = tone === "score" ? scoreColor(v).fill : "var(--color-brand-400)";
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
      aria-label={label}
      className={cx("w-full overflow-hidden rounded-full bg-subtle ring-1 ring-line/70 ring-inset", size === "xs" ? "h-1" : size === "sm" ? "h-1.5" : "h-2", className)}
    >
      <div className="h-full rounded-full transition-[width] duration-500 ease-out-soft" style={{ width: `${v}%`, background: fill, minWidth: v > 0 ? 4 : 0 }} />
    </div>
  );
}
