import "server-only";
import fs from "node:fs";
import path from "node:path";
import { getSite } from "../data";
import type { Site } from "../types";
import type {
  PatientDataFile,
  PatientHospital,
  PatientTrial,
  PatientTrialView,
  Registry,
} from "./types";

// Patient portal dataset produced by pipeline/patient_trials.py. Read-only, cached in memory and rebuilt when
// patient_trials.json changes on disk (mtime + size), like lib/data.ts. Hospitals are joined from sites.json via getSite.

export interface PatientDataset {
  builtAt: string;
  staleAfterDays: number;
  sources: PatientDataFile["sources"];
  trials: PatientTrialView[];
  byId: Map<string, PatientTrialView>;
  /** Any registry id (NCT, EudraCT, EU CT) → trial. */
  byRegistryId: Map<string, PatientTrialView>;
  /** Site id → open trials listing that hospital. */
  bySite: Map<string, PatientTrialView[]>;
  /** Hospitals with ≥1 open trial, A–Z. */
  hospitals: PatientHospital[];
}

const FILE = path.join(process.cwd(), "data", "patient_trials.json");
let cache: PatientDataset | null = null;
let cacheStamp = "";

function stamp(): string {
  try {
    const st = fs.statSync(FILE);
    // the date is part of the stamp so the "possibly outdated" flag is recomputed each day
    return `${st.mtimeMs}:${st.size}:${new Date().toISOString().slice(0, 10)}`;
  } catch {
    return "missing";
  }
}

export function toPatientHospital(s: Site): PatientHospital {
  return {
    id: s.id,
    name: s.name,
    municipality: s.municipality,
    address: s.address,
    ownership: s.ownership,
    geo: s.geo ? { lat: s.geo.lat, lon: s.geo.lon } : null,
    image: s.image
      ? {
          url: s.image.url,
          thumbUrl: s.image.thumbUrl,
          author: s.image.author,
          license: s.image.license,
          licenseUrl: s.image.licenseUrl,
          sourcePage: s.image.sourcePage,
        }
      : null,
  };
}

export function isStale(lastUpdated: string | null, staleAfterDays: number, now = Date.now()): boolean {
  if (!lastUpdated) return true;
  const t = Date.parse(lastUpdated);
  return !Number.isFinite(t) || now - t > staleAfterDays * 86_400_000;
}

function load(): PatientDataset {
  const file = JSON.parse(fs.readFileSync(FILE, "utf8")) as PatientDataFile;
  const now = Date.now();
  const hospitals = new Map<string, PatientHospital>();
  const trials: PatientTrialView[] = [];
  for (const t of file.trials as PatientTrial[]) {
    const sites = [];
    for (const s of t.sites) {
      let h = hospitals.get(s.siteId);
      if (!h) {
        const site = getSite(s.siteId);
        if (!site) continue;
        h = toPatientHospital(site);
        hospitals.set(s.siteId, h);
      }
      sites.push({ ...s, hospital: h });
    }
    if (sites.length === 0) continue;
    trials.push({ ...t, sites, stale: isStale(t.lastUpdated, file.staleAfterDays, now) });
  }
  const byId = new Map(trials.map((t) => [t.id, t]));
  const byRegistryId = new Map<string, PatientTrialView>();
  for (const t of trials) for (const id of [t.id, ...t.registryIds]) if (!byRegistryId.has(id)) byRegistryId.set(id, t);
  const bySite = new Map<string, PatientTrialView[]>();
  for (const t of trials) {
    for (const s of t.sites) {
      const list = bySite.get(s.siteId) ?? [];
      list.push(t);
      bySite.set(s.siteId, list);
    }
  }
  return {
    builtAt: file.builtAt,
    staleAfterDays: file.staleAfterDays,
    sources: file.sources,
    trials,
    byId,
    byRegistryId,
    bySite,
    hospitals: [...hospitals.values()].sort((a, b) => a.name.localeCompare(b.name, "es")),
  };
}

export function patientDataset(): PatientDataset {
  const now = stamp();
  if (cache && now === cacheStamp) return cache;
  try {
    cache = load();
    cacheStamp = now;
  } catch (e) {
    if (!cache) throw e; // half-written file during a rebuild: keep serving the previous data
  }
  return cache;
}

/** By trial id or any of its registry ids (NCT, EudraCT, EU CT). */
export function getPatientTrial(id: string): PatientTrialView | undefined {
  const ds = patientDataset();
  return ds.byId.get(id) ?? ds.byRegistryId.get(id);
}

export function getPatientHospital(siteId: string): PatientHospital | undefined {
  return patientDataset().hospitals.find((h) => h.id === siteId);
}

export function hospitalTrials(siteId: string): PatientTrialView[] {
  return patientDataset().bySite.get(siteId) ?? [];
}

/** Hospitals that list ≥1 open trial (for the hospital filter), A–Z. */
export function patientHospitals(): PatientHospital[] {
  return patientDataset().hospitals;
}

/** Source registries and when Solera last fetched each (for footers / "about the data"). */
export function patientSources(): { builtAt: string; staleAfterDays: number; sources: PatientDataFile["sources"] } {
  const { builtAt, staleAfterDays, sources } = patientDataset();
  return { builtAt, staleAfterDays, sources };
}

export type { Registry };
