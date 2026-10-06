"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Check, Icon } from "@/components/ui";
import type { ReusePolicy } from "@/lib/question-library";
import { COMMON } from "@/lib/i18n/pro";
import { useLang } from "@/lib/i18n/context";
import { PROJECTS } from "@/lib/i18n/pro/projects";
import type { Question } from "@/lib/questionnaire";
import { editQuestion, moveQuestion, removeQuestion } from "../../actions";
import HelpTip from "./help-tip";

export interface QuestionRow {
  q: Question;
  policy: ReusePolicy;
}

/** The question list: reword (Spanish + English), reorder and remove, until the questionnaire is sent. */
export default function QuestionList({ projectId, rows, locked }: { projectId: string; rows: QuestionRow[]; locked: boolean }) {
  const lang = useLang();
  const t = PROJECTS[lang].questions;
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const run = (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    start(async () => {
      await fn();
      setBusy(null);
    });
  };

  return (
    <ol className="mt-2 divide-y divide-line rounded-xl border border-line" data-testid="question-list">
      {rows.map(({ q, policy }, n) => (
        <li key={q.id} className="px-3 py-2.5 text-sm" data-qid={q.id} data-testid="question-row">
          {editing === q.id ? (
            <EditForm projectId={projectId} q={q} n={n} policy={policy} onDone={() => setEditing(null)} />
          ) : (
            <div className="flex items-start gap-2 sm:gap-3">
              <span className="num w-5 shrink-0 pt-0.5 text-muted">{n + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="break-words text-ink" lang="es">{q.es}</div>
                {lang === "en" && q.en !== q.es && <div className="mt-0.5 break-words text-xs text-muted">{q.en}</div>}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5" data-testid="question-meta">
                  <Badge tone="outline">{t.types[q.type]}</Badge>
                  <span className="inline-flex items-center gap-1">
                    <Badge tone={policy === "trial" ? "neutral" : "brand"}>{t.policy[policy].label}</Badge>
                    <HelpTip label={t.aboutPolicy(t.policy[policy].label)} align="start">{t.policy[policy].hint}</HelpTip>
                  </span>
                  {q.custom && !q.role && <Badge tone="neutral">{t.custom}</Badge>}
                  {q.edited && <Badge tone="neutral" icon="flag">{t.reworded}</Badge>}
                </div>
              </div>
              {!locked && (
                <div className="-my-1 flex shrink-0 flex-wrap items-center justify-end gap-0.5">
                  {n > 0 && (
                    <>
                      <IconButton label={t.moveUp(n + 1)} disabled={pending || n <= 1} onClick={() => run(q.id, () => moveQuestion(projectId, q.id, -1))}>
                        <Icon name="chevronDown" size={15} className="rotate-180" />
                      </IconButton>
                      <IconButton label={t.moveDown(n + 1)} disabled={pending || n === rows.length - 1} onClick={() => run(q.id, () => moveQuestion(projectId, q.id, 1))}>
                        <Icon name="chevronDown" size={15} />
                      </IconButton>
                    </>
                  )}
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(q.id)} aria-label={t.editAria(n + 1)} data-testid="edit-question">
                    <PencilIcon /><span className="hidden sm:inline">{COMMON[lang].edit}</span>
                  </Button>
                  {q.id !== "interest" && (
                    <Button type="button" variant="ghost" size="sm" icon="x" loading={busy === q.id && pending} aria-label={t.removeAria(n + 1)} title={t.removeTitle}
                      onClick={() => run(q.id, () => removeQuestion(projectId, q.id))}>
                      <span className="hidden sm:inline">{COMMON[lang].remove}</span>
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

function EditForm({ projectId, q, n, policy, onDone }: { projectId: string; q: Question; n: number; policy: ReusePolicy; onDone: () => void }) {
  const lang = useLang();
  const t = PROJECTS[lang].questions;
  const [es, setEs] = useState(q.es);
  const [en, setEn] = useState(q.en);
  const [same, setSame] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const reusable = policy !== "trial";
  const save = () =>
    start(async () => {
      setError(null);
      const r = await editQuestion(projectId, q.id, { es, en, sameQuestion: reusable && same }).catch((e: Error) => ({ error: e.message }));
      if (r?.error) setError(r.error);
      else onDone();
    });
  return (
    <div className="flex items-start gap-2 sm:gap-3" data-testid="edit-form">
      <span className="num w-5 shrink-0 pt-2 text-muted">{n + 1}</span>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <label className="label mb-1" htmlFor={`es-${q.id}`}>{t.spanish} <span className="font-normal text-muted">{t.spanishNote}</span></label>
          <textarea id={`es-${q.id}`} rows={2} maxLength={300} className="input leading-snug" value={es} onChange={(e) => setEs(e.target.value)} data-testid="edit-es" />
        </div>
        <div>
          <label className="label mb-1" htmlFor={`en-${q.id}`}>{t.english}</label>
          <textarea id={`en-${q.id}`} rows={2} maxLength={300} className="input leading-snug" value={en} onChange={(e) => setEn(e.target.value)} data-testid="edit-en" />
        </div>
        {reusable && (
          <Check
            checked={same}
            onChange={(e) => setSame(e.target.checked)}
            data-testid="same-question"
            label={t.sameQuestion}
            hint={same ? t.sameHint : t.newHint}
          />
        )}
        {error && <p className="flex items-start gap-1.5 text-[13px] text-rose-700" role="alert"><Icon name="alert" size={14} className="mt-0.5 shrink-0" /> {error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onDone} disabled={pending}>{COMMON[lang].cancel}</Button>
          <Button type="button" size="sm" icon="check" loading={pending} onClick={save} data-testid="save-question">{t.saveWording}</Button>
        </div>
      </div>
    </div>
  );
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-subtle hover:text-ink disabled:pointer-events-none disabled:opacity-30">
      {children}
    </button>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Zm9.5-13.5 4 4" />
    </svg>
  );
}
