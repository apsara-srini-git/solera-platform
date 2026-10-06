/** Which part of the site a request belongs to. proxy.ts sets it as a request header so layouts can pick the document
 *  language: hospital pages (/q, /optout) are always Spanish, the patient portal defaults to Spanish, the professional
 *  side follows getProLang(). */
export const SECTION_HEADER = "x-solera-section";
export type Section = "hospital" | "patients" | "pro";

export function sectionOf(pathname: string): Section {
  if (/^\/(q|optout)(\/|$)/.test(pathname)) return "hospital";
  if (/^\/pacientes(\/|$)/.test(pathname)) return "patients";
  return "pro";
}
