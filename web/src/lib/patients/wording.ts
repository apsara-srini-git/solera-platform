// Promotional-wording guard for the patient portal (/pacientes).
//
// Spain forbids advertising investigational medicines (RD 1090/2015 art. 42.5; RDL 1/2015 art. 80), and
// trial-specific recruitment material needs CEIm approval. The portal therefore uses neutral wording only.
// BANNED_TERMS lists words and phrases that read as promotion, inducement, urgency, superlatives or eligibility
// claims. findBannedTerms() is meant for automated checks over UI strings and generic education content
// (see education.ts). Registry text is shown verbatim and is NOT rewritten, so do not run this guard over
// registry fields to "fix" them - only to audit Solera's own wording.
//
// Matching is case-insensitive, accent-insensitive ("unete" matches "únete") and whole-word (a term never
// matches inside a longer word: "cura" does not match "procura", "free" does not match "freely").

import type { Lang } from "./types";

export interface BannedTerm {
  /** The word or phrase as written in the rules. */
  term: string;
  lang: Lang;
  /** Why it is banned. */
  reason: BannedReason;
}

export type BannedReason =
  | "promotion" // "nuevo tratamiento", "innovador"…
  | "inducement" // "gratis", "pago", "compensación", "beneficio"…
  | "call-to-action" // "únete", "inscríbete"…
  | "eligibility-claim" // "eres elegible", "cumples los requisitos"…
  | "urgency" // "plazas limitadas", "no esperes"…
  | "superlative"; // "el mejor", "revolucionario"…

const t = (term: string, lang: Lang, reason: BannedReason): BannedTerm => ({ term, lang, reason });

export const BANNED_TERMS: Record<Lang, BannedTerm[]> = {
  es: [
    // promotion
    ...["nuevo tratamiento", "nuevos tratamientos", "nueva terapia", "nuevas terapias", "nuevo fármaco", "nuevo medicamento",
      "tratamiento innovador", "tratamientos innovadores", "terapia innovadora", "innovador", "innovadora", "innovadores",
      "innovadoras", "prometedor", "prometedora", "prometedores", "prometedoras", "esperanza", "esperanzas", "cura", "curas",
      "curación", "oportunidad", "oportunidades", "acceso a fármacos", "acceso a medicamentos", "acceso a nuevos fármacos",
      "acceso a nuevos medicamentos", "acceso a tratamientos", "acceso anticipado", "acceso temprano", "milagro",
      "milagroso", "eficaz", "seguro y eficaz", "sin efectos secundarios", "testimonio", "testimonios"]
      .map((x) => t(x, "es", "promotion")),
    // inducement
    ...["gratis", "gratuito", "gratuita", "gratuitos", "gratuitas", "gratuitamente", "sin coste", "sin costo",
      "sin ningún coste", "beneficio", "beneficios", "beneficioso", "beneficiosa", "compensación", "compensaciones",
      "compensado", "pago", "pagos", "pagado", "pagada", "te pagan", "remuneración", "remunerado", "retribución",
      "reembolso", "dinero por participar", "regalo", "premio"]
      .map((x) => t(x, "es", "inducement")),
    // call to action
    ...["únete", "uníos", "apúntate", "apuntate", "inscríbete", "regístrate", "participa ya", "participa ahora",
      "solicita tu plaza", "reserva tu plaza", "pide tu cita", "contacta ya"]
      .map((x) => t(x, "es", "call-to-action")),
    // eligibility claims
    ...["elegible", "elegibles", "eres elegible", "cumples los requisitos", "cumples los criterios", "puedes participar",
      "eres candidato", "eres candidata", "candidato ideal", "candidata ideal"]
      .map((x) => t(x, "es", "eligibility-claim")),
    // urgency
    ...["plazas limitadas", "últimas plazas", "no esperes", "no te lo pierdas", "date prisa", "urgente", "por tiempo limitado",
      "solo hoy", "ahora o nunca", "cuanto antes"]
      .map((x) => t(x, "es", "urgency")),
    // superlatives
    ...["el mejor", "la mejor", "los mejores", "las mejores", "mejor tratamiento", "revolucionario", "revolucionaria",
      "pionero", "pionera", "de vanguardia", "vanguardista", "de última generación", "líder", "excepcional", "increíble",
      "extraordinario", "extraordinaria"]
      .map((x) => t(x, "es", "superlative")),
  ],
  en: [
    ...["new treatment", "new treatments", "new therapy", "new therapies", "new drug", "new medicine",
      "innovative", "innovative treatment", "promising", "hope", "hopes", "hopeful", "cure", "cures", "cured",
      "opportunity", "opportunities", "access to drugs", "access to medicines", "access to new drugs",
      "access to new medicines", "access to treatments", "early access", "miracle", "breakthrough", "safe and effective",
      "no side effects", "testimonial", "testimonials"]
      .map((x) => t(x, "en", "promotion")),
    ...["free", "free of charge", "for free", "at no cost", "no cost", "no charge", "benefit", "benefits", "beneficial",
      "compensation", "compensated", "payment", "payments", "paid", "pay", "get paid", "reimbursement", "reward", "prize",
      "gift card"]
      .map((x) => t(x, "en", "inducement")),
    ...["join", "join us", "join now", "sign up", "enroll now", "enrol now", "apply now", "register now", "book your place",
      "contact us now"]
      .map((x) => t(x, "en", "call-to-action")),
    ...["eligible", "you are eligible", "you qualify", "you may qualify", "qualify", "you meet the criteria",
      "ideal candidate"]
      .map((x) => t(x, "en", "eligibility-claim")),
    ...["limited places", "limited spots", "last places", "don't miss", "do not miss", "hurry", "act now", "urgent",
      "last chance", "today only", "limited time"]
      .map((x) => t(x, "en", "urgency")),
    ...["best", "the best", "leading", "world-class", "revolutionary", "pioneering", "cutting-edge", "state-of-the-art",
      "exceptional", "incredible", "extraordinary", "groundbreaking"]
      .map((x) => t(x, "en", "superlative")),
  ],
};

export interface BannedTermHit {
  term: string;
  lang: Lang;
  reason: BannedReason | "emoji";
  /** The text actually matched, as it appears in the input. */
  match: string;
  /** Character offset in the input. */
  index: number;
}

function fold(s: string): string {
  // Lowercase and strip diacritics. Each character maps to exactly one character (NFD + removal of combining
  // marks is applied per character), so offsets in the folded string equal offsets in the input.
  let out = "";
  for (const ch of s) {
    const f = ch.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    // Keep a 1:1 code-unit mapping: fall back to the original char if folding changed its length.
    out += f.length === ch.length ? f : ch.toLowerCase().length === ch.length ? ch.toLowerCase() : ch;
  }
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface Compiled {
  term: BannedTerm;
  re: RegExp;
}

let compiled: Compiled[] | null = null;

function compile(): Compiled[] {
  if (compiled) return compiled;
  const all = [...BANNED_TERMS.es, ...BANNED_TERMS.en];
  compiled = all.map((term) => {
    // Phrases match across any run of whitespace; apostrophes match straight or curly.
    const body = fold(term.term)
      .split(/\s+/)
      .map((w) => escapeRe(w).replace(/'/g, "['’]"))
      .join("\\s+");
    // Built with the RegExp constructor so the TS target (ES2017) does not reject \p{…} / lookbehind syntax.
    return { term, re: new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, "gu") };
  });
  return compiled;
}

const EMOJI_RE = (() => {
  try {
    return new RegExp("\\p{Extended_Pictographic}", "gu");
  } catch {
    return null;
  }
})();

/**
 * Find promotional / banned wording in a piece of Solera-authored text.
 * Checks both Spanish and English lists unless `langs` is given. Also flags emojis.
 * Returns hits sorted by position; an empty array means the text passes.
 */
export function findBannedTerms(text: string, langs: Lang[] = ["es", "en"]): BannedTermHit[] {
  if (!text) return [];
  const folded = fold(text);
  const hits: BannedTermHit[] = [];
  for (const { term, re } of compile()) {
    if (!langs.includes(term.lang)) continue;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(folded))) {
      hits.push({
        term: term.term,
        lang: term.lang,
        reason: term.reason,
        match: text.slice(m.index, m.index + m[0].length),
        index: m.index,
      });
    }
  }
  if (EMOJI_RE) {
    EMOJI_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = EMOJI_RE.exec(text))) {
      // ©, ® and ™ are Extended_Pictographic but are legal/attribution marks, not emojis
      if (/^[\u00a9\u00ae\u2122]$/.test(m[0])) continue;
      hits.push({ term: m[0], lang: "es", reason: "emoji", match: m[0], index: m.index });
    }
  }
  // Drop a shorter hit fully covered by a longer one at the same place ("free" inside "free of charge").
  hits.sort((a, b) => a.index - b.index || b.match.length - a.match.length);
  return hits.filter(
    (h, i) => !hits.some((o, j) => j !== i && o.index <= h.index && o.index + o.match.length >= h.index + h.match.length && o.match.length > h.match.length),
  );
}

/** Convenience: true when the text contains no banned wording. */
export function isNeutral(text: string, langs?: Lang[]): boolean {
  return findBannedTerms(text, langs).length === 0;
}
