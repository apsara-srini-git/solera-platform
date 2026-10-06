/**
 * The public sources behind every number in Solera (client-safe metadata). One entry per card on /data-sources;
 * `SourceChip` popovers and the "How scoring works" sources table read from here. Fetch dates come from
 * data/build_report.json (`sourceDetails[id].fetchedAt`), written by pipeline/build_data.py.
 */
export type SourceId = "reec" | "ctgov" | "ctis" | "catalogue" | "isciii" | "sermas" | "ceim" | "contacts" | "geo" | "commons" | "osm";

export interface SourceMeta {
  id: SourceId;
  /** Full name, as the publisher writes it. */
  name: string;
  /** Short label for chips. */
  short: string;
  publisher: string;
  /** What it is, in one line. */
  what: string;
  /** What it contains (data-sources card). */
  contains: string;
  /** What Solera uses it for. */
  usedFor: string;
  licence: string;
  /** Official page (fallback when the build report has no URL). Empty for a source made of many pages (contacts). */
  url: string;
  /** Link text for `url`. */
  urlLabel: string;
  /** The dataset / download page, when different from the official page. */
  datasetUrl?: string;
  datasetLabel?: string;
  /** Legend dot colour (also used on SourceBadge). */
  dot: string;
}

export const SOURCES: Record<SourceId, SourceMeta> = {
  reec: {
    id: "reec",
    name: "REec (Registro Español de Estudios Clínicos)",
    short: "REec (AEMPS)",
    publisher: "AEMPS, Spanish Agency of Medicines and Medical Devices",
    what: "Spain's official registry of authorised clinical trials with medicines, with the Spanish sites of each trial.",
    contains: "Every medicines trial authorised in Spain since 2013: status, phase, sponsor, condition and the participating hospitals.",
    usedFor: "Trial counts per hospital (in your condition, phase, recent, recruiting now) and the official Spanish site list.",
    licence: "Public information published by AEMPS; reused with attribution.",
    url: "https://reec.aemps.es/reec/public/web.html",
    urlLabel: "REec public search",
    datasetUrl: "https://reec.aemps.es/reec-services",
    datasetLabel: "REec REST service",
    dot: "#2f6fb0",
  },
  ctgov: {
    id: "ctgov",
    name: "ClinicalTrials.gov",
    short: "ClinicalTrials.gov",
    publisher: "U.S. National Library of Medicine",
    what: "The largest public registry of clinical studies worldwide, with the sites where each study runs.",
    contains: "Interventional studies with a site in the Comunidad de Madrid: status, phase, conditions, ages, sponsor and sites.",
    usedFor: "Trial counts per hospital, including device and academic trials that are not in REec; recruiting status per site.",
    licence: "Public domain (U.S. Government work); NLM asks for attribution.",
    url: "https://clinicaltrials.gov/",
    urlLabel: "ClinicalTrials.gov",
    datasetUrl: "https://clinicaltrials.gov/data-api/api",
    datasetLabel: "ClinicalTrials.gov API v2",
    dot: "#3d5a80",
  },
  ctis: {
    id: "ctis",
    name: "CTIS (EU Clinical Trials Information System)",
    short: "CTIS (EMA)",
    publisher: "European Medicines Agency",
    what: "The EU portal for trials authorised under the Clinical Trials Regulation since 2023.",
    contains: "Public records of EU trials, each with an EU CT number and its older EudraCT number where one exists.",
    usedFor: "Only to link an EU CT number to its older EudraCT number, so the same trial in REec and ClinicalTrials.gov is counted once.",
    licence: "© European Medicines Agency. EMA is not responsible for this service or any analysis derived from its data.",
    url: "https://euclinicaltrials.eu/search-for-clinical-trials/",
    urlLabel: "CTIS public search",
    dot: "#4f6d7a",
  },
  catalogue: {
    id: "catalogue",
    name: "Catálogo Nacional de Hospitales 2025",
    short: "Hospital catalogue",
    publisher: "Ministerio de Sanidad",
    what: "Spain's official list of hospitals, with beds, ownership, class and high-tech equipment (data as of 31 Dec 2024).",
    contains: "Every hospital in Spain: address, beds, public or private, hospital class, complex and counts of major equipment.",
    usedFor: "The list of Madrid hospitals, bed counts (hospital capacity), public/private and the equipment check.",
    licence: "Open data from the Ministerio de Sanidad; reuse allowed with attribution.",
    url: "https://www.sanidad.gob.es/estadEstudios/estadisticas/sisInfSanSNS/ofertaRecursos/hospitales/home.htm",
    urlLabel: "Catálogo Nacional de Hospitales (download page)",
    dot: "#6b5bb5",
  },
  isciii: {
    id: "isciii",
    name: "Institutos de Investigación Sanitaria acreditados",
    short: "ISCIII list",
    publisher: "Instituto de Salud Carlos III (ISCIII)",
    what: "The official list of accredited health research institutes and the hospitals that belong to each.",
    contains: "Accredited institutes (IIS) and their member hospitals (ISCIII list, updated May 2026).",
    usedFor: "The “Accredited institute” badge and the research institute on each hospital page.",
    licence: "Public information published by ISCIII.",
    url: "https://www.isciii.es/",
    urlLabel: "ISCIII",
    datasetUrl: "https://www.isciii.es/documents/d/guest/iis-acreditados_centros_feb_2026-1-?download=true",
    datasetLabel: "List of accredited institutes, updated May 2026 (PDF)",
    dot: "#1f7a8c",
  },
  sermas: {
    id: "sermas",
    name: "Memorias del Servicio Madrileño de Salud (datos abiertos)",
    short: "SERMAS open data",
    publisher: "Comunidad de Madrid, Servicio Madrileño de Salud",
    what: "Annual activity reports of Madrid's public hospitals, published as open data.",
    contains: "Per public hospital: outpatient first visits by specialty, discharges and industry-funded studies for the year.",
    usedFor: "The “Clinical activity” card on public hospitals' pages. It is not used in the fit score.",
    licence: "Open data of the Comunidad de Madrid; reuse allowed with attribution.",
    url: "https://www.comunidad.madrid/servicios/salud/memorias-e-informes-servicio-madrileno-salud",
    urlLabel: "SERMAS reports and open data",
    dot: "#b4553a",
  },
  ceim: {
    id: "ceim",
    name: "Directorio de CEIm acreditados (AEMPS)",
    short: "AEMPS CEIm directory",
    publisher: "AEMPS",
    what: "The AEMPS directory of accredited research ethics committees (CEIm), with their CTIS review slots.",
    contains: "Accredited committees in Madrid, which take part in CTIS reviews, fast-track and this month's review slots.",
    usedFor: "The “Ethics committee” card on hospital pages. It is not used in the fit score.",
    licence: "Public information published by AEMPS.",
    url: "https://www.aemps.gob.es/medicines-for-human-use/research-with-medicines-for-human-use/ceim-committed-to-ctis-procedure/?lang=es",
    urlLabel: "AEMPS: CEIm and CTIS",
    datasetUrl: "https://reec.aemps.es/reec-services/ceimbyccaa?ccaa=13",
    datasetLabel: "CEIm directory, Comunidad de Madrid (JSON)",
    dot: "#8a6d1e",
  },
  contacts: {
    id: "contacts",
    name: "Hospital and research-foundation websites",
    short: "Hospital websites",
    publisher: "Each hospital, research institute and research foundation",
    what: "Public role mailboxes (clinical trials units, research foundations, research offices) published on official hospital pages.",
    contains:
      "For each Madrid hospital, the research contacts it publishes: kind, what the mailbox is for, phone, and the page and date it was checked. Only role mailboxes, never named people.",
    usedFor:
      "The contacts you can choose from when sending a questionnaire, and the “Public research contacts” card on hospital pages. Not used in the fit score.",
    licence: "Public contact information published by each institution; each contact links to its source page.",
    url: "",
    urlLabel: "Source page of each contact",
    dot: "#6b5b95",
  },
  geo: {
    id: "geo",
    name: "Centros, servicios y establecimientos sanitarios",
    short: "Madrid health-centre register",
    publisher: "Comunidad de Madrid (datos abiertos)",
    what: "The regional register of authorised health centres, with official coordinates.",
    contains: "Every authorised health centre in the Comunidad de Madrid with its address and map position.",
    usedFor: "Hospital positions on the map (cross-checked with OpenStreetMap).",
    licence: "Open data of the Comunidad de Madrid; reuse allowed with attribution.",
    url: "https://datos.comunidad.madrid/catalogo/dataset/centros_servicios_establecimientos_sanitarios",
    urlLabel: "Dataset page",
    dot: "#5c7c3a",
  },
  commons: {
    id: "commons",
    name: "Wikimedia Commons",
    short: "Wikimedia Commons",
    publisher: "Wikimedia Foundation and contributors",
    what: "A free media library. Hospital photos are found through Wikidata and only freely licensed files are used.",
    contains: "Photos of Madrid hospitals with their author and licence.",
    usedFor: "Hospital photos. The author and licence are shown on every photo.",
    licence: "Each photo keeps its own free licence (CC0, CC BY, CC BY-SA or public domain).",
    url: "https://commons.wikimedia.org/",
    urlLabel: "Wikimedia Commons",
    dot: "#36678c",
  },
  osm: {
    id: "osm",
    name: "OpenStreetMap",
    short: "OpenStreetMap",
    publisher: "OpenStreetMap contributors",
    what: "The free, community-made world map.",
    contains: "Map tiles and address search (Nominatim).",
    usedFor: "The map background and a cross-check of each hospital's position.",
    licence: "© OpenStreetMap contributors, Open Database Licence (ODbL).",
    url: "https://www.openstreetmap.org/copyright",
    urlLabel: "Copyright and licence",
    dot: "#7a8b3d",
  },
};

/** Spanish wording of the source metadata a hospital reads in a SourceChip popover (lang="es"). Missing fields fall back
 *  to English; official names stay as the publisher writes them. */
export const SOURCES_ES: Partial<Record<SourceId, Partial<Pick<SourceMeta, "short" | "publisher" | "what" | "urlLabel" | "datasetLabel">>>> = {
  reec: {
    publisher: "AEMPS, Agencia Española de Medicamentos y Productos Sanitarios",
    what: "Registro oficial español de ensayos clínicos con medicamentos autorizados, con los centros españoles de cada ensayo.",
    urlLabel: "Buscador público del REec",
    datasetLabel: "Servicio REST del REec",
  },
  ctgov: {
    publisher: "Biblioteca Nacional de Medicina de EE. UU.",
    what: "El mayor registro público de estudios clínicos del mundo, con los centros donde se realiza cada estudio.",
    datasetLabel: "API v2 de ClinicalTrials.gov",
  },
  ctis: {
    publisher: "Agencia Europea de Medicamentos",
    what: "El portal de la UE para los ensayos autorizados según el Reglamento de Ensayos Clínicos desde 2023.",
    urlLabel: "Buscador público de CTIS",
  },
  catalogue: {
    short: "Catálogo CNH",
    what: "Listado oficial de hospitales de España, con camas, dependencia, finalidad y equipamiento de alta tecnología (datos a 31 de diciembre de 2024).",
    urlLabel: "Catálogo Nacional de Hospitales (página de descarga)",
  },
  isciii: {
    short: "Listado ISCIII",
    what: "Listado oficial de institutos de investigación sanitaria acreditados y de los hospitales que forman parte de cada uno.",
    datasetLabel: "Listado de institutos acreditados, actualizado en mayo de 2026 (PDF)",
  },
  sermas: {
    short: "Datos abiertos SERMAS",
    what: "Memorias anuales de actividad de los hospitales públicos de Madrid, publicadas como datos abiertos.",
    urlLabel: "Memorias y datos abiertos del SERMAS",
  },
  ceim: {
    short: "Directorio CEIm (AEMPS)",
    what: "Directorio de la AEMPS de comités de ética de la investigación con medicamentos (CEIm) acreditados.",
    urlLabel: "AEMPS: CEIm y CTIS",
    datasetLabel: "Directorio de CEIm, Comunidad de Madrid (JSON)",
  },
  contacts: {
    short: "Webs de los hospitales",
    publisher: "Cada hospital, instituto y fundación de investigación",
    what: "Buzones institucionales públicos (unidades de ensayos clínicos, fundaciones y oficinas de investigación) publicados en páginas oficiales de los hospitales.",
    urlLabel: "Página de origen de cada contacto",
  },
  geo: {
    short: "Registro de centros sanitarios de Madrid",
    what: "El registro regional de centros sanitarios autorizados, con sus coordenadas oficiales.",
    urlLabel: "Página del conjunto de datos",
  },
  commons: {
    publisher: "Fundación Wikimedia y colaboradores",
    what: "Una mediateca libre. Las fotos de hospitales se buscan a través de Wikidata y solo se usan archivos con licencia libre.",
  },
  osm: {
    publisher: "Colaboradores de OpenStreetMap",
    what: "El mapa del mundo libre y colaborativo.",
    urlLabel: "Derechos de autor y licencia",
  },
};

export const SOURCE_ORDER: SourceId[] = ["reec", "ctgov", "ctis", "catalogue", "isciii", "sermas", "ceim", "contacts", "geo", "commons", "osm"];

/** Trial counts come from both registries (deduplicated with the CTIS link). */
export const TRIAL_SOURCES: SourceId[] = ["reec", "ctgov"];

/** Per-source fetch info from the build report. */
export type SourceDates = Partial<Record<SourceId, { fetchedAt?: string | null; url?: string; datasetUrl?: string }>>;

export function fmtDay(iso: string | null | undefined, opts: { time?: boolean; lang?: "en" | "es" } = {}): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleString(opts.lang === "es" ? "es-ES" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(opts.time ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Europe/Madrid",
  });
}

/** "2 days ago", "just now"… / "hace 2 días", "ahora mismo"… (coarse). */
export function relativeTime(iso: string | null | undefined, now = Date.now(), lang: "en" | "es" = "en"): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const es = lang === "es";
  const s = Math.round((now - t) / 1000);
  if (s < 60) return es ? "ahora mismo" : "just now";
  const m = Math.round(s / 60);
  if (m < 60) return es ? `hace ${m} min` : `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return es ? `hace ${h} ${h === 1 ? "hora" : "horas"}` : `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  if (d < 45) return d === 1 ? (es ? "ayer" : "yesterday") : es ? `hace ${d} días` : `${d} days ago`;
  const mo = Math.round(d / 30);
  return es ? `hace ${mo} meses` : `${mo} months ago`;
}

/** Registry trial status as shown to readers: "active not recruiting" / "activo, sin reclutar". */
const STATUS_ES: Record<string, string> = {
  RECRUITING: "reclutando", NOT_YET_RECRUITING: "aún no recluta", ENROLLING_BY_INVITATION: "reclutando por invitación",
  ACTIVE_NOT_RECRUITING: "activo, sin reclutar", COMPLETED: "finalizado", TERMINATED: "interrumpido", WITHDRAWN: "retirado",
  SUSPENDED: "suspendido", UNKNOWN: "estado desconocido",
};
export function trialStatusLabel(status: string, lang: "en" | "es" = "en"): string {
  const en = status.replaceAll("_", " ").toLowerCase();
  return lang === "es" ? (STATUS_ES[status] ?? en) : en;
}

/**
 * Source fields in the dataset may be "URL (free-text note)". Returns the URL (the part before the first whitespace,
 * only when it is an http(s) link) and the rest as a note. Safe on plain URLs, plain text and null.
 */
export function splitSource(source: string | null | undefined): { href: string | undefined; note: string | undefined } {
  const s = (source ?? "").trim();
  if (!s) return { href: undefined, note: undefined };
  const [first, ...rest] = s.split(/\s+/);
  const note = rest.join(" ").replace(/^\((.*)\)$/, "$1").trim() || undefined;
  return /^https?:\/\//i.test(first) ? { href: first, note } : { href: undefined, note: s };
}
