// Professional side (sponsors, CROs, investigators): core dictionary, shared labels and formatting helpers.
// Client-safe: no server imports. Per-area strings live in ./pro/*.ts (one module per area, imported only where used, so
// client bundles carry only what their page needs). Every module defines `en` first; `es` is typed `typeof en`, so a
// missing or misspelt key fails `tsc`.
//
// The hospital-facing pages (/q, /optout), the questionnaire sent to hospitals and the emails to hospitals are NOT
// translated here: they are Spanish-first by design and keep their own es/en pairs (lib/questionnaire.ts).
//
// ---------- Glossary (EN → ES, Spain; use these everywhere, keep them consistent) ----------
// trial → ensayo (ensayo clínico) · site → centro · hospital → hospital · sponsor → promotor · CRO → CRO
// feasibility → viabilidad · feasibility questionnaire → cuestionario de viabilidad · principal investigator → investigador
// principal (IP) · ethics committee → CEIm · recruitment / recruiting → reclutamiento / en reclutamiento
// shortlist → preselección · shortlisted → preseleccionado · add to shortlist → preseleccionar
// fit score → puntuación de idoneidad · Strong / Good / Possible / Weak fit → Muy adecuado / Adecuado / A valorar /
// Poco adecuado · condition / indication → indicación · therapeutic area → área terapéutica · phase → fase
// registered trials → ensayos registrados · registry → registro · equipment → equipamiento · beds → camas
// national hospital catalogue → Catálogo Nacional de Hospitales · first visits → primeras consultas
// project → proyecto · questionnaire → cuestionario · kept-out terms → términos excluidos (never sent to hospitals)
// competing trials → ensayos competidores · completion → finalización · Insights plan → plan Insights
// Free plan → plan gratuito · log in / sign up / log out → iniciar sesión / crear cuenta / cerrar sesión
// Register: "tú" (as the patient portal), plain and direct; numbers and dates in es-ES / en-GB.

import type { Ownership, PhaseOption, Population } from "@/lib/types";

export type Lang = "en" | "es";
/** The same technical cookie as the patient portal (lib/patients/i18n.ts LANG_COOKIE), so the choice carries across. */
export const LANG_COOKIE = "lang";
export function isLang(v: unknown): v is Lang {
  return v === "es" || v === "en";
}

/** Professional-side default when there is no "lang" cookie and the browser does not prefer Spanish. */
export const PRO_DEFAULT_LANG: Lang = "en";

/** Primary language the browser prefers among es / en (highest q wins; ties keep header order). */
export function preferredFromAcceptLanguage(header: string | null | undefined): Lang | null {
  if (!header) return null;
  let best: { lang: Lang; q: number } | null = null;
  for (const part of header.split(",")) {
    const [tag, ...params] = part.trim().split(";");
    const primary = tag.trim().toLowerCase().split("-")[0];
    if (primary !== "es" && primary !== "en") continue;
    const qp = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
    const q = qp ? Number(qp.slice(2)) : 1;
    if (!Number.isFinite(q) || q <= 0) continue;
    if (!best || q > best.q) best = { lang: primary, q };
  }
  return best?.lang ?? null;
}


export function locale(lang: Lang): string {
  return lang === "es" ? "es-ES" : "en-GB";
}

/** 1234 → "1,234" / "1234" (es-ES groups from 10 000: "12.345"). */
export function fmtNum(n: number, lang: Lang, opts?: Intl.NumberFormatOptions): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString(locale(lang), { maximumFractionDigits: 1, ...opts });
}

/** Percentage of a 0..1 ratio: "42%" / "42 %". */
export function fmtPct(ratio: number, lang: Lang): string {
  return new Intl.NumberFormat(locale(lang), { style: "percent", maximumFractionDigits: 0 }).format(ratio);
}

/** "5 Oct 2026" / "5 oct 2026" (or long month with { month: "long" }). Accepts yyyy-mm-dd or ISO; Madrid time. */
export function fmtDate(iso: string | Date | null | undefined, lang: Lang, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!iso) return "";
  const d = iso instanceof Date ? iso : new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat(locale(lang), { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Madrid", ...opts }).format(d);
}

/** Count + noun with the right plural: plural(3, "ensayo", "ensayos", "es") → "3 ensayos". `other` defaults to one + "s". */
export function plural(n: number, one: string, other: string | undefined, lang: Lang): string {
  return `${fmtNum(n, lang)} ${n === 1 ? one : (other ?? `${one}s`)}`;
}

/** 1 → "1st" / "1.º" */
export function ordinal(n: number, lang: Lang): string {
  if (lang === "es") return `${n}.º`;
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** Joins a list: ["a","b","c"] → "a, b and c" / "a, b y c" (or "or" / "o"). */
export function joinList(items: string[], lang: Lang, word: "and" | "or" = "and"): string {
  const w = word === "and" ? (lang === "es" ? "y" : "and") : lang === "es" ? "o" : "or";
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${w} ${items[items.length - 1]}`;
}

/** Fills {name} placeholders. */
export function fill(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

// ---------- shared labels (criteria, bands) ----------

const AREAS_EN: Record<string, string> = {
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
const AREAS_ES: Record<string, string> = {
  oncology: "Oncología",
  hematology: "Hematología",
  cardiovascular: "Cardiovascular",
  neurology: "Neurología",
  psychiatry: "Psiquiatría",
  infectious: "Enfermedades infecciosas",
  respiratory: "Neumología",
  gastro_hepatology: "Aparato digestivo y hepatología",
  endocrine_metabolic: "Endocrinología y metabolismo",
  immunology_rheumatology: "Inmunología y reumatología",
  dermatology: "Dermatología",
  nephrology_urology: "Nefrología y urología",
  womens_health: "Salud de la mujer",
  ophthalmology: "Oftalmología",
  rare_genetic: "Enfermedades raras y genéticas",
};
const EQUIPMENT_EN: Record<string, string> = {
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
const EQUIPMENT_ES_UI: Record<string, string> = {
  ct: "TAC",
  mri: "Resonancia magnética",
  pet: "PET",
  spect: "SPECT",
  gamma_camera: "Gammacámara",
  cath_lab: "Sala de hemodinámica",
  angiography: "Angiografía digital",
  linac: "Acelerador lineal (radioterapia)",
  mammography: "Mamógrafo",
  densitometry: "Densitómetro óseo",
  dialysis: "Diálisis",
  lithotripsy: "Litotricia",
};

const labelsEn = {
  phases: { PHASE1: "Phase I", PHASE1_2: "Phase I/II", PHASE2: "Phase II", PHASE2_3: "Phase II/III", PHASE3: "Phase III", PHASE4: "Phase IV" } as Record<PhaseOption, string>,
  populations: { adult: "Adults", pediatric: "Paediatric", all: "All ages" } as Record<Population, string>,
  ownership: { any: "All", public: "Public", private: "Private" } as Record<Ownership, string>,
  /** Lower-case, for running text ("public hospitals only"). */
  ownershipLower: { any: "all", public: "public", private: "private" } as Record<Ownership, string>,
  areas: AREAS_EN,
  equipment: EQUIPMENT_EN,
  /** Fit bands (score-explain BANDS keys). Same four everywhere: cards, explainer, legend, methodology page. */
  bands: {
    strong: { label: "Strong fit", meaning: "Proven in this condition and phase, with little competition." },
    good: { label: "Good fit", meaning: "Solid experience with some gaps." },
    possible: { label: "Possible fit", meaning: "Check the gaps before shortlisting." },
    weak: { label: "Weak fit", meaning: "Little relevant public track record." },
  },
  impact: { High: "High", Medium: "Medium", Lower: "Lower" },
};

const labelsEs: typeof labelsEn = {
  phases: { PHASE1: "Fase I", PHASE1_2: "Fase I/II", PHASE2: "Fase II", PHASE2_3: "Fase II/III", PHASE3: "Fase III", PHASE4: "Fase IV" },
  populations: { adult: "Adultos", pediatric: "Pediátricos", all: "Todas las edades" },
  ownership: { any: "Todos", public: "Públicos", private: "Privados" },
  ownershipLower: { any: "todos", public: "públicos", private: "privados" },
  areas: AREAS_ES,
  equipment: EQUIPMENT_ES_UI,
  bands: {
    strong: { label: "Muy adecuado", meaning: "Experiencia probada en esta indicación y fase, con poca competencia." },
    good: { label: "Adecuado", meaning: "Experiencia sólida, con algunas lagunas." },
    possible: { label: "A valorar", meaning: "Revisa las lagunas antes de preseleccionarlo." },
    weak: { label: "Poco adecuado", meaning: "Poca trayectoria pública relevante." },
  },
  impact: { High: "Alto", Medium: "Medio", Lower: "Menor" },
};

export const LABELS: Record<Lang, typeof labelsEn> = { en: labelsEn, es: labelsEs };

// ---------- shell: header, menu, footer, generic words ----------

const commonEn = {
  skipToContent: "Skip to content",
  homeAria: "Solera home",
  navMain: "Main",
  navFindSites: "Find sites",
  navProjects: "My projects",
  navPatients: "For patients",
  menu: "Menu",
  planInsights: "Insights plan",
  planFree: "Free plan",
  logIn: "Log in",
  signUpFree: "Sign up free",
  logOut: "Log out",
  hospitalBar: "Cuestionario de viabilidad · confidencial",
  langGroup: "Language",
  footerAbout: "Clinical-trial site feasibility for Madrid. Facts come from public sources and are confirmed by hospitals; scores are indicative.",
  footerTerms: "Terms",
  footerHow: "How scoring works",
  footerSources: "Data sources",
  footerNoPersonal: "No personal data stored",
  footerCredits: "Data sources & credits",
  footerEma:
    "Contains information from the EU Clinical Trials Information System (CTIS), © European Medicines Agency; EMA is not responsible for this service or any analysis derived from its data. Registry data are reproduced as published and may be incomplete or out of date.",
  sourceNotes: {
    ema: "© European Medicines Agency",
    nlm: "U.S. National Library of Medicine",
    msan: "Ministerio de Sanidad",
    isciii: "ISCIII",
    cam: "Comunidad de Madrid",
    photos: "hospital photos; author & licence on each photo",
    osm: "© OpenStreetMap contributors (ODbL)",
  },
  metaTitle: "Solera · Clinical trial site feasibility, Madrid",
  metaDescription: "Find and qualify clinical trial sites in Madrid using public data, then run feasibility questionnaires in one place.",
  notFoundTitle: "Page not found",
  notFoundBody: "The page you are looking for does not exist or has moved.",
  notFoundHome: "Back to site search",
  // generic words
  close: "Close",
  cancel: "Cancel",
  save: "Save",
  saving: "Saving…",
  edit: "Edit",
  remove: "Remove",
  back: "Back",
  yes: "Yes",
  no: "No",
  loading: "Loading…",
  opensNewTab: "(opens in a new tab)",
  somethingWrong: "Something went wrong. Please try again.",
  notFound: "Not found",
};

const commonEs: typeof commonEn = {
  skipToContent: "Saltar al contenido",
  homeAria: "Solera inicio",
  navMain: "Principal",
  navFindSites: "Buscar centros",
  navProjects: "Mis proyectos",
  navPatients: "Para pacientes",
  menu: "Menú",
  planInsights: "Plan Insights",
  planFree: "Plan gratuito",
  logIn: "Iniciar sesión",
  signUpFree: "Crear cuenta gratis",
  logOut: "Cerrar sesión",
  hospitalBar: "Cuestionario de viabilidad · confidencial",
  langGroup: "Idioma",
  footerAbout:
    "Viabilidad de centros para ensayos clínicos en Madrid. Los datos proceden de fuentes públicas y los confirman los hospitales; las puntuaciones son orientativas.",
  footerTerms: "Condiciones",
  footerHow: "Cómo puntuamos",
  footerSources: "Fuentes de datos",
  footerNoPersonal: "No guardamos datos personales",
  footerCredits: "Fuentes de datos y créditos",
  footerEma:
    "Contiene información del Sistema de Información de Ensayos Clínicos de la UE (CTIS), © Agencia Europea de Medicamentos; la EMA no es responsable de este servicio ni de los análisis derivados de sus datos. Los datos de los registros se reproducen tal como se publican y pueden estar incompletos o desactualizados.",
  sourceNotes: {
    ema: "© Agencia Europea de Medicamentos",
    nlm: "Biblioteca Nacional de Medicina de EE. UU.",
    msan: "Ministerio de Sanidad",
    isciii: "ISCIII",
    cam: "Comunidad de Madrid",
    photos: "fotos de hospitales; autor y licencia en cada foto",
    osm: "© colaboradores de OpenStreetMap (ODbL)",
  },
  metaTitle: "Solera · Viabilidad de centros para ensayos clínicos en Madrid",
  metaDescription:
    "Encuentra y evalúa centros para ensayos clínicos en Madrid con datos públicos y gestiona los cuestionarios de viabilidad en un solo lugar.",
  notFoundTitle: "Página no encontrada",
  notFoundBody: "La página que buscas no existe o ha cambiado de dirección.",
  notFoundHome: "Volver a la búsqueda de centros",
  close: "Cerrar",
  cancel: "Cancelar",
  save: "Guardar",
  saving: "Guardando…",
  edit: "Editar",
  remove: "Quitar",
  back: "Volver",
  yes: "Sí",
  no: "No",
  loading: "Cargando…",
  opensNewTab: "(se abre en una pestaña nueva)",
  somethingWrong: "Algo ha fallado. Inténtalo de nuevo.",
  notFound: "No encontrado",
};

export const COMMON: Record<Lang, typeof commonEn> = { en: commonEn, es: commonEs };
export type CommonDict = typeof commonEn;
export type Labels = typeof labelsEn;

/** Accessible names of the ES | EN buttons, each in its own language (shared with the patient portal). */
export const LANG_TOGGLE_LABELS = { es: "Ver en español", en: "View in English" } as const;
