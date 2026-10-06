"use client";

import { useId, useRef, type ReactNode } from "react";
import { useLang } from "@/lib/i18n/context";
import { UI } from "@/lib/i18n/pro/ui";
import { cx } from "./cx";

export interface TooltipProps {
  content: ReactNode;
  side?: "top" | "bottom";
  align?: "center" | "start" | "end";
  className?: string;
  children: ReactNode;
}

/**
 * CSS tooltip: shows on hover and on keyboard focus within the trigger (a small handler keeps it on-screen). Usable from server components (a client
 * component only so InfoTip's default label follows the page language).
 * The trigger should be focusable (a button / link) if the tooltip carries information.
 */
export function Tooltip({ content, side = "top", align = "center", className, children }: TooltipProps) {
  const id = useId();
  const tip = useRef<HTMLSpanElement>(null);
  // Near the screen edge (phones) the CSS position can push the bubble off-screen and cause horizontal scroll:
  // once it is shown, nudge it back inside the viewport.
  const fit = () => {
    const el = tip.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.style.transform = "";
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      const pad = 8, vw = document.documentElement.clientWidth;
      let dx = 0;
      if (r.right > vw - pad) dx = vw - pad - r.right;
      if (r.left + dx < pad) dx = pad - r.left;
      el.style.transform = dx ? `translateX(${Math.round(dx)}px)` : "";
    });
  };
  return (
    <span className={cx("group/tt relative inline-flex", className)} aria-describedby={id} onMouseEnter={fit} onFocus={fit}>
      {children}
      <span
        ref={tip}
        role="tooltip"
        id={id}
        className={cx(
          // display:none until shown, so hidden tooltips never cause horizontal page overflow at the screen edge
          "pointer-events-none absolute z-50 hidden w-max max-w-[min(16rem,calc(100vw-2rem))] rounded-lg bg-ink px-2.5 py-1.5 text-left text-xs leading-snug font-normal text-white shadow-pop",
          "group-hover/tt:block group-focus-within/tt:block",
          side === "top" ? "bottom-full mb-2" : "top-full mt-2",
          align === "center" ? "left-1/2 -translate-x-1/2" : align === "start" ? "left-0" : "right-0",
        )}
      >
        {content}
      </span>
    </span>
  );
}

/** Small (i) button that reveals an explanation. Default accessible name: "More information", in the page language. */
export function InfoTip({ children, label, side, align }: { children: ReactNode; label?: string; side?: "top" | "bottom"; align?: "center" | "start" | "end" }) {
  const defaultLabel = UI[useLang()].moreInfo;
  return (
    <Tooltip content={children} side={side} align={align}>
      <button type="button" aria-label={label ?? defaultLabel} className="inline-grid h-4 w-4 place-items-center rounded-full text-muted hover:text-ink">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 16v-4.5M12 8h.01" />
        </svg>
      </button>
    </Tooltip>
  );
}
