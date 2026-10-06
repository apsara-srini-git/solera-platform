"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Renders `children` normally, or `fallback` when the current path starts with one of `prefixes`.
 * Used by the app shell to swap sponsor navigation for a neutral bar on hospital-facing pages (/q, /optout).
 */
export function RouteSwitch({ prefixes, children, fallback = null }: { prefixes: string[]; children: ReactNode; fallback?: ReactNode }) {
  const path = usePathname() ?? "/";
  const hit = prefixes.some((p) => path === p || path.startsWith(p + "/"));
  return <>{hit ? fallback : children}</>;
}
