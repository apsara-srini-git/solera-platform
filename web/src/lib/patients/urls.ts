import "server-only";
import { patientQueryString } from "./search";
import type { PatientQuery } from "./types";

// URL helpers for the patient portal. All state lives in the URL (GET), nothing is stored.

export type PortalView = "list" | "map" | "split";
export const VIEWS: readonly PortalView[] = ["list", "map", "split"];

export function parseView(v: string | string[] | undefined): PortalView {
  const s = Array.isArray(v) ? v[0] : v;
  return VIEWS.includes(s as PortalView) ? (s as PortalView) : "list";
}

/** /pacientes search URL keeping the current filters, with overrides; `view` is kept unless it is the default. */
export function searchHref(q: PatientQuery, overrides: Partial<PatientQuery> = {}, view: PortalView = "list"): string {
  const qs = patientQueryString(q, { page: 1, ...overrides });
  if (view === "list") return `/pacientes${qs}`;
  return `/pacientes${qs ? `${qs}&` : "?"}view=${view}`;
}

export const trialHref = (id: string) => `/pacientes/ensayos/${encodeURIComponent(id)}`;
export const hospitalHref = (id: string) => `/pacientes/hospitales/${encodeURIComponent(id)}`;
