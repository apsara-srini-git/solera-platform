import "server-only";
import fs from "node:fs";
import path from "node:path";
import { institutionalDomain } from "./question-library";
import type { ContactsFile, HospitalContacts, PublicContact } from "./contact-kinds";

// Public research contacts per hospital (data/hospital_contacts.json, a copy of the curated
// pipeline/hospital_contacts.json). Read-only and cached in memory; re-read when the file changes on disk (mtime + size),
// like lib/data.ts. Webmail addresses kept in the curated file for completeness are never offered as recipients.

interface Cache {
  checkedOn: string;
  bySite: Map<string, HospitalContacts>;
}

let cache: Cache | null = null;
let cacheStamp = "";

const file = () => path.join(process.cwd(), "data", "hospital_contacts.json");

function stamp(): string {
  try {
    const st = fs.statSync(file());
    return `${st.mtimeMs}:${st.size}`;
  } catch {
    return "missing";
  }
}

function load(): Cache {
  const raw = JSON.parse(fs.readFileSync(file(), "utf8")) as ContactsFile;
  const bySite = new Map<string, HospitalContacts>();
  for (const h of raw.hospitals) {
    bySite.set(h.id, { ...h, contacts: h.contacts.filter((c) => !!institutionalDomain(c.email)) });
  }
  return { checkedOn: raw.checkedOn, bySite };
}

function contactsData(): Cache {
  const now = stamp();
  if (cache && now === cacheStamp) return cache;
  try {
    cache = load();
    cacheStamp = now;
  } catch (e) {
    // a missing file means "no contacts on file" rather than a broken page; a half-written one keeps the old cache
    if (!cache) {
      if (now !== "missing") console.error("hospital_contacts.json could not be read:", e);
      return { checkedOn: "", bySite: new Map() };
    }
  }
  return cache;
}

/** The public role mailboxes of a hospital that may receive a questionnaire (institutional domains only), curated order. */
export function getHospitalContacts(siteId: string): PublicContact[] {
  return contactsData().bySite.get(siteId)?.contacts ?? [];
}

/** Coverage for /data-sources. */
export function contactsSummary(): { checkedOn: string; hospitals: number; withContacts: number; mailboxes: number } {
  const d = contactsData();
  const all = [...d.bySite.values()];
  return {
    checkedOn: d.checkedOn,
    hospitals: all.length,
    withContacts: all.filter((h) => h.contacts.length > 0).length,
    mailboxes: new Set(all.flatMap((h) => h.contacts.map((c) => c.email.toLowerCase()))).size,
  };
}
