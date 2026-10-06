// Unit tests for the public hospital contacts (data/hospital_contacts.json). Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { CONTACT_KINDS, bestContactIndex, findPublicContact, looksPersonal, parseContactRecord, type ContactsFile } from "./contact-kinds";
import { institutionalDomain } from "./question-library";

const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "hospital_contacts.json"), "utf8")) as ContactsFile;
const sites = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "sites.json"), "utf8")) as { id: string }[];
const all = data.hospitals.flatMap((h) => h.contacts.map((c) => ({ h, c })));

test("contacts file covers every hospital in the dataset, sorted by id", () => {
  assert.deepEqual(data.hospitals.map((h) => h.id).sort(), sites.map((s) => s.id).sort());
  assert.deepEqual(data.hospitals.map((h) => h.id), [...data.hospitals.map((h) => h.id)].sort());
});

test("every offered contact email is on an institutional domain (webmail is kept on file but never offered)", () => {
  const rejected = all.filter(({ c }) => !institutionalDomain(c.email)).map(({ c }) => c.email);
  // the only webmail address in the curated file is a gmail secretariat; the loader filters it out
  assert.ok(rejected.every((e) => /@gmail\.com$/i.test(e)), `non-webmail address rejected: ${rejected.join(", ")}`);
  assert.ok(rejected.length <= 1);
});

test("no contact email looks like a personal mailbox", () => {
  const personal = all.filter(({ c }) => looksPersonal(c.email)).map(({ c }) => c.email);
  assert.deepEqual(personal, []);
});

test("personal-address heuristic", () => {
  assert.ok(looksPersonal("maria.lopez@salud.madrid.org"));
  assert.ok(looksPersonal("j.perez@hospital.es"));
  assert.ok(looksPersonal("Jose_Garcia@fjd.es"));
  assert.ok(!looksPersonal("ensayos.imas12@h12o.es"));
  assert.ok(!looksPersonal("secretaria.fundacion@vithas.es"));
  assert.ok(!looksPersonal("investigacion.hus@salud.madrid.org"));
});

test("every contact has a known kind, a source page and a check date", () => {
  for (const { h, c } of all) {
    assert.ok((CONTACT_KINDS as readonly string[]).includes(c.kind), `${h.id} ${c.email}: kind ${c.kind}`);
    assert.match(c.sourceUrl, /^https:\/\//, `${h.id} ${c.email}: sourceUrl`);
    assert.ok(c.sourceTitle && c.label_es && c.label_en && c.description_es && c.description_en, `${h.id} ${c.email}: text`);
    assert.match(c.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(["high", "medium", "low"].includes(c.confidence));
  }
});

test("suggested contact: confidence first, then kind; ethics committees never suggested", () => {
  const byId = new Map(data.hospitals.map((h) => [h.id, h.contacts]));
  const best = (id: string) => byId.get(id)![bestContactIndex(byId.get(id)!)]?.email;
  assert.equal(best("280246"), "gestioncontratos@fibhgm.org"); // Gregorio Marañón: high-confidence contracts office
  assert.equal(best("280989"), "coordinaciondeestudiosclinicos@iisgetafe.com"); // Getafe: feasibility committee
  assert.equal(best("280127"), "investigacionclinica.hlpr@salud.madrid.org"); // La Princesa: trials unit
  assert.equal(bestContactIndex([{ kind: "ceim_secretariat", confidence: "high" }]), -1);
  assert.equal(bestContactIndex([]), -1);
});

test("find a listed contact case-insensitively; parse the stored record defensively", () => {
  const hm = data.hospitals.find((h) => h.id === "281225")!.contacts;
  assert.equal(findPublicContact(hm, " startupfihm@FUNDACIONHM.com ")?.kind, "clinical_trials_unit");
  assert.equal(findPublicContact(hm, "someone@fundacionhm.com"), undefined);
  assert.equal(parseContactRecord(null), null);
  assert.equal(parseContactRecord("{bad"), null);
  assert.equal(parseContactRecord('{"kind":"other","label_en":"x","label_es":"x"}'), null);
  assert.equal(parseContactRecord('{"kind":"research_foundation","label_en":"A","label_es":"B"}')?.label_en, "A");
});
