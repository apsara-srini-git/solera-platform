// Unit tests for the professional-side language helpers. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { fmtNum, joinList, ordinal, plural, preferredFromAcceptLanguage } from "./pro";

test("Accept-Language: Spanish only when preferred over English", () => {
  assert.equal(preferredFromAcceptLanguage("es-ES,es;q=0.9,en;q=0.8"), "es");
  assert.equal(preferredFromAcceptLanguage("en-GB,en;q=0.9,es;q=0.8"), "en");
  assert.equal(preferredFromAcceptLanguage("fr-FR,fr;q=0.9,es;q=0.7,en;q=0.5"), "es");
  assert.equal(preferredFromAcceptLanguage("de-DE"), null);
  assert.equal(preferredFromAcceptLanguage(""), null);
  assert.equal(preferredFromAcceptLanguage(null), null);
  assert.equal(preferredFromAcceptLanguage("es;q=0,en"), "en");
});

test("numbers, plurals and lists per language", () => {
  assert.equal(fmtNum(12345, "en"), "12,345");
  assert.equal(fmtNum(12345, "es"), "12.345");
  assert.equal(plural(1, "ensayo", undefined, "es"), "1 ensayo");
  assert.equal(plural(3, "hospital", "hospitales", "es"), "3 hospitales");
  assert.equal(joinList(["CT", "MRI", "PET"], "en", "or"), "CT, MRI or PET");
  assert.equal(joinList(["TAC", "PET"], "es"), "TAC y PET");
  assert.equal(ordinal(2, "en"), "2nd");
  assert.equal(ordinal(2, "es"), "2.º");
});
