"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";

export interface SegmentOption<V extends string> {
  value: V;
  label: ReactNode;
  icon?: IconName;
  /** Link mode (server-friendly): each option navigates. */
  href?: string;
  /** Hide the text label on phones (icon only). */
  compactLabel?: boolean;
}

export interface SegmentedControlProps<V extends string> {
  options: SegmentOption<V>[];
  value: V;
  /** Button mode. Omit and give options hrefs for link mode. */
  onChange?: (value: V) => void;
  size?: "sm" | "md";
  /** Accessible name of the group, e.g. "View". */
  label: string;
  className?: string;
}

/**
 * Pill switch for 2–4 mutually exclusive views (List | Map | Split).
 * <SegmentedControl label="View" value={view} onChange={setView}
 *   options={[{value:"list",label:"List",icon:"list"},{value:"map",label:"Map",icon:"map"},{value:"split",label:"Split",icon:"split"}]} />
 */
export function SegmentedControl<V extends string>({ options, value, onChange, size = "md", label, className }: SegmentedControlProps<V>) {
  return (
    <div role="radiogroup" aria-label={label} className={cx("inline-flex items-center gap-0.5 rounded-lg bg-subtle p-0.5 ring-1 ring-line ring-inset", className)}>
      {options.map((o) => {
        const active = o.value === value;
        const cls = cx(
          "inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition duration-150",
          size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]",
          active ? "bg-surface text-ink shadow-card ring-1 ring-line" : "text-muted hover:text-ink",
        );
        const inner = (
          <>
            {o.icon && <Icon name={o.icon} size={size === "sm" ? 13 : 15} />}
            <span className={cx(o.compactLabel && o.icon && "hidden sm:inline")}>{o.label}</span>
          </>
        );
        return o.href && !onChange ? (
          <Link key={o.value} href={o.href} role="radio" aria-checked={active} className={cls} scroll={false}>{inner}</Link>
        ) : (
          <button key={o.value} type="button" role="radio" aria-checked={active} className={cls} onClick={() => onChange?.(o.value)}>{inner}</button>
        );
      })}
    </div>
  );
}
