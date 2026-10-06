import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, Icon, SegmentedControl, cx } from "@/components/ui";
import { AutoSubmit } from "@/components/patients/AutoSubmit";
import { FilterDisclosure } from "@/components/patients/FilterDisclosure";
import PatientMap from "@/components/patients/PatientMap";
import type { PatientMapMarker } from "@/components/patients/PatientMapInner";
import { mapLabels } from "@/components/patients/map-labels";
import {
  ActiveFilters,
  FilterChips,
  HospitalCountList,
  Pagination,
  SEARCH_FORM_ID,
  SortSelect,
  type ActiveFilter,
} from "@/components/patients/SearchControls";
import { TrialCard } from "@/components/patients/TrialCard";
import { patientHospitals, patientSources } from "@/lib/patients/data";
import { EDUCATION_SECTIONS } from "@/lib/patients/education";
import { dict, fmt, formatDate, formatNumber, locale, plural } from "@/lib/patients/i18n";
import { AGE_GROUP_LABELS, REGISTRY_LABELS, areaLabel } from "@/lib/patients/labels";
import { getLang } from "@/lib/patients/lang";
import { areaCounts, parsePatientQuery, patientSuggestions, searchPatientTrials } from "@/lib/patients/search";
import { SavedSearchBar } from "@/components/patients/SavedSearchBar";
import type { PatientQuery, Registry } from "@/lib/patients/types";
import { hospitalHref, parseView, searchHref, trialHref, type PortalView } from "@/lib/patients/urls";

export async function generateMetadata(): Promise<Metadata> {
  const d = dict(await getLang());
  return { title: d.searchMetaTitle, description: d.searchMetaDescription };
}

export default async function PatientSearchPage(props: PageProps<"/pacientes">) {
  const lang = await getLang();
  const d = dict(lang);
  const sp = await props.searchParams;
  const view: PortalView = parseView(sp.view);
  const parsed = parsePatientQuery(sp, lang);
  const res = searchPatientTrials(parsed);
  const query: PatientQuery = res.query;
  const hospitals = patientHospitals();
  const areas = areaCounts(!!query.includeStale, { ...query, q: res.relaxedQ ?? query.q });
  const src = patientSources();
  const fetchedLine = fmt(d.dataFetchedLine, {
    sources: (Object.keys(src.sources) as Registry[])
      .filter((r) => src.sources[r].fetchedAt)
      .map((r) => fmt(d.dataFetchedSource, { registry: REGISTRY_LABELS[r][lang], date: formatDate(src.sources[r].fetchedAt, lang) }))
      .join(" · "),
  });
  const filterCount = [query.age, query.area, query.hospital, query.status, query.healthyVolunteers, query.includeStale].filter(Boolean).length;
  const EXAMPLES = lang === "es" ? ["cáncer de mama", "diabetes", "asma", "leucemia", "Alzheimer"] : ["breast cancer", "diabetes", "asthma", "leukaemia", "Alzheimer"];
  const pages = Math.max(1, Math.ceil(res.total / res.query.pageSize));
  const from = res.total === 0 ? 0 : (res.query.page - 1) * res.query.pageSize + 1;
  const to = Math.min(res.total, res.query.page * res.query.pageSize);
  const href = (o: Partial<PatientQuery>, v: PortalView = view) => searchHref(query, o, v);
  const listView: PortalView = view === "map" ? "list" : view;

  // "¿Quisiste decir…?": only when the words as typed found nothing (or had to be relaxed)
  const suggestions = query.q && (res.total === 0 || res.relaxedQ) ? patientSuggestions(query.q, lang) : [];
  const didYouMean =
    suggestions.length > 0 ? (
      <span className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-start" data-testid="did-you-mean">
        <span className="font-medium text-ink">{d.didYouMean}</span>
        <span className="sr-only">{d.didYouMeanLabel}</span>
        {suggestions.map((s) => (
          <Link key={s.q} href={searchHref(query, { q: s.q }, view)} className="rounded-full bg-brand-50 px-2.5 py-1 text-[13px] font-medium text-brand-800 ring-1 ring-brand-200 ring-inset hover:bg-brand-100">
            {s.label}
          </Link>
        ))}
      </span>
    ) : null;

  // active filter chips (each links to the same search without it)
  const active: ActiveFilter[] = [];
  if (query.q) active.push({ label: `“${query.q}”`, removeHref: href({ q: undefined }) });
  if (query.age) active.push({ label: AGE_GROUP_LABELS[query.age][lang], removeHref: href({ age: undefined }) });
  if (query.area) active.push({ label: areaLabel(query.area, lang), removeHref: href({ area: undefined }) });
  if (query.hospital) {
    const h = hospitals.find((x) => x.id === query.hospital);
    active.push({ label: h?.name ?? query.hospital, removeHref: href({ hospital: undefined }) });
  }
  if (query.status) active.push({ label: query.status === "recruiting" ? d.statusRecruiting : d.statusNotYet, removeHref: href({ status: undefined }) });
  if (query.healthyVolunteers) active.push({ label: d.filterHealthy, removeHref: href({ healthyVolunteers: false }) });
  if (query.includeStale) active.push({ label: d.filterStale, removeHref: href({ includeStale: false }) });
  const clearHref = searchHref({ sort: query.sort }, {}, view);

  // map markers (all matching trials, not just this page)
  const placed = res.hospitals.filter((h) => h.hospital.geo);
  const markers: PatientMapMarker[] = placed.map((h) => ({
    id: h.hospital.id,
    name: h.hospital.name,
    municipality: h.hospital.municipality,
    lat: h.hospital.geo!.lat,
    lon: h.hospital.geo!.lon,
    image: h.hospital.image,
    total: h.total,
    recruiting: h.recruiting,
    notYet: h.notYet,
    unknown: h.unknown,
    listHref: href({ hospital: h.hospital.id }, listView),
    hospitalHref: hospitalHref(h.hospital.id),
  }));
  const missingGeo = res.hospitals.length - placed.length;

  const viewOptions = [
    { value: "list" as const, label: d.viewList, icon: "list" as const, href: href({ page: res.query.page }, "list") },
    { value: "map" as const, label: d.viewMap, icon: "map" as const, href: href({}, "map") },
    { value: "split" as const, label: d.viewSplit, icon: "split" as const, href: href({ page: res.query.page }, "split") },
  ];

  const cards =
    res.items.length === 0 ? null : (
      <ul className={cx("grid gap-4", view === "split" ? "xl:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3")}>
        {res.items.map((t) => (
          <li key={t.id} className="min-w-0">
            <TrialCard trial={t} lang={lang} href={trialHref(t.id)} siteId={query.hospital} />
          </li>
        ))}
      </ul>
    );

  const onlyWords = !!query.q && filterCount === 0;
  const empty = onlyWords ? (
    <EmptyState
      icon="search"
      title={fmt(d.noResultsForQuery, { q: query.q! })}
      description={
        <span className="block">
          {didYouMean && <span className="mb-3 block">{didYouMean}</span>}
          {d.noResultsQueryText}{" "}
          <span className="mt-2 flex flex-wrap justify-center gap-1.5">
            {EXAMPLES.map((x) => (
              <Link key={x} href={searchHref({ sort: query.sort }, { q: x }, view)} className="rounded-full bg-subtle px-2.5 py-1 text-[13px] font-medium text-brand-700 ring-1 ring-line ring-inset hover:bg-brand-50">
                {x}
              </Link>
            ))}
          </span>
        </span>
      }
    />
  ) : (
    <EmptyState
      icon="search"
      title={d.noResultsTitle}
      description={didYouMean ? <span className="block">{d.noResultsText}<span className="mt-2 block">{didYouMean}</span></span> : d.noResultsText}
      action={
        active.length > 0 ? (
          <Link href={clearHref} className="btn-secondary">
            {d.clearFilters}
          </Link>
        ) : undefined
      }
    />
  );

  const staleNote =
    res.hiddenStale > 0 && !query.includeStale ? (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-surface px-3.5 py-2.5 text-[13px] text-ink-2 ring-1 ring-line ring-inset">
        <Icon name="info" size={15} className="text-muted" />
        {plural(res.hiddenStale, d.hiddenStaleOne, d.hiddenStaleOther, lang)}
        <Link href={href({ includeStale: true })} className="font-medium text-brand-700 underline underline-offset-2">
          {d.showThem}
        </Link>
      </p>
    ) : null;

  const pagination = (
    <Pagination page={res.query.page} pages={pages} lang={lang} hrefFor={(p) => href({ page: p })} />
  );

  const map = (cls: string) => (
    <PatientMap markers={markers} labels={mapLabels(lang)} mode="search" className={cls} linkCards={view === "split"} locale={locale(lang)} />
  );

  return (
    <div>
      <AutoSubmit formId={SEARCH_FORM_ID} />
      {/* hero + search */}
      <section className="border-b border-line bg-gradient-to-b from-brand-50/80 to-[#f7f8f7]">
        <div className="mx-auto max-w-7xl px-4 pt-7 pb-5 sm:px-6 sm:pt-10">
          <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-ink sm:text-[32px]">{d.heroTitle}</h1>
          <p className="mt-2 max-w-2xl text-[15.5px] leading-relaxed text-ink-2">{d.heroIntro}</p>
          <form id={SEARCH_FORM_ID} method="get" action="/pacientes" role="search" autoComplete="off" className="mt-5 max-w-3xl">
            {view !== "list" && <input type="hidden" name="view" value={view} />}
            <label htmlFor="q" className="mb-1.5 block text-[14px] font-medium text-ink">
              {d.searchLabel}
            </label>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Icon name="search" size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
                <input
                  id="q"
                  name="q"
                  type="search"
                  defaultValue={query.q ?? ""}
                  placeholder={d.searchPlaceholder}
                  maxLength={120}
                  autoComplete="off"
                  aria-describedby="q-hint"
                  className="input h-12 rounded-xl pl-10 text-[15.5px]"
                />
              </div>
              <button type="submit" className="btn-primary h-12 rounded-xl px-5 text-[15px]">
                <Icon name="search" size={17} className="sm:hidden" />
                <span className="sr-only sm:not-sr-only">{d.searchButton}</span>
              </button>
            </div>
            <p id="q-hint" className="mt-1.5 text-[12.5px] text-muted">
              {d.searchHint}
            </p>
          </form>
          <div className="mt-4">
            <FilterDisclosure label={d.filtersButton} count={filterCount}>
              <FilterChips query={query} lang={lang} areas={areas} hospitals={hospitals} />
            </FilterDisclosure>
          </div>
        </div>
      </section>

      {/* toolbar */}
      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 space-y-1.5">
            <h2 id="results-heading" tabIndex={-1} className="text-[17px] font-semibold text-ink outline-none" aria-live="polite">
              <span className="num">{plural(res.total, d.resultsOne, d.resultsOther, lang)}</span>
              {query.q && <span className="font-normal text-ink-2"> {fmt(d.resultsFor, { q: res.relaxedQ ?? query.q })}</span>}
            </h2>
            {res.relaxedQ && (
              <p className="flex items-start gap-1.5 text-[13px] text-ink-2">
                <Icon name="info" size={14} className="mt-0.5 shrink-0 text-muted" />
                {fmt(d.relaxedNote, { q: query.q!, q2: res.relaxedQ })}
              </p>
            )}
            {res.relaxedQ && didYouMean && <div className="text-[13px]">{didYouMean}</div>}
            {res.total > 0 && view !== "map" && (
              <p className="num text-[12.5px] text-muted">
                {fmt(d.showingRange, { from: formatNumber(from, lang), to: formatNumber(to, lang), total: formatNumber(res.total, lang) })}
              </p>
            )}
            <ActiveFilters filters={active} clearHref={clearHref} lang={lang} />
            <SavedSearchBar
              query={{
                q: query.q,
                age: query.age,
                area: query.area,
                hospital: query.hospital,
                status: query.status,
                stale: query.includeStale,
                healthy: query.healthyVolunteers,
                sort: query.sort,
                view,
              }}
              labels={{
                title: d.savedSearchTitle,
                download: d.downloadSearch,
                open: d.openSavedSearch,
                copy: d.copyLink,
                copied: d.linkCopied,
                copyFailed: d.copyFailed,
                note: d.savedSearchNote,
                done: d.savedSearchDone,
                fileLabel: d.savedSearchFileLabel,
                errorFile: d.savedSearchErrorFile,
                errorKind: d.savedSearchErrorKind,
                errorVersion: d.savedSearchErrorVersion,
              }}
            />
          </div>
          <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
            {view !== "map" && <SortSelect query={query} lang={lang} />}
            <SegmentedControl label={d.viewLabel} value={view} options={viewOptions} />
          </div>
        </div>
        {staleNote && <div className="mt-3">{staleNote}</div>}
        <p className="mt-3 text-[12.5px] text-muted">{d.heroNote}</p>
        <p className="mt-1 text-[12.5px] text-muted">{fetchedLine}</p>
      </div>

      {/* results */}
      {view === "list" && (
        <div className="mx-auto max-w-7xl px-4 pt-4 pb-12 sm:px-6">
          {cards ?? empty}
          {cards && <div className="mt-8">{pagination}</div>}
        </div>
      )}

      {view === "map" && (
        <div className="mx-auto max-w-7xl px-4 pt-4 pb-12 sm:px-6">
          {markers.length > 0 ? map("h-[min(68dvh,640px)] min-h-[380px] overflow-hidden rounded-2xl border border-line shadow-card") : empty}
          {missingGeo > 0 && <p className="mt-2 text-[12.5px] text-muted">{fmt(d.mapMissingGeo, { n: missingGeo })}</p>}
          {res.hospitals.length > 0 && (
            <HospitalCountList
              items={res.hospitals}
              lang={lang}
              heading={d.sectionHospitals}
              listHref={(id) => href({ hospital: id }, "list")}
              hospitalHref={hospitalHref}
            />
          )}
        </div>
      )}

      {view === "split" && (
        <div className="mx-auto max-w-[1600px] px-4 pt-4 pb-12 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6">
          <div className="min-w-0">
            {cards ?? empty}
            {cards && <div className="mt-8">{pagination}</div>}
          </div>
          <div className="hidden lg:block">
            <div className="sticky top-[calc(var(--portal-header-h)+16px)] h-[calc(100dvh-var(--portal-header-h)-32px)]">
              {markers.length > 0 ? map("h-full overflow-hidden rounded-2xl border border-line shadow-card") : null}
            </div>
          </div>
          {/* phones: the split view becomes the list with a button to the map */}
          {markers.length > 0 && (
            <div className="portal-noprint sticky bottom-4 z-20 mt-6 flex justify-center lg:hidden">
              <Link href={href({}, "map")} className="btn-primary h-11 rounded-full px-5 shadow-raised">
                <Icon name="map" size={17} /> {d.showMap}
              </Link>
            </div>
          )}
        </div>
      )}

      {view === "map" && (
        <div className="portal-noprint -mt-8 mb-6 flex justify-center sm:hidden">
          <Link href={href({}, "list")} className="btn-primary h-11 rounded-full px-5 shadow-raised">
            <Icon name="list" size={17} /> {d.showList}
          </Link>
        </div>
      )}

      {/* generic next step + education (never trial-specific) */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-9 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div>
            <h2 className="text-base font-semibold text-ink">{d.whatYouCanDo}</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{d.nextStepTeaser}</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-3">
            {EDUCATION_SECTIONS.filter((s) => ["que-es", "fases", "hablar-con-tu-medico"].includes(s.id)).map((s) => (
              <li key={s.id}>
                <Link href={`/pacientes/aprende#${s.id}`} className="card-interactive block h-full p-4">
                  <span className="text-[14.5px] font-semibold text-ink">{s.title[lang]}</span>
                  <span className="mt-1 block text-[13px] leading-snug text-ink-2">{s.summary[lang]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
