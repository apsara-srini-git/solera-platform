// Sponsor home / site search strings (professional side). See ../pro.ts for the glossary.
// Result cards and the score explainer have their own module.
import type { ProtocolErrorCode } from "@/lib/protocol";
import type { SavedSearchError } from "@/lib/saved-search";
import { fmtNum, type Lang } from "../pro";

type Summary = { trials: number } | null | undefined;

const n = (v: number) => fmtNum(v, "en");
const nEs = (v: number) => fmtNum(v, "es");

const en = {
  hero: {
    promises: [
      { title: "Transparent and accurate.", text: "Every score is broken down, and every number comes from a named public source." },
      { title: "Private by design.", text: "Your study details stay private until you choose to share them." },
      { title: "Free to start.", text: "Search all 91 Madrid hospitals for free, with no account or demo." },
      { title: "As simple as a property search.", text: "Browse a visual map and list with photos and filters, and judge each hospital at a glance." },
    ],
    stats: (h: number, t: number) => `${n(h)} hospitals · ${n(t)} public trials`,
    statsAria: (h: number, t: number) => `${n(h)} hospitals and ${n(t)} public trials: show sources`,
    statsNote:
      "Hospitals: every hospital in the Comunidad de Madrid in the Ministerio de Sanidad's national hospital catalogue. Trials: registered trials with a Madrid site in REec and ClinicalTrials.gov, each trial counted once.",
    title: "Trial site selection, made fast and simple",
    leadShort: "Describe your study and see every hospital ranked on its public trial record.",
    leadLong:
      "Describe your study and see every hospital ranked on its public trial record, on a map. Shortlist the best fits and send them a feasibility questionnaire, while your study details stay private. No account needed to search.",
  },
  form: {
    indication: "Indication",
    indicationHint:
      "Add other names for the same condition, separated by commas. We search for any of them. Example: NSCLC, non-small cell lung cancer.",
    indicationError: "Enter an indication to search.",
    indicationPlaceholder: "e.g. HER2+ breast cancer",
    tryLabel: "Try:",
    /** Visible names of the example searches (same order as EXAMPLES in SearchForm). */
    examples: ["NSCLC", "Multiple sclerosis", "Paediatric ALL", "Heart failure"],
    area: "Therapeutic area",
    anyArea: "Any area",
    phase: "Phase",
    population: "Population",
    hospitalType: "Hospital type",
    ownershipAny: "Any",
    equipment: "Required equipment",
    fewer: "Fewer",
    more: (k: number) => `${k} more`,
    equipmentNote: "The national catalogue only lists major equipment; a hospital may still have access through a partner site.",
    strict: "Only show hospitals where the catalogue lists it",
    strictOn: "Hospitals without it in the catalogue are hidden.",
    strictOff: "Otherwise they stay in the ranking with a small deduction, and we ask the hospital.",
    submit: "Find sites",
    ranking: "Ranking hospitals…",
  },
  notice: {
    noneMatch: "No trials match this condition, so scores reflect overall research activity only.",
    notFoundPre: "We didn't find",
    notFoundPost: "in Madrid trial registries",
    notCounted: " (not counted in the ranking)",
    didYouMean: "Did you mean:",
    didYouMeanEnd: "?",
    trials: (k: number) => `(${n(k)} trial${k === 1 ? "" : "s"})`,
    checkSpelling: "Check the spelling, or try the name registries use (often English, e.g. “breast cancer”).",
    english: (text: string, k: number) =>
      `“${text}” matches ${n(k)} Spanish-language record${k === 1 ? "" : "s"}; most registries use English.`,
    alsoSearch: (label: string) => `Also search “${label}”`,
    searchAnyway: "Search anyway",
    anywayNote: "Hospitals would be ranked on overall research activity only.",
    q: (s: string) => `“${s}”`,
  },
  saved: {
    errors: {
      "too-large": "This file is too big to be a saved Solera search. Choose the .json file you downloaded with “Download search”.",
      "not-json": "We couldn't read this file. Choose the .json file you downloaded with “Download search”.",
      "wrong-kind": "This is a saved search from the patient portal, not a site search. Choose a file downloaded from this page.",
      "newer-version": "This search was saved by a newer version of Solera. Reload the page and try again.",
      invalid: "This file isn't a saved Solera site search, or it has been changed. Choose a file downloaded with “Download search”.",
    } as Record<SavedSearchError, string>,
    download: "Download search",
    open: "Open saved search",
    enterFirst: "Enter an indication first",
    fileAria: "Saved search file",
    savedToDownloads: "Saved to your downloads. ",
    localNote: "Saved on your device. Solera keeps nothing. Open it any time, no account needed.",
  },
  refresh: {
    builtTitle: (d: string) => `Public data built ${d}`,
    updated: "Updated",
    refreshing: "Refreshing…",
    logInToRefresh: "Log in to refresh",
    nextAt: (t: string) => `Next refresh available at ${t}`,
    refresh: "Refresh",
    starting: "Starting…",
    /** Pipeline steps (lib/refresh.ts progressStep 1–5). */
    steps: [
      "Starting…",
      "Step 1 of 4 · Reading the national hospital catalogue",
      "Step 2 of 4 · Downloading ClinicalTrials.gov",
      "Step 3 of 4 · Downloading REec (AEMPS)",
      "Step 4 of 4 · Updating maps, photos, SERMAS and ethics committees",
      "Writing the new data files",
    ],
    running: (p: string) => `${p}. This can take several minutes. You can keep working; the page updates when it finishes.`,
    failed: (when: string) =>
      `The last refresh${when ? ` (${when})` : ""} did not finish. Nothing changed: you are seeing the previous public data.`,
    startError: "The refresh could not start. Try again later.",
    connError: "The refresh could not start. Check your connection and try again.",
    dismiss: "Dismiss",
    done: (before: Summary, after: Summary) => {
      if (!after) return "Public data refreshed.";
      if (!before) return `Public data refreshed: ${n(after.trials)} trials.`;
      const d = after.trials - before.trials;
      return d === 0
        ? `Public data refreshed. Trials: ${n(after.trials)} (no change).`
        : `Public data refreshed. Trials: ${n(before.trials)} → ${n(after.trials)} (${d > 0 ? "+" : ""}${n(d)}).`;
    },
  },
  protocol: {
    start: "Start from your protocol",
    startText: "Upload a PDF or Word synopsis and we pre-fill the criteria for you to check.",
    close: "Close",
    inputLabel: "Protocol input",
    uploadFile: "Upload file",
    pasteText: "Paste text",
    chooseFile: "Choose a PDF, Word or text file",
    upTo: "Up to 20 MB",
    pastePlaceholder: "Paste the protocol synopsis…",
    agree: "I'm allowed to share this document. Solera only uses it to fill in your search.",
    terms: "Terms",
    keepConfidential: "Keep my drug, sponsor and protocol code out of everything sent to hospitals (recommended).",
    keepConfidentialHint: "We'll show you the terms we find so you can edit them.",
    keepDocument: "Save the document with my project",
    keepDocumentHint: "Otherwise it's read once and deleted.",
    reading: "Reading protocol… (up to a minute)",
    extract: "Extract criteria",
    unexpected: "Unexpected response from the server.",
    uploadFailed: "Upload failed.",
    fields: {
      indication: "Indication",
      area: "Therapeutic area",
      phase: "Phase",
      population: "Population",
      targetEnrolmentTotal: "Total enrolment",
      plannedSites: "Planned sites",
      recruitmentMonths: "Recruitment period",
      equipment: "Equipment",
      keyCriteria: "Key criteria",
    } as Record<string, string>,
    termKinds: { drugName: "Drug", sponsorName: "Sponsor", protocolCode: "Protocol code", other: "Other" },
    termsTitle: "Terms kept out of hospital messages",
    termsIntro:
      "Hospitals never see these. If one slips into a message, we stop it before it's sent. Remove anything that isn't secret, or add your own (codenames, partners…).",
    protectedAria: "Protected terms",
    removeTerm: (v: string) => `Remove ${v}`,
    noTerms: "No terms yet.",
    addTermLabel: "Add a term to keep out of hospital messages",
    addTermPlaceholder: "Add a term, e.g. a project codename",
    add: "Add",
    reviewTitle: "Criteria pre-filled from your protocol",
    checkBadge: "Check before searching",
    aiWarning: "AI extraction can be wrong. Review every field in the form.",
    docKept: "The document is saved with your project.",
    docDeleted: "The document was read once and deleted.",
    dismiss: "Dismiss",
    keyCriteriaNote: "Key patient criteria (you can review them on your project page:",
    notProtected:
      "You chose not to protect terms from this document. You can add terms to keep out of hospital messages on your project page.",
  },
  results: {
    describeTitle: "Describe your trial",
    allHospitals: "All Madrid hospitals",
    searchToColour: "Search to colour them by fit",
    editSearch: "Edit search",
    shortlisted: (k: number): string => (k === 1 ? "shortlisted" : "shortlisted"), // same word in English
    continue: "Continue",
    view: "View",
    list: "List",
    map: "Map",
    split: "Split",
    ranked: (k: number): string => (k === 1 ? "hospital ranked by fit score" : "hospitals ranked by fit score"),
    whatIsFit: "What is the fit score?",
    howScoring: "How scoring works",
    downloadSearch: "Download search",
    downloadTitle: "Saved on your device. Solera keeps nothing. Open it any time, no account needed.",
    unscoredNote: (k: number) => `${n(k)} with no registered trials (shown below)`,
    hiddenOwnership: (k: number) => `${n(k)} hidden by your Public/Private filter`,
    hiddenEquipment: (k: number, list: string) => `${n(k)} hidden: the catalogue doesn't list ${list}`,
    emptyTitle: "No hospitals with registered trials match",
    emptyDescription: "Try fewer required equipment items, another hospital type, or a broader condition.",
    unscoredTitle: "Hospitals with no registered trials",
    unscoredText: "No fit score yet, but they may have the capacity. You can still shortlist them and ask.",
    footerNote: "Scores are indicative and based on public registry data. Hospitals confirm the facts in the feasibility questionnaire.",
    mapPendingTitle: "Hospital locations are being added",
    mapPendingText: "The map appears once the dataset includes coordinates.",
    drawerDescription: "Change the criteria and re-rank Madrid hospitals.",
    updateResults: "Update results",
    popupNewToTrials: "New to registered trials, so no score yet.",
    popupHiddenOwnership: "Hidden by your Public/Private filter.",
    popupHiddenEquipment: (list: string) => `Hidden: the national catalogue doesn't list ${list}.`,
    markerHiddenOwnership: (own: string) => `hidden (${own} hospitals only)`,
    markerNoEquipment: (list: string) => `catalogue doesn't list ${list}`,
    requiredEquipment: "required equipment",
  },
  popup: {
    public: "Public",
    private: "Private",
    beds: (k: number) => `${n(k)} beds`,
    bedsNote: "Installed beds as reported in the national hospital catalogue.",
    fitScore: "Fit score",
    of: "of",
    forSearch: "for this search",
    inCondition: "In your condition",
    phaseTrials: (phase: string) => `${phase} trials`,
    similarRecruiting: "Similar recruiting",
    chipIndication: (k: number) => `${n(k)} trial${k === 1 ? "" : "s"} in your condition`,
    chipPhase: (k: number, phase: string) => `${n(k)} ${phase} trial${k === 1 ? "" : "s"}`,
    chipCompeting: (k: number) => `${n(k)} similar trial${k === 1 ? "" : "s"} recruiting now`,
    chipAll: (k: number) => `${n(k)} registered trial${k === 1 ? "" : "s"}`,
    inRegistries: (k: number) => `registered trial${k === 1 ? "" : "s"} in public registries`,
    details: "Details",
    viewHospital: "View hospital",
  },
  map: {
    loading: "Loading map…",
    showAll: "Show all Madrid",
    newToTrials: "new to registered trials",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  },
  legend: {
    fitScore: "Fit score",
    showKey: "Show the map key",
    hideKey: "Hide the map key",
    allHospitals: "Madrid hospitals · click one for details",
    biggerDarker: "bigger & darker = better fit",
    lowToHigh: "Fit score from low to high",
    low: "Low",
    high: "High",
    filteredOut: "Filtered out",
    newToTrials: "New to registered trials",
  },
  photo: {
    noPhoto: "No photo available",
    noPhotoYet: "No photo yet",
    photo: "Photo:",
    alt: (name: string) => `${name} building`,
  },
  listEditor: {
    fromProtocol: "From protocol",
    remove: (t: string) => `Remove “${t}”`,
    max: (k: number) => `Maximum of ${k} reached`,
    add: "Add",
  },
  /** Messages returned by /api/protocol and /api/refresh. */
  api: {
    protocol: {
      tooLarge: "File is larger than 20 MB.",
      noInput: "Choose a file or paste the protocol text.",
      invalidUpload: "Invalid upload. Send the protocol as a form upload.",
      docxTooLarge: "This Word file is too large to process. Upload the synopsis as PDF.",
      docxUnreadable: "This Word file could not be read.",
      agreeTerms: "Please confirm you're authorised to share this document and accept the terms.",
      badType: "Upload a PDF, Word (.docx) or text file.",
      tooShort: "Not enough text to extract criteria from.",
      tooLong: "Document is too long. Upload the protocol synopsis instead.",
      limitAccount: "Daily upload limit reached. Try again tomorrow.",
      limitAnonymous: "Daily limit for uploads without an account reached. Sign up (free) for more.",
      generic: "Something went wrong reading this document.",
      extraction: {
        cancelled: "Upload cancelled.",
        notConfigured: "Protocol extraction is not configured on this server.",
        unreadable: "This document could not be read (too large, password-protected or corrupted).",
        rejected: "The extraction service rejected the request. Please try again later.",
        rateLimited: "Too many requests right now. Try again in a minute.",
        unavailable: "The extraction service is unavailable. Try again shortly.",
        noCriteria: "Could not extract criteria from this document. Fill the form manually.",
        refused: "This document could not be processed.",
        notProtocol: "This doesn't look like a trial protocol or synopsis.",
      } as Record<ProtocolErrorCode, string>,
    },
    refresh: {
      crossSite: "Cross-site request refused.",
      logIn: "Log in to refresh the public data.",
      running: "A refresh is already running.",
      failedRetry: (t: string) => `The last refresh did not finish. You can try again at ${t}.`,
      cooldown: (t: string) => `The public data was refreshed recently. The next refresh is available at ${t}.`,
    },
  },
};

const es: typeof en = {
  hero: {
    promises: [
      { title: "Transparente y preciso.", text: "Cada puntuación se desglosa y cada cifra procede de una fuente pública identificada." },
      { title: "Privado desde el diseño.", text: "Los datos de tu estudio son privados hasta que decidas compartirlos." },
      { title: "Gratis para empezar.", text: "Busca gratis en los 91 hospitales de Madrid, sin cuenta ni demo." },
      { title: "Tan fácil como buscar piso.", text: "Explora un mapa y una lista visuales, con fotos y filtros, y valora cada hospital de un vistazo." },
    ],
    stats: (h: number, t: number) => `${nEs(h)} hospitales · ${nEs(t)} ensayos públicos`,
    statsAria: (h: number, t: number) => `${nEs(h)} hospitales y ${nEs(t)} ensayos públicos: ver fuentes`,
    statsNote:
      "Hospitales: todos los hospitales de la Comunidad de Madrid del Catálogo Nacional de Hospitales del Ministerio de Sanidad. Ensayos: ensayos registrados con algún centro en Madrid en el REec y ClinicalTrials.gov, cada uno contado una sola vez.",
    title: "Selección de centros para ensayos, rápida y sencilla",
    leadShort: "Describe tu estudio y consulta todos los hospitales ordenados según su historial público de ensayos.",
    leadLong:
      "Describe tu estudio y consulta en un mapa todos los hospitales ordenados según su historial público de ensayos. Preselecciona los más adecuados y envíales un cuestionario de viabilidad, mientras los datos de tu estudio siguen siendo privados. Para buscar no necesitas cuenta.",
  },
  form: {
    indication: "Indicación",
    indicationHint:
      "Añade otros nombres de la misma indicación separados por comas: buscamos cualquiera de ellos. Ejemplo: cáncer de pulmón no microcítico, NSCLC.",
    indicationError: "Escribe una indicación para buscar.",
    indicationPlaceholder: "p. ej., cáncer de mama HER2+",
    tryLabel: "Prueba:",
    examples: ["CPNM", "Esclerosis múltiple", "LLA pediátrica", "Insuficiencia cardíaca"],
    area: "Área terapéutica",
    anyArea: "Cualquier área",
    phase: "Fase",
    population: "Población",
    hospitalType: "Tipo de hospital",
    ownershipAny: "Todos",
    equipment: "Equipamiento necesario",
    fewer: "Menos",
    more: (k: number) => `${k} más`,
    equipmentNote:
      "El catálogo nacional solo recoge el equipamiento de alta tecnología; un hospital puede tener acceso a él a través de otro centro.",
    strict: "Mostrar solo los hospitales que lo tienen según el catálogo",
    strictOn: "Se ocultan los hospitales que no lo tienen en el catálogo.",
    strictOff: "Si no, siguen en el ranking con una pequeña deducción y se lo preguntamos al hospital.",
    submit: "Buscar centros",
    ranking: "Ordenando hospitales…",
  },
  notice: {
    noneMatch: "Ningún ensayo coincide con esta indicación: las puntuaciones solo reflejan la actividad investigadora general.",
    notFoundPre: "No hemos encontrado",
    notFoundPost: "en los registros de ensayos de Madrid",
    notCounted: ", así que no cuenta en el ranking",
    didYouMean: "¿Querías decir:",
    didYouMeanEnd: "?",
    trials: (k: number) => `(${nEs(k)} ${k === 1 ? "ensayo" : "ensayos"})`,
    checkSpelling: "Revisa la ortografía o prueba con el nombre que usan los registros (a menudo en inglés, p. ej., «breast cancer»).",
    english: (text: string, k: number) =>
      `«${text}» coincide con ${nEs(k)} ${k === 1 ? "entrada" : "entradas"} en español; la mayoría de los registros están en inglés.`,
    alsoSearch: (label: string) => `Buscar también «${label}»`,
    searchAnyway: "Buscar de todos modos",
    anywayNote: "Los hospitales se ordenarían solo por su actividad investigadora general.",
    q: (s: string) => `«${s}»`,
  },
  saved: {
    errors: {
      "too-large": "Este archivo es demasiado grande para ser una búsqueda guardada de Solera. Elige el archivo .json que descargaste con «Descargar búsqueda».",
      "not-json": "No hemos podido leer este archivo. Elige el archivo .json que descargaste con «Descargar búsqueda».",
      "wrong-kind": "Es una búsqueda guardada del portal de pacientes, no una búsqueda de centros. Elige un archivo descargado desde esta página.",
      "newer-version": "Esta búsqueda se guardó con una versión más reciente de Solera. Recarga la página e inténtalo de nuevo.",
      invalid: "Este archivo no es una búsqueda de centros guardada en Solera, o se ha modificado. Elige un archivo descargado con «Descargar búsqueda».",
    },
    download: "Descargar búsqueda",
    open: "Abrir búsqueda guardada",
    enterFirst: "Escribe primero una indicación",
    fileAria: "Archivo de búsqueda guardada",
    savedToDownloads: "Guardada en tus descargas. ",
    localNote: "Se guarda en tu dispositivo: Solera no conserva nada. Ábrela cuando quieras, sin cuenta.",
  },
  refresh: {
    builtTitle: (d: string) => `Datos públicos generados el ${d}`,
    updated: "Actualizado",
    refreshing: "Actualizando…",
    logInToRefresh: "Inicia sesión para actualizar",
    nextAt: (t: string) => `Próxima actualización disponible a las ${t}`,
    refresh: "Actualizar",
    starting: "Iniciando…",
    steps: [
      "Iniciando…",
      "Paso 1 de 4 · Leyendo el Catálogo Nacional de Hospitales",
      "Paso 2 de 4 · Descargando ClinicalTrials.gov",
      "Paso 3 de 4 · Descargando el REec (AEMPS)",
      "Paso 4 de 4 · Actualizando mapas, fotos, SERMAS y CEIm",
      "Escribiendo los nuevos archivos de datos",
    ],
    running: (p: string) => `${p}. Puede tardar varios minutos. Puedes seguir trabajando; la página se actualizará al terminar.`,
    failed: (when: string) =>
      `La última actualización${when ? ` (${when})` : ""} no terminó. No ha cambiado nada: estás viendo los datos públicos anteriores.`,
    startError: "No se ha podido iniciar la actualización. Inténtalo más tarde.",
    connError: "No se ha podido iniciar la actualización. Comprueba tu conexión e inténtalo de nuevo.",
    dismiss: "Cerrar",
    done: (before: Summary, after: Summary) => {
      if (!after) return "Datos públicos actualizados.";
      if (!before) return `Datos públicos actualizados: ${nEs(after.trials)} ensayos.`;
      const d = after.trials - before.trials;
      return d === 0
        ? `Datos públicos actualizados. Ensayos: ${nEs(after.trials)} (sin cambios).`
        : `Datos públicos actualizados. Ensayos: ${nEs(before.trials)} → ${nEs(after.trials)} (${d > 0 ? "+" : ""}${nEs(d)}).`;
    },
  },
  protocol: {
    start: "Empieza por tu protocolo",
    startText: "Sube una sinopsis en PDF o Word y rellenamos los criterios para que los revises.",
    close: "Cerrar",
    inputLabel: "Origen del protocolo",
    uploadFile: "Subir archivo",
    pasteText: "Pegar texto",
    chooseFile: "Elige un archivo PDF, Word o de texto",
    upTo: "Hasta 20 MB",
    pastePlaceholder: "Pega la sinopsis del protocolo…",
    agree: "Tengo permiso para compartir este documento. Solera solo lo usa para rellenar tu búsqueda.",
    terms: "Condiciones",
    keepConfidential: "No incluir mi fármaco, promotor ni código de protocolo en nada de lo que se envíe a los hospitales (recomendado).",
    keepConfidentialHint: "Te mostraremos los términos que encontremos para que puedas editarlos.",
    keepDocument: "Guardar el documento con mi proyecto",
    keepDocumentHint: "Si no, se lee una sola vez y se elimina.",
    reading: "Leyendo el protocolo… (hasta un minuto)",
    extract: "Extraer criterios",
    unexpected: "Respuesta inesperada del servidor.",
    uploadFailed: "No se ha podido subir el archivo.",
    fields: {
      indication: "Indicación",
      area: "Área terapéutica",
      phase: "Fase",
      population: "Población",
      targetEnrolmentTotal: "Reclutamiento total",
      plannedSites: "Centros previstos",
      recruitmentMonths: "Periodo de reclutamiento",
      equipment: "Equipamiento",
      keyCriteria: "Criterios clave",
    },
    termKinds: { drugName: "Fármaco", sponsorName: "Promotor", protocolCode: "Código de protocolo", other: "Otro" },
    termsTitle: "Términos excluidos de los mensajes a hospitales",
    termsIntro:
      "Los hospitales nunca los ven. Si alguno se cuela en un mensaje, lo bloqueamos antes de enviarlo. Quita lo que no sea confidencial o añade los tuyos (nombres en clave, socios…).",
    protectedAria: "Términos protegidos",
    removeTerm: (v: string) => `Quitar ${v}`,
    noTerms: "Aún no hay términos.",
    addTermLabel: "Añade un término para excluirlo de los mensajes a hospitales",
    addTermPlaceholder: "Añade un término, p. ej., el nombre en clave del proyecto",
    add: "Añadir",
    reviewTitle: "Criterios rellenados a partir de tu protocolo",
    checkBadge: "Revísalos antes de buscar",
    aiWarning: "La extracción con IA puede equivocarse: revisa todos los campos del formulario.",
    docKept: "El documento se guarda con tu proyecto.",
    docDeleted: "El documento se ha leído una sola vez y se ha eliminado.",
    dismiss: "Ocultar",
    keyCriteriaNote: "Criterios clave de los pacientes (puedes revisarlos en la página de tu proyecto):",
    notProtected:
      "Has elegido no proteger términos de este documento. Puedes añadir términos excluidos de los mensajes a hospitales en la página de tu proyecto.",
  },
  results: {
    describeTitle: "Describe tu ensayo",
    allHospitals: "Todos los hospitales de Madrid",
    searchToColour: "Busca para colorearlos según su idoneidad",
    editSearch: "Editar búsqueda",
    shortlisted: (k: number) => (k === 1 ? "preseleccionado" : "preseleccionados"),
    continue: "Continuar",
    view: "Vista",
    list: "Lista",
    map: "Mapa",
    split: "Mixta",
    ranked: (k: number) => (k === 1 ? "hospital ordenado por puntuación de idoneidad" : "hospitales ordenados por puntuación de idoneidad"),
    whatIsFit: "¿Qué es la puntuación de idoneidad?",
    howScoring: "Cómo puntuamos",
    downloadSearch: "Descargar búsqueda",
    downloadTitle: "Se guarda en tu dispositivo: Solera no conserva nada. Ábrela cuando quieras, sin cuenta.",
    unscoredNote: (k: number) => `${nEs(k)} sin ensayos registrados (más abajo)`,
    hiddenOwnership: (k: number) => `${nEs(k)} ${k === 1 ? "oculto" : "ocultos"} por tu filtro público/privado`,
    hiddenEquipment: (k: number, list: string) => `${nEs(k)} ${k === 1 ? "oculto" : "ocultos"}: el catálogo no recoge ${list}`,
    emptyTitle: "Ningún hospital con ensayos registrados coincide",
    emptyDescription: "Prueba con menos equipamiento necesario, otro tipo de hospital o una indicación más amplia.",
    unscoredTitle: "Hospitales sin ensayos registrados",
    unscoredText: "Aún no tienen puntuación de idoneidad, pero pueden tener capacidad. Puedes preseleccionarlos igualmente y preguntarles.",
    footerNote:
      "Las puntuaciones son orientativas y se basan en datos públicos de los registros. Los hospitales confirman los datos en el cuestionario de viabilidad.",
    mapPendingTitle: "Estamos añadiendo la ubicación de los hospitales",
    mapPendingText: "El mapa aparecerá cuando los datos incluyan las coordenadas.",
    drawerDescription: "Cambia los criterios y vuelve a ordenar los hospitales de Madrid.",
    updateResults: "Actualizar resultados",
    popupNewToTrials: "Sin ensayos registrados: puntuación no disponible.",
    popupHiddenOwnership: "Oculto por tu filtro público/privado.",
    popupHiddenEquipment: (list: string) => `Oculto: el catálogo nacional no recoge ${list}.`,
    markerHiddenOwnership: (own: string) => `oculto (solo hospitales ${own})`,
    markerNoEquipment: (list: string) => `el catálogo no recoge ${list}`,
    requiredEquipment: "el equipamiento necesario",
  },
  popup: {
    public: "Público",
    private: "Privado",
    beds: (k: number) => `${nEs(k)} ${k === 1 ? "cama" : "camas"}`,
    bedsNote: "Camas instaladas según el Catálogo Nacional de Hospitales.",
    fitScore: "Puntuación de idoneidad",
    of: "de",
    forSearch: "en esta búsqueda",
    inCondition: "En tu indicación",
    phaseTrials: (phase: string) => `Ensayos de ${phase.replace(/^Fase/, "fase")}`,
    similarRecruiting: "Similares en reclutamiento",
    chipIndication: (k: number) => `${nEs(k)} ${k === 1 ? "ensayo" : "ensayos"} en tu indicación`,
    chipPhase: (k: number, phase: string) => `${nEs(k)} ${k === 1 ? "ensayo" : "ensayos"} de ${phase.replace(/^Fase/, "fase")}`,
    chipCompeting: (k: number) => `${nEs(k)} ${k === 1 ? "ensayo similar" : "ensayos similares"} en reclutamiento ahora`,
    chipAll: (k: number) => `${nEs(k)} ${k === 1 ? "ensayo registrado" : "ensayos registrados"}`,
    inRegistries: (k: number) => `${k === 1 ? "ensayo registrado" : "ensayos registrados"} en registros públicos`,
    details: "Detalles",
    viewHospital: "Ver hospital",
  },
  map: {
    loading: "Cargando mapa…",
    showAll: "Ver todo Madrid",
    newToTrials: "sin ensayos registrados",
    zoomIn: "Acercar",
    zoomOut: "Alejar",
    attribution:
      '&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  },
  legend: {
    fitScore: "Puntuación de idoneidad",
    showKey: "Mostrar la leyenda del mapa",
    hideKey: "Ocultar la leyenda del mapa",
    allHospitals: "hospitales de Madrid · haz clic en uno para ver detalles",
    biggerDarker: "más grande y oscuro = más adecuado",
    lowToHigh: "Puntuación de idoneidad de menor a mayor",
    low: "Baja",
    high: "Alta",
    filteredOut: "Excluidos por los filtros",
    newToTrials: "Sin ensayos registrados",
  },
  photo: {
    noPhoto: "Sin foto disponible",
    noPhotoYet: "Aún sin foto",
    photo: "Foto:",
    alt: (name: string) => `${name}: edificio`,
  },
  listEditor: {
    fromProtocol: "Del protocolo",
    remove: (t: string) => `Quitar «${t}»`,
    max: (k: number) => `Has llegado al máximo de ${k}`,
    add: "Añadir",
  },
  api: {
    protocol: {
      tooLarge: "El archivo supera los 20 MB.",
      noInput: "Elige un archivo o pega el texto del protocolo.",
      invalidUpload: "Subida no válida. Envía el protocolo desde el formulario.",
      docxTooLarge: "Este archivo de Word es demasiado grande para procesarlo. Sube la sinopsis en PDF.",
      docxUnreadable: "No se ha podido leer este archivo de Word.",
      agreeTerms: "Confirma que tienes autorización para compartir este documento y acepta las condiciones.",
      badType: "Sube un archivo PDF, Word (.docx) o de texto.",
      tooShort: "No hay texto suficiente para extraer los criterios.",
      tooLong: "El documento es demasiado largo. Sube la sinopsis del protocolo.",
      limitAccount: "Has alcanzado el límite diario de subidas. Inténtalo mañana.",
      limitAnonymous: "Has alcanzado el límite diario de subidas sin cuenta. Crea una cuenta (gratis) para subir más.",
      generic: "Algo ha fallado al leer este documento.",
      extraction: {
        cancelled: "Subida cancelada.",
        notConfigured: "La extracción de protocolos no está configurada en este servidor.",
        unreadable: "No se ha podido leer este documento (es demasiado grande, está protegido con contraseña o está dañado).",
        rejected: "El servicio de extracción ha rechazado la solicitud. Inténtalo más tarde.",
        rateLimited: "Hay demasiadas solicitudes en este momento. Inténtalo dentro de un minuto.",
        unavailable: "El servicio de extracción no está disponible. Inténtalo de nuevo en breve.",
        noCriteria: "No se han podido extraer criterios de este documento. Rellena el formulario a mano.",
        refused: "No se ha podido procesar este documento.",
        notProtocol: "No parece un protocolo ni una sinopsis de ensayo.",
      },
    },
    refresh: {
      crossSite: "Solicitud de otro sitio rechazada.",
      logIn: "Inicia sesión para actualizar los datos públicos.",
      running: "Ya hay una actualización en curso.",
      failedRetry: (t: string) => `La última actualización no terminó. Puedes volver a intentarlo a las ${t}.`,
      cooldown: (t: string) => `Los datos públicos se actualizaron hace poco. La próxima actualización estará disponible a las ${t}.`,
    },
  },
};

export const SEARCH: Record<Lang, typeof en> = { en, es };

/** "2 days ago" / "hace 2 días" (coarse). English keeps the wording of components/ui relativeTime. */
export function relativeTimeLang(iso: string | null | undefined, lang: Lang, now = Date.now()): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const s = Math.round((now - t) / 1000);
  const m = Math.round(s / 60);
  const h = Math.round(m / 60);
  const d = Math.round(h / 24);
  if (lang === "en") {
    if (s < 60) return "just now";
    if (m < 60) return `${m} min ago`;
    if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
    if (d < 45) return d === 1 ? "yesterday" : `${d} days ago`;
    return `${Math.round(d / 30)} months ago`;
  }
  if (s < 60) return "ahora mismo";
  if (m < 60) return `hace ${m} min`;
  if (h < 24) return `hace ${h} ${h === 1 ? "hora" : "horas"}`;
  if (d < 45) return d === 1 ? "ayer" : `hace ${d} días`;
  return `hace ${Math.round(d / 30)} meses`;
}

/** "14:05" in Madrid time (same in both languages). */
export function madridTime(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleTimeString(lang === "es" ? "es-ES" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
}
