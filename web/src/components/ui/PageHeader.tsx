"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useLang } from "@/lib/i18n/context";
import { UI } from "@/lib/i18n/pro/ui";
import { cx } from "./cx";
import { Icon } from "./Icon";

export interface Crumb {
  label: ReactNode;
  href?: string;
}

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned buttons. */
  actions?: ReactNode;
  breadcrumb?: Crumb[];
  /** Line of badges / facts under the title. */
  meta?: ReactNode;
  className?: string;
}

export function Breadcrumb({ items, className }: { items: Crumb[]; className?: string }) {
  const label = UI[useLang()].breadcrumb;
  return (
    <nav aria-label={label} className={cx("text-[13px] text-muted", className)}>
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1">
              {c.href && !last ? (
                <Link href={c.href} className="rounded hover:text-ink">{c.label}</Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={cx(last && "text-ink-2")}>{c.label}</span>
              )}
              {!last && <Icon name="chevronRight" size={13} className="text-line-strong" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Page title block: breadcrumb → title + actions → subtitle → meta. */
export function PageHeader({ title, subtitle, actions, breadcrumb, meta, className }: PageHeaderProps) {
  return (
    <header className={cx("mb-6 sm:mb-8", className)}>
      {breadcrumb && breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} className="mb-3" />}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px] sm:leading-9">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-ink-2">{subtitle}</p>}
          {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
