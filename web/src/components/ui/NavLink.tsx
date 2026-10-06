"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cx } from "./cx";

/** Header navigation link with active state. `match="prefix"` keeps it active on sub-routes. */
export function NavLink({ href, children, match = "prefix", also = [], className }: { href: string; children: ReactNode; match?: "exact" | "prefix"; also?: string[]; className?: string }) {
  const path = usePathname() ?? "/";
  const test = (h: string) => (match === "exact" || h === "/" ? path === h : path === h || path.startsWith(h + "/"));
  const active = test(href) || also.some(test);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "relative inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium transition",
        active ? "text-ink" : "text-muted hover:bg-subtle hover:text-ink",
        active && "after:absolute after:inset-x-3 after:-bottom-[11px] after:h-0.5 after:rounded-full after:bg-brand-600",
        className,
      )}
    >
      {children}
    </Link>
  );
}
