import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";

export type BadgeTone = "neutral" | "brand" | "info" | "success" | "warning" | "danger" | "premium" | "outline";

const TONE: Record<BadgeTone, string> = {
  neutral: "bg-subtle text-ink-2 ring-line",
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  warning: "bg-amber-50 text-amber-900 ring-amber-200",
  danger: "bg-rose-50 text-rose-800 ring-rose-200",
  premium: "bg-gradient-to-r from-amber-50 to-orange-50 text-amber-900 ring-amber-300/70",
  outline: "bg-surface text-ink-2 ring-line-strong",
};

const DOT: Record<BadgeTone, string> = {
  neutral: "bg-slate-400",
  brand: "bg-brand-500",
  info: "bg-sky-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  premium: "bg-amber-500",
  outline: "bg-slate-400",
};

export interface BadgeProps {
  tone?: BadgeTone;
  size?: "sm" | "md";
  /** Leading status dot. */
  dot?: boolean;
  icon?: IconName;
  title?: string;
  className?: string;
  children: ReactNode;
}

/** Small label pill. Status meaning must also be in the text (never colour alone). */
export function Badge({ tone = "neutral", size = "sm", dot, icon, title, className, children }: BadgeProps) {
  return (
    <span
      title={title}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ring-1 ring-inset",
        size === "sm" ? "h-5 px-2 text-[11.5px]" : "h-6 px-2.5 text-xs",
        TONE[tone],
        className,
      )}
    >
      {dot && <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", DOT[tone])} />}
      {icon && <Icon name={icon} size={size === "sm" ? 12 : 13} />}
      {children}
    </span>
  );
}
