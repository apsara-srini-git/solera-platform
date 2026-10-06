"use client";

import { useState, useTransition } from "react";
import { Button, Chip, Icon, Input } from "@/components/ui";
import type { ConfidentialInfo } from "@/lib/types";
import { useLang } from "@/lib/i18n/context";
import { PROJECTS } from "@/lib/i18n/pro/projects";
import { saveConfidential } from "../../actions";
import HelpTip from "./help-tip";

const MAX_TERMS = 20;

/** The block list: anything here can never appear in what hospitals receive (sending is blocked if it does). */
export default function KeptOut({ projectId, conf }: { projectId: string; conf: ConfidentialInfo }) {
  const t = PROJECTS[useLang()].keptOut;
  const initial = { drugName: conf.drugName ?? "", sponsorName: conf.sponsorName ?? "", protocolCode: conf.protocolCode ?? "", otherTerms: conf.otherTerms ?? [] };
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [term, setTerm] = useState("");
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  const set = (patch: Partial<typeof v>) => { setV((s) => ({ ...s, ...patch })); setDone(false); };

  const addTerm = () => {
    const t = term.trim().slice(0, 200);
    if (t && v.otherTerms.length < MAX_TERMS && !v.otherTerms.some((x) => x.toLowerCase() === t.toLowerCase())) set({ otherTerms: [...v.otherTerms, t] });
    setTerm("");
  };
  const save = () =>
    start(async () => {
      const fd = new FormData();
      fd.set("drugName", v.drugName);
      fd.set("sponsorName", v.sponsorName);
      fd.set("protocolCode", v.protocolCode);
      v.otherTerms.forEach((t) => fd.append("otherTerm", t));
      await saveConfidential(projectId, fd);
      setSaved(v);
      setDone(true);
    });

  return (
    <div className="rounded-xl border border-line p-4 sm:p-5" data-testid="kept-out">
      <div className="flex items-center gap-2 text-sm font-medium text-ink">
        <Icon name="lock" size={15} className="shrink-0 text-muted" /> <span className="min-w-0">{t.title}</span>
        <HelpTip label={t.tipLabel} align="start">{t.tip}</HelpTip>
      </div>
      <p className="mt-0.5 text-[13px] text-muted">{t.sub}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Input className="h-9" placeholder={t.drug} aria-label={t.drug} value={v.drugName} maxLength={200} onChange={(e) => set({ drugName: e.target.value })} />
        <Input className="h-9" placeholder={t.sponsor} aria-label={t.sponsor} value={v.sponsorName} maxLength={200} onChange={(e) => set({ sponsorName: e.target.value })} />
        <Input className="h-9" placeholder={t.protocol} aria-label={t.protocol} value={v.protocolCode} maxLength={200} onChange={(e) => set({ protocolCode: e.target.value })} />
      </div>

      <div className="mt-3">
        <label className="label mb-1" htmlFor="kept-other">{t.otherTerms} <span className="font-normal text-muted">{t.optional}</span></label>
        <p className="mb-2 text-[13px] text-muted">{t.otherHelp}</p>
        {v.otherTerms.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5" data-testid="other-terms">
            {v.otherTerms.map((t) => (
              <Chip key={t} onRemove={() => set({ otherTerms: v.otherTerms.filter((x) => x !== t) })}>{t}</Chip>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input id="kept-other" className="h-9 min-w-0 flex-1 sm:max-w-sm" placeholder={v.otherTerms.length >= MAX_TERMS ? t.maxReached : t.otherPlaceholder}
            value={term} maxLength={200} disabled={v.otherTerms.length >= MAX_TERMS}
            onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTerm(); } }} />
          <Button type="button" variant="secondary" size="sm" icon="plus" className="h-9" disabled={!term.trim()} onClick={addTerm}>{t.addTerm}</Button>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-3 border-t border-line pt-3">
        {done && !dirty && <span className="flex items-center gap-1 text-[13px] text-emerald-700" role="status"><Icon name="check" size={14} /> {t.saved}</span>}
        <Button type="button" variant={dirty ? "primary" : "secondary"} size="sm" loading={pending} disabled={!dirty} onClick={save} data-testid="save-kept-out">
          {t.saveList}
        </Button>
      </div>
    </div>
  );
}
