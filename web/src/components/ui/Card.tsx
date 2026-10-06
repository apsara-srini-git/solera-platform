import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

type Padding = "none" | "sm" | "md" | "lg";
const PAD: Record<Padding, string> = { none: "", sm: "p-3", md: "p-5", lg: "p-6 sm:p-8" };

export interface CardProps extends HTMLAttributes<HTMLElement> {
  padding?: Padding;
  /** Hover lift + border for clickable cards (wrap in a Link or put a stretched link inside). */
  interactive?: boolean;
  as?: "div" | "section" | "article" | "li";
}

/** White surface with hairline border and soft shadow. */
export function Card({ padding = "md", interactive, as: Tag = "div", className, ...rest }: CardProps) {
  const T = Tag as "div";
  return <T className={cx(interactive ? "card-interactive" : "card", PAD[padding], "relative", className)} {...rest} />;
}

/** Titled section inside a Card: header row with optional actions, then content. */
export function CardHeader({ title, subtitle, actions, className }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Full-width divider row inside a padded Card (negative margins match padding="md"). */
export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("-mx-5 -mb-5 mt-5 flex items-center justify-end gap-2 rounded-b-xl border-t border-line bg-subtle/60 px-5 py-3", className)} {...rest} />;
}
