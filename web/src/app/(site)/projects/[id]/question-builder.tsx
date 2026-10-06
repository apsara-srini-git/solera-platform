"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Badge, Button, Icon, Select } from "@/components/ui";
import { type LibraryItem, suggestFromLibrary } from "@/lib/question-library";
import { useLang } from "@/lib/i18n/context";
import { PROJECTS } from "@/lib/i18n/pro/projects";
import { addCustomQuestion, addLibraryQuestion, type FormState } from "../../actions";

/**
 * Add a question: library suggestions appear as you type (reusing an existing question means hospitals may already
 * have answered it). Otherwise a new library entry is created with the reuse scope the sponsor picks; it is private to
 * this sponsor (never suggested to other accounts).
 */
export default function QuestionBuilder({ projectId, library, existingKeys }: { projectId: string; library: LibraryItem[]; existingKeys: string[] }) {
  const lang = useLang();
  const t = PROJECTS[lang].questions;
  const [text, setText] = useState("");
  const [state, action, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const r = await addCustomQuestion(projectId, prev, form);
    if (!r?.error) setText("");
    return r;
  }, undefined);
  const [picking, startPick] = useTransition();
  const [pickError, setPickError] = useState<string | null>(null);
  const exclude = useMemo(() => new Set(existingKeys), [existingKeys]);
  const suggestions = useMemo(() => suggestFromLibrary(text, library, exclude), [text, library, exclude]);

  const pick = (key: string) =>
    startPick(async () => {
      setPickError(null);
      const r = await addLibraryQuestion(projectId, key);
      if (r?.error) setPickError(r.error);
      else setText("");
    });

  return (
    <form action={action} className="rounded-xl border border-line bg-subtle/50 p-4" data-testid="question-builder">
      <label htmlFor="custom-q" className="label">{t.addQuestion}</label>
      <input
        id="custom-q"
        name="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="input h-10"
        placeholder={t.placeholder}
        autoComplete="off"
        required
      />

      {suggestions.length > 0 && (
        <div className="mt-3" data-testid="library-suggestions">
          <p className="text-[13px] font-medium text-ink-2">{t.fromLibrary}</p>
          <ul className="mt-1.5 divide-y divide-line overflow-hidden rounded-lg bg-surface ring-1 ring-line">
            {suggestions.map((s) => (
              <li key={s.key} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-ink">{s.es}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    {lang === "en" && s.en !== s.es && <span>{s.en} ·</span>}
                    <span>{t.types[s.type]}</span>
                    <Badge tone={s.policy === "trial" ? "neutral" : "brand"}>{t.policy[s.policy].label}</Badge>
                  </div>
                </div>
                <Button type="button" variant="secondary" size="sm" icon="plus" loading={picking} onClick={() => pick(s.key)}>
                  {t.useThis}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <fieldset>
          <legend className="label">{t.answerAbout}</legend>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-5">
            <label className="flex cursor-pointer items-start gap-2 text-sm text-ink">
              <input type="radio" name="scope" value="trial" defaultChecked className="mt-0.5 h-4 w-4 accent-brand-600" />
              <span>{t.scopeTrial}<span className="block text-xs text-muted">{t.scopeTrialHint}</span></span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-ink">
              <input type="radio" name="scope" value="site" className="mt-0.5 h-4 w-4 accent-brand-600" />
              <span>{t.scopeSite}<span className="block text-xs text-muted">{t.scopeSiteHint}</span></span>
            </label>
          </div>
        </fieldset>
        <div className="flex gap-2">
          <Select name="type" aria-label={t.answerType} className="w-36" defaultValue="text">
            <option value="text">{t.types.text}</option>
            <option value="yesno">{t.types.yesno}</option>
            <option value="number">{t.types.number}</option>
          </Select>
          <Button type="submit" variant="primary" icon="plus" loading={pending}>{suggestions.length ? t.addAsNew : t.add}</Button>
        </div>
      </div>
      {(state?.error || pickError) && (
        <p className="mt-2 flex items-center gap-1.5 text-[13px] text-rose-700" role="alert">
          <Icon name="alert" size={14} /> {state?.error ?? pickError}
        </p>
      )}
    </form>
  );
}
