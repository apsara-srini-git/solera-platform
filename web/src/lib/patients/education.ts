// Generic patient education for the patient portal (/pacientes/aprende and /pacientes/sobre).
//
// Rules this content follows:
// - GENERIC only. Nothing here describes a specific trial. Trial pages show registry text verbatim.
// - Every factual statement is supported by a source listed in the same section. Sources were opened and read
//   on EDUCATION_SOURCES_CHECKED_AT. Legal statements cite the article they come from.
// - Plain Spanish (short sentences, everyday words), with an English version of every string.
// - Neutral wording: passes findBannedTerms() in ./wording.ts (no promotion, no inducements, no eligibility claims).
//   Rights that involve money (insurance, costs) are stated as legal obligations, never as reasons to take part.
//
// Client-safe: no server imports.

import type { Lang } from "./types";

export type Localized = Record<Lang, string>;

export interface EducationSource {
  label: string;
  url: string;
  publisher: string;
}

export type EducationBlock =
  | { type: "p"; text: Localized }
  | { type: "list"; title?: Localized; ordered?: boolean; items: Localized[] }
  | { type: "note"; text: Localized }
  | { type: "definitions"; items: { id: string; term: Localized; definition: Localized }[] };

export interface EducationSection {
  /** Stable id, usable as URL anchor (/pacientes/aprende#fases). */
  id: string;
  title: Localized;
  /** One or two sentences for an index card. */
  summary: Localized;
  blocks: EducationBlock[];
  sources: EducationSource[];
  /** True when the section is designed to be printed on its own (e.g. the question list). */
  printable?: boolean;
}

/** Date the sources below were opened and checked. */
export const EDUCATION_SOURCES_CHECKED_AT = "2026-10-05";

/** Email for error reports. Null until Solera sets up a mailbox: the UI must hide the "report an error" line. */
export const REPORT_EMAIL: string | null = null;

const L = (es: string, en: string): Localized => ({ es, en });
const p = (es: string, en: string): EducationBlock => ({ type: "p", text: L(es, en) });
const note = (es: string, en: string): EducationBlock => ({ type: "note", text: L(es, en) });
const list = (items: Localized[], opts: { title?: Localized; ordered?: boolean } = {}): EducationBlock => ({
  type: "list",
  items,
  ...opts,
});

// ---------------------------------------------------------------------------------------------------------------
// Sources (all opened and read on EDUCATION_SOURCES_CHECKED_AT)
// ---------------------------------------------------------------------------------------------------------------

const BOE_RD = "https://www.boe.es/buscar/act.php?id=BOE-A-2015-14082";
const rd = (arts: string, anchor: string): EducationSource => ({
  label: `Real Decreto 1090/2015, de ensayos clínicos con medicamentos (${arts})`,
  url: `${BOE_RD}#${anchor}`,
  publisher: "Boletín Oficial del Estado (BOE)",
});
const reg = (arts: string): EducationSource => ({
  label: `Reglamento (UE) n.º 536/2014 sobre los ensayos clínicos de medicamentos de uso humano (${arts})`,
  url: "https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32014R0536",
  publisher: "Diario Oficial de la Unión Europea (EUR-Lex)",
});

const SRC = {
  helsinki: {
    label: "Declaración de Helsinki (versión de octubre de 2024), párrafos 25, 26 y 33",
    url: "https://www.wma.net/policies-post/wma-declaration-of-helsinki/",
    publisher: "Asociación Médica Mundial (WMA)",
  },
  ctgLearn: {
    label: "Learn About Studies",
    url: "https://clinicaltrials.gov/study-basics/learn-about-studies",
    publisher: "ClinicalTrials.gov, National Library of Medicine (NIH, EE. UU.)",
  },
  ctgGlossary: {
    label: "ClinicalTrials.gov Glossary",
    url: "https://clinicaltrials.gov/study-basics/glossary",
    publisher: "ClinicalTrials.gov, National Library of Medicine (NIH, EE. UU.)",
  },
  ctgDisclaimer: {
    label: "Disclaimer",
    url: "https://clinicaltrials.gov/about-site/disclaimer",
    publisher: "ClinicalTrials.gov, National Library of Medicine (NIH, EE. UU.)",
  },
  ctgTerms: {
    label: "Terms and Conditions",
    url: "https://clinicaltrials.gov/about-site/terms-conditions",
    publisher: "ClinicalTrials.gov, National Library of Medicine (NIH, EE. UU.)",
  },
  nia: {
    label: "What Are Clinical Trials and Studies?",
    url: "https://www.nia.nih.gov/health/clinical-trials-and-studies/what-are-clinical-trials-and-studies",
    publisher: "National Institute on Aging (NIH, EE. UU.)",
  },
  eupatiDesarrollo: {
    label: "Glosario: Desarrollo clínico",
    url: "https://toolbox.eupati.eu/glossary/desarrollo-clinico/?lang=es",
    publisher: "EUPATI (Academia Europea de Pacientes)",
  },
  eupatiFase2: {
    label: "Glosario: Ensayos de fase II",
    url: "https://toolbox.eupati.eu/glossary/ensayos-de-fase-ii/?lang=es",
    publisher: "EUPATI (Academia Europea de Pacientes)",
  },
  eupatiAleat: {
    label: "Glosario: Aleatorización",
    url: "https://toolbox.eupati.eu/glossary/aleatorizacion/?lang=es",
    publisher: "EUPATI (Academia Europea de Pacientes)",
  },
  eupatiDisenos: {
    label: "Diseños de ensayos clínicos",
    url: "https://toolbox.eupati.eu/resources/disenos-de-ensayos-clinicos/?lang=es",
    publisher: "EUPATI (Academia Europea de Pacientes)",
  },
  eupatiEnmasc: {
    label: "Concepto de enmascaramiento en los ensayos clínicos",
    url: "https://toolbox.eupati.eu/resources/concepto-de-enmascaramiento-en-los-ensayos-clinicos/?lang=es",
    publisher: "EUPATI (Academia Europea de Pacientes)",
  },
  reec: {
    label: "Registro Español de Estudios Clínicos (REec): presentación",
    url: "https://reec.aemps.es/reec/public/web.html",
    publisher: "Agencia Española de Medicamentos y Productos Sanitarios (AEMPS)",
  },
  aempsInstrucciones: {
    label: "Documento de instrucciones de la AEMPS para la realización de ensayos clínicos en España (v19, nov. 2023), apdo. 8.4",
    url: "https://www.aemps.gob.es/investigacionClinica/medicamentos/docs/Documento-Instrucciones.pdf",
    publisher: "Agencia Española de Medicamentos y Productos Sanitarios (AEMPS)",
  },
  aempsAviso: {
    label: "Aviso legal (propiedad intelectual y reproducción de contenidos)",
    url: "https://www.aemps.gob.es/aviso-legal/",
    publisher: "Agencia Española de Medicamentos y Productos Sanitarios (AEMPS)",
  },
  emaCtis: {
    label: "Clinical Trials Information System (CTIS)",
    url: "https://www.ema.europa.eu/en/human-regulatory-overview/research-development/clinical-trials-human-medicines/clinical-trials-information-system",
    publisher: "Agencia Europea de Medicamentos (EMA)",
  },
  emaCtr: {
    label: "Clinical Trials Regulation",
    url: "https://www.ema.europa.eu/en/human-regulatory-overview/research-development/clinical-trials-human-medicines/clinical-trials-regulation",
    publisher: "Agencia Europea de Medicamentos (EMA)",
  },
  euctAbout: {
    label: "About this website (CTIS public website)",
    url: "https://euclinicaltrials.eu/about-this-website/",
    publisher: "Agencia Europea de Medicamentos (EMA)",
  },
  emaLegal: {
    label: "Legal notice (copyright and limited reproduction notices)",
    url: "https://www.ema.europa.eu/en/about-us/legal-notice",
    publisher: "Agencia Europea de Medicamentos (EMA)",
  },
  sanidadCnh: {
    label: "Catálogo Nacional de Hospitales (búsqueda y descarga)",
    url: "https://www.sanidad.gob.es/ciudadanos/centros.do",
    publisher: "Ministerio de Sanidad",
  },
  sanidadAviso: {
    label: "Aviso legal (reutilización de la información)",
    url: "https://www.sanidad.gob.es/avisoLegal/home.htm",
    publisher: "Ministerio de Sanidad",
  },
  madridDatos: {
    label: "Centros, servicios y establecimientos sanitarios (datos abiertos, licencia Creative Commons Attribution)",
    url: "https://datos.comunidad.madrid/catalogo/dataset/centros_servicios_establecimientos_sanitarios",
    publisher: "Comunidad de Madrid",
  },
  osm: {
    label: "Derechos de autor y licencia (ODbL)",
    url: "https://www.openstreetmap.org/copyright/es",
    publisher: "OpenStreetMap",
  },
  orphanet: {
    label: "Acerca de las enfermedades raras",
    url: "https://www.orpha.net/es/other-information/about-rare-diseases",
    publisher: "Orphanet (INSERM)",
  },
} satisfies Record<string, EducationSource>;

// ---------------------------------------------------------------------------------------------------------------
// Short texts reused across the portal
// ---------------------------------------------------------------------------------------------------------------

/** Short neutrality statement for EVERY trial page. The full version is ABOUT_SECTIONS. */
export const TRIAL_PAGE_DISCLAIMER: Localized = L(
  "Ningún promotor ni hospital paga a Solera por esta ficha ni por su posición en la lista. Solera no busca participantes y no es promotor de este ensayo. Esta página copia información de un registro público. No es consejo médico: habla con tu médico.",
  "No sponsor or hospital pays Solera for this page or for its position in the list. Solera does not look for participants and is not the sponsor of this trial. This page copies information from a public registry. It is not medical advice: talk to your doctor.",
);

/** The next step shown to patients, everywhere. */
export const NEXT_STEP: { title: Localized; steps: Localized[] } = {
  title: L("¿Y ahora qué?", "What next?"),
  steps: [
    L("Habla con tu médico o con tu especialista. Es quien conoce tu salud.", "Talk to your doctor or specialist. They know your health."),
    L("Apunta el número de registro del ensayo (por ejemplo, NCT seguido de 8 cifras) y llévalo a la consulta.", "Write down the trial's registry number (for example NCT followed by 8 digits) and take it to your appointment."),
    L("Los datos de contacto oficiales del estudio están en la página del registro. Usa el enlace al registro.", "The study's official contact details are on the registry page. Use the link to the registry."),
  ],
};

// ---------------------------------------------------------------------------------------------------------------
// Phases: one-liners for cards
// ---------------------------------------------------------------------------------------------------------------

export type PhaseKey = "EARLY_PHASE1" | "PHASE1" | "PHASE2" | "PHASE3" | "PHASE4" | "NA";

const PHASE_NAME: Record<PhaseKey, Localized> = {
  EARLY_PHASE1: L("fase I temprana", "early phase I"),
  PHASE1: L("fase I", "phase I"),
  PHASE2: L("fase II", "phase II"),
  PHASE3: L("fase III", "phase III"),
  PHASE4: L("fase IV", "phase IV"),
  NA: L("sin fase", "no phase"),
};

/** One plain line per phase, generic to every study of that phase. Sources: SECTION "fases". */
export const PHASE_ONE_LINERS: Record<PhaseKey | "PHASE1_2" | "PHASE2_3", Localized> = {
  EARLY_PHASE1: L(
    "Estudio muy temprano, con muy pocas personas, para ver cómo actúa una sustancia en el cuerpo.",
    "A very early study in very few people, to see how a substance acts in the body.",
  ),
  PHASE1: L(
    "Estudia sobre todo la seguridad y la dosis, en un grupo pequeño de personas.",
    "Mainly studies safety and dose, in a small group of people.",
  ),
  PHASE1_2: L(
    "Une las fases I y II: estudia la seguridad y la dosis, y recoge primeros datos sobre si funciona.",
    "Combines phases I and II: studies safety and dose, and collects first data on whether it works.",
  ),
  PHASE2: L(
    "Recoge primeros datos sobre si funciona en personas con la enfermedad y sigue estudiando la seguridad.",
    "Collects first data on whether it works in people with the condition, and keeps studying safety.",
  ),
  PHASE2_3: L(
    "Une las fases II y III en un solo estudio.",
    "Combines phases II and III in one study.",
  ),
  PHASE3: L(
    "Estudia la seguridad y si funciona en más personas, y lo compara con otros tratamientos.",
    "Studies safety and whether it works in more people, and compares it with other treatments.",
  ),
  PHASE4: L(
    "Se hace cuando el medicamento ya está autorizado, para seguir su seguridad y su uso.",
    "Done once the medicine is already authorised, to keep following its safety and use.",
  ),
  NA: L(
    "Estudio sin fases, por ejemplo de un dispositivo o de un cambio de hábitos.",
    "A study without phases, for example of a device or a change in habits.",
  ),
};

const PHASE_ORDER: PhaseKey[] = ["EARLY_PHASE1", "PHASE1", "PHASE2", "PHASE3", "PHASE4", "NA"];

/**
 * One-line explanation for a trial's registry phases, e.g. ["PHASE1","PHASE2"] → the "fase I/II" line.
 * Unknown values are ignored; returns null when nothing is known.
 */
export function phaseOneLiner(phases: readonly string[], lang: Lang): string | null {
  const keys = PHASE_ORDER.filter((k) => phases.includes(k));
  if (keys.length === 0) return null;
  if (keys.length === 1) return PHASE_ONE_LINERS[keys[0]][lang];
  if (keys.length === 2 && keys[0] === "PHASE1" && keys[1] === "PHASE2") return PHASE_ONE_LINERS.PHASE1_2[lang];
  if (keys.length === 2 && keys[0] === "PHASE2" && keys[1] === "PHASE3") return PHASE_ONE_LINERS.PHASE2_3[lang];
  const names = keys.map((k) => PHASE_NAME[k][lang]);
  const joined = names.slice(0, -1).join(", ") + (lang === "es" ? " y " : " and ") + names[names.length - 1];
  return lang === "es" ? `Une ${joined} en un solo estudio.` : `Combines ${joined} in one study.`;
}

// ---------------------------------------------------------------------------------------------------------------
// Glossary
// ---------------------------------------------------------------------------------------------------------------

export interface GlossaryTerm {
  id: string;
  term: Localized;
  definition: Localized;
  sources: EducationSource[];
}

export const GLOSSARY: GlossaryTerm[] = [
  {
    id: "ensayo-clinico",
    term: L("Ensayo clínico", "Clinical trial"),
    definition: L(
      "Estudio de investigación con personas en el que el equipo asigna a cada participante un tratamiento o una prueba según un plan escrito, para estudiar su seguridad o si funciona.",
      "A research study in people where the team assigns each participant a treatment or test according to a written plan, to study its safety or whether it works.",
    ),
    sources: [rd("art. 2.1.i", "a2"), SRC.euctAbout, SRC.ctgLearn],
  },
  {
    id: "estudio-observacional",
    term: L("Estudio observacional", "Observational study"),
    definition: L(
      "Estudio en el que solo se recogen datos. El equipo no asigna ningún tratamiento. Este portal no muestra estudios observacionales.",
      "A study that only collects data. The team does not assign any treatment. This portal does not show observational studies.",
    ),
    sources: [SRC.ctgLearn, reg("art. 2.2.4")],
  },
  {
    id: "protocolo",
    term: L("Protocolo", "Protocol"),
    definition: L(
      "Documento que describe los objetivos, el diseño y la organización de un ensayo. Es el plan que sigue el equipo.",
      "The document that describes a trial's aims, design and organisation. It is the plan the team follows.",
    ),
    sources: [rd("art. 2.1.x", "a2")],
  },
  {
    id: "promotor",
    term: L("Promotor", "Sponsor"),
    definition: L(
      "Persona, empresa, institución u organización que inicia el ensayo, lo gestiona y organiza su financiación. Puede ser una empresa farmacéutica, un hospital, una universidad o un grupo de investigación.",
      "The person, company, institution or organisation that starts the trial, manages it and organises its funding. It can be a pharmaceutical company, a hospital, a university or a research group.",
    ),
    sources: [rd("arts. 2.1.s y 2.2.e", "a2"), SRC.ctgLearn],
  },
  {
    id: "centro",
    term: L("Centro", "Site"),
    definition: L(
      "Lugar donde se hace el ensayo, normalmente un hospital. Un ensayo puede tener muchos centros en varios países.",
      "A place where the trial takes place, usually a hospital. One trial can have many sites in several countries.",
    ),
    sources: [SRC.ctgGlossary, SRC.ctgLearn],
  },
  {
    id: "investigador-principal",
    term: L("Investigador principal", "Principal investigator"),
    definition: L(
      "Persona que dirige el equipo del ensayo en un centro. Este portal no muestra nombres de investigadores.",
      "The person who leads the trial team at a site. This portal does not show investigators' names.",
    ),
    sources: [rd("art. 2.1.u", "a2")],
  },
  {
    id: "ceim",
    term: L("CEIm", "CEIm (research ethics committee)"),
    definition: L(
      "Comité de Ética de la Investigación con medicamentos. Es un comité independiente que revisa si un ensayo es correcto desde el punto de vista ético, metodológico y legal. Sin su visto bueno (dictamen favorable), el ensayo no puede empezar en España.",
      "Research Ethics Committee for medicines. An independent committee that checks whether a trial is ethically, methodologically and legally sound. Without its favourable opinion, the trial cannot start in Spain.",
    ),
    sources: [rd("arts. 2.2.b, 12 y 17", "a12")],
  },
  {
    id: "aemps",
    term: L("AEMPS", "AEMPS"),
    definition: L(
      "Agencia Española de Medicamentos y Productos Sanitarios. Autoriza los ensayos clínicos con medicamentos en España y mantiene el registro REec.",
      "Spanish Agency of Medicines and Medical Devices. It authorises clinical trials of medicines in Spain and runs the REec registry.",
    ),
    sources: [rd("arts. 17 y 47", "a17")],
  },
  {
    id: "reec",
    term: L("REec", "REec"),
    definition: L(
      "Registro Español de Estudios Clínicos. Base de datos pública de la AEMPS con los ensayos con medicamentos autorizados en España. Incluye la lista de centros y su estado.",
      "Spanish Clinical Studies Registry. A public AEMPS database of the medicine trials authorised in Spain. It includes the list of sites and their status.",
    ),
    sources: [SRC.reec, rd("arts. 47 y 48", "a47")],
  },
  {
    id: "ctis",
    term: L("CTIS", "CTIS"),
    definition: L(
      "Sistema de Información de Ensayos Clínicos de la Unión Europea. Los promotores lo usan para pedir la autorización de un ensayo en uno o varios países europeos. Tiene una web pública donde cualquiera puede buscar ensayos.",
      "The European Union's Clinical Trials Information System. Sponsors use it to apply for authorisation of a trial in one or more European countries. It has a public website where anyone can search for trials.",
    ),
    sources: [SRC.emaCtis, SRC.euctAbout],
  },
  {
    id: "clinicaltrials-gov",
    term: L("ClinicalTrials.gov", "ClinicalTrials.gov"),
    definition: L(
      "Registro público de estudios de la Biblioteca Nacional de Medicina de EE. UU. Incluye estudios de muchos países. La información la envían los promotores o investigadores; la Biblioteca solo revisa errores aparentes.",
      "A public study registry run by the US National Library of Medicine. It includes studies from many countries. Sponsors or investigators submit the information; the Library only checks for apparent errors.",
    ),
    sources: [SRC.ctgDisclaimer, SRC.ctgTerms],
  },
  {
    id: "numero-registro",
    term: L("Número de registro", "Registry number"),
    definition: L(
      "Código único de un ensayo en un registro. En ClinicalTrials.gov empieza por NCT y tiene 8 cifras. En la Unión Europea cada ensayo tiene un número UE de ensayo.",
      "A trial's unique code in a registry. In ClinicalTrials.gov it starts with NCT followed by 8 digits. In the European Union each trial has an EU trial number.",
    ),
    sources: [SRC.ctgGlossary, reg("art. 81.1")],
  },
  {
    id: "criterios-inclusion",
    term: L("Criterios de inclusión", "Inclusion criteria"),
    definition: L(
      "Lista de requisitos que debe cumplir una persona para entrar en un estudio, por ejemplo edad, enfermedad o tratamientos previos.",
      "The list of requirements a person must meet to take part in a study, for example age, condition or previous treatments.",
    ),
    sources: [SRC.ctgGlossary, SRC.ctgLearn],
  },
  {
    id: "criterios-exclusion",
    term: L("Criterios de exclusión", "Exclusion criteria"),
    definition: L(
      "Lista de motivos por los que una persona no puede entrar en un estudio. Sirven, entre otras cosas, para proteger la seguridad de los participantes.",
      "The list of reasons why a person cannot take part in a study. Among other things, they protect participants' safety.",
    ),
    sources: [SRC.ctgGlossary, SRC.ctgLearn],
  },
  {
    id: "voluntario-sano",
    term: L("Voluntario sano", "Healthy volunteer"),
    definition: L(
      "Persona que no tiene la enfermedad que se estudia. Algunos estudios aceptan voluntarios sanos y otros no; el registro lo indica.",
      "A person who does not have the condition being studied. Some studies accept healthy volunteers and others do not; the registry says which.",
    ),
    sources: [SRC.ctgGlossary],
  },
  {
    id: "enfermedad-rara",
    term: L("Enfermedad rara", "Rare disease"),
    definition: L(
      "En Europa, enfermedad que afecta como mucho a 1 de cada 2.000 personas. No hay una definición única en todo el mundo.",
      "In Europe, a disease that affects no more than 1 in 2,000 people. There is no single worldwide definition.",
    ),
    sources: [SRC.orphanet],
  },
  {
    id: "fase",
    term: L("Fase", "Phase"),
    definition: L(
      "Etapa de la investigación de un medicamento (I, II, III o IV). Cada fase responde a una pregunta distinta. Los estudios de dispositivos o de hábitos no suelen tener fase.",
      "A stage in researching a medicine (I, II, III or IV). Each phase answers a different question. Studies of devices or habits usually have no phase.",
    ),
    sources: [SRC.ctgGlossary, SRC.eupatiDesarrollo],
  },
  {
    id: "aleatorizado",
    term: L("Aleatorizado", "Randomised"),
    definition: L(
      "Ensayo en el que se reparte a los participantes en grupos al azar, como al tirar una moneda. Ni tú ni tu médico elegís el grupo.",
      "A trial in which participants are split into groups by chance, like tossing a coin. Neither you nor your doctor chooses the group.",
    ),
    sources: [SRC.eupatiAleat, SRC.ctgLearn],
  },
  {
    id: "placebo",
    term: L("Placebo", "Placebo"),
    definition: L(
      "Algo que tiene el mismo aspecto y se da de la misma forma que el tratamiento que se estudia, pero no contiene medicamento.",
      "Something that looks the same and is given the same way as the treatment being studied, but contains no medicine.",
    ),
    sources: [SRC.ctgGlossary, SRC.ctgLearn],
  },
  {
    id: "ciego-simple",
    term: L("Ciego simple (enmascaramiento simple)", "Single-blind"),
    definition: L(
      "Solo los participantes no saben qué tratamiento reciben.",
      "Only the participants do not know which treatment they receive.",
    ),
    sources: [SRC.eupatiEnmasc],
  },
  {
    id: "doble-ciego",
    term: L("Doble ciego (enmascaramiento doble)", "Double-blind"),
    definition: L(
      "Ni los participantes ni el personal del estudio saben qué tratamiento recibe cada persona. Sirve para que los resultados se valoren de forma justa.",
      "Neither the participants nor the study staff know which treatment each person receives. It helps the results to be judged fairly.",
    ),
    sources: [SRC.eupatiEnmasc, SRC.ctgLearn],
  },
  {
    id: "abierto",
    term: L("Ensayo abierto", "Open-label trial"),
    definition: L(
      "Ensayo sin enmascaramiento: todos saben qué tratamiento recibe cada participante.",
      "A trial without blinding: everyone knows which treatment each participant receives.",
    ),
    sources: [SRC.eupatiEnmasc],
  },
  {
    id: "reclutando",
    term: L("Reclutando (buscando participantes)", "Recruiting"),
    definition: L(
      "Término de los registros: el estudio está incluyendo participantes en este momento. «Aún no recluta» quiere decir que todavía no ha empezado a incluir participantes. En este portal verás «Buscando participantes» y «Aún no ha empezado».",
      "Registry term: the study is currently taking in participants. \"Not yet recruiting\" means it has not started taking in participants yet. On this portal you will see \"Looking for participants\" and \"Not started yet\".",
    ),
    sources: [SRC.ctgGlossary],
  },
  {
    id: "consentimiento-informado",
    term: L("Consentimiento informado", "Informed consent"),
    definition: L(
      "Tu decisión libre y voluntaria de participar, después de recibir toda la información importante sobre el ensayo. Se da por escrito, con fecha y firma.",
      "Your voluntary decision to take part, made without pressure, after receiving all the important information about the trial. It is given in writing, dated and signed.",
    ),
    sources: [rd("art. 2.1.w", "a2"), reg("art. 29.1")],
  },
  {
    id: "acontecimiento-adverso",
    term: L("Acontecimiento adverso", "Adverse event"),
    definition: L(
      "Cualquier problema de salud que le ocurre a un participante durante el ensayo, tenga o no relación con el medicamento.",
      "Any health problem a participant has during the trial, whether or not it is related to the medicine.",
    ),
    sources: [rd("art. 2.1.ah", "a2"), SRC.ctgLearn],
  },
  {
    id: "practica-clinica-habitual",
    term: L("Práctica clínica habitual", "Usual clinical practice"),
    definition: L(
      "El tratamiento que se suele seguir para tratar, prevenir o diagnosticar una enfermedad fuera de un ensayo.",
      "The treatment normally used to treat, prevent or diagnose a condition outside a trial.",
    ),
    sources: [rd("art. 2.1.m", "a2")],
  },
  {
    id: "bajo-nivel-intervencion",
    term: L("Ensayo de bajo nivel de intervención", "Low-intervention trial"),
    definition: L(
      "Ensayo con medicamentos ya autorizados, usados como indica su autorización o según pruebas publicadas, y en el que las pruebas añadidas suponen un riesgo mínimo comparado con la práctica habitual.",
      "A trial of already authorised medicines, used as their authorisation says or according to published evidence, where any extra tests add minimal risk compared with usual practice.",
    ),
    sources: [rd("art. 2.1.j", "a2"), reg("art. 2.2.3")],
  },
];

// ---------------------------------------------------------------------------------------------------------------
// Questions to ask the study team (printable)
// ---------------------------------------------------------------------------------------------------------------

export const QUESTIONS_FOR_STUDY_TEAM: Localized[] = [
  L("¿Qué quiere averiguar este estudio?", "What is this study trying to find out?"),
  L(
    "¿Qué pruebas o tratamientos tendré? ¿Son molestos? ¿Me darán los resultados de mis pruebas?",
    "What tests or treatments will I have? Are they unpleasant? Will I get my test results?",
  ),
  L(
    "¿Hay varios grupos? ¿Qué probabilidad tengo de estar en cada uno? ¿Se usa placebo?",
    "Are there several groups? What are the chances I will be in each one? Is a placebo used?",
  ),
  L(
    "¿Qué riesgos y efectos secundarios puede haber, comparado con mi tratamiento actual?",
    "What risks and side effects could there be, compared with my current treatment?",
  ),
  L("¿Qué otras opciones tengo si no participo?", "What other options do I have if I do not take part?"),
  L(
    "¿Cuánto dura el estudio? ¿Cuántas visitas tendré? ¿Tendré que quedarme ingresado?",
    "How long does the study last? How many visits will I have? Will I need to stay in hospital?",
  ),
  L(
    "¿Cómo cambiará mi vida diaria? ¿Puedo seguir tomando mis medicamentos de siempre?",
    "How will it change my daily life? Can I keep taking my usual medicines?",
  ),
  L(
    "¿Quién se encarga de mi atención durante el estudio? ¿Qué pasa si empeoro?",
    "Who is in charge of my care during the study? What happens if I get worse?",
  ),
  L(
    "¿Qué pasa si decido dejar el estudio? ¿Qué atención recibiré después?",
    "What happens if I decide to leave the study? What care will I get afterwards?",
  ),
  L(
    "¿Cómo protegerán mi intimidad y mis datos?",
    "How will my privacy and my data be protected?",
  ),
  L(
    "¿Tendré algún gasto? ¿Qué cubre el seguro del ensayo?",
    "Will I have any expenses? What does the trial's insurance cover?",
  ),
  L(
    "¿Qué pasará cuando termine el estudio? ¿Cómo conoceré los resultados?",
    "What will happen when the study ends? How will I find out the results?",
  ),
  L(
    "¿A quién llamo si tengo dudas o un problema?",
    "Who do I call if I have questions or a problem?",
  ),
];

// ---------------------------------------------------------------------------------------------------------------
// Sections for /pacientes/aprende
// ---------------------------------------------------------------------------------------------------------------

export const EDUCATION_SECTIONS: EducationSection[] = [
  // 1 ------------------------------------------------------------------------------------------------------------
  {
    id: "que-es",
    title: L("¿Qué es un ensayo clínico?", "What is a clinical trial?"),
    summary: L(
      "Un estudio de investigación con personas para saber si un medicamento u otra intervención es seguro y si funciona.",
      "A research study in people to find out whether a medicine or other intervention is safe and whether it works.",
    ),
    blocks: [
      p(
        "Un ensayo clínico es un estudio de investigación con personas. Sirve para saber si un medicamento es seguro y si funciona. También hay ensayos de otras cosas, como dispositivos médicos o cambios de hábitos.",
        "A clinical trial is a research study in people. It is used to find out whether a medicine is safe and whether it works. There are also trials of other things, such as medical devices or changes in habits.",
      ),
      p(
        "En un ensayo, el equipo asigna a cada participante un tratamiento o unas pruebas según un plan escrito, llamado protocolo. Esto lo diferencia de un estudio observacional, en el que solo se recogen datos.",
        "In a trial, the team assigns each participant a treatment or tests according to a written plan, called the protocol. This is what makes it different from an observational study, which only collects data.",
      ),
      list(
        [
          L("Saber si un medicamento es seguro y qué efectos secundarios tiene.", "Find out whether a medicine is safe and what side effects it has."),
          L("Saber si funciona y en qué dosis.", "Find out whether it works and at what dose."),
          L("Compararlo con los tratamientos que ya se usan.", "Compare it with treatments already in use."),
          L("Buscar formas de prevenir o diagnosticar una enfermedad.", "Look for ways to prevent or diagnose a disease."),
        ],
        { title: L("¿Para qué se hacen?", "Why are they done?") },
      ),
      p(
        "Antes de que un medicamento se use de forma general, hacen falta datos fiables. Los ensayos clínicos son la forma principal de conseguirlos. Las normas europeas buscan proteger los derechos, la seguridad y el bienestar de los participantes, y que los resultados sean fiables.",
        "Before a medicine is used widely, reliable data are needed. Clinical trials are the main way to get them. European rules aim to protect participants' rights, safety and well-being, and to make results reliable.",
      ),
      p(
        "En los ensayos participan personas voluntarias. Algunas tienen la enfermedad que se estudia. Otras están sanas (voluntarios sanos).",
        "Trials are done with people who volunteer. Some have the condition being studied. Others are healthy (healthy volunteers).",
      ),
      note(
        "Un ensayo es investigación: todavía no se sabe el resultado. El equipo no sabe de antemano si lo que se estudia será útil, perjudicial o igual que la atención habitual. Participar puede no mejorar tu salud.",
        "A trial is research: the result is not known yet. The team does not know in advance whether what is studied will be helpful, harmful or the same as usual care. Taking part may not improve your health.",
      ),
    ],
    sources: [SRC.euctAbout, SRC.ctgLearn, SRC.nia, rd("art. 2.1.i", "a2")],
  },

  // 2 ------------------------------------------------------------------------------------------------------------
  {
    id: "fases",
    title: L("Las fases de un ensayo", "Trial phases"),
    summary: L(
      "Los ensayos de medicamentos avanzan por fases (I, II, III y IV). Cada fase responde a una pregunta distinta.",
      "Medicine trials move through phases (I, II, III and IV). Each phase answers a different question.",
    ),
    blocks: [
      p(
        "Los ensayos de medicamentos se organizan en pasos llamados fases. Cada fase tiene un objetivo distinto. Así se intenta que el riesgo para los participantes sea el menor posible. A veces verás la fase escrita con números (fase 1, 2, 3, 4).",
        "Medicine trials are organised in steps called phases. Each phase has a different aim. This is done to keep the risk to participants as low as possible. You may see the phase written with numbers (phase 1, 2, 3, 4).",
      ),
      {
        type: "definitions",
        items: [
          {
            id: "fase-1",
            term: L("Fase I", "Phase I"),
            definition: L(
              "Estudia sobre todo la seguridad: qué efectos secundarios aparecen y qué dosis se puede usar. Participa un grupo pequeño de personas (en EE. UU., unas 20 a 80). Muchas veces son voluntarios sanos.",
              "Mainly studies safety: which side effects appear and which dose can be used. A small group of people takes part (in the US, about 20 to 80). They are often healthy volunteers.",
            ),
          },
          {
            id: "fase-2",
            term: L("Fase II", "Phase II"),
            definition: L(
              "Suele ser la primera vez que el medicamento se estudia en personas con la enfermedad. Busca primeros datos sobre si funciona y la dosis adecuada. Sigue estudiando la seguridad. A veces compara con otro tratamiento o con un placebo. Participan más personas (en EE. UU., unas 100 a 300).",
              "Is usually the first time the medicine is studied in people with the condition. It looks for first data on whether it works and the right dose. It keeps studying safety. Sometimes it compares with another treatment or with a placebo. More people take part (in the US, about 100 to 300).",
            ),
          },
          {
            id: "fase-3",
            term: L("Fase III", "Phase III"),
            definition: L(
              "Recoge más información sobre la seguridad y sobre si funciona, en grupos más grandes y variados (de varios cientos a unos miles de personas). Suele comparar con otros tratamientos. Sus resultados se usan a menudo para pedir la autorización del medicamento.",
              "Collects more information on safety and on whether it works, in larger and more varied groups (from several hundred to a few thousand people). It usually compares with other treatments. Its results are often used to apply for authorisation of the medicine.",
            ),
          },
          {
            id: "fase-4",
            term: L("Fase IV", "Phase IV"),
            definition: L(
              "Se hace cuando el medicamento ya está autorizado. Sigue su seguridad y su uso en muchas más personas y durante más tiempo. Algunos efectos secundarios solo se ven así.",
              "Done once the medicine is already authorised. It follows its safety and use in many more people and over a longer time. Some side effects only show up this way.",
            ),
          },
        ],
      },
      list(
        [
          L(
            "Fase I/II o fase II/III: algunos ensayos unen dos fases en un solo estudio. Tienen objetivos de las dos.",
            "Phase I/II or phase II/III: some trials combine two phases in one study. They have the aims of both.",
          ),
          L(
            "Fase I temprana (antes llamada fase 0): estudios muy pequeños y muy tempranos, antes de la fase I, para ver cómo actúa una sustancia en el cuerpo. No buscan tratar ni diagnosticar.",
            "Early phase I (formerly phase 0): very small, very early studies before phase I, to see how a substance acts in the body. They do not aim to treat or diagnose.",
          ),
          L(
            "Sin fase («no aplica»): estudios de dispositivos o de hábitos, que no usan fases.",
            "No phase (\"not applicable\"): studies of devices or habits, which do not use phases.",
          ),
        ],
        { title: L("Otras etiquetas que puedes ver", "Other labels you may see") },
      ),
      note(
        "El número de participantes es orientativo (cifras del Instituto Nacional sobre el Envejecimiento de EE. UU.). Cada ensayo es distinto. La fase no dice si un ensayo es adecuado para ti.",
        "The number of participants is a rough guide (figures from the US National Institute on Aging). Every trial is different. The phase does not tell you whether a trial is right for you.",
      ),
    ],
    sources: [SRC.ctgGlossary, SRC.ctgLearn, SRC.nia, SRC.eupatiDesarrollo, SRC.eupatiFase2, reg("art. 37.4")],
  },

  // 3 ------------------------------------------------------------------------------------------------------------
  {
    id: "quien-revisa",
    title: L("Quién revisa un ensayo en España", "Who reviews a trial in Spain"),
    summary: L(
      "Un ensayo con medicamentos necesita la autorización de la AEMPS y el visto bueno de un comité de ética (CEIm) antes de empezar.",
      "A medicine trial needs AEMPS authorisation and the approval of an ethics committee (CEIm) before it starts.",
    ),
    blocks: [
      p(
        "En España, un ensayo clínico con medicamentos no puede empezar sin dos permisos: el dictamen favorable de un comité de ética (CEIm) y la autorización de la AEMPS. Además, cada hospital debe dar su conformidad.",
        "In Spain, a clinical trial of medicines cannot start without two permissions: a favourable opinion from an ethics committee (CEIm) and authorisation from the AEMPS. Each hospital must also give its agreement.",
      ),
      {
        type: "definitions",
        items: [
          {
            id: "paso-ctis",
            term: L("1. La solicitud (CTIS)", "1. The application (CTIS)"),
            definition: L(
              "El promotor pide la autorización a través de un portal único de la Unión Europea, el CTIS. Con una sola solicitud puede pedir permiso en varios países europeos. Desde el 31 de enero de 2023 todas las solicitudes nuevas se hacen así.",
              "The sponsor applies for authorisation through a single European Union portal, CTIS. With one application it can ask for permission in several European countries. Since 31 January 2023 all new applications are made this way.",
            ),
          },
          {
            id: "paso-ceim",
            term: L("2. El comité de ética (CEIm)", "2. The ethics committee (CEIm)"),
            definition: L(
              "Es un comité independiente. Tiene al menos diez miembros: entre ellos, médicos, farmacéuticos, personal de enfermería, un jurista y al menos una persona ajena a la sanidad que representa los intereses de los pacientes. Revisa los aspectos éticos, metodológicos y legales. Su dictamen es único y vinculante (es decir, obligatorio). Después sigue el ensayo hasta su informe final.",
              "An independent committee. It has at least ten members: among them doctors, pharmacists, nurses, a lawyer and at least one lay person who represents patients' interests. It reviews the ethical, methodological and legal aspects. Its opinion is single and binding. It then follows the trial until its final report.",
            ),
          },
          {
            id: "paso-aemps",
            term: L("3. La autorización (AEMPS)", "3. Authorisation (AEMPS)"),
            definition: L(
              "La AEMPS evalúa el ensayo junto con el CEIm y decide: lo autoriza, lo autoriza con condiciones o lo deniega.",
              "The AEMPS assesses the trial together with the CEIm and decides: it authorises it, authorises it with conditions, or refuses it.",
            ),
          },
          {
            id: "paso-registro",
            term: L("4. La publicación en registros", "4. Publication in registries"),
            definition: L(
              "Los ensayos autorizados en España se publican en el REec, el registro público de la AEMPS. El registro se hace después de las autorizaciones y antes de incluir al primer participante. Los ensayos que se tramitan a través del CTIS aparecen también en su web pública. Muchos están además en ClinicalTrials.gov.",
              "Trials authorised in Spain are published in REec, the AEMPS public registry. Registration happens after authorisation and before the first participant is included. Trials handled through CTIS also appear on its public website. Many are also on ClinicalTrials.gov.",
            ),
          },
        ],
      },
      list(
        [
          L("El ensayo es correcto desde el punto de vista ético y científico.", "The trial is ethically and scientifically sound."),
          L(
            "Los riesgos y molestias previsibles están justificados por lo que se espera obtener para los participantes o para la salud pública.",
            "The foreseeable risks and burdens are justified by what is expected for participants or for public health.",
          ),
          L(
            "Los derechos, la seguridad, la dignidad y el bienestar de los participantes están por encima de cualquier otro interés.",
            "Participants' rights, safety, dignity and well-being come before any other interest.",
          ),
          L(
            "El ensayo está diseñado para reducir al mínimo el dolor, la incomodidad y el miedo.",
            "The trial is designed to keep pain, discomfort and fear to a minimum.",
          ),
          L(
            "Nadie presiona a los participantes, tampoco con dinero, para que participen.",
            "No one puts pressure on participants, including with money, to take part.",
          ),
        ],
        { title: L("Qué se comprueba antes de empezar", "What is checked before it starts") },
      ),
      p(
        "Al terminar, el promotor debe publicar un resumen de los resultados en la base de datos europea, sean buenos o malos, en el plazo de un año. Debe ir con un resumen en lenguaje sencillo.",
        "When the trial ends, the sponsor must publish a summary of the results in the European database, whatever they are, within one year. It must come with a plain-language summary.",
      ),
      note(
        "ClinicalTrials.gov es un registro de EE. UU. Allí la información la envían los promotores o investigadores, y el Gobierno de EE. UU. no revisa la seguridad ni la ciencia de todos los estudios. Que un ensayo esté en un registro no quiere decir que sea adecuado para ti.",
        "ClinicalTrials.gov is a US registry. Sponsors or investigators submit the information there, and the US government does not review the safety and science of every study. Being in a registry does not mean a trial is right for you.",
      ),
    ],
    sources: [
      rd("arts. 3, 12, 13, 15, 17, 23, 24, 25, 47 y 48", "a17"),
      reg("arts. 4, 5, 28, 37.4, 80 y 81"),
      SRC.emaCtr,
      SRC.emaCtis,
      SRC.euctAbout,
      SRC.reec,
      SRC.ctgDisclaimer,
    ],
  },

  // 4 ------------------------------------------------------------------------------------------------------------
  {
    id: "derechos",
    title: L("Tus derechos", "Your rights"),
    summary: L(
      "Participar es voluntario. Antes debes recibir información clara y dar tu consentimiento por escrito. Puedes dejarlo cuando quieras.",
      "Taking part is voluntary. Beforehand you must get clear information and give your consent in writing. You can leave whenever you want.",
    ),
    blocks: [
      list(
        [
          L(
            "Participar es voluntario. Puedes decir que no. Decir que no, o dejar el ensayo, no puede perjudicarte.",
            "Taking part is voluntary. You can say no. Saying no, or leaving the trial, must not harm you.",
          ),
          L(
            "Puedes dejar el ensayo en cualquier momento, sin dar explicaciones. Lo que ya se hizo antes no se borra. En general, desde ese momento, tus datos y muestras no se usarán en análisis nuevos, salvo que tú lo autorices.",
            "You can leave the trial at any time, without giving a reason. What was already done before is not erased. In general, from then on, your data and samples will not be used in new analyses unless you allow it.",
          ),
          L(
            "Te deben explicar cómo seguir con la atención habitual para tu enfermedad.",
            "You must be told how to continue with the usual care for your condition.",
          ),
        ],
        { title: L("Decides tú", "You decide") },
      ),
      p(
        "Antes de entrar en un ensayo debes dar tu consentimiento informado. Primero tienes una entrevista con una persona cualificada del equipo. Recibes la información por escrito, en un documento que suele llamarse «hoja de información al participante». La información debe ser completa, breve, clara y fácil de entender.",
        "Before entering a trial you must give your informed consent. First you have an interview with a qualified member of the team. You get the information in writing, in a document usually called the \"participant information sheet\". The information must be complete, brief, clear and easy to understand.",
      ),
      list(
        [
          L("Qué es el ensayo, qué busca, sus riesgos y sus molestias.", "What the trial is, what it aims to find out, its risks and its burdens."),
          L("Tus derechos, sobre todo el de decir que no y el de dejarlo.", "Your rights, especially to say no and to leave."),
          L("Cómo se hará el ensayo y cuánto tiempo durará tu participación.", "How the trial will be done and how long you will take part."),
          L("Otras opciones de tratamiento, y qué seguimiento tendrás si lo dejas.", "Other treatment options, and what follow-up you will have if you leave."),
          L("Cómo funciona el seguro del ensayo si sufres un daño.", "How the trial's insurance works if you are harmed."),
          L("El número UE del ensayo y cuándo estarán disponibles los resultados.", "The EU trial number and when the results will be available."),
        ],
        { title: L("La información debe explicar", "The information must explain") },
      ),
      p(
        "Debes tener tiempo para pensarlo. El equipo debe comprobar que lo has entendido. El consentimiento se da por escrito, con fecha y firma, y te dan una copia. En menores, deciden los padres o tutores, y si el menor tiene 12 años o más también debe dar su consentimiento.",
        "You must have time to think about it. The team must check that you have understood. Consent is given in writing, dated and signed, and you get a copy. For minors, parents or guardians decide, and if the child is 12 or older they must also give consent.",
      ),
      list(
        [
          L(
            "Seguro: salvo en los ensayos de bajo nivel de intervención, el promotor debe contratar un seguro (o garantía) que cubra los daños que el ensayo pueda causar a los participantes. La cobertura mínima es de 250.000 euros por persona.",
            "Insurance: except in low-intervention trials, the sponsor must take out insurance (or a guarantee) covering harm the trial may cause to participants. The minimum cover is 250,000 euros per person.",
          ),
          L(
            "Imagina que tu salud sufre un daño durante el ensayo o en el año siguiente al fin del tratamiento. La ley presume que lo causó el ensayo, salvo que se demuestre lo contrario.",
            "Suppose your health is harmed during the trial or in the year after treatment ends. The law presumes the trial caused it, unless proven otherwise.",
          ),
          L(
            "En los ensayos de bajo nivel de intervención, esos daños pueden estar cubiertos por el seguro del propio hospital.",
            "In low-intervention trials, such harm may be covered by the hospital's own insurance.",
          ),
        ],
        { title: L("Si sufres un daño", "If you are harmed") },
      ),
      list(
        [
          L(
            "La ley protege tu intimidad y tus datos personales. El equipo debe mantener la confidencialidad.",
            "The law protects your privacy and personal data. The team must keep your information confidential.",
          ),
          L(
            "Tus datos personales no se publican en la base de datos europea de ensayos. En las publicaciones de resultados no se te puede identificar.",
            "Your personal data are not published in the European trials database. You cannot be identified in published results.",
          ),
          L(
            "El promotor puede pedirte permiso aparte para usar tus datos en otras investigaciones. Puedes retirar ese permiso cuando quieras.",
            "The sponsor may ask your separate permission to use your data for other research. You can withdraw that permission at any time.",
          ),
        ],
        { title: L("Tus datos", "Your data") },
      ),
      list(
        [
          L(
            "El reglamento europeo dice qué costes no corren a cargo del participante: el medicamento en investigación, los medicamentos y productos necesarios para darlo, y las pruebas que pide el protocolo.",
            "The European regulation says which costs are not borne by the participant: the investigational medicine, the medicines and devices needed to give it, and the tests the protocol requires.",
          ),
          L(
            "En España, el promotor debe suministrar el medicamento en investigación. Hay algunas excepciones, por ejemplo en ensayos promovidos por investigadores o por entidades científicas sin ánimo de lucro, o cuando lo acuerdan el promotor y el hospital. El promotor también debe asegurar que participar no te cueste más que tu atención habitual.",
            "In Spain, the sponsor must supply the investigational medicine. There are some exceptions, for example in trials run by investigators or by non-profit scientific bodies, or when the sponsor and the hospital agree. The sponsor must also make sure that taking part does not cost you more than your usual care.",
          ),
          L(
            "Son obligaciones legales del promotor. No son un motivo para participar. La ley prohíbe presionar de forma indebida a los participantes, también con dinero.",
            "These are legal duties of the sponsor. They are not a reason to take part. The law forbids undue influence on participants, including financial influence.",
          ),
        ],
        { title: L("Gastos", "Costs") },
      ),
      p(
        "El promotor debe tener un punto de contacto para que los participantes puedan pedir más información. También te deben dar los datos de una entidad a la que puedes acudir si necesitas más información.",
        "The sponsor must have a contact point where participants can ask for more information. You must also be given the details of a body you can turn to if you need more information.",
      ),
    ],
    sources: [
      reg("arts. 28, 29, 37.4, 76, 81.7 y 92"),
      rd("arts. 3, 4, 5, 9, 10, 39, 41 y 42", "a4"),
      SRC.aempsInstrucciones,
      SRC.helsinki,
      SRC.ctgLearn,
    ],
  },

  // 5 ------------------------------------------------------------------------------------------------------------
  {
    id: "placebo-aleatorizacion-ciego",
    title: L("Placebo, aleatorización y enmascaramiento", "Placebo, randomisation and blinding"),
    summary: L(
      "Herramientas para comparar tratamientos de forma justa. El uso de placebo tiene límites éticos.",
      "Tools to compare treatments fairly. Placebo use has ethical limits.",
    ),
    blocks: [
      p(
        "Muchos ensayos comparan dos o más grupos de participantes. Por ejemplo, un grupo recibe el medicamento que se estudia y otro recibe otro tratamiento, un placebo o ningún tratamiento. En otros ensayos, todos reciben lo mismo.",
        "Many trials compare two or more groups of participants. For example, one group gets the medicine being studied and another gets a different treatment, a placebo or no treatment. In other trials, everyone gets the same.",
      ),
      {
        type: "definitions",
        items: [
          {
            id: "placebo",
            term: L("Placebo", "Placebo"),
            definition: L(
              "Algo que tiene el mismo aspecto y se da de la misma forma que el tratamiento que se estudia, pero no contiene medicamento.",
              "Something that looks the same and is given the same way as the treatment being studied, but contains no medicine.",
            ),
          },
          {
            id: "aleatorizacion",
            term: L("Aleatorización", "Randomisation"),
            definition: L(
              "Repartir a los participantes en los grupos al azar, según unas proporciones fijadas en el protocolo (por ejemplo, 1 a 1 o 2 a 1). Ni tú ni tu médico elegís el grupo. Así se evita que los resultados se inclinen hacia un lado (sesgo).",
              "Placing participants in groups by chance, in proportions set in the protocol (for example 1 to 1 or 2 to 1). Neither you nor your doctor chooses the group. This stops the results from leaning one way (bias).",
            ),
          },
          {
            id: "enmascaramiento",
            term: L("Enmascaramiento (ciego)", "Blinding (masking)"),
            definition: L(
              "Algunas personas del ensayo no saben qué tratamiento recibe cada participante. En el ciego simple, solo los participantes no lo saben. En el doble ciego, ni los participantes ni el personal del estudio. En el triple ciego, tampoco quienes analizan los datos. En un ensayo abierto, todos lo saben.",
              "Some people in the trial do not know which treatment each participant gets. In single-blind, only participants do not know. In double-blind, neither participants nor study staff know. In triple-blind, those analysing the data do not know either. In an open-label trial, everyone knows.",
            ),
          },
        ],
      },
      p(
        "Si hace falta por motivos médicos o de seguridad, se puede saber qué tratamiento recibe una persona. Este proceso («desenmascaramiento») está previsto en el protocolo.",
        "If needed for medical or safety reasons, it is possible to find out which treatment a person is getting. This process (\"unblinding\") is planned in the protocol.",
      ),
      p(
        "El uso de placebo está regulado. Los ensayos en España deben seguir la Declaración de Helsinki. Según esta declaración, lo nuevo debe compararse con lo que ya ha demostrado funcionar. Solo se acepta un placebo en dos casos. El primero: si no existe un tratamiento probado. El segundo: si hay razones científicas de peso y las personas que lo reciben no corren un riesgo añadido de daño grave o irreversible. La declaración pide extremo cuidado para evitar abusos.",
        "Placebo use is regulated. Trials in Spain must follow the Declaration of Helsinki. Under this declaration, anything new must be compared with what has already been shown to work. A placebo is only acceptable in two cases. First: if no proven treatment exists. Second: if there are strong scientific reasons and the people who get it face no extra risk of serious or irreversible harm. The declaration asks for extreme care to avoid misuse.",
      ),
      p(
        "Para la ley, el placebo de un ensayo cuenta como medicamento en investigación, y el comité de ética revisa el diseño del ensayo antes de que empiece.",
        "In law, a trial's placebo counts as an investigational medicine, and the ethics committee reviews the trial design before it starts.",
      ),
      note(
        "Antes de decidir, pregunta si el ensayo usa placebo y qué probabilidad tienes de estar en cada grupo.",
        "Before you decide, ask whether the trial uses a placebo and what your chances are of being in each group.",
      ),
    ],
    sources: [
      SRC.ctgGlossary,
      SRC.ctgLearn,
      SRC.eupatiAleat,
      SRC.eupatiDisenos,
      SRC.eupatiEnmasc,
      SRC.helsinki,
      rd("arts. 3.2 y 12", "a3"),
      reg("art. 2.2.5"),
      SRC.nia,
    ],
  },

  // 6 ------------------------------------------------------------------------------------------------------------
  {
    id: "riesgos",
    title: L("Posibles riesgos e incertidumbre", "Possible risks and uncertainty"),
    summary: L(
      "Todo estudio tiene algún riesgo. Lo que se investiga puede no funcionar o tener efectos que aún no se conocen.",
      "Every study carries some risk. What is being studied may not work or may have effects not yet known.",
    ),
    blocks: [
      p(
        "Todos los estudios con personas tienen algún riesgo. El nivel de riesgo cambia mucho de un ensayo a otro. Por eso hay normas y comités que vigilan la seguridad de los participantes.",
        "All studies in people carry some risk. The level of risk varies a lot from one trial to another. That is why there are rules and committees that watch over participants' safety.",
      ),
      list(
        [
          L(
            "Puedes tener efectos secundarios u otros problemas de salud durante el estudio. Algunos pueden ser desconocidos.",
            "You may have side effects or other health problems during the study. Some may be unknown.",
          ),
          L(
            "Puede que no recibas el tratamiento que se estudia. Quizá recibas el tratamiento habitual, un placebo o ningún tratamiento.",
            "You may not get the treatment being studied. You may get the usual treatment, a placebo or no treatment.",
          ),
          L(
            "Lo que se estudia puede no funcionar, o no funcionar mejor que el tratamiento habitual.",
            "What is being studied may not work, or may not work better than the usual treatment.",
          ),
          L(
            "El estudio puede pedir más tiempo, visitas y pruebas que tu atención habitual.",
            "The study may need more time, visits and tests than your usual care.",
          ),
          L(
            "A veces hay que cambiar o dejar otros medicamentos que tomas.",
            "Sometimes you need to change or stop other medicines you take.",
          ),
        ],
        { title: L("Riesgos posibles", "Possible risks") },
      ),
      list(
        [
          L(
            "El protocolo debe definir el nivel de riesgo y de molestias, y estos se vigilan durante todo el ensayo.",
            "The protocol must define the level of risk and burden, and these are monitored throughout the trial.",
          ),
          L(
            "La atención médica de los participantes es responsabilidad de un médico cualificado.",
            "Participants' medical care is the responsibility of a qualified doctor.",
          ),
          L(
            "El equipo te dirá qué hacer si tienes un problema de salud. Si aparecen problemas graves, el ensayo se puede parar.",
            "The team will tell you what to do if you have a health problem. If serious problems appear, the trial can be stopped.",
          ),
          L(
            "El comité de ética sigue el ensayo desde el inicio hasta el informe final.",
            "The ethics committee follows the trial from the start to the final report.",
          ),
        ],
        { title: L("Cómo se vigila la seguridad", "How safety is monitored") },
      ),
      note(
        "Nadie puede prometerte un resultado. Habla con tu médico sobre los riesgos y las demás opciones antes de decidir.",
        "No one can promise you a result. Talk with your doctor about the risks and the other options before you decide.",
      ),
    ],
    sources: [SRC.ctgLearn, SRC.nia, reg("art. 28.1"), rd("arts. 3.1 y 12.1.c", "a3")],
  },

  // 7 ------------------------------------------------------------------------------------------------------------
  {
    id: "hablar-con-tu-medico",
    title: L("Cómo hablar con tu médico", "How to talk to your doctor"),
    summary: L(
      "Lleva el número de registro del ensayo a tu consulta y usa esta lista de preguntas para el equipo del estudio.",
      "Take the trial's registry number to your appointment and use this list of questions for the study team.",
    ),
    printable: true,
    blocks: [
      p(
        "Este portal solo muestra información de registros públicos. No puede decirte si un ensayo es adecuado para ti. Quien mejor conoce tu salud es tu médico o tu especialista.",
        "This portal only shows information from public registries. It cannot tell you whether a trial is right for you. Your doctor or specialist is the person who knows your health.",
      ),
      list(
        [
          L(
            "Apunta el número de registro del ensayo y el nombre del hospital. Llévalos a la consulta.",
            "Write down the trial's registry number and the hospital name. Take them to your appointment.",
          ),
          L(
            "Cuéntale a tu médico que te interesa ese ensayo. Puede hablar con el equipo del estudio y ayudarte a coordinar tu atención.",
            "Tell your doctor you are interested in that trial. They can talk to the study team and help coordinate your care.",
          ),
          L(
            "Los datos de contacto oficiales del estudio están en la página del registro.",
            "The study's official contact details are on the registry page.",
          ),
          L(
            "Tómate tu tiempo. Tienes derecho a pensarlo antes de decidir.",
            "Take your time. You have the right to think about it before you decide.",
          ),
        ],
        { title: L("Pasos", "Steps"), ordered: true },
      ),
      list(QUESTIONS_FOR_STUDY_TEAM, {
        title: L("Preguntas para el equipo del estudio", "Questions for the study team"),
        ordered: true,
      }),
    ],
    sources: [SRC.nia, SRC.ctgDisclaimer, SRC.ctgLearn, reg("arts. 29.1, 29.2 y 29.6"), rd("art. 39.3.m", "a39")],
  },

  // 8 ------------------------------------------------------------------------------------------------------------
  {
    id: "glosario",
    title: L("Glosario", "Glossary"),
    summary: L("Palabras que verás en este portal, explicadas de forma sencilla.", "Words you will see on this portal, explained simply."),
    blocks: [
      {
        type: "definitions",
        items: GLOSSARY.map(({ id, term, definition }) => ({ id, term, definition })),
      },
    ],
    sources: dedupeSources(GLOSSARY.flatMap((g) => g.sources)),
  },

  // 9 ------------------------------------------------------------------------------------------------------------
  {
    id: "como-leer-una-ficha",
    title: L("Cómo leer la ficha de un ensayo", "How to read a trial page"),
    summary: L(
      "Qué significa cada dato de la página de un ensayo y de dónde sale.",
      "What each item on a trial page means and where it comes from.",
    ),
    blocks: [
      p(
        "Toda la información de un ensayo en este portal se copia tal cual de un registro público. Solera no la resume ni la reescribe. Por eso a veces verás lenguaje técnico o texto en inglés.",
        "All the information about a trial on this portal is copied as is from a public registry. Solera does not summarise or rewrite it. That is why you will sometimes see technical language or text in English.",
      ),
      {
        type: "definitions",
        items: [
          {
            id: "campo-titulo",
            term: L("Título y resumen", "Title and summary"),
            definition: L(
              "Tal como los publica el registro. El resumen se muestra cuando el registro lo publica; muchas fichas no tienen resumen. Si un texto solo existe en un idioma, lo verás en ese idioma.",
              "As published by the registry. The summary is shown when the registry publishes one; many records have none. If a text only exists in one language, you will see it in that language.",
            ),
          },
          {
            id: "campo-registro",
            term: L("Registro e identificador", "Registry and identifier"),
            definition: L(
              "El nombre del registro de donde sale cada dato (REec, CTIS o ClinicalTrials.gov) y el número del ensayo en ese registro, con un enlace a su página oficial.",
              "The name of the registry each item comes from (REec, CTIS or ClinicalTrials.gov) and the trial's number in that registry, with a link to its official page.",
            ),
          },
          {
            id: "campo-estado",
            term: L("Estado del ensayo", "Trial status"),
            definition: L(
              "En las tarjetas y en la cabecera verás el estado en los hospitales de Madrid: «Buscando participantes en Madrid», «Aún no ha empezado en Madrid» o «Estado en Madrid no indicado». En la ficha también verás el estado general del ensayo en todos los países, con el término del registro: «Reclutando» o «Aún no recluta». Este portal solo muestra ensayos en uno de estos dos estados.",
              "On cards and in the page header you will see the status at Madrid hospitals: \"Looking for participants in Madrid\", \"Not started yet in Madrid\" or \"Status in Madrid not stated\". The trial page also shows the overall status in all countries, using the registry term: \"Recruiting\" or \"Not yet recruiting\". This portal only shows trials in one of these two states.",
            ),
          },
          {
            id: "campo-hospital",
            term: L("Estado en cada hospital", "Status at each hospital"),
            definition: L(
              "Un ensayo puede estar abierto en un hospital y no en otro. Cuando el registro lo indica, verás: «Buscando participantes en este hospital», «Aún no ha empezado en este hospital» o «Estado en este hospital no indicado».",
              "A trial can be open at one hospital and not at another. When the registry says so, you will see: \"Looking for participants at this hospital\", \"Not started yet at this hospital\" or \"Status at this hospital not stated\".",
            ),
          },
          {
            id: "campo-area",
            term: L("Área", "Area"),
            definition: L(
              "El área (por ejemplo, «Cáncer (oncología)») es una agrupación de Solera para ayudarte a buscar. No es un dato del registro y puede no ser exacta: la enfermedad que se estudia es la que indica el registro.",
              "The area (for example \"Cancer (oncology)\") is Solera's own grouping to help you search. It is not registry data and may not be exact: the condition being studied is the one the registry states.",
            ),
          },
          {
            id: "campo-fase",
            term: L("Fase", "Phase"),
            definition: L(
              "La etapa de la investigación (I, II, III, IV, o sin fase). Consulta «Las fases de un ensayo».",
              "The research stage (I, II, III, IV, or no phase). See \"Trial phases\".",
            ),
          },
          {
            id: "campo-criterios",
            term: L("Criterios de inclusión y exclusión", "Inclusion and exclusion criteria"),
            definition: L(
              "Copiados tal cual del registro, en lenguaje técnico. Solo el equipo del estudio puede valorar si se aplican a ti. No intentes decidirlo solo: coméntalos con tu médico.",
              "Copied as is from the registry, in technical language. Only the study team can judge whether they apply to you. Do not try to decide on your own: discuss them with your doctor.",
            ),
          },
          {
            id: "campo-promotor",
            term: L("Promotor", "Sponsor"),
            definition: L(
              "La organización responsable del ensayo, según el registro.",
              "The organisation responsible for the trial, according to the registry.",
            ),
          },
          {
            id: "campo-actualizacion",
            term: L("Última actualización del registro", "Last registry update"),
            definition: L(
              "La fecha en que el registro publicó cambios en la ficha por última vez: «Última actualización» en REec y «Last Update Posted» en ClinicalTrials.gov. Los promotores deben actualizar el REec al menos una vez al año.",
              "The date the registry last published changes to the record: \"Última actualización\" in REec and \"Last Update Posted\" on ClinicalTrials.gov. Sponsors must update REec at least once a year.",
            ),
          },
          {
            id: "campo-consulta",
            term: L("Consultado por Solera", "Retrieved by Solera"),
            definition: L(
              "La fecha en que Solera copió la información del registro. El registro puede haber cambiado después: la página oficial es siempre la referencia.",
              "The date Solera copied the information from the registry. The registry may have changed since: the official page is always the reference.",
            ),
          },
          {
            id: "campo-desactualizado",
            term: L("Aviso «Puede estar desactualizado»", "\"May be out of date\" notice"),
            definition: L(
              "Aparece cuando el registro no se ha actualizado en más de 2 años. Puede estar desactualizado. Confirma el estado con el equipo del estudio.",
              "Shown when the registry has not been updated for more than 2 years. It may be out of date. Confirm the status with the study team.",
            ),
          },
        ],
      },
      list(
        [
          L(
            "Nombres de investigadores, teléfonos o correos electrónicos. Para contactar, usa la página oficial del registro.",
            "Investigators' names, phone numbers or emails. To get in touch, use the official registry page.",
          ),
          L(
            "Valoraciones, puntuaciones o recomendaciones. El orden de la lista no es una recomendación.",
            "Ratings, scores or recommendations. The order of the list is not a recommendation.",
          ),
        ],
        { title: L("Lo que no verás", "What you will not see") },
      ),
    ],
    sources: [SRC.reec, rd("arts. 48.1 y 48.9", "a48"), SRC.ctgGlossary, SRC.ctgTerms],
  },
];

// ---------------------------------------------------------------------------------------------------------------
// About / neutrality (/pacientes/sobre)
// ---------------------------------------------------------------------------------------------------------------

export interface DataSourceNote {
  id: string;
  name: string;
  publisher: Localized;
  use: Localized;
  terms: Localized;
  url: string;
  termsUrl: string;
}

/** Data sources with licence / attribution notes (checked on EDUCATION_SOURCES_CHECKED_AT). */
export const DATA_SOURCES: DataSourceNote[] = [
  {
    id: "reec",
    name: "REec (Registro Español de Estudios Clínicos)",
    publisher: L("Agencia Española de Medicamentos y Productos Sanitarios (AEMPS)", "Spanish Agency of Medicines and Medical Devices (AEMPS)"),
    use: L(
      "Títulos, resúmenes, criterios, estado del ensayo y lista de hospitales con su estado, para los ensayos autorizados en España.",
      "Titles, summaries, criteria, trial status and the list of hospitals with their status, for trials authorised in Spain.",
    ),
    terms: L(
      "La AEMPS autoriza reproducir sus contenidos citando su origen y la fecha de su última actualización.",
      "AEMPS allows its content to be reproduced if the source and the date of last update are cited.",
    ),
    url: "https://reec.aemps.es/reec/public/web.html",
    termsUrl: "https://www.aemps.gob.es/aviso-legal/",
  },
  {
    id: "ctis",
    name: "CTIS (Clinical Trials Information System)",
    publisher: L("Agencia Europea de Medicamentos (EMA)", "European Medicines Agency (EMA)"),
    use: L(
      "Enlazar los números de ensayo de la Unión Europea con los de otros registros.",
      "Linking European Union trial numbers with those in other registries.",
    ),
    terms: L(
      "La EMA permite reproducir la información de sus páginas citando siempre a la EMA como fuente.",
      "EMA allows information on its pages to be reproduced, always acknowledging EMA as the source.",
    ),
    url: "https://euclinicaltrials.eu/",
    termsUrl: "https://www.ema.europa.eu/en/about-us/legal-notice",
  },
  {
    id: "ctgov",
    name: "ClinicalTrials.gov",
    publisher: L("National Library of Medicine (NIH, EE. UU.)", "National Library of Medicine (NIH, USA)"),
    use: L(
      "Títulos, resúmenes, criterios, estado del ensayo y hospitales, para los ensayos con un hospital en Madrid.",
      "Titles, summaries, criteria, trial status and hospitals, for trials with a hospital in Madrid.",
    ),
    terms: L(
      "Es una base de datos del Gobierno de EE. UU. Sus condiciones piden citar ClinicalTrials.gov como fuente, mantener los datos al día, mostrar la fecha de los datos y explicar los cambios. Cambios de Solera: mostramos solo algunos campos, sin datos de contacto personales, y traducimos los rótulos de la página, no el texto del ensayo.",
      "It is a US government database. Its terms ask users to cite ClinicalTrials.gov as the source, keep the data current, show the date of the data and describe any changes. Solera's changes: we show only some fields, without personal contact details, and we translate the page labels, not the trial text.",
    ),
    url: "https://clinicaltrials.gov/",
    termsUrl: "https://clinicaltrials.gov/about-site/terms-conditions",
  },
  {
    id: "cnh",
    name: "Catálogo Nacional de Hospitales",
    publisher: L("Ministerio de Sanidad", "Spanish Ministry of Health"),
    use: L("Nombres y datos básicos de los hospitales de Madrid.", "Names and basic details of hospitals in Madrid."),
    terms: L(
      "Su información se puede reutilizar citando la fuente y la fecha de la última actualización.",
      "Its information may be reused citing the source and the date of last update.",
    ),
    url: "https://www.sanidad.gob.es/ciudadanos/centros.do",
    termsUrl: "https://www.sanidad.gob.es/avisoLegal/home.htm",
  },
  {
    id: "madrid-datos",
    name: "Datos abiertos de la Comunidad de Madrid: centros sanitarios",
    publisher: L("Comunidad de Madrid", "Community of Madrid"),
    use: L("Ubicación de los hospitales en el mapa.", "Hospital locations on the map."),
    terms: L("Licencia Creative Commons Attribution.", "Creative Commons Attribution licence."),
    url: "https://datos.comunidad.madrid/catalogo/dataset/centros_servicios_establecimientos_sanitarios",
    termsUrl: "https://datos.comunidad.madrid/catalogo/dataset/centros_servicios_establecimientos_sanitarios",
  },
  {
    id: "osm",
    name: "OpenStreetMap",
    publisher: L("Colaboradores de OpenStreetMap", "OpenStreetMap contributors"),
    use: L("Comprobación de ubicaciones de hospitales.", "Checking hospital locations."),
    terms: L(
      "Datos con licencia Open Database License (ODbL). Hay que citar a OpenStreetMap y sus colaboradores.",
      "Data under the Open Database License (ODbL). OpenStreetMap and its contributors must be credited.",
    ),
    url: "https://www.openstreetmap.org/",
    termsUrl: "https://www.openstreetmap.org/copyright/es",
  },
];

export const ABOUT_SECTIONS: EducationSection[] = [
  {
    id: "quienes-somos",
    title: L("Quién hace este portal", "Who makes this portal"),
    summary: L(
      "Solera es una empresa privada de Madrid. Este portal es de libre acceso y no es un servicio oficial.",
      "Solera is a private company based in Madrid. This portal is open to everyone and is not an official service.",
    ),
    blocks: [
      p(
        "Solera hace programas informáticos para planificar ensayos clínicos.",
        "Solera makes software for planning clinical trials.",
      ),
      p(
        "Solera también vende herramientas de planificación de ensayos a promotores, CRO y hospitales. Esa actividad no influye en qué ensayos aparecen aquí, en su orden ni en cómo se muestran. Ningún promotor ni hospital paga a Solera por una ficha de este portal ni por su posición en la lista.",
        "Solera also sells trial-planning tools to sponsors, CROs and hospitals. That activity does not influence which trials appear here, their order or how they are shown. No sponsor or hospital pays Solera for a page on this portal or for its position in the list.",
      ),
      p(
        "Es un portal de libre acceso, sin cuentas ni registro. No es un servicio de la Administración. Reúne en un solo lugar la información pública de los registros oficiales sobre ensayos clínicos que están abiertos, o a punto de abrirse, en al menos un hospital de Madrid.",
        "It is open to everyone, with no accounts or sign-in. It is not a government service. It brings together, in one place, public information from official registries about clinical trials that are open, or about to open, in at least one hospital in Madrid.",
      ),
    ],
    sources: [],
  },
  {
    id: "lo-que-no-hacemos",
    title: L("Lo que no hacemos", "What we do not do"),
    summary: L(
      "No buscamos participantes, no recomendamos ensayos y no damos consejo médico.",
      "We do not look for participants, we do not recommend trials and we do not give medical advice.",
    ),
    blocks: [
      list([
        L("No buscamos participantes para ningún ensayo.", "We do not look for participants for any trial."),
        L(
          "No somos promotores de ningún ensayo. Las fichas no se hacen por encargo de ningún promotor ni hospital.",
          "We are not the sponsor of any trial. No sponsor or hospital commissions the trial pages.",
        ),
        L(
          "Ningún promotor, hospital u otra entidad nos da dinero para que un ensayo aparezca aquí o salga antes en la lista.",
          "No sponsor, hospital or other body gives us money for a trial to appear here or to show higher in the list.",
        ),
        L(
          "No valoramos ni ordenamos los ensayos por calidad. El orden de la lista no es una recomendación.",
          "We do not rate or rank trials by quality. The order of the list is not a recommendation.",
        ),
        L(
          "No damos consejo médico. No decimos si un ensayo es adecuado para ti.",
          "We do not give medical advice. We do not say whether a trial is right for you.",
        ),
        L(
          "No recogemos datos personales: no hay cuentas, formularios, chat ni herramientas de seguimiento. Solera no guarda tus búsquedas. Solo usamos una cookie técnica para recordar el idioma que eliges.",
          "We do not collect personal data: there are no accounts, forms, chat or tracking tools. Solera does not store your searches. We only use a technical cookie to remember the language you choose.",
        ),
        L(
          "No escribimos ni resumimos el texto de los ensayos, tampoco con inteligencia artificial. Lo copiamos tal cual del registro.",
          "We do not write or summarise trial text, including with artificial intelligence. We copy it as is from the registry.",
        ),
        L(
          "No mostramos nombres de investigadores, teléfonos ni correos electrónicos.",
          "We do not show investigators' names, phone numbers or emails.",
        ),
      ]),
      p(
        "Lo que buscas va en la dirección de la página (por ejemplo, /pacientes?q=asma), así que puede quedar en el historial de tu navegador; si usas un ordenador compartido, puedes borrarlo. El mapa se carga desde OpenStreetMap (Reino Unido) y las fotos de los hospitales desde Wikimedia Commons (EE. UU.): al ver un mapa o una foto, tu navegador se conecta con esos servicios, que reciben la dirección IP de tu dispositivo.",
        "What you search for goes in the page address (for example /pacientes?q=asthma), so it may stay in your browser history; if you use a shared computer, you can clear it. The map loads from OpenStreetMap (United Kingdom) and hospital photos from Wikimedia Commons (USA): when you view a map or photo, your browser connects to those services, which receive your device's IP address.",
      ),
      p(
        "Los textos generales del apartado «Aprende» son nuestros. Están escritos de forma sencilla y citan fuentes oficiales.",
        "The general texts in the \"Learn\" section are ours. They are written simply and cite official sources.",
      ),
    ],
    sources: [],
  },
  {
    id: "de-donde-salen-los-datos",
    title: L("De dónde salen los datos", "Where the data come from"),
    summary: L(
      "De registros públicos oficiales: REec (AEMPS), CTIS (EMA) y ClinicalTrials.gov, y del catálogo de hospitales del Ministerio de Sanidad.",
      "From official public registries: REec (AEMPS), CTIS (EMA) and ClinicalTrials.gov, and from the Ministry of Health hospital catalogue.",
    ),
    blocks: [
      {
        type: "definitions",
        items: DATA_SOURCES.map((s) => ({
          id: `fuente-${s.id}`,
          term: L(s.name, s.name),
          definition: L(`${s.publisher.es}. ${s.use.es} ${s.terms.es}`, `${s.publisher.en}. ${s.use.en} ${s.terms.en}`),
        })),
      },
      p(
        "Actualizamos los datos de forma periódica. Cada ficha muestra la fecha en que Solera consultó el registro y la fecha de la última actualización del propio registro. La página oficial del registro es siempre la referencia.",
        "We update the data regularly. Each trial page shows the date Solera retrieved the registry and the date of the registry's own last update. The official registry page is always the reference.",
      ),
      p(
        "La exactitud de cada ficha depende de que el promotor la mantenga al día en el registro. El promotor es el responsable de esa información.",
        "Each record's accuracy depends on the sponsor keeping it up to date in the registry. The sponsor is responsible for that information.",
      ),
    ],
    sources: [
      SRC.reec,
      SRC.aempsAviso,
      SRC.emaCtis,
      SRC.emaLegal,
      SRC.ctgTerms,
      SRC.ctgDisclaimer,
      SRC.sanidadCnh,
      SRC.sanidadAviso,
      SRC.madridDatos,
      SRC.osm,
      rd("art. 48.2", "a48"),
    ],
  },
  {
    id: "errores",
    title: L("Si ves un error", "If you see a mistake"),
    summary: L("Cómo avisarnos de un error.", "How to tell us about a mistake."),
    blocks: [
      p(
        "Si un dato no coincide con la página oficial del registro, el registro es la referencia. Si el error está en el propio registro, solo el promotor del ensayo puede corregirlo.",
        "If an item does not match the official registry page, the registry is the reference. If the mistake is in the registry itself, only the trial's sponsor can correct it.",
      ),
      // UI: render only when REPORT_EMAIL is not null, replacing {email}.
      p(
        "Si crees que hemos copiado algo mal, escríbenos a {email} indicando el número de registro del ensayo. No incluyas datos de salud ni datos personales.",
        "If you think we copied something wrongly, write to {email} with the trial's registry number. Do not include health or personal information.",
      ),
    ],
    sources: [rd("art. 48.2", "a48"), SRC.ctgDisclaimer],
  },
];

/** Index of the "report an error" paragraph in ABOUT_SECTIONS["errores"].blocks; hide it while REPORT_EMAIL is null. */
export const REPORT_EMAIL_BLOCK = { sectionId: "errores", blockIndex: 1, placeholder: "{email}" } as const;

// ---------------------------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------------------------

function dedupeSources(list: EducationSource[]): EducationSource[] {
  const seen = new Set<string>();
  return list.filter((s) => {
    const k = `${s.label}|${s.url}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function educationSection(id: string): EducationSection | undefined {
  return EDUCATION_SECTIONS.find((s) => s.id === id) ?? ABOUT_SECTIONS.find((s) => s.id === id);
}

/** Every Solera-authored string in this file, for automated wording checks (see wording.ts). */
export function allEducationStrings(): { path: string; lang: Lang; text: string }[] {
  const out: { path: string; lang: Lang; text: string }[] = [];
  const add = (path: string, l: Localized) => {
    out.push({ path, lang: "es", text: l.es }, { path, lang: "en", text: l.en });
  };
  const walk = (prefix: string, sections: EducationSection[]) => {
    for (const s of sections) {
      add(`${prefix}.${s.id}.title`, s.title);
      add(`${prefix}.${s.id}.summary`, s.summary);
      s.blocks.forEach((b, i) => {
        const bp = `${prefix}.${s.id}.blocks[${i}]`;
        if (b.type === "p" || b.type === "note") add(bp, b.text);
        else if (b.type === "list") {
          if (b.title) add(`${bp}.title`, b.title);
          b.items.forEach((it, j) => add(`${bp}.items[${j}]`, it));
        } else b.items.forEach((d) => (add(`${bp}.${d.id}.term`, d.term), add(`${bp}.${d.id}.definition`, d.definition)));
      });
    }
  };
  walk("EDUCATION_SECTIONS", EDUCATION_SECTIONS);
  walk("ABOUT_SECTIONS", ABOUT_SECTIONS);
  for (const [k, v] of Object.entries(PHASE_ONE_LINERS)) add(`PHASE_ONE_LINERS.${k}`, v);
  GLOSSARY.forEach((g) => (add(`GLOSSARY.${g.id}.term`, g.term), add(`GLOSSARY.${g.id}.definition`, g.definition)));
  QUESTIONS_FOR_STUDY_TEAM.forEach((q, i) => add(`QUESTIONS_FOR_STUDY_TEAM[${i}]`, q));
  add("TRIAL_PAGE_DISCLAIMER", TRIAL_PAGE_DISCLAIMER);
  add("NEXT_STEP.title", NEXT_STEP.title);
  NEXT_STEP.steps.forEach((s, i) => add(`NEXT_STEP.steps[${i}]`, s));
  DATA_SOURCES.forEach((d) => (add(`DATA_SOURCES.${d.id}.use`, d.use), add(`DATA_SOURCES.${d.id}.terms`, d.terms)));
  return out;
}
