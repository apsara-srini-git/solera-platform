"use client";

import { useState, useTransition } from "react";
import { Button, Icon, Input } from "@/components/ui";
import { useLang } from "@/lib/i18n/context";
import { PROJECTS } from "@/lib/i18n/pro/projects";
import { saveTrialDetails, type TrialDetailsInput } from "../../actions";
import HelpTip from "./help-tip";

type Item = { en: string; es: string };
const MAX = 8;

/**
 * "Trial details for hospitals": recruitment target, key patient criteria, other site requirements and optional
 * detail for area / population. Editable until the questionnaire is sent; saving updates the questionnaire.
 */
export default function TrialDetails({ projectId, initial, locked, hasQuestionnaire, areaLabel, populationLabel }: {
  projectId: string;
  initial: TrialDetailsInput;
  locked: boolean;
  hasQuestionnaire: boolean;
  areaLabel: string;
  populationLabel: string;
}) {
  const lang = useLang();
  const t = PROJECTS[lang].details;
  const [v, setV] = useState<TrialDetailsInput>(initial);
  const [saved, setSaved] = useState<TrialDetailsInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  const set = (patch: Partial<TrialDetailsInput>) => {
    setV((s) => ({ ...s, ...patch }));
    setNotice(null);
    setError(null);
  };

  const save = () =>
    start(async () => {
      setError(null);
      const r = await saveTrialDetails(projectId, v).catch((e: Error) => ({ error: e.message, saved: false }));
      if (r?.error) return setError(r.error);
      setSaved(v);
      setNotice(hasQuestionnaire ? t.savedUpdated : t.saved);
    });

  if (locked) {
    return (
      <div className="rounded-xl border border-line p-4" data-testid="trial-details">
        <Heading t={t} />
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Row label={t.patientsPerHospital}>{targetText(saved, t)}</Row>
          {saved.areaOther && <Row label={t.areaDetail}>{saved.areaOther}</Row>}
          {saved.populationOther && <Row label={t.populationDetail}>{saved.populationOther}</Row>}
          {saved.keyCriteria.length > 0 && <Row label={t.keyCriteria}>{saved.keyCriteria.map((k) => k[lang]).join(" · ")}</Row>}
          {saved.otherRequirements.length > 0 && <Row label={t.otherRequirements}>{saved.otherRequirements.map((k) => k[lang]).join(" · ")}</Row>}
        </dl>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><Icon name="lock" size={13} /> {t.locked}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line p-4 sm:p-5" data-testid="trial-details">
      <Heading t={t} />
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <label className="label" htmlFor="td-patients">{t.patientsPerHospital} <span className="font-normal text-muted">{t.recommended}</span></label>
          <div className="flex flex-wrap items-center gap-2">
            <Input id="td-patients" type="number" min={1} max={1000} inputMode="numeric" className="num w-24 shrink-0" placeholder={t.egPatients}
              value={v.targetPatientsPerSite ?? ""} onChange={(e) => set({ targetPatientsPerSite: toNumber(e.target.value) })} data-testid="td-patients" />
            <span className="text-sm whitespace-nowrap text-ink-2">{t.patientsIn}</span>
            <Input id="td-months" type="number" min={1} max={60} inputMode="numeric" className="num w-24 shrink-0" aria-label={t.recruitmentMonths} placeholder={t.egMonths}
              value={v.recruitmentMonths ?? ""} onChange={(e) => set({ recruitmentMonths: toNumber(e.target.value) })} data-testid="td-months" />
            <span className="text-sm text-ink-2">{t.months}</span>
          </div>
          <p className="mt-1.5 text-[13px] text-muted">
            {t.targetHelp}
          </p>
        </div>
        <div className="grid min-w-0 gap-3">
          <div className="min-w-0">
            <label className="label" htmlFor="td-area">{t.moreArea} <span className="font-normal text-muted">{t.optional}</span></label>
            <Input id="td-area" maxLength={200} placeholder={t.moreAreaPlaceholder} title={t.fromSearch(areaLabel)}
              value={v.areaOther} onChange={(e) => set({ areaOther: e.target.value })} />
          </div>
          <div className="min-w-0">
            <label className="label" htmlFor="td-pop">{t.morePatients} <span className="font-normal text-muted">{t.optional}</span></label>
            <Input id="td-pop" maxLength={200} placeholder={t.morePatientsPlaceholder} title={t.fromSearch(populationLabel)}
              value={v.populationOther} onChange={(e) => set({ populationOther: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <ListEditor
          id="td-criteria"
          label={t.keyCriteria}
          about={t.criteriaAbout}
          help={t.criteriaHelp}
          tip={t.criteriaTip}
          placeholder={t.criteriaPlaceholder}
          lang={lang}
          items={v.keyCriteria}
          onChange={(keyCriteria) => set({ keyCriteria })}
        />
        <ListEditor
          id="td-reqs"
          label={t.otherRequirements}
          about={t.reqsAbout}
          help={t.reqsHelp}
          tip={t.reqsTip}
          placeholder={t.reqsPlaceholder}
          lang={lang}
          items={v.otherRequirements}
          onChange={(otherRequirements) => set({ otherRequirements })}
        />
      </div>

      <div className="mt-5 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-muted">
          {hasQuestionnaire ? t.footerWithQuestionnaire : t.footerWithout}
        </p>
        <div className="flex items-center gap-3">
          {notice && !dirty && <span className="flex items-center gap-1 text-[13px] text-emerald-700" role="status" data-testid="trial-details-saved"><Icon name="check" size={14} /> {notice}</span>}
          <Button type="button" variant={dirty ? "primary" : "secondary"} loading={pending} disabled={!dirty} onClick={save} data-testid="save-trial-details">
            {t.save}
          </Button>
        </div>
      </div>
      {error && <p className="mt-2 flex items-center gap-1.5 text-[13px] text-rose-700" role="alert"><Icon name="alert" size={14} /> {error}</p>}
    </div>
  );
}

const toNumber = (s: string): number | null => (s.trim() === "" || !Number.isFinite(Number(s)) ? null : Number(s));

type Dict = (typeof PROJECTS)["en"]["details"];

function targetText(v: Pick<TrialDetailsInput, "targetPatientsPerSite" | "recruitmentMonths">, t: Dict): string {
  const n = v.targetPatientsPerSite;
  const m = v.recruitmentMonths;
  if (n && m) return t.target.both(n, m);
  if (n) return t.target.noPeriod(n);
  if (m) return t.target.noTarget(m);
  return t.target.none;
}

function Heading({ t }: { t: Dict }) {
  return (
    <>
      <div className="flex items-center gap-2 text-sm font-medium text-ink"><Icon name="doc" size={15} className="text-muted" /> {t.title}</div>
      <p className="mt-0.5 text-[13px] text-muted">{t.intro}</p>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="break-words text-ink">{children}</dd>
    </div>
  );
}

function ListEditor({ id, label, about, help, tip, placeholder, lang, items, onChange }: {
  id: string;
  label: string;
  about: string;
  lang: "en" | "es";
  help: string;
  tip: string;
  placeholder: string;
  items: Item[];
  onChange: (items: Item[]) => void;
}) {
  const t = PROJECTS[lang].details;
  const [text, setText] = useState("");
  const full = items.length >= MAX;
  const add = () => {
    const t = text.trim().replace(/\s+/g, " ").slice(0, 200);
    if (!t || full || items.some((i) => i.en.toLowerCase() === t.toLowerCase())) return setText("");
    onChange([...items, { en: t, es: t }]);
    setText("");
  };
  return (
    <div className="min-w-0" data-testid={id}>
      <div className="flex items-center gap-1.5">
        <label className="label mb-0" htmlFor={id}>{label}</label>
        <HelpTip label={about} align="start">{tip}</HelpTip>
        <span className="num ml-auto text-xs text-muted">{items.length} / {MAX}</span>
      </div>
      <p className="mt-0.5 mb-2 text-[13px] text-muted">{help}</p>
      {items.length > 0 && (
        <ul className="mb-2 divide-y divide-line rounded-lg ring-1 ring-line">
          {items.map((it, i) => (
            <li key={it.en} className="flex items-start gap-2 px-3 py-1.5 text-sm">
              <div className="min-w-0 flex-1 break-words">
                <span className="text-ink" lang={lang}>{it[lang]}</span>
                {it.es !== it.en && <span className="block text-xs text-muted" lang={lang === "es" ? "en" : "es"}>{lang === "es" ? it.en : it.es}</span>}
              </div>
              <button type="button" className="-mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted hover:bg-subtle hover:text-ink"
                aria-label={t.removeItem(it[lang])} onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <Icon name="x" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input id={id} value={text} maxLength={200} disabled={full} placeholder={full ? t.maxReached : placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} className="h-9 min-w-0 flex-1" />
        <Button type="button" variant="secondary" size="sm" icon="plus" className="h-9" disabled={full || !text.trim()} onClick={add}>{t.add}</Button>
      </div>
    </div>
  );
}
