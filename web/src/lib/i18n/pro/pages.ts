// Static information pages: /data-sources and /terms (professional side). See ../pro.ts for the glossary.
// Server-only prose: imported only by server components, so its length never reaches a client bundle.
import "server-only";
import type { SourceId, SourceMeta } from "@/components/ui";
import { fmtNum, type Lang } from "../pro";

type CardText = Pick<SourceMeta, "name" | "publisher" | "contains" | "usedFor" | "licence" | "urlLabel" | "datasetLabel">;

/** Coverage figures for one build (raw numbers; formatted by the dictionary). */
export interface Coverage {
  inReec: number;
  reecOnly: number;
  reecMatched: number;
  reecRows: number;
  inCtgov: number;
  both: number;
  ctisLinked: number;
  hospitals: number;
  withTrials: number;
  accredited: number;
  withInstitute: number;
  activity: string;
  ceim: string | undefined;
  geo: string;
  geoAddress: number;
  images: string;
  crossChecked: number;
  /** Hospitals with at least one public role mailbox / distinct mailboxes / hospitals checked. */
  contactHospitals: number;
  contactMailboxes: number;
  contactChecked: number;
}

const n = (v: number) => fmtNum(v, "en");
const ne = (v: number) => fmtNum(v, "es");

const en = {
  dataSources: {
    metaTitle: "Data sources",
    metaDescription:
      "The public sources behind every number in Solera: what each contains, what we use it for, coverage and when it was last fetched.",
    crumbHome: "Find sites",
    title: "Data sources",
    subtitle:
      "Every number in Solera comes from one of these public sources. Each figure has a source chip that opens the exact records behind it.",
    trials: "trials",
    hospitals: "hospitals",
    fresh: { unknown: "Date unknown", ok: "Up to date", soon: "Refresh soon", old: "Out of date" },
    howScoring: "How scoring works",
    contains: "What it contains",
    usedFor: "What Solera uses it for",
    coverage: "Coverage in this build",
    licence: "Licence and credit",
    dataset: "Dataset",
    opensNewTab: "(opens in a new tab)",
    lastUpdated: "Last updated",
    unknown: "unknown",
    /** Card text that differs from components/ui SOURCES (English uses SOURCES as is). */
    cards: {} as Partial<Record<SourceId, Partial<CardText>>>,
    coverageLines: (c: Coverage): Record<SourceId, string[]> => ({
      reec: [
        `${n(c.inReec)} trials with a Madrid hospital`,
        `${n(c.reecOnly)} of them only in REec (not on ClinicalTrials.gov)`,
        `${n(c.reecMatched)} of ${n(c.reecRows)} Madrid site rows matched to a hospital`,
      ],
      ctgov: [`${n(c.inCtgov)} interventional trials with a Madrid hospital`, `${n(c.both)} also in REec, counted once`],
      ctis: [`${n(c.ctisLinked)} trials matched across registries through their EU CT ↔ EudraCT link`],
      catalogue: [`${n(c.hospitals)} hospitals in the Comunidad de Madrid`, `${n(c.withTrials)} with registered trials`],
      isciii: [`${n(c.accredited)} hospitals in an accredited institute`, `${n(c.withInstitute)} with a research institute on file`],
      sermas: [`Activity for ${c.activity} hospitals (public network only)`],
      ceim: [c.ceim ? c.ceim.split(" + ")[0] : "-", "Hospitals without their own committee are shown as “not confirmed”"],
      contacts: [
        `${n(c.contactHospitals)} of ${n(c.contactChecked)} hospitals with at least one public role mailbox`,
        `${n(c.contactMailboxes)} distinct mailboxes, each linked to its source page`,
        "Public role mailboxes, checked 6 Oct 2026",
      ],
      geo: [`${c.geo} hospitals placed on the map`, `${n(c.geoAddress)} from the official register address`],
      commons: [`Photos for ${c.images} hospitals`],
      osm: [`${n(c.crossChecked)} map positions cross-checked`, "Map tiles on every map"],
    }),
    footnote:
      "“Last updated” is when Solera last downloaded the source. Registries and the CEIm directory count as up to date for 14 days; yearly publications for a year. The catalogue, the ISCIII list and SERMAS reports are published once a year, so their dates change only when a new edition is fetched. Registry data are reproduced as published and may be incomplete or out of date. Contains information from the EU Clinical Trials Information System (CTIS), © European Medicines Agency; EMA is not responsible for this service or any analysis derived from its data.",
  },
  terms: {
    metaTitle: "Terms",
    title: "Terms of use",
    subtitle: "How Solera handles your protocol documents and how we contact sites on your behalf.",
    draft: "Draft, to be reviewed by legal counsel before launch",
    uploadsTitle: "Protocol uploads",
    uploads: [
      "You confirm you are authorised by the sponsor to share the document with Solera.",
      "Solera uses the document only to pre-fill your feasibility search. It is not used to train AI models and is not shared with sites.",
      "Unless you choose to keep it, the document is processed once and not stored. If you choose to keep it, it is stored with your project and deleted when the project is deleted or on request.",
      "If you opt in, details detected as confidential (product name or code, sponsor, protocol number) are stored with your project only to stop them from appearing in anything sent to sites. They are never shown to sites. Without opt-in they are not stored.",
      "Documents are processed by Solera's AI provider (Anthropic) under its commercial terms, which exclude training on customer data.",
    ],
    contactTitle: "Contact with sites",
    contact: [
      "Solera sends feasibility questionnaires to institutional research contacts on your behalf, without disclosing your identity. Every message includes an opt-out, which Solera always honours.",
      "Hospitals never see your company name, drug or protocol code. Before anything is sent, Solera checks every message against the terms you keep out and blocks sending if one appears.",
    ],
    reuseTitle: "Hospital answers (reuse)",
    reuse: [
      "Only with the hospital's explicit consent in the questionnaire, Solera saves the answers about the centre's capabilities that the hospital itself typed or corrected, to pre-fill later questionnaires sent to that hospital. Answers specific to a trial (interest, enrolment commitment, investigator, comments) and unchanged public data are never saved.",
      "Saved answers are tied to the institutional email domain the questionnaire was sent to and are only reused for invitations to that same domain. Nothing is saved for personal webmail addresses. Saved answers expire after 12 months (90 days for competing trials).",
      "Sponsors never see a hospital's saved answers. Before a hospital responds, a sponsor only sees that an answer will be pre-filled; it sees the hospital's answers once the hospital responds to that sponsor's questionnaire.",
      "The hospital can review, correct or delete its saved answers at any time from the link in its questionnaire.",
      "Questions a sponsor writes itself are private to that sponsor and are not suggested to other sponsors.",
    ],
  },
};

/** Leading count of a "28/91"-style or "28 sourced …" coverage string. */
const lead = (s: string | undefined) => (s ?? "").split(" ")[0];

const es: typeof en = {
  dataSources: {
    metaTitle: "Fuentes de datos",
    metaDescription:
      "Las fuentes públicas detrás de cada cifra de Solera: qué contiene cada una, para qué la usamos, su cobertura y cuándo se descargó por última vez.",
    crumbHome: "Buscar centros",
    title: "Fuentes de datos",
    subtitle:
      "Todas las cifras de Solera proceden de una de estas fuentes públicas. Cada dato lleva una etiqueta de fuente que abre los registros exactos en los que se basa.",
    trials: "ensayos",
    hospitals: "hospitales",
    fresh: { unknown: "Fecha desconocida", ok: "Actualizada", soon: "Pendiente de actualizar", old: "Desactualizada" },
    howScoring: "Cómo puntuamos",
    contains: "Qué contiene",
    usedFor: "Para qué la usa Solera",
    coverage: "Cobertura en esta versión de los datos",
    licence: "Licencia y atribución",
    dataset: "Conjunto de datos",
    opensNewTab: "(se abre en una pestaña nueva)",
    lastUpdated: "Última actualización",
    unknown: "desconocida",
    cards: {
      reec: {
        publisher: "AEMPS, Agencia Española de Medicamentos y Productos Sanitarios",
        contains:
          "Todos los ensayos con medicamentos autorizados en España desde 2013: estado, fase, promotor, indicación y hospitales participantes.",
        usedFor:
          "Número de ensayos por hospital (en tu indicación, en tu fase, recientes y en reclutamiento) y el listado oficial de centros en España.",
        licence: "Información pública publicada por la AEMPS; se reutiliza citando la fuente.",
        urlLabel: "Buscador público del REec",
        datasetLabel: "Servicio REST del REec",
      },
      ctgov: {
        publisher: "Biblioteca Nacional de Medicina de EE. UU.",
        contains:
          "Estudios intervencionales con algún centro en la Comunidad de Madrid: estado, fase, indicaciones, edades, promotor y centros.",
        usedFor:
          "Número de ensayos por hospital, incluidos los de productos sanitarios y los académicos que no están en el REec; estado de reclutamiento por centro.",
        licence: "Dominio público (obra del Gobierno de EE. UU.); la NLM pide que se cite la fuente.",
        datasetLabel: "API v2 de ClinicalTrials.gov",
      },
      ctis: {
        publisher: "Agencia Europea de Medicamentos",
        contains: "Registros públicos de ensayos de la UE, cada uno con su número EU CT y, si lo tiene, su número EudraCT anterior.",
        usedFor:
          "Solo para vincular cada número EU CT con su número EudraCT anterior, de modo que un mismo ensayo presente en el REec y en ClinicalTrials.gov se cuente una sola vez.",
        licence: "© Agencia Europea de Medicamentos. La EMA no es responsable de este servicio ni de los análisis derivados de sus datos.",
        urlLabel: "Buscador público de CTIS",
      },
      catalogue: {
        contains:
          "Todos los hospitales de España: dirección, camas, dependencia pública o privada, finalidad asistencial, complejo hospitalario y número de equipos de alta tecnología.",
        usedFor: "El listado de hospitales de Madrid, el número de camas (capacidad del hospital), si es público o privado y la comprobación del equipamiento.",
        licence: "Datos abiertos del Ministerio de Sanidad; se permite su reutilización citando la fuente.",
        urlLabel: "Catálogo Nacional de Hospitales (página de descarga)",
      },
      isciii: {
        contains: "Institutos acreditados (IIS) y sus hospitales miembros (listado del ISCIII, actualizado en mayo de 2026).",
        usedFor: "La etiqueta «Instituto acreditado» y el instituto de investigación que aparece en la ficha de cada hospital.",
        licence: "Información pública publicada por el ISCIII.",
        datasetLabel: "Listado de institutos acreditados, actualizado en mayo de 2026 (PDF)",
      },
      sermas: {
        contains:
          "Por cada hospital público: primeras consultas por especialidad, altas y estudios financiados por la industria en el año.",
        usedFor: "La tarjeta «Actividad clínica» de las fichas de los hospitales públicos. No se usa en la puntuación de idoneidad.",
        licence: "Datos abiertos de la Comunidad de Madrid; se permite su reutilización citando la fuente.",
        urlLabel: "Memorias y datos abiertos del SERMAS",
      },
      ceim: {
        contains: "Comités acreditados en Madrid, cuáles participan en las evaluaciones de CTIS, cuáles tienen evaluación acelerada y las plazas de evaluación de este mes.",
        usedFor: "La tarjeta «Comité de ética» de las fichas de los hospitales. No se usa en la puntuación de idoneidad.",
        licence: "Información pública publicada por la AEMPS.",
        urlLabel: "AEMPS: CEIm y CTIS",
        datasetLabel: "Directorio de CEIm, Comunidad de Madrid (JSON)",
      },
      contacts: {
        name: "Webs de hospitales y fundaciones de investigación",
        publisher: "Cada hospital, instituto y fundación de investigación",
        contains:
          "Para cada hospital de Madrid, los contactos de investigación que publica: tipo, para qué sirve el buzón, teléfono y la página y fecha en que se comprobó. Solo buzones institucionales, nunca personas concretas.",
        usedFor:
          "Los contactos entre los que eliges al enviar un cuestionario y la tarjeta «Contactos de investigación públicos» de las fichas de los hospitales. No se usa en la puntuación de idoneidad.",
        licence: "Información de contacto pública publicada por cada institución; cada contacto enlaza a su página de origen.",
        urlLabel: "Página de origen de cada contacto",
      },
      geo: {
        contains: "Todos los centros sanitarios autorizados de la Comunidad de Madrid, con su dirección y su posición en el mapa.",
        usedFor: "La posición de los hospitales en el mapa (contrastada con OpenStreetMap).",
        licence: "Datos abiertos de la Comunidad de Madrid; se permite su reutilización citando la fuente.",
        urlLabel: "Página del conjunto de datos",
      },
      commons: {
        publisher: "Fundación Wikimedia y colaboradores",
        contains: "Fotos de hospitales de Madrid con su autor y su licencia.",
        usedFor: "Las fotos de los hospitales. El autor y la licencia se indican en cada foto.",
        licence: "Cada foto conserva su propia licencia libre (CC0, CC BY, CC BY-SA o dominio público).",
      },
      osm: {
        publisher: "Colaboradores de OpenStreetMap",
        contains: "Teselas del mapa y búsqueda de direcciones (Nominatim).",
        usedFor: "El fondo del mapa y la comprobación cruzada de la posición de cada hospital.",
        licence: "© colaboradores de OpenStreetMap, Open Database Licence (ODbL).",
        urlLabel: "Derechos de autor y licencia",
      },
    },
    coverageLines: (c: Coverage): Record<SourceId, string[]> => ({
      reec: [
        `${ne(c.inReec)} ensayos con algún hospital de Madrid`,
        `${ne(c.reecOnly)} de ellos solo en el REec (no en ClinicalTrials.gov)`,
        `${ne(c.reecMatched)} de ${ne(c.reecRows)} registros de centros de Madrid asignados a un hospital`,
      ],
      ctgov: [`${ne(c.inCtgov)} ensayos intervencionales con algún hospital de Madrid`, `${ne(c.both)} también en el REec, contados una sola vez`],
      ctis: [`${ne(c.ctisLinked)} ensayos vinculados entre registros mediante su enlace EU CT ↔ EudraCT`],
      catalogue: [`${ne(c.hospitals)} hospitales en la Comunidad de Madrid`, `${ne(c.withTrials)} con ensayos registrados`],
      isciii: [`${ne(c.accredited)} hospitales en un instituto acreditado`, `${ne(c.withInstitute)} con un instituto de investigación asociado`],
      sermas: [`Actividad de ${c.activity} hospitales (solo red pública)`],
      ceim: [
        c.ceim ? `${lead(c.ceim)} con comité documentado (propio o del complejo hospitalario)` : "-",
        "Los hospitales sin comité propio aparecen como «No confirmado»",
      ],
      contacts: [
        `${ne(c.contactHospitals)} de ${ne(c.contactChecked)} hospitales con al menos un buzón institucional público`,
        `${ne(c.contactMailboxes)} buzones distintos, cada uno enlazado a su página de origen`,
        "Buzones institucionales públicos, comprobados el 6 oct 2026",
      ],
      geo: [`${c.geo} hospitales situados en el mapa`, `${ne(c.geoAddress)} a partir de la dirección del registro oficial`],
      commons: [`Fotos de ${c.images} hospitales`],
      osm: [`${ne(c.crossChecked)} posiciones en el mapa contrastadas`, "Fondo cartográfico de todos los mapas"],
    }),
    footnote:
      "«Última actualización» es la fecha en que Solera descargó la fuente por última vez. Los registros y el directorio de CEIm se consideran actualizados durante 14 días; las publicaciones anuales, durante un año. El catálogo, el listado del ISCIII y las memorias del SERMAS se publican una vez al año, por lo que su fecha solo cambia cuando se descarga una nueva edición. Los datos de los registros se reproducen tal como se publican y pueden estar incompletos o desactualizados. Contiene información del Sistema de Información de Ensayos Clínicos de la UE (CTIS), © Agencia Europea de Medicamentos; la EMA no es responsable de este servicio ni de los análisis derivados de sus datos.",
  },
  terms: {
    metaTitle: "Condiciones",
    title: "Condiciones de uso",
    subtitle: "Cómo trata Solera los documentos de tus protocolos y cómo contactamos con los centros en tu nombre.",
    draft: "Borrador: pendiente de revisión jurídica antes del lanzamiento",
    uploadsTitle: "Carga de protocolos",
    uploads: [
      "Confirmas que el promotor te ha autorizado a compartir el documento con Solera.",
      "Solera usa el documento únicamente para prerrellenar tu búsqueda de viabilidad. No se usa para entrenar modelos de IA ni se comparte con los centros.",
      "Salvo que decidas conservarlo, el documento se procesa una sola vez y no se guarda. Si decides conservarlo, se guarda con tu proyecto y se elimina cuando se elimina el proyecto o cuando lo solicites.",
      "Si das tu consentimiento, los datos detectados como confidenciales (nombre o código del producto, promotor, número de protocolo) se guardan con tu proyecto únicamente para impedir que aparezcan en cualquier comunicación enviada a los centros. Nunca se muestran a los centros. Sin tu consentimiento, no se guardan.",
      "Los documentos los procesa el proveedor de IA de Solera (Anthropic) conforme a sus condiciones comerciales, que excluyen el entrenamiento con datos de clientes.",
    ],
    contactTitle: "Contacto con los centros",
    contact: [
      "Solera envía cuestionarios de viabilidad a contactos institucionales de investigación en tu nombre, sin revelar tu identidad. Cada mensaje incluye una opción para darse de baja, que Solera respeta siempre.",
      "Los hospitales nunca ven el nombre de tu empresa, el fármaco ni el código del protocolo. Antes de enviar nada, Solera comprueba cada mensaje frente a tus términos excluidos y bloquea el envío si aparece alguno.",
    ],
    reuseTitle: "Respuestas de los hospitales (reutilización)",
    reuse: [
      "Solo con el consentimiento expreso del hospital en el cuestionario, Solera guarda las respuestas sobre las capacidades del centro que el propio hospital escribió o corrigió, para prerrellenar cuestionarios posteriores enviados a ese hospital. Nunca se guardan las respuestas específicas de un ensayo (interés, compromiso de reclutamiento, investigador, comentarios) ni los datos públicos sin modificar.",
      "Las respuestas guardadas quedan vinculadas al dominio de correo electrónico institucional al que se envió el cuestionario y solo se reutilizan en invitaciones a ese mismo dominio. No se guarda nada para direcciones de correo web personales. Las respuestas guardadas caducan a los 12 meses (a los 90 días en el caso de los ensayos competidores).",
      "Los promotores nunca ven las respuestas guardadas de un hospital. Antes de que el hospital responda, el promotor solo ve que una respuesta vendrá prerrellenada; ve las respuestas del hospital cuando este responde al cuestionario de ese promotor.",
      "El hospital puede revisar, corregir o eliminar sus respuestas guardadas en cualquier momento desde el enlace de su cuestionario.",
      "Las preguntas que redacta un promotor son privadas de ese promotor y no se sugieren a otros promotores.",
    ],
  },
};

export const PAGES: Record<Lang, typeof en> = { en, es };
