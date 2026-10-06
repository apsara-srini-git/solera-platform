"use client";

import { useState } from "react";
import { Button, Drawer, Icon, ScoreBar } from "@/components/ui";
import { HIDDEN_HOSPITAL_LABEL, type Prefill, prefillCoverage } from "@/lib/question-library";
import { type Question, showAnswer } from "@/lib/questionnaire";
import { useLang } from "@/lib/i18n/context";
import { fmtPct } from "@/lib/i18n/pro";
import { PROJECTS } from "@/lib/i18n/pro/projects";
import { PrefillSourceChip } from "../../q/prefill-source";
import HelpTip from "./help-tip";

export interface PrefillRow {
  itemId: string;
  siteId: string;
  siteName: string;
  /** true when the questionnaire was already sent (the pre-fill shown is what the hospital received). */
  sent: boolean;
  /** Sponsor view: public data only before sending; after sending, what the invitation carried, with hospital-sourced
   *  answers redacted (redactForSponsor: no value or date). */
  prefill: Prefill;
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

/** Pre-fill summary across shortlisted hospitals + a per-hospital preview of every question. */
export default function PrefillSummary({ recordsBase, questions, rows }: {
  /** Absolute URL of the page listing the registry records behind a pre-filled count. */
  recordsBase: string;
  questions: Question[];
  rows: PrefillRow[];
}) {
  const lang = useLang();
  const t = PROJECTS[lang].prefill;
  const [open, setOpen] = useState<string | null>(null);
  const recordsHref = (r: PrefillRow) => `${recordsBase}?site=${encodeURIComponent(r.siteId)}`;
  // per-hospital count: what the hospital gets (after sending, this includes answers it confirmed before - counts only).
  // Totals (average, by source) use public data only, so they never depend on, or hint at, a hospital's earlier answers.
  const cov = rows.map((r) => {
    const all = prefillCoverage(questions, r.prefill);
    const publicFilled = all.filled - (all.bySource.get(HIDDEN_HOSPITAL_LABEL) ?? 0);
    return { r, ...all, publicFilled };
  });
  const avg = cov.length ? Math.round(cov.reduce((s, c) => s + pct(c.publicFilled, c.total), 0) / cov.length) : 0;
  const bySource = new Map<string, number>();
  for (const c of cov) for (const [k, v] of c.bySource) if (k !== HIDDEN_HOSPITAL_LABEL) bySource.set(k, (bySource.get(k) ?? 0) + v);
  const sources = [...bySource.entries()].sort((a, b) => b[1] - a[1]);
  // sources are grouped by their English label; the Spanish label travels with each answer
  const sourceEs = new Map<string, string>();
  for (const r of rows) for (const a of Object.values(r.prefill.answers)) sourceEs.set(a.source.labelEn, a.source.label);
  const sourceLabel = (en: string) => (lang === "es" ? sourceEs.get(en) ?? en : en);
  const current = cov.find((c) => c.r.itemId === open) ?? null;

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4 sm:p-5" data-testid="prefill-summary">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Icon name="sparkle" size={16} className="text-brand-600" /> {t.title}
          </h3>
          <p className="mt-0.5 max-w-xl text-[13px] text-ink-2" data-testid="prefill-public-note">
            {t.intro}{" "}
            <HelpTip label={t.recordsTipLabel} align="start">{t.recordsTip}</HelpTip>
          </p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-lg bg-surface p-3 ring-1 ring-line">
          <dt className="text-[12.5px] font-medium text-muted">{t.questions}</dt>
          <dd className="num mt-0.5 text-2xl font-semibold text-ink" data-testid="prefill-total">{questions.length}</dd>
        </div>
        <div className="rounded-lg bg-surface p-3 ring-1 ring-line">
          <dt className="flex items-center gap-1 text-[12.5px] font-medium text-muted">
            <span>{t.avg}</span>
            <HelpTip label={t.avgTipLabel}>{t.avgTip}</HelpTip>
          </dt>
          <dd className="num mt-0.5 text-2xl font-semibold text-ink" data-testid="prefill-avg">{fmtPct(avg / 100, lang)}</dd>
        </div>
        <div className="rounded-lg bg-surface p-3 ring-1 ring-line">
          <dt className="text-[12.5px] font-medium text-muted">{t.hospitals}</dt>
          <dd className="num mt-0.5 text-2xl font-semibold text-ink">{rows.length}</dd>
        </div>
      </dl>

      {sources.length > 0 && (
        <p className="mt-3 text-[13px] text-ink-2" data-testid="prefill-sources">
          <span className="text-muted">{t.bySource}</span>
          {sources.map(([label, n], i) => (
            <span key={label}>
              {i > 0 && <span className="text-muted"> · </span>}
              {sourceLabel(label)} <span className="num font-semibold text-ink">{n}</span>
            </span>
          ))}
        </p>
      )}

      <p className="mt-3 flex items-start gap-1.5 text-[13px] text-ink-2" data-testid="prefill-memory-note">
        <Icon name="info" size={14} className="mt-0.5 shrink-0 text-muted" />
        <span>
          {t.memoryNote}{" "}
          <HelpTip label={t.memoryTipLabel} align="end">{t.memoryTip}</HelpTip>
        </span>
      </p>

      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-lg bg-surface ring-1 ring-line">
        {cov.map(({ r, filled, total }) => (
          <li key={r.itemId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 sm:flex-nowrap" data-testid="prefill-row">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">{r.siteName}</div>
              <div className="text-xs text-muted">{r.sent ? t.asSent : t.publicLive}</div>
            </div>
            <div className="flex w-full items-center gap-3 sm:w-64">
              <ScoreBar value={pct(filled, total)} tone="neutral" size="sm" label={t.shareLabel(r.siteName)} />
              <span className="num shrink-0 text-[13px] whitespace-nowrap text-ink-2" data-testid="prefill-count">
                {t.count(filled, total)}
              </span>
            </div>
            <Button variant="secondary" size="sm" icon="doc" onClick={() => setOpen(r.itemId)} aria-label={t.previewAria(r.siteName)}>
              {t.preview}
            </Button>
          </li>
        ))}
      </ul>

      <Drawer
        open={!!current}
        onClose={() => setOpen(null)}
        width="lg"
        title={current ? current.r.siteName : ""}
        description={
          current
            ? current.r.sent
              ? t.drawerSent(current.filled, current.total)
              : t.drawerPublic(current.filled, current.total)
            : undefined
        }
      >
        {current && (
          <>
          <ol className="space-y-3" data-testid="prefill-preview">
            {questions.map((q, n) => {
              const a = current.r.prefill.answers[q.id];
              const hint = current.r.prefill.hints[q.id];
              return (
                <li key={q.id} className="rounded-lg border border-line p-3" data-qid={q.id} data-testid="preview-item">
                  <div className="flex gap-2">
                    <span className="num w-5 shrink-0 text-muted">{n + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-ink">{q[lang]}</div>
                      {/* answers a hospital gave in other projects are never revealed, not even which questions they cover */}
                      {a && !a.hidden ? (
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-subtle px-2 py-0.5 font-medium text-ink" data-testid="preview-value">
                            {showAnswer(q, a.value, lang)}
                          </span>
                          <span data-testid="preview-source">
                            <PrefillSourceChip source={a.source} q={q} recordsHref={recordsHref(current.r)} lang={lang} />
                          </span>
                        </div>
                      ) : (
                        <div className="mt-1.5 text-[13px] text-muted" data-testid="preview-empty">{t.hospitalWillAnswer}</div>
                      )}
                      {hint && (
                        <div className="mt-1.5 flex items-start gap-1.5 text-xs text-ink-2" data-testid="preview-hint">
                          <Icon name="info" size={13} className="mt-0.5 shrink-0 text-muted" />
                          <div className="min-w-0">
                            <span className="mr-2">{hint[lang]}</span>
                            <PrefillSourceChip source={hint.source} q={q} recordsHref={recordsHref(current.r)} lang={lang} className="align-middle" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 text-xs text-muted">
            {current.r.sent
              ? t.footSent
              : t.footPublic}
          </p>
          </>
        )}
      </Drawer>
    </div>
  );
}
