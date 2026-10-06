"use client";

import { useActionState, useState } from "react";
import { Badge, Button, Check, Icon, Modal, ScoreBar } from "@/components/ui";
import { type Prefill, REUSE_CONSENT, estimateMinutes, libraryMeta } from "@/lib/question-library";
import { type Question, checkAnswer, numberRule, showAnswerEs } from "@/lib/questionnaire";
import { submitResponse } from "../../actions";
import { PrefillSourceChip } from "../prefill-source";

const CHOICES = {
  yesno: [["yes", "Sí"], ["no", "No"]],
  yesnomaybe: [["yes", "Sí"], ["maybe", "Quizá"], ["no", "No"]],
} as const;

/** `preview`: the sponsor's read-only "Preview as hospital" (same layout; nothing can be typed or submitted). */
export default function ResponseForm({ token, questions, prefill, domain, preview = false, recordsHref = null }: {
  token: string;
  questions: Question[];
  prefill: Prefill;
  domain: string | null;
  preview?: boolean;
  /** Page listing the registry records behind a pre-filled count (`?p=<question id>` is appended). */
  recordsHref?: string | null;
}) {
  const [state, action, pending] = useActionState(submitResponse.bind(null, token), undefined);
  const initial = Object.fromEntries(questions.map((q) => [q.id, prefill.answers[q.id]?.value ?? ""]));
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [confirmed, setConfirmed] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [editing, setEditing] = useState<Set<string>>(new Set());

  const prefilled = questions.filter((q) => prefill.answers[q.id]?.value);
  const prefilledIds = prefilled.map((q) => q.id);
  const answered = questions.filter((q) => values[q.id]?.trim()).length;
  const minutes = estimateMinutes(questions.length, answered);
  const reusable = questions.filter((q) => libraryMeta(q).policy !== "trial").length;
  const set = (id: string, v: string) => setValues((s) => ({ ...s, [id]: v }));
  const collapsed = (id: string) => confirmed && prefilledIds.includes(id) && !editing.has(id) && values[id] === initial[id];
  const errorOf = (q: Question) => {
    const v = values[q.id]?.trim();
    if (!v) return null;
    // confirming a public-data pre-fill is never blocked by a cap (the registry count is the true value)
    const pre = prefill.answers[q.id];
    const r = checkAnswer(q, v, { uncapped: !!pre && pre.source.kind !== "hospital" && v === pre.value });
    return r.ok ? null : r;
  };
  const invalidCount = questions.filter((q) => errorOf(q)).length;
  const goTo = (id: string) =>
    requestAnimationFrame(() => {
      const el = document.getElementById(`q-${id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.querySelector<HTMLElement>("input:not([type=hidden]), textarea")?.focus({ preventScroll: true });
    });

  const confirmAll = () => {
    setConfirmed(true);
    setReviewing(false);
    setEditing(new Set());
    const first = questions.find((q) => !values[q.id]?.trim());
    if (first) goTo(first.id);
  };
  const correct = (id: string) => {
    setReviewing(false);
    setEditing((s) => new Set(s).add(id));
    goTo(id);
  };

  return (
    <form action={preview ? undefined : action} onSubmit={preview ? (e) => e.preventDefault() : undefined} className="space-y-4" data-preview={preview || undefined}>
      {/* progress + review of pre-filled answers */}
      <div className="card sticky top-[calc(var(--header-h)+8px)] z-10 p-4" data-testid="progress">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink" data-testid="estimate">
              ≈ {minutes} min · {answered} de {questions.length} ya rellenadas
            </p>
            <p className="text-xs text-muted">About {minutes} min · {answered} of {questions.length} already filled in</p>
          </div>
          {prefilledIds.length > 0 &&
            (confirmed ? (
              <Badge tone="success" icon="check" size="md">{prefilledIds.length} respuestas pre-rellenadas confirmadas</Badge>
            ) : (
              <div className="flex flex-col items-stretch sm:items-end">
                <Button type="button" variant="primary" size="sm" icon="check" onClick={() => setReviewing(true)} data-testid="review-prefilled">
                  Revisar {prefilledIds.length} respuestas pre-rellenadas
                </Button>
                <span className="mt-1 text-center text-[11px] text-muted sm:text-right">Review {prefilledIds.length} pre-filled answers</span>
              </div>
            ))}
        </div>
        <ScoreBar value={(answered / Math.max(1, questions.length)) * 100} tone="neutral" size="sm" className="mt-3" label="Progreso" />
      </div>

      <Modal
        open={reviewing}
        onClose={() => setReviewing(false)}
        size="lg"
        title={`Revise ${prefilledIds.length} respuestas pre-rellenadas`}
        description="Cada respuesta procede de la fuente indicada. Corrija las que no sean exactas y confirme el resto. / Each answer comes from the source shown: correct any that are wrong, then confirm."
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setReviewing(false)}>Cerrar</Button>
            <Button type="button" variant="primary" icon="check" onClick={confirmAll} data-testid="confirm-prefilled">
              Confirmar todas
            </Button>
          </>
        }
      >
        <ol className="divide-y divide-line" data-testid="review-list">
          {prefilled.map((q) => {
            const pre = prefill.answers[q.id];
            const n = questions.indexOf(q) + 1;
            const changed = values[q.id] !== pre.value;
            return (
              <li key={q.id} className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-start sm:gap-3" data-testid="review-item" data-qid={q.id}>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-ink"><span className="num text-muted">{n}.</span> {q.es}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="num rounded-md bg-subtle px-2 py-0.5 text-sm font-semibold text-ink" data-testid="review-value">
                      {showAnswerEs(q, values[q.id] || pre.value)}
                    </span>
                    {changed && <Badge tone="neutral" icon="flag">Corregida</Badge>}
                    <PrefillSourceChip source={pre.source} q={q} recordsHref={recordsHref} lang="es" />
                  </div>
                </div>
                <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => correct(q.id)}>Corregir</Button>
              </li>
            );
          })}
        </ol>
      </Modal>

      <fieldset className="card min-w-0 divide-y divide-line">
        {questions.map((q, n) => {
          const pre = prefill.answers[q.id];
          const hint = prefill.hints[q.id];
          const changed = pre && values[q.id] !== pre.value;
          const err = errorOf(q);
          const rule = numberRule(q);
          if (collapsed(q.id)) {
            return (
              <div key={q.id} id={`q-${q.id}`} className="flex items-start gap-3 bg-emerald-50/40 px-4 py-3 sm:px-5" data-testid="q-collapsed">
                <input type="hidden" name={q.id} value={values[q.id]} />
                <Icon name="check" size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                  <div className="min-w-0 text-sm text-ink-2 sm:flex-1">
                    <span className="num text-muted">{n + 1}.</span> {q.es}
                    <span className={`num ml-2 font-semibold text-ink ${showAnswerEs(q, values[q.id]).length <= 12 ? "whitespace-nowrap" : "break-words"}`}>{showAnswerEs(q, values[q.id])}</span>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:shrink-0 sm:flex-nowrap">
                    <PrefillSourceChip source={pre.source} q={q} recordsHref={recordsHref} lang="es" />
                    <Button type="button" variant="ghost" size="sm" className="-my-1 shrink-0" disabled={preview} onClick={() => setEditing((s) => new Set(s).add(q.id))}>Corregir</Button>
                  </div>
                </div>
              </div>
            );
          }
          return (
            <fieldset key={q.id} id={`q-${q.id}`} className="scroll-mt-40 px-4 py-4 sm:px-5" data-testid="q-item" data-qid={q.id}>
              <legend className="sr-only">{q.es}</legend>
              <label className="block text-sm font-medium text-ink" htmlFor={q.type === "number" || q.type === "text" ? q.id : undefined}>
                <span className="num text-muted">{n + 1}.</span> {q.es}
                {q.id === "interest" && <span className="text-rose-700"> *</span>}
              </label>
              {q.en !== q.es && <p className="mt-0.5 text-xs text-muted">{q.en}</p>}
              <div className="mt-2.5">
                {q.type === "yesno" || q.type === "yesnomaybe" ? (
                  <div className="flex flex-wrap gap-2">
                    {CHOICES[q.type].map(([v, l]) => (
                      <label key={v} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition ${values[q.id] === v ? "border-brand-500 bg-brand-50 text-brand-800" : "border-line-strong bg-surface text-ink hover:border-brand-300"}`}>
                        <input type="radio" name={q.id} value={v} checked={values[q.id] === v} onChange={() => set(q.id, v)} required={q.id === "interest"} disabled={preview} className="h-4 w-4 accent-brand-600" /> {l}
                      </label>
                    ))}
                  </div>
                ) : rule ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {/* text, not type=number: the browser would silently read "2.000" as 2 or drop "0,5" */}
                    <input
                      id={q.id}
                      name={q.id}
                      type="text"
                      autoComplete="off"
                      inputMode={rule.integer ? "numeric" : "decimal"}
                      className="input num h-10 w-36"
                      value={values[q.id]}
                      onChange={(e) => set(q.id, e.target.value)}
                      disabled={preview}
                      aria-invalid={err ? true : undefined}
                      aria-describedby={err ? `${q.id}-err` : undefined}
                    />
                    <span className="text-xs text-muted">
                      {rule.integer ? "Número entero, sin separador de miles" : "Admite un decimal (p. ej. 0,5)"}
                    </span>
                  </div>
                ) : (
                  <textarea id={q.id} name={q.id} rows={2} className="input" value={values[q.id]} onChange={(e) => set(q.id, e.target.value)} disabled={preview} />
                )}
              </div>
              {err && (
                <p id={`${q.id}-err`} className="mt-1.5 flex items-start gap-1.5 text-[13px] text-rose-700" role="alert" data-testid="q-error">
                  <Icon name="alert" size={13} className="mt-0.5 shrink-0" /> <span>{err.es} <span className="text-rose-600/80">/ {err.en}</span></span>
                </p>
              )}
              {pre && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs" data-testid="q-source">
                  {changed ? (
                    <Badge tone="neutral" icon="flag">Corregido por usted · antes: {showAnswerEs(q, pre.value)}</Badge>
                  ) : confirmed ? (
                    <Badge tone="success" icon="check">Confirmada</Badge>
                  ) : (
                    <span className="text-ink-2">Pre-rellenada. Confirme o corrija:</span>
                  )}
                  <PrefillSourceChip source={pre.source} q={q} recordsHref={recordsHref} lang="es" />
                </div>
              )}
              {hint && (
                <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-subtle px-2.5 py-1.5 text-xs text-ink-2" data-testid="q-hint">
                  <Icon name="info" size={13} className="mt-0.5 shrink-0 text-muted" />
                  <div className="min-w-0">
                    <span className="mr-2">{hint.es}</span>
                    <PrefillSourceChip source={hint.source} q={q} recordsHref={recordsHref} lang="es" className="align-middle" />
                  </div>
                </div>
              )}
            </fieldset>
          );
        })}
      </fieldset>

      {/* consent to reuse the hospital's own facts (institutional addresses only) */}
      <div className="card p-5">
        {preview ? (
          <p className="text-sm text-ink-2" data-testid="preview-consent">
            Aquí el hospital decide si sus respuestas sobre el centro se guardan para futuras solicitudes.
            <span className="mt-1 block text-xs text-muted">Here the hospital chooses whether its answers about the site are saved for future requests.</span>
          </p>
        ) : domain ? (
          <>
            <Check
              name="reuse_consent"
              data-testid="reuse-consent"
              label={<span className="font-medium">{REUSE_CONSENT.es}</span>}
              hint={
                <>
                  {REUSE_CONSENT.en}{" "}
                  <span className="block pt-1">
                    {reusable} de {questions.length} preguntas son sobre el centro y se pueden reutilizar en solicitudes enviadas a @{domain}.{" "}
                    <a href={`/q/${token}/memoria`} target="_blank" className="font-medium text-brand-700 underline">Revisar respuestas guardadas</a>
                  </span>
                </>
              }
            />
            <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
              Si no marca la casilla, sus respuestas se envían igualmente al promotor para este estudio, pero no se guardan para futuras solicitudes.
            </p>
          </>
        ) : (
          <p className="text-sm text-ink-2" data-testid="no-memory">
            Este cuestionario se envió a una dirección de correo personal, por lo que sus respuestas no se guardarán para futuras solicitudes.
            <span className="mt-1 block text-xs text-muted">This questionnaire was sent to a personal address, so your answers will not be saved for future requests.</span>
          </p>
        )}
      </div>

      {invalidCount > 0 && (
        <p className="flex items-center gap-1.5 text-sm text-rose-700" role="alert">
          <Icon name="alert" size={15} /> Revise {invalidCount === 1 ? "1 respuesta marcada" : `${invalidCount} respuestas marcadas`} antes de enviar.
        </p>
      )}
      {state?.error && <p className="flex items-center gap-1.5 text-sm text-rose-700" role="alert"><Icon name="alert" size={15} /> {state.error}</p>}
      {preview ? (
        <Button type="button" size="lg" block icon="eyeOff" disabled data-testid="preview-submit">Vista previa: no se puede enviar / Preview only</Button>
      ) : (
        <Button type="submit" size="lg" block icon="send" loading={pending} disabled={invalidCount > 0}>{pending ? "Enviando…" : "Enviar respuestas / Submit"}</Button>
      )}
    </form>
  );
}
