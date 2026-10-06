export type Phase = "PHASE1" | "PHASE2" | "PHASE3" | "PHASE4";
/** What a sponsor can choose: a single phase or a combined design. Trials in the registries carry single phases. */
export type PhaseOption = Phase | "PHASE1_2" | "PHASE2_3";

/** The registry phases a phase option covers: "PHASE2_3" → ["PHASE2", "PHASE3"]. */
export function phasesOf(p: PhaseOption): Phase[] {
  if (p === "PHASE1_2") return ["PHASE1", "PHASE2"];
  if (p === "PHASE2_3") return ["PHASE2", "PHASE3"];
  return [p];
}
export type Population = "adult" | "pediatric" | "all";
export type Ownership = "any" | "public" | "private";

/** Blinded trial criteria - the only trial information ever shown to sites. */
export interface TrialCriteria {
  indication: string; // free text, comma-separated synonyms allowed
  area: string; // therapeutic area key, "" = any
  phase: PhaseOption;
  population: Population;
  /** Recruitment target per hospital and recruitment period. Optional: undefined = not set by the sponsor (they never
   *  affect the ranking; they feed the trial summary, the commitment question and the response match). */
  targetPatientsPerSite?: number;
  recruitmentMonths?: number;
  equipment: string[]; // required equipment keys
  /** false (default) = hospitals without the equipment in the national catalogue stay ranked, flagged and asked;
   *  true = only hospitals whose catalogue lists it are ranked. */
  equipmentStrict?: boolean;
  ownership: Ownership;
  /** Recruitment-limiting eligibility criteria (protocol upload or typed by the sponsor), each asked to sites as its own
   *  "how many patients per month meet this?" question. Typed criteria have es === en until a translation exists. */
  keyCriteria?: { en: string; es: string }[];
  /** Site requirements without public data (e.g. "apheresis unit"). Not used for ranking; each becomes a yes/no question. */
  otherRequirements?: { en: string; es: string }[];
  /** Free-text refinements when the fixed lists don't fit. Not used for ranking; shown to sites and asked about. */
  areaOther?: string; // e.g. "Rare paediatric neuromuscular diseases"
  populationOther?: string; // e.g. "Adolescents 12–17"
}

export const DEFAULT_CRITERIA: TrialCriteria = {
  indication: "",
  area: "",
  phase: "PHASE3",
  population: "adult",
  equipment: [],
  ownership: "any",
};

/** Never shared with sites. Used to block accidental leaks in outgoing questionnaires. */
export interface ConfidentialInfo {
  drugName?: string;
  sponsorName?: string;
  protocolCode?: string;
  /** Anything else the sponsor wants kept out of messages to hospitals (codenames, mechanism, partners…). */
  otherTerms?: string[];
}

/** Hospital photo from Wikimedia Commons (free licence; attribution must be shown wherever the image is shown). */
export interface SiteImage {
  url: string; // full-size (≤1600px) URL
  thumbUrl: string; // 640px requested; Commons serves its next standard step (currently 960px)
  /** Plain text, as required for attribution. The only personal name in the data: a documented exception (README). */
  author: string;
  license: string; // e.g. "CC BY-SA 4.0"
  licenseUrl: string | null;
  sourcePage: string; // Commons file page
}

/** SERMAS annual activity open data (public network hospitals only). */
export interface SiteActivity {
  year: number;
  source: string; // plain URL of the dataset (the hospital's SERMAS open-data ZIP)
  /** The SERMAS report the figures come from (for a hospital complex, the main hospital's report). */
  reportName?: string;
  /** Optional prose about the source; never a URL. */
  note?: string;
  /** Outpatient first visits per specialty, keyed by the SERMAS specialty name (Spanish). */
  firstVisitsBySpecialty: Record<string, number>;
  /** Total outpatient visits per specialty, when published. */
  totalVisitsBySpecialty?: Record<string, number>;
  /** Hospital discharges (altas) in the year, when published. */
  discharges?: number | null;
  /** Industry-funded research projects / clinical studies reported for the year, when published. */
  industryStudies?: { new: number | null; active: number | null } | null;
}

/** The hospital's accredited research ethics committee (CEIm), from the AEMPS directory. Committee-level data only. */
export interface SiteCeim {
  name: string;
  ownCommittee: boolean; // false = served by the CEIm Regional / another hospital's committee
  ctisEvaluator: boolean; // listed by AEMPS with CTIS evaluation slots
  fastTrack: boolean;
  /** Latest AEMPS slot availability snapshot, when listed: used / capacity for the current month. */
  slots?: { month: string; used: number; capacity: number; checkedOn: string } | null;
  /** CTIS slots full this month although AEMPS publishes no capacity ("100%"); null when not a CTIS evaluator. */
  slotsFull?: boolean | null;
  email: string | null; // committee mailbox only (never a named person); always null when basis is "default"
  /** How the committee was assigned. "own" / "complex" come from the AEMPS directory (facts with a source).
   *  "default" is INFERRED (no committee of its own in the directory → the CEIm Regional): show it as not confirmed. */
  basis?: "own" | "complex" | "default";
  source: string; // plain URL of the AEMPS directory; "" when basis is "default" (no source states it)
  /** Prose about the source / how it was assigned (e.g. "AEMPS directory…, checked 2026-10-03"). Never a URL. */
  note?: string;
}

export interface Site {
  id: string;
  name: string; // display name (accents, proper name)
  /** The Catálogo Nacional de Hospitales spelling, kept for matching and audit. */
  catalogueName?: string;
  municipality: string;
  address: string;
  postcode: string;
  phone: string | null;
  beds: number;
  hospitalClass: string;
  ownership: "public" | "private";
  funding: string;
  complex: string | null;
  equipment: Record<string, number | null>;
  researchUnit: {
    institute: string;
    accreditedIIS: boolean;
    feasibilityEmail: string | null;
    source: string | null;
    verifiedOn: string | null;
  } | null;
  trialCount: number;
  /** Map position (WGS84). */
  geo: { lat: number; lon: number; source: string } | null;
  image: SiteImage | null;
  activity: SiteActivity | null;
  ceim: SiteCeim | null;
}

export interface Trial {
  id: string;
  title: string;
  status: string;
  whyStopped: string | null;
  phases: string[];
  startYear: number | null;
  completionYear: number | null;
  enrollment: number | null;
  sponsor: string | null;
  sponsorClass: string | null;
  conditions: string[];
  mesh: string[];
  meshAncestors: string[];
  areas: string[];
  ages: string[];
  sites: { siteId: string; status: string | null }[];
  sources: ("ctgov" | "reec")[];
  registryIds: string[]; // NCT id and/or EudraCT / EU CT numbers
}

/** Public registry page for a trial id (NCT → ClinicalTrials.gov, EudraCT / EU CT → REec). */
export function registryUrl(id: string): string {
  return id.startsWith("NCT")
    ? `https://clinicaltrials.gov/study/${id}`
    : `https://reec.aemps.es/reec/estudio/${id}`;
}

export const AREAS: Record<string, string> = {
  oncology: "Oncology",
  hematology: "Haematology",
  cardiovascular: "Cardiovascular",
  neurology: "Neurology",
  psychiatry: "Psychiatry",
  infectious: "Infectious diseases",
  respiratory: "Respiratory",
  gastro_hepatology: "Gastroenterology & hepatology",
  endocrine_metabolic: "Endocrinology & metabolism",
  immunology_rheumatology: "Immunology & rheumatology",
  dermatology: "Dermatology",
  nephrology_urology: "Nephrology & urology",
  womens_health: "Women's health",
  ophthalmology: "Ophthalmology",
  rare_genetic: "Rare & genetic diseases",
};

export const EQUIPMENT: Record<string, string> = {
  ct: "CT scanner",
  mri: "MRI",
  pet: "PET",
  spect: "SPECT",
  gamma_camera: "Gamma camera",
  cath_lab: "Cath lab / haemodynamics",
  angiography: "Digital angiography",
  linac: "Linear accelerator (radiotherapy)",
  mammography: "Mammography",
  densitometry: "Bone densitometry",
  dialysis: "Dialysis",
  lithotripsy: "Lithotripsy",
};

export const PHASES: Record<PhaseOption, string> = {
  PHASE1: "Phase I",
  PHASE1_2: "Phase I/II",
  PHASE2: "Phase II",
  PHASE2_3: "Phase II/III",
  PHASE3: "Phase III",
  PHASE4: "Phase IV",
};

export const PHASES_ES: Record<PhaseOption, string> = {
  PHASE1: "Fase I",
  PHASE1_2: "Fase I/II",
  PHASE2: "Fase II",
  PHASE2_3: "Fase II/III",
  PHASE3: "Fase III",
  PHASE4: "Fase IV",
};

export const POPULATIONS: Record<Population, string> = {
  adult: "Adults",
  pediatric: "Paediatric",
  all: "All ages",
};
