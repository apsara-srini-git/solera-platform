"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Badge, Button, Card, Check, Chip, Icon, Input, SegmentedControl, SourceBadge, Textarea, cx } from "@/components/ui";
import { useLang } from "@/lib/i18n/context";
import { LABELS } from "@/lib/i18n/pro";
import { SEARCH } from "@/lib/i18n/pro/search";
import type { ConfidentialInfo, TrialCriteria } from "@/lib/types";

export interface ProtocolResult {
  uploadId: string;
  criteria: TrialCriteria;
  confidential: ConfidentialInfo;
  keptConfidential: boolean;
  evidence: { field: string; quote: string }[];
  kept: boolean;
}

export default function ProtocolImport({ onExtracted, className }: { onExtracted: (r: ProtocolResult) => void; className?: string }) {
  const t = SEARCH[useLang()].protocol;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"file" | "text">("file");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function submit(form: HTMLFormElement) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/protocol", { method: "POST", body: new FormData(form) });
      const body = await res.json().catch(() => ({ error: t.unexpected }));
      if (!res.ok) throw new Error(body.error ?? t.uploadFailed);
      onExtracted(body as ProtocolResult);
      setOpen(false);
      setFileName(null);
      form.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.uploadFailed);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cx(
          "group flex w-full items-center gap-3 rounded-xl border border-dashed border-brand-300 bg-brand-50/60 px-3.5 py-3 text-left transition hover:border-brand-500 hover:bg-brand-50",
          className,
        )}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface text-brand-700 shadow-xs ring-1 ring-brand-200">
          <Icon name="doc" size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-brand-900">{t.start}</span>
          <span className="block text-[12.5px] text-brand-800/80">{t.startText}</span>
        </span>
        <Icon name="arrowRight" size={16} className="shrink-0 text-brand-700 transition group-hover:translate-x-0.5" />
      </button>
    );
  }

  return (
    <form
      className={cx("space-y-3.5 rounded-xl border border-brand-200 bg-brand-50/50 p-4", className)}
      onSubmit={(e) => {
        e.preventDefault();
        submit(e.currentTarget);
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-900">
          <Icon name="doc" size={16} /> {t.start}
        </span>
        <button type="button" className="btn-ghost h-7 px-2 text-xs" onClick={() => setOpen(false)}>
          {t.close}
        </button>
      </div>
      <SegmentedControl
        label={t.inputLabel}
        size="sm"
        value={mode}
        onChange={setMode}
        options={[
          { value: "file", label: t.uploadFile, icon: "download" },
          { value: "text", label: t.pasteText, icon: "doc" },
        ]}
      />
      {mode === "file" ? (
        <label className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed border-line-strong bg-surface px-3 py-4 text-center hover:border-brand-400">
          <Icon name="download" size={18} className="rotate-180 text-muted" />
          <span className="text-[13px] font-medium text-ink">{fileName ?? t.chooseFile}</span>
          <span className="text-[11.5px] text-muted">{t.upTo}</span>
          <input
            name="file"
            type="file"
            required
            className="sr-only"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </label>
      ) : (
        <Textarea name="text" rows={5} required className="text-[13px]" placeholder={t.pastePlaceholder} />
      )}
      <div className="space-y-2.5 text-[13px]">
        <Check
          name="agreeTerms"
          required
          label={
            <>
              {t.agree}{" "}
              <Link href="/terms" target="_blank" className="whitespace-nowrap text-brand-700 underline">
                {t.terms}
              </Link>
            </>
          }
          className="text-[13px]"
        />
        <Check
          name="keepConfidential"
          label={t.keepConfidential}
          hint={t.keepConfidentialHint}
          className="text-[13px]"
        />
        <Check
          name="keepDocument"
          label={t.keepDocument}
          hint={t.keepDocumentHint}
          className="text-[13px]"
        />
      </div>
      {error && (
        <p className="flex items-start gap-1.5 text-[13px] text-rose-700" role="alert">
          <Icon name="alert" size={14} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}
      <Button type="submit" block loading={busy} icon="sparkle">
        {busy ? t.reading : t.extract}
      </Button>
    </form>
  );
}

type TermKind = "drugName" | "sponsorName" | "protocolCode" | "other";
const MAX_TERMS = 20;

function toTerms(c: ConfidentialInfo): { kind: TermKind; value: string }[] {
  const out: { kind: TermKind; value: string }[] = [];
  for (const k of ["drugName", "sponsorName", "protocolCode"] as const) if (c[k]?.trim()) out.push({ kind: k, value: c[k]!.trim() });
  for (const v of c.otherTerms ?? []) if (v.trim()) out.push({ kind: "other", value: v.trim() });
  return out;
}

function fromTerms(terms: { kind: TermKind; value: string }[]): ConfidentialInfo {
  const out: ConfidentialInfo = {};
  for (const t of terms) {
    if (t.kind === "other") out.otherTerms = [...(out.otherTerms ?? []), t.value];
    else if (!out[t.kind]) out[t.kind] = t.value;
    else out.otherTerms = [...(out.otherTerms ?? []), t.value];
  }
  return out;
}

/** The terms kept out of hospital messages, as removable chips plus an "add your own" field. */
function TermsEditor({ value, onChange }: { value: ConfidentialInfo; onChange: (next: ConfidentialInfo) => void }) {
  const t = SEARCH[useLang()].protocol;
  const id = useId();
  const [draft, setDraft] = useState("");
  const terms = toTerms(value);
  const add = () => {
    const v = draft.trim().slice(0, 200);
    if (!v || terms.length >= MAX_TERMS || terms.some((t) => t.value.toLowerCase() === v.toLowerCase())) return setDraft("");
    onChange(fromTerms([...terms, { kind: "other", value: v }]));
    setDraft("");
  };
  return (
    <div className="rounded-lg border border-line bg-subtle/70 p-3 text-xs">
      <h3 className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink">
        <Icon name="eyeOff" size={14} /> {t.termsTitle}
      </h3>
      <p className="mt-0.5 text-muted">
        {t.termsIntro}
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={t.protectedAria}>
        {terms.map((term, i) => (
          <li key={`${term.kind}-${term.value}`}>
            <Chip onRemove={() => onChange(fromTerms(terms.filter((_, j) => j !== i)))} removeLabel={t.removeTerm(term.value)}>
              <span className="text-muted">{t.termKinds[term.kind]}:</span> <span className="font-medium text-ink">{term.value}</span>
            </Chip>
          </li>
        ))}
        {terms.length === 0 && <li className="text-muted italic">{t.noTerms}</li>}
      </ul>
      <form
        className="mt-2.5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label htmlFor={`${id}-t`} className="sr-only">
          {t.addTermLabel}
        </label>
        <Input
          id={`${id}-t`}
          value={draft}
          maxLength={200}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t.addTermPlaceholder}
          className="h-8 min-w-0 flex-1 text-[13px]"
        />
        <Button type="submit" size="sm" variant="secondary" icon="plus" disabled={!draft.trim() || terms.length >= MAX_TERMS}>
          {t.add}
        </Button>
      </form>
    </div>
  );
}

export function ProtocolReview({
  result,
  onDismiss,
  onConfidentialChange,
}: {
  result: ProtocolResult;
  onDismiss: () => void;
  /** The sponsor edited the protected terms; the edited list is what is saved with the project. */
  onConfidentialChange?: (next: ConfidentialInfo) => void;
}) {
  const lang = useLang();
  const t = SEARCH[lang].protocol;
  const quotes = result.evidence.filter((e) => t.fields[e.field]);
  return (
    <Card padding="none" className="overflow-hidden border-brand-200">
      <div className="flex items-start justify-between gap-3 border-b border-brand-100 bg-brand-50/70 px-4 py-3">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
            {t.reviewTitle}
            <Badge tone="warning" icon="alert">{t.checkBadge}</Badge>
          </h2>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {t.aiWarning} {result.kept ? t.docKept : t.docDeleted}
          </p>
        </div>
        <button type="button" className="btn-ghost h-7 shrink-0 px-2 text-xs" onClick={onDismiss}>
          {t.dismiss}
        </button>
      </div>
      <div className="space-y-3 px-4 py-3">
        <p className="text-[13px] text-ink-2">
          <span className="font-medium text-ink">{result.criteria.indication || "-"}</span> · {LABELS[lang].phases[result.criteria.phase]}
        </p>
        {quotes.length > 0 && (
          <ul className="space-y-1.5 text-xs">
            {quotes.map((q, i) => (
              <li key={i} className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
                <span className="text-muted">{t.fields[q.field]}</span>
                <span className="text-ink-2 italic">“{q.quote}”</span>
              </li>
            ))}
          </ul>
        )}
        {(result.criteria.keyCriteria ?? []).length > 0 && (
          <div className="text-xs">
            <span className="text-muted">{t.keyCriteriaNote}</span>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-2">
              {result.criteria.keyCriteria!.map((k) => (
                <li key={k.en}>{(lang === "es" ? k.es : k.en) || k.en}</li>
              ))}
            </ul>
          </div>
        )}
        {result.keptConfidential ? (
          <TermsEditor value={result.confidential} onChange={(next) => onConfidentialChange?.(next)} />
        ) : (
          <p className="flex items-start gap-1.5 rounded-lg border border-line bg-subtle/70 p-2.5 text-xs text-muted">
            <Icon name="eyeOff" size={13} className="mt-0.5 shrink-0" />
            {t.notProtected}
          </p>
        )}
        <SourceBadge kind="protocol" />
      </div>
    </Card>
  );
}
