import type { PhaseOption, TrialCriteria } from "./types";
import { AREAS, EQUIPMENT } from "./types";

// Validation of untrusted search criteria (URL, saved search files, server actions). Pure: safe in the browser too.

const PHASE_OPTIONS: readonly PhaseOption[] = ["PHASE1", "PHASE1_2", "PHASE2", "PHASE2_3", "PHASE3", "PHASE4"];
const MAX_LIST = 8;
const MAX_TEXT = 200;

/** Untrusted {en, es} list → at most 8 items of ≤200 chars, strings only, blanks and duplicates dropped. */
function bilingualList(v: unknown): { en: string; es: string }[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: { en: string; es: string }[] = [];
  for (const k of v) {
    if (!k || typeof k !== "object") continue;
    const { en, es } = k as Record<string, unknown>;
    if (typeof en !== "string" || typeof es !== "string") continue;
    const item = { en: en.trim().slice(0, MAX_TEXT).trim(), es: es.trim().slice(0, MAX_TEXT).trim() };
    if (!item.en || !item.es || seen.has(item.en.toLowerCase())) continue;
    seen.add(item.en.toLowerCase());
    out.push(item);
    if (out.length >= MAX_LIST) break;
  }
  return out;
}

const optionalText = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, MAX_TEXT).trim() || undefined : undefined);

export function parseCriteria(input: unknown): TrialCriteria {
  const o = (input ?? {}) as Record<string, unknown>;
  // optional: undefined (not set) unless a positive number is given - never a silent default
  const num = (v: unknown, max: number) => {
    if (v === undefined || v === null || (typeof v === "string" && !v.trim())) return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n >= 1 ? Math.min(max, Math.round(n)) : undefined;
  };
  const phase = PHASE_OPTIONS.includes(o.phase as PhaseOption) ? (o.phase as PhaseOption) : "PHASE3";
  const population = ["adult", "pediatric", "all"].includes(o.population as string) ? (o.population as TrialCriteria["population"]) : "adult";
  const ownership = ["any", "public", "private"].includes(o.ownership as string) ? (o.ownership as TrialCriteria["ownership"]) : "any";
  const criteria: TrialCriteria = {
    indication: String(o.indication ?? "").slice(0, MAX_TEXT).trim(),
    area: typeof o.area === "string" && (o.area === "" || Object.hasOwn(AREAS, o.area)) ? o.area : "",
    phase,
    population,
    equipment: Array.isArray(o.equipment) ? [...new Set(o.equipment.filter((e): e is string => typeof e === "string" && Object.hasOwn(EQUIPMENT, e)))] : [],
    ownership,
    keyCriteria: bilingualList(o.keyCriteria),
    otherRequirements: bilingualList(o.otherRequirements),
  };
  // recruitment target only when set (trial details on the project page, or stated in an uploaded protocol)
  const target = num(o.targetPatientsPerSite, 1000);
  const months = num(o.recruitmentMonths, 60);
  if (target !== undefined) criteria.targetPatientsPerSite = target;
  if (months !== undefined) criteria.recruitmentMonths = months;
  // optional free text only when filled, so older stored criteria still compare equal (toggleShortlist)
  const areaOther = optionalText(o.areaOther);
  const populationOther = optionalText(o.populationOther);
  if (areaOther) criteria.areaOther = areaOther;
  // only stored when on, so criteria saved before the option existed still compare equal (toggleShortlist)
  if (o.equipmentStrict === true && criteria.equipment.length > 0) criteria.equipmentStrict = true;
  if (populationOther) criteria.populationOther = populationOther;
  return criteria;
}
