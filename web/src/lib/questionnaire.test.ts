// Unit tests for the confidentiality check. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCriteria } from "./criteria";
import { blindedSummary, confidentialTerms, findLeaks, generateQuestions, scoreResponse } from "./questionnaire";
import type { TrialCriteria } from "./types";

const acme = { sponsorName: "Acme Pharma SL", drugName: "Blue Moon", protocolCode: "ACME-301", otherTerms: ["Acme Oncology Program"] };
const demo = { sponsorName: "Demo Biotech SL", drugName: "Blue Moon", protocolCode: "DB-2024-07", otherTerms: ["Demo Biotech Oncology Program"] };

test("confidentialTerms strips legal suffixes and protocol prefixes", () => {
  const terms = confidentialTerms({ sponsorName: "Demo Biotech SL", drugName: "AZD9291 (osimertinib)", protocolCode: "Protocol No. SLR-101" });
  assert.ok(terms.includes("Demo Biotech"));
  assert.ok(terms.includes("AZD9291"));
  assert.ok(terms.includes("osimertinib"));
  assert.ok(terms.includes("SLR-101"));
});

test("every kept-out term is reported", () => {
  assert.deepEqual(findLeaks(["Promotor: Acme Pharma"], acme), ["Acme Pharma"]);
  assert.deepEqual(findLeaks(["Nothing confidential here"], acme), []);
});

test("matching ignores case, accents and punctuation", () => {
  const conf = { drugName: "Lunámab", protocolCode: "SLR-101" };
  assert.deepEqual(findLeaks(["Estudio con LUNAMAB"], conf), ["Lunámab"]);
  assert.deepEqual(findLeaks(["Código slr 101"], conf), ["SLR-101"]);
  assert.deepEqual(findLeaks(["Código SLR101"], conf), ["SLR-101"]);
  assert.deepEqual(findLeaks(["Código XSLR-101B"], conf), ["SLR-101"]);
});

test("short plain words only match whole words", () => {
  assert.deepEqual(findLeaks(["Acmeology is unrelated"], { sponsorName: "Acme" }), []);
});

test("the company name is always kept out (no display-name allowance)", () => {
  assert.deepEqual(findLeaks(["Promotor / Sponsor: Acme Pharma"], acme), ["Acme Pharma"]);
  assert.deepEqual(findLeaks(["Promotor: Demo Biotech."], demo), ["Demo Biotech"]);
  assert.deepEqual(findLeaks(["Protocolo ACME301"], acme), ["ACME-301"]);
  const leaks = findLeaks(["¿Ha participado en el Demo Biotech Oncology Program?"], demo);
  assert.ok(leaks.includes("Demo Biotech Oncology Program"));
  assert.ok(leaks.includes("Demo Biotech"));
});

// ---------- recruitment target: optional, no silent default ----------

const base: TrialCriteria = { indication: "asthma", area: "", phase: "PHASE3", population: "adult", equipment: [], ownership: "any" };

test("parseCriteria leaves the target unset unless given", () => {
  const c = parseCriteria({ indication: "asthma" });
  assert.equal(c.targetPatientsPerSite, undefined);
  assert.equal(c.recruitmentMonths, undefined);
  assert.ok(!("targetPatientsPerSite" in c) && !("recruitmentMonths" in c));
  assert.equal(parseCriteria({ indication: "asthma", targetPatientsPerSite: "", recruitmentMonths: null }).targetPatientsPerSite, undefined);
  const set = parseCriteria({ indication: "asthma", targetPatientsPerSite: 8, recruitmentMonths: 18 });
  assert.equal(set.targetPatientsPerSite, 8);
  assert.equal(set.recruitmentMonths, 18);
  // stored projects keep their values
  assert.equal(parseCriteria({ indication: "asthma", targetPatientsPerSite: 10, recruitmentMonths: 12 }).recruitmentMonths, 12);
});

test("without a target the summary has no target line and the commitment question has no months", () => {
  const summary = blindedSummary(base);
  assert.ok(!summary.some((s) => s.es.startsWith("Objetivo por centro") || s.es.startsWith("Periodo")));
  const q = generateQuestions(base).find((x) => x.id === "commitment")!;
  assert.equal(q.es, "¿Cuántos pacientes podría reclutar de forma realista durante el periodo de reclutamiento?");
  assert.ok(!/\d/.test(q.en));
});

test("with a target the summary and question use it", () => {
  const c = { ...base, targetPatientsPerSite: 10, recruitmentMonths: 12 };
  assert.ok(blindedSummary(c).some((s) => s.es === "Objetivo por centro: 10 pacientes en 12 meses"));
  assert.equal(generateQuestions(c).find((x) => x.id === "commitment")!.es, "¿Cuántos pacientes podría reclutar de forma realista en 12 meses?");
});

test("the match score does not penalise a commitment when no target is set", () => {
  const questions = generateQuestions(base);
  const answers = { interest: "yes", pi: "yes", commitment: "3", coordinator: "yes", pharmacy: "yes", phase_experience: "yes" };
  const unset = scoreResponse(questions, answers, base, 50);
  const tiny = scoreResponse(questions, answers, { ...base, targetPatientsPerSite: 30, recruitmentMonths: 12 }, 50);
  assert.ok(unset.responseScore > tiny.responseScore, `${unset.responseScore} > ${tiny.responseScore}`);
  assert.ok(unset.reasons.some((r) => r.includes("no target set")));
  assert.ok(!unset.flags.some((f) => f.includes("eligible pool")));
});
