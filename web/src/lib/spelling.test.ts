// Unit tests for "Did you mean…?" (condition spelling). Run with: npm test
// Uses the real datasets in data/ so the suggestions are the ones sponsors and patients actually see.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { indicationMatcher } from "./indication";
import { buildVocabulary, checkIndicationWith, editDistance, replacePart, suggestTerms, trigramSimilarity } from "./spelling";
import type { Trial } from "./types";

const read = (f: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", f), "utf8"));
const trials: Trial[] = read("trials.json");
const patient: { conditions: string[]; mesh: string[]; meshAncestors: string[]; publicIndication?: { es?: string; en?: string } }[] =
  read("patient_trials.json").trials;
const vocab = buildVocabulary({ trials: [...trials, ...patient], indications: patient.map((t) => ({ es: t.publicIndication?.es, en: t.publicIndication?.en })) });

const counts = new Map<string, number>();
const count = (s: string) => {
  if (!counts.has(s)) counts.set(s, trials.filter(indicationMatcher(s)).length);
  return counts.get(s)!;
};
/** What the sponsor search suggests for a text (labels, best first). */
const suggest = (q: string) => suggestTerms(vocab, q, { limit: 3, accept: (e) => count(e.en ?? e.label) > 0 }).map((s) => (s.entry.en ?? s.entry.label).toLowerCase());
const check = (q: string) => checkIndicationWith(vocab, q, count);

test("edit distance counts a swapped pair of letters as one edit", () => {
  assert.equal(editDistance("alzimer", "alzheimer"), 2);
  assert.equal(editDistance("leukemai", "leukemia"), 1);
  assert.equal(editDistance("brest", "breast"), 1);
  assert.equal(editDistance("abc", "xyz", 1), 2); // early exit: more than max
  assert.ok(trigramSimilarity("breast cancer", "brest cancer") > 0.7);
  assert.ok(trigramSimilarity("breast cancer", "heart failure") < 0.2);
});

test("alzimer → Alzheimer", () => {
  assert.match(suggest("alzimer")[0], /^alzheimer/);
  const c = check("alzimer");
  assert.equal(c.noneMatch, true);
  assert.match(c.parts[0].suggestions[0].label, /^Alzheimer/);
  assert.ok(c.parts[0].suggestions[0].trials > 0);
});

test("parkinsons → Parkinson", () => {
  assert.ok(suggest("parkinsons").some((s) => s.startsWith("parkinson")));
  assert.equal(check("parkinsons").noneMatch, false); // the search already handles the plural: no warning
});

test("esclerosis multiple (Spanish, no accent) → multiple sclerosis", () => {
  assert.equal(suggest("esclerosis multiple")[0], "multiple sclerosis");
  assert.equal(suggest("esclerosis multple")[0], "multiple sclerosis");
  // the matcher already searches the English name too: no warning and no "Also search" link
  const c = check("esclerosis multiple");
  assert.equal(c.noneMatch, false);
  assert.equal(c.parts[0].english, undefined);
});

test("cancer de pulmon → lung cancer", () => {
  assert.equal(suggest("cancer de pulmon")[0], "lung cancer");
  assert.equal(suggest("cáncer de pulmón")[0], "lung cancer");
});

test("brest cancer → Breast cancer", () => {
  assert.equal(suggest("brest cancer")[0], "breast cancer");
  const c = check("brest cancer");
  assert.equal(c.noneMatch, true);
  assert.equal(c.parts[0].suggestions[0].label, "Breast Cancer");
});

test("nonsense gets no suggestion", () => {
  for (const q of ["xqzvbnm", "asdfgh", "qwerty uiop", "zzzz"]) assert.deepEqual(suggest(q), [], q);
  const c = check("xqzvbnm");
  assert.equal(c.noneMatch, true);
  assert.deepEqual(c.parts[0].suggestions, []);
});

test("correct terms get no warning", () => {
  for (const q of ["Alzheimer disease", "breast cancer", "multiple sclerosis", "heart failure", "non-small cell lung cancer, NSCLC", "asthma"]) {
    const c = check(q);
    assert.equal(c.noneMatch, false, q);
    assert.ok(c.parts.every((p) => p.trials > 0 && p.suggestions.length === 0), q);
  }
});

test("abbreviations are unaffected", () => {
  for (const q of ["NSCLC", "ELA", "MS", "COPD", "AML"]) {
    const c = check(q);
    assert.equal(c.noneMatch, false, q);
    assert.equal(c.parts[0].suggestions.length, 0, q);
  }
  // short words are never fuzzy-corrected
  assert.deepEqual(suggest("ms"), []);
});

test("only the part that matches nothing is flagged", () => {
  const c = check("Alzheimer disease, alzimer");
  assert.equal(c.noneMatch, false);
  assert.ok(c.parts[0].trials > 0 && c.parts[0].suggestions.length === 0);
  assert.equal(c.parts[1].trials, 0);
  assert.ok(c.parts[1].suggestions.length > 0);
});

test("replacePart swaps one comma-separated part", () => {
  assert.equal(replacePart("NSCLC, brest cancer", 1, "Breast Cancer"), "NSCLC, Breast Cancer");
  assert.equal(replacePart("alzimer", 0, "Alzheimer Disease"), "Alzheimer Disease");
});

/** Ids of the Madrid trials a text matches. */
const matched = (s: string) => trials.filter(indicationMatcher(s)).map((t) => t.id).sort();

test("Spanish and English condition names find the same trials", () => {
  for (const [es, en] of [
    ["esclerosis múltiple", "multiple sclerosis"],
    ["cáncer de pulmón", "lung cancer"],
    ["insuficiencia cardiaca", "heart failure"],
    ["Enfermedad de Alzheimer", "Alzheimer's disease"],
  ]) {
    const a = matched(es);
    const b = matched(en);
    assert.ok(b.length > 0, en);
    assert.deepEqual(a, b, `${es} / ${en}`);
  }
  // unaccented and abbreviated forms too
  assert.deepEqual(matched("esclerosis multiple"), matched("multiple sclerosis"));
  assert.deepEqual(matched("MS"), matched("esclerosis múltiple"));
  // the Spanish name now finds at least as much as the English-only search did
  assert.ok(matched("esclerosis múltiple").length >= 100);
});
