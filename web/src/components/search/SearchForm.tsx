"use client";

import { useId, useState, type ReactNode } from "react";
import { Button, Check, Field, Icon, Input, SegmentedControl, Select, ToggleChip, cx } from "@/components/ui";
import { useLang } from "@/lib/i18n/context";
import { LABELS } from "@/lib/i18n/pro";
import { SEARCH } from "@/lib/i18n/pro/search";
import { EQUIPMENT, type PhaseOption, type TrialCriteria } from "@/lib/types";

/** Example searches. `label` is the English chip text; the chip shows SEARCH.form.examples[i] · phase in the UI language.
 *  The indication stays in the registries' English (Spanish names match too). */
export const EXAMPLES: { label: string; c: Partial<TrialCriteria> }[] = [
  { label: "NSCLC · Phase III", c: { indication: "non-small cell lung cancer, NSCLC", area: "oncology", phase: "PHASE3", equipment: ["pet"] } },
  { label: "Multiple sclerosis · Phase II", c: { indication: "multiple sclerosis", area: "neurology", phase: "PHASE2", equipment: ["mri"] } },
  {
    label: "Paediatric ALL · Phase II",
    c: { indication: "acute lymphoblastic leukaemia", area: "hematology", phase: "PHASE2", population: "pediatric" },
  },
  { label: "Heart failure · Phase II/III", c: { indication: "heart failure", area: "cardiovascular", phase: "PHASE2_3" } },
];

/** Equipment shown before "More equipment" (the most commonly required imaging). */
const COMMON_EQUIPMENT = ["ct", "mri", "pet"];
const PHASE_ORDER: PhaseOption[] = ["PHASE1", "PHASE1_2", "PHASE2", "PHASE2_3", "PHASE3", "PHASE4"];

export interface SearchFormProps {
  c: TrialCriteria;
  onChange: (next: TrialCriteria) => void;
  onSubmit: (c: TrialCriteria) => void;
  onExample?: (c: TrialCriteria) => void;
  pending: boolean;
  submitLabel?: string;
  /** Hide the example chips (e.g. inside the edit drawer). */
  hideExamples?: boolean;
  defaults: TrialCriteria;
  /** Shown right under the indication field (e.g. "Did you mean…?"). */
  belowIndication?: ReactNode;
  /** Shown under the submit button (e.g. download / open a saved search). */
  footer?: ReactNode;
}

export function SearchForm({
  c,
  onChange,
  onSubmit,
  onExample,
  pending,
  submitLabel,
  hideExamples,
  defaults,
  belowIndication,
  footer,
}: SearchFormProps) {
  const lang = useLang();
  const t = SEARCH[lang].form;
  const L = LABELS[lang];
  const id = useId();
  const set = <K extends keyof TrialCriteria>(k: K, v: TrialCriteria[K]) => onChange({ ...c, [k]: v });
  const [allEquipment, setAllEquipment] = useState(false);
  const [indicationError, setIndicationError] = useState(false);
  const equipmentShown = Object.entries(EQUIPMENT).filter(([k]) => allEquipment || COMMON_EQUIPMENT.includes(k) || c.equipment.includes(k));
  const equipmentHidden = Object.keys(EQUIPMENT).length - equipmentShown.length;

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!c.indication.trim()) {
          setIndicationError(true);
          document.getElementById(`${id}-ind`)?.focus();
          return;
        }
        onSubmit(c);
      }}
    >
      <div>
        <Field
          label={t.indication}
          htmlFor={`${id}-ind`}
          hint={t.indicationHint}
          error={indicationError && !c.indication.trim() ? t.indicationError : undefined}
        >
          <div className="relative">
            <Icon name="search" size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <Input
              id={`${id}-ind`}
              aria-required
              invalid={indicationError && !c.indication.trim()}
              className="h-11 pl-9 text-[15px]"
              placeholder={t.indicationPlaceholder}
              value={c.indication}
              aria-describedby={indicationError && !c.indication.trim() ? `${id}-ind-error` : `${id}-ind-hint`}
              onChange={(e) => {
                if (e.target.value.trim()) setIndicationError(false);
                set("indication", e.target.value);
              }}
            />
          </div>
        </Field>
        {belowIndication && <div className="mt-2.5">{belowIndication}</div>}
        {!hideExamples && onExample && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 text-xs font-medium text-muted">{t.tryLabel}</span>
            {EXAMPLES.map((ex, i) => (
              <button
                type="button"
                key={ex.label}
                className="chip h-7 border border-line bg-surface text-ink-2 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
                onClick={() => onExample({ ...defaults, ...ex.c })}
              >
                {ex.c.phase ? `${t.examples[i]} · ${L.phases[ex.c.phase]}` : t.examples[i]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* free-text "Other…" refinements are asked on the project page; a value from a protocol upload is kept as is */}
        <Field label={t.area} htmlFor={`${id}-area`}>
          <Select id={`${id}-area`} value={c.area} onChange={(e) => set("area", e.target.value)}>
            <option value="">{t.anyArea}</option>
            {Object.entries(L.areas).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t.phase} htmlFor={`${id}-phase`}>
          <Select id={`${id}-phase`} value={c.phase} onChange={(e) => set("phase", e.target.value as PhaseOption)}>
            {PHASE_ORDER.map((k) => (
              <option key={k} value={k}>
                {L.phases[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t.population} htmlFor={`${id}-pop`}>
          <Select id={`${id}-pop`} value={c.population} onChange={(e) => set("population", e.target.value as TrialCriteria["population"])}>
            {Object.entries(L.populations).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t.hospitalType}>
          <SegmentedControl
            label={t.hospitalType}
            value={c.ownership}
            onChange={(v) => set("ownership", v)}
            className="flex w-full [&>*]:flex-1"
            options={[
              { value: "any", label: t.ownershipAny },
              { value: "public", label: L.ownership.public },
              { value: "private", label: L.ownership.private },
            ]}
          />
        </Field>
      </div>

      <div>
        <span className="label">{t.equipment}</span>
        <div className="flex flex-wrap gap-1.5">
          {equipmentShown.map(([k, v]) => {
            const on = c.equipment.includes(k);
            return (
              <ToggleChip
                key={k}
                pressed={on}
                onPressedChange={(p) => set("equipment", p ? [...c.equipment, k] : c.equipment.filter((x) => x !== k))}
                className="h-7 px-2.5 text-xs"
              >
                {L.equipment[k] ?? v}
              </ToggleChip>
            );
          })}
          {(equipmentHidden > 0 || allEquipment) && (
            <button
              type="button"
              onClick={() => setAllEquipment(!allEquipment)}
              aria-expanded={allEquipment}
              className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs font-medium text-brand-700 hover:bg-brand-50"
            >
              {allEquipment ? t.fewer : t.more(equipmentHidden)}
              <Icon name="chevronDown" size={13} className={cx("transition", allEquipment && "rotate-180")} />
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[12.5px] text-muted">
          {t.equipmentNote}
        </p>
        {c.equipment.length > 0 && (
          <Check
            className="mt-2.5 text-[13px]"
            checked={!!c.equipmentStrict}
            onChange={(e) => set("equipmentStrict", e.target.checked || undefined)}
            label={t.strict}
            hint={c.equipmentStrict ? t.strictOn : t.strictOff}
          />
        )}
      </div>

      <Button type="submit" size="lg" block loading={pending} disabled={pending} icon={pending ? undefined : "search"}>
        {pending ? t.ranking : (submitLabel ?? t.submit)}
      </Button>
      {footer}
    </form>
  );
}
