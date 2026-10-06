import { ABBREVIATIONS, SPANISH_NAMES, indicationParts, normalise } from "./indication";

// "Did you mean…?" for condition searches. Pure TypeScript, no dependency, no server imports (unit-tested directly).
//
// Why string similarity and not embeddings: a typo ("alzimer", "brest cancer", "parkinsons") is a spelling problem -
// the letters are close to a known term, the meaning is not in question. Edit distance (Damerau–Levenshtein, which
// counts a swapped pair of letters as one edit) and character trigrams catch exactly that, are deterministic, explain
// themselves and run in a few milliseconds over our own vocabulary. Embeddings capture meaning ("memory loss" ≈
// dementia); they would be the tool for synonym discovery, not for spelling, and they need a model at query time.
// They could come later as a second layer; they would not replace this one.
//
// The vocabulary is built from our own data only: trial conditions, MeSH terms and MeSH ancestors, the abbreviation
// table of the sponsor search, public indications in Spanish from REec, and the common Spanish names below. Every
// suggestion is then checked against the real matcher by the caller, so we never suggest a term that finds nothing.

/** One vocabulary term. `en`: the English name to search on the sponsor side when the label is Spanish. */
export interface VocabEntry {
  key: string; // normalised (lowercase, no accents / punctuation, no possessive "s")
  label: string; // display text, as written in the registries (MeSH "Hypertension, Pulmonary" → "Pulmonary Hypertension")
  en?: string;
  /** The Spanish name of an English term, when we know one (patient portal in Spanish). */
  es?: string;
  /** Madrid trials whose conditions / MeSH terms name this term (coverage, used to rank suggestions). */
  trials: number;
  tokens: string[]; // content tokens (no stop words)
}

export interface Vocabulary {
  entries: VocabEntry[];
  byToken: Map<string, number[]>; // content token → entry indexes
  tokens: string[]; // every distinct content token
  tokenSet: Set<string>;
}

/** Common Spanish names → English names (lives in indication.ts: the matcher searches both languages). */
export { SPANISH_NAMES };

/** Words that never have to match (articles, prepositions, the possessive "s" of "Alzheimer's"). */
const STOP = new Set([
  "of", "the", "and", "with", "in", "on", "for", "to", "or", "s", "de", "del", "la", "las", "el", "los", "y", "e", "en",
  "con", "por", "para", "a", "al", "o",
]);
/** Generic words: optional on both sides, never counted as "extra" in a suggestion. */
const SOFT = new Set(["disease", "diseases", "disorder", "disorders", "enfermedad", "enfermedades", "patients", "pacientes", "syndrome", "sindrome"]);
/** MeSH categories too broad to be useful suggestions ("Neoplasms by Site", "Pathologic Processes"…). */
const BROAD = /\b(neoplasms by|pathologic|pathological conditions|signs and symptoms|disease attributes|by site|by histologic|chemically induced|physiological phenomena)\b/;

/** Normalised key: the search normalisation, minus the possessive "s" ("Alzheimer's" = "Alzheimer"). */
export function termKey(s: string): string {
  return normalise(s)
    .split(" ")
    .filter((t) => t && t !== "s")
    .join(" ");
}

/** Plural-insensitive key for merging duplicates ("Parkinsons Disease" = "Parkinson Disease"). */
const mergeKey = (key: string) =>
  key
    .split(" ")
    .map((t) => (t.length > 4 && t.endsWith("s") ? t.slice(0, -1) : t))
    .join(" ");

const contentTokens = (key: string) => key.split(" ").filter((t) => t && !STOP.has(t) && !SOFT.has(t));

/** Registry text → a clean display label: no HTML remnants, no "(AD)" / "(Disorder)" asides, no shouting capitals. */
function cleanLabel(raw: string): string {
  let s = raw.replace(/<[^>]*>?/g, " ").replace(/\s*\([^)]*\)/g, " ").replace(/[;:.]+\s*$/, "").replace(/\s+/g, " ").trim();
  if (s.length > 5 && s === s.toUpperCase()) s = s.toLowerCase();
  return s;
}

/** Identity of a suggestion: its content words, plural- and order-insensitive ("Cancer of the breast" = "Breast cancer"). */
export function sameTermKey(s: string): string {
  return mergeKey(contentTokens(termKey(s)).sort().join(" "));
}

/** "Hypertension, Pulmonary" → "Pulmonary Hypertension" (MeSH writes some terms inverted). */
function uninvert(label: string): string {
  const parts = label.split(", ");
  return parts.length === 2 && !/\d/.test(parts[1]) && parts[1].split(" ").length <= 3 ? `${parts[1]} ${parts[0]}` : label;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface VocabSource {
  trials: { conditions: string[]; mesh: string[]; meshAncestors: string[] }[];
  /** REec public indications ({es, en} pairs), when available. */
  indications?: { es?: string | null; en?: string | null }[];
}

/** Builds the condition vocabulary (callers cache it: it takes ~100 ms over the full dataset). */
export function buildVocabulary(src: VocabSource): Vocabulary {
  type Acc = { labels: Map<string, number>; trials: number; en?: string };
  const acc = new Map<string, Acc>();
  const add = (raw: string, n: number, en?: string) => {
    const label = uninvert(cleanLabel(raw));
    if (!label || label.length > 70) return;
    const key = termKey(label);
    const toks = contentTokens(key);
    if (!toks.length || toks.length > 6 || BROAD.test(key) || !/[a-z]{3}/.test(key)) return;
    const k = mergeKey(key);
    let a = acc.get(k);
    if (!a) acc.set(k, (a = { labels: new Map(), trials: 0 }));
    a.labels.set(label, (a.labels.get(label) ?? 0) + Math.max(1, n));
    a.trials += n;
    if (en && !a.en) a.en = en;
  };

  for (const t of src.trials) {
    const seen = new Set<string>();
    for (const c of [...t.conditions, ...t.mesh, ...t.meshAncestors]) {
      const k = c.trim();
      if (k && !seen.has(k.toLowerCase())) {
        seen.add(k.toLowerCase());
        add(k, 1);
      }
    }
  }
  const indic = new Map<string, { n: number; en?: string }>();
  for (const p of src.indications ?? []) {
    const es = p.es?.trim();
    if (!es) continue;
    const cur = indic.get(es) ?? { n: 0, en: p.en?.trim() || undefined };
    cur.n++;
    indic.set(es, cur);
  }
  for (const [es, { n, en }] of indic) add(es, n, en);
  for (const v of new Set(Object.values(ABBREVIATIONS))) add(v, 0);
  for (const [es, en] of SPANISH_NAMES) {
    add(es, 0, en);
    add(en, 0);
  }

  const entries: VocabEntry[] = [];
  for (const [, a] of acc) {
    const label = [...a.labels].sort((x, y) => y[1] - x[1])[0][0];
    const key = termKey(label);
    entries.push({ key, label: capitalise(label), en: a.en && termKey(a.en) !== key ? a.en : undefined, trials: a.trials, tokens: contentTokens(key) });
  }
  // a Spanish name inherits the coverage of its English name (it is a way of asking for the same trials)
  const byMerge = new Map(entries.map((e) => [mergeKey(e.key), e]));
  for (const e of entries) if (e.en) e.trials = Math.max(e.trials, byMerge.get(mergeKey(termKey(e.en)))?.trials ?? 0);
  // …and the English term learns its Spanish name (our common names first, then REec public indications)
  for (const [es, en] of SPANISH_NAMES) {
    const target = byMerge.get(mergeKey(termKey(en)));
    if (target && !target.es && mergeKey(termKey(es)) !== mergeKey(target.key)) target.es = capitalise(es);
  }
  for (const e of entries) {
    const target = e.en ? byMerge.get(mergeKey(termKey(e.en))) : undefined;
    if (target && !target.es && target !== e) target.es = e.label;
  }

  const byToken = new Map<string, number[]>();
  entries.forEach((e, i) => {
    for (const t of new Set(e.tokens)) {
      const list = byToken.get(t);
      if (list) list.push(i);
      else byToken.set(t, [i]);
    }
  });
  return { entries, byToken, tokens: [...byToken.keys()], tokenSet: new Set(byToken.keys()) };
}

// ---------- string similarity ----------

/** Damerau–Levenshtein distance (optimal string alignment: a swapped pair of letters is one edit). Stops early and
 *  returns max + 1 once the distance must exceed `max`. */
export function editDistance(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a === b) return 0;
  const n = a.length;
  const m = b.length;
  let prev2 = new Array<number>(m + 1).fill(0);
  let prev = Array.from({ length: m + 1 }, (_, j) => j);
  let cur = new Array<number>(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    [prev2, prev, cur] = [prev, cur, prev2];
  }
  return prev[m];
}

function trigrams(s: string): Map<string, number> {
  const p = `  ${s} `;
  const out = new Map<string, number>();
  for (let i = 0; i < p.length - 2; i++) {
    const g = p.slice(i, i + 3);
    out.set(g, (out.get(g) ?? 0) + 1);
  }
  return out;
}

/** Character-trigram similarity (Dice coefficient, 0..1) for whole phrases: robust to a typo in any word. */
export function trigramSimilarity(a: string, b: string): number {
  const x = trigrams(a);
  const y = trigrams(b);
  let common = 0;
  let total = 0;
  for (const [g, n] of x) {
    common += Math.min(n, y.get(g) ?? 0);
    total += n;
  }
  for (const n of y.values()) total += n;
  return total ? (2 * common) / total : 0;
}

/** Edits allowed for a typed word of this length: none for abbreviations (≤3 letters), then 1, 2, 3. */
export function maxEdits(len: number): number {
  return len <= 3 ? 0 : len <= 5 ? 1 : len <= 8 ? 2 : 3;
}

/** Vocabulary words close to a typed word, with a similarity 0..1. */
function closeTokens(v: Vocabulary, q: string): Map<string, number> {
  const out = new Map<string, number>();
  if (v.tokenSet.has(q)) out.set(q, 1);
  const max = maxEdits(q.length);
  for (const t of v.tokens) {
    if (t === q) continue;
    // a typed word that starts a longer term ("leukem" → "leukemia") is close, but not as close as the word itself
    if (q.length >= 5 && t.startsWith(q)) {
      out.set(t, 0.9);
      continue;
    }
    if (max === 0 || Math.abs(t.length - q.length) > max) continue;
    const d = editDistance(q, t, max);
    // two or more edits only when the first letter is right (typos rarely change it; keeps nonsense from matching)
    if (d > max || (d >= 2 && t[0] !== q[0])) continue;
    out.set(t, 1 - d / Math.max(q.length, t.length));
  }
  return out;
}

export interface Suggestion {
  entry: VocabEntry;
  score: number;
}

/**
 * Vocabulary terms close to what was typed, best first. Every typed content word must be close to a word of the term;
 * terms are ranked by similarity (per word and for the whole phrase), lightly penalised for extra words, and then by
 * how many Madrid trials they cover. `accept` lets the caller keep only terms that really find trials.
 */
export function suggestTerms(v: Vocabulary, query: string, opts: { limit?: number; accept?: (e: VocabEntry) => boolean } = {}): Suggestion[] {
  const limit = opts.limit ?? 3;
  const qKey = termKey(query);
  const qTokens = contentTokens(qKey);
  if (!qTokens.length || qTokens.length > 6) return [];
  const close = qTokens.map((q) => closeTokens(v, q));
  if (close.some((c) => c.size === 0)) return [];

  // candidates: terms containing a word close to the rarest typed word
  const pivot = close.reduce((best, c) => (c.size < best.size ? c : best));
  const candidates = new Set<number>();
  for (const t of pivot.keys()) for (const i of v.byToken.get(t) ?? []) candidates.add(i);

  const scored: Suggestion[] = [];
  for (const i of candidates) {
    const e = v.entries[i];
    let sum = 0;
    const used = new Set<string>();
    let ok = true;
    for (const c of close) {
      let best = 0;
      let bestTok = "";
      for (const t of e.tokens) {
        const s = c.get(t) ?? 0;
        if (s > best) [best, bestTok] = [s, t];
      }
      if (!best) {
        ok = false;
        break;
      }
      sum += best;
      used.add(bestTok);
    }
    if (!ok) continue;
    const extra = new Set(e.tokens.filter((t) => !used.has(t))).size;
    const tokenSim = sum / close.length;
    const phraseSim = trigramSimilarity(qTokens.join(" "), e.tokens.join(" "));
    const score = (0.75 * tokenSim + 0.25 * phraseSim) * Math.pow(0.9, extra);
    if (score >= 0.55) scored.push({ entry: e, score: score + 0.05 * Math.log10(1 + e.trials) });
  }
  scored.sort((a, b) => b.score - a.score || b.entry.trials - a.entry.trials);

  const out: Suggestion[] = [];
  const seen = new Set<string>();
  for (const s of scored) {
    const target = sameTermKey(s.entry.en ?? s.entry.label);
    if (seen.has(target) || target === sameTermKey(query)) continue;
    if (opts.accept && !opts.accept(s.entry)) continue;
    seen.add(target);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

/** Result of checking a sponsor's indication against the registries, part by part (comma-separated). */
export interface IndicationCheck {
  parts: {
    text: string;
    /** Registered Madrid trials this part matches. */
    trials: number;
    /** For a part with no match: close terms that do match, best first. */
    suggestions: { label: string; trials: number }[];
    /** A Spanish name that matches only a few (Spanish-language) records: the English name registries mostly use. */
    english?: { label: string; trials: number };
  }[];
  /** No part matches any trial: ranking would fall back to the area / all trials. */
  noneMatch: boolean;
}

/** Replaces one comma-separated part of an indication (keeps the others as typed). */
export function replacePart(indication: string, index: number, next: string): string {
  const parts = indication.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
  if (index < 0 || index >= parts.length) return indication;
  parts[index] = next;
  return [...new Set(parts)].join(", ");
}

/**
 * Checks each comma-separated part of an indication. `count` = registered Madrid trials a text matches (the search's own
 * matcher). A part that matches no trial gets suggestions (close terms that do match), so a typo never silently turns
 * into an area-wide or all-trials ranking. A Spanish name that matches only Spanish-language records gets the English
 * name registries mostly use.
 */
export function checkIndicationWith(v: Vocabulary, indication: string, count: (text: string) => number): IndicationCheck {
  const all = indicationParts(indication);
  const typed = new Set(all.map(sameTermKey));
  const parts = all.map((text) => {
    const trials = count(text);
    const part: IndicationCheck["parts"][number] = { text, trials, suggestions: [] };
    if (trials === 0) {
      part.suggestions = suggestTerms(v, text, { limit: 3, accept: (e) => count(e.en ?? e.label) > 0 }).map((s) => {
        const label = capitalise(s.entry.en ?? s.entry.label);
        return { label, trials: count(label) };
      });
    } else {
      const key = sameTermKey(text);
      const es = v.entries.find((e) => e.en && sameTermKey(e.label) === key);
      if (es?.en && !typed.has(sameTermKey(es.en))) {
        const n = count(es.en);
        if (n > trials * 2) part.english = { label: es.en, trials: n };
      }
    }
    return part;
  });
  return { parts, noneMatch: parts.length > 0 && parts.every((p) => p.trials === 0) };
}
