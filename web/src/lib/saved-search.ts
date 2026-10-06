import { parseCriteria } from "./criteria";
import type { TrialCriteria } from "./types";

// Saved searches as small JSON files kept on the user's own device: no account, nothing stored by Solera.
// Pure and client-safe: files are written and read in the browser; the server re-validates whatever is searched.

export const SAVED_SEARCH_VERSION = 1;
/** Saved search files are tiny; anything bigger is not one of ours. */
export const MAX_SAVED_SEARCH_BYTES = 100_000;

export type SavedSearchError = "too-large" | "not-json" | "wrong-kind" | "newer-version" | "invalid";

const slug = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "") || "search";

const today = (d: Date) => d.toISOString().slice(0, 10);

function readEnvelope(text: string, kind: string): { ok: true; o: Record<string, unknown> } | { ok: false; error: SavedSearchError } {
  if (text.length > MAX_SAVED_SEARCH_BYTES) return { ok: false, error: "too-large" };
  let o: unknown;
  try {
    o = JSON.parse(text);
  } catch {
    return { ok: false, error: "not-json" };
  }
  if (!o || typeof o !== "object" || Array.isArray(o)) return { ok: false, error: "invalid" };
  const rec = o as Record<string, unknown>;
  if (rec.kind !== kind) return { ok: false, error: typeof rec.kind === "string" && rec.kind.endsWith("-search") ? "wrong-kind" : "invalid" };
  if (typeof rec.version !== "number" || rec.version < 1) return { ok: false, error: "invalid" };
  if (rec.version > SAVED_SEARCH_VERSION) return { ok: false, error: "newer-version" };
  return { ok: true, o: rec };
}

// ---------- sponsor search (site feasibility) ----------

/**
 * The sponsor's search as a file. Only the blinded criteria, re-validated with parseCriteria: never the drug, sponsor,
 * protocol code or kept-out terms (those are not part of TrialCriteria and are never sent to the browser's search form).
 */
export function sponsorSearchFile(c: TrialCriteria, now = new Date()): { filename: string; json: string } {
  const criteria = parseCriteria(c);
  const body = { version: SAVED_SEARCH_VERSION, kind: "sponsor-search", criteria, createdAt: now.toISOString() };
  return { filename: `solera-search-${slug(criteria.indication)}-${today(now)}.json`, json: JSON.stringify(body, null, 2) + "\n" };
}

export function parseSponsorSearchFile(text: string): { ok: true; criteria: TrialCriteria } | { ok: false; error: SavedSearchError } {
  const env = readEnvelope(text, "sponsor-search");
  if (!env.ok) return env;
  const raw = env.o.criteria;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "invalid" };
  const criteria = parseCriteria(raw);
  if (!criteria.indication) return { ok: false, error: "invalid" };
  return { ok: true, criteria };
}

// ---------- patient portal search ----------

/** The patient portal's search: the same values as its URL (q, filters, sort, view). */
export interface PatientSavedQuery {
  q?: string;
  age?: "child" | "adult" | "older";
  area?: string;
  hospital?: string;
  status?: "recruiting" | "not_yet";
  stale?: boolean;
  healthy?: boolean;
  sort?: "updated" | "alpha" | "hospitals";
  view?: "list" | "map" | "split";
}

const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined => (allowed.includes(v as T) ? (v as T) : undefined);
const idLike = (v: unknown, max: number) => (typeof v === "string" && /^[A-Za-z0-9_-]+$/.test(v) && v.length <= max ? v : undefined);

/** Untrusted object → a clean saved patient query (unknown values dropped; the portal re-checks them all). */
export function cleanPatientQuery(o: Record<string, unknown>): PatientSavedQuery {
  const q = typeof o.q === "string" ? o.q.trim().slice(0, 120) : "";
  const out: PatientSavedQuery = {};
  if (q) out.q = q;
  const age = pick(o.age, ["child", "adult", "older"] as const);
  const status = pick(o.status, ["recruiting", "not_yet"] as const);
  const sort = pick(o.sort, ["updated", "alpha", "hospitals"] as const);
  const view = pick(o.view, ["list", "map", "split"] as const);
  const area = idLike(o.area, 60);
  const hospital = idLike(o.hospital, 80);
  if (age) out.age = age;
  if (area) out.area = area;
  if (hospital) out.hospital = hospital;
  if (status) out.status = status;
  if (o.stale === true) out.stale = true;
  if (o.healthy === true) out.healthy = true;
  if (sort && sort !== "updated") out.sort = sort;
  if (view && view !== "list") out.view = view;
  return out;
}

export function patientSearchFile(query: PatientSavedQuery, now = new Date()): { filename: string; json: string } {
  const q = cleanPatientQuery(query as Record<string, unknown>);
  const body = { version: SAVED_SEARCH_VERSION, kind: "patient-search", query: q, createdAt: now.toISOString() };
  return { filename: `solera-search-${slug(q.q ?? "trials")}-${today(now)}.json`, json: JSON.stringify(body, null, 2) + "\n" };
}

export function parsePatientSearchFile(text: string): { ok: true; query: PatientSavedQuery } | { ok: false; error: SavedSearchError } {
  const env = readEnvelope(text, "patient-search");
  if (!env.ok) return env;
  const raw = env.o.query;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "invalid" };
  return { ok: true, query: cleanPatientQuery(raw as Record<string, unknown>) };
}

/** Saved patient query → the portal URL (/pacientes?…), the same keys the portal reads. */
export function patientSearchUrl(q: PatientSavedQuery): string {
  const sp = new URLSearchParams();
  if (q.q) sp.set("q", q.q);
  if (q.age) sp.set("age", q.age);
  if (q.area) sp.set("area", q.area);
  if (q.hospital) sp.set("hospital", q.hospital);
  if (q.status) sp.set("status", q.status);
  if (q.stale) sp.set("stale", "1");
  if (q.healthy) sp.set("healthy", "1");
  if (q.sort && q.sort !== "updated") sp.set("sort", q.sort);
  if (q.view && q.view !== "list") sp.set("view", q.view);
  const s = sp.toString();
  return s ? `/pacientes?${s}` : "/pacientes";
}

/** Saves a text file on the user's device (browser only). */
export function downloadTextFile(filename: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
