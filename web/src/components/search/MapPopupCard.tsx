"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, Icon, ScoreBadge, SourceChip, TRIAL_SOURCES } from "@/components/ui";
import type { MapSite } from "@/components/map/types";
import type { SiteResult, TrialSetKind } from "@/lib/search";
import { useLang } from "@/lib/i18n/context";
import { LABELS, fmtNum } from "@/lib/i18n/pro";
import { SEARCH } from "@/lib/i18n/pro/search";
import type { PhaseOption, TrialCriteria } from "@/lib/types";
import { ShortlistButton } from "./ResultCard";
import { BandChip } from "./ScoreExplain";
import { loadTrialRecords } from "./source-actions";
import { SitePhoto } from "./SitePhoto";

/** Card shown in the map popup: before a search (facts only) or after one (score, stats, shortlist). */
export function MapPopupCard({
  site,
  href,
  r,
  rank,
  phase,
  criteria,
  rankOf,
  note,
  shortlisted,
  busy,
  onToggle,
}: {
  site: MapSite;
  href: string;
  r?: SiteResult;
  rank?: number;
  phase?: PhaseOption;
  /** The search (loads the registry records behind each count). */
  criteria?: TrialCriteria;
  /** Hospitals ranked for this search. */
  rankOf?: number;
  /** Why the hospital is greyed out, when it is. */
  note?: string;
  shortlisted?: boolean;
  busy?: boolean;
  onToggle?: () => void;
}) {
  const lang = useLang();
  const t = SEARCH[lang].popup;
  const phaseLabel = phase ? LABELS[lang].phases[phase] : "";
  return (
    <div className="text-ink">
      <SitePhoto name={site.name} image={site.image} municipality={site.municipality} credit="overlay" className={site.image ? "h-28 w-full" : "h-24 w-full"}>
        {rank && (
          <span className="num absolute top-2 left-2 rounded-md bg-ink/80 px-1.5 py-0.5 text-[11px] font-semibold text-white">#{rank}</span>
        )}
      </SitePhoto>
      <div className="space-y-2.5 p-3">
        <div className="flex items-start gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="text-[14px] leading-snug font-semibold">{site.name}</div>
            <div className="mt-0.5 text-xs text-muted">
              {site.municipality} · {site.ownership === "public" ? t.public : t.private} ·{" "}
              <SourceChip sources="catalogue" title={t.beds(site.beds)} note={t.bedsNote} className="num">
                {t.beds(site.beds)}
              </SourceChip>
            </div>
          </div>
          {r && <ScoreBadge score={r.score} size="md" label={t.fitScore} />}
        </div>
        {r && (
          <div className="-mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <BandChip score={r.score} />
            {rank && rankOf ? (
              <span>
                <span className="num font-medium text-ink-2">#{rank}</span> {t.of} <span className="num">{rankOf}</span> {t.forSearch}
              </span>
            ) : null}
          </div>
        )}
        {site.accreditedIIS && site.institute && (
          <Badge tone="success" icon="shield" className="max-w-full">
            <span className="truncate">{site.institute.split(" – ")[0]}</span>
          </Badge>
        )}
        {r && phase ? (
          <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-subtle/80 px-2 py-1.5 text-center">
            <PopStat label={t.inCondition} value={r.stats.indicationTrials} chip={chip(site.id, criteria, "indication", t.chipIndication(r.stats.indicationTrials))} />
            <PopStat label={t.phaseTrials(phaseLabel)} value={r.stats.phaseTrials} chip={chip(site.id, criteria, "phase", t.chipPhase(r.stats.phaseTrials, phaseLabel))} />
            <PopStat
              label={t.similarRecruiting}
              value={r.stats.competingTrials}
              warn={r.stats.competingTrials >= 5}
              chip={chip(site.id, criteria, "competing", t.chipCompeting(r.stats.competingTrials))}
            />
          </div>
        ) : (
          <div className="text-xs text-ink-2">
            {chip(site.id, null, "all", t.chipAll(site.trialCount))(
              <span className="num font-semibold text-ink">{fmtNum(site.trialCount, lang)}</span>,
            )}{" "}
            {t.inRegistries(site.trialCount)}
          </div>
        )}
        {note && (
          <p className="flex items-start gap-1.5 text-xs text-muted">
            <Icon name="info" size={13} className="mt-px shrink-0" /> {note}
          </p>
        )}
        <div className={`grid gap-2 pt-0.5 ${onToggle ? "grid-cols-2" : ""}`}>
          {onToggle && <ShortlistButton shortlisted={!!shortlisted} busy={!!busy} onClick={onToggle} block />}
          <Link href={href} className="btn-primary h-8 w-full px-2 text-[13px] text-white!">
            {r ? t.details : t.viewHospital} <Icon name="arrowRight" size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}

function chip(siteId: string, criteria: TrialCriteria | null | undefined, kind: TrialSetKind, title: string) {
  return function Chip(children: ReactNode) {
    return (
      <SourceChip sources={TRIAL_SOURCES} title={title} loadRecords={() => loadTrialRecords(siteId, criteria ?? null, kind)}>
        {children}
      </SourceChip>
    );
  };
}

function PopStat({ label, value, warn, chip }: { label: string; value: number; warn?: boolean; chip?: (c: ReactNode) => ReactNode }) {
  return (
    <div className="min-w-0">
      <div className={`num text-sm font-semibold ${warn ? "text-amber-800" : ""}`}>{chip ? chip(value) : value}</div>
      <div className="text-[10.5px] leading-tight text-muted">{label}</div>
    </div>
  );
}
