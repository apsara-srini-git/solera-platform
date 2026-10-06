"use client";

import Link from "next/link";
import { memo, useState, type ReactNode } from "react";
import { Badge, Icon, InfoTip, SourceChip, Spinner, TRIAL_SOURCES, cx } from "@/components/ui";
import type { SiteResult, TrialSetKind, UnscoredSite } from "@/lib/search";
import { LABELS, fmtNum, joinList, type Lang } from "@/lib/i18n/pro";
import { useLang } from "@/lib/i18n/context";
import { SCORING } from "@/lib/i18n/pro/scoring";
import type { PhaseOption, TrialCriteria } from "@/lib/types";
import type { MapSite } from "@/components/map/types";
import { HOW_HREF, Reasons, ScoreLine, ScoreReceipt, ScoreStack } from "./ScoreExplain";
import { holdingBack } from "./score-explain";
import { scoreBreakdown } from "./score-points";
import { loadTrialRecords } from "./source-actions";
import { SiteAvatar, SitePhoto } from "./SitePhoto";

export interface ResultCardProps {
  r: SiteResult;
  rank: number;
  /** Hospitals ranked for this search ("#2 of 14"). */
  rankOf: number;
  criteria: TrialCriteria;
  site: MapSite | undefined;
  phase: PhaseOption;
  href: string;
  shortlisted: boolean;
  busy: boolean;
  highlighted: boolean;
  /** Map is visible next to the list: show the "on map" affordance. */
  withMap: boolean;
  onToggle: (siteId: string) => void;
  onHover: (siteId: string | null) => void;
  onShowOnMap: (siteId: string) => void;
}

export function shortInstitute(name: string) {
  return name.split(" – ")[0].split(" - ")[0];
}

/** Plain-language explanations for jargon, shown in small "?" tooltips, per UI language: GLOSSARY[lang].fitScore.
 *  Server pages: import SCORING from "@/lib/i18n/pro/scoring" and use SCORING[lang].glossary (this module is client). */
export const GLOSSARY: Record<Lang, typeof SCORING.en.glossary> = { en: SCORING.en.glossary, es: SCORING.es.glossary };

/** A glossary tooltip text in the current UI language, for places without a `lang` at hand. */
export function GlossaryText({ term }: { term: keyof typeof SCORING.en.glossary }) {
  return <>{SCORING[useLang()].glossary[term]}</>;
}

export const ResultCard = memo(function ResultCard({
  r,
  rank,
  rankOf,
  criteria,
  site,
  phase,
  href,
  shortlisted,
  busy,
  highlighted,
  withMap,
  onToggle,
  onHover,
  onShowOnMap,
}: ResultCardProps) {
  const [open, setOpen] = useState(false);
  const lang = useLang();
  const t = SCORING[lang].card;
  const phaseLabel = LABELS[lang].phases[phase];
  const hasGeo = site?.lat != null;
  const hasPhoto = !!site?.image;
  const pts = scoreBreakdown(r.components, r.score, r.penalties);
  const ctx = { phaseLabel, phase, rankOf };
  const back = holdingBack(r, pts, ctx, lang);
  // the reasons and the receipt already say these; keep only the flags they don't cover
  const warn = r.flags.filter((f) => f.level === "warn" && f.key !== "competing" && !(f.key === "equipment" && back?.key === "equipment"));
  const info = r.flags.filter((f) => f.level === "info" && !(r.stats.indicationTrials === 0 && back?.key === "indication" && (f.key === "noIndication" || /exact condition/.test(f.text))));
  const chips = trialChips(r.site.id, criteria, href, lang);
  return (
    <li
      id={`site-card-${r.site.id}`}
      onMouseEnter={() => onHover(r.site.id)}
      onMouseLeave={() => onHover(null)}
      className={cx(
        "card group @container overflow-hidden transition duration-200 ease-out-soft hover:shadow-raised",
        highlighted && "border-brand-500 shadow-raised ring-2 ring-brand-500/25",
      )}
    >
      <div className="flex flex-col sm:flex-row">
        <SitePhoto
          name={r.site.name}
          image={site?.image ?? null}
          municipality={r.site.municipality}
          className={cx("h-40 shrink-0 sm:h-auto sm:min-h-44 sm:w-52", !hasPhoto && "hidden sm:block")}
        >
          <span className="num absolute top-2.5 left-2.5 rounded-md bg-ink/80 px-1.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
            #{rank}
          </span>
        </SitePhoto>

        <div className="flex min-w-0 flex-1 flex-col p-4">
          <div className="flex items-start gap-3">
            {!hasPhoto && (
              <SiteAvatar className="sm:hidden">
                <span className="num absolute -top-1.5 -left-1.5 rounded-md bg-ink/85 px-1 py-px text-[10.5px] font-semibold text-white">
                  #{rank}
                </span>
              </SiteAvatar>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] leading-snug font-semibold text-ink">
                <Link href={href} className="hover:text-brand-700 hover:underline">
                  {r.site.name}
                </Link>
              </h3>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted">
                <Icon name="pin" size={13} />
                <span>{r.site.municipality}</span>
                <span aria-hidden>·</span>
                <SourceChip sources="catalogue" title={t.beds(r.site.beds)} note={t.bedsNote} className="num">
                  {t.beds(r.site.beds)}
                </SourceChip>
              </p>
            </div>
          </div>

          <div className="mt-2.5">
            <ScoreLine score={r.score} rank={rank} of={rankOf} lang={lang} />
            <ScoreStack r={r} pts={pts} lang={lang} className="mt-2" />
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Badge tone={r.site.ownership === "public" ? "info" : "outline"}>{r.site.ownership === "public" ? t.public : t.private}</Badge>
            {r.site.researchUnit?.accreditedIIS && <AccreditedBadge institute={r.site.researchUnit.institute} />}
          </div>

          <dl className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-subtle/70 px-3 py-2">
            <MiniStat label={t.inCondition} long={t.inConditionLong} value={r.stats.indicationTrials} chip={chips.indication} lang={lang} />
            <MiniStat label={t.phaseTrials(phaseLabel)} long={t.phaseTrials(phaseLabel)} value={r.stats.phaseTrials} chip={chips.phase} lang={lang} />
            <MiniStat
              label={t.similar}
              long={t.similarLong}
              value={r.stats.competingTrials}
              warn={r.stats.competingTrials >= 5}
              tip={GLOSSARY[lang].similarNow}
              chip={chips.competing}
              lang={lang}
            />
          </dl>

          <Reasons r={r} pts={pts} ctx={ctx} lang={lang} className="mt-2.5" />

          {(warn.length > 0 || info.length > 0) && (
            <ul className="mt-1.5 space-y-1 text-[12.5px]">
              {warn.map((f) => (
                <li key={f.text} className="flex items-start gap-1.5 text-amber-800">
                  <Icon name="alert" size={13} className="mt-0.5 shrink-0" />
                  {f.text}
                </li>
              ))}
              {info.map((f) => (
                <li key={f.text} className="flex items-start gap-1.5 text-muted">
                  <Icon name="info" size={13} className="mt-0.5 shrink-0" />
                  {f.text}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1.5 pt-3">
            <button
              type="button"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              aria-controls={`why-${r.site.id}`}
              className="inline-flex h-8 items-center gap-1 rounded-md px-1.5 text-[13px] font-medium text-brand-700 hover:bg-brand-50"
            >
              {t.why}
              <Icon name="chevronDown" size={14} className={cx("transition", open && "rotate-180")} />
            </button>
            <SourceChip sources={["reec", "ctgov", "catalogue"]} label={t.sources} title={t.sourcesTitle} note={t.sourcesNote} />
            {withMap && hasGeo && (
              <button
                type="button"
                onClick={() => onShowOnMap(r.site.id)}
                className="hidden h-8 items-center gap-1 rounded-md px-1.5 text-[13px] font-medium text-ink-2 hover:bg-subtle lg:inline-flex"
              >
                <Icon name="map" size={14} /> {t.onMap}
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Link href={href} className="btn-ghost h-8 px-2.5 text-[13px]">
                {t.details} <Icon name="arrowRight" size={14} />
              </Link>
              <ShortlistButton shortlisted={shortlisted} busy={busy} onClick={() => onToggle(r.site.id)} />
            </div>
          </div>
        </div>
      </div>
      {open && (
        <div id={`why-${r.site.id}`} role="region" aria-label={t.whyRegion(r.site.name, r.score)} className="border-t border-line bg-subtle/50 px-4 py-3.5">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-xs font-semibold text-ink-2">{t.why}</h4>
            <Link href={HOW_HREF} className="text-xs font-medium text-brand-700 hover:underline">
              {t.how}
            </Link>
          </div>
          <ScoreReceipt
            r={r}
            pts={pts}
            ctx={ctx}
            lang={lang}
            renderFact={(c, fact) => factChip(c.key, fact, chips, r.site.beds, lang)}
            renderDeduction={(key, fact) =>
              key === "competing" ? (
                chips.competing(fact)
              ) : (
                <SourceChip sources="catalogue" title={t.equipTitle} note={t.equipNote}>
                  {fact}
                </SourceChip>
              )
            }
          />
        </div>
      )}
    </li>
  );
});

type ChipFn = (children: ReactNode, title?: string) => ReactNode;

/** Source chips for the trial counts of one hospital: the popover lists the registry records (loaded on open). */
function trialChips(siteId: string, criteria: TrialCriteria, href: string, lang: Lang) {
  const t = SCORING[lang].card.chips;
  const make =
    (kind: TrialSetKind, fallback: string, note?: string): ChipFn =>
    // eslint-disable-next-line react/display-name -- a render helper, not a component
    (children, title) => (
      <SourceChip
        sources={TRIAL_SOURCES}
        title={title ?? (typeof children === "string" ? children : fallback)}
        note={note}
        loadRecords={() => loadTrialRecords(siteId, criteria, kind)}
        viewAllHref={`${href}#insights`}
      >
        {children}
      </SourceChip>
    );
  return {
    indication: make("indication", t.indication, t.indicationNote(criteria.indication)),
    phase: make("phase", t.phase, t.phaseNote),
    area: make("area", criteria.area ? t.area : t.overall),
    recent: make("recent", t.recent, t.recentNote(new Date().getFullYear() - 3)),
    finished: make("finished", t.finished, t.finishedNote),
    pediatric: make("pediatric", t.pediatric),
    competing: make("competing", t.competing, t.competingNote),
  };
}

function factChip(key: string, fact: ReactNode, chips: ReturnType<typeof trialChips>, beds: number, lang: Lang) {
  const t = SCORING[lang].card;
  if (key === "capacity")
    return (
      <SourceChip sources="catalogue" title={t.beds(beds)} note={t.bedsNoteShort}>
        {fact}
      </SourceChip>
    );
  const fn = key === "completion" ? chips.finished : (chips as Record<string, ChipFn>)[key];
  return fn ? fn(fact) : fact;
}

function MiniStat({
  label,
  long,
  value,
  warn,
  tip,
  chip,
  lang,
}: {
  label: string;
  long: string;
  value: number;
  warn?: boolean;
  tip?: string;
  chip?: ChipFn;
  lang: Lang;
}) {
  const t = SCORING[lang].card;
  const v = (
    <>
      {warn && <Icon name="alert" size={13} className="mr-1 inline -translate-y-px" />}
      {fmtNum(value, lang)}
    </>
  );
  return (
    <div className="flex min-w-0 flex-col-reverse">
      <dt className="flex min-w-0 items-start gap-0.5 text-[11.5px] leading-tight text-muted">
        <span className="min-w-0 break-words">
          <span className="@lg:hidden">{label}</span>
          <span className="hidden @lg:inline">{long}</span>
        </span>
        {tip && (
          <InfoTip label={t.whatIs(long)} align="end">
            {tip}
          </InfoTip>
        )}
      </dt>
      <dd className={cx("num text-base font-semibold", warn ? "text-amber-800" : "text-ink")}>
        {chip ? chip(v, t.statTitle(value, long)) : v}
      </dd>
    </div>
  );
}

export function ShortlistButton({
  shortlisted,
  busy,
  onClick,
  block,
}: {
  shortlisted: boolean;
  busy: boolean;
  onClick: () => void;
  block?: boolean;
}) {
  const t = SCORING[useLang()].card;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={shortlisted}
      className={cx(
        shortlisted
          ? "btn h-8 border border-brand-600 bg-brand-50 px-3 text-[13px] text-brand-800 hover:bg-brand-100"
          : "btn-secondary h-8 px-3 text-[13px]",
        block && "w-full",
      )}
    >
      {busy ? <Spinner size={13} /> : <Icon name={shortlisted ? "check" : "plus"} size={14} strokeWidth={2.25} />}
      {shortlisted ? t.shortlisted : t.shortlist}
    </button>
  );
}

export function AccreditedBadge({ institute }: { institute: string }) {
  const lang = useLang();
  const t = SCORING[lang].card;
  return (
    <span className="inline-flex items-center gap-1">
      <Badge tone="success" icon="shield" title={institute}>
        {t.accredited(shortInstitute(institute))}
      </Badge>
      <InfoTip label={t.accreditedWhat}>{GLOSSARY[lang].accredited}</InfoTip>
    </span>
  );
}

/** A hospital with no registered trials: facts only, no score, can still be shortlisted. */
export const UnscoredCard = memo(function UnscoredCard({
  u,
  site,
  href,
  shortlisted,
  busy,
  highlighted,
  onToggle,
  onHover,
}: {
  u: UnscoredSite;
  site: MapSite | undefined;
  href: string;
  shortlisted: boolean;
  busy: boolean;
  highlighted: boolean;
  onToggle: (siteId: string) => void;
  onHover: (siteId: string | null) => void;
}) {
  const lang = useLang();
  const t = SCORING[lang].card;
  return (
    <li
      id={`site-card-${u.site.id}`}
      onMouseEnter={() => onHover(u.site.id)}
      onMouseLeave={() => onHover(null)}
      className={cx(
        "card flex items-start gap-3 p-3.5 transition duration-200 ease-out-soft hover:shadow-raised",
        highlighted && "border-brand-500 shadow-raised ring-2 ring-brand-500/25",
      )}
    >
      {site?.image && (
        <SitePhoto name={u.site.name} image={site.image} municipality={u.site.municipality} className="hidden h-20 w-24 shrink-0 rounded-lg sm:block" />
      )}
      <div className="min-w-0 flex-1">
        <h3 className="text-[14.5px] leading-snug font-semibold text-ink">
          <Link href={href} className="hover:text-brand-700 hover:underline">
            {u.site.name}
          </Link>
        </h3>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted">
          <Icon name="pin" size={13} />
          <span>{u.site.municipality}</span>
          <span aria-hidden>·</span>
          <SourceChip sources="catalogue" title={t.beds(u.site.beds)} note={t.bedsNoteShort} className="num">
            {t.beds(u.site.beds)}
          </SourceChip>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge tone={u.site.ownership === "public" ? "info" : "outline"}>{u.site.ownership === "public" ? t.public : t.private}</Badge>
          {u.site.researchUnit?.accreditedIIS && <AccreditedBadge institute={u.site.researchUnit.institute} />}
          {u.matchedEquipment.map((e) => (
            <Badge key={e} tone="neutral" icon="check">
              {e}
            </Badge>
          ))}
        </div>
        {u.missingEquipment.length > 0 && (
          <p className="mt-1.5 flex items-start gap-1.5 text-[12.5px] text-amber-800">
            <Icon name="alert" size={13} className="mt-0.5 shrink-0" />
            <span>
              <SourceChip sources="catalogue" title={t.equipTitle} note={t.equipNoteShort}>
                {lang === "es" ? joinList(u.missingEquipment, lang) : u.missingEquipment.join(", ")}
              </SourceChip>
              {t.equipMissing(u.missingEquipment.length)}
            </span>
          </p>
        )}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[12.5px] text-muted">
            {t.newToTrials}
            <InfoTip label={t.whyNoScore} align="start">
              {GLOSSARY[lang].newToTrials}
            </InfoTip>
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Link href={href} className="btn-ghost h-8 px-2.5 text-[13px]">
              {t.details} <Icon name="arrowRight" size={14} />
            </Link>
            <ShortlistButton shortlisted={shortlisted} busy={busy} onClick={() => onToggle(u.site.id)} />
          </div>
        </div>
      </div>
    </li>
  );
});
