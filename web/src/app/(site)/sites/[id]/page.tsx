import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  Icon,
  InfoTip,
  PageHeader,
  ScoreBar,
  SourceChip,
  SourceDatesProvider,
  Stat,
  StatGroup,
  TRIAL_SOURCES,
  splitSource,
} from "@/components/ui";
import { RefreshControl } from "@/components/search/RefreshControl";
import { HOW_HREF, Reasons, ScoreLine, ScoreReceipt, ScoreStack } from "@/components/search/ScoreExplain";
import { SiteMap } from "@/components/map";
import { SitePhoto } from "@/components/search/SitePhoto";
import { scoreBreakdown } from "@/components/search/score-points";
import { currentUser, ownedProject } from "@/lib/auth";
import { getSite, siteTrials } from "@/lib/data";
import { db } from "@/lib/db";
import { refreshStatus, sourceDates } from "@/lib/refresh";
import {
  componentStats,
  indicationMatcher,
  parseCriteria,
  scoreAll,
  scoreSite,
  searchSites,
  toTrialRefs,
  trialSet,
  type TrialSetKind,
} from "@/lib/search";
import { registryUrl, type Phase, type Site, type Trial } from "@/lib/types";
import { COMMON, LABELS, fmtDate, fmtNum, fmtPct, joinList, type Lang } from "@/lib/i18n/pro";
import { SCORING } from "@/lib/i18n/pro/scoring";
import { SITE } from "@/lib/i18n/pro/site";
import { getProLang } from "@/lib/i18n/server";
import { trialStatusLabel } from "@/components/ui/sources";
import { unlockInsights } from "../../actions";
import { SiteShortlist } from "./site-shortlist";

type T = (typeof SITE)[Lang];

/** Label with a small "?" tooltip. */
function Term({ children, tip, t, align = "start" }: { children: ReactNode; tip: string; t: T; align?: "start" | "center" | "end" }) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <InfoTip label={t.termLabel(typeof children === "string" ? children : t.termThis)} align={align}>
        {tip}
      </InfoTip>
    </span>
  );
}

export async function generateMetadata({ params }: PageProps<"/sites/[id]">) {
  const { id } = await params;
  const site = getSite(id);
  const t = SITE[await getProLang()];
  return { title: site ? t.metaTitle(site.name) : t.metaFallback };
}

export default async function SitePage({ params, searchParams }: PageProps<"/sites/[id]">) {
  const { id } = await params;
  const { c, project: projectParam, any } = await searchParams;
  /** The sponsor chose "Search anyway" (condition with no registered trials): keep it on every link back to results. */
  const anyway = any === "1";
  const site = getSite(id);
  if (!site) notFound();
  const user = await currentUser();
  const trials = siteTrials(id);
  const lang = await getProLang();
  const t = SITE[lang];
  const L = LABELS[lang];
  const C = COMMON[lang];
  const n = (x: number) => fmtNum(x, lang);

  let criteria = null;
  try {
    criteria = typeof c === "string" ? parseCriteria(JSON.parse(c)) : null;
  } catch {}
  const matches = criteria?.indication ? indicationMatcher(criteria.indication) : null;
  const scored = criteria && matches ? scoreAll(criteria, matches) : null;
  const score =
    criteria && matches && scored ? (scored.all.find((r) => r.site.id === id) ?? scoreSite(site, trials, criteria, matches, scored.refs)) : null;
  const relevant = matches ? trials.filter(matches) : trials;
  // no registered trials: there is nothing to score, so show no number at all
  const newToTrials = trials.length === 0;
  const compare = score && criteria && !newToTrials ? componentStats(criteria) : null;
  // the search would not have ranked this hospital: say so instead of showing a confident score
  const notRanked =
    !score || !criteria || newToTrials
      ? null
      : criteria.ownership !== "any" && site.ownership !== criteria.ownership
        ? t.notRankedOwnership(L.ownershipLower[criteria.ownership])
        : criteria.equipmentStrict && score.missingEquipment.length > 0
          ? t.notRankedEquipment(missingEquipment(site, criteria.equipment, lang))
          : null;
  const project = criteria?.indication && typeof projectParam === "string" ? await ownedProject(projectParam) : null;
  const shortlistIds = project
    ? (await db.shortlistItem.findMany({ where: { projectId: project.id }, select: { siteId: true } })).map((i) => i.siteId)
    : [];

  const byArea = Object.entries(L.areas)
    .map(([k, label]) => ({
      label,
      n: trials.filter((t) => t.areas.includes(k)).length,
    }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
  const maxArea = Math.max(1, ...byArea.map((x) => x.n));
  const equipment = Object.entries(L.equipment).filter(([k]) => (site.equipment[k] ?? 0) > 0);
  const unlocked = user?.plan === "insights";
  const hereParams = new URLSearchParams();
  if (typeof c === "string") hereParams.set("c", c);
  if (project) hereParams.set("project", project.id);
  if (anyway) hereParams.set("any", "1");
  const here = `/sites/${id}${hereParams.size ? `?${hereParams.toString()}` : ""}`;
  const backParams = new URLSearchParams();
  if (project) backParams.set("project", project.id);
  if (criteria?.indication) backParams.set("c", JSON.stringify(criteria));
  if (criteria?.indication && anyway) backParams.set("any", "1");
  const back = criteria?.indication ? `/?${backParams.toString()}` : "/";
  const recruiting = trials.filter((t) => t.status === "RECRUITING").length;
  const industry = trials.filter((t) => t.sponsorClass === "INDUSTRY").length;
  const pts = score ? scoreBreakdown(score.components, score.score, score.penalties) : null;
  // rank in the search the sponsor ran ("#2 of 14 for this search"), only when the search would rank this hospital
  const searchRank = (() => {
    if (!score || !criteria || notRanked || newToTrials) return null;
    const res = searchSites(criteria).results;
    const i = res.findIndex((r) => r.site.id === id);
    return i >= 0 ? { rank: i + 1, of: res.length } : null;
  })();
  const ctx = { phaseLabel: criteria ? L.phases[criteria.phase] : "", phase: criteria?.phase, rankOf: searchRank?.of };
  const refresh = refreshStatus();

  // source chips: the registry records behind each trial count (first 10, newest first) and the catalogue / other sources
  const recs = (kind: TrialSetKind) => toTrialRefs(trialSet(id, criteria?.indication ? criteria : null, kind));
  const trialChip = (kind: TrialSetKind, title: string, children?: ReactNode, note?: string, label?: string) => (
    <SourceChip sources={TRIAL_SOURCES} title={title} records={recs(kind)} viewAllHref="#insights" note={note} label={label}>
      {children}
    </SourceChip>
  );
  const catalogueChip = (title: string, children?: ReactNode, note?: string) => (
    <SourceChip
      sources="catalogue"
      title={title}
      note={note ?? t.catalogueNote(site.catalogueName ?? site.name)}
    >
      {children}
    </SourceChip>
  );
  const FACT_KIND: Record<string, TrialSetKind> = {
    indication: "indication",
    phase: "phase",
    area: "area",
    recent: "recent",
    pediatric: "pediatric",
    completion: "finished",
  };

  // Trials by area sits under the facts when the score breakdown fills the right column, else under the score card.
  const showScore = Boolean(score && pts && !newToTrials);
  const byAreaCard = (
    <Card>
      <CardHeader
        title={t.byArea}
        subtitle={t.byAreaSub}
        actions={trialChip("all", t.registeredTitle(n(trials.length)), undefined, t.byAreaNote, t.publicRegistries)}
      />
      <ul className="mt-4 space-y-2.5 text-sm">
        {byArea.slice(0, 10).map((a) => (
          <li key={a.label} className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)_52px] items-center gap-3 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_52px]">
            <span className="line-clamp-2 leading-tight break-words text-ink-2" title={a.label}>{a.label}</span>
            <ScoreBar value={(a.n / maxArea) * 100} size="sm" tone="neutral" label={a.label} />
            <span className="num text-right text-muted">{n(a.n)}</span>
          </li>
        ))}
        {byArea.length === 0 && <li className="text-muted">{t.noPublicTrials}</li>}
      </ul>
    </Card>
  );

  return (
    <SourceDatesProvider dates={sourceDates()}>
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[
          {
            label: criteria?.indication ? t.crumbResults : C.navFindSites,
            href: back,
          },
          { label: site.name },
        ]}
        title={site.name}
        subtitle={
          <span className="inline-flex items-start gap-1.5">
            <Icon name="pin" size={16} className="mt-1 shrink-0 text-muted" />
            {site.address}, {site.postcode} {site.municipality}
          </span>
        }
        meta={
          <>
            {site.ownership === "public" ? (
              <span className="inline-flex items-center gap-1">
                <Badge tone="info">{t.publicSermas}</Badge>
                <InfoTip label={t.whatSermas} align="start">
                  {t.tips.sermas}
                </InfoTip>
              </span>
            ) : (
              <Badge tone="outline">{t.private}</Badge>
            )}
            <Badge tone="neutral" icon="building">
              {site.hospitalClass}
            </Badge>
            {site.researchUnit?.accreditedIIS && (
              <span className="inline-flex items-center gap-1">
                <Badge tone="success" icon="shield">
                  {t.accreditedInstitute}
                </Badge>
                <InfoTip label={t.whatAccredited}>{t.glossary.accredited}</InfoTip>
              </span>
            )}
            {ceimInfo(site)?.confirmed && site.ceim?.fastTrack && <Badge tone="brand">{t.ceimFastTrackBadge}</Badge>}
          </>
        }
        actions={
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start">
          {criteria?.indication && newToTrials ? (
            <div className="flex max-w-xs items-start gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13px] leading-snug text-ink-2 shadow-xs">
              <Icon name="info" size={16} className="mt-0.5 shrink-0 text-muted" />
              <span>
                <span className="font-semibold text-ink">{t.newToTrialsTitle}</span>
                <span className="mt-0.5 block text-xs text-muted">{t.glossary.newToTrials}</span>
              </span>
            </div>
          ) : score && notRanked ? (
            <div className="flex max-w-xs items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] leading-snug text-amber-900 shadow-xs">
              <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
              <span>
                <span className="font-semibold">{notRanked}</span>
                <span className="mt-0.5 block text-xs text-amber-800">{t.scoreRefOnly(score.score)}</span>
              </span>
            </div>
          ) : score ? (
            <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5 shadow-xs">
              <ScoreLine score={score.score} rank={searchRank?.rank} of={searchRank?.of} size="md" lang={lang} />
              <div className="mt-1 flex items-center gap-1 text-xs leading-snug text-muted">
                <span className="max-w-64 truncate">
                  {t.fitFor(criteria!.indication, L.phases[criteria!.phase])}
                </span>
                <InfoTip label={t.whatFitScore} align="end">
                  {t.glossary.fitScore}
                </InfoTip>
              </div>
            </div>
          ) : null}
          {criteria?.indication ? (
            <SiteShortlist
              siteId={id}
              criteria={criteria}
              projectId={project?.id ?? null}
              shortlisted={shortlistIds.includes(id)}
              count={shortlistIds.length}
            />
          ) : (
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <ButtonLink href={`/?site=${encodeURIComponent(id)}`} variant="secondary" icon="search">
                {t.searchFirst}
              </ButtonLink>
              <span className="text-xs text-muted">{t.searchFirstHint}</span>
            </div>
          )}
          </div>
        }
      />

      {/* hero: photo + locator map */}
      {/* no photo on file: no empty photo panel - the locator map takes the space */}
      <div className={site.image ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]" : undefined}>
        {site.image && (
          <SitePhoto
            name={site.name}
            image={site.image}
            municipality={site.municipality}
            size="full"
            credit="overlay"
            className="h-56 rounded-2xl border border-line shadow-card sm:h-80 lg:h-[360px]"
          />
        )}
        <Card padding="none" className={site.image ? "flex flex-col overflow-hidden" : "flex flex-col overflow-hidden lg:flex-row"}>
          {site.geo ? (
            <SiteMap
              lat={site.geo.lat}
              lon={site.geo.lon}
              name={site.name}
              className={site.image ? "h-56 lg:h-auto lg:flex-1" : "h-56 sm:h-64 lg:h-[280px] lg:flex-1"}
            />
          ) : (
            <EmptyState
              icon="map"
              compact
              title={t.locationMissing}
              className={site.image ? "h-56 bg-subtle/60 lg:h-auto lg:flex-1" : "h-56 bg-subtle/60 lg:h-[280px] lg:flex-1"}
            />
          )}
          <div
            className={
              site.image
                ? "space-y-2 border-t border-line p-4 text-sm"
                : "space-y-2 border-t border-line p-4 text-sm lg:w-[360px] lg:shrink-0 lg:border-t-0 lg:border-l lg:p-5"
            }
          >
            <div className="text-ink">{site.address}</div>
            <div className="text-muted">
              {site.postcode} {site.municipality}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {site.geo && (
                <a
                  href={`https://www.openstreetmap.org/?mlat=${site.geo.lat}&mlon=${site.geo.lon}#map=16/${site.geo.lat}/${site.geo.lon}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:underline"
                >
                  {t.openOsm} <Icon name="external" size={13} />
                </a>
              )}
              <SourceChip
                sources={["catalogue", "geo", "osm"]}
                label={t.sources}
                title={t.addressTitle}
                note={t.addressNote}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* key numbers */}
      <Card>
        <StatGroup>
          <Stat label={t.beds} value={n(site.beds)} source={catalogueChip(t.bedsTitle(n(site.beds)))} />
          <Stat
            label={t.registeredTrials}
            value={n(trials.length)}
            hint={t.allPublic}
            source={trialChip("all", t.registeredTitle(n(trials.length)), undefined, t.registeredNote, t.publicRegistries)}
          />
          <Stat
            label={t.recruitingNow}
            value={n(recruiting)}
            source={trialChip("recruiting", t.recruitingTitle(n(recruiting)), undefined, t.recruitingNote, t.publicRegistries)}
          />
          <Stat
            label={t.industry}
            value={n(industry)}
            hint={trials.length ? t.industryHint(fmtPct(Math.round((industry / trials.length) * 100) / 100, lang)) : undefined}
            source={trialChip("industry", t.industryTitle(n(industry)), undefined, t.industryNote, t.publicRegistries)}
          />
          {criteria?.indication && matches && (
            <Stat
              label={t.inCondition}
              value={n(relevant.length)}
              hint={criteria.indication}
              source={trialChip("indication", t.inConditionTitle(n(relevant.length)), undefined, t.inConditionNote(criteria.indication), t.publicRegistries)}
            />
          )}
        </StatGroup>
        <RefreshControl initial={refresh} loggedIn={!!user} className="mt-4 border-t border-line pt-3" />
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* facts */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              title={t.researchSetup}
              actions={
                <SourceChip
                  sources={["isciii", "catalogue"]}
                  label={t.sources}
                  title={t.researchSetup}
                  note={t.researchNote}
                  links={
                    splitSource(site.researchUnit?.source).href
                      ? [{ label: t.researchUnitLink, href: splitSource(site.researchUnit?.source).href! }]
                      : undefined
                  }
                />
              }
            />
            <dl className="mt-4 divide-y divide-line text-sm">
              <Row k={t.researchInstitute} v={site.researchUnit?.institute ?? <span className="text-muted">{t.notOnFile}</span>} />
              <Row k={<Term t={t} tip={t.glossary.accredited}>{t.isciiiAccredited}</Term>} v={site.researchUnit ? site.researchUnit.accreditedIIS ? <Yes label={C.yes} /> : C.no : "-"} />
              <Row k={<Term t={t} tip={t.tips.complex}>{t.hospitalComplex}</Term>} v={site.complex ?? "-"} />
              <Row k={t.funding} v={site.funding} />
            </dl>
          </Card>

          <EthicsCard site={site} t={t} lang={lang} />

          <Card>
            <CardHeader
              title={t.equipmentTitle}
              actions={
                <SourceChip
                  sources="catalogue"
                  title={t.equipmentTitle}
                  note={t.equipmentNote}
                />
              }
            />
            <div className="mt-4 flex flex-wrap gap-1.5">
              {equipment.length ? (
                equipment.map(([k, label]) => (
                  <span key={k} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-subtle/60 px-2.5 py-1 text-[13px] text-ink-2">
                    {label}
                    <span className="num rounded bg-surface px-1 text-xs font-semibold text-ink ring-1 ring-line">{n(site.equipment[k] ?? 0)}</span>
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted">{t.noneReported}</span>
              )}
            </div>
          </Card>

          {showScore && byAreaCard}
        </div>

        {/* scores */}
        <div className="space-y-6">
          {score && newToTrials ? (
            <Card>
              <EmptyState
                compact
                icon="info"
                title={t.newToTrialsTitle}
                description={t.scoreUnavailableDesc}
              />
            </Card>
          ) : score && pts ? (
            <Card>
              <CardHeader
                title={
                  <span className="inline-flex items-center gap-1.5">
                    {t.whyScore}
                    <InfoTip label={t.whatFitScore} align="start">
                      {t.glossary.fitScore}
                    </InfoTip>
                  </span>
                }
                subtitle={`${criteria!.indication} · ${L.phases[criteria!.phase]}`}
                actions={
                  <Link href={HOW_HREF} className="inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap text-brand-700 hover:underline">
                    {t.howScoring} <Icon name="arrowRight" size={12} />
                  </Link>
                }
              />
              {notRanked && (
                <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900 ring-1 ring-amber-200 ring-inset">
                  <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
                  {notRanked} {t.breakdownRef}
                </p>
              )}
              <div className={notRanked ? "mt-4 opacity-60 grayscale" : "mt-4"}>
                <ScoreLine score={score.score} rank={searchRank?.rank} of={searchRank?.of} size="md" lang={lang} />
                <ScoreStack r={score} pts={pts} lang={lang} className="mt-2.5" />
              </div>
              <Reasons r={score} pts={pts} ctx={ctx} lang={lang} className="mt-3 text-[13px]" />
              <div className="mt-5">
                <ScoreReceipt
                  r={score}
                  pts={pts}
                  ctx={ctx}
                  size="page"
                  lang={lang}
                  compare={compare?.byKey}
                  renderFact={(c, fact) =>
                    c.key === "capacity"
                      ? catalogueChip(t.bedsTitle(n(site.beds)), fact)
                      : FACT_KIND[c.key]
                        ? trialChip(FACT_KIND[c.key], typeof fact === "string" ? fact : c.label, fact)
                        : fact
                  }
                  renderDeduction={(key, fact) =>
                    key === "competing"
                      ? trialChip("competing", typeof fact === "string" ? fact : t.similarRecruitingTitle, fact, t.competingNote)
                      : catalogueChip(
                          t.equipMissingTitle,
                          fact,
                          t.equipMissingNote,
                        )
                  }
                />
              </div>
              {score.flags.some((f) => f.key !== "competing" && f.key !== "equipment") && (
                <ul className="mt-4 space-y-1.5 border-t border-line pt-3 text-[13px]">
                  {score.flags
                    .filter((f) => f.key !== "competing" && f.key !== "equipment")
                    .map((f) => (
                      <li key={f.text} className={`flex items-start gap-1.5 ${f.level === "warn" ? "text-amber-800" : "text-muted"}`}>
                        <Icon name={f.level === "warn" ? "alert" : "info"} size={14} className="mt-0.5 shrink-0" />
                        {flagText(f.text, lang)}
                      </li>
                    ))}
                </ul>
              )}
              <div className="mt-4 grid gap-3 rounded-xl border border-line bg-subtle/50 p-3.5 text-[13px] sm:grid-cols-2">
                <div>
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-100 text-emerald-800" aria-hidden>
                      <Icon name="check" size={10} strokeWidth={3} />
                    </span>
                    {t.uses}
                  </h4>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-ink-2 marker:text-line-strong">
                    {t.usesItems.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-slate-200 text-slate-700" aria-hidden>
                      <Icon name="x" size={10} strokeWidth={3} />
                    </span>
                    {t.doesntUse}
                  </h4>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-ink-2 marker:text-line-strong">
                    {t.doesntUseItems.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <p className="mt-3 text-[13px] font-medium text-ink-2">{t.startingShortlist}</p>
              <p className="mt-0.5 text-xs text-muted">{t.hospitalsConfirm}</p>
            </Card>
          ) : (
            <Card>
              <EmptyState
                compact
                icon="search"
                title={t.seeFitTitle}
                description={t.seeFitDesc}
                action={
                  <ButtonLink href="/" icon="search">
                    {C.navFindSites}
                  </ButtonLink>
                }
              />
            </Card>
          )}

          {!showScore && byAreaCard}
        </div>
      </div>

      {/* paid insights */}
      <Card className="min-w-0 scroll-mt-24 overflow-hidden" id="insights">
        <CardHeader
          title={`${t.insightsTitle}${criteria?.indication ? ` · ${criteria.indication}` : ""}`}
          subtitle={t.insightsSub}
          actions={
            <span className="flex flex-wrap items-center justify-end gap-1.5">
              {trialChip(criteria?.indication ? "indication" : "all", t.registeredTitle(n(relevant.length)), undefined, undefined, t.publicRegistries)}
              <Badge tone="premium" icon="sparkle">
                {C.planInsights}
              </Badge>
            </span>
          }
        />
        {unlocked ? (
          <>
            <Insights trials={relevant} t={t} lang={lang} />
            <div className="mt-6 border-t border-line pt-5" data-testid="insights-activity">
              <ActivityBlock site={site} t={t} lang={lang} />
            </div>
          </>
        ) : (
          <div className="relative mt-4 overflow-hidden rounded-xl" data-testid="insights-locked">
            <div className="pointer-events-none absolute inset-0 space-y-2 blur-sm select-none" aria-hidden>
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-8 rounded-lg bg-subtle" />
              ))}
            </div>
            <div className="relative grid place-items-center px-2 py-6">
              <div className="w-full max-w-md min-w-0 rounded-xl border border-line bg-surface/95 px-5 py-4 text-center shadow-raised">
                <Icon name="lock" size={18} className="mx-auto text-muted" />
                <p className="mt-2 text-sm text-ink-2">{t.lockedLead(!!criteria?.indication)}</p>
                <ul className="mx-auto mt-3 inline-grid gap-1 text-left text-[13px] text-ink-2" data-testid="insights-includes">
                  {t.lockedIncludes.map((x) => (
                    <li key={x} className="flex items-start gap-1.5"><Icon name="check" size={13} className="mt-0.5 shrink-0 text-brand-600" /> {x}</li>
                  ))}
                  <li className="flex items-start gap-1.5">
                    <Icon name="check" size={13} className="mt-0.5 shrink-0 text-brand-600" />
                    <span>
                      {t.clinicalActivity}{site.activity ? ` (${site.activity.year})` : ""}{" "}
                      <SourceChip sources="sermas" title={t.activityChipTitle} label="SERMAS" note={t.activityChipNote} />
                    </span>
                  </li>
                </ul>
                <form action={unlockInsights.bind(null, here)} className="mt-3">
                  <Button icon="sparkle" className="h-auto! min-h-9 py-2 whitespace-normal!">{user ? t.unlock : t.signupUnlock}</Button>
                </form>
                <p className="mt-2 text-xs text-muted">{t.demoNote}</p>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
    </SourceDatesProvider>
  );
}

/** Sponsor-side only: the role mailboxes the hospital publishes, each with its kind, purpose, phone and source page. */
function Yes({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-emerald-800">
      <Icon name="check" size={14} strokeWidth={2.5} /> {label}
    </span>
  );
}

function Row({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)] gap-3 py-2.5 first:pt-0 last:pb-0">
      <dt className="text-muted">{k}</dt>
      <dd className="min-w-0 break-words text-ink">{v}</dd>
    </div>
  );
}

/** Equipment the search asked for that the catalogue does not list at this hospital, in the page language. */
function missingEquipment(site: Site, keys: string[], lang: Lang) {
  const names = keys.filter((k) => !((site.equipment[k] ?? 0) > 0)).map((k) => LABELS[lang].equipment[k] ?? k);
  return lang === "es" ? joinList(names, lang) : names.join(", ");
}

/** Flags from lib/search.ts come in English: shown in the page language (unknown texts as they are). */
function flagText(text: string, lang: Lang) {
  const en = SCORING.en.engine;
  const l = SCORING[lang].engine;
  return text === en.flagNoIndication ? l.flagNoIndication : text === en.flagNoPediatric ? l.flagNoPediatric : text === en.flagNoResearchUnit ? l.flagNoResearchUnit : text;
}

function monthLabel(m: string, lang: Lang) {
  return /^\d{4}-\d{2}$/.test(m) ? fmtDate(`${m}-01`, lang, { day: undefined, month: "long" }) : fmtDate(m, lang, { day: undefined, month: "long" });
}

/** How the dataset links the hospital to its committee. Read defensively: older builds have no `basis`. */
type CeimBasis = "own" | "complex" | "default" | (string & {});
function ceimInfo(site: Site) {
  const e = site.ceim as (NonNullable<Site["ceim"]> & { basis?: CeimBasis; note?: string | null }) | null;
  if (!e) return null;
  const basis: CeimBasis = e.basis ?? (e.ownCommittee ? "own" : "default");
  // only a committee the AEMPS directory ties to this hospital (or its complex) is a fact; anything else is a guess
  const confirmed = !!e.name && (basis === "own" || basis === "complex");
  return { e, basis, confirmed };
}

/** Popover note for a confirmed committee. The dataset's note is English ("AEMPS directory of accredited CEIm, checked
 *  2026-10-05"): rebuilt in the page language from the date it carries (or the slot check date). */
function ceimNote(info: NonNullable<ReturnType<typeof ceimInfo>>, src: ReturnType<typeof splitSource> | null, t: T, lang: Lang) {
  const raw = info.e.note || src?.note || null;
  const checked = raw?.match(/checked (\d{4}-\d{2}-\d{2})/)?.[1] ?? info.e.slots?.checkedOn ?? null;
  if (raw && /^AEMPS directory of accredited CEIm/.test(raw)) return t.ceimNote(checked ? fmtDate(checked, lang) : null, info.basis === "complex");
  if (raw) return lang === "en" ? raw : t.ceimNote(checked ? fmtDate(checked, lang) : null, info.basis === "complex");
  return info.e.slots?.checkedOn ? t.slotsChecked(fmtDate(info.e.slots.checkedOn, lang)) : undefined;
}

function EthicsCard({ site, t, lang }: { site: Site; t: T; lang: Lang }) {
  const info = ceimInfo(site);
  const src = info?.confirmed ? splitSource(info.e.source) : null;
  const C = COMMON[lang];
  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-1.5">
            {t.ethicsTitle}
            <InfoTip align="start">
              {t.tips.ceim} {t.ethicsTipSource}
            </InfoTip>
          </span>
        }
        actions={
          info?.confirmed ? (
            <SourceChip
              sources="ceim"
              title={info.e.name}
              note={ceimNote(info, src, t, lang)}
              links={src?.href ? [{ label: t.aempsLink, href: src.href }] : undefined}
            />
          ) : info ? (
            <Badge tone="warning">{t.notConfirmed}</Badge>
          ) : undefined
        }
      />
      <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{t.ethicsIntro}</p>
      {!info ? (
        <p className="mt-3 text-sm text-muted">{t.notOnFileDot}</p>
      ) : !info.confirmed ? (
        <div className="mt-3 space-y-2 text-sm">
          {info.basis === "default" ? (
            <>
              <p className="text-ink-2">
                <span className="font-medium text-ink">{t.notConfirmed}</span>
                {t.defaultLead}
              </p>
              <p className="text-xs text-muted">{t.defaultSmall}</p>
            </>
          ) : (
            <p className="text-ink-2">
              {t.noCommitteeListed}
              {info.e.name ? (
                <>
                  {" "}
                  {t.probablyBefore}
                  <span className="font-medium text-ink">{info.e.name}</span>
                  {t.probablyAfter}
                </>
              ) : null}
            </p>
          )}
          <p className="text-xs text-muted">{t.hospitalConfirmsCeim}</p>
        </div>
      ) : (
        <>
          <dl className="mt-4 divide-y divide-line text-sm">
            <Row k={t.committee} v={info.e.name} />
            <Row
              k={
                <Term t={t} tip={t.tips.ownCommittee}>
                  {t.ownCommittee}
                </Term>
              }
              v={info.basis === "own" ? <Yes label={C.yes} /> : t.sharedOf(site.complex)}
            />
            <Row
              k={
                <Term t={t} tip={t.tips.ctis}>
                  {t.ctisEvaluator}
                </Term>
              }
              v={info.e.ctisEvaluator ? <Yes label={C.yes} /> : C.no}
            />
            <Row
              k={
                <Term t={t} tip={t.tips.fastTrack}>
                  {t.fastTrack}
                </Term>
              }
              v={info.e.fastTrack ? <Yes label={C.yes} /> : C.no}
            />
          </dl>
          {info.e.slots && <SlotMeter slots={info.e.slots} t={t} lang={lang} />}
        </>
      )}
    </Card>
  );
}

function SlotMeter({ slots, t, lang }: { slots: NonNullable<NonNullable<Site["ceim"]>["slots"]>; t: T; lang: Lang }) {
  const free = Math.max(0, slots.capacity - slots.used);
  const pct = slots.capacity > 0 ? (slots.used / slots.capacity) * 100 : 100;
  const tone = free === 0 ? "danger" : free <= Math.ceil(slots.capacity * 0.25) ? "warning" : "success";
  return (
    <div className="mt-4 rounded-lg border border-line bg-subtle/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
        <span className="inline-flex items-center gap-1 font-medium text-ink-2">
          {t.reviewSlots(monthLabel(slots.month, lang))}
          <InfoTip label={t.whatSlots} align="start">
            {t.tips.slots}
          </InfoTip>
        </span>
        <Badge tone={tone} dot>
          {free === 0 ? t.slotsFull : t.slotsFree(free, slots.capacity)}
        </Badge>
      </div>
      <ScoreBar value={pct} size="sm" tone="neutral" className="mt-2" label={t.slotsUsed} />
      <p className="mt-1.5 text-xs text-muted">
        <span className="num">{slots.used}</span> {t.usedOf} <span className="num">{slots.capacity}</span> · {t.checkedOn} {fmtDate(slots.checkedOn, lang)}
      </p>
    </div>
  );
}

/** SERMAS clinical activity (first visits by specialty, discharges, industry studies): part of the Insights plan.
 *  Specialty names are SERMAS data and stay in Spanish. */
function ActivityBlock({ site, t, lang }: { site: Site; t: T; lang: Lang }) {
  const a = site.activity;
  const top = a
    ? Object.entries(a.firstVisitsBySpecialty)
        .filter(([, v]) => typeof v === "number" && v > 0)
        .sort((x, y) => y[1] - x[1])
        .slice(0, 8)
    : [];
  const max = Math.max(1, ...top.map(([, v]) => v));
  const n = (x: number) => fmtNum(x, lang);
  return (
    <div>
      <CardHeader
        title={t.clinicalActivity}
        subtitle={
          a ? (
            <span className="inline-flex items-center gap-1">
              {t.firstVisitsSub(a.year)}
              <InfoTip label={t.whatFirstVisit} align="start">
                {t.tips.firstVisits}
              </InfoTip>
            </span>
          ) : undefined
        }
        actions={
          a ? (
            <SourceChip
              sources="sermas"
              title={t.activityTitleYear(a.year)}
              note={a.reportName ? t.fromReport(a.reportName, a.year) : t.sermasOpen(a.year)}
              links={splitSource(a.source).href ? [{ label: t.fileLink(a.year), href: splitSource(a.source).href! }] : undefined}
            />
          ) : undefined
        }
      />
      {!a ? (
        <p className="mt-3 text-sm text-muted">{site.ownership === "public" ? t.activityMissing : t.activityPrivate}</p>
      ) : (
        <>
          <ul className="mt-4 space-y-2.5 text-sm">
            {top.map(([name, v]) => (
              <li key={name} className="grid grid-cols-[minmax(0,170px)_minmax(0,1fr)_64px] items-center gap-3">
                <span className="truncate text-ink-2" title={name}>
                  {name}
                </span>
                <ScoreBar value={(v / max) * 100} size="sm" tone="neutral" label={name} />
                <span className="num text-right text-muted">{n(v)}</span>
              </li>
            ))}
          </ul>
          {(a.discharges != null || a.industryStudies) && (
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4">
              {a.discharges != null && (
                <Stat
                  size="sm"
                  label={
                    <Term t={t} tip={t.tips.discharges}>
                      {t.discharges(a.year)}
                    </Term>
                  }
                  value={n(a.discharges)}
                />
              )}
              {a.industryStudies && (a.industryStudies.active != null || a.industryStudies.new != null) && (
                <Stat
                  size="sm"
                  label={
                    <Term t={t} tip={t.tips.industryStudies} align="end">
                      {t.industryStudies}
                    </Term>
                  }
                  value={(() => {
                    const v = a.industryStudies.active ?? a.industryStudies.new;
                    return v != null ? n(v) : "-";
                  })()}
                  hint={
                    a.industryStudies.active != null
                      ? `${t.active}${a.industryStudies.new != null ? ` · ${t.newCount(n(a.industryStudies.new))}` : ""}`
                      : t.newWord
                  }
                />
              )}
            </div>
          )}
          <p className="mt-3 text-xs text-muted">{t.activityFooter}</p>
        </>
      )}
    </div>
  );
}

function Insights({ trials, t, lang }: { trials: Trial[]; t: T; lang: Lang }) {
  const phases = LABELS[lang].phases;
  const industry = trials.filter((tr) => tr.sponsorClass === "INDUSTRY").length;
  const sponsors = Object.entries(
    trials.reduce<Record<string, number>>((m, tr) => {
      const s = tr.sponsor ?? t.unknownSponsor;
      m[s] = (m[s] ?? 0) + 1;
      return m;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const stopped = trials.filter((tr) => tr.status === "TERMINATED" && tr.whyStopped);
  const years = trials.reduce<Record<number, number>>((m, tr) => (tr.startYear ? ((m[tr.startYear] = (m[tr.startYear] ?? 0) + 1), m) : m), {});
  const thisYear = new Date().getFullYear();
  const trend = Array.from({ length: 10 }, (_, i) => thisYear - 9 + i).map((y) => ({ y, n: years[y] ?? 0 }));
  const sorted = [...trials].sort((a, b) => (b.startYear ?? 0) - (a.startYear ?? 0));

  return (
    <div className="mt-5 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-3">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-ink">{t.sponsorMix}</h3>
        <p className="mt-1 text-sm text-muted">
          <span className="num font-medium text-ink-2">{fmtPct(trials.length ? Math.round((industry / trials.length) * 100) / 100 : 0, lang)}</span>{" "}
          {t.sponsorMixLine}
        </p>
        <ul className="mt-2 space-y-1 text-sm">
          {sponsors.map(([s, c]) => (
            <li key={s} className="flex justify-between gap-2">
              <span className="truncate text-ink-2">{s}</span>
              <span className="num text-muted">{fmtNum(c, lang)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="min-w-0">
        <TrialsPerYear trend={trend} thisYear={thisYear} t={t} />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-ink">{t.earlyTermination(stopped.length)}</h3>
        <ul className="mt-2 max-h-40 space-y-1.5 overflow-auto text-xs text-ink-2">
          {stopped.slice(0, 15).map((tr) => (
            <li key={tr.id}>“{tr.whyStopped}”</li>
          ))}
          {!stopped.length && <li className="text-muted">{t.noneRecorded}</li>}
        </ul>
      </div>
      <div className="min-w-0 lg:col-span-3">
        <h3 className="text-sm font-semibold text-ink">{t.trialHistory(fmtNum(trials.length, lang))}</h3>
        <div className="mt-2 max-h-96 max-w-full overflow-auto rounded-lg border border-line">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="sticky top-0 bg-subtle text-muted">
              <tr>
                <th className="p-2 font-medium">{t.cols.trial}</th>
                <th className="p-2 font-medium">{t.cols.phase}</th>
                <th className="p-2 font-medium">{t.cols.status}</th>
                <th className="p-2 font-medium">{t.cols.start}</th>
                <th className="p-2 font-medium">{t.cols.sponsor}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 200).map((tr) => (
                <tr key={tr.id} className="border-t border-line">
                  <td className="p-2">
                    {tr.registryIds.map((rid) => (
                      <a key={rid} href={registryUrl(rid)} target="_blank" rel="noreferrer" className="mr-2 font-mono text-brand-700 hover:underline">
                        {rid}
                      </a>
                    ))}
                    <div className="max-w-md truncate text-ink-2">{tr.title}</div>
                  </td>
                  <td className="p-2 whitespace-nowrap">{tr.phases.map((p) => phases[p as Phase] ?? p).join(", ") || "-"}</td>
                  <td className="p-2 whitespace-nowrap">{trialStatusLabel(tr.status, lang)}</td>
                  <td className="num p-2">{tr.startYear ?? "-"}</td>
                  <td className="max-w-[180px] truncate p-2">{tr.sponsor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** Bar chart of new registered trials per start year. The latest complete year is highlighted; the current year is
 *  partial and drawn lighter. Each bar carries its value; a visually hidden table gives the same numbers. */
function TrialsPerYear({ trend, thisYear, t }: { trend: { y: number; n: number }[]; thisYear: number; t: T }) {
  const maxN = Math.max(1, ...trend.map((x) => x.n));
  const latest = thisYear - 1;
  const latestN = trend.find((x) => x.y === latest)?.n ?? 0;
  const summary = t.perYearSummary(trend[0].y, thisYear, trend.map((x) => `${x.y}: ${x.n}`).join(", "));
  return (
    <figure className="m-0">
      <figcaption>
        <h3 className="text-sm font-semibold text-ink">{t.perYearTitle}</h3>
        <p className="mt-0.5 text-xs text-muted">
          {t.perYearLead} <span className="font-medium text-ink-2">{latest}</span>
          {t.perYearLatest} <span className="num font-medium text-ink-2">{latestN}</span>.
        </p>
      </figcaption>
      <div role="img" aria-label={summary} className="mt-3">
        <div className="flex h-32 items-end gap-[2px] border-b border-line">
          {trend.map((x) => {
            const partial = x.y === thisYear;
            const highlight = x.y === latest;
            return (
              <div key={x.y} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={t.perYearBar(x.y, x.n, partial)}>
                <span className={`num mb-0.5 text-[10px] leading-none ${highlight ? "font-semibold text-ink" : "text-muted"}`}>{x.n}</span>
                <div
                  className={`w-full max-w-7 rounded-t-[4px] ${highlight ? "bg-brand-700" : partial ? "bg-brand-200" : "bg-brand-400"}`}
                  style={{ height: `calc(${(x.n / maxN) * 100}% - 14px)`, minHeight: x.n ? 2 : 0 }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex gap-[2px]" aria-hidden>
          {trend.map((x) => (
            <span
              key={x.y}
              className={`num min-w-0 flex-1 text-center text-[9.5px] leading-tight sm:text-[10px] ${x.y === latest ? "font-semibold text-ink" : "text-muted"}`}
            >
              {x.y}
              {x.y === thisYear ? "*" : ""}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-muted">{t.soFarNote(thisYear)}</p>
      <table className="sr-only">
        <caption>{t.perYearCaption}</caption>
        <thead>
          <tr>
            <th scope="col">{t.colYear}</th>
            <th scope="col">{t.colStarted}</th>
          </tr>
        </thead>
        <tbody>
          {trend.map((x) => (
            <tr key={x.y}>
              <th scope="row">{x.y === thisYear ? t.yearSoFar(x.y) : x.y}</th>
              <td>{x.n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
