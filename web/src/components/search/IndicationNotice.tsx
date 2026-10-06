"use client";

import { Fragment } from "react";
import { Button, Icon, cx } from "@/components/ui";
import { useLang } from "@/lib/i18n/context";
import { SEARCH } from "@/lib/i18n/pro/search";
import type { IndicationCheck } from "@/lib/spelling";

/**
 * "Did you mean…?" for the indication. `confirm`: nothing matched, nothing ranked yet - suggestions plus "Search anyway".
 * `results`: shown above ranked results - a warning after "Search anyway", or a note on the parts that matched nothing.
 */
export function IndicationNotice({
  check,
  mode,
  onPick,
  onAnyway,
  onAdd,
  className,
}: {
  check: IndicationCheck;
  mode: "confirm" | "results";
  /** Replace part `index` of the indication with `label` and search again. */
  onPick: (index: number, label: string) => void;
  onAnyway?: () => void;
  /** Add another name to the indication and search again. */
  onAdd?: (label: string) => void;
  className?: string;
}) {
  const t = SEARCH[useLang()].notice;
  const missing = check.parts.map((p, i) => ({ ...p, i })).filter((p) => p.trials === 0);
  const english = check.parts.map((p, i) => ({ ...p, i })).filter((p) => p.english);
  if (!missing.length && !(mode === "results" && english.length && onAdd)) return null;
  const warn = check.noneMatch;

  return (
    <div
      className={cx(
        "rounded-lg px-3 py-2.5 text-[13px] ring-1 ring-inset",
        warn ? "bg-amber-50 text-amber-950 ring-amber-200" : "bg-subtle text-ink-2 ring-line",
        className,
      )}
      role={mode === "confirm" ? "alert" : "status"}
      data-testid={mode === "confirm" ? "indication-confirm" : "indication-warning"}
    >
      {mode === "results" && warn && (
        <p className="mb-1.5 flex items-start gap-1.5 font-medium">
          <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
          {t.noneMatch}
        </p>
      )}
      <ul className="space-y-1.5">
        {missing.map((p) => (
          <li key={p.i} className="flex items-start gap-1.5">
            {!(mode === "results" && warn) && <Icon name={warn ? "alert" : "info"} size={14} className="mt-0.5 shrink-0 opacity-70" />}
            <span className="min-w-0">
              {t.notFoundPre} <strong className="font-semibold">{t.q(p.text)}</strong> {t.notFoundPost}
              {!warn && t.notCounted}.{" "}
              {p.suggestions.length > 0 ? (
                <>
                  {t.didYouMean}{" "}
                  {p.suggestions.map((s, k) => (
                    <Fragment key={s.label}>
                      {k > 0 && <span className="text-muted"> · </span>}
                      <button
                        type="button"
                        onClick={() => onPick(p.i, s.label)}
                        className="font-medium text-brand-700 underline decoration-brand-300 underline-offset-2 hover:decoration-brand-700"
                        data-testid="indication-suggestion"
                      >
                        {s.label}
                      </button>
                      <span className="num text-xs text-muted"> {t.trials(s.trials)}</span>
                    </Fragment>
                  ))}
                  {t.didYouMeanEnd}
                </>
              ) : (
                <>{t.checkSpelling}</>
              )}
            </span>
          </li>
        ))}
        {mode === "results" &&
          onAdd &&
          english.map((p) => (
            <li key={`en-${p.i}`} className="flex items-start gap-1.5" data-testid="indication-english">
              <Icon name="info" size={14} className="mt-0.5 shrink-0 opacity-70" />
              <span className="min-w-0">
                {t.english(p.text, p.trials)}{" "}
                <button
                  type="button"
                  onClick={() => onAdd(p.english!.label)}
                  className="font-medium text-brand-700 underline decoration-brand-300 underline-offset-2 hover:decoration-brand-700"
                >
                  {t.alsoSearch(p.english!.label)}
                </button>
                <span className="num text-xs text-muted"> {t.trials(p.english!.trials)}</span>
              </span>
            </li>
          ))}
      </ul>
      {mode === "confirm" && onAnyway && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-amber-200/70 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onAnyway} data-testid="search-anyway">
            {t.searchAnyway}
          </Button>
          <span className="text-xs text-amber-900/80">{t.anywayNote}</span>
        </div>
      )}
    </div>
  );
}
