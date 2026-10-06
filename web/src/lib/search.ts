import "server-only";
import { dataset } from "./data";
import { indicationMatcher, normalise } from "./indication";
import { checkIndicationWith, type IndicationCheck } from "./spelling";
import { conditionVocabulary } from "./vocabulary";
import type { Site, Trial, TrialCriteria } from "./types";
import { EQUIPMENT, PHASES, phasesOf } from "./types";
import { LABELS, type Lang } from "./i18n/pro";
import { SCORING } from "./i18n/pro/scoring";

/** Equipment name in the UI language (English names stay those of lib/types EQUIPMENT). */
const equipName = (k: string, lang: Lang) => (lang === "es" ? LABELS.es.equipment[k] : undefined) ?? EQUIPMENT[k] ?? k;

const CURRENT_YEAR = new Date().getFullYear();
/** "Recent" = started in this calendar year or the 3 before it (e.g. 2023 or later in 2026). */
const RECENT_SINCE = CURRENT_YEAR - 3;
const ACTIVE = new Set(["RECRUITING", "NOT_YET_RECRUITING", "ENROLLING_BY_INVITATION"]);
const FINAL = new Set(["COMPLETED", "TERMINATED", "WITHDRAWN"]);

/** Plain-language data rules, shared with the "How scoring works" page so the text always matches the code. */
export const SCORING_RULES = {
  recentYears: 3,
  recentSince: RECENT_SINCE,
  activeStatuses: [...ACTIVE],
  finalStatuses: [...FINAL],
  minFinishedForRate: 3,
  competingShareForMax: 0.5,
  bedsForFullPoints: 800,
  refFloors: { indication: 5, phase: 3, area: 20, recent: 3, pediatric: 3 },
} as const;

export { indicationMatcher, normalise } from "./indication";
export { parseCriteria } from "./criteria";

// ---------- spelling check ("Did you mean…?") ----------

const countCache = new Map<string, number>();
/** Registered Madrid trials an indication (or one part of it) matches. Cached per dataset load. */
function matchCount(indication: string): number {
  const { trials } = dataset();
  const key = normalise(indication);
  if (countCache.get("__trials") !== trials.length) {
    countCache.clear();
    countCache.set("__trials", trials.length);
  }
  let n = countCache.get(key);
  if (n === undefined) {
    const m = indicationMatcher(indication);
    n = trials.filter(m).length;
    if (countCache.size > 5000) countCache.clear();
    countCache.set(key, n);
  }
  return n;
}

/** Checks each comma-separated part of the indication against Madrid's registered trials (see checkIndicationWith). */
export function checkIndication(indication: string): IndicationCheck {
  return checkIndicationWith(conditionVocabulary(), indication, matchCount);
}

// ---------- scoring ----------

export interface ScoreComponent {
  key: string;
  label: string;
  weight: number;
  value: number; // 0..1
  detail: string;
  /** The raw number behind the component (trials, beds, % completed) and, for relative components, the Madrid
   *  reference it is compared with (the most experienced hospital for this search). Optional for older callers. */
  count?: number;
  ref?: number;
  /** The highest raw count among Madrid hospitals for this search (set by scoreAll). */
  top?: number;
  scale?: "log" | "rate" | "linear";
}

export interface SiteResult {
  site: Pick<Site, "id" | "name" | "municipality" | "beds" | "ownership" | "hospitalClass" | "researchUnit">;
  score: number; // 0..100
  components: ScoreComponent[];
  /** `key` identifies a flag kind (e.g. "competing") so UIs can avoid repeating a stat that is already shown. */
  flags: { level: "warn" | "info"; text: string; key?: string }[];
  stats: {
    indicationTrials: number;
    phaseTrials: number;
    areaTrials: number;
    recentTrials: number;
    competingTrials: number;
    pediatricTrials: number;
    completionRate: number | null;
  };
  missingEquipment: string[];
  /** Points taken off (exact, before rounding): competing recruiting trials and, in soft equipment mode, required
   *  equipment the national catalogue does not list. Optional for older callers. */
  penalties?: { competing: number; equipment: number };
  /** Where this hospital stands per component among all Madrid hospitals with trial history for this search
   *  ("1 + hospitals with a strictly higher value"). Optional for older callers. */
  ranks?: Record<string, number>;
  /** What the phase / recent / paediatric counts are judged on ("condition", the chosen "area" or "all" registered
   *  trials), whether a therapeutic area was chosen, and the first year counted as recent. Optional for older callers. */
  basis?: { experience: ExperienceBasis; areaChosen: boolean; recentSince: number };
}

/** Soft equipment mode: points off per required item the catalogue does not list, and the cap. */
export const EQUIPMENT_PENALTY = { perItem: 5, max: 10 };

const logScale = (n: number, ref: number) => Math.min(1, Math.log1p(n) / Math.log1p(ref));

function siteIsActiveIn(t: Trial, siteId: string): boolean {
  const s = t.sites.find((x) => x.siteId === siteId);
  const st = s?.status ?? t.status;
  return ACTIVE.has(st) && ACTIVE.has(t.status);
}

/** Per-search reference values: experience is scored relative to the most experienced Madrid hospital for
 *  this query (log scale), so scores stay meaningful as the dataset grows. Floors stop tiny queries inflating. */
export interface Refs {
  indication: number;
  phase: number;
  area: number;
  recent: number;
  pediatric: number;
}
const REF_FLOORS: Refs = { indication: 5, phase: 3, area: 20, recent: 3, pediatric: 3 };

/** Which trials phase, recent-activity and paediatric experience are judged on for a search. The same basis applies to
 *  every hospital: trials in the searched condition whenever any Madrid hospital has one (a hospital with none in the
 *  condition then has none to count); otherwise trials in the chosen therapeutic area, or every registered trial when
 *  no area is chosen. */
export type ExperienceBasis = "condition" | "area" | "all";
const basisCache = new WeakMap<(t: Trial) => boolean, Map<string, ExperienceBasis>>();
export function experienceBasis(c: TrialCriteria, matches: (t: Trial) => boolean): ExperienceBasis {
  let byArea = basisCache.get(matches);
  if (!byArea) basisCache.set(matches, (byArea = new Map()));
  let basis = byArea.get(c.area);
  if (!basis) {
    const { sites, trialsBySite } = dataset();
    const anywhere = sites.some((site) => trialsBySite.get(site.id)?.some(matches));
    basis = anywhere ? "condition" : c.area ? "area" : "all";
    byArea.set(c.area, basis);
  }
  return basis;
}

export function siteCounts(site: Site, trials: Trial[], c: TrialCriteria, matches: (t: Trial) => boolean, basis = experienceBasis(c, matches)) {
  const inArea = (t: Trial) => !c.area || t.areas.includes(c.area);
  const indication = trials.filter(matches);
  const area = trials.filter(inArea);
  // phase/recency/paediatric are judged on the condition's trials whenever the condition has any in Madrid, never on a
  // per-hospital fallback (that gave hospitals with no trials in the condition full points from unrelated trials)
  const relevant = basis === "condition" ? indication : area;
  // combined designs (I/II, II/III) count experience in ANY of their phases
  const wanted = phasesOf(c.phase);
  const phase = relevant.filter((t) => wanted.some((p) => t.phases.includes(p)));
  const recent = relevant.filter((t) => t.startYear && t.startYear >= RECENT_SINCE);
  const competing = indication.filter((t) => siteIsActiveIn(t, site.id));
  const pediatric = relevant.filter((t) => t.ages.includes("CHILD"));
  const finished = area.filter((t) => FINAL.has(t.status));
  return { indication, area, phase, recent, competing, pediatric, finished };
}

export function computeRefs(c: TrialCriteria, matches: (t: Trial) => boolean): Refs {
  const { sites, trialsBySite } = dataset();
  const refs = { ...REF_FLOORS };
  const basis = experienceBasis(c, matches);
  for (const site of sites) {
    const trials = trialsBySite.get(site.id);
    if (!trials?.length) continue;
    const k = siteCounts(site, trials, c, matches, basis);
    refs.indication = Math.max(refs.indication, k.indication.length);
    refs.phase = Math.max(refs.phase, k.phase.length);
    refs.area = Math.max(refs.area, k.area.length);
    refs.recent = Math.max(refs.recent, k.recent.length);
    refs.pediatric = Math.max(refs.pediatric, k.pediatric.length);
  }
  return refs;
}

/** `lang` only changes the generated text (component labels / details, flags, equipment names), never the numbers. */
export function scoreSite(site: Site, trials: Trial[], c: TrialCriteria, matches: (t: Trial) => boolean, refs: Refs, lang: Lang = "en"): SiteResult {
  const T = SCORING[lang].engine;
  const basis = experienceBasis(c, matches);
  const { indication, area, phase, recent, competing, pediatric, finished } = siteCounts(site, trials, c, matches, basis);
  const completionRate = finished.length >= 3 ? finished.filter((t) => t.status === "COMPLETED").length / finished.length : null;

  const phaseLabel = lang === "es" ? LABELS.es.phases[c.phase].replace(/^Fase/, "fase") : PHASES[c.phase];
  const scope = T.scope[basis];

  const components: ScoreComponent[] = [
    {
      key: "indication",
      label: T.label.indication,
      weight: 35,
      value: logScale(indication.length, refs.indication),
      count: indication.length,
      ref: refs.indication,
      scale: "log",
      detail: T.indication(indication.length, c.indication),
    },
    {
      key: "phase",
      label: T.label.phase(phaseLabel),
      weight: 15,
      value: logScale(phase.length, refs.phase),
      count: phase.length,
      ref: refs.phase,
      scale: "log",
      detail: T.phase(phase.length, phaseLabel, scope),
    },
    {
      key: "area",
      label: T.label.area,
      weight: 15,
      value: logScale(area.length, refs.area),
      count: area.length,
      ref: refs.area,
      scale: "log",
      detail: c.area ? T.area(area.length) : T.overall(area.length),
    },
    {
      key: "recent",
      label: T.label.recent,
      weight: 10,
      value: logScale(recent.length, refs.recent),
      count: recent.length,
      ref: refs.recent,
      scale: "log",
      detail: T.recent(recent.length, scope, RECENT_SINCE),
    },
    {
      key: "completion",
      label: T.label.completion,
      weight: 10,
      value: completionRate ?? 0.5,
      count: finished.length,
      scale: "rate",
      detail: completionRate === null ? T.completionNone : T.completion(completionRate, finished.length),
    },
    {
      key: "capacity",
      label: T.label.capacity,
      weight: 10,
      value: Math.min(1, site.beds / 800),
      count: site.beds,
      ref: 800,
      scale: "linear",
      detail: T.beds(site.beds),
    },
  ];
  if (c.population === "pediatric") {
    components.push({
      key: "pediatric",
      label: T.label.pediatric,
      weight: 15,
      value: logScale(pediatric.length, refs.pediatric),
      count: pediatric.length,
      ref: refs.pediatric,
      scale: "log",
      detail: T.pediatric(pediatric.length, scope),
    });
  }

  const totalWeight = components.reduce((s, x) => s + x.weight, 0);
  let score = (components.reduce((s, x) => s + x.weight * x.value, 0) / totalWeight) * 100;

  const flags: SiteResult["flags"] = [];
  const penalties = { competing: 0, equipment: 0 };
  if (competing.length > 0) {
    // penalise the share of this indication's trials that are recruiting now, not the raw count (big centres run more)
    const share = competing.length / Math.max(indication.length, 1);
    penalties.competing = 10 * Math.min(1, share / 0.5);
    score -= penalties.competing;
    flags.push({
      level: "warn",
      key: "competing",
      text: T.flagCompeting(competing.length),
    });
  }
  const missingEquipment = c.equipment.filter((k) => !(site.equipment[k] && site.equipment[k]! > 0)).map((k) => equipName(k, lang));
  if (missingEquipment.length > 0 && !c.equipmentStrict) {
    // soft requirement: the catalogue lists major equipment only and sites may use a partner's - ask, don't drop
    penalties.equipment = Math.min(EQUIPMENT_PENALTY.max, EQUIPMENT_PENALTY.perItem * missingEquipment.length);
    score -= penalties.equipment;
    flags.push({
      level: "warn",
      key: "equipment",
      text: T.flagEquipment(missingEquipment),
    });
  }
  if (indication.length === 0) flags.push({ level: "info", key: "noIndication", text: T.flagNoIndication });
  if (c.population === "pediatric" && pediatric.length === 0 && site.hospitalClass !== "Hospitales especializados")
    flags.push({ level: "warn", key: "noPediatric", text: T.flagNoPediatric });
  if (!site.researchUnit) flags.push({ level: "info", key: "noResearchUnit", text: T.flagNoResearchUnit });

  return {
    site: {
      id: site.id,
      name: site.name,
      municipality: site.municipality,
      beds: site.beds,
      ownership: site.ownership,
      hospitalClass: site.hospitalClass,
      researchUnit: site.researchUnit,
    },
    score: Math.max(0, Math.round(score)),
    components,
    flags,
    stats: {
      indicationTrials: indication.length,
      phaseTrials: phase.length,
      areaTrials: area.length,
      recentTrials: recent.length,
      competingTrials: competing.length,
      pediatricTrials: pediatric.length,
      completionRate,
    },
    missingEquipment,
    penalties,
    basis: { experience: basis, areaChosen: !!c.area, recentSince: RECENT_SINCE },
  };
}

export type ExclusionReason = "missingEquipment" | "noTrialHistory" | "ownership";

/** A hospital with no registered trials: shown after the ranked list, without a score. */
export interface UnscoredSite {
  site: SiteResult["site"];
  /** Required equipment the national catalogue lists / does not list for this hospital. */
  matchedEquipment: string[];
  missingEquipment: string[];
}

export interface SearchResponse {
  results: SiteResult[];
  /** Hospitals with no registered trials that pass the filters (shown below the ranking). Optional for older callers. */
  unscored?: UnscoredSite[];
  excluded: { missingEquipment: number; noTrialHistory: number; ownership: number };
  /** Which hospitals were left out and why (for greying them out on the map). Optional for older callers. */
  excludedSites?: { id: string; reason: ExclusionReason; missing?: string[] }[];
  totalSites: number;
  /** Madrid hospitals with trial history, i.e. the ones every component rank is out of. Optional for older callers. */
  rankedAmong?: number;
}

/** Scores every Madrid hospital that has registered trials (before any filter) and ranks each component. */
export function scoreAll(c: TrialCriteria, matches = indicationMatcher(c.indication), lang: Lang = "en"): { all: SiteResult[]; refs: Refs } {
  const { sites, trialsBySite } = dataset();
  const refs = computeRefs(c, matches);
  const all: SiteResult[] = [];
  for (const site of sites) {
    const trials = trialsBySite.get(site.id);
    if (trials?.length) all.push(scoreSite(site, trials, c, matches, refs, lang));
  }
  const keys = all[0]?.components.map((x) => x.key) ?? [];
  for (const key of keys) {
    const vals = all.map((r) => r.components.find((x) => x.key === key)?.value ?? 0);
    const top = Math.max(0, ...all.map((r) => r.components.find((x) => x.key === key)?.count ?? 0));
    for (const r of all) {
      const comp = r.components.find((x) => x.key === key);
      if (comp && comp.scale === "log") comp.top = top;
    }
    all.forEach((r, i) => {
      r.ranks ??= {};
      r.ranks[key] = 1 + vals.filter((v) => v > vals[i] + 1e-9).length;
    });
  }
  return { all, refs };
}

/** Per-component Madrid comparison for a site page: median and top (value 0..1 and raw count) among hospitals with
 *  trial history for this search. */
export function componentStats(c: TrialCriteria): { of: number; byKey: Record<string, { medianValue: number; topValue: number; medianCount: number; topCount: number }> } {
  const { all } = scoreAll(c);
  const byKey: Record<string, { medianValue: number; topValue: number; medianCount: number; topCount: number }> = {};
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    if (!s.length) return 0;
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  for (const key of all[0]?.components.map((x) => x.key) ?? []) {
    const comps = all.map((r) => r.components.find((x) => x.key === key)!).filter(Boolean);
    const counts = key === "completion" ? all.map((r) => (r.stats.completionRate ?? NaN) * 100).filter(Number.isFinite) : comps.map((x) => x.count ?? 0);
    byKey[key] = {
      medianValue: median(comps.map((x) => x.value)),
      topValue: Math.max(0, ...comps.map((x) => x.value)),
      medianCount: median(counts),
      topCount: Math.max(0, ...counts),
    };
  }
  return { of: all.length, byKey };
}

/** `lang`: language of the generated text in the results (see scoreSite); the ranking is the same in every language. */
export function searchSites(c: TrialCriteria, lang: Lang = "en"): SearchResponse {
  const { sites, trialsBySite } = dataset();
  const matches = indicationMatcher(c.indication);
  const { all } = scoreAll(c, matches, lang);
  const scored = new Map(all.map((r) => [r.site.id, r]));
  const excluded = { missingEquipment: 0, noTrialHistory: 0, ownership: 0 };
  const excludedSites: NonNullable<SearchResponse["excludedSites"]> = [];
  const results: SiteResult[] = [];
  const unscored: UnscoredSite[] = [];
  for (const site of sites) {
    if (c.ownership !== "any" && site.ownership !== c.ownership) {
      excluded.ownership++;
      excludedSites.push({ id: site.id, reason: "ownership" });
      continue;
    }
    const trials = trialsBySite.get(site.id) ?? [];
    if (trials.length === 0) {
      const has = (k: string) => !!site.equipment[k] && site.equipment[k]! > 0;
      const missing = c.equipment.filter((k) => !has(k)).map((k) => equipName(k, lang));
      if (c.equipmentStrict && missing.length > 0) {
        excluded.missingEquipment++;
        excludedSites.push({ id: site.id, reason: "missingEquipment", missing });
        continue;
      }
      excluded.noTrialHistory++;
      excludedSites.push({ id: site.id, reason: "noTrialHistory" });
      unscored.push({
        site: {
          id: site.id,
          name: site.name,
          municipality: site.municipality,
          beds: site.beds,
          ownership: site.ownership,
          hospitalClass: site.hospitalClass,
          researchUnit: site.researchUnit,
        },
        matchedEquipment: c.equipment.filter(has).map((k) => equipName(k, lang)),
        missingEquipment: missing,
      });
      continue;
    }
    const r = scored.get(site.id)!;
    if (c.equipmentStrict && r.missingEquipment.length > 0) {
      excluded.missingEquipment++;
      excludedSites.push({ id: site.id, reason: "missingEquipment", missing: r.missingEquipment });
      continue;
    }
    results.push(r);
  }
  results.sort((a, b) => b.score - a.score || b.stats.indicationTrials - a.stats.indicationTrials);
  unscored.sort((a, b) => a.missingEquipment.length - b.missingEquipment.length || b.site.beds - a.site.beds);
  return { results, unscored, excluded, excludedSites, totalSites: sites.length, rankedAmong: all.length };
}

/** For a site page: where this hospital stands among Madrid hospitals with trial history, per score component
 *  ("top N of M" = 1 + hospitals with a strictly higher component value). */
export function componentRanks(siteId: string, c: TrialCriteria): { of: number; rank: Record<string, number> } {
  const { all } = scoreAll(c);
  return { of: all.length, rank: all.find((r) => r.site.id === siteId)?.ranks ?? {} };
}

/** The trials behind each count on a hospital's score (for source popovers: registry record links). */
export type TrialSetKind = "indication" | "phase" | "area" | "recent" | "competing" | "pediatric" | "finished" | "all" | "recruiting" | "industry";
export interface TrialRef {
  id: string;
  title: string;
  status: string;
  startYear: number | null;
  registryIds: string[];
}
export function trialSet(siteId: string, c: TrialCriteria | null, kind: TrialSetKind): Trial[] {
  const { siteById, trialsBySite } = dataset();
  const site = siteById.get(siteId);
  const trials = trialsBySite.get(siteId) ?? [];
  if (kind === "recruiting") return trials.filter((t) => t.status === "RECRUITING");
  if (kind === "industry") return trials.filter((t) => t.sponsorClass === "INDUSTRY");
  if (!site || kind === "all" || !c) return trials;
  const sets = siteCounts(site, trials, c, indicationMatcher(c.indication));
  return sets[kind];
}
export function toTrialRefs(trials: Trial[], limit = 10): { total: number; items: TrialRef[] } {
  const sorted = [...trials].sort((a, b) => (b.startYear ?? 0) - (a.startYear ?? 0));
  return {
    total: trials.length,
    items: sorted.slice(0, limit).map((t) => ({ id: t.id, title: t.title, status: t.status, startYear: t.startYear, registryIds: t.registryIds })),
  };
}

export function scoreOne(siteId: string, c: TrialCriteria, lang: Lang = "en"): SiteResult | null {
  const { siteById, trialsBySite } = dataset();
  const site = siteById.get(siteId);
  if (!site) return null;
  const matches = indicationMatcher(c.indication);
  return scoreSite(site, trialsBySite.get(siteId) ?? [], c, matches, computeRefs(c, matches), lang);
}
