import "server-only";
import { normalise } from "../search";
import { replacePart, suggestTerms } from "../spelling";
import { conditionVocabulary } from "../vocabulary";
import { patientDataset } from "./data";
import { AREA_LABELS } from "./labels";
import type {
  AgeGroup,
  HospitalAggregate,
  PatientQuery,
  PatientSearchResult,
  PatientSort,
  PatientTrialView,
  RegistryAge,
} from "./types";

// Patient search: filters only, never a quality ranking. Sorts are neutral (registry update date, title, number of
// Madrid hospitals). Search terms are not logged or stored anywhere.

const AGE_MAP: Record<AgeGroup, RegistryAge> = { child: "CHILD", adult: "ADULT", older: "OLDER_ADULT" };
const SORTS: readonly PatientSort[] = ["updated", "alpha", "hospitals"];
const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;
const MAX_Q = 120;

// ---------- free-text matching (Spanish + English, accent-insensitive, MeSH ancestors) ----------

const STOP = new Set([
  "de", "del", "la", "las", "el", "los", "y", "e", "o", "u", "en", "con", "para", "por", "a", "al", "un", "una",
  "of", "the", "and", "or", "in", "with", "for", "to", "an", "on",
  "enfermedad", "enfermedades", "disease", "diseases", "paciente", "pacientes", "patient", "patients", "ensayo",
  "ensayos", "estudio", "estudios", "trial", "trials", "study", "studies", "tratamiento", "treatment",
]);

const CANCER = ["cancer", "neoplas", "carcinom", "tumor", "malign", "oncolog", "sarcom", "lymphom", "linfom", "leukem", "leucem", "melanom", "myelom", "mielom", "glioma", "blastom"];
/** Only these generic words widen to every cancer type ("leucemia" must not match all cancers). */
const GENERIC_CANCER = ["cancer", "neoplas", "tumor", "oncolog", "malign"];
/** MeSH ancestors this broad would make unrelated trials match (e.g. "Cardiovascular Diseases" above a lymphoma). */
const BROAD_ANCESTOR = /^(.*Diseases|.*Disorders|Neoplasms by .*|Pathologic.*|Pathological .*|Signs and Symptoms.*|Syndrome|Disease|Chronic Disease|Recurrence|Infections|Communicable Diseases)$/;

// Spanish (normalised, no accents) → English stems found in ClinicalTrials.gov conditions / MeSH, plus common
// abbreviations. Only used to widen matching; all text shown remains registry text.
const SYNONYMS: Record<string, string[]> = {
  cancer: CANCER, tumor: CANCER, tumores: CANCER, neoplasia: CANCER, oncologia: CANCER, oncologico: CANCER,
  mama: ["breast", "mama"], pecho: ["breast"], pulmon: ["lung", "pulmon", "pulmonar"], pulmonar: ["lung", "pulmonar", "pulmonary"],
  colon: ["colon", "colorectal"], colorrectal: ["colorectal"], recto: ["rect"], estomago: ["stomach", "gastric", "gastr"],
  gastrico: ["gastric", "gastr"], higado: ["liver", "hepat", "higado"], hepatico: ["hepat", "liver"], pancreas: ["pancrea"],
  prostata: ["prostat"], vejiga: ["bladder", "urothelial", "vejiga"], rinon: ["kidney", "renal", "rinon"], renal: ["renal", "kidney"],
  ovario: ["ovar"], utero: ["uter", "endometri"], endometrio: ["endometri"], cervix: ["cervi"], cuello: ["cervi", "neck", "cuello"],
  cabeza: ["head", "cabeza"], piel: ["skin", "cutaneous", "piel", "melanom", "dermat"], cerebro: ["brain", "cerebr", "glioma"],
  cerebral: ["brain", "cerebr"], sangre: ["blood", "hemat", "sangre"], leucemia: ["leukem", "leucem"], linfoma: ["lymphom", "linfom"],
  mieloma: ["myelom", "mielom"], hueso: ["bone", "oste", "hueso"], huesos: ["bone", "oste"], tiroides: ["thyroid", "tiroid"],
  esofago: ["esophag", "esofag"], ojo: ["eye", "ocular", "retin", "ojo"], ojos: ["eye", "ocular", "retin"],
  corazon: ["heart", "cardiac", "cardiomyopath", "myocard", "coronar", "corazon", "cardiaca", "cardiaco"],
  cardiaco: ["cardiac", "heart", "cardiaco", "cardiaca"], cardiaca: ["cardiac", "heart", "cardiaco", "cardiaca"], insuficiencia: ["failure", "insuficiencia"],
  infarto: ["infarct", "infarto"], ictus: ["stroke", "ictus"], hipertension: ["hypertens", "hipertens"],
  diabetes: ["diabet"], obesidad: ["obes"], colesterol: ["cholesterol", "hypercholesterol", "lipid", "colesterol"],
  asma: ["asthma", "asma"], epoc: ["chronic obstructive pulmonary", "copd", "epoc"], fibrosis: ["fibros"],
  alzheimer: ["alzheimer"], parkinson: ["parkinson"], esclerosis: ["sclerosis", "esclerosis"], epilepsia: ["epilep"],
  migrana: ["migraine", "migran"], depresion: ["depress"], ansiedad: ["anxiety", "ansiedad"], esquizofrenia: ["schizophren", "esquizofren"],
  autismo: ["autis"], dolor: ["pain", "dolor"], artritis: ["arthritis", "artritis"], reumatoide: ["rheumatoid", "reumatoide"],
  lupus: ["lupus"], psoriasis: ["psoria"], dermatitis: ["dermatitis"], atopica: ["atopic", "atopica"], crohn: ["crohn"],
  colitis: ["colitis"], ulcerosa: ["ulcerative", "ulcerosa"], hepatitis: ["hepatitis"], vih: ["hiv", "vih"], sida: ["hiv", "aids"],
  covid: ["covid", "sars cov"], gripe: ["influenza", "gripe"], vacuna: ["vaccin", "vacuna"], vacunas: ["vaccin", "vacuna"],
  infeccion: ["infect", "infeccion"], tuberculosis: ["tubercul"], embarazo: ["pregnan", "embaraz"], fertilidad: ["fertil", "infertil"],
  menopausia: ["menopaus"], osteoporosis: ["osteoporo"], anemia: ["anemi"], hemofilia: ["hemophil", "hemofil"],
  rara: ["rare"], raras: ["rare"], genetica: ["genetic", "genetic"], nino: ["child", "pediatric", "paediatric"], ninos: ["child", "pediatric"],
  sano: ["healthy"], sanos: ["healthy"], voluntarios: ["volunteer", "voluntari"], trasplante: ["transplant", "trasplante"],
  dialisis: ["dialysis"], apnea: ["apnea", "apnoea"], sueno: ["sleep"], insomnio: ["insomnia"], obstructiva: ["obstructive"],
  // English → Spanish (for REec-only trials with Spanish text)
  breast: ["breast", "mama"], lung: ["lung", "pulmon"], heart: ["heart", "cardiac", "corazon", "cardiaca"], kidney: ["kidney", "renal", "rinon"],
  liver: ["liver", "hepat", "higado"], skin: ["skin", "piel", "cutane"], blood: ["blood", "sangre", "hemat"],
  stroke: ["stroke", "ictus"], depression: ["depress", "depresion"], pain: ["pain", "dolor"], pregnancy: ["pregnan", "embaraz"],
  // abbreviations
  nsclc: ["non small cell lung"], sclc: ["small cell lung"], crc: ["colorectal"], hcc: ["hepatocellular"], rcc: ["renal cell"],
  aml: ["acute myeloid leukemia", "leucemia mieloide aguda"], lma: ["acute myeloid leukemia", "leucemia mieloide aguda"],
  cll: ["chronic lymphocytic leukemia", "leucemia linfocitica cronica"], llc: ["chronic lymphocytic leukemia", "leucemia linfocitica cronica"],
  dlbcl: ["diffuse large b cell", "difuso de celulas b grandes"], ela: ["amyotrophic lateral sclerosis", "esclerosis lateral amiotrofica"],
  als: ["amyotrophic lateral sclerosis", "esclerosis lateral amiotrofica"], em: ["multiple sclerosis", "esclerosis multiple"],
  ms: ["multiple sclerosis", "esclerosis multiple"], copd: ["chronic obstructive pulmonary", "epoc"], ckd: ["chronic kidney", "renal cronica"],
  erc: ["chronic kidney", "renal cronica"], ra: ["rheumatoid arthritis", "artritis reumatoide"], ar: ["rheumatoid arthritis", "artritis reumatoide"],
  ibd: ["inflammatory bowel", "inflamatoria intestinal"], eii: ["inflammatory bowel", "inflamatoria intestinal"], hiv: ["hiv", "vih"],
  nash: ["steatohepatitis", "esteatohepatitis"], mash: ["steatohepatitis", "esteatohepatitis"], tdah: ["attention deficit", "hiperactividad"],
  adhd: ["attention deficit", "hiperactividad"], dm2: ["type 2 diabetes", "diabetes mellitus tipo 2"],
  // everyday Spanish phrasings and frequent misspellings
  amiotrofica: ["amyotroph", "amiotrof"], amiotrofico: ["amyotroph", "amiotrof"], seno: ["breast", "mama"], senos: ["breast", "mama"],
  infantil: ["child", "pediatric", "paediatric", "infantil", "juvenil", "nino"], infantiles: ["child", "pediatric", "paediatric", "infantil", "juvenil", "nino"],
  pediatrico: ["child", "pediatric", "paediatric", "pediatric", "infantil", "nino"], pediatrica: ["child", "pediatric", "paediatric", "infantil", "nino"],
  pediatricos: ["child", "pediatric", "paediatric", "infantil", "nino"], pediatricas: ["child", "pediatric", "paediatric", "infantil", "nino"],
  fibromialgia: ["fibromyalg", "fibromialg"], canser: CANCER, cancr: CANCER, diabetis: ["diabet"], diabete: ["diabet"],
  alzeimer: ["alzheimer"], alzhaimer: ["alzheimer"], parkinsons: ["parkinson"], leucemias: ["leukem", "leucem"], linfomas: ["lymphom", "linfom"],
  cardiopatia: ["heart", "cardiac", "cardiopat", "cardiomyopath"], arritmia: ["arrhythm", "arritm", "atrial fibrillation", "fibrilacion auricular"],
};

/** Everyday multi-word expressions rewritten before matching (normalised text). */
const PHRASES: [RegExp, string][] = [
  [/\bataques? (?:al|de) corazon\b/g, "infarto"],
  [/\bataques? cardiacos?\b/g, "infarto"],
  [/\bataques? cerebral(?:es)?\b/g, "ictus"],
  [/\bderrames? cerebral(?:es)?\b/g, "ictus"],
  [/\bheart attacks?\b/g, "infarto"],
];

function stem(t: string): string {
  if (t.length > 5 && t.endsWith("es")) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith("s")) return t.slice(0, -1);
  return t;
}

/** One alternative: a stem matched at a word start. `maxExtra` limits how many more letters may follow it (so "fumar"
 *  does not match "Fumarate"); undefined = any (designed stems such as "leukem" or "cardiomyopath"). */
export interface Alt {
  s: string;
  maxExtra?: number;
}
type Group = Alt[];

function compileToken(t: string): Group | null {
  if (!t || STOP.has(t)) return null;
  const syn = SYNONYMS[t] ?? SYNONYMS[stem(t)];
  const alts = new Map<string, Alt>();
  // short tokens (abbreviations like "ELA", "EM") match whole words only: "ela" must not hit "elafibranor"
  if (t.length <= 3) alts.set(t, { s: t, maxExtra: 0 });
  // a word with no synonym entry: whole word or a short ending (plural, -ic…), never a long prefix
  else alts.set(stem(t), { s: stem(t), maxExtra: syn ? undefined : 2 });
  for (const x of syn ?? []) {
    const n = normalise(x);
    if (!alts.has(n)) alts.set(n, { s: n });
  }
  if (GENERIC_CANCER.some((c) => t.startsWith(c))) CANCER.forEach((c) => alts.has(c) || alts.set(c, { s: c }));
  return [...alts.values()];
}

function rewritePhrases(normalised: string): string {
  let p = normalised;
  for (const [rx, to] of PHRASES) p = p.replace(rx, to);
  return p;
}

/** Query → OR of phrases; each phrase is an AND of token groups; a group matches if any alternative is found at a word
 *  start in the trial's text. */
export function compileQuery(q: string): Group[][] {
  return q
    .slice(0, MAX_Q)
    .split(/[,;]/)
    .map((p) => rewritePhrases(normalise(p)))
    .filter(Boolean)
    .map((phrase) => phrase.split(" ").map(compileToken).filter((g): g is Group => g !== null))
    .filter((groups) => groups.length > 0);
}

const textCache = new WeakMap<PatientTrialView, string>();

/** Everything a patient might search by: titles and public indication in both languages, conditions, MeSH terms and
 *  specific MeSH ancestors (so "leucemia" also finds a trial coded only as "Leukemia, Myeloid, Acute"). Broad ancestor
 *  categories and area labels are left out so a search for one organ does not match every trial in its area. */
function haystack(t: PatientTrialView): string {
  let s = textCache.get(t);
  if (s === undefined) {
    const parts = [
      t.title.es, t.title.en, t.publicIndication.es, t.publicIndication.en,
      ...t.conditions, ...t.mesh, ...t.meshAncestors.filter((a) => !BROAD_ANCESTOR.test(a)),
      ...t.registryIds,
    ];
    s = " " + normalise(parts.filter(Boolean).join(" | ")) + " ";
    textCache.set(t, s);
  }
  return s;
}

function hasAlt(text: string, a: Alt): boolean {
  const needle = " " + a.s;
  let i = text.indexOf(needle);
  if (a.maxExtra === undefined) return i >= 0;
  while (i >= 0) {
    let j = i + needle.length;
    let extra = 0;
    while (j < text.length && /[a-z0-9]/.test(text[j])) {
      extra++;
      j++;
    }
    if (extra <= a.maxExtra) return true;
    i = text.indexOf(needle, i + 1);
  }
  return false;
}

const groupHits = (text: string, g: Group) => g.some((a) => hasAlt(text, a));

export function textMatcher(q: string): (t: PatientTrialView) => boolean {
  return matcherFor(compileQuery(q));
}

function matcherFor(phrases: Group[][]): (t: PatientTrialView) => boolean {
  if (phrases.length === 0) return () => true;
  return (t) => {
    const text = haystack(t);
    return phrases.some((groups) => groups.every((g) => groupHits(text, g)));
  };
}

/** When a free-text search finds nothing, the same search without single letters and without the words that match no
 *  open trial at all (typos, words the registries do not use). Returns null when nothing can be dropped or nothing would remain. */
export function relaxQuery(q: string): string | null {
  const ds = patientDataset();
  const texts = ds.trials.map(haystack);
  let changed = false;
  const kept = q
    .slice(0, MAX_Q)
    .split(/[,;]/)
    .map((p) =>
      rewritePhrases(normalise(p))
        .split(" ")
        .filter((t) => {
          const g = compileToken(t);
          if (!g) return false;
          // single letters ("hepatitis b") are optional: dropped when the full search finds nothing
          const known = t.length > 1 && texts.some((x) => groupHits(x, g));
          if (!known) changed = true;
          return known;
        })
        .join(" "),
    )
    .filter(Boolean);
  if (!changed || kept.length === 0) return null;
  return kept.join(", ");
}

/** "¿Quisiste decir…?": for each comma-separated part of the query that finds no open trial on its own, close terms
 *  from our condition vocabulary that do (typos such as "alzimer"). Each suggestion is the full query with that part
 *  replaced. Same engine as the sponsor search (lib/spelling.ts). */
export function patientSuggestions(q: string, lang: PatientQuery["lang"] = "es"): { label: string; q: string }[] {
  const ds = patientDataset();
  const parts = q.slice(0, MAX_Q).split(/[,;]/).map((p) => p.trim()).filter(Boolean);
  const finds = (text: string) => {
    const m = textMatcher(text);
    return ds.trials.some(m);
  };
  const vocab = conditionVocabulary();
  const out: { label: string; q: string }[] = [];
  parts.forEach((part, i) => {
    if (finds(part)) return;
    const label = (e: { label: string; en?: string; es?: string }) => (lang === "en" ? e.en ?? e.label : e.es ?? e.label);
    for (const s of suggestTerms(vocab, part, { limit: 3, accept: (e) => finds(label(e)) })) {
      const l = label(s.entry);
      out.push({ label: l.charAt(0).toUpperCase() + l.slice(1), q: replacePart(q, i, l) });
    }
  });
  return out.slice(0, 4);
}

// ---------- query parsing ----------

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

function param(p: Params, key: string): string | undefined {
  if (p instanceof URLSearchParams) return p.get(key) ?? undefined;
  const v = p[key];
  return Array.isArray(v) ? v[0] : v;
}

const yes = (v: string | undefined) => v === "1" || v === "true" || v === "on";

/** Untrusted URL search params → a valid PatientQuery. Keys: q, age, area, hospital, status, stale, healthy, sort, page,
 *  size. Unknown values are dropped. (In a page, `await props.searchParams` first.) */
export function parsePatientQuery(p: Params, lang: PatientQuery["lang"] = "es"): PatientQuery {
  const ds = patientDataset();
  const q = (param(p, "q") ?? "").trim().slice(0, MAX_Q);
  const age = param(p, "age");
  const area = param(p, "area");
  const hospital = param(p, "hospital");
  const status = param(p, "status");
  const sort = param(p, "sort");
  const page = Number(param(p, "page"));
  const size = Number(param(p, "size"));
  return {
    q: q || undefined,
    age: age && age in AGE_MAP ? (age as AgeGroup) : undefined,
    area: area && Object.hasOwn(AREA_LABELS, area) ? area : undefined,
    hospital: hospital && ds.bySite.has(hospital) ? hospital : undefined,
    status: status === "recruiting" || status === "not_yet" ? status : undefined,
    includeStale: yes(param(p, "stale")),
    healthyVolunteers: yes(param(p, "healthy")),
    sort: SORTS.includes(sort as PatientSort) ? (sort as PatientSort) : "updated",
    lang,
    page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
    pageSize: Number.isFinite(size) && size >= 1 ? Math.min(MAX_PAGE_SIZE, Math.floor(size)) : DEFAULT_PAGE_SIZE,
  };
}

/** PatientQuery → URL search string (only non-default values), for links that keep the current filters. */
export function patientQueryString(q: PatientQuery, overrides: Partial<PatientQuery> = {}): string {
  const m = { ...q, ...overrides };
  const sp = new URLSearchParams();
  if (m.q) sp.set("q", m.q);
  if (m.age) sp.set("age", m.age);
  if (m.area) sp.set("area", m.area);
  if (m.hospital) sp.set("hospital", m.hospital);
  if (m.status) sp.set("status", m.status);
  if (m.includeStale) sp.set("stale", "1");
  if (m.healthyVolunteers) sp.set("healthy", "1");
  if (m.sort && m.sort !== "updated") sp.set("sort", m.sort);
  if (m.page && m.page > 1) sp.set("page", String(m.page));
  if (m.pageSize && m.pageSize !== DEFAULT_PAGE_SIZE) sp.set("size", String(m.pageSize));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ---------- filtering, sorting, aggregation ----------

/** All filters except stale and paging. With `hospital`, the status filter applies to that hospital's own status. */
function baseFilter(q: PatientQuery): (t: PatientTrialView) => boolean {
  const text = textMatcher(q.q ?? "");
  const age = q.age ? AGE_MAP[q.age] : null;
  return (t) => {
    if (age && !t.ages.includes(age)) return false;
    if (q.area && !t.areas.includes(q.area)) return false;
    if (q.healthyVolunteers && t.eligibility.healthyVolunteers !== true) return false;
    if (q.hospital) {
      const s = t.sites.find((x) => x.siteId === q.hospital);
      if (!s) return false;
      if (q.status && s.status !== q.status) return false;
    } else if (q.status && !t.sites.some((x) => x.status === q.status)) {
      return false;
    }
    return text(t);
  };
}

function titleFor(t: PatientTrialView, lang: "es" | "en"): string {
  return (lang === "es" ? t.title.es ?? t.title.en : t.title.en ?? t.title.es) ?? t.id;
}

export function sortPatientTrials(list: PatientTrialView[], sort: PatientSort, lang: "es" | "en" = "es"): PatientTrialView[] {
  const byUpdated = (a: PatientTrialView, b: PatientTrialView) =>
    (b.lastUpdated ?? "").localeCompare(a.lastUpdated ?? "") || a.id.localeCompare(b.id);
  const out = [...list];
  if (sort === "alpha") {
    const coll = new Intl.Collator(lang, { sensitivity: "base", numeric: true });
    out.sort((a, b) => coll.compare(titleFor(a, lang), titleFor(b, lang)) || a.id.localeCompare(b.id));
  } else if (sort === "hospitals") {
    out.sort((a, b) => b.sites.length - a.sites.length || byUpdated(a, b));
  } else {
    out.sort(byUpdated);
  }
  return out;
}

/** Open-trial counts per hospital for map markers (only hospitals with ≥1 trial in `trials`). With `onlySite`, counts
 *  that hospital only; with `status`, counts only hospitals where the trial has that status. Status counts use each
 *  hospital's own status. */
export function aggregateByHospital(
  trials: PatientTrialView[],
  onlySite?: string,
  status?: PatientQuery["status"],
): HospitalAggregate[] {
  const agg = new Map<string, HospitalAggregate>();
  for (const t of trials) {
    for (const s of t.sites) {
      if (onlySite && s.siteId !== onlySite) continue;
      if (status && s.status !== status) continue;
      let a = agg.get(s.siteId);
      if (!a) {
        a = { hospital: s.hospital, total: 0, recruiting: 0, notYet: 0, unknown: 0 };
        agg.set(s.siteId, a);
      }
      a.total++;
      if (s.status === "recruiting") a.recruiting++;
      else if (s.status === "not_yet") a.notYet++;
      else a.unknown++;
    }
  }
  return [...agg.values()].sort((a, b) => a.hospital.name.localeCompare(b.hospital.name, "es"));
}

export function searchPatientTrials(query: PatientQuery): PatientSearchResult {
  const ds = patientDataset();
  const sort = query.sort ?? "updated";
  const includeStale = query.includeStale ?? false;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  let matches = ds.trials.filter(baseFilter(query));
  let relaxedQ: string | undefined;
  if (matches.length === 0 && query.q) {
    // nothing for the words as typed: retry without the words that match no open trial (typos, unknown words)
    const r = relaxQuery(query.q);
    if (r) {
      const m = ds.trials.filter(baseFilter({ ...query, q: r }));
      if (m.length > 0) {
        matches = m;
        relaxedQ = r;
      }
    }
  }
  const visible = includeStale ? matches : matches.filter((t) => !t.stale);
  const sorted = sortPatientTrials(visible, sort, query.lang ?? "es");
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(Math.max(1, query.page ?? 1), pages);
  return {
    query: { ...query, sort, includeStale, page, pageSize },
    relaxedQ,
    total: sorted.length,
    hiddenStale: matches.length - visible.length,
    items: sorted.slice((page - 1) * pageSize, page * pageSize),
    // markers reflect every matching trial (all pages), and the status filter per hospital
    hospitals: aggregateByHospital(visible, query.hospital, query.status),
  };
}

/** Counts per hospital for the unfiltered portal (all open, non-stale trials) - e.g. the landing map. */
export function hospitalOpenCounts(includeStale = false): HospitalAggregate[] {
  const ds = patientDataset();
  return aggregateByHospital(includeStale ? ds.trials : ds.trials.filter((t) => !t.stale));
}

/** Areas and their counts for the area filter, in AREA_LABELS order. With a query, counts only trials matching every
 *  other filter (the area filter itself excluded), so the numbers match what choosing an area will show. Areas with no
 *  trial are left out unless currently selected. */
export function areaCounts(includeStale = false, query?: PatientQuery): { area: string; count: number }[] {
  const ds = patientDataset();
  const counts = new Map<string, number>();
  const keep = query ? baseFilter({ ...query, area: undefined }) : () => true;
  for (const t of ds.trials) {
    if (!includeStale && t.stale) continue;
    if (!keep(t)) continue;
    for (const a of t.areas) counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  return Object.keys(AREA_LABELS)
    .filter((a) => counts.has(a) || a === query?.area)
    .map((area) => ({ area, count: counts.get(area) ?? 0 }));
}
