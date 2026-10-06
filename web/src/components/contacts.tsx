// Presentational pieces for a hospital's public research contacts (no hooks, no server imports): used by the client
// send panel on the project page and by the server-rendered /sites/[id] page.
import { Icon } from "@/components/ui";
import type { ContactKind, PublicContact } from "@/lib/contact-kinds";
import { fmtDate, type Lang } from "@/lib/i18n/pro";
import { CONTACTS } from "@/lib/i18n/pro/contacts";

// same palette as components/ui Badge, but the pill may wrap on a phone (Badge is a fixed-height single line)
const TONE: Record<ContactKind, string> = {
  clinical_trials_unit: "bg-brand-50 text-brand-700 ring-brand-200",
  research_foundation: "bg-sky-50 text-sky-800 ring-sky-200",
  research_institute: "bg-sky-50 text-sky-800 ring-sky-200",
  research_support_office: "bg-sky-50 text-sky-800 ring-sky-200",
  hospital_general: "bg-subtle text-ink-2 ring-line",
  ceim_secretariat: "bg-amber-50 text-amber-900 ring-amber-200",
};

/** "Clinical trials unit" / "Ethics committee secretariat · regulatory questions, not feasibility". */
export function ContactKindBadge({ kind, lang }: { kind: ContactKind; lang: Lang }) {
  const t = CONTACTS[lang];
  const note = t.kindNotes[kind];
  return (
    <span className={`inline-block max-w-full rounded-full px-2 py-px text-[11.5px] leading-[18px] font-medium ring-1 ring-inset ${TONE[kind]}`} data-testid="contact-kind">
      {t.kinds[kind]}
      {note && <span className="font-normal"> · {note}</span>}
    </span>
  );
}

/** Source chip: page title + "checked 6 Oct 2026", linking to the page the address was seen on. */
export function ContactSource({ contact, lang }: { contact: Pick<PublicContact, "sourceUrl" | "sourceTitle" | "checkedOn" | "evidenceQuote">; lang: Lang }) {
  const t = CONTACTS[lang];
  const date = fmtDate(contact.checkedOn, lang);
  return (
    <a
      href={contact.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={contact.evidenceQuote ? `${t.quoteLabel}: “${contact.evidenceQuote}”` : undefined}
      aria-label={t.sourceAria(contact.sourceTitle, date)}
      className="inline-flex max-w-full min-w-0 flex-wrap items-center gap-x-1 rounded-md bg-subtle px-1.5 py-0.5 text-[11px] leading-4 text-ink-2 ring-1 ring-line ring-inset hover:text-brand-700 hover:ring-brand-200"
      data-testid="contact-source"
    >
      <Icon name="link" size={11} className="shrink-0 text-muted" />
      <span className="min-w-0 break-words">{contact.sourceTitle}</span>
      <span className="text-muted">
        · {t.checked(date)} <Icon name="external" size={10} className="inline align-[-1px]" />
      </span>
    </a>
  );
}
