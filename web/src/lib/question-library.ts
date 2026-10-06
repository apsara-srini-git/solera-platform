// Question library + pre-fill contracts for the questionnaire flywheel.
// Pure module (no server imports): used by server actions, the sponsor project page and the hospital form.
//
// Every question has a stable key and a reuse policy:
//   "site"       stable fact about the hospital (pharmacy, coordinators, start-up time…) - reused for any sponsor
//   "indication" reused only for the same normalised indication (and the same criterion text)
//   "trial"      never reused (interest, enrolment commitment, PI for this study, comments)
// Answers with policy site / indication that the hospital itself provides (a question without public data, or a public
// pre-fill it corrected) are stored in SiteAnswer with its consent, scoped to the recipient's institutional email
// domain, and pre-fill the next questionnaire sent to that hospital at the same domain, from any sponsor. Sponsors never
// see the stored values. Custom sponsor questions are private to their author; the built-in library is shared.

import type { Question, QuestionType } from "./questionnaire";
import { EQUIPMENT, type TrialCriteria } from "./types";

export type ReusePolicy = "site" | "indication" | "trial";

/** How long a hospital-confirmed answer is reused before the hospital is asked again. */
export const REUSE_DAYS = 365;

/** Consent notice shown to hospitals above the submit button (Spanish first). The Terms page needs a matching line. */
export const REUSE_CONSENT = {
  es: "Las respuestas sobre las capacidades del centro que usted escriba o corrija se guardarán para pre-rellenar futuras solicitudes enviadas a direcciones de su institución. Los promotores no ven las respuestas guardadas. Puede revisarlas y corregirlas en cualquier momento. Las respuestas específicas de este ensayo y los datos públicos sin cambios nunca se guardan.",
  en: "Answers about the site's capabilities that you type or correct will be saved to pre-fill future requests sent to your institution's addresses. Sponsors do not see saved answers. You can review and correct them at any time. Answers specific to this trial and unchanged public data are never saved.",
} as const;

/** Public webmail domains: never treated as a hospital's institutional identity (nothing is stored or reused). */
const WEBMAIL = new Set(
  ("gmail.com googlemail.com hotmail.com hotmail.es hotmail.co.uk outlook.com outlook.es live.com live.es msn.com " +
    "yahoo.com yahoo.es ymail.com rocketmail.com icloud.com me.com mac.com aol.com proton.me protonmail.com pm.me " +
    "gmx.com gmx.es gmx.net gmx.de mail.com zoho.com zohomail.com yandex.com yandex.ru tutanota.com tuta.io " +
    "fastmail.com hey.com terra.es telefonica.net movistar.es orange.es vodafone.es ono.com wanadoo.es mail.ru qq.com 163.com")
    .split(" "),
);

/**
 * The institutional domain of a recipient address ("ensayos@fibhgm.es" → "fibhgm.es"), or null for public webmail
 * and malformed addresses. Answer memory is scoped to this domain. NOTE: the domain is still self-declared by the
 * sponsor who types the address; verifying domains per hospital (or hospital accounts) is the next step.
 */
export function institutionalDomain(email: string | null | undefined): string | null {
  const m = /^[^@\s]+@([a-z0-9.-]+\.[a-z]{2,})$/i.exec((email ?? "").trim());
  if (!m) return null;
  const d = m[1].toLowerCase().replace(/\.+$/, "");
  if (WEBMAIL.has(d)) return null;
  // regional webmail variants (yahoo.co.uk, hotmail.fr, outlook.de…)
  if (/^(gmail|googlemail|hotmail|outlook|live|yahoo|ymail|icloud|proton|protonmail|gmx|aol|yandex|zoho|tutanota)\./.test(d)) return null;
  return d;
}

export const POLICY_LABEL: Record<ReusePolicy, { en: string; es: string; hint: string }> = {
  site: { en: "Hospital fact · reusable", es: "Dato del centro · reutilizable", hint: "Hospital fact: reused for any trial, with the hospital's consent" },
  indication: { en: "Same condition · reusable", es: "Misma enfermedad · reutilizable", hint: "Same condition: reused for future trials of the same condition, with the hospital's consent" },
  trial: { en: "This trial only", es: "Solo este ensayo", hint: "This trial only: never reused" },
};

// ---------- text normalisation & matching ----------

const fold = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Lower-case, accent-free, punctuation → single spaces. Used for keys and scopes. */
export function normText(s: string): string {
  return fold(s).replace(/[^a-z0-9]+/g, " ").trim().slice(0, 160);
}

const STOP = new Set(
  ("the and for with your you does have has are this that from site sites study trial trials how many what which " +
    "per any can will would its our del las los una uno por para con que sus su centro cuenta dispone dispon " +
    "tiene esta este estos estas como cual cuales cuantos cuantas hay ser sobre entre desde ensayo ensayos estudio")
    .split(" "),
);

/** Content tokens, stemmed to 6 characters ("coordinadores" ≈ "coordinador", "farmacia" ≈ "farmaceutico"). */
export function tokensOf(s: string): string[] {
  return [...new Set(normText(s).split(" ").filter((t) => t.length >= 3 && !STOP.has(t)).map((t) => t.slice(0, 6)))];
}

/** One entry the sponsor can add from the library. */
export interface LibraryItem {
  key: string;
  es: string;
  en: string;
  type: QuestionType;
  policy: ReusePolicy;
  origin: "builtin" | "custom";
}

/** Library entries matching typed text, best first (simple normalised token overlap). */
export function suggestFromLibrary(text: string, items: LibraryItem[], excludeKeys: Set<string>, limit = 5): LibraryItem[] {
  const q = tokensOf(text);
  if (!q.length) return [];
  return items
    .filter((i) => !excludeKeys.has(i.key))
    .map((i) => {
      const t = new Set([...tokensOf(i.es), ...tokensOf(i.en)]);
      const hit = q.filter((x) => t.has(x)).length;
      return { i, hit, score: hit / q.length };
    })
    .filter((x) => x.hit >= 2 || (x.hit >= 1 && x.score >= 0.5))
    .sort((a, b) => b.score - a.score || b.hit - a.hit)
    .slice(0, limit)
    .map((x) => x.i);
}

// ---------- built-in questions about the hospital (site policy) ----------

export const EQUIPMENT_ES: Record<string, string> = {
  ct: "TAC", mri: "resonancia magnética", pet: "PET", spect: "SPECT", gamma_camera: "gammacámara",
  cath_lab: "sala de hemodinámica", angiography: "angiografía digital", linac: "acelerador lineal",
  mammography: "mamógrafo", densitometry: "densitómetro", dialysis: "puestos de diálisis", lithotripsy: "litotricia",
};

export function equipmentQuestion(key: string): Question {
  return {
    id: `equipment_${key}`, key: `equipment:${key}`, policy: "site", type: "yesno", role: "equipment", equipmentKey: key,
    es: `¿Dispone el centro de ${EQUIPMENT_ES[key] ?? EQUIPMENT[key]} disponible para el estudio?`,
    en: `Is ${EQUIPMENT[key]} available for study procedures?`,
  };
}

/** A site requirement without public data ("apheresis unit") → yes/no question about the hospital. */
export function requirementQuestion(r: { en: string; es: string }, i: number): Question {
  return {
    id: `req_${i}`, key: `req:${normText(r.en)}`, policy: "site", type: "yesno", role: "requirement",
    es: `¿Dispone el centro de: «${r.es}»?`,
    en: `Does the site have: "${r.en}"?`,
  };
}

/** Fixed hospital-fact questions, by id. Also offered as library suggestions when a sponsor adds a question. */
export const SITE_QUESTIONS: Record<string, Question> = {
  pediatric_unit: { id: "pediatric_unit", key: "pediatric_unit", policy: "site", type: "yesno", role: "pediatric",
    es: "¿Dispone de una unidad de investigación pediátrica?",
    en: "Do you have a paediatric research unit?" },
  phase1_unit: { id: "phase1_unit", key: "phase1_unit", policy: "site", type: "yesno", role: "phase1Unit",
    es: "¿Dispone de una unidad de ensayos clínicos de fase I con camas dedicadas?",
    en: "Do you have a phase I unit with dedicated beds?" },
  ethics_committee: { id: "ethics_committee", key: "ethics_committee", policy: "site", type: "text", role: "ethics",
    es: "¿Dispone el centro de un CEIm acreditado propio? ¿Cuál?",
    en: "Does the site have its own accredited research ethics committee (CEIm)? Which one?" },
  research_institute: { id: "research_institute", key: "research_institute", policy: "site", type: "text", role: "institute",
    es: "¿Está el centro vinculado a un instituto de investigación sanitaria? ¿Cuál?",
    en: "Is the site linked to a health research institute? Which one?" },
  coordinator: { id: "coordinator", key: "coordinator", policy: "site", type: "yesno", role: "coordinator",
    es: "¿Cuenta con coordinadores de estudio dedicados?",
    en: "Do you have dedicated study coordinators?" },
  pharmacy: { id: "pharmacy", key: "pharmacy", policy: "site", type: "yesno", role: "pharmacy",
    es: "¿Dispone el servicio de farmacia de almacenamiento controlado de medicación en investigación (incl. refrigerado)?",
    en: "Does pharmacy have controlled IMP storage (incl. refrigerated)?" },
  startup_weeks: { id: "startup_weeks", key: "startup_weeks", policy: "site", type: "number", role: "startupWeeks",
    es: "Tiempo habitual (semanas) desde la recepción de documentación hasta la firma del contrato",
    en: "Typical weeks from receiving documents to contract signature" },
};

/** Built-in library entries a sponsor can add by typing (hospital facts only; criteria-specific ones are generated). */
export function builtinLibrary(): LibraryItem[] {
  return [...Object.values(SITE_QUESTIONS), ...Object.keys(EQUIPMENT).map(equipmentQuestion)].map((q) => ({
    key: q.key!, es: q.es, en: q.en, type: q.type, policy: "site" as const, origin: "builtin" as const,
  }));
}

/** Question for a built-in library key (site facts), or null. */
export function builtinQuestion(key: string): Question | null {
  if (key.startsWith("equipment:")) {
    const k = key.slice("equipment:".length);
    return k in EQUIPMENT ? equipmentQuestion(k) : null;
  }
  return Object.values(SITE_QUESTIONS).find((q) => q.key === key) ?? null;
}

// ---------- keys, policies and scopes ----------

/** Policies of the generated per-trial questions (by question id). */
const GENERATED: Record<string, { policy: ReusePolicy; maxAgeDays?: number }> = {
  interest: { policy: "trial" },
  pi: { policy: "trial" }, // PI with capacity for this study
  pi_department: { policy: "indication" },
  eligible_per_month: { policy: "indication" },
  commitment: { policy: "trial" },
  experience: { policy: "indication" },
  phase_experience: { policy: "indication" },
  competing: { policy: "indication", maxAgeDays: 90 }, // recruiting trials change quickly
  comments: { policy: "trial" },
};

/** Stable key + reuse policy for a question (also works for questionnaires saved before keys existed). */
export function libraryMeta(q: Question): { key: string; policy: ReusePolicy; maxAgeDays: number } {
  const gen = GENERATED[q.id];
  const maxAgeDays = gen?.maxAgeDays ?? REUSE_DAYS;
  if (q.key && q.policy) return { key: q.key, policy: q.policy, maxAgeDays };
  if (gen) return { key: q.id, policy: gen.policy, maxAgeDays };
  if (q.role === "equipment" && q.equipmentKey) return { key: `equipment:${q.equipmentKey}`, policy: "site", maxAgeDays };
  if (q.role === "criterionPerMonth") return { key: `criterion:${normText(q.en)}`, policy: "indication", maxAgeDays };
  const fixed = SITE_QUESTIONS[q.id];
  if (fixed) return { key: fixed.key!, policy: "site", maxAgeDays };
  return { key: `custom:${q.id}`, policy: "trial", maxAgeDays };
}

/** "Non-small cell lung cancer, NSCLC" → "non small cell lung cancer,nsclc" (order-insensitive synonyms). */
export function indicationScope(indication: string): string {
  return indication.split(/[,;]/).map(normText).filter(Boolean).sort().join(",");
}

/**
 * Scope a stored answer is valid for: "" for hospital facts; "indication|population" for indication answers (an adult
 * patients-per-month figure never pre-fills a paediatric trial), plus "|phase" for phase experience.
 */
export function answerScope(q: Question, c: Pick<TrialCriteria, "indication" | "phase" | "population">): string {
  const { key, policy } = libraryMeta(q);
  if (policy !== "indication") return "";
  const ind = `${indicationScope(c.indication)}|${c.population || "all"}`;
  return key === "phase_experience" ? `${ind}|${c.phase}` : ind;
}

// ---------- pre-fill structure (stored in Invitation.prefill) ----------

export type PrefillSourceKind = "registry" | "catalogue" | "sermas" | "ceim" | "isciii" | "hospital";

export interface PrefillSource {
  kind: PrefillSourceKind;
  /** Spanish label (hospital-facing). */
  label: string;
  /** English label (sponsor-facing, also the grouping key in the sponsor's summary). */
  labelEn: string;
  /** ISO date of the data or of the hospital's confirmation. */
  date?: string;
  href?: string;
}

export interface PrefilledAnswer {
  value: string;
  source: PrefillSource;
  /** Sponsor view only: a hospital-confirmed answer whose value (and date) is withheld from the sponsor. */
  hidden?: boolean;
}

export interface PrefillHint {
  es: string;
  en: string;
  source: PrefillSource;
}

export interface Prefill {
  v: 2;
  answers: Record<string, PrefilledAnswer>;
  /** Public context shown under a question, never used as an answer (e.g. SERMAS first visits). */
  hints: Record<string, PrefillHint>;
  /** Registry pre-fills: ids of the trial records each answer was counted from, frozen at send time so the hospital's
   *  record list matches the number it confirms after a data refresh. Server-only (not sent to the browser).
   *  Invitations sent before this existed have none. */
  records?: Record<string, string[]>;
}

/** Pre-filled questions whose value is a count (or a yes) from the public trial registries. */
export const REGISTRY_ROLES = ["experience", "phaseExperience", "competing", "pediatric"] as const;

/** Public pages behind each kind of pre-fill source (the dataset pages the pipeline reads). */
export const SOURCE_URL = {
  catalogue: "https://www.sanidad.gob.es/estadEstudios/estadisticas/sisInfSanSNS/ofertaRecursos/hospitales/home.htm",
  ceim: "https://reec.aemps.es/reec-services/ceimbyccaa?ccaa=13",
  isciii: "https://www.isciii.es/documents/d/guest/iis-acreditados_centros_feb_2026-1-?download=true",
  sermas: "https://www.comunidad.madrid/servicios/salud/memorias-e-informes-servicio-madrileno-salud",
} as const;

/**
 * Where a pre-fill source badge links to. Registry counts open the list of registry records they were counted from
 * (`recordsHref` + the question id); the other kinds open the public dataset (pre-fills saved before links existed
 * get the dataset page too). Hospital-confirmed answers have no public page.
 */
export function sourceHref(src: PrefillSource, q: { id: string; role?: string }, recordsHref?: string | null): string | undefined {
  if (src.kind === "registry") {
    if (!recordsHref || !(REGISTRY_ROLES as readonly string[]).includes(q.role ?? "")) return undefined;
    return `${recordsHref}${recordsHref.includes("?") ? "&" : "?"}p=${encodeURIComponent(q.id)}`;
  }
  if (src.href) return src.href;
  // a "not confirmed" hint (an inferred committee) gets no source link
  return src.kind === "hospital" || /not confirmed/.test(src.labelEn) ? undefined : SOURCE_URL[src.kind];
}

export const LEGACY_SOURCE: PrefillSource = { kind: "registry", label: "Datos públicos", labelEn: "Public data" };

/** Reads Invitation.prefill: the v2 structure, or the old plain {questionId: value} JSON. */
export function parsePrefill(json: string | null | undefined): Prefill {
  let raw: unknown = {};
  try {
    raw = JSON.parse(json || "{}");
  } catch {
    raw = {};
  }
  const o = (raw ?? {}) as Record<string, unknown>;
  if (o.v === 2 && o.answers && typeof o.answers === "object") {
    const records = o.records && typeof o.records === "object" ? (o.records as Prefill["records"]) : undefined;
    return { v: 2, answers: o.answers as Prefill["answers"], hints: (o.hints as Prefill["hints"]) ?? {}, ...(records ? { records } : {}) };
  }
  const answers: Prefill["answers"] = {};
  for (const [k, v] of Object.entries(o)) if (typeof v === "string" && v) answers[k] = { value: v, source: LEGACY_SOURCE };
  return { v: 2, answers, hints: {} };
}

/** Label of withheld hospital answers in the sponsor's views. */
export const HIDDEN_HOSPITAL_LABEL = "Previously confirmed by the hospital";

/**
 * Sponsor view of a pre-fill: hospital-sourced answers come from the hospital's earlier questionnaires (possibly for
 * other sponsors), so their value and date are withheld - the sponsor only learns they will be pre-filled. Run this on
 * the server before any pre-fill reaches a sponsor page.
 */
export function redactForSponsor(p: Prefill): Prefill {
  const answers: Prefill["answers"] = {};
  for (const [id, a] of Object.entries(p.answers)) {
    answers[id] = a.source.kind === "hospital"
      ? { value: "", hidden: true, source: { kind: "hospital", label: "Confirmado previamente por el hospital", labelEn: HIDDEN_HOSPITAL_LABEL } }
      : a;
  }
  return { v: 2, answers, hints: p.hints };
}

/** Pre-filled count for the current question list (withheld hospital answers count as pre-filled). */
export function prefillCoverage(questions: Question[], p: Prefill) {
  const filled = questions.filter((q) => p.answers[q.id]?.value || p.answers[q.id]?.hidden);
  const bySource = new Map<string, number>();
  for (const q of filled) {
    const l = p.answers[q.id].source.labelEn;
    bySource.set(l, (bySource.get(l) ?? 0) + 1);
  }
  return { filled: filled.length, total: questions.length, bySource };
}

/** Rough completion time for the hospital: ~20 s per question still to answer, ~4 s per pre-filled one to check. */
export function estimateMinutes(total: number, filled: number): number {
  return Math.max(1, Math.round(((total - filled) * 20 + filled * 4) / 60));
}
