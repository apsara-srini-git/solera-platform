"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "@/components/ui";

/** Phones: the filters collapse behind one "Filtros (n)" button so the results start near the top of the screen.
 *  From the sm breakpoint up the panel is always open and the button is hidden (portal.css + the effect below for
 *  browsers without ::details-content). Controls inside a closed <details> still submit with the form. */
export function FilterDisclosure({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const sync = () => {
      if (mq.matches && ref.current) ref.current.open = true;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return (
    <details ref={ref} className="filters-disclosure group">
      <summary className="portal-summary no-marker inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-[14px] font-medium text-ink-2 hover:border-ink-2/30">
        <Icon name="filter" size={15} />
        {label}
        {count > 0 && (
          <span className="num grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[11.5px] font-semibold text-white">{count}</span>
        )}
        <Icon name="chevronDown" size={14} className="portal-chevron text-muted transition" />
      </summary>
      <div className="mt-3 sm:mt-0">{children}</div>
    </details>
  );
}
