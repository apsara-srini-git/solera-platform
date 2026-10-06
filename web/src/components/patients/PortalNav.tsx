"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

export interface PortalNavItem {
  href: string;
  label: string;
  /** Path prefixes that also mark this item as current. */
  also?: string[];
}

function isActive(path: string, item: PortalNavItem) {
  if (path === item.href) return true;
  return (item.also ?? []).some((p) => path === p || path.startsWith(p + "/"));
}

/** Portal navigation (desktop row + phone menu items). */
export function PortalNav({ items, label, variant }: { items: PortalNavItem[]; label: string; variant: "bar" | "menu" }) {
  const path = usePathname() ?? "/pacientes";
  return (
    <nav aria-label={label} className={variant === "bar" ? "hidden items-center gap-1 md:flex" : "grid gap-0.5"}>
      {items.map((it) => {
        const active = isActive(path, it);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            onClick={variant === "menu" ? (e) => e.currentTarget.closest("details")?.removeAttribute("open") : undefined}
            className={cx(
              variant === "bar"
                ? "relative inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium transition"
                : "flex items-center rounded-lg px-3 py-2.5 text-[15px] font-medium",
              active ? "text-ink" : "text-ink-2 hover:bg-subtle hover:text-ink",
              active && variant === "bar" && "after:absolute after:inset-x-3 after:-bottom-[11px] after:h-0.5 after:rounded-full after:bg-brand-600",
              active && variant === "menu" && "bg-brand-50 text-brand-800",
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
