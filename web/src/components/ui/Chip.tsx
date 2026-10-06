"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";
import { useLang } from "@/lib/i18n/context";
import { UI } from "@/lib/i18n/pro/ui";

export interface ChipProps {
  children: ReactNode;
  icon?: IconName;
  /** Shows an × button. */
  onRemove?: () => void;
  /** Accessible name of the × button (default "Remove" / "Quitar", in the page language). */
  removeLabel?: string;
  className?: string;
}

/** Static or removable tag (e.g. an applied filter). */
export function Chip({ children, icon, onRemove, removeLabel, className }: ChipProps) {
  const defaultRemove = UI[useLang()].remove;
  return (
    <span className={cx("inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-surface pr-1 pl-2.5 text-[13px] text-ink-2 shadow-xs", !onRemove && "pr-2.5", className)}>
      {icon && <Icon name={icon} size={13} className="text-muted" />}
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={removeLabel ?? defaultRemove} className="grid h-5 w-5 place-items-center rounded-full text-muted hover:bg-subtle hover:text-ink">
          <Icon name="x" size={12} strokeWidth={2.25} />
        </button>
      )}
    </span>
  );
}

export interface ToggleChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  pressed: boolean;
  onPressedChange?: (pressed: boolean) => void;
  icon?: IconName;
  /** Small count after the label. */
  count?: number;
}

/** Filter toggle (aria-pressed). Use for multi-select facets like equipment or ownership. */
export function ToggleChip({ pressed, onPressedChange, icon, count, className, children, onClick, ...rest }: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={(e) => {
        onClick?.(e);
        onPressedChange?.(!pressed);
      }}
      className={cx(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition duration-150",
        pressed
          ? "border-brand-600 bg-brand-50 text-brand-800 shadow-[inset_0_0_0_1px_var(--color-brand-600)]"
          : "border-line-strong bg-surface text-ink-2 hover:border-ink-2/40 hover:text-ink",
        className,
      )}
      {...rest}
    >
      {pressed ? <Icon name="check" size={13} strokeWidth={2.5} /> : icon ? <Icon name={icon} size={14} /> : null}
      {children}
      {count != null && <span className={cx("num text-xs", pressed ? "text-brand-700" : "text-muted")}>{count}</span>}
    </button>
  );
}
