import Link from "next/link";
import type { ReactNode } from "react";
import { Card, Icon, PageHeader, SOURCES, fmtDay, type SourceId } from "@/components/ui";
import { BANDS, bandText, impact } from "@/components/search/score-explain";
import { BandChip, ScoreReceipt, ScoreStack } from "@/components/search/ScoreExplain";
import { scoreBreakdown } from "@/components/search/score-points";
import { LABELS, type Lang } from "@/lib/i18n/pro";
import { HOW } from "@/lib/i18n/pro/how";
import { SCORING } from "@/lib/i18n/pro/scoring";
import { getProLang } from "@/lib/i18n/server";
import { sourceDates } from "@/lib/refresh";
import { EQUIPMENT_PENALTY, SCORING_RULES, searchSites, type SiteResult } from "@/lib/search";
import { DEFAULT_CRITERIA, EQUIPMENT, PHASES, type TrialCriteria } from "@/lib/types";

export async function generateMetadata() {
  const t = HOW[await getProLang()];
  return { title: t.metaTitle, description: t.metaDescription };
}

/** The factor weights as the scorer uses them (search.ts), normalised to 100 points by scoreBreakdown. */
const WEIGHTS = [
  { key: "indication", weight: 35 },
  { key: "phase", weight: 15 },
  { key: "area", weight: 15 },
  { key: "recent", weight: 10 },
  { key: "completion", weight: 10 },
  { key: "capacity", weight: 10 },
];
const SEG = ["#006967", "#1da19f", "#00837f", "#5ab9ba", "#005051", "#2f8f90"];

/** The worked example: a real search on the current data. */
const EXAMPLE: TrialCriteria = { ...DEFAULT_CRITERIA, indication: "multiple sclerosis", area: "neurology", phase: "PHASE2", equipment: ["mri"] };

const SOURCES_USED: SourceId[] = ["reec", "ctgov", "ctis", "catalogue"];

/** Renders `**bold**` and `*emphasis*` markers in dictionary prose. */
function rich(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) =>
    part.startsWith("**") ? (
      <span key={i} className="num font-semibold text-ink">
        {part.slice(2, -2)}
      </span>
    ) : part.startsWith("*") && part.length > 1 ? (
      <em key={i}>{part.slice(1, -1)}</em>
    ) : (
      part
    ),
  );
}

export default async function HowScoringWorks() {
  const lang = await getProLang();
  const t = HOW[lang];
  const factors = SCORING[lang].factors;
  const deductions = SCORING[lang].deductions;
  const maxes = scoreBreakdown(
    WEIGHTS.map((w) => ({ ...w, value: 1 })),
    100,
  ).max;
  const res = searchSites(EXAMPLE, lang);
  const top = res.results[0];
  // prefer a hospital near the top that has a deduction, so the example shows every part of the receipt
  const ex: SiteResult | undefined = res.results.slice(1, 8).find((r) => (r.penalties?.competing ?? 0) + (r.penalties?.equipment ?? 0) >= 1) ?? res.results[1];
  const exRank = ex ? res.results.indexOf(ex) + 1 : 0;
  const exPts = ex ? scoreBreakdown(ex.components, ex.score, ex.penalties) : null;
  const topInd = top?.components.find((c) => c.key === "indication")?.top ?? 40;
  const dates = sourceDates();
  const phaseName = lang === "es" ? LABELS.es.phases[EXAMPLE.phase].replace(/^Fase/, "fase") : PHASES[EXAMPLE.phase];
  const equipNames = EXAMPLE.equipment.map((e) => (lang === "es" ? LABELS.es.equipment[e].toLowerCase() : EQUIPMENT[e])).join(", ");

  // log scale, from the real formula: points = max × ln(1 + n) / ln(1 + top)
  const indMax = maxes.indication;
  const curve = (k: number) => (indMax * Math.log1p(k)) / Math.log1p(topInd);
  const firstFive = curve(5);
  const lastFive = curve(topInd) - curve(Math.max(0, topInd - 5));

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <PageHeader breadcrumb={[{ label: t.crumbFind, href: "/" }, { label: t.title }]} title={t.title} subtitle={t.subtitle} />

      <section aria-labelledby="summary" className="space-y-3">
        <h2 id="summary" className="sr-only">
          {t.summaryH}
        </h2>
        <p className="text-[15.5px] leading-relaxed text-ink-2">{t.summary}</p>
      </section>

      {/* points split */}
      <section aria-labelledby="split" className="space-y-4">
        <h2 id="split" className="text-lg font-semibold text-ink">
          {t.splitH}
        </h2>
        <div role="img" aria-label={WEIGHTS.map((w) => t.pointsOf(factors[w.key].name, maxes[w.key])).join(", ")} className="flex h-10 w-full gap-[2px] overflow-hidden rounded-lg">
          {WEIGHTS.map((w, i) => (
            <div key={w.key} className="flex min-w-0 items-center justify-center text-xs font-semibold text-white" style={{ flex: maxes[w.key], background: SEG[i] }}>
              <span className="num truncate px-1">{maxes[w.key]}</span>
            </div>
          ))}
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {WEIGHTS.map((w, i) => (
            <li key={w.key} className="rounded-xl border border-line bg-surface p-3.5 shadow-xs">
              <div className="flex items-start justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
                  <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: SEG[i] }} />
                  {factors[w.key].name}
                </span>
                <span className="num shrink-0 text-sm text-ink-2">
                  {t.upTo} <span className="font-semibold text-ink">{maxes[w.key]}</span> · {LABELS[lang].impact[impact(maxes[w.key])]}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] leading-snug text-ink-2">{factors[w.key].plain}</p>
              <p className="mt-1 text-[13px] leading-snug text-muted">
                <span className="font-medium text-ink-2">{t.whyItMatters}</span>
                {factors[w.key].why}
              </p>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">{t.pediatricNote(factors.pediatric.name)}</p>

        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4">
          <h3 className="text-sm font-semibold text-rose-900">{t.deductionsH}</h3>
          <ul className="mt-2 grid gap-3 sm:grid-cols-2">
            {(["competing", "equipment"] as const).map((k) => (
              <li key={k} className="text-[13px] leading-snug">
                <span className="flex items-start justify-between gap-2 font-semibold text-rose-900">
                  {deductions[k].name}
                  <span className="num shrink-0 font-semibold">{t.upTo10}</span>
                </span>
                <span className="mt-1 block text-ink-2">{deductions[k].plain}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* bands */}
      <section aria-labelledby="bands" className="space-y-3">
        <h2 id="bands" className="text-lg font-semibold text-ink">
          {t.bandsH}
        </h2>
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t.bandsCaption}</caption>
            <thead className="bg-subtle text-xs text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium sm:px-4">
                  {t.colScore}
                </th>
                <th scope="col" className="px-3 py-2 font-medium sm:px-4">
                  {t.colBand}
                </th>
                <th scope="col" className="px-3 py-2 font-medium sm:px-4">
                  {t.colMeaning}
                </th>
              </tr>
            </thead>
            <tbody>
              {BANDS.map((b) => (
                <tr key={b.key} className="border-t border-line align-top">
                  <td className="num px-3 py-2.5 whitespace-nowrap text-ink-2 sm:px-4">
                    {b.min}–{b.max}
                  </td>
                  <td className="px-3 py-2.5 sm:px-4">
                    <BandChip score={b.min} lang={lang} />
                  </td>
                  <td className="px-3 py-2.5 text-ink-2 sm:px-4">{bandText(b, lang).meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">{t.bandsNote}</p>
      </section>

      {/* log scale */}
      <section aria-labelledby="log" className="space-y-3">
        <h2 id="log" className="text-lg font-semibold text-ink">
          {t.logH}
        </h2>
        <p className="text-[14.5px] leading-relaxed text-ink-2">
          {rich(t.logText(Math.round(firstFive), Math.max(0, topInd - 5), topInd, Math.max(0, Math.round(lastFive * 10) / 10)))}
        </p>
        <LogChart max={indMax} top={topInd} lang={lang} />
        <p className="text-xs text-muted">{t.logNote(factors.indication.name, EXAMPLE.indication, topInd, indMax, SCORING_RULES.refFloors)}</p>
      </section>

      {/* worked example */}
      {ex && exPts && (
        <section aria-labelledby="example" className="space-y-3">
          <h2 id="example" className="text-lg font-semibold text-ink">
            {t.exampleH}
          </h2>
          <p className="text-[14.5px] leading-relaxed text-ink-2">
            {t.exampleSearch} <span className="font-medium text-ink">{EXAMPLE.indication}</span>, {phaseName}, {t.exampleNeeds} {equipNames}.{" "}
            <span className="font-medium text-ink">{ex.site.name}</span> {t.exampleRanks(exRank, res.results.length)}{" "}
            <span className="num">
              {ex.components.map((c) => exPts.points[c.key]).join(" + ")}
              {exPts.competingPenalty ? ` − ${exPts.competingPenalty}` : ""}
              {exPts.equipmentPenalty ? ` − ${exPts.equipmentPenalty}` : ""} = <span className="font-semibold text-ink">{ex.score}</span>
            </span>
            .
          </p>
          <Card>
            <ScoreStack r={ex} pts={exPts} lang={lang} className="mb-4" />
            <ScoreReceipt r={ex} pts={exPts} ctx={{ phaseLabel: PHASES[EXAMPLE.phase], phase: EXAMPLE.phase, rankOf: res.results.length }} size="page" lang={lang} />
          </Card>
          <p className="text-xs text-muted">
            <Link className="font-medium text-brand-700 hover:underline" href={`/sites/${ex.site.id}?c=${encodeURIComponent(JSON.stringify(EXAMPLE))}`}>
              {t.openExample}
            </Link>
          </p>
        </section>
      )}

      {/* data rules */}
      <section aria-labelledby="rules" className="space-y-3">
        <h2 id="rules" className="text-lg font-semibold text-ink">
          {t.rulesH}
        </h2>
        <dl className="divide-y divide-line rounded-xl border border-line bg-surface text-[14px]">
          {t
            .rules({
              recentSince: SCORING_RULES.recentSince,
              recentYears: SCORING_RULES.recentYears,
              minFinished: SCORING_RULES.minFinishedForRate,
              competingPct: Math.round(SCORING_RULES.competingShareForMax * 100),
              perItem: EQUIPMENT_PENALTY.perItem,
              max: EQUIPMENT_PENALTY.max,
              beds: SCORING_RULES.bedsForFullPoints,
            })
            .map(([k, v]) => (
              <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-4">
                <dt className="font-medium text-ink">{k}</dt>
                <dd className="leading-relaxed text-ink-2">{v}</dd>
              </div>
            ))}
        </dl>
      </section>

      {/* sources */}
      <section aria-labelledby="sources" className="space-y-3">
        <h2 id="sources" className="text-lg font-semibold text-ink">
          {t.sourcesH}
        </h2>
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[560px] text-left text-sm">
            <caption className="sr-only">{t.sourcesH}</caption>
            <thead className="bg-subtle text-xs text-muted">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">
                  {t.colSource}
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  {t.colFeeds}
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  {t.colRefreshed}
                </th>
              </tr>
            </thead>
            <tbody>
              {SOURCES_USED.map((id) => (
                <tr key={id} className="border-t border-line align-top">
                  <td className="px-4 py-2.5">
                    <a href={dates[id]?.url ?? SOURCES[id].url} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 hover:underline">
                      {SOURCES[id].short}
                      <span className="sr-only">{t.opensNewTab}</span>
                    </a>
                  </td>
                  <td className="px-4 py-2.5 text-ink-2">{t.feeds[id as keyof typeof t.feeds]}</td>
                  <td className="num px-4 py-2.5 whitespace-nowrap text-ink-2">{fmtDay(dates[id]?.fetchedAt, { lang }) || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Link href="/data-sources" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
          {t.allSources} <Icon name="arrowRight" size={14} />
        </Link>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq" className="space-y-3">
        <h2 id="faq" className="text-lg font-semibold text-ink">
          {t.faqH}
        </h2>
        <div className="divide-y divide-line rounded-xl border border-line bg-surface">
          {t.faq.map(([q, a]) => (
            <details key={q} className="group px-4 py-3">
              <summary className="no-marker flex cursor-pointer items-center justify-between gap-3 text-[14.5px] font-medium text-ink">
                {q}
                <Icon name="chevronDown" size={16} className="shrink-0 text-muted transition group-open:rotate-180" />
              </summary>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Points vs trials for the indication factor, drawn from the real formula. One series (no legend), recessive axes,
 *  hover titles on sample points, and a table view for screen readers. */
function LogChart({ max, top, lang }: { max: number; top: number; lang: Lang }) {
  const t = HOW[lang].chart;
  const W = 480;
  const H = 230;
  const P = { l: 34, r: 14, t: 14, b: 40 };
  const iw = W - P.l - P.r;
  const ih = H - P.t - P.b;
  const f = (k: number) => (max * Math.log1p(k)) / Math.log1p(top);
  const x = (k: number) => P.l + (k / top) * iw;
  const y = (p: number) => P.t + ih - (p / max) * ih;
  const steps = 120;
  const d = Array.from({ length: steps + 1 }, (_, i) => (i / steps) * top)
    .map((k, i) => `${i ? "L" : "M"}${x(k).toFixed(1)},${y(f(k)).toFixed(1)}`)
    .join(" ");
  const marks = [0, 1, 5, 10, Math.round(top / 4), Math.round(top / 2), top].filter((v, i, a) => v <= top && a.indexOf(v) === i);
  const yTicks = [0, Math.round(max / 2), max];
  const xTicks = [0, Math.round(top / 4), Math.round(top / 2), Math.round((3 * top) / 4), top];
  return (
    <figure className="m-0 rounded-xl border border-line bg-surface p-3">
      <figcaption className="px-1 text-xs font-medium text-ink-2">{t.caption}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto mt-2 h-auto w-full max-w-[620px]" role="img" aria-label={t.aria(marks.map((k) => t.mark(k, Math.round(f(k)))).join("; "))}>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={P.l - 8} y={y(t) + 4} textAnchor="end" fontSize={13} fill="var(--color-muted)">
              {t}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={x(t)} y={H - P.b + 18} textAnchor="middle" fontSize={13} fill="var(--color-muted)">
            {t}
          </text>
        ))}
        <text x={P.l + iw / 2} y={H - 4} textAnchor="middle" fontSize={13} fill="var(--color-muted)">
          {t.axis}
        </text>
        <path d={d} fill="none" stroke="#00837f" strokeWidth={2} strokeLinejoin="round" />
        {marks.map((k) => (
          <g key={k}>
            <circle cx={x(k)} cy={y(f(k))} r={4.5} fill="#00837f" stroke="var(--color-surface)" strokeWidth={2}>
              <title>{t.point(k, Math.round(f(k)), max)}</title>
            </circle>
            {/* hit target larger than the mark */}
            <circle cx={x(k)} cy={y(f(k))} r={12} fill="transparent">
              <title>{t.point(k, Math.round(f(k)), max)}</title>
            </circle>
          </g>
        ))}
        <text x={x(5) + 8} y={y(f(5)) + 16} fontSize={13} fill="var(--color-ink-2)" fontWeight={600}>
          {t.five(Math.round(f(5)))}
        </text>
      </svg>
      <table className="sr-only">
        <caption>{t.tableCaption}</caption>
        <thead>
          <tr>
            <th scope="col">{t.trials}</th>
            <th scope="col">{t.points}</th>
          </tr>
        </thead>
        <tbody>
          {marks.map((k) => (
            <tr key={k}>
              <td>{k}</td>
              <td>{Math.round(f(k))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
