"use client";

import { useId, useState } from "react";
import { Badge, Icon } from "@/components/ui";
import { useLang } from "@/lib/i18n/context";
import { SEARCH } from "@/lib/i18n/pro/search";

type Item = { en: string; es: string };

/**
 * Editable list of free-text items stored as {en, es}. Typed items use the same text in both languages until a
 * translation exists. Items listed in `fromProtocol` get a "From protocol" tag.
 */
export function ListEditor({
  label,
  hint,
  note,
  placeholder,
  items,
  onChange,
  fromProtocol,
  max = 8,
}: {
  label: string;
  hint?: string;
  note?: string;
  placeholder: string;
  items: Item[];
  onChange: (items: Item[]) => void;
  fromProtocol?: Set<string>;
  max?: number;
}) {
  const t = SEARCH[useLang()].listEditor;
  const id = useId();
  const [draft, setDraft] = useState("");
  const full = items.length >= max;
  const add = () => {
    const text = draft.trim().slice(0, 200);
    if (!text || full || items.some((i) => i.en.toLowerCase() === text.toLowerCase())) return;
    onChange([...items, { en: text, es: text }]);
    setDraft("");
  };
  return (
    <div>
      <div className="flex items-end justify-between gap-2">
        <label className="label" htmlFor={`${id}-in`}>
          {label}
        </label>
        <span className="num mb-1.5 text-[11px] text-muted">
          {items.length}/{max}
        </span>
      </div>
      {hint && <p className="-mt-1 mb-2 text-[12.5px] text-muted">{hint}</p>}
      {items.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {items.map((k, i) => (
            <li key={`${i}-${k.en}`} className="flex items-start gap-2 rounded-lg border border-line bg-subtle/60 px-2.5 py-1.5 text-[13px]">
              <span className="min-w-0 flex-1">
                <span className="text-ink">{k.en}</span>
                {k.es !== k.en && <span className="block text-xs text-muted">{k.es}</span>}
                {fromProtocol?.has(k.en) && (
                  <Badge tone="neutral" icon="doc" className="mt-1">
                    {t.fromProtocol}
                  </Badge>
                )}
              </span>
              <button
                type="button"
                aria-label={t.remove(k.en)}
                className="-mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted hover:bg-rose-50 hover:text-rose-700"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
              >
                <Icon name="x" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          id={`${id}-in`}
          className="input h-9 flex-1"
          placeholder={full ? t.max(max) : placeholder}
          value={draft}
          maxLength={200}
          disabled={full}
          aria-describedby={note ? `${id}-note` : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="btn-secondary h-9 px-3" onClick={add} disabled={!draft.trim() || full}>
          <Icon name="plus" size={14} /> {t.add}
        </button>
      </div>
      {note && (
        <p id={`${id}-note`} className="mt-1.5 text-[12px] text-muted">
          {note}
        </p>
      )}
    </div>
  );
}
