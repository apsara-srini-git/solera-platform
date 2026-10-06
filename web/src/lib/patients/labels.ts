// Generic, client-safe labels for the patient portal (es/en). Plain-language UI chrome only: nothing here describes a
// specific trial. Neutral wording: no promotional terms, no claims about outcomes or eligibility.

import type { AgeGroup, Lang, LinkRegistry, PatientSort, SiteStatus, TrialStatus } from "./types";

export type L10n = Record<Lang, string>;

export const AREA_LABELS: Record<string, L10n> = {
  oncology: { es: "Cáncer (oncología)", en: "Cancer (oncology)" },
  hematology: { es: "Sangre (hematología)", en: "Blood (haematology)" },
  cardiovascular: { es: "Corazón y vasos sanguíneos", en: "Heart and blood vessels" },
  neurology: { es: "Cerebro y nervios (neurología)", en: "Brain and nerves (neurology)" },
  psychiatry: { es: "Salud mental", en: "Mental health" },
  infectious: { es: "Infecciones", en: "Infections" },
  respiratory: { es: "Pulmones y respiración", en: "Lungs and breathing" },
  gastro_hepatology: { es: "Aparato digestivo e hígado", en: "Digestive system and liver" },
  endocrine_metabolic: { es: "Hormonas y metabolismo (incl. diabetes)", en: "Hormones and metabolism (incl. diabetes)" },
  immunology_rheumatology: { es: "Sistema inmunitario, articulaciones y huesos", en: "Immune system, joints and bones" },
  dermatology: { es: "Piel (dermatología)", en: "Skin (dermatology)" },
  nephrology_urology: { es: "Riñón y vías urinarias", en: "Kidney and urinary tract" },
  womens_health: { es: "Salud de la mujer y embarazo", en: "Women's health and pregnancy" },
  ophthalmology: { es: "Ojos (oftalmología)", en: "Eyes (ophthalmology)" },
  rare_genetic: { es: "Enfermedades raras y genéticas", en: "Rare and genetic diseases" },
};

export interface PhaseInfo {
  label: L10n;
  /** One or two plain sentences, generic to every study of this phase. */
  explain: L10n;
}

export const PHASE_INFO: Record<string, PhaseInfo> = {
  EARLY_PHASE1: {
    label: { es: "Fase I temprana", en: "Early phase I" },
    explain: {
      es: "Estudio muy inicial en un número muy pequeño de personas, antes de una fase I, para conocer cómo se comporta una sustancia en el cuerpo.",
      en: "A very early study in a very small number of people, before phase I, to learn how a substance behaves in the body.",
    },
  },
  PHASE1: {
    label: { es: "Fase I", en: "Phase I" },
    explain: {
      es: "Primeros estudios en personas. Suelen participar pocas personas y se estudia sobre todo la seguridad y la dosis.",
      en: "First studies in people. Usually a small number of people take part, and the main focus is safety and dose.",
    },
  },
  PHASE2: {
    label: { es: "Fase II", en: "Phase II" },
    explain: {
      es: "Se estudia en un grupo mayor de personas qué efecto tiene sobre la enfermedad y se sigue estudiando la seguridad.",
      en: "A larger group of people takes part to study its effect on the condition, while safety continues to be studied.",
    },
  },
  PHASE3: {
    label: { es: "Fase III", en: "Phase III" },
    explain: {
      es: "Se compara, en muchas personas, con el tratamiento habitual o con un placebo, para confirmar sus efectos y su seguridad.",
      en: "It is compared, in many people, with usual care or a placebo to confirm its effects and safety.",
    },
  },
  PHASE4: {
    label: { es: "Fase IV", en: "Phase IV" },
    explain: {
      es: "Estudios con medicamentos ya autorizados, para conocer mejor su uso y su seguridad en la práctica habitual.",
      en: "Studies of medicines that are already authorised, to learn more about their use and safety in everyday practice.",
    },
  },
  NA: {
    label: { es: "Sin fase", en: "No phase" },
    explain: {
      es: "Las fases se usan para estudios con medicamentos. Este tipo de estudio no las usa (por ejemplo, estudios de dispositivos, cirugía o hábitos).",
      en: "Phases are used for studies of medicines. This type of study does not use them (for example studies of devices, surgery or lifestyle).",
    },
  },
};

export const TRIAL_STATUS_LABELS: Record<TrialStatus, L10n> = {
  RECRUITING: { es: "Buscando participantes", en: "Looking for participants" },
  NOT_YET_RECRUITING: { es: "Aún no ha empezado", en: "Not started yet" },
};

export const SITE_STATUS_LABELS: Record<SiteStatus, L10n> = {
  recruiting: { es: "Buscando participantes en este hospital", en: "Looking for participants at this hospital" },
  not_yet: { es: "Aún no ha empezado en este hospital", en: "Not started yet at this hospital" },
  unknown: { es: "Estado en este hospital no indicado", en: "Status at this hospital not stated" },
};

/** Status across the trial's Madrid hospitals (cards and trial header). Built only from per-hospital statuses, so a
 *  trial recruiting elsewhere but not yet in Madrid is never shown as "looking for participants". */
export const MADRID_STATUS_LABELS: Record<SiteStatus, L10n> = {
  recruiting: { es: "Buscando participantes en Madrid", en: "Looking for participants in Madrid" },
  not_yet: { es: "Aún no ha empezado en Madrid", en: "Not started yet in Madrid" },
  unknown: { es: "Estado en Madrid no indicado", en: "Status in Madrid not stated" },
};

/** recruiting if ≥1 Madrid hospital is recruiting; not_yet if every Madrid hospital has not started; else unknown. */
export function madridStatus(sites: readonly { status: SiteStatus }[]): SiteStatus {
  if (sites.some((s) => s.status === "recruiting")) return "recruiting";
  if (sites.length > 0 && sites.every((s) => s.status === "not_yet")) return "not_yet";
  return "unknown";
}

/** Overall registry status of the whole trial (all countries). */
export const OVERALL_STATUS_LABELS: Record<TrialStatus, L10n> = {
  RECRUITING: { es: "Reclutando (buscando participantes)", en: "Recruiting" },
  NOT_YET_RECRUITING: { es: "Aún no recluta", en: "Not yet recruiting" },
};

export const AGE_GROUP_LABELS: Record<AgeGroup, L10n> = {
  child: { es: "Niños y adolescentes (menores de 18)", en: "Children and teenagers (under 18)" },
  adult: { es: "Adultos (18 a 64)", en: "Adults (18 to 64)" },
  older: { es: "Mayores de 65", en: "65 and over" },
};

export const SORT_LABELS: Record<PatientSort, L10n> = {
  updated: { es: "Actualizado más recientemente en el registro", en: "Most recently updated in the registry" },
  alpha: { es: "Por título (A–Z)", en: "By title (A–Z)" },
  hospitals: { es: "Por número de hospitales en Madrid", en: "By number of Madrid hospitals" },
};

export const SORT_NOTE: L10n = { es: "El orden no es una recomendación.", en: "The order is not a recommendation." };

export const STALE_NOTE: L10n = {
  es: "Puede estar desactualizado. Confirma el estado con el equipo del estudio",
  en: "May be out of date. Confirm the status with the study team",
};

export const REGISTRY_LABELS: Record<LinkRegistry, L10n> = {
  reec: { es: "REec (Registro Español de Estudios Clínicos, AEMPS)", en: "REec (Spanish Clinical Studies Registry, AEMPS)" },
  ctgov: { es: "ClinicalTrials.gov", en: "ClinicalTrials.gov" },
  ctis: { es: "CTIS (Unión Europea)", en: "CTIS (European Union)" },
  euctr: { es: "Registro de Ensayos Clínicos de la UE", en: "EU Clinical Trials Register" },
};

export const SEX_LABELS: Record<"ALL" | "FEMALE" | "MALE", L10n> = {
  ALL: { es: "Todos los sexos", en: "All sexes" },
  FEMALE: { es: "Solo mujeres", en: "Women only" },
  MALE: { es: "Solo hombres", en: "Men only" },
};

/** Label for a text that is only available in the other language. */
export const ONLY_IN_LANG: Record<Lang, L10n> = {
  es: { es: "Solo disponible en español en el registro", en: "Only available in Spanish in the registry" },
  en: { es: "Solo disponible en inglés en el registro", en: "Only available in English in the registry" },
};

export function phaseLabel(phase: string, lang: Lang): string {
  return PHASE_INFO[phase]?.label[lang] ?? phase;
}

const ROMAN: Record<string, string> = { EARLY_PHASE1: "I", PHASE1: "I", PHASE2: "II", PHASE3: "III", PHASE4: "IV" };
const PHASE_ORDER = ["EARLY_PHASE1", "PHASE1", "PHASE2", "PHASE3", "PHASE4", "NA"];

/** Label for a trial's registry phases: ["PHASE1","PHASE2"] → "Fase I/II"; a single phase uses PHASE_INFO. */
export function phasesLabel(phases: readonly string[], lang: Lang): string | null {
  const keys = PHASE_ORDER.filter((k) => phases.includes(k));
  if (keys.length === 0) return null;
  if (keys.length === 1) return phaseLabel(keys[0], lang);
  const roman = keys.filter((k) => ROMAN[k]).map((k) => ROMAN[k]);
  return `${lang === "es" ? "Fase" : "Phase"} ${roman.join("/")}`;
}

export function areaLabel(area: string, lang: Lang): string {
  return AREA_LABELS[area]?.[lang] ?? area;
}

/** Text in the requested language, else the other one, with which language was used (for an "only in …" note). */
export function pickText(t: { es?: string; en?: string }, lang: Lang): { text: string; lang: Lang } | null {
  const other: Lang = lang === "es" ? "en" : "es";
  if (t[lang]) return { text: t[lang]!, lang };
  if (t[other]) return { text: t[other]!, lang: other };
  return null;
}
