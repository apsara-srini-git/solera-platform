"use client";
/**
 * Small score pieces with plain-data props (band chip, score line, mini stacked bar, strengths / "holding it back").
 * Client components so they pick the UI language from useLang() wherever they render (server pages, cards, map popups);
 * a `lang` prop overrides it. Re-exported from ScoreExplain.tsx.
 */
import { Icon, cx } from "@/components/ui";
import type { Lang } from "@/lib/i18n/pro";
import { useLang } from "@/lib/i18n/context";
import { SCORING } from "@/lib/i18n/pro/scoring";
import type { SiteResult } from "@/lib/search";
import type { ScoreBreakdown } from "./score-points";
import { band, bandText, holdingBack, strengths, type ExplainContext } from "./score-explain";

type R = Pick<SiteResult, "score" | "components" | "stats" | "missingEquipment" | "penalties" | "ranks" | "basis">;

function useL(lang?: Lang): Lang {
  const ctx = useLang();
  return lang ?? ctx;
}

export function BandChip({ score, size = "sm", muted, lang, className }: { score: number; size?: "sm" | "md"; muted?: boolean; lang?: Lang; className?: string }) {
  const l = useL(lang);
  const b = band(score);
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center rounded-full font-semibold whitespace-nowrap ring-1 ring-inset",
        size === "md" ? "px-2.5 py-0.5 text-[13px]" : "px-2 py-px text-[11.5px]",
        muted ? "bg-subtle text-muted ring-line" : b.chip,
        className,
      )}
    >
      {bandText(b, l).label}
    </span>
  );
}

/** "78 / 100 · Good fit · #2 of 14 for this search". */
export function ScoreLine({
  score,
  rank,
  of,
  size = "sm",
  lang,
  className,
}: {
  score: number;
  rank?: number;
  of?: number;
  size?: "sm" | "md";
  lang?: Lang;
  className?: string;
}) {
  const l = useL(lang);
  const t = SCORING[l].receipt;
  return (
    <div className={cx("flex flex-wrap items-center gap-x-1.5 gap-y-1", size === "md" ? "text-sm" : "text-[12.5px]", className)}>
      <span className="num font-semibold text-ink">
        <span className={size === "md" ? "text-2xl" : "text-[17px]"}>{score}</span>
        <span className="font-normal text-muted"> / 100</span>
      </span>
      <span aria-hidden className="text-muted">
        ·
      </span>
      <BandChip score={score} size={size} lang={l} />
      {rank && of ? (
        <span className="whitespace-nowrap text-muted">
          <span aria-hidden className="hidden @lg:inline">· </span>
          <span className="num font-medium text-ink-2">{t.rank(rank)}</span> {t.of} <span className="num">{of}</span> {t.forSearch}
        </span>
      ) : null}
    </div>
  );
}

const SEG = ["#006967", "#1da19f", "#00837f", "#5ab9ba", "#005051", "#2f8f90", "#0f7f7d"];

/** Mini stacked bar: each factor's points side by side (2px gaps), red striped notch for deductions, grey = points not
 *  earned. The solid teal length is the score. */
export function ScoreStack({ r, pts, lang, className }: { r: R; pts: ScoreBreakdown; lang?: Lang; className?: string }) {
  const l = useL(lang);
  const t = SCORING[l].receipt;
  const f = SCORING[l].factors;
  const base = r.components.reduce((s, c) => s + (pts.points[c.key] ?? 0), 0);
  const label = t.stackAria(r.score, r.components.map((c) => t.pointsOf(f[c.key]?.name ?? c.label, pts.points[c.key], pts.max[c.key])).join(", "), pts.penalty);
  const lefts = r.components.map((_, i) => r.components.slice(0, i).reduce((s, c) => s + (pts.points[c.key] ?? 0), 0));
  return (
    <div role="img" aria-label={label} className={cx("relative h-2 w-full overflow-hidden rounded-full bg-subtle ring-1 ring-line/80 ring-inset", className)}>
      {r.components.map((c, i) => {
        const w = pts.points[c.key] ?? 0;
        const left = lefts[i];
        if (!w) return null;
        return (
          <span
            key={c.key}
            title={`${f[c.key]?.name ?? c.label}: ${w} / ${pts.max[c.key]}`}
            className="absolute inset-y-0"
            style={{ left: `${left}%`, width: `calc(${w}% - 2px)`, background: SEG[i % SEG.length] }}
          />
        );
      })}
      {pts.penalty > 0 && (
        <span
          title={t.deductionsTitle(pts.penalty)}
          className="absolute inset-y-0"
          style={{
            left: `${Math.max(0, base - pts.penalty)}%`,
            width: `${pts.penalty}%`,
            background: "repeating-linear-gradient(135deg, #c2410c 0 2px, #fecaca 2px 4px)",
          }}
        />
      )}
    </div>
  );
}

/** ✓ strengths (up to 2) and ! "holding it back" (1), generated from the components. */
export function Reasons({ r, pts, ctx, lang, className }: { r: R; pts: ScoreBreakdown; ctx: ExplainContext; lang?: Lang; className?: string }) {
  const l = useL(lang);
  const t = SCORING[l].receipt;
  const good = strengths(r, pts, ctx, l);
  const bad = holdingBack(r, pts, ctx, l);
  if (!good.length && !bad) return null;
  return (
    <ul className={cx("space-y-1 text-[12.5px] leading-snug", className)}>
      {good.map((g) => (
        <li key={g.key} className="flex items-start gap-1.5 text-ink-2">
          <span className="mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-800" aria-hidden>
            <Icon name="check" size={10} strokeWidth={3} />
          </span>
          <span className="min-w-0 break-words">
            <span className="sr-only">{t.strengthSr}</span>
            {g.text}
          </span>
        </li>
      ))}
      {bad && (
        <li className="flex items-start gap-1.5 text-amber-900">
          <span className="mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-800" aria-hidden>
            !
          </span>
          <span className="min-w-0 break-words">
            <span className="sr-only">{t.holdingSr}</span>
            {bad.text}
          </span>
        </li>
      )}
    </ul>
  );
}
