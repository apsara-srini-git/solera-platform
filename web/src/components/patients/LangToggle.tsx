"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { cx } from "@/components/ui";
import type { Lang } from "@/lib/patients/types";

export interface LangToggleLabels {
  group: string;
  /** Accessible names for each button, in that button's own language. */
  es: string;
  en: string;
}

/** ES | EN switch: posts to /pacientes/idioma, which sets the "lang" cookie and sends you back to the same page. */
export function LangToggle({ lang, labels, className }: { lang: Lang; labels: LangToggleLabels; className?: string }) {
  const path = usePathname() ?? "/pacientes";
  const sp = useSearchParams();
  const qs = sp?.toString();
  return <LangToggleForm lang={lang} labels={labels} next={qs ? `${path}?${qs}` : path} className={className} />;
}

export function LangToggleForm({ lang, labels, next, className }: { lang: Lang; labels: LangToggleLabels; next?: string; className?: string }) {
  return (
    <form action="/pacientes/idioma" method="post" className={cx("inline-flex", className)}>
      {next && <input type="hidden" name="next" value={next} />}
      <div role="group" aria-label={labels.group} className="inline-flex items-center rounded-lg bg-subtle p-0.5 ring-1 ring-line ring-inset">
        {(["es", "en"] as const).map((l) => {
          const active = l === lang;
          return (
            <button
              key={l}
              type="submit"
              name="lang"
              value={l}
              lang={l}
              aria-pressed={active}
              aria-label={labels[l]}
              className={cx(
                "h-9 min-w-11 rounded-md px-2.5 text-[13px] font-semibold tracking-wide transition",
                active ? "bg-surface text-ink shadow-xs ring-1 ring-line" : "text-ink-2 hover:text-ink",
              )}
            >
              {l.toUpperCase()}
            </button>
          );
        })}
      </div>
    </form>
  );
}
