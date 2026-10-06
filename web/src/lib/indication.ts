import type { Trial } from "./types";

// Indication matching for the sponsor search: pure (no server imports) so the spelling checks and unit tests can use it.

// ---------- indication matching ----------

/** Common Spanish names (accents kept for display) → the English name registries use. The matcher searches a phrase in
 *  both languages (see `bilingual`), so "esclerosis múltiple" and "multiple sclerosis" find the same trials. */
export const SPANISH_NAMES: [string, string][] = [
  ["enfermedad de Alzheimer", "Alzheimer disease"],
  ["enfermedad de Parkinson", "Parkinson disease"],
  ["esclerosis múltiple", "multiple sclerosis"],
  ["esclerosis lateral amiotrófica", "amyotrophic lateral sclerosis"],
  ["cáncer de pulmón", "lung cancer"],
  ["cáncer de pulmón no microcítico", "non-small cell lung cancer"],
  ["cáncer de mama", "breast cancer"],
  ["cáncer colorrectal", "colorectal cancer"],
  ["cáncer de colon", "colon cancer"],
  ["cáncer de próstata", "prostate cancer"],
  ["cáncer de ovario", "ovarian cancer"],
  ["cáncer de páncreas", "pancreatic cancer"],
  ["cáncer gástrico", "gastric cancer"],
  ["cáncer de vejiga", "bladder cancer"],
  ["cáncer de riñón", "renal cell carcinoma"],
  ["cáncer de hígado", "hepatocellular carcinoma"],
  ["cáncer de endometrio", "endometrial cancer"],
  ["cáncer de cuello uterino", "cervical cancer"],
  ["cáncer de cabeza y cuello", "head and neck cancer"],
  ["cáncer de tiroides", "thyroid cancer"],
  ["melanoma", "melanoma"],
  ["leucemia mieloide aguda", "acute myeloid leukemia"],
  ["leucemia linfoblástica aguda", "acute lymphoblastic leukemia"],
  ["leucemia linfocítica crónica", "chronic lymphocytic leukemia"],
  ["linfoma", "lymphoma"],
  ["mieloma múltiple", "multiple myeloma"],
  ["insuficiencia cardíaca", "heart failure"],
  ["infarto de miocardio", "myocardial infarction"],
  ["fibrilación auricular", "atrial fibrillation"],
  ["hipertensión arterial", "hypertension"],
  ["hipertensión pulmonar", "pulmonary hypertension"],
  ["ictus", "stroke"],
  ["diabetes tipo 2", "type 2 diabetes"],
  ["diabetes tipo 1", "type 1 diabetes"],
  ["obesidad", "obesity"],
  ["asma", "asthma"],
  ["enfermedad pulmonar obstructiva crónica", "chronic obstructive pulmonary disease"],
  ["fibrosis pulmonar idiopática", "idiopathic pulmonary fibrosis"],
  ["fibrosis quística", "cystic fibrosis"],
  ["artritis reumatoide", "rheumatoid arthritis"],
  ["artritis psoriásica", "psoriatic arthritis"],
  ["espondilitis anquilosante", "ankylosing spondylitis"],
  ["lupus eritematoso sistémico", "systemic lupus erythematosus"],
  ["psoriasis", "psoriasis"],
  ["dermatitis atópica", "atopic dermatitis"],
  ["enfermedad de Crohn", "Crohn disease"],
  ["colitis ulcerosa", "ulcerative colitis"],
  ["enfermedad inflamatoria intestinal", "inflammatory bowel disease"],
  ["hepatitis B", "hepatitis B"],
  ["hepatitis C", "hepatitis C"],
  ["esteatohepatitis", "steatohepatitis"],
  ["cirrosis", "liver cirrhosis"],
  ["enfermedad renal crónica", "chronic kidney disease"],
  ["infección por VIH", "HIV infection"],
  ["gripe", "influenza"],
  ["tuberculosis", "tuberculosis"],
  ["depresión", "depression"],
  ["trastorno depresivo mayor", "major depressive disorder"],
  ["esquizofrenia", "schizophrenia"],
  ["trastorno bipolar", "bipolar disorder"],
  ["autismo", "autism"],
  ["epilepsia", "epilepsy"],
  ["migraña", "migraine"],
  ["dolor crónico", "chronic pain"],
  ["osteoporosis", "osteoporosis"],
  ["artrosis", "osteoarthritis"],
  ["anemia", "anemia"],
  ["hemofilia", "hemophilia"],
  ["degeneración macular", "macular degeneration"],
  ["glaucoma", "glaucoma"],
  ["atrofia muscular espinal", "spinal muscular atrophy"],
  ["distrofia muscular de Duchenne", "Duchenne muscular dystrophy"],
];


export const ABBREVIATIONS: Record<string, string> = {
  nsclc: "non small cell lung",
  sclc: "small cell lung",
  crc: "colorectal",
  hcc: "hepatocellular",
  rcc: "renal cell",
  aml: "acute myeloid leukemia",
  cll: "chronic lymphocytic leukemia",
  cml: "chronic myeloid leukemia",
  dlbcl: "diffuse large b cell lymphoma",
  mm: "multiple myeloma",
  ms: "multiple sclerosis",
  copd: "chronic obstructive pulmonary",
  ckd: "chronic kidney",
  t2d: "type 2 diabetes",
  t1d: "type 1 diabetes",
  ra: "rheumatoid arthritis",
  ibd: "inflammatory bowel",
  uc: "ulcerative colitis",
  hf: "heart failure",
  hiv: "hiv",
  nash: "steatohepatitis",
  mash: "steatohepatitis",
  // Spanish abbreviations sponsors in Madrid use
  ela: "amyotrophic lateral sclerosis",
  als: "amyotrophic lateral sclerosis",
  epoc: "chronic obstructive pulmonary",
};
const CANCER = ["cancer", "neoplasm", "carcinoma", "tumor", "malignan", "oncolog"];
export const STOP = new Set(["of", "the", "and", "with", "in", "de", "la", "el", "del", "y", "patients", "disease"]);

export function normalise(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/aemia/g, "emia")
    .replace(/haem/g, "hem")
    .replace(/oesophag/g, "esophag")
    .replace(/tumour/g, "tumor")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Plural- and stop-word-insensitive key of a phrase, for the bilingual lookup ("Alzheimer's disease" = "alzheimer"). */
function phraseKey(s: string): string {
  return normalise(s)
    .split(" ")
    .map((t) => ABBREVIATIONS[t] ?? t)
    .join(" ")
    .split(" ")
    .filter((t) => t && t !== "s" && !STOP.has(t))
    .map((t) => (t.length > 3 ? t.replace(/s$/, "") : t))
    .join(" ");
}

let bilingualMap: Map<string, string[]> | null = null;
/** The other-language names of a phrase (Spanish → English and English → Spanish), from SPANISH_NAMES. */
export function bilingual(phrase: string): string[] {
  if (!bilingualMap) {
    bilingualMap = new Map();
    const add = (from: string, to: string) => {
      const k = phraseKey(from);
      if (!k || k === phraseKey(to)) return;
      const list = bilingualMap!.get(k) ?? [];
      if (!list.includes(to)) list.push(to);
      bilingualMap!.set(k, list);
    };
    for (const [es, en] of SPANISH_NAMES) {
      add(es, en);
      add(en, es);
    }
  }
  return bilingualMap.get(phraseKey(phrase)) ?? [];
}

/** Each comma-separated phrase (plus its other-language names) becomes a list of token groups; a trial matches a
 *  phrase when every group hits. */
function compileIndication(indication: string): string[][][] {
  return indication
    .split(/[,;]/)
    .flatMap((p) => [p, ...bilingual(p)])
    .map((p) => normalise(p))
    .filter(Boolean)
    .map((phrase) => {
      const expanded = phrase
        .split(" ")
        .map((t) => ABBREVIATIONS[t] ?? t)
        .join(" ");
      return expanded
        .split(" ")
        .filter((t) => t && !STOP.has(t))
        .map((t) => (CANCER.some((c) => t.startsWith(c)) ? CANCER : [t.replace(/s$/, "")]));
    })
    .filter((groups) => groups.length > 0);
}

const textCache = new WeakMap<Trial, string>();
export function trialText(t: Trial): string {
  let s = textCache.get(t);
  if (s === undefined) {
    s = " " + normalise([...t.conditions, ...t.mesh].join(" | ")) + " ";
    textCache.set(t, s);
  }
  return s;
}

/** The comma / semicolon separated parts of an indication, as typed (trimmed, blanks dropped). */
export function indicationParts(indication: string): string[] {
  return indication.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
}

export function indicationMatcher(indication: string): (t: Trial) => boolean {
  const phrases = compileIndication(indication);
  if (phrases.length === 0) return () => false;
  return (t) => {
    const text = trialText(t);
    return phrases.some((groups) => groups.every((alts) => alts.some((a) => text.includes(" " + a))));
  };
}
