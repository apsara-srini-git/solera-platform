"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Check, Icon, Modal } from "@/components/ui";
import { ContactKindBadge, ContactSource } from "@/components/contacts";
import { type ContactRecord, type PublicContact, isRegulatoryOnly } from "@/lib/contact-kinds";
import { institutionalDomain } from "@/lib/question-library";
import { COMMON } from "@/lib/i18n/pro";
import { useLang } from "@/lib/i18n/context";
import { PROJECTS } from "@/lib/i18n/pro/projects";
import { sendInvitation } from "../../actions";

export interface SendRow {
  itemId: string;
  siteName: string;
  institute: string | null;
  /** Role mailboxes the hospital publishes on its own pages (data/hospital_contacts.json), curated order. */
  contacts: PublicContact[];
  /** Index of the suggested contact in `contacts`, or -1. Highlighted, never selected for the sponsor. */
  best: number;
  sent: { email: string; date: string; status: "responded" | "opened" | "sent"; contact: ContactRecord | null } | null;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
const OTHER = "__other__";

/**
 * Send step: per hospital, the sponsor picks one of the hospital's public contacts (each with its kind, what it is for,
 * phone and the official page it was seen on) or types another institutional address. The suggested contact is only
 * highlighted; nothing is chosen until the sponsor clicks (or uses "Choose the suggested contact for all"). One
 * institutional-address confirmation covers the section; per-row Send or "Send to all" both go through a confirmation
 * Modal (sending emails the hospital and locks the questionnaire).
 */
export default function SendPanel({ rows, disabled, deliveryConfigured, targetMissing = false }: {
  rows: SendRow[];
  disabled: boolean;
  deliveryConfigured: boolean;
  /** Patients per hospital or the recruitment period is not set: a gentle reminder, never a block. */
  targetMissing?: boolean;
}) {
  const lang = useLang();
  const t = PROJECTS[lang].send;
  // chosen contact email, OTHER (typed address) or "" (nothing chosen yet). Hospitals without contacts type directly.
  const [choice, setChoice] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.filter((r) => !r.sent).map((r) => [r.itemId, r.contacts.length ? "" : OTHER])),
  );
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [institutional, setInstitutional] = useState(false);
  const [confirming, setConfirming] = useState<string[] | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const unsent = rows.filter((r) => !r.sent);
  const rowOf = (id: string) => rows.find((r) => r.itemId === id);
  const emailOf = (id: string) => (choice[id] === OTHER ? (typed[id] ?? "") : (choice[id] ?? "")).trim();
  const contactOf = (id: string) => (choice[id] && choice[id] !== OTHER ? rowOf(id)?.contacts.find((c) => c.email === choice[id]) : undefined);
  const problem = (id: string): string | null => {
    const e = emailOf(id);
    if (!e) return t.errEmpty;
    if (!EMAIL.test(e)) return t.errInvalid;
    if (!institutionalDomain(e)) return t.errWebmail;
    return null;
  };
  const ready = unsent.filter((r) => !problem(r.itemId));
  const canSuggest = unsent.filter((r) => r.best >= 0 && !choice[r.itemId]);

  const pick = (id: string, value: string) => {
    setChoice((s) => ({ ...s, [id]: value }));
    setErrors((s) => ({ ...s, [id]: "" }));
    if (value === OTHER) requestAnimationFrame(() => document.getElementById(`send-other-${id}`)?.focus());
  };
  const pickSuggested = () =>
    setChoice((s) => ({ ...s, ...Object.fromEntries(canSuggest.map((r) => [r.itemId, r.contacts[r.best].email])) }));

  const ask = (ids: string[]) => {
    setSectionError(null);
    if (!institutional) {
      setSectionError(t.errConfirm);
      document.getElementById("send-institutional")?.focus();
      return;
    }
    const bad = Object.fromEntries(ids.map((id) => [id, problem(id)]).filter(([, p]) => p)) as Record<string, string>;
    setErrors(bad);
    const ok = ids.filter((id) => !bad[id]);
    if (ok.length) setConfirming(ok);
  };

  const send = () =>
    start(async () => {
      const ids = confirming ?? [];
      const errs: Record<string, string> = {};
      for (const id of ids) {
        const fd = new FormData();
        fd.set("email", emailOf(id));
        fd.set("institutional", "on");
        // an unexpected server failure (database, mail provider) gets a translated message; the raw error goes to the console
        const r = await sendInvitation(id, undefined, fd).catch((e: unknown) => {
          console.error(e);
          return { error: t.errSendFailed };
        });
        if (r?.error) errs[id] = r.error;
      }
      setErrors(errs);
      setConfirming(null);
    });

  const label = (c: Pick<PublicContact, "label_es" | "label_en">) => (lang === "es" ? c.label_es : c.label_en);
  const option = (selected: boolean, highlighted: boolean) =>
    `flex min-w-0 cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors ${
      selected
        ? "border-brand-500 bg-brand-50/60 ring-1 ring-brand-500"
        : highlighted
          ? "border-brand-300 bg-surface hover:bg-subtle/60"
          : "border-line bg-surface hover:bg-subtle/60"
    }`;

  return (
    <div className="space-y-4" data-testid="send-panel">
      {!deliveryConfigured && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200 ring-inset" data-testid="delivery-off">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
          <span>
            {t.deliveryOffBefore}
            <a href="/dev/outbox" target="_blank" className="font-medium underline underline-offset-2">{t.deliveryOffLink}</a>{t.deliveryOffAfter}
          </span>
        </p>
      )}
      {targetMissing && unsent.length > 0 && <TargetTip t={t} />}
      {unsent.length > 0 && (
        <div className="rounded-xl border border-line bg-subtle/50 p-4">
          <Check
            id="send-institutional"
            name="institutional"
            checked={institutional}
            onChange={(e) => setInstitutional(e.target.checked)}
            label={<span className="font-medium">{t.institutional}</span>}
            hint={t.institutionalHint}
          />
          {sectionError && (
            <p className="mt-2 flex items-center gap-1.5 text-[13px] text-rose-700" role="alert"><Icon name="alert" size={13} /> {sectionError}</p>
          )}
        </div>
      )}
      {canSuggest.length > 0 && (
        <div className="flex justify-end">
          <Button type="button" variant="secondary" size="sm" icon="check" onClick={pickSuggested} disabled={pending} data-testid="pick-suggested">
            {t.useSuggestedAll(canSuggest.length)}
          </Button>
        </div>
      )}

      <ul className="divide-y divide-line">
        {rows.map((r) => {
          const id = r.itemId;
          const chosen = contactOf(id);
          return (
            <li key={id} className="py-4 text-sm first:pt-1" data-testid="send-row">
              <div className="min-w-0">
                <div className="font-medium text-ink">{r.siteName}</div>
                {(r.institute || (!r.sent && r.contacts.length === 0)) && (
                  <div className="text-xs text-muted">{r.institute ?? t.noContact}</div>
                )}
              </div>
              {r.sent ? (
                <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2 text-xs text-ink-2" data-testid="sent-to">
                  <span className="min-w-0">
                    {deliveryConfigured ? t.sentTo : t.savedOutbox}{" "}
                    {r.sent.contact && (
                      <><span className="font-medium text-ink">{label(r.sent.contact)}</span> ({t.publicContact}) · </>
                    )}
                    <span className="break-all">{r.sent.email}</span> · <span className="whitespace-nowrap">{r.sent.date}</span>
                  </span>
                  {r.sent.status === "responded" ? <Badge tone="success" icon="check">{t.responded}</Badge>
                    : r.sent.status === "opened" ? <Badge tone="info">{t.opened}</Badge>
                    : <Badge>{t.notOpened}</Badge>}
                </div>
              ) : (
                <div className="mt-2 space-y-2.5">
                  {r.contacts.length > 0 ? (
                    <fieldset>
                      <legend className="sr-only">{t.chooseLegend(r.siteName)}</legend>
                      <p className="text-xs text-muted">{t.publicContacts(r.contacts.length)}</p>
                      <div className="mt-2 grid gap-2 lg:grid-cols-2">
                        {r.contacts.map((c, i) => {
                          const selected = choice[id] === c.email;
                          return (
                            <label key={c.email} className={option(selected, i === r.best)} data-testid="contact-option" data-suggested={i === r.best || undefined}>
                              <input
                                type="radio"
                                name={`send-to-${id}`}
                                value={c.email}
                                checked={selected}
                                onChange={() => pick(id, c.email)}
                                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand-600"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <span className="font-medium text-ink">{label(c)}</span>
                                  {i === r.best && <Badge tone="success" icon="sparkle" title={t.suggestedTitle}>{t.suggested}</Badge>}
                                </span>
                                <span className="mt-1 block"><ContactKindBadge kind={c.kind} lang={lang} /></span>
                                <span className="mt-1.5 block text-[13px] leading-snug text-ink-2">{lang === "es" ? c.description_es : c.description_en}</span>
                                <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                                  <span className="break-all text-ink">{c.email}</span>
                                  {c.phone && <span className="text-muted">{c.phone}</span>}
                                </span>
                                <span className="mt-1.5 flex min-w-0"><ContactSource contact={c} lang={lang} /></span>
                              </span>
                            </label>
                          );
                        })}
                        <label className={option(choice[id] === OTHER, false)} data-testid="contact-other">
                          <input
                            type="radio"
                            name={`send-to-${id}`}
                            value={OTHER}
                            checked={choice[id] === OTHER}
                            onChange={() => pick(id, OTHER)}
                            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand-600"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="font-medium text-ink">{t.useAnother}</span>
                            <span className="mt-0.5 block text-[13px] text-muted">{t.useAnotherHint}</span>
                          </span>
                        </label>
                      </div>
                    </fieldset>
                  ) : (
                    <p className="flex items-start gap-1.5 text-[13px] text-ink-2" data-testid="no-public-contact">
                      <Icon name="info" size={14} className="mt-0.5 shrink-0 text-muted" /> {t.noPublicContact}
                    </p>
                  )}
                  {choice[id] === OTHER && (
                    <input
                      id={`send-other-${id}`}
                      type="email"
                      className="input h-9 w-full sm:max-w-sm"
                      placeholder="ensayos@fundacion-hospital.es"
                      value={typed[id] ?? ""}
                      onChange={(e) => setTyped((s) => ({ ...s, [id]: e.target.value }))}
                      aria-label={t.mailboxAria(r.siteName)}
                      aria-invalid={errors[id] ? true : undefined}
                      data-testid="send-email"
                    />
                  )}
                  {chosen && isRegulatoryOnly(chosen) && (
                    <p className="flex items-start gap-1.5 text-xs text-amber-900"><Icon name="alert" size={13} className="mt-0.5 shrink-0" /> {t.regulatoryWarning}</p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-line pt-2.5">
                    <span className="min-w-0 text-xs text-muted" data-testid="send-recipient">
                      {t.to}{" "}
                      {emailOf(id) ? (
                        <span className="break-all text-ink">
                          {chosen && <span className="font-medium">{label(chosen)} · </span>}{emailOf(id)}
                        </span>
                      ) : (
                        <span>{t.nobodyYet}</span>
                      )}
                    </span>
                    <Button type="button" variant="secondary" size="sm" icon="send" disabled={disabled || pending} onClick={() => ask([id])} data-testid="send-one">
                      {t.send}
                    </Button>
                  </div>
                  {errors[id] && (
                    <p className="flex items-center gap-1.5 text-xs text-rose-700" role="alert"><Icon name="alert" size={13} /> {errors[id]}</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {unsent.length > 1 && (
        <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-muted">
            {t.ready(ready.length, unsent.length)}
          </p>
          <Button type="button" icon="send" disabled={disabled || pending || ready.length === 0} onClick={() => ask(unsent.map((r) => r.itemId))} data-testid="send-all">
            {t.sendAll(unsent.length)}
          </Button>
        </div>
      )}

      <Modal
        open={!!confirming}
        onClose={() => !pending && setConfirming(null)}
        title={confirming && confirming.length > 1 ? t.confirmMany(confirming.length) : t.confirmOne(confirming ? rowOf(confirming[0])?.siteName ?? "" : "")}
        description={t.confirmDescription}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setConfirming(null)} disabled={pending}>{COMMON[lang].cancel}</Button>
            <Button type="button" icon="send" loading={pending} onClick={send} data-testid="confirm-send">
              {pending ? t.sending : confirming && confirming.length > 1 ? t.sendMany(confirming.length) : t.sendOne}
            </Button>
          </>
        }
      >
        {targetMissing && <TargetTip t={t} className="mb-3" />}
        <ul className="divide-y divide-line rounded-lg ring-1 ring-line">
          {(confirming ?? []).map((id) => {
            const c = contactOf(id);
            return (
              <li key={id} className="flex min-w-0 flex-col gap-0.5 px-3 py-2" data-testid="confirm-recipient">
                <span className="font-medium text-ink">{rowOf(id)?.siteName}</span>
                {c && <span className="text-xs text-ink-2">{label(c)} ({t.publicContact})</span>}
                <span className="flex min-w-0 items-center gap-1.5 text-xs text-ink-2">
                  <Icon name="send" size={12} className="shrink-0 text-muted" />
                  <span className="truncate" title={emailOf(id)}>{emailOf(id)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </Modal>
    </div>
  );
}

/** Reminder (not a block) when the recruitment target is not set: hospitals commit more precisely against a target. */
function TargetTip({ t, className }: { t: (typeof PROJECTS)["en"]["send"]; className?: string }) {
  return (
    <p className={`flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-2.5 text-sm text-brand-900 ring-1 ring-brand-200 ring-inset ${className ?? ""}`} data-testid="target-tip">
      <Icon name="info" size={16} className="mt-0.5 shrink-0" />
      <span>
        {t.tipBefore}
        <a href="#questionnaire" className="font-medium underline underline-offset-2">{t.tipLink}</a>{t.tipAfter}
      </span>
    </p>
  );
}
