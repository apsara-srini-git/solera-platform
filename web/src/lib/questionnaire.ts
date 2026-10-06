import type { ConfidentialInfo, TrialCriteria } from "./types";
import { AREAS, EQUIPMENT, PHASES, PHASES_ES, POPULATIONS, phasesOf } from "./types";
import { EQUIPMENT_ES, SITE_QUESTIONS, equipmentQuestion, normText, requirementQuestion, type ReusePolicy } from "./question-library";

export type QuestionType = "yesno" | "yesnomaybe" | "number" | "text";

export interface Question {
  id: string;
  type: QuestionType;
  es: string;
  en: string;
  /** Stable question-library key (see question-library.ts). Older questionnaires may lack it: use libraryMeta(). */
  key?: string;
  /** Reuse policy of the hospital's answer: site fact, same indication, or this trial only. */
  policy?: ReusePolicy;
  /** Scoring role. Custom questions have none and are shown to the sponsor unscored. */
  role?:
    | "interest" | "pi" | "eligiblePerMonth" | "commitment" | "experience" | "phaseExperience"
    | "competing" | "equipment" | "coordinator" | "pharmacy" | "phase1Unit" | "startupWeeks" | "pediatric"
    | "criterionPerMonth" | "requirement" | "ethics" | "institute";
  equipmentKey?: string;
  custom?: boolean;
  /** The sponsor reworded this question ("same question, clearer wording"): regeneration keeps its text. */
  edited?: boolean;
}

export type Answers = Record<string, string>;

const lowerFase = (s: string) => s.replace("Fase", "fase");

/** The commitment question, with the recruitment period only when the sponsor set one. */
function commitmentText(c: TrialCriteria): { es: string; en: string } {
  return c.recruitmentMonths
    ? { es: `¿Cuántos pacientes podría reclutar de forma realista en ${c.recruitmentMonths} meses?`,
        en: `How many patients could you realistically enrol within ${c.recruitmentMonths} months?` }
    : { es: "¿Cuántos pacientes podría reclutar de forma realista durante el periodo de reclutamiento?",
        en: "How many patients could you realistically enrol during the recruitment period?" };
}

/** The recruitment target line of the trial summary, or null when the sponsor set neither the target nor the period. */
function targetLine(c: TrialCriteria): { es: string; en: string } | null {
  const n = c.targetPatientsPerSite;
  const m = c.recruitmentMonths;
  if (n && m) return { es: `Objetivo por centro: ${n} pacientes en ${m} meses`, en: `Target per site: ${n} patients in ${m} months` };
  if (n) return { es: `Objetivo por centro: ${n} pacientes`, en: `Target per site: ${n} patients` };
  if (m) return { es: `Periodo de reclutamiento: ${m} meses`, en: `Recruitment period: ${m} months` };
  return null;
}

/** Builds the question set from blinded criteria only. */
export function generateQuestions(c: TrialCriteria): Question[] {
  const phase = PHASES[c.phase] ?? c.phase;
  const phaseEs = lowerFase(PHASES_ES[c.phase] ?? c.phase);
  const q: Question[] = [
    { id: "interest", key: "interest", policy: "trial", type: "yesnomaybe", role: "interest",
      es: "¿Estaría su centro interesado en participar en este ensayo?",
      en: "Would your site be interested in participating in this trial?" },
    { id: "pi", key: "pi", policy: "trial", type: "yesno", role: "pi",
      es: "¿Dispone de un investigador principal con experiencia en esta indicación y disponibilidad para el estudio?",
      en: "Do you have a principal investigator experienced in this indication with capacity for the study?" },
    { id: "pi_department", key: "pi_department", policy: "indication", type: "text",
      es: "Servicio / departamento que llevaría el estudio",
      en: "Department that would run the study" },
    { id: "eligible_per_month", key: "eligible_per_month", policy: "indication", type: "number", role: "eligiblePerMonth",
      es: `¿Cuántos pacientes potencialmente elegibles (${c.indication}) atiende su centro al mes?`,
      en: `How many potentially eligible patients (${c.indication}) does your site see per month?` },
    { id: "commitment", key: "commitment", policy: "trial", type: "number", role: "commitment",
      ...commitmentText(c) },
    { id: "experience", key: "experience", policy: "indication", type: "number", role: "experience",
      // the pre-fill counts every registered trial in the condition at the centre (not only recent ones)
      es: "Número de ensayos clínicos registrados en esta indicación en su centro (en total)",
      en: "Number of registered clinical trials in this indication at your site (all time)" },
    { id: "phase_experience", key: "phase_experience", policy: "indication", type: "yesno", role: "phaseExperience",
      es: `¿Ha participado su centro en ensayos de ${phaseEs} en ${c.indication}?`,
      en: `Has your site run ${phase} trials in ${c.indication}?` },
    { id: "competing", key: "competing", policy: "indication", type: "number", role: "competing",
      // the pre-fill counts trials in the same condition recruiting at the centre now (records page: "Ensayos en … reclutando ahora")
      es: `¿Cuántos ensayos en ${c.indication} están reclutando actualmente en su centro?`,
      en: `How many trials in ${c.indication} are currently recruiting at your site?` },
  ];
  (c.keyCriteria ?? []).forEach((k, i) => {
    q.push({ id: `criterion_${i}`, key: `criterion:${normText(k.en)}`, policy: "indication", type: "number", role: "criterionPerMonth",
      es: `De sus pacientes con ${c.indication}, ¿cuántos al mes cumplen: «${k.es}»? (puede usar decimales, p. ej. 0,5)`,
      en: `Of your ${c.indication} patients, how many per month meet: "${k.en}"? (decimals allowed, e.g. 0.5)` });
  });
  for (const key of c.equipment) q.push(equipmentQuestion(key));
  (c.otherRequirements ?? []).forEach((r, i) => q.push(requirementQuestion(r, i)));
  if (c.population === "pediatric") q.push({ ...SITE_QUESTIONS.pediatric_unit });
  if (phasesOf(c.phase).includes("PHASE1")) q.push({ ...SITE_QUESTIONS.phase1_unit });
  q.push(
    { ...SITE_QUESTIONS.ethics_committee },
    { ...SITE_QUESTIONS.research_institute },
    { ...SITE_QUESTIONS.coordinator },
    { ...SITE_QUESTIONS.pharmacy },
    { ...SITE_QUESTIONS.startup_weeks },
    { id: "comments", key: "comments", policy: "trial", type: "text",
      es: "Comentarios adicionales",
      en: "Additional comments" },
  );
  return q;
}

/**
 * Regenerates the generated questions after the trial details changed, keeping the sponsor's work: custom questions,
 * reworded questions (their text), removed questions (stay removed) and the order. New generated questions (e.g. a new
 * key criterion) are inserted after their generated predecessor. Matching is by library key, so index-based ids
 * (criterion_0…) follow the new criteria.
 */
export function regenerateQuestions(oldCriteria: TrialCriteria, newCriteria: TrialCriteria, current: Question[]): Question[] {
  const keyOf = (q: Question) => q.key ?? q.id;
  const oldKeys = new Set(generateQuestions(oldCriteria).map(keyOf));
  const fresh = generateQuestions(newCriteria);
  const freshByKey = new Map(fresh.map((q) => [keyOf(q), q]));
  const present = new Set(current.filter((q) => !q.custom).map(keyOf));
  const out: Question[] = [];
  const used = new Set<string>();
  for (const q of current) {
    if (q.custom) { out.push(q); continue; }
    const f = freshByKey.get(keyOf(q));
    if (!f) continue; // no longer generated (e.g. a key criterion the sponsor deleted)
    used.add(keyOf(f));
    out.push(q.edited ? { ...f, es: q.es, en: q.en, edited: true } : f);
  }
  fresh.forEach((f, i) => {
    const k = keyOf(f);
    if (used.has(k) || (oldKeys.has(k) && !present.has(k))) return; // already placed, or removed by the sponsor
    let at = -1;
    for (let j = i - 1; j >= 0 && at === -1; j--) {
      const prev = out.findIndex((q) => !q.custom && keyOf(q) === keyOf(fresh[j]));
      if (prev !== -1) at = prev + 1;
    }
    if (at === -1) {
      const c = out.findIndex((q) => q.id === "comments");
      at = c === -1 ? out.length : c;
    }
    out.splice(at, 0, f);
    used.add(k);
  });
  return out;
}

/** Plain-language summary shared with sites. Built only from blinded criteria: never the drug, sponsor or protocol code.
 *  `questions`: when given, key-criterion lines follow the criterion questions still in the questionnaire. */
export function blindedSummary(c: TrialCriteria, questions?: Question[]): { es: string; en: string }[] {
  const area = c.area ? AREAS[c.area] ?? c.area : "-";
  const reqs = (c.otherRequirements ?? []).filter((_, i) => !questions || questions.some((q) => q.id === `req_${i}`));
  const target = targetLine(c);
  return [
    { es: `Indicación: ${c.indication}`, en: `Indication: ${c.indication}` },
    { es: `Área terapéutica: ${c.area ? AREAS_ES[c.area] ?? c.area : "-"}`, en: `Therapeutic area: ${area}` },
    ...(c.areaOther?.trim() ? [{ es: `Área (detalle): ${c.areaOther.trim()}`, en: `Area (detail): ${c.areaOther.trim()}` }] : []),
    { es: `Fase: ${(PHASES_ES[c.phase] ?? c.phase).replace("Fase ", "")}`, en: `Phase: ${PHASES[c.phase] ?? c.phase}` },
    { es: `Población: ${POPULATIONS_ES[c.population]}`, en: `Population: ${POPULATIONS[c.population]}` },
    ...(c.populationOther?.trim()
      ? [{ es: `Población (detalle): ${c.populationOther.trim()}`, en: `Population (detail): ${c.populationOther.trim()}` }]
      : []),
    ...(target ? [target] : []),
    ...(c.keyCriteria ?? [])
      .filter((_, i) => !questions || questions.some((q) => q.id === `criterion_${i}`))
      .map((k) => ({ es: `Criterio clave: ${k.es}`, en: `Key criterion: ${k.en}` })),
    ...(c.equipment.length
      ? [{ es: `Equipamiento requerido: ${c.equipment.map((k) => EQUIPMENT_ES[k] ?? k).join(", ")}`,
           en: `Required equipment: ${c.equipment.map((k) => EQUIPMENT[k] ?? k).join(", ")}` }]
      : []),
    ...(reqs.length
      ? [{ es: `Otros requisitos del centro: ${reqs.map((r) => r.es).join("; ")}`,
           en: `Other site requirements: ${reqs.map((r) => r.en).join("; ")}` }]
      : []),
  ];
}

const AREAS_ES: Record<string, string> = {
  oncology: "Oncología", hematology: "Hematología", cardiovascular: "Cardiovascular", neurology: "Neurología",
  psychiatry: "Psiquiatría", infectious: "Enfermedades infecciosas", respiratory: "Neumología",
  gastro_hepatology: "Aparato digestivo y hepatología", endocrine_metabolic: "Endocrinología y metabolismo",
  immunology_rheumatology: "Inmunología y reumatología", dermatology: "Dermatología", nephrology_urology: "Nefrología y urología",
  womens_health: "Salud de la mujer", ophthalmology: "Oftalmología", rare_genetic: "Enfermedades raras y genéticas",
};

const POPULATIONS_ES = { adult: "Adultos", pediatric: "Pediátrica", all: "Todas las edades" };

const LEGAL_SUFFIX = /\b(inc|corp|corporation|ltd|limited|llc|plc|ag|ab|sa|s\.a|sl|s\.l|slu|gmbh|bv|b\.v|nv|spa|s\.p\.a|co|kg|oy)\.?$/i;
const GENERIC = new Set(["eudract", "euct", "protocol", "protocolo", "study", "estudio", "the", "and", "pharma", "pharmaceuticals"]);
const fold = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const squash = (s: string) => fold(s).replace(/[^a-z0-9]+/g, "");

/** Splits stored confidential values into individually searchable terms:
 *  "AZD9291 (osimertinib)" → AZD9291, osimertinib; "Demo Biotech SL" → Demo Biotech. */
export function confidentialTerms(conf: ConfidentialInfo): string[] {
  const out = new Set<string>();
  for (const raw of [conf.drugName, conf.sponsorName, conf.protocolCode, ...(conf.otherTerms ?? [])]) {
    if (!raw?.trim()) continue;
    const parts = [raw, ...raw.split(/[,;/()[\]\n]|\s+(?:or|and|y|o)\s+/i)];
    for (let p of parts) {
      p = p.trim().replace(/^(eudract|eu ?ct|nct|protocol(o)?)(\s*(no\.?|number|n\.?º))?\s*:?\s*/i, "");
      while (LEGAL_SUFFIX.test(p)) p = p.replace(LEGAL_SUFFIX, "").trim().replace(/[,.]$/, "").trim();
      if (squash(p).length >= 3 && !GENERIC.has(fold(p))) out.add(p);
    }
  }
  return [...out];
}

/** Returns any confidential term that appears in text meant for sites (case, accent and punctuation
 *  insensitive, so "SLR 101" and "slr-101" both match "SLR-101"). Every kept-out term counts, the sponsor's company
 *  name included: hospitals never see who the sponsor is. */
export function findLeaks(texts: string[], conf: ConfidentialInfo): string[] {
  return matchTerms(texts, confidentialTerms(conf));
}

type Span = [number, number];
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word pattern for a term over folded text, punctuation between words optional ("slr 101" ~ "slr-101"). */
function wordsPattern(term: string): RegExp | null {
  const words = fold(term).split(/[^a-z0-9]+/).filter(Boolean);
  if (!words.length) return null;
  return new RegExp(`(?<![a-z0-9])${words.map(escapeRe).join("[^a-z0-9]*")}(?![a-z0-9])`, "g");
}

function spans(hay: string, re: RegExp): Span[] {
  return [...hay.matchAll(re)].map((m) => [m.index, m.index + m[0].length] as Span);
}

/** Where a kept-out term occurs in folded text. Code-like terms (letters + digits) also match with any punctuation
 *  between characters and without word boundaries ("xslr101" contains "SLR-101"), to catch reformatted codes. */
function termSpans(hay: string, term: string): Span[] {
  const re = wordsPattern(term);
  if (!re) return [];
  const out = spans(hay, re);
  if (/\d/.test(term) && /[a-z]/i.test(term)) {
    const chars = [...squash(term)].map(escapeRe).join("[^a-z0-9]*");
    out.push(...spans(hay, new RegExp(chars, "g")));
  }
  return out;
}

function matchTerms(texts: string[], terms: string[]): string[] {
  const hay = fold(texts.join("\n"));
  return terms.filter((t) => termSpans(hay, t).length > 0);
}

/** Every text a hospital reads for this questionnaire (summary + questions), for the leak check. */
export function hospitalFacingTexts(c: TrialCriteria, questions: Question[]): string[] {
  const summary = blindedSummary(c, questions);
  return [...summary.flatMap((s) => [s.es, s.en]), ...questions.flatMap((q) => [q.es, q.en])];
}

/**
 * Code- and drug-name-like terms in sponsor-written text (applies even when the sponsor saved no confidential details):
 * product codes ("AZD9291", "MK-3475") and INN-style drug names ("…mab", "…tinib"). Used to block custom questions.
 */
export function suspiciousTerms(text: string): string[] {
  const codes = text.match(/\b[A-Za-z]{2,5}-?\d{3,}[A-Za-z0-9]*\b/g) ?? [];
  const inns = text.match(/\b[A-Za-z]{3,}(?:mab|tinib|ciclib|parib|lisib|zomib|degib|rafenib|sertib)\b/gi) ?? [];
  return [...new Set([...codes, ...inns])];
}

// ---------- answer validation (client + server) ----------

export interface NumberRule {
  /** true = whole numbers only; false = at most one decimal (per-month counts such as 0,5). */
  integer: boolean;
  min: number;
  max: number;
}

// Caps only catch typos: they sit well above real registry values (e.g. 378 competing trials, 1,569 trials in an
// indication at the largest Madrid hospitals). Public-data pre-fills are never capped (see checkAnswer's `uncapped`).
const RULE_BY_KEY: Record<string, NumberRule> = {
  commitment: { integer: true, min: 0, max: 1000 },
  experience: { integer: true, min: 0, max: 20000 },
  competing: { integer: true, min: 0, max: 5000 },
  startup_weeks: { integer: true, min: 0, max: 104 },
  eligible_per_month: { integer: false, min: 0, max: 1000 },
};
const PER_MONTH: NumberRule = { integer: false, min: 0, max: 1000 };
const OTHER_NUMBER: NumberRule = { integer: false, min: 0, max: 1_000_000 };

/** Validation rule of a stored answer's key, or null when the key is not a known number question. */
export function numberRuleForKey(key: string): NumberRule | null {
  if (key.startsWith("criterion:")) return PER_MONTH;
  return RULE_BY_KEY[key] ?? null;
}

const ROLE_KEY: Partial<Record<NonNullable<Question["role"]>, string>> = {
  commitment: "commitment", experience: "experience", competing: "competing", startupWeeks: "startup_weeks", eligiblePerMonth: "eligible_per_month",
};

/** Number rule of a question (by role, so questionnaires saved before keys existed are covered too). */
export function numberRule(q: Pick<Question, "type" | "role" | "key">): NumberRule | null {
  if (q.type !== "number") return null;
  if (q.role === "criterionPerMonth") return PER_MONTH;
  const k = (q.role && ROLE_KEY[q.role]) || q.key || "";
  return RULE_BY_KEY[k] ?? OTHER_NUMBER;
}

export type Checked = { ok: true; value: string } | { ok: false; es: string; en: string };

/** "2.000", "1.200", "12.500.000", "1,500": a thousands separator, or a decimal? Ambiguous, so never guessed. */
const THOUSANDS = /^[1-9]\d{0,2}([.,]\d{3})+$/;

/**
 * Parses a count typed in Spanish or English style ("0,5", "0.5", "12") against a rule; returns the canonical "0.5".
 * A decimal separator (comma or dot) is accepted only for per-month questions, with one decimal. Thousands notation
 * ("2.000") is rejected as ambiguous. `uncapped`: skip the maximum (a value that came from a public registry).
 */
export function checkNumber(raw: string, rule: NumberRule, opts?: { uncapped?: boolean }): Checked {
  const s = raw.trim().replace(/\s/g, "");
  if (THOUSANDS.test(s))
    return {
      ok: false,
      es: `Escriba el número sin separador de miles (p. ej. ${s.replace(/[.,]/g, "")}).`,
      en: `Write the number without a thousands separator (e.g. ${s.replace(/[.,]/g, "")}).`,
    };
  const m = /^(\d+)(?:[.,](\d+))?$/.exec(s);
  if (!m) return { ok: false, es: "Escriba un número (sin separador de miles).", en: "Enter a number (no thousands separator)." };
  const dec = (m[2] ?? "").replace(/0+$/, "");
  if (rule.integer && m[2] !== undefined)
    return { ok: false, es: "Escriba un número entero, sin decimales.", en: "Enter a whole number, without decimals." };
  if (!rule.integer && dec.length > 1) return { ok: false, es: "Use como máximo un decimal (p. ej. 0,5).", en: "Use at most one decimal (e.g. 0.5)." };
  const n = Number(`${m[1]}${dec ? "." + dec : ""}`);
  if (n < rule.min || (!opts?.uncapped && n > rule.max)) {
    const max = new Intl.NumberFormat("es-ES").format(rule.max);
    return { ok: false, es: `Escriba un valor entre ${rule.min} y ${max}.`, en: `Enter a value between ${rule.min} and ${rule.max}.` };
  }
  return { ok: true, value: String(n) };
}

/** Validates one answer for its question type; returns the canonical value to store. */
export function checkAnswer(q: Pick<Question, "type" | "role" | "key">, raw: string, opts?: { uncapped?: boolean }): Checked {
  const v = raw.trim();
  if (q.type === "yesno" || q.type === "yesnomaybe") {
    const ok = q.type === "yesno" ? ["yes", "no"] : ["yes", "maybe", "no"];
    return ok.includes(v) ? { ok: true, value: v } : { ok: false, es: "Elija una opción.", en: "Choose an option." };
  }
  const rule = numberRule(q);
  if (rule) return checkNumber(v, rule, opts);
  return v.length <= 2000 ? { ok: true, value: v } : { ok: false, es: "Texto demasiado largo.", en: "Text is too long." };
}

const NF_ES = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
/** Hospital-facing display of an answer: Sí / No / Quizá, numbers in Spanish format (0,5 · 12). */
export function showAnswerEs(q: Pick<Question, "type" | "role" | "key"> | null, v: string): string {
  if (v === "yes") return "Sí";
  if (v === "no") return "No";
  if (v === "maybe") return "Quizá";
  if ((!q || q.type === "number") && /^\d+(\.\d+)?$/.test(v)) return NF_ES.format(Number(v));
  return v;
}

const NF_EN = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
/** Fixed Spanish wording of the public-data pre-fills (lib/site-answers.ts), shown to an English-speaking sponsor. The
 *  hospital still sees and answers the Spanish value; institution names stay as they are. */
const PREFILL_EN: [RegExp, string][] = [
  [/^Sí(?: —|:) /, "Yes: "],
  [/^No, el centro está adscrito a: /, "No, the site is attached to: "],
  [/ \(IIS acreditado por el ISCIII\)$/, " (ISCIII-accredited IIS)"],
];

/** English display of an answer value for the sponsor (the stored value is unchanged). */
export function showAnswerEn(q: Pick<Question, "type" | "role" | "key"> | null, v: string): string {
  if (v === "yes") return "Yes";
  if (v === "no") return "No";
  if (v === "maybe") return "Maybe";
  if ((!q || q.type === "number") && /^\d+(\.\d+)?$/.test(v)) return NF_EN.format(Number(v));
  return PREFILL_EN.reduce((s, [re, en]) => s.replace(re, en), v);
}

/** Answer value as the sponsor sees it in their language. */
export function showAnswer(q: Pick<Question, "type" | "role" | "key"> | null, v: string, lang: "en" | "es"): string {
  return lang === "es" ? showAnswerEs(q, v) : showAnswerEn(q, v);
}

// ---------- response scoring ----------

export interface MatchResult {
  responseScore: number;
  matchScore: number;
  reasons: string[];
  flags: string[];
  declined: boolean;
}

export function scoreResponse(questions: Question[], answers: Answers, c: TrialCriteria, publicScore: number): MatchResult {
  const by = (role: Question["role"]) => questions.filter((q) => q.role === role).map((q) => answers[q.id] ?? "");
  const num = (role: Question["role"]) => {
    const v = by(role)[0];
    const n = Number(String(v).replace(",", "."));
    return v === "" || v === undefined || !Number.isFinite(n) ? null : n;
  };
  const yes = (role: Question["role"]) => by(role)[0] === "yes";

  const parts: { w: number; v: number }[] = [];
  const reasons: string[] = [];
  const flags: string[] = [];

  const interest = by("interest")[0];
  if (interest === "no") {
    return { responseScore: 0, matchScore: 0, reasons: [], flags: ["Site declined to participate"], declined: true };
  }

  const target = c.targetPatientsPerSite;
  const commitment = num("commitment");
  const perMonth = num("eligiblePerMonth");
  const criterionCounts = questions
    .filter((q) => q.role === "criterionPerMonth")
    .filter((q) => (answers[q.id] ?? "").trim() !== "")
    .map((q) => Number(answers[q.id].replace(",", ".")))
    .filter((n) => Number.isFinite(n))
    .map((n) => Math.max(0, n));
  if (perMonth !== null && criterionCounts.some((n) => n > perMonth))
    flags.push(`A key-criterion count exceeds the stated eligible patients per month (${perMonth})`);
  const pool = criterionCounts.length ? Math.min(...criterionCounts, perMonth ?? Infinity) : perMonth;
  if (commitment !== null) {
    if (target) {
      const v = Math.min(1, commitment / target);
      parts.push({ w: 35, v });
      reasons.push(`Commits ${commitment} of ${target} target patients (${Math.round(v * 100)}%)`);
    } else {
      // no target set: nothing to compare with, so the commitment is reported but neither rewarded nor penalised
      reasons.push(`Commits ${commitment} patients (no target set)`);
    }
    const months = c.recruitmentMonths;
    if (months && pool !== null && Number.isFinite(pool) && commitment > pool * months)
      flags.push(`Commitment (${commitment}) exceeds stated eligible pool (${pool}/month × ${months} months)`);
  } else {
    parts.push({ w: 35, v: 0 });
    flags.push("No enrolment commitment given");
  }

  parts.push({ w: 15, v: yes("pi") ? 1 : 0 });
  if (yes("pi")) reasons.push("PI available");
  else flags.push("No PI confirmed");

  const competing = num("competing");
  if (competing !== null) {
    parts.push({ w: 10, v: 1 - Math.min(1, competing / 4) });
    if (competing >= 3) flags.push(`${competing} trials in this condition already recruiting at the site`);
  }

  const weeks = num("startupWeeks");
  if (weeks !== null) {
    const v = Math.max(0, Math.min(1, (24 - weeks) / 16));
    parts.push({ w: 10, v });
    reasons.push(`Contract start-up ~${weeks} weeks`);
  }

  const equipment = questions.filter((q) => q.role === "equipment");
  if (equipment.length) {
    const ok = equipment.filter((q) => answers[q.id] === "yes");
    parts.push({ w: 10, v: ok.length / equipment.length });
    for (const q of equipment) if (answers[q.id] !== "yes") flags.push(`${EQUIPMENT[q.equipmentKey!]} not confirmed`);
  }

  parts.push({ w: 5, v: yes("coordinator") ? 1 : 0 });
  parts.push({ w: 5, v: yes("pharmacy") ? 1 : 0 });
  if (!yes("pharmacy")) flags.push("IMP storage not confirmed");

  const requirements = questions.filter((q) => q.role === "requirement");
  if (requirements.length) {
    const ok = requirements.filter((q) => answers[q.id] === "yes");
    parts.push({ w: 10, v: ok.length / requirements.length });
    for (const q of requirements) if (answers[q.id] !== "yes") flags.push(`Not confirmed: ${q.en.replace(/^Does the site have: /, "")}`);
  }

  if (phasesOf(c.phase).includes("PHASE1")) {
    parts.push({ w: 10, v: yes("phase1Unit") ? 1 : 0 });
    if (!yes("phase1Unit")) flags.push("No dedicated phase I unit");
  } else {
    parts.push({ w: 10, v: yes("phaseExperience") ? 1 : 0 });
  }
  if (c.population === "pediatric") {
    parts.push({ w: 10, v: yes("pediatric") ? 1 : 0 });
    if (!yes("pediatric")) flags.push("No paediatric research unit");
  }

  const totalW = parts.reduce((s, p) => s + p.w, 0);
  let responseScore = (parts.reduce((s, p) => s + p.w * p.v, 0) / totalW) * 100;
  if (interest === "maybe") {
    responseScore *= 0.85;
    flags.push("Interest is tentative");
  }
  responseScore = Math.round(responseScore);
  const matchScore = Math.round(0.7 * responseScore + 0.3 * publicScore);
  return { responseScore, matchScore, reasons, flags, declined: false };
}

export function questionnaireSummaryLabel(c: TrialCriteria): string {
  return `${PHASES[c.phase] ?? c.phase} · ${c.indication}${c.area ? ` · ${AREAS[c.area]}` : ""}`;
}
