import type { ReactNode } from "react";
import { Tooltip } from "@/components/ui";

/** Small "?" that explains a term in plain words (hover or keyboard focus). Server-safe. */
export default function HelpTip({ children, label, align = "center", side = "top" }: {
  children: ReactNode;
  /** Accessible name of the "?" button (in the sponsor's UI language). */
  label: string;
  align?: "center" | "start" | "end";
  side?: "top" | "bottom";
}) {
  return (
    <Tooltip content={children} align={align} side={side} className="align-middle">
      <button
        type="button"
        aria-label={label}
        className="inline-grid h-4 w-4 shrink-0 cursor-help place-items-center rounded-full bg-subtle text-[10.5px] leading-none font-semibold text-muted ring-1 ring-line-strong hover:bg-surface hover:text-ink"
      >
        ?
      </button>
    </Tooltip>
  );
}
