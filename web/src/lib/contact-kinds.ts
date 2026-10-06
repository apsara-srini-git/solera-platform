// Public research contacts of a hospital (data/hospital_contacts.json, curated in pipeline/hospital_contacts.json).
// Pure module (no server imports): shared by the loader (lib/contacts.ts), the send panel, the sponsor hospital page,
// the send action and the unit tests. Only role / unit mailboxes are recorded - never named people.

export const CONTACT_KINDS = [
  "clinical_trials_unit",
  "research_foundation",
  "research_support_office",
  "research_institute",
  "hospital_general",
  "ceim_secretariat",
] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

export type ContactConfidence = "high" | "medium" | "low";

export interface PublicContact {
  email: string;
  phone?: string;
  kind: ContactKind;
  label_es: string;
  label_en: string;
  description_es: string;
  description_en: string;
  /** Official page the address was seen on. */
  sourceUrl: string;
  sourceTitle: string;
  /** Verbatim excerpt of that page showing the address. */
  evidenceQuote: string;
  /** yyyy-mm-dd */
  checkedOn: string;
  confidence: ContactConfidence;
}

export interface HospitalContacts {
  id: string;
  name: string;
  website: string;
  notes: string;
  contacts: PublicContact[];
}

export interface ContactsFile {
  checkedOn: string;
  note: string;
  hospitals: HospitalContacts[];
}

/** What was recorded on an invitation sent to a listed public contact (Invitation.recipientContact, JSON). */
export interface ContactRecord {
  kind: ContactKind;
  label_es: string;
  label_en: string;
  sourceUrl: string;
  sourceTitle: string;
  checkedOn: string;
}

/** Ethics-committee secretariats handle regulatory paperwork: listed for information, never suggested. */
export const isRegulatoryOnly = (c: Pick<PublicContact, "kind">) => c.kind === "ceim_secretariat";

const CONFIDENCE_RANK: Record<ContactConfidence, number> = { high: 0, medium: 1, low: 2 };
const KIND_RANK: Record<ContactKind, number> = {
  clinical_trials_unit: 0,
  research_foundation: 1,
  research_support_office: 2,
  research_institute: 3,
  hospital_general: 4,
  ceim_secretariat: 9,
};

/**
 * The contact to suggest for a feasibility request: highest confidence first (how clearly the page says it handles
 * sponsor trials), then the most specific kind. Ties keep the curated order. -1 when only regulatory contacts exist.
 */
export function bestContactIndex(contacts: Pick<PublicContact, "kind" | "confidence">[]): number {
  let best = -1;
  let bestRank = Infinity;
  contacts.forEach((c, i) => {
    if (isRegulatoryOnly(c)) return;
    const rank = CONFIDENCE_RANK[c.confidence] * 10 + KIND_RANK[c.kind];
    if (rank < bestRank) {
      best = i;
      bestRank = rank;
    }
  });
  return best;
}

/** The listed public contact with this address (case-insensitive), if any. */
export function findPublicContact<C extends Pick<PublicContact, "email">>(contacts: C[], email: string): C | undefined {
  const e = email.trim().toLowerCase();
  return contacts.find((c) => c.email.toLowerCase() === e);
}

export function contactRecord(c: PublicContact): ContactRecord {
  return { kind: c.kind, label_es: c.label_es, label_en: c.label_en, sourceUrl: c.sourceUrl, sourceTitle: c.sourceTitle, checkedOn: c.checkedOn };
}

export function parseContactRecord(json: string | null | undefined): ContactRecord | null {
  if (!json) return null;
  try {
    const r = JSON.parse(json) as Partial<ContactRecord>;
    return r && typeof r.kind === "string" && (CONTACT_KINDS as readonly string[]).includes(r.kind) && r.label_en && r.label_es
      ? (r as ContactRecord)
      : null;
  } catch {
    return null;
  }
}

/** Common Spanish given names: a local part that starts with one ("maria.lopez@…") is very likely a person's mailbox. */
const GIVEN_NAMES = new Set(
  ("maria jose juan carlos ana luis javier antonio manuel francisco david pablo laura marta elena carmen isabel pedro " +
    "miguel rafael fernando alberto jorge sergio raul cristina beatriz lucia paula sara patricia rosa teresa pilar " +
    "alejandro daniel alvaro ignacio jesus angel victor ramon enrique andres diego oscar ruben adrian ivan alfonso " +
    "eduardo julia irene silvia monica raquel nuria eva marina sonia susana mercedes concepcion dolores josefa " +
    "inmaculada rocio esther veronica natalia alicia gloria lourdes yolanda montserrat begona ainhoa blanca clara " +
    "ines amparo mar victoria gema gemma noelia lorena miriam celia")
    .split(" "),
);

/**
 * Heuristic for a personal address: "first.last", "f.last" or "firstname…" with a common given name. Role mailboxes
 * ("ensayos.imas12", "secretaria.fundacion", "investigacion.hus") pass. Used by the data unit test, not to block sends.
 */
export function looksPersonal(email: string): boolean {
  const local = email.split("@")[0]?.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "") ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2 && GIVEN_NAMES.has(parts[0])) return true;
  if (parts.length >= 2 && /^[a-z]$/.test(parts[0]) && /^[a-z]{3,}$/.test(parts[1])) return true; // j.perez
  return GIVEN_NAMES.has(local);
}
