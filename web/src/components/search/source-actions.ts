"use server";

import { parseCriteria, toTrialRefs, trialSet, type TrialSetKind } from "@/lib/search";

const KINDS: TrialSetKind[] = ["indication", "phase", "area", "recent", "competing", "pediatric", "finished", "all", "recruiting", "industry"];

/** Registry records behind one count on a hospital's score (first 10, newest first) for a source popover.
 *  Public registry data only: id, title, status, start year and registry ids. */
export async function loadTrialRecords(siteId: string, criteria: unknown, kind: TrialSetKind) {
  if (typeof siteId !== "string" || !KINDS.includes(kind)) return { total: 0, items: [] };
  const c = criteria ? parseCriteria(criteria) : null;
  return toTrialRefs(trialSet(siteId, c?.indication ? c : null, kind), 10);
}
