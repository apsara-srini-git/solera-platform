"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { Button, ButtonLink, Card, Drawer, EmptyState, Icon, InfoTip, SegmentedControl, SourceDatesProvider, Spinner, cx, type SourceDates } from "@/components/ui";
import { MadridMap, MapLegend, type MapSite, type MarkerState } from "@/components/map";
import { Hero } from "@/components/search/Hero";
import { MapPopupCard } from "@/components/search/MapPopupCard";
import { GLOSSARY, ResultCard, UnscoredCard } from "@/components/search/ResultCard";
import { SearchForm } from "@/components/search/SearchForm";
import { RefreshControl } from "@/components/search/RefreshControl";
import { IndicationNotice } from "@/components/search/IndicationNotice";
import { SavedSearch } from "@/components/search/SavedSearch";
import { HOW_HREF } from "@/components/search/ScoreExplain";
import type { RefreshInfo } from "@/lib/refresh";
import type { SiteResult } from "@/lib/search";
import { downloadTextFile, sponsorSearchFile } from "@/lib/saved-search";
import { replacePart, type IndicationCheck } from "@/lib/spelling";
import { DEFAULT_CRITERIA, type ConfidentialInfo, type TrialCriteria } from "@/lib/types";
import { useLang } from "@/lib/i18n/context";
import { LABELS, fmtNum, joinList } from "@/lib/i18n/pro";
import { SEARCH } from "@/lib/i18n/pro/search";
import { runSearch, toggleShortlist, type SearchResult } from "./actions";
import ProtocolImport, { ProtocolReview, type ProtocolResult } from "./protocol-import";

type Result = SearchResult;
type View = "list" | "map" | "split";

const DEFAULT = DEFAULT_CRITERIA;

function useMediaQuery(query: string, serverValue = true) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/** Hospital page link that carries the search (criteria, project and the "Search anyway" choice) for the way back. */
function siteHref(id: string, criteria?: TrialCriteria, projectId?: string | null, anyway?: boolean) {
  const params = new URLSearchParams();
  if (criteria) params.set("c", JSON.stringify(criteria));
  if (criteria && projectId) params.set("project", projectId);
  if (criteria && anyway) params.set("any", "1");
  const q = params.toString();
  return q ? `/sites/${id}?${q}` : `/sites/${id}`;
}

export default function SearchClient({
  initialCriteria,
  initialProjectId,
  initialShortlist,
  initialSiteId = null,
  initialAnyway = false,
  sites,
  stats,
  refresh,
  loggedIn = false,
  sourceDates = {},
}: {
  initialCriteria: TrialCriteria | null;
  initialProjectId: string | null;
  initialShortlist: string[];
  /** Hospital to highlight on the map (?site=, e.g. from a site page's "Search first to shortlist"). */
  initialSiteId?: string | null;
  /** The URL says the sponsor chose "Search anyway" for a condition with no registered trials. */
  initialAnyway?: boolean;
  sites: MapSite[];
  stats: { hospitals: number; trials: number };
  /** Public-data refresh status (results header). */
  refresh?: RefreshInfo;
  loggedIn?: boolean;
  /** Per-source fetch dates for source popovers. */
  sourceDates?: SourceDates;
}) {
  const lang = useLang();
  const t = SEARCH[lang].results;
  const L = LABELS[lang];
  /** Equipment keys as names in the UI language: "a, b" (sep ", ") or "a, b or c" ("or"). */
  const equipmentList = useCallback(
    (keys: string[] | undefined, sep: ", " | "or") => {
      const names = (keys ?? []).map((k) => L.equipment[k] ?? k);
      return sep === "or" ? joinList(names, lang, "or") : names.join(", ");
    },
    [L, lang],
  );
  const [c, setC] = useState<TrialCriteria>(initialCriteria ?? DEFAULT);
  const [result, setResult] = useState<Result | null>(null);
  const [projectId, setProjectId] = useState(initialProjectId);
  const [shortlist, setShortlist] = useState<string[]>(initialShortlist);
  const [pending, start] = useTransition();
  const [busySite, setBusySite] = useState<string | null>(null);
  const [protocol, setProtocol] = useState<ProtocolResult | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [view, setView] = useState<View>("split");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialSiteId);
  const [editOpen, setEditOpen] = useState(false);
  const [unscoredOpen, setUnscoredOpen] = useState(true);
  /** Nothing matched the indication: suggestions wait under the search field instead of a silent fallback ranking. */
  const [notice, setNotice] = useState<{ criteria: TrialCriteria; check: IndicationCheck } | null>(null);
  /** The shown results were ranked after "Search anyway" (kept in the URL and on links to hospital pages). */
  const [anyway, setAnyway] = useState(false);

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const siteById = useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites]);
  const placedCount = useMemo(() => sites.filter((s) => s.lat != null && s.lon != null).length, [sites]);
  // without coordinates there is nothing to draw: list only, no Map / Split options
  const hasGeo = placedCount > 0;
  const effectiveView: View = !hasGeo ? "list" : isDesktop ? view : view === "map" ? "map" : "list";
  const listVisible = effectiveView !== "map";
  const mapVisible = effectiveView !== "list";

  const search = useCallback(
    (criteria: TrialCriteria, opts?: { anyway?: boolean }) =>
      start(async () => {
        const hadResult = !!result;
        // re-ranking the same condition (hospital type, data refresh…) keeps an earlier "Search anyway"
        const any = opts?.anyway ?? (anyway && !!result && criteria.indication.trim() === result.criteria.indication);
        const r = await runSearch(criteria, { anyway: any });
        if (r.needsConfirm && r.check) {
          setNotice({ criteria: r.criteria, check: r.check });
          return;
        }
        setNotice(null);
        setResult(r);
        setAnyway(any);
        // keep a hospital highlighted when we arrived from its page; otherwise start fresh
        setSelectedId((id) => (hadResult ? null : id));
        setEditOpen(false);
        // shareable / back-button friendly URL (criteria only - never confidential details)
        const params = new URLSearchParams();
        if (projectId) params.set("project", projectId);
        params.set("c", JSON.stringify(r.criteria));
        if (any) params.set("any", "1");
        window.history.replaceState(null, "", `/?${params.toString()}`);
        if (!hadResult) window.scrollTo({ top: 0 });
      }),
    [result, projectId, anyway],
  );

  useEffect(() => {
    if (initialCriteria) search(initialCriteria, { anyway: initialAnyway });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useCallback(
    async (siteId: string) => {
      if (!result) return;
      setBusySite(siteId);
      try {
        // attach the protocol only while the searched criteria still come from it
        const fromProtocol =
          protocol && result.criteria.indication === protocol.criteria.indication
            ? { uploadId: protocol.uploadId, confidential: protocol.confidential }
            : undefined;
        const r = await toggleShortlist(projectId, result.criteria, siteId, fromProtocol);
        setProjectId(r.projectId);
        setShortlist(r.siteIds);
      } finally {
        setBusySite(null);
      }
    },
    [result, protocol, projectId],
  );

  const onProtocol = (r: ProtocolResult) => {
    setProtocol(r);
    setShowReview(true);
    setC(r.criteria);
    setResult(null);
    setEditOpen(false);
    setProjectId(null); // a new protocol is a new project
    setShortlist([]);
  };

  const onConfidential = (confidential: ConfidentialInfo) => setProtocol((p) => (p ? { ...p, confidential } : p));

  const onExample = (next: TrialCriteria) => {
    setProtocol(null);
    setShowReview(false);
    setC(next);
    search(next);
  };

  const onHover = useCallback((id: string | null) => setHoveredId(id), []);
  const showOnMap = useCallback((id: string) => setSelectedId(id), []);
  const onMarkerSelect = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (id && listVisible) {
        const scroll = () => document.getElementById(`site-card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        if (document.getElementById(`site-card-${id}`)) scroll();
        else {
          // a hospital with no registered trials: its card is in the collapsible group
          setUnscoredOpen(true);
          requestAnimationFrame(() => requestAnimationFrame(scroll));
        }
      }
    },
    [listVisible],
  );

  // ---------- map state ----------
  const ranked = useMemo(() => new Map(result?.results.map((r, i) => [r.site.id, { r, rank: i + 1 }]) ?? []), [result]);
  const unscored = useMemo(() => result?.unscored ?? [], [result]);
  const unscoredIds = useMemo(() => new Set(unscored.map((u) => u.site.id)), [unscored]);
  const markers = useMemo(() => {
    if (!result) return null;
    const m = new Map<string, MarkerState>();
    for (const [id, { r, rank }] of ranked) m.set(id, { kind: "ranked", score: r.score, rank });
    for (const e of result.excludedSites ?? []) {
      if (e.reason === "noTrialHistory") m.set(e.id, { kind: "unranked" });
      else if (e.reason === "ownership") m.set(e.id, { kind: "excluded", reason: t.markerHiddenOwnership(L.ownershipLower[result.criteria.ownership]) });
      // only in strict equipment mode does the search hide hospitals for equipment
      else m.set(e.id, { kind: "excluded", reason: t.markerNoEquipment(equipmentList(e.missing, ", ") || t.requiredEquipment) });
    }
    return m;
  }, [result, ranked, t, L, equipmentList]);
  const excludedNote = useMemo(() => new Map((result?.excludedSites ?? []).map((e) => [e.id, e])), [result]);

  const renderPopup = useCallback(
    (site: MapSite) => {
      const hit = ranked.get(site.id);
      if (result && hit) {
        return (
          <MapPopupCard
            site={site}
            r={hit.r}
            rank={hit.rank}
            rankOf={result.results.length}
            criteria={result.criteria}
            phase={result.criteria.phase}
            href={siteHref(site.id, result.criteria, projectId, anyway)}
            shortlisted={shortlist.includes(site.id)}
            busy={busySite === site.id}
            onToggle={() => toggle(site.id)}
          />
        );
      }
      if (result && unscoredIds.has(site.id)) {
        return (
          <MapPopupCard
            site={site}
            href={siteHref(site.id, result.criteria, projectId, anyway)}
            note={t.popupNewToTrials}
            shortlisted={shortlist.includes(site.id)}
            busy={busySite === site.id}
            onToggle={() => toggle(site.id)}
          />
        );
      }
      const ex = excludedNote.get(site.id);
      const note = !ex
        ? undefined
        : ex.reason === "noTrialHistory"
          ? t.popupNewToTrials
          : ex.reason === "ownership"
            ? t.popupHiddenOwnership
            : t.popupHiddenEquipment(equipmentList(ex.missing, ", "));
      return <MapPopupCard site={site} href={siteHref(site.id, result?.criteria, projectId, anyway)} note={note} />;
    },
    [ranked, result, shortlist, busySite, toggle, excludedNote, unscoredIds, projectId, anyway, t, equipmentList],
  );

  // phones: List ↔ Map swaps the whole page, so start the new view at the top instead of mid-scroll
  const changeView = useCallback(
    (v: View) => {
      setView(v);
      if (!isDesktop && v !== effectiveView) window.scrollTo({ top: 0 });
    },
    [isDesktop, effectiveView],
  );

  // phones: the fixed shortlist bar must never cover the footer's attribution text, so pad the page by its height
  const barVisible = !!result && !!projectId && shortlist.length > 0 && !isDesktop;
  useEffect(() => {
    if (!barVisible) return;
    const prev = document.body.style.paddingBottom;
    document.body.style.paddingBottom = "calc(72px + env(safe-area-inset-bottom))";
    return () => {
      document.body.style.paddingBottom = prev;
    };
  }, [barVisible]);

  // ---------- toolbar height (sticky map sits under it) ----------
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarH, setToolbarH] = useState(56);
  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setToolbarH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [result]);

  // "Did you mean…?": replace one comma-separated part of the indication and search again
  const pick = (base: TrialCriteria) => (index: number, label: string) => {
    const next = { ...base, indication: replacePart(base.indication, index, label) };
    setC(next);
    search(next);
  };
  const onOpenSaved = (next: TrialCriteria) => {
    setProtocol(null);
    setShowReview(false);
    setC(next);
    search(next);
  };

  const form = (opts: { hideExamples?: boolean; submitLabel?: string }) => (
    <SearchForm
      c={c}
      onChange={setC}
      onSubmit={(next) => search(next)}
      onExample={onExample}
      pending={pending}
      defaults={DEFAULT}
      belowIndication={
        notice && notice.criteria.indication === c.indication.trim() ? (
          <IndicationNotice check={notice.check} mode="confirm" onPick={pick(c)} onAnyway={() => search(c, { anyway: true })} />
        ) : undefined
      }
      footer={<SavedSearch criteria={c} onOpen={onOpenSaved} className="border-t border-line pt-3" />}
      {...opts}
    />
  );

  // ======================= before the first search =======================
  if (!result) {
    return (
      <SourceDatesProvider dates={sourceDates}>
      <div className="space-y-8">
        <Hero hospitals={stats.hospitals} trials={stats.trials} />
        <div className={cx("grid items-start gap-6", hasGeo ? "lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]" : "max-w-2xl")}>
          <div className="space-y-3">
            <ProtocolImport onExtracted={onProtocol} />
            {protocol && showReview && (
              <ProtocolReview result={protocol} onConfidentialChange={onConfidential} onDismiss={() => setShowReview(false)} />
            )}
            <Card padding="md" className="shadow-raised">
              <h2 className="mb-4 text-base font-semibold text-ink">{t.describeTitle}</h2>
              {form({})}
            </Card>
          </div>
          {hasGeo && (
            <div className="lg:sticky lg:top-[calc(var(--header-h)+16px)]">
              <Card padding="none" className="overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
                  <h2 className="text-sm font-semibold text-ink">{t.allHospitals}</h2>
                  <span className="text-right text-xs text-muted">{t.searchToColour}</span>
                </div>
                <MadridMap
                  className="h-[360px] sm:h-[460px] lg:h-[calc(100dvh-var(--header-h)-80px)] lg:max-h-[820px] lg:min-h-[520px]"
                  sites={sites}
                  hoveredId={hoveredId}
                  selectedId={selectedId}
                  onHover={onHover}
                  onSelect={setSelectedId}
                  renderPopup={renderPopup}
                  overlay={<MapLegend mode="all" count={placedCount} />}
                />
              </Card>
            </div>
          )}
        </div>
      </div>
      </SourceDatesProvider>
    );
  }

  // ======================= results =======================
  const rc = result.criteria;
  const summary = [
    L.phases[rc.phase],
    rc.areaOther || (rc.area ? L.areas[rc.area] : ""),
    rc.populationOther || (rc.population !== "adult" ? L.populations[rc.population] : ""),
    ...rc.equipment.map((e) => L.equipment[e] ?? e),
  ].filter(Boolean);
  const ex = result.excluded;
  const showCta = !!projectId && shortlist.length > 0;
  // phones: the shortlist CTA is a sticky bottom bar; keep the map clear of it
  const bottomBar = showCta && !isDesktop ? 72 : 0;
  const mapHeight = `calc(100dvh - var(--header-h) - ${toolbarH + bottomBar}px)`;

  const filteredOut = (result.excludedSites ?? []).some((e) => e.reason !== "noTrialHistory");
  return (
    <SourceDatesProvider dates={sourceDates}>
    <div className="full-bleed -mt-8 sm:-mt-10">
      {/* sticky results toolbar */}
      <div ref={toolbarRef} className="sticky top-(--header-h) z-30 border-b border-line bg-surface/95 shadow-xs backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
          <Button variant="secondary" size="sm" icon="filter" onClick={() => setEditOpen(true)}>
            {t.editSearch}
          </Button>
          <div className="min-w-0 flex-1 basis-48">
            <div className="truncate text-sm font-semibold text-ink" title={rc.indication}>
              {rc.indication}
            </div>
            <div className="truncate text-xs text-muted">{summary.join(" · ")}</div>
          </div>
          <div className={cx("flex items-center gap-2", hasGeo ? "w-full sm:w-auto" : "ml-auto")}>
            {/* phones: the hospital type lives in the Edit search drawer */}
            <div className="hidden sm:block">
              <SegmentedControl
                label={SEARCH[lang].form.hospitalType}
                size="sm"
                value={rc.ownership}
                onChange={(v) => {
                  const next = { ...rc, ownership: v };
                  setC(next);
                  search(next);
                }}
                options={[
                  { value: "any", label: L.ownership.any },
                  { value: "public", label: L.ownership.public },
                  { value: "private", label: L.ownership.private },
                ]}
              />
            </div>
            {pending && <Spinner size={16} className="text-brand-600" />}
            <div className="ml-auto flex items-center gap-2 sm:ml-2">
              {showCta && (
                <span className="hidden lg:contents">
                  <ButtonLink href={`/projects/${projectId}`} size="sm" iconRight="arrowRight">
                    <span>
                      <span className="num">{fmtNum(shortlist.length, lang)}</span> {t.shortlisted(shortlist.length)}
                    </span>
                  </ButtonLink>
                </span>
              )}
              {hasGeo && (
                <SegmentedControl
                  label={t.view}
                  size="sm"
                  value={effectiveView}
                  onChange={changeView}
                  options={
                    isDesktop
                      ? [
                          { value: "list", label: t.list, icon: "list" },
                          { value: "map", label: t.map, icon: "map" },
                          { value: "split", label: t.split, icon: "split" },
                        ]
                      : [
                          { value: "list", label: t.list, icon: "list" },
                          { value: "map", label: t.map, icon: "map" },
                        ]
                  }
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-start">
        {/* list */}
        <div
          className={cx(
            "min-w-0 px-4 py-5 transition-opacity sm:px-6",
            !listVisible && "hidden",
            // split: start the list on the header's container edge so it lines up with the toolbar and logo
            effectiveView === "split" ? "w-[46%] shrink-0 sm:pl-[max(1.5rem,calc((100vw-80rem)/2+1.5rem))] xl:w-[44%]" : "w-full",
            pending && "opacity-60",
          )}
          aria-busy={pending}
        >
          <div className={cx("space-y-4", effectiveView === "list" && "mx-auto max-w-4xl")}>
            {protocol && showReview && (
              <ProtocolReview result={protocol} onConfidentialChange={onConfidential} onDismiss={() => setShowReview(false)} />
            )}
            <div className="space-y-1">
              <h1 className="flex items-center gap-1.5 text-lg font-semibold text-ink">
                <span>
                  <span className="num">{fmtNum(result.results.length, lang)}</span> {t.ranked(result.results.length)}
                </span>
                <InfoTip label={t.whatIsFit} align="end" side="bottom">
                  {GLOSSARY[lang].fitScore}
                </InfoTip>
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link href={HOW_HREF} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                  <Icon name="info" size={13} /> {t.howScoring}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    const f = sponsorSearchFile(rc);
                    downloadTextFile(f.filename, f.json);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                  title={t.downloadTitle}
                  data-testid="results-download-search"
                >
                  <Icon name="download" size={13} /> {t.downloadSearch}
                </button>
                {refresh && <RefreshControl initial={refresh} loggedIn={loggedIn} onRefreshed={() => search(rc)} />}
              </div>
              {result.check && (
                <IndicationNotice
                  check={result.check}
                  mode="results"
                  className="mt-2"
                  onPick={pick(rc)}
                  onAdd={(label) => {
                    const next = { ...rc, indication: `${rc.indication}, ${label}` };
                    setC(next);
                    search(next);
                  }}
                />
              )}
              {(unscored.length > 0 || ex.ownership > 0 || ex.missingEquipment > 0) && (
                <p className="text-xs text-muted">
                  {[
                    unscored.length > 0 && t.unscoredNote(unscored.length),
                    ex.ownership > 0 && t.hiddenOwnership(ex.ownership),
                    ex.missingEquipment > 0 && t.hiddenEquipment(ex.missingEquipment, equipmentList(rc.equipment, "or")),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
            {result.results.length === 0 ? (
              <EmptyState
                icon="search"
                title={t.emptyTitle}
                description={t.emptyDescription}
                action={
                  <Button variant="secondary" icon="filter" onClick={() => setEditOpen(true)}>
                    {t.editSearch}
                  </Button>
                }
              />
            ) : (
              <ol className="space-y-3">
                {result.results.map((r: SiteResult, i) => (
                  <ResultCard
                    key={r.site.id}
                    r={r}
                    rank={i + 1}
                    rankOf={result.results.length}
                    criteria={rc}
                    site={siteById.get(r.site.id)}
                    phase={rc.phase}
                    href={siteHref(r.site.id, rc, projectId, anyway)}
                    shortlisted={shortlist.includes(r.site.id)}
                    busy={busySite === r.site.id}
                    highlighted={mapVisible && (hoveredId === r.site.id || selectedId === r.site.id)}
                    withMap={mapVisible}
                    onToggle={toggle}
                    onHover={onHover}
                    onShowOnMap={showOnMap}
                  />
                ))}
              </ol>
            )}
            {unscored.length > 0 && (
              <section className="rounded-xl border border-line bg-subtle/40" aria-labelledby="unscored-h">
                <h2 id="unscored-h">
                  <button
                    type="button"
                    onClick={() => setUnscoredOpen(!unscoredOpen)}
                    aria-expanded={unscoredOpen}
                    aria-controls="unscored-list"
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left hover:bg-subtle/70"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">
                        {t.unscoredTitle} (<span className="num">{fmtNum(unscored.length, lang)}</span>)
                      </span>
                      <span className="mt-0.5 block text-xs font-normal text-muted">
                        {t.unscoredText}
                      </span>
                    </span>
                    <Icon name="chevronDown" size={16} className={cx("shrink-0 text-muted transition", unscoredOpen && "rotate-180")} />
                  </button>
                </h2>
                {unscoredOpen && (
                  <ul id="unscored-list" className="space-y-2.5 px-3 pb-3">
                    {unscored.map((u) => (
                      <UnscoredCard
                        key={u.site.id}
                        u={u}
                        site={siteById.get(u.site.id)}
                        href={siteHref(u.site.id, rc, projectId, anyway)}
                        shortlisted={shortlist.includes(u.site.id)}
                        busy={busySite === u.site.id}
                        highlighted={mapVisible && (hoveredId === u.site.id || selectedId === u.site.id)}
                        onToggle={toggle}
                        onHover={onHover}
                      />
                    ))}
                  </ul>
                )}
              </section>
            )}
            <p className="pt-2 text-center text-xs text-muted">
              {t.footerNote}
            </p>
          </div>
        </div>

        {/* map */}
        <div
          className={cx("sticky min-w-0 flex-1 border-l border-line", !mapVisible && "hidden")}
          style={{ top: `calc(var(--header-h) + ${toolbarH}px)`, height: mapHeight }}
        >
          {hasGeo ? (
            <MadridMap
              className="h-full w-full"
              sites={sites}
              markers={markers}
              hoveredId={hoveredId}
              selectedId={selectedId}
              onHover={onHover}
              onSelect={onMarkerSelect}
              renderPopup={renderPopup}
              overlay={<MapLegend mode="fit" filtered={filteredOut} unranked={unscored.length > 0} />}
            />
          ) : (
            <EmptyState
              icon="map"
              title={t.mapPendingTitle}
              description={t.mapPendingText}
              className="h-full border-0"
            />
          )}
        </div>
      </div>

      {showCta && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgb(15_29_34/0.08)] backdrop-blur-md lg:hidden">
          <ButtonLink href={`/projects/${projectId}`} block iconRight="arrowRight">
            <span>
              <span className="num">{fmtNum(shortlist.length, lang)}</span> {t.shortlisted(shortlist.length)} · {t.continue}
            </span>
          </ButtonLink>
        </div>
      )}

      <Drawer
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={t.editSearch}
        description={t.drawerDescription}
        width="lg"
      >
        <div className="space-y-4">
          <ProtocolImport onExtracted={onProtocol} />
          {form({ hideExamples: true, submitLabel: t.updateResults })}
        </div>
      </Drawer>
    </div>
    </SourceDatesProvider>
  );
}
