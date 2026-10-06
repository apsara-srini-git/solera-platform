/**
 * Score explainer pieces shared by result cards, map popups and the hospital page: band chip, score line, mini stacked
 * bar, strengths / "holding it back" and the "Why this score?" receipt. The small pieces are client components that
 * follow useLang() (ScoreExplainParts.tsx). ScoreReceipt has no hooks and no "use client" (it takes render props from
 * server pages), so it takes the UI language as a `lang` prop.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, cx } from "@/components/ui";
import { LABELS, fmtNum, type Lang } from "@/lib/i18n/pro";
import { SCORING } from "@/lib/i18n/pro/scoring";
import type { ScoreComponent, SiteResult } from "@/lib/search";
import type { ScoreBreakdown } from "./score-points";
import { factFor, impact, raiseTips, type ExplainContext, type Impact } from "./score-explain";
import { BandChip } from "./ScoreExplainParts";

export { BandChip, Reasons, ScoreLine, ScoreStack } from "./ScoreExplainParts";

type R = Pick<SiteResult, "score" | "components" | "stats" | "missingEquipment" | "penalties" | "ranks" | "basis">;

export const HOW_HREF = "/how-scoring-works";

const IMPACT_CLS: Record<Impact, string> = {
  High: "bg-brand-700 text-white",
  Medium: "bg-brand-100 text-brand-800",
  Lower: "bg-subtle text-ink-2 ring-1 ring-line ring-inset",
};
function ImpactTag({ max, lang }: { max: number; lang: Lang }) {
  const i = impact(max);
  return <span className={cx("inline-flex rounded px-1.5 py-px text-[10.5px] font-semibold", IMPACT_CLS[i])}>{LABELS[lang].impact[i]}</span>;
}

export interface FactorCompare {
  medianValue: number;
  topValue: number;
  medianCount: number;
  topCount: number;
}

export interface ScoreReceiptProps {
  r: R;
  pts: ScoreBreakdown;
  ctx: ExplainContext;
  size?: "card" | "page";
  /** Hospital page: Madrid median and top per factor (ticks on the bars + numbers). */
  compare?: Record<string, FactorCompare>;
  /** Wrap a factor's fact in its source chip (records popover). */
  renderFact?: (c: ScoreComponent, fact: ReactNode) => ReactNode;
  /** Wrap a deduction's trigger in its source chip. */
  renderDeduction?: (key: "competing" | "equipment", fact: ReactNode) => ReactNode;
  /** Shown above the table, e.g. "not ranked in your search". */
  notice?: ReactNode;
  id?: string;
  /** UI language (pass getProLang() on server pages, useLang() in client components). */
  lang?: Lang;
}

/** "Why this score?": a points receipt (factor | impact | this hospital | points), base score, deductions, total. */
export function ScoreReceipt({ r, pts, ctx, size = "card", compare, renderFact, renderDeduction, notice, id, lang = "en" }: ScoreReceiptProps) {
  const t = SCORING[lang].receipt;
  const ex = SCORING[lang].explain;
  const factors = SCORING[lang].factors;
  const deductions = SCORING[lang].deductions;
  const fmtN = (n: number) => fmtNum(Math.round(n * 10) / 10, lang);
  const page = size === "page";
  const base = r.components.reduce((s, c) => s + (pts.points[c.key] ?? 0), 0);
  const tips = raiseTips(r, pts, ctx, lang);
  const fact = (c: ScoreComponent) => {
    const f = factFor(c, r, ctx, lang);
    const cmp = compare?.[c.key];
    return (
      <>
        <span className="text-ink-2">{renderFact ? renderFact(c, f.text) : f.text}</span>
        {cmp && c.key !== "capacity" ? (
          <span className="mt-0.5 block text-[11px] text-muted">
            {t.madridMedian} {c.key === "completion" ? pct(cmp.medianCount, lang) : fmtN(cmp.medianCount)} · {t.top}{" "}
            {c.key === "completion" ? pct(cmp.topCount, lang) : fmtN(cmp.topCount)}
          </span>
        ) : cmp && c.key === "capacity" ? (
          <span className="mt-0.5 block text-[11px] text-muted">
            {t.madridMedian} {fmtN(Math.round(cmp.medianCount))} · {t.largest} {fmtN(cmp.topCount)}
          </span>
        ) : f.sub ? (
          <span className="mt-0.5 block text-[11px] text-muted">{f.sub}</span>
        ) : null}
      </>
    );
  };
  const competingFact = t.competingFact(r.stats.competingTrials);
  const equipFact = r.missingEquipment.length ? t.equipmentFact(r.missingEquipment) : t.nothingMissing;
  const rowPad = page ? "py-2.5" : "py-2";
  // at the floor (score 0) the rows show the full deduction each trigger carries, not the smaller amount that was left
  // to take off, with a note that the score stops at 0
  const fullEquipment = Math.round(r.penalties?.equipment ?? pts.equipmentPenalty);
  const atFloor = r.score === 0 && fullEquipment + pts.competingPenalty > base;
  const fullCompeting = atFloor && r.penalties ? Math.max(pts.competingPenalty, Math.round(r.penalties.competing)) : pts.competingPenalty;
  const shownEquipment = atFloor ? Math.max(pts.equipmentPenalty, fullEquipment) : pts.equipmentPenalty;
  return (
    <div id={id} className={cx("@container", page ? "text-sm" : "text-xs")}>
      {notice}
      <table className="w-full table-fixed border-collapse text-left">
        <caption className="sr-only">{t.caption}</caption>
        <thead>
          <tr className="border-b border-line text-[11px] font-medium text-muted">
            <th scope="col" className={cx("pb-1.5 font-medium", page ? "@md:w-[34%]" : "@md:w-[36%]")}>
              {t.factor}
            </th>
            <th scope="col" className="hidden w-[72px] pb-1.5 font-medium @xl:table-cell">
              {t.impact}
            </th>
            <th scope="col" className="hidden pb-1.5 font-medium @md:table-cell">
              {t.thisHospital}
            </th>
            <th scope="col" className={cx("pb-1.5 text-right font-medium", page ? "w-[28%] @md:w-[22%]" : "w-[32%] @md:w-[22%]")}>
              {t.points}
            </th>
          </tr>
        </thead>
        <tbody>
          {r.components.map((c) => {
            const p = pts.points[c.key] ?? 0;
            const max = pts.max[c.key] ?? 0;
            const cmp = compare?.[c.key];
            const name = factors[c.key]?.name ?? c.label;
            return (
              <tr key={c.key} className="border-b border-line/70 align-top">
                <th scope="row" className={cx(rowPad, "pr-2 font-medium text-ink")}>
                  <span className="block leading-snug">{name}</span>
                  <span className="mt-1 inline-flex @xl:hidden">
                    <ImpactTag max={max} lang={lang} />
                  </span>
                  {/* narrow: the fact sits under the factor name */}
                  <span className="mt-1 block font-normal @md:hidden">{fact(c)}</span>
                </th>
                <td className={cx(rowPad, "hidden pr-2 @xl:table-cell")}>
                  <ImpactTag max={max} lang={lang} />
                </td>
                <td className={cx(rowPad, "hidden pr-3 leading-snug @md:table-cell")}>{fact(c)}</td>
                <td className={cx(rowPad, "text-right")}>
                  <span className="num font-semibold text-ink">{p}</span>
                  <span className="num text-muted"> / {max}</span>
                  <FactorBar value={max ? p / max : 0} median={cmp?.medianValue} top={cmp?.topValue} label={t.barLabel(name, p, max)} page={page} medianTitle={t.madridMedian} topTitle={t.topHospital} />
                </td>
              </tr>
            );
          })}
          <tr className="border-b border-line">
            <th scope="row" className={cx(rowPad, "font-semibold text-ink")} colSpan={1}>
              {t.baseScore}
            </th>
            <td className="hidden @xl:table-cell" />
            <td className="hidden @md:table-cell" />
            <td className={cx(rowPad, "num text-right font-semibold text-ink")}>{base}</td>
          </tr>
        </tbody>
        <tbody className="bg-rose-50/60">
          <tr>
            <th scope="rowgroup" className="px-2 pt-2 pb-0.5 text-[11px] font-semibold tracking-wide text-rose-800 uppercase">
              {t.deductions}
            </th>
            <td className="hidden @xl:table-cell" />
            <td className="hidden @md:table-cell" />
            <td />
          </tr>
          <DeductionRow
            name={deductions.competing.name}
            fact={renderDeduction ? renderDeduction("competing", competingFact) : competingFact}
            sub={t.competingSub}
            points={fullCompeting}
            rowPad={rowPad}
          />
          <DeductionRow
            name={deductions.equipment.name}
            fact={r.missingEquipment.length && renderDeduction ? renderDeduction("equipment", equipFact) : equipFact}
            sub={r.missingEquipment.length ? t.equipmentSub : t.equipmentNone}
            points={shownEquipment}
            rowPad={rowPad}
            last
          />
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-ink/80">
            <th scope="row" className={cx(page ? "py-3 text-base" : "py-2.5 text-sm", "font-semibold text-ink")}>
              {t.fitScore}
            </th>
            <td className="hidden @xl:table-cell" />
            <td className="hidden @md:table-cell">
              <BandChip score={r.score} lang={lang} />
            </td>
            <td className={cx(page ? "py-3 text-base" : "py-2.5 text-sm", "num text-right font-semibold text-ink")}>
              {r.score} <span className="text-xs font-normal text-muted">/ 100</span>
              {atFloor && <span className="block text-[11px] font-normal text-muted">{t.floor}</span>}
            </td>
          </tr>
        </tfoot>
      </table>

      {compare && (
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted" aria-hidden>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-0.5 rounded bg-ink/70" /> {t.madridMedian}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-0 w-0 border-x-[4px] border-t-[5px] border-x-transparent border-t-ink" /> {t.topHospital}
          </span>
        </p>
      )}

      <p className={cx("mt-2.5 leading-snug text-muted", page ? "text-[13px]" : "text-[11.5px]")}>
        {t.relative} {ex.relativeCaveat}{" "}
        <Link href={HOW_HREF} className="font-medium whitespace-nowrap text-brand-700 hover:underline">
          {t.howLink}
        </Link>
      </p>

      <div className={cx("mt-3 rounded-lg border border-line bg-surface", page ? "px-4 py-3" : "px-3 py-2.5")}>
        <h4 className={cx("font-semibold text-ink", page ? "text-sm" : "text-xs")}>{t.raiseTitle}</h4>
        <ul className={cx("mt-1.5 space-y-1 text-ink-2", page ? "text-[13px]" : "text-xs")}>
          {tips.map((t) => (
            <li key={t} className="flex items-start gap-1.5">
              <Icon name="plus" size={12} className="mt-0.5 shrink-0 text-brand-700" strokeWidth={2.25} />
              {t}
            </li>
          ))}
          <li className="flex items-start gap-1.5 text-muted">
            <Icon name="info" size={12} className="mt-0.5 shrink-0" />
            {ex.siteKnowledge}
          </li>
        </ul>
      </div>
    </div>
  );
}

/** Completion share stored as 0–100: "80%" / "80 %". */
function pct(n: number, lang: Lang) {
  return lang === "es" ? `${Math.round(n)}\u00a0%` : `${Math.round(n)}%`;
}

function DeductionRow({ name, fact, sub, points, rowPad, last }: { name: string; fact: ReactNode; sub: string; points: number; rowPad: string; last?: boolean }) {
  const on = points > 0;
  return (
    <tr className={cx("align-top", !last && "border-b border-rose-100")}>
      <th scope="row" className={cx(rowPad, "pr-2 pl-2 font-medium", on ? "text-rose-800" : "text-ink-2")}>
        <span className="block leading-snug">{name}</span>
        <span className={cx("mt-1 block font-normal @md:hidden", on ? "text-rose-900" : "text-muted")}>{fact}</span>
        <span className="mt-0.5 block text-[11px] font-normal text-muted @md:hidden">{sub}</span>
      </th>
      <td className="hidden @xl:table-cell" />
      <td className={cx(rowPad, "hidden pr-3 leading-snug @md:table-cell", on ? "text-rose-900" : "text-muted")}>
        {fact}
        <span className="mt-0.5 block text-[11px] text-muted">{sub}</span>
      </td>
      <td className={cx(rowPad, "num pr-2 text-right font-semibold", on ? "text-rose-800" : "text-muted")}>
        {on ? `−${points}` : "0"}
      </td>
    </tr>
  );
}

function FactorBar({
  value,
  median,
  top,
  label,
  page,
  medianTitle,
  topTitle,
}: {
  value: number;
  median?: number;
  top?: number;
  label: string;
  page: boolean;
  medianTitle: string;
  topTitle: string;
}) {
  const v = Math.max(0, Math.min(1, value)) * 100;
  return (
    <span role="img" aria-label={label} className={cx("relative mt-1.5 block w-full", page ? "h-2" : "h-1.5")}>
      <span className="absolute inset-0 overflow-hidden rounded-full bg-subtle ring-1 ring-line/80 ring-inset">
        <span className="block h-full rounded-full bg-brand-600 motion-safe:transition-[width] motion-safe:duration-500" style={{ width: `${v}%`, minWidth: v > 0 ? 3 : 0 }} />
      </span>
      {median != null && (
        <span className="absolute -top-0.5 -bottom-0.5 w-0.5 -translate-x-1/2 rounded bg-ink/70" style={{ left: `${Math.min(100, median * 100)}%` }} title={medianTitle} />
      )}
      {top != null && (
        <span
          className="absolute -top-[7px] h-0 w-0 -translate-x-1/2 border-x-[4px] border-t-[5px] border-x-transparent border-t-ink"
          style={{ left: `${Math.min(100, top * 100)}%` }}
          title={topTitle}
        />
      )}
    </span>
  );
}
