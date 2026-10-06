// Patient portal data types. Shapes mirror web/data/patient_trials.json (pipeline/patient_trials.py).
// Client-safe: no server imports. Every trial-specific text is verbatim registry text with its source attached.

export type Lang = "es" | "en";
export type Registry = "reec" | "ctgov";
export type LinkRegistry = Registry | "ctis" | "euctr";

/** Where one text came from: registry, record id and the registry's own field name (e.g. "tituloPublico"). */
export interface TextSource {
  registry: Registry;
  id: string;
  field: string;
}

/** Verbatim registry text in up to two languages; `source` says where each language came from.
 *  A language is missing when no registry publishes it (e.g. most CTIS-era REec records are English-only). */
export interface RegistryText {
  es?: string;
  en?: string;
  source: { es?: TextSource; en?: TextSource };
}

export interface RegistryLink {
  id: string;
  /** reec = REec (AEMPS); ctgov = ClinicalTrials.gov; ctis = EU CTIS search; euctr = EU Clinical Trials Register search */
  registry: LinkRegistry;
  url: string;
}

export type TrialStatus = "RECRUITING" | "NOT_YET_RECRUITING";
/** Per-hospital status. "closed" sites are removed by the pipeline. */
export type SiteStatus = "recruiting" | "not_yet" | "unknown";
/** Registry age groups (ClinicalTrials.gov stdAges; REec population flags mapped the same way). */
export type RegistryAge = "CHILD" | "ADULT" | "OLDER_ADULT";

export interface PatientTrialSite {
  siteId: string; // = Site.id in web/data/sites.json (CNH code)
  status: SiteStatus;
}

export interface PatientTrial {
  id: string; // same id as web/data/trials.json (NCT id, else EudraCT / EU CT number)
  registryIds: string[];
  registryLinks: RegistryLink[];
  primaryReecId: string | null;
  nctId: string | null;
  title: RegistryText;
  publicIndication: RegistryText;
  /** ClinicalTrials.gov brief summary (English only). Absent for REec-only trials. */
  summary: { en?: string; source: TextSource | null };
  eligibility: {
    /** Lists keep their line breaks ("\n"); render with white-space: pre-line. */
    inclusion: RegistryText;
    exclusion: RegistryText;
    /** false = ClinicalTrials.gov criteria had no "Exclusion criteria" heading, so the whole block is in inclusion.en. */
    criteriaSplit: boolean;
    minAge: string | null; // verbatim, e.g. "18 Years"
    maxAge: string | null;
    minAgeYears: number | null;
    maxAgeYears: number | null;
    sex: "ALL" | "FEMALE" | "MALE" | null;
    healthyVolunteers: boolean | null;
    source: TextSource | null;
  };
  ages: RegistryAge[];
  conditions: string[];
  mesh: string[];
  meshAncestors: string[];
  areas: string[]; // keys of AREA_LABELS
  phases: string[]; // PHASE1..4, EARLY_PHASE1, NA (see PHASE_INFO)
  status: TrialStatus;
  statusSource: Registry;
  sites: PatientTrialSite[];
  sponsor: string | null; // "Investigator-initiated" when the registry names a person
  sponsorClass: string | null; // INDUSTRY | OTHER | NETWORK | OTHER_GOV | …
  rareDisease: boolean | null; // REec flag; null when only ClinicalTrials.gov has the trial
  /** Latest registry update date (ISO yyyy-mm-dd). See lastUpdatedBasis. */
  lastUpdated: string | null;
  /** ctgov_last_update_posted = ClinicalTrials.gov "Last Update Posted";
   *  reec_last_modified = REec's own "Última actualización" (shown on the REec record page);
   *  reec_latest_calendar_date = fallback when REec's update date could not be read: its latest dated event
   *  (registration, authorisation, start, restart) - a lower bound. */
  lastUpdatedBasis: "ctgov_last_update_posted" | "reec_last_modified" | "reec_latest_calendar_date" | null;
  lastUpdatedBySource: Partial<Record<Registry, string>>;
  /** What lastUpdatedBySource.reec is: REec's "Última actualización", or the calendar-date fallback. */
  reecUpdatedKind?: "last_modified" | "calendar" | null;
  /** Registry not updated for more than staleAfterDays (recomputed at load time against today's date). */
  stale: boolean;
  /** When Solera downloaded each registry's record (ISO timestamp). */
  fetchedAt: Partial<Record<Registry, string>>;
}

export interface PatientDataFile {
  builtAt: string;
  staleAfterDays: number;
  sources: Record<Registry, { name: string; url: string; fetchedAt: string | null }>;
  trials: PatientTrial[];
}

/** Hospital fields the portal shows (subset of Site, joined at load). */
export interface PatientHospital {
  id: string;
  name: string;
  municipality: string;
  address: string;
  ownership: "public" | "private";
  geo: { lat: number; lon: number } | null;
  image: { url: string; thumbUrl: string; author: string; license: string; licenseUrl: string | null; sourcePage: string } | null;
}

export interface PatientTrialSiteView extends PatientTrialSite {
  hospital: PatientHospital;
}

/** A trial with its hospitals resolved (what cards and detail pages receive). */
export interface PatientTrialView extends Omit<PatientTrial, "sites"> {
  sites: PatientTrialSiteView[];
}

export type AgeGroup = "child" | "adult" | "older";
/** No quality ranking: newest registry update first (default), A–Z by title, or most Madrid hospitals. */
export type PatientSort = "updated" | "alpha" | "hospitals";

export interface PatientQuery {
  /** Free text: condition or keyword, Spanish or English, accent-insensitive. Commas = OR. */
  q?: string;
  age?: AgeGroup;
  area?: string; // AREA_LABELS key
  hospital?: string; // Site id
  /** Hospital-level when `hospital` is set, else: at least one Madrid hospital with this status. */
  status?: "recruiting" | "not_yet";
  /** Include records flagged as possibly outdated (default false). */
  includeStale?: boolean;
  /** Only studies that accept healthy volunteers. */
  healthyVolunteers?: boolean;
  sort?: PatientSort;
  /** Language used for alphabetical sort. */
  lang?: Lang;
  page?: number; // 1-based
  pageSize?: number; // default 24, max 100
}

/** One map marker: open trials matching the current filters at this hospital. */
export interface HospitalAggregate {
  hospital: PatientHospital;
  total: number;
  recruiting: number;
  notYet: number;
  unknown: number;
}

export interface PatientSearchResult {
  query: Required<Pick<PatientQuery, "sort" | "includeStale" | "page" | "pageSize">> & PatientQuery;
  /** Set when the typed words found nothing and the results are for this shorter search instead. */
  relaxedQ?: string;
  total: number;
  /** Trials hidden only because they are flagged as possibly outdated (to offer "include them"). */
  hiddenStale: number;
  items: PatientTrialView[];
  hospitals: HospitalAggregate[];
}
