"use client";

import { useLang } from "@/lib/i18n/context";
import { scoreColor, scoreWord } from "@/lib/score-scale";
import { cx } from "./cx";

export interface ScoreBadgeProps {
  /** 0–100 */
  score: number;
  size?: "sm" | "md" | "lg";
  /** Print the qualitative word (e.g. "Strong") after the number. */
  showWord?: boolean;
  /** Defaults to the UI language (useLang()). */
  lang?: "en" | "es";
  /** Label for screen readers / tooltip, default "Match score" / "Puntuación". */
  label?: string;
  className?: string;
}

/**
 * Score pill: filled square in the scale colour carrying the number, optional word after it.
 * Same colours as map markers (src/lib/score-scale.ts).
 */
export function ScoreBadge({ score, size = "md", showWord, lang: langProp, label, className }: ScoreBadgeProps) {
  const uiLang = useLang();
  const lang = langProp ?? uiLang;
  const s = Math.round(Math.max(0, Math.min(100, score)));
  const c = scoreColor(s);
  const word = scoreWord(s, lang);
  const name = label ?? (lang === "es" ? "Puntuación" : "Match score");
  const box = size === "lg" ? "h-11 min-w-11 text-lg rounded-xl" : size === "sm" ? "h-6 min-w-7 text-xs rounded-md" : "h-8 min-w-9 text-sm rounded-lg";
  return (
    <span className={cx("inline-flex items-center gap-2", className)} title={`${name}: ${s}/100 · ${word}`}>
      <span
        className={cx("num inline-flex items-center justify-center px-1.5 font-semibold", box)}
        style={{ background: c.fill, color: c.text, boxShadow: `inset 0 0 0 1px ${c.stroke}33` }}
        aria-label={`${name} ${s} / 100, ${word}`}
      >
        {s}
      </span>
      {showWord && <span className={cx("font-medium", size === "sm" ? "text-xs" : "text-sm")} style={{ color: c.ink }}>{word}</span>}
    </span>
  );
}
