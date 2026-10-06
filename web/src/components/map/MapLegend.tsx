"use client";

import { useState, type ReactNode } from "react";
import { useLang } from "@/lib/i18n/context";
import { SEARCH } from "@/lib/i18n/pro/search";
import { scoreLegend } from "@/lib/score-scale";

/**
 * Map key. "fit": score markers low → high (colour AND size), plus the grey states.
 * "all": the neutral pre-search marker.
 * On phones the "fit" key starts as a one-line chip so it does not hide the southern hospitals; tap to expand.
 */
export function MapLegend({
  mode,
  count,
  className = "",
  filtered = false,
  unranked = true,
}: {
  mode: "fit" | "all";
  count?: number;
  className?: string;
  /** Show the "Filtered out" key only when the search actually hides hospitals. */
  filtered?: boolean;
  /** Show the "New to registered trials" key (hospitals without trial history are on the map). */
  unranked?: boolean;
}) {
  const lang = useLang();
  const t = SEARCH[lang].legend;
  const items = scoreLegend(lang, { min: 6, max: 16 });
  const [open, setOpen] = useState(false);
  if (mode === "fit" && !open) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          className={`pointer-events-auto absolute bottom-6 left-3 z-[500] inline-flex h-8 items-center gap-2 rounded-full border border-line bg-surface/95 px-3 text-xs font-semibold text-ink shadow-raised backdrop-blur sm:hidden ${className}`}
        >
          {t.fitScore}
          <span className="inline-flex items-center gap-1" aria-hidden>
            {items.map((it) => (
              <Dot key={it.bin} size={8} fill={it.color.fill} stroke={it.color.stroke} />
            ))}
          </span>
          <span className="sr-only">{t.showKey}</span>
        </button>
        <div className="hidden sm:block">
          <LegendBox className={className}>
            <FitKey items={items} filtered={filtered} unranked={unranked} />
          </LegendBox>
        </div>
      </>
    );
  }
  return (
    <LegendBox className={className}>
      {mode === "fit" && (
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t.hideKey}
          className="absolute top-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full text-muted hover:bg-subtle hover:text-ink sm:hidden"
        >
          <span aria-hidden className="text-base leading-none">
            ×
          </span>
        </button>
      )}
      {mode === "all" ? (
        <span className="inline-flex items-center gap-2">
          <Dot size={14} fill="#3d4a52" stroke="#ffffff" />
          <span>
            <span className="num font-semibold text-ink">{count ?? ""}</span> {t.allHospitals}
          </span>
        </span>
      ) : (
        <FitKey items={items} filtered={filtered} unranked={unranked} />
      )}
    </LegendBox>
  );
}

function LegendBox({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={`pointer-events-auto absolute bottom-6 left-3 z-[500] max-w-[calc(100%-1.5rem)] rounded-xl border border-line bg-surface/95 px-3 py-2.5 text-xs text-ink-2 shadow-raised backdrop-blur ${className}`}
    >
      {children}
    </div>
  );
}

function FitKey({ items, filtered, unranked }: { items: ReturnType<typeof scoreLegend>; filtered: boolean; unranked: boolean }) {
  const t = SEARCH[useLang()].legend;
  return (
    <div className="space-y-2 pr-5 sm:pr-0">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-ink">{t.fitScore}</span>
        <span className="text-muted">{t.biggerDarker}</span>
      </div>
      <div className="flex items-end gap-2.5" aria-label={t.lowToHigh}>
        <span className="pb-0.5 text-muted">{t.low}</span>
        {items.map((it) => (
          <span key={it.bin} className="flex flex-col items-center gap-1" title={`${it.range} · ${it.label}`}>
            <Dot size={it.radius * 2} fill={it.color.fill} stroke={it.color.stroke} />
            <span className="num text-[10px] text-muted">{it.from}</span>
          </span>
        ))}
        <span className="pb-0.5 text-muted">{t.high}</span>
      </div>
      {(filtered || unranked) && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-line pt-2 text-[11px] text-muted">
          {filtered && (
            <span className="inline-flex items-center gap-1.5">
              <Dot size={10} fill="#d5dbe2" stroke="#9aa5b1" dashed /> {t.filteredOut}
            </span>
          )}
          {unranked && (
            <span className="inline-flex items-center gap-1.5">
              <Dot size={8} fill="#9aa5b1" stroke="#ffffff" /> {t.newToTrials}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Dot({ size, fill, stroke, dashed }: { size: number; fill: string; stroke: string; dashed?: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: fill,
        border: `1.5px ${dashed ? "dashed" : "solid"} ${stroke}`,
        boxShadow: stroke === "#ffffff" ? "0 0 0 1px #cdd3db" : undefined,
      }}
    />
  );
}
