// "How scoring works" page prose (professional side). Server-only use (imported by the methodology page only).
// See ../pro.ts for the glossary. `**x**` marks a number the page shows in bold.
import { fmtNum, type Lang } from "../pro";

export interface HowRules {
  recentSince: number;
  recentYears: number;
  minFinished: number;
  competingPct: number;
  perItem: number;
  max: number;
  beds: number;
}

const en = {
  metaTitle: "How scoring works",
  metaDescription: "How Solera's 0–100 fit score is built from public registry data: the factors, the deductions, the bands and the data rules.",
  crumbFind: "Find sites",
  title: "How scoring works",
  subtitle: "The fit score is a starting shortlist, not a feasibility assessment.",
  summaryH: "Summary",
  summary:
    "Every Madrid hospital with registered trials gets a fit score from 0 to 100 for your search. Up to 100 points come from six factors, mostly the hospital's public track record in your condition and phase, compared with the most experienced Madrid hospital for the same search. Up to 20 points can then be taken off: for similar trials recruiting there now, and for required equipment the national catalogue does not list. The score uses only public registries and the national hospital catalogue; hospitals cannot pay to rank higher.",
  splitH: "How the 100 points are split",
  pointsOf: (name: string, n: number) => `${name}: ${n} points`,
  upTo: "up to",
  whyItMatters: "Why it matters: ",
  pediatricNote: (name: string) => `For a paediatric search a seventh factor, ${name.toLowerCase()}, is added and the others shrink so the total is still 100.`,
  deductionsH: "Then taken off: deductions (up to −20)",
  upTo10: "up to −10",
  bandsH: "What the bands mean",
  bandsCaption: "Fit score bands",
  colScore: "Score",
  colBand: "Band",
  colMeaning: "What it means",
  bandsNote: "Results also show the hospital's place for your search (“#2 of 14”). Bands carry a word as well as a colour.",
  logH: "Relative and log-scaled: the first trials count most",
  /** Experience vs the leader; `first` = points for the first 5 trials, `last` = for the last 5 up to `top`. */
  logText: (first: number, from: number, top: number, last: number) =>
    `Experience is compared with the most experienced Madrid hospital for *your* search, so the leader gets full points and everyone else a share. The share follows a log scale: going from 0 to 5 trials earns about **${first}** points, while going from ${from} to ${top} earns about **${fmtNum(last, "en")}**. A hospital with a handful of relevant trials is very different from one with none; one with ${top} is not very different from one with ${from}.`,
  logNote: (factor: string, q: string, top: number, max: number, floors: { indication: number; phase: number; area: number; recent: number }) =>
    `Example: ${factor.toLowerCase()} for “${q}”, where the most experienced Madrid hospital has ${top} trials. 0 trials = 0 points; ${top} trials = ${max} points. Formula: points = ${max} × ln(1 + trials) ÷ ln(1 + ${top}). To stop tiny searches inflating scores, the comparison point is never below ${floors.indication} trials in the condition (${floors.phase} in the phase, ${floors.area} in the area, ${floors.recent} recent).`,
  chart: {
    caption: "Points for experience in your condition, by number of trials",
    aria: (marks: string) => `Points rise quickly for the first trials and flatten: ${marks}.`,
    mark: (k: number, p: number) => `${k} trial${k === 1 ? "" : "s"}, ${p} point${p === 1 ? "" : "s"}`,
    point: (k: number, p: number, max: number) => `${k} trial${k === 1 ? "" : "s"} → ${p} of ${max} points`,
    axis: "Trials in your condition",
    five: (p: number) => `5 trials → ${p} pts`,
    tableCaption: "Points by number of trials",
    trials: "Trials",
    points: "Points",
  },
  exampleH: "A worked example, from today's data",
  /** "Search: multiple sclerosis, Phase II, needs MRI. X ranks #2 of 14:" */
  exampleSearch: "Search:",
  exampleNeeds: "needs",
  exampleRanks: (rank: number, of: number) => `ranks #${rank} of ${of}:`,
  openExample: "Open this hospital with the example search →",
  rulesH: "Data rules in plain words",
  rules: (r: HowRules): [string, string][] => [
    [
      "Your condition",
      "A trial counts when its registered conditions contain every word of what you typed (or of one of its comma-separated synonyms). Common abbreviations are expanded (NSCLC, COPD, MS…) and spelling variants unified (tumour/tumor, haem/hem).",
    ],
    [
      "Phase",
      "A trial counts when it includes your phase. Combined designs count both: Phase II/III experience counts for a Phase II or a Phase III search. Phase is judged on trials in your condition. Only when no Madrid hospital has any trial in your condition is it judged on the therapeutic area you chose (or on all registered trials when you chose none), and the receipt says so.",
    ],
    ["Recent activity", `Relevant trials (judged the same way as phase) that started in ${r.recentSince} or later: this calendar year and the ${r.recentYears} before it.`],
    [
      "Completed",
      `Among finished trials in the area (completed, terminated or withdrawn), the share that completed. With fewer than ${r.minFinished} finished trials there is not enough to judge, so the factor gets half points.`,
    ],
    [
      "Similar trials recruiting now",
      `Trials in your condition whose status is recruiting, not yet recruiting or enrolling by invitation, both overall and at this hospital. The deduction grows with their share of the hospital's trials in your condition and reaches −10 at ${r.competingPct}%.`,
    ],
    [
      "Equipment",
      `Matched to the equipment counts in the national hospital catalogue (CT, MRI, PET, linear accelerator…). Soft (default): a hospital whose catalogue entry does not list it stays in the ranking with −${r.perItem} per item (up to −${r.max}) and the questionnaire asks. Strict: such hospitals are left out of the ranking.`,
    ],
    ["Capacity", `Beds in the national catalogue; ${r.beds} beds or more = full points.`],
    [
      "Counted once",
      "A trial in both REec and ClinicalTrials.gov is matched by its registry numbers (or the CTIS EU CT ↔ EudraCT link, or a near-identical title) and counted once.",
    ],
    ["Hospitals with no registered trials", "Get no score (there is nothing to compare). They are listed below the ranking and can still be shortlisted."],
  ],
  sourcesH: "Sources used in the score",
  colSource: "Source",
  colFeeds: "What it feeds",
  colRefreshed: "Last refreshed",
  feeds: {
    reec: "All trial counts, recruiting status, deductions for competition",
    ctgov: "All trial counts, recruiting status per site",
    ctis: "Matching the same trial across registries (counted once)",
    catalogue: "Hospital capacity (beds), the equipment check, public/private",
  } as Record<"reec" | "ctgov" | "ctis" | "catalogue", string>,
  opensNewTab: " (opens in a new tab)",
  allSources: "All data sources, coverage and licences",
  faqH: "Questions",
  faq: [
    [
      "Why did a hospital move after a refresh?",
      "Scores are relative. When the registries add trials, the most experienced hospital for your search may change, and so does everyone's share. New trials that start recruiting can also add a competition deduction, and finished ones remove it.",
    ],
    ["Can hospitals pay to rank higher?", "No. There is no paid placement. The score uses only public registries and the national hospital catalogue."],
    [
      "Why does the same hospital score differently for another search?",
      "Every factor is about your search: your condition, your phase, your equipment. A hospital that leads in oncology may have little track record in neurology.",
    ],
    [
      "The catalogue doesn't list equipment I know the hospital has. What happens?",
      "In the default (soft) mode the hospital stays in the ranking with a small deduction and the questionnaire asks the hospital to confirm. The catalogue lists major equipment only.",
    ],
    [
      "Does a high score mean the hospital will recruit well?",
      "Not by itself. It shows a relevant public track record. Actual recruitment depends on the team, the protocol and the patients, which is what the feasibility questionnaire asks about.",
    ],
  ] as [string, string][],
};

const es: typeof en = {
  metaTitle: "Cómo puntuamos",
  metaDescription:
    "Cómo se calcula la puntuación de idoneidad de 0 a 100 de Solera a partir de datos públicos de registros: los factores, las deducciones, las bandas y las reglas de datos.",
  crumbFind: "Buscar centros",
  title: "Cómo puntuamos",
  subtitle: "La puntuación de idoneidad es un punto de partida para la preselección, no una evaluación de viabilidad.",
  summaryH: "Resumen",
  summary:
    "Cada hospital de Madrid con ensayos registrados recibe una puntuación de idoneidad de 0 a 100 para tu búsqueda. Hasta 100 puntos proceden de seis factores, sobre todo de la trayectoria pública del hospital en tu indicación y fase, comparada con la del hospital de Madrid con más experiencia para la misma búsqueda. Después se pueden restar hasta 20 puntos: por ensayos similares que estén reclutando allí ahora y por equipamiento necesario que no figure en el Catálogo Nacional de Hospitales. La puntuación solo usa registros públicos y el Catálogo Nacional de Hospitales; los hospitales no pueden pagar para subir en el ranking.",
  splitH: "Cómo se reparten los 100 puntos",
  pointsOf: (name: string, n: number) => `${name}: ${n} puntos`,
  upTo: "hasta",
  whyItMatters: "Por qué importa: ",
  pediatricNote: (name: string) =>
    `En una búsqueda pediátrica se añade un séptimo factor, ${name.toLowerCase()}, y los demás se reducen para que el total siga siendo 100.`,
  deductionsH: "Después se restan: deducciones (hasta −20)",
  upTo10: "hasta −10",
  bandsH: "Qué significa cada banda",
  bandsCaption: "Bandas de la puntuación de idoneidad",
  colScore: "Puntuación",
  colBand: "Banda",
  colMeaning: "Qué significa",
  bandsNote: "Los resultados también muestran el puesto del hospital en tu búsqueda («2.º de 14»). Cada banda lleva una etiqueta además de un color.",
  logH: "Relativa y en escala logarítmica: los primeros ensayos son los que más cuentan",
  logText: (first: number, from: number, top: number, last: number) =>
    `La experiencia se compara con la del hospital de Madrid con más experiencia para *tu* búsqueda: el líder obtiene la puntuación máxima y los demás, una parte. Esa parte sigue una escala logarítmica: pasar de 0 a 5 ensayos aporta unos **${first}** puntos, mientras que pasar de ${from} a ${top} aporta unos **${fmtNum(last, "es")}**. Un hospital con unos pocos ensayos relevantes es muy distinto de uno sin ninguno; uno con ${top} no es muy distinto de uno con ${from}.`,
  logNote: (factor: string, q: string, top: number, max: number, floors: { indication: number; phase: number; area: number; recent: number }) =>
    `Ejemplo: ${factor.toLowerCase()} para «${q}», donde el hospital de Madrid con más experiencia tiene ${top} ensayos. 0 ensayos = 0 puntos; ${top} ensayos = ${max} puntos. Fórmula: puntos = ${max} × ln(1 + ensayos) ÷ ln(1 + ${top}). Para que las búsquedas muy pequeñas no inflen las puntuaciones, el punto de comparación nunca baja de ${floors.indication} ensayos en la indicación (${floors.phase} en la fase, ${floors.area} en el área, ${floors.recent} recientes).`,
  chart: {
    caption: "Puntos por experiencia en tu indicación, según el número de ensayos",
    aria: (marks: string) => `Los puntos suben deprisa con los primeros ensayos y luego se estabilizan: ${marks}.`,
    mark: (k: number, p: number) => `${k} ${k === 1 ? "ensayo" : "ensayos"}, ${p} ${p === 1 ? "punto" : "puntos"}`,
    point: (k: number, p: number, max: number) => `${k} ${k === 1 ? "ensayo" : "ensayos"} → ${p} de ${max} puntos`,
    axis: "Ensayos en tu indicación",
    five: (p: number) => `5 ensayos → ${p} pts`,
    tableCaption: "Puntos según el número de ensayos",
    trials: "Ensayos",
    points: "Puntos",
  },
  exampleH: "Un ejemplo práctico con los datos de hoy",
  exampleSearch: "Búsqueda:",
  exampleNeeds: "necesita",
  exampleRanks: (rank: number, of: number) => `queda ${rank}.º de ${of}:`,
  openExample: "Abrir este hospital con la búsqueda de ejemplo →",
  rulesH: "Reglas de datos, en pocas palabras",
  rules: (r: HowRules): [string, string][] => [
    [
      "Tu indicación",
      "Un ensayo cuenta cuando sus indicaciones registradas contienen todas las palabras que has escrito (o las de uno de sus sinónimos separados por comas). Las abreviaturas habituales se expanden (NSCLC, COPD, MS…) y se unifican las variantes ortográficas (tumour/tumor, haem/hem).",
    ],
    [
      "Fase",
      "Un ensayo cuenta cuando incluye tu fase. Los diseños combinados cuentan para ambas: la experiencia en fase II/III cuenta para una búsqueda de fase II o de fase III. La fase se valora sobre los ensayos en tu indicación. Solo cuando ningún hospital de Madrid tiene ensayos en tu indicación se valora sobre el área terapéutica que hayas elegido (o sobre todos los ensayos registrados si no has elegido ninguna), y el desglose lo indica.",
    ],
    [
      "Actividad reciente",
      `Ensayos relevantes (valorados igual que la fase) iniciados en ${r.recentSince} o después: este año natural y los ${r.recentYears} anteriores.`,
    ],
    [
      "Completados",
      `De los ensayos finalizados del área (completados, interrumpidos o retirados), la proporción que se completó. Con menos de ${r.minFinished} ensayos finalizados no hay datos suficientes, así que el factor recibe la mitad de los puntos.`,
    ],
    [
      "Ensayos similares en reclutamiento",
      `Ensayos en tu indicación cuyo estado es en reclutamiento, aún sin reclutar o con inclusión por invitación, tanto en total como en este hospital. La deducción crece con su peso entre los ensayos del hospital en tu indicación y llega a −10 cuando alcanzan el ${r.competingPct} %.`,
    ],
    [
      "Equipamiento",
      `Se coteja con el equipamiento que recoge el Catálogo Nacional de Hospitales (TAC, resonancia magnética, PET, acelerador lineal…). Modo flexible (por defecto): un hospital cuya ficha del catálogo no lo recoge sigue en el ranking con −${r.perItem} por elemento (hasta −${r.max}) y el cuestionario lo pregunta. Modo estricto: esos hospitales quedan fuera del ranking.`,
    ],
    ["Capacidad", `Camas según el Catálogo Nacional de Hospitales; ${r.beds} camas o más = puntuación máxima.`],
    [
      "Contados una sola vez",
      "Un ensayo que figura en REec y en ClinicalTrials.gov se identifica por sus números de registro (o por el vínculo EU CT ↔ EudraCT de CTIS, o por un título casi idéntico) y se cuenta una sola vez.",
    ],
    [
      "Hospitales sin ensayos registrados",
      "No reciben puntuación (no hay nada que comparar). Aparecen debajo del ranking y se pueden preseleccionar igualmente.",
    ],
  ],
  sourcesH: "Fuentes que usa la puntuación",
  colSource: "Fuente",
  colFeeds: "Para qué se usa",
  colRefreshed: "Última actualización",
  feeds: {
    reec: "Todos los recuentos de ensayos, el estado de reclutamiento y las deducciones por competencia",
    ctgov: "Todos los recuentos de ensayos y el estado de reclutamiento de cada centro",
    ctis: "Identificar el mismo ensayo en distintos registros (se cuenta una sola vez)",
    catalogue: "Capacidad del hospital (camas), comprobación del equipamiento, público/privado",
  },
  opensNewTab: " (se abre en una pestaña nueva)",
  allSources: "Todas las fuentes de datos, su cobertura y sus licencias",
  faqH: "Preguntas",
  faq: [
    [
      "¿Por qué ha cambiado de puesto un hospital tras una actualización?",
      "Las puntuaciones son relativas. Cuando los registros añaden ensayos, puede cambiar el hospital con más experiencia para tu búsqueda y, con él, la parte de todos los demás. Los ensayos nuevos que empiezan a reclutar también pueden añadir una deducción por competencia, y los que terminan la eliminan.",
    ],
    [
      "¿Pueden los hospitales pagar para subir en el ranking?",
      "No. No hay posiciones de pago. La puntuación solo usa registros públicos y el Catálogo Nacional de Hospitales.",
    ],
    [
      "¿Por qué el mismo hospital puntúa distinto en otra búsqueda?",
      "Todos los factores dependen de tu búsqueda: tu indicación, tu fase, tu equipamiento. Un hospital líder en oncología puede tener poca trayectoria en neurología.",
    ],
    [
      "El catálogo no recoge un equipo que sé que el hospital tiene. ¿Qué pasa?",
      "En el modo por defecto (flexible), el hospital sigue en el ranking con una pequeña deducción y el cuestionario le pide que lo confirme. El catálogo solo recoge el equipamiento de alta tecnología.",
    ],
    [
      "¿Una puntuación alta significa que el hospital reclutará bien?",
      "No por sí sola. Muestra una trayectoria pública relevante. El reclutamiento real depende del equipo, del protocolo y de los pacientes, que es justo lo que pregunta el cuestionario de viabilidad.",
    ],
  ],
};

export const HOW: Record<Lang, typeof en> = { en, es };
