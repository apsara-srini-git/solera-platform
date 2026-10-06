import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { AREAS, EQUIPMENT, type ConfidentialInfo, type PhaseOption, type TrialCriteria } from "./types";

// Pulls trial criteria out of a protocol / synopsis so the sponsor can review a pre-filled search form.
// The document is processed in memory; whether it is stored is decided by the caller (consent).

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const ACCEPTED_TYPES = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
} as const;

const AREA_KEYS = Object.keys(AREAS);
const EQUIPMENT_KEYS = Object.keys(EQUIPMENT);
const PHASE_KEYS = ["PHASE1", "PHASE1_2", "PHASE2", "PHASE2_3", "PHASE3", "PHASE4"] as const satisfies readonly PhaseOption[];
const POPULATION_KEYS = ["adult", "pediatric", "all"] as const;

// Allowed values are listed in the descriptions (the SDK does not enforce enums server-side), and every
// value is re-checked in toCriteria, so an unexpected label degrades to "not filled" instead of failing.

const Extraction = z.object({
  isProtocol: z.boolean().describe("false if the document is not a clinical trial protocol or synopsis"),
  indication: z
    .string()
    .describe("The disease studied, in English, as registries name it, WITHOUT biomarker, stage or line-of-therapy qualifiers, e.g. 'non-small cell lung cancer' (qualifiers go in keyCriteria)"),
  area: z.string().nullable().describe(`One of: ${AREA_KEYS.join(", ")}`),
  phase: z
    .string()
    .nullable()
    .describe(`One of: ${PHASE_KEYS.join(", ")}. Use PHASE1_2 for a combined phase I/II (1b/2) design and PHASE2_3 for a combined phase II/III (seamless 2/3) design.`),
  population: z.string().nullable().describe(`One of: ${POPULATION_KEYS.join(", ")}`),
  targetEnrolmentTotal: z.number().int().nullable(),
  plannedSites: z.number().int().nullable(),
  recruitmentMonths: z.number().int().nullable(),
  equipment: z.array(z.string()).describe(`Only equipment the protocol requires at the site. Each one of: ${EQUIPMENT_KEYS.join(", ")}`),
  keyCriteria: z
    .array(z.object({ en: z.string(), es: z.string() }))
    .describe("Up to 4 inclusion/exclusion criteria that most limit how many patients a site can find, phrased as a patient characteristic, in English and Spanish. No drug or sponsor names."),
  confidential: z.object({
    drugName: z.string().nullable().describe("Investigational product name(s) or compound code(s)"),
    sponsorName: z.string().nullable(),
    protocolCode: z.string().nullable().describe("Protocol number / study code, EudraCT or EU CT number"),
  }),
  evidence: z
    .array(z.object({ field: z.string(), quote: z.string() }))
    .describe("For each filled field, the shortest verbatim quote from the document that supports it"),
});
export type ProtocolExtraction = z.infer<typeof Extraction>;

const INSTRUCTIONS = `You extract feasibility criteria from a clinical trial protocol or protocol synopsis for a site-selection tool in Madrid.
Use only what the document states. Leave a field null (or an empty list) when the document does not state it. Never guess.
- indication: the plain disease name used in trial registries (e.g. "non-small cell lung cancer", "multiple sclerosis"). It is matched against registry conditions, so leave out biomarkers, stage and treatment line; put those in keyCriteria.
- area: the best-fitting therapeutic area key, or null.
- population: "pediatric" if only under-18s, "all" if both children and adults, otherwise "adult".
- equipment: only items the protocol requires sites to have (e.g. PET for PET-CT scans, linac for radiotherapy, dialysis). Map to the given keys.
- keyCriteria: the few eligibility criteria that most restrict recruitment (e.g. a biomarker, a line of therapy, a severity threshold). Write them as patient characteristics ("EGFR exon 19 deletion or L858R", "no prior systemic therapy for advanced disease"). Never include drug names, compound codes or the sponsor.
- confidential: the investigational product names/codes, the sponsor, and the protocol/registry codes, exactly as written.
- evidence: one short verbatim quote per field you filled.`;

export type ProtocolErrorCode =
  | "cancelled"
  | "notConfigured"
  | "unreadable"
  | "rejected"
  | "rateLimited"
  | "unavailable"
  | "noCriteria"
  | "refused"
  | "notProtocol";

/** A failure the sponsor should see. `message` is the English text; the API route shows `code` in the UI language. */
export class ProtocolError extends Error {
  readonly code: ProtocolErrorCode;
  constructor(code: ProtocolErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export async function extractFromProtocol(input: { pdf?: Buffer; text?: string }, signal?: AbortSignal): Promise<ProtocolExtraction> {
  // 2 attempts × 120 s + backoff stays inside the route's 300 s maxDuration; aborts if the browser disconnects.
  const client = new Anthropic({ maxRetries: 1, timeout: 120_000 });
  const content: Anthropic.Beta.BetaContentBlockParam[] = input.pdf
    ? [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: input.pdf.toString("base64") } },
        { type: "text", text: "Extract the feasibility criteria from this protocol." },
      ]
    : [{ type: "text", text: `<protocol>\n${input.text}\n</protocol>\n\nExtract the feasibility criteria from this protocol.` }];

  let response;
  try {
    response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "medium", format: betaZodOutputFormat(Extraction) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: INSTRUCTIONS,
      messages: [{ role: "user", content }],
    }, { signal });
  } catch (e) {
    if (e instanceof Anthropic.APIUserAbortError) throw new ProtocolError("cancelled", "Upload cancelled.");
    if (e instanceof Anthropic.APIError) {
      const detail = (e.error as { error?: { type?: string; message?: string } } | undefined)?.error;
      console.error("protocol extraction API error", { status: e.status, requestId: e.requestID, type: detail?.type, message: detail?.message });
    }
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
      throw new ProtocolError("notConfigured", "Protocol extraction is not configured on this server.");
    if (e instanceof Anthropic.BadRequestError) {
      const msg = String((e.error as { error?: { message?: string } } | undefined)?.error?.message ?? "");
      if (/pdf|document|page|password|too (large|long)|prompt is too long|context/i.test(msg))
        throw new ProtocolError("unreadable", "This document could not be read (too large, password-protected or corrupted).");
      throw new ProtocolError("rejected", "The extraction service rejected the request. Please try again later.");
    }
    if (e instanceof Anthropic.RateLimitError) throw new ProtocolError("rateLimited", "Too many requests right now. Try again in a minute.");
    if (e instanceof Anthropic.APIError) throw new ProtocolError("unavailable", "The extraction service is unavailable. Try again shortly.");
    if (e instanceof Error && /api key|apiKey|authToken|credentials/i.test(e.message))
      throw new ProtocolError("notConfigured", "Protocol extraction is not configured on this server.");
    // parse() validates the JSON inside the call: truncated / invalid output arrives here, not as stop_reason
    if (e instanceof Anthropic.AnthropicError && /Failed to parse structured output/i.test(e.message))
      throw new ProtocolError("noCriteria", "Could not extract criteria from this document. Fill the form manually.");
    throw e;
  }
  if (response.stop_reason === "refusal") throw new ProtocolError("refused", "This document could not be processed.");
  if (response.stop_reason === "max_tokens" || !response.parsed_output)
    throw new ProtocolError("noCriteria", "Could not extract criteria from this document. Fill the form manually.");
  const out = response.parsed_output;
  if (!out.isProtocol) throw new ProtocolError("notProtocol", "This doesn't look like a trial protocol or synopsis.");
  return out;
}

const ROMAN: Record<string, string> = { i: "1", ii: "2", iii: "3", iv: "4" };

/** Accepts the keys ("PHASE2_3") and the ways documents and models write phases: "Phase II/III", "phase 2/3",
 *  "Phase 1b/2", "II-III", "PHASE2/PHASE3". Combined designs map to the combined options. */
export function pickPhase(v: string | null): PhaseOption | undefined {
  const raw = (v ?? "").trim();
  if (!raw) return undefined;
  const exact = PHASE_KEYS.find((k) => k.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;
  const digits = raw
    .toLowerCase()
    .replace(/phase|fase/g, " ")
    .replace(/\b(iv|iii|ii|i)(?=[ab]?\b)/g, (m) => ROMAN[m])
    .match(/[1-4]/g);
  if (!digits) return undefined;
  const set = [...new Set(digits)].sort().join("");
  if (set === "12") return "PHASE1_2";
  if (set === "23") return "PHASE2_3";
  if (set.length === 1) return `PHASE${set}` as PhaseOption;
  return undefined;
}

/** Maps an extraction onto the search form. Unknown fields keep the form's defaults; the recruitment target and period
 *  are filled only when the protocol states them. */
export function toCriteria(x: ProtocolExtraction, defaults: TrialCriteria): TrialCriteria {
  const pick = <T extends string>(v: string | null, allowed: readonly T[]): T | undefined =>
    allowed.find((a) => a.toLowerCase() === (v ?? "").trim().toLowerCase());
  // the recruitment target only when the protocol states it (total enrolment and number of sites / the period):
  // never a default, so hospitals are not asked against a target nobody set
  const perSite =
    x.targetEnrolmentTotal && x.targetEnrolmentTotal > 0 && x.plannedSites && x.plannedSites > 0
      ? Math.min(1000, Math.max(1, Math.round(x.targetEnrolmentTotal / x.plannedSites)))
      : undefined;
  const months = x.recruitmentMonths && x.recruitmentMonths > 0 ? Math.min(60, x.recruitmentMonths) : undefined;
  const out: TrialCriteria = {
    ...defaults,
    indication: x.indication.trim().slice(0, 200) || defaults.indication,
    area: pick(x.area, AREA_KEYS) ?? defaults.area,
    phase: pickPhase(x.phase) ?? defaults.phase,
    population: pick(x.population, POPULATION_KEYS) ?? defaults.population,
    equipment: [...new Set(x.equipment.map((e) => pick(e, EQUIPMENT_KEYS)).filter((e): e is string => !!e))],
    keyCriteria: x.keyCriteria
      .map((k) => ({ en: k.en.trim().slice(0, 200), es: k.es.trim().slice(0, 200) }))
      .filter((k) => k.en && k.es)
      .slice(0, 4),
  };
  delete out.targetPatientsPerSite;
  delete out.recruitmentMonths;
  if (perSite !== undefined) out.targetPatientsPerSite = perSite;
  if (months !== undefined) out.recruitmentMonths = months;
  return out;
}

export function toConfidential(x: ProtocolExtraction): ConfidentialInfo {
  const c = x.confidential;
  return {
    drugName: c.drugName ?? undefined,
    sponsorName: c.sponsorName ?? undefined,
    protocolCode: c.protocolCode ?? undefined,
  };
}
