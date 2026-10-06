"use client";

import { useLang } from "@/lib/i18n/context";
import { scoreLegend } from "@/lib/score-scale";
import { cx } from "./cx";

/** Compact legend for list badges and map markers. variant="markers" draws circles sized like map markers. */
export function ScoreLegend({ lang: langProp, variant = "swatches", className }: { lang?: "en" | "es"; variant?: "swatches" | "markers"; className?: string }) {
  const uiLang = useLang();
  const lang = langProp ?? uiLang;
  const items = scoreLegend(lang, { min: 4, max: 9 });
  return (
    <div className={cx("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2", className)}>
      <span className="font-medium text-muted">{lang === "es" ? "Puntuación" : "Match score"}</span>
      {items.map((it) => (
        <span key={it.bin} className="inline-flex items-center gap-1.5">
          {variant === "markers" ? (
            <span aria-hidden className="inline-block rounded-full" style={{ width: it.radius * 2, height: it.radius * 2, background: it.color.fill, boxShadow: `0 0 0 1.5px #fff, 0 0 0 2.5px ${it.color.stroke}` }} />
          ) : (
            <span aria-hidden className="inline-block h-2.5 w-4 rounded-sm" style={{ background: it.color.fill }} />
          )}
          <span className="num">{it.range}</span>
        </span>
      ))}
    </div>
  );
}
