import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Site, Trial } from "./types";

// Reference data produced by pipeline/build_data.py. Read-only and cached in memory; the cache is rebuilt when
// sites.json / trials.json / build_report.json change on disk (mtime + size), so a pipeline rebuild shows up without
// restarting the server.
interface Dataset {
  sites: Site[];
  siteById: Map<string, Site>;
  trials: Trial[];
  trialsBySite: Map<string, Trial[]>;
  report: { builtOn: string; sources: Record<string, string>; trials: number; hospitals: number };
}

const FILES = ["sites.json", "trials.json", "build_report.json"] as const;
let cache: Dataset | null = null;
let cacheStamp = "";

function filePath(file: string): string {
  return path.join(process.cwd(), "data", file);
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(filePath(file), "utf8"));
}

/** Cheap fingerprint of the data files: one stat() each, no reads. */
function stamp(): string {
  return FILES.map((f) => {
    try {
      const st = fs.statSync(filePath(f));
      return `${st.mtimeMs}:${st.size}`;
    } catch {
      return "missing";
    }
  }).join("|");
}

export function dataset(): Dataset {
  const now = stamp();
  if (cache && now === cacheStamp) return cache;
  // a rebuild in progress (half-written JSON) keeps serving the previous dataset until the files parse again
  try {
    cache = load();
    cacheStamp = now;
  } catch (e) {
    if (!cache) throw e;
  }
  return cache;
}

function load(): Dataset {
  const sites = readJson<Site[]>("sites.json");
  const trials = readJson<Trial[]>("trials.json");
  const trialsBySite = new Map<string, Trial[]>();
  for (const t of trials) {
    for (const s of t.sites) {
      const list = trialsBySite.get(s.siteId) ?? [];
      list.push(t);
      trialsBySite.set(s.siteId, list);
    }
  }
  return {
    sites,
    siteById: new Map(sites.map((s) => [s.id, s])),
    trials,
    trialsBySite,
    report: readJson("build_report.json"),
  };
}

export function getSite(id: string): Site | undefined {
  return dataset().siteById.get(id);
}

export function siteTrials(id: string): Trial[] {
  return dataset().trialsBySite.get(id) ?? [];
}
