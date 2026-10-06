import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";

export interface EmptyStateProps {
  icon?: IconName;
  title: ReactNode;
  description?: ReactNode;
  /** Buttons / links */
  action?: ReactNode;
  /** Compact = no dashed box, less padding (inside cards). */
  compact?: boolean;
  className?: string;
}

export function EmptyState({ icon = "search", title, description, action, compact, className }: EmptyStateProps) {
  return (
    <div className={cx("flex flex-col items-center text-center", compact ? "px-4 py-8" : "rounded-xl border border-dashed border-line-strong bg-surface/60 px-6 py-14", className)}>
      <div className="grid h-11 w-11 place-items-center rounded-full bg-brand-50 text-brand-600 ring-1 ring-brand-100">
        <Icon name={icon} size={20} />
      </div>
      <h3 className="mt-4 text-[15px] font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
