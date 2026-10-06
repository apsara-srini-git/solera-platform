/**
 * Plain-language explanation of a fit score: band, impact tiers, strengths / "holding it back" reasons and
 * "what would raise this score?" tips, all generated from the score components (client-safe, no data access).
 * Points always come from scoreBreakdown (score-points.ts) so every number shown adds up to the score.
 * Text comes from SCORING[lang] (lib/i18n/pro/scoring.ts); band labels and meanings from LABELS[lang].bands.
 */
import type { ScoreComponent, SiteResult } from "@/lib/search";
import { LABELS, type Lang } from "@/lib/i18n/pro";
import { SCORING } from "@/lib/i18n/pro/scoring";
import { PHASES, type PhaseOption } from "@/lib/types";
import type { ScoreBreakdown } from "./score-points";

export type BandKey = "strong" | "good" | "possible" | "weak";
export interface Band {
  key: BandKey;
  min: number;
  max: number;
  /** Chip classes (tint + ink + ring); always shown with the text, never colour alone. */
  chip: string;
  /** Solid swatch for legends / bars. */
  swatch: string;
}

/** Score ranges and colours. Labels and meanings: bandText(band, lang). */
export const BANDS: Band[] = [
  { key: "strong", min: 80, max: 100, chip: "bg-brand-700 text-white ring-brand-800", swatch: "#005051" },
  { key: "good", min: 60, max: 79, chip: "bg-brand-50 text-brand-800 ring-brand-300", swatch: "#1da19f" },
  { key: "possible", min: 40, max: 59, chip: "bg-amber-50 text-amber-900 ring-amber-300", swatch: "#d39a2c" },
  { key: "weak", min: 0, max: 39, chip: "bg-slate-100 text-slate-700 ring-slate-300", swatch: "#94a3b8" },
];

export function band(score: number): Band {
  return BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1];
}

/** "Strong fit" / "Muy adecuado" and its one-line meaning. */
export function bandText(b: Band, lang: Lang): { label: string; meaning: string } {
  return LABELS[lang].bands[b.key];
}

export type Impact = "High" | "Medium" | "Lower";
/** Impact follows the factor's maximum points (37 → High; 16, 16, 11 → Medium; 10, 10 → Lower). */
export function impact(max: number): Impact {
  return max >= 25 ? "High" : max >= 11 ? "Medium" : "Lower";
}

/** Name and one-line meaning per factor (the receipt and the methodology page). */
export function factors(lang: Lang) {
  return SCORING[lang].factors;
}
export function deductions(lang: Lang) {
  return SCORING[lang].deductions;
}

export interface ExplainContext {
  /** The search's phase label. English labels (lib/types PHASES) are mapped to the UI language. */
  phaseLabel: string;
  /** The search's phase; preferred over phaseLabel when given. */
  phase?: PhaseOption;
  /** Hospitals ranked for this search (shown as "#2 of 14"). */
  rankOf?: number;
}

/** Phase for running text: "Phase II" / "fase II". */
function phaseText(ctx: ExplainContext, lang: Lang): string {
  const key = ctx.phase ?? (Object.keys(PHASES) as PhaseOption[]).find((k) => PHASES[k] === ctx.phaseLabel || LABELS.es.phases[k] === ctx.phaseLabel);
  if (!key) return ctx.phaseLabel;
  const label = LABELS[lang].phases[key];
  return lang === "es" ? label.replace(/^Fase/, "fase") : label;
}

type R = Pick<SiteResult, "score" | "components" | "stats" | "missingEquipment" | "penalties" | "ranks" | "basis">;

/** "in the therapeutic area" when an area was chosen; with no area the count is every registered trial. */
function areaChosen(r: R): boolean {
  if (r.basis) return r.basis.areaChosen;
  const d = r.components.find((c) => c.key === "area")?.detail ?? "";
  return !d.includes("overall") && !d.includes("en total");
}

/** What phase / recent counts were judged on, as a suffix: " in your condition", " in the therapeutic area" or
 *  " (any condition)" when the condition has no trials in Madrid and no area was chosen. */
function basisSuffix(r: R, lang: Lang): string {
  const b = r.basis?.experience ?? (r.stats.indicationTrials ? "condition" : null);
  return SCORING[lang].explain.basis[b ?? "none"];
}

/** First year counted as recent (this calendar year and the 3 before it, as the search counts it). */
function since(r: R): number {
  return r.basis?.recentSince ?? new Date().getFullYear() - 3;
}

function rankPhrase(rank: number | undefined, lang: Lang, largest = false): string | null {
  return rank ? SCORING[lang].explain.rank(rank, largest) : null;
}

/** Short fact for a factor ("60 trials · most in Madrid: 70"). */
export function factFor(c: ScoreComponent, r: R, ctx: ExplainContext, lang: Lang = "en"): { text: string; sub?: string } {
  const t = SCORING[lang].explain;
  const n = c.count ?? 0;
  const top = c.top;
  const b = basisSuffix(r, lang);
  const topSub = top == null || c.scale !== "log" || top === 0 ? undefined : top > n ? t.mostInMadrid(top) : t.theMost;
  switch (c.key) {
    case "indication":
      return { text: t.inCondition(n), sub: topSub };
    case "phase":
      return { text: t.phaseTrials(n, phaseText(ctx, lang), b), sub: topSub };
    case "area":
      return { text: areaChosen(r) ? t.inArea(n) : t.overall(n), sub: topSub };
    case "recent":
      return { text: t.recent(n, b, since(r)), sub: topSub };
    case "completion":
      return r.stats.completionRate == null ? { text: t.tooFew, sub: t.halfPoints } : { text: t.completionOf(r.stats.completionRate, n) };
    case "capacity":
      return { text: t.beds(n), sub: t.bedsFull(n >= 800) };
    case "pediatric":
      return { text: t.pediatric(n, b), sub: topSub };
    default:
      return { text: c.detail };
  }
}

export interface Reason {
  key: string;
  text: string;
}

function suffix(s: string | null) {
  return s ? `: ${s}` : "";
}

/** Up to 2 strengths, strongest first, from the components the hospital does best on. */
export function strengths(r: R, pts: ScoreBreakdown, ctx: ExplainContext, lang: Lang = "en"): Reason[] {
  const t = SCORING[lang].explain;
  const b = basisSuffix(r, lang);
  const out: (Reason & { w: number })[] = [];
  for (const c of r.components) {
    const max = pts.max[c.key] ?? 0;
    const p = pts.points[c.key] ?? 0;
    if (!max || p / max < 0.6) continue;
    const rank = rankPhrase(r.ranks?.[c.key], lang);
    const n = c.count ?? 0;
    let text: string | null = null;
    if (c.key === "indication" && n > 0) text = `${t.inCondition(n)}${suffix(rank)}`;
    else if (c.key === "phase" && n > 0) text = `${t.phaseTrials(n, phaseText(ctx, lang), b)}${suffix(rank)}`;
    else if (c.key === "area" && n > 0) text = `${areaChosen(r) ? t.inTherapeuticArea(n) : t.overall(n)}${suffix(rank)}`;
    else if (c.key === "recent" && n > 0) text = `${t.recent(n, b, since(r))}${suffix(rank)}`;
    else if (c.key === "completion" && r.stats.completionRate != null) text = t.completion(r.stats.completionRate);
    else if (c.key === "capacity") text = `${t.beds(n)}${suffix(rankPhrase(r.ranks?.[c.key], lang, true))}`;
    else if (c.key === "pediatric" && n > 0) text = `${t.pediatric(n, b)}${suffix(rank)}`;
    // experience in the condition matters most to sponsors: prefer it at equal strength
    if (text) out.push({ key: c.key, text, w: (p / max) * max + (c.key === "indication" ? 6 : c.key === "phase" ? 3 : 0) });
  }
  return out
    .sort((a, b) => b.w - a.w)
    .slice(0, 2)
    .map(({ key, text }) => ({ key, text }));
}

/** The single biggest thing holding the score back (a deduction or the factor with most points missing), if ≥ 3 pts. */
export function holdingBack(r: R, pts: ScoreBreakdown, ctx: ExplainContext, lang: Lang = "en"): (Reason & { points: number }) | null {
  const t = SCORING[lang].explain;
  const b = basisSuffix(r, lang);
  const cands: (Reason & { points: number })[] = [];
  if (pts.competingPenalty > 0)
    cands.push({ key: "competing", points: pts.competingPenalty, text: t.competingHold(r.stats.competingTrials, pts.competingPenalty) });
  if (pts.equipmentPenalty > 0)
    cands.push({ key: "equipment", points: pts.equipmentPenalty, text: t.equipmentHold(r.missingEquipment, pts.equipmentPenalty) });
  for (const c of r.components) {
    const lost = (pts.max[c.key] ?? 0) - (pts.points[c.key] ?? 0);
    if (lost < 3) continue;
    const n = c.count ?? 0;
    const tag = t.tag(pts.points[c.key], pts.max[c.key]);
    let text: string;
    if (c.key === "indication") text = n === 0 ? t.noCondition : t.vsTop(n, c.top ?? 0);
    else if (c.key === "phase") text = `${t.phaseHold(n, phaseText(ctx, lang), b)}${tag}`;
    else if (c.key === "area") text = `${areaChosen(r) ? t.inTherapeuticArea(n) : t.overall(n)}${tag}`;
    else if (c.key === "recent") text = `${t.recentHold(n, b, since(r))}${tag}`;
    else if (c.key === "completion") text = r.stats.completionRate == null ? `${t.tooFewCompletion}${tag}` : `${t.completion(r.stats.completionRate)}${tag}`;
    else if (c.key === "capacity") text = `${t.smaller(n)}${tag}`;
    else text = `${SCORING[lang].factors[c.key]?.name ?? c.label}${tag}`;
    cands.push({ key: c.key, points: lost, text });
  }
  cands.sort((a, b) => b.points - a.points);
  return cands[0] && cands[0].points >= 3 ? cands[0] : null;
}

/** Exact (unrounded) points of one component at value v. */
function exactPoints(r: R, c: ScoreComponent, v: number) {
  const total = r.components.reduce((s, x) => s + x.weight, 0) || 1;
  return ((c.weight * v) / total) * 100;
}
const logValue = (n: number, ref: number) => Math.min(1, Math.log1p(n) / Math.log1p(Math.max(ref, n)));

/** 1–3 "what would raise this score?" lines from the biggest gaps (always followed by the site-knowledge line). */
export function raiseTips(r: R, pts: ScoreBreakdown, ctx: ExplainContext, lang: Lang = "en"): string[] {
  const t = SCORING[lang].explain;
  const b = basisSuffix(r, lang);
  const tips: { gain: number; text: string }[] = [];
  for (const c of r.components) {
    const lost = (pts.max[c.key] ?? 0) - (pts.points[c.key] ?? 0);
    if (lost < 2) continue;
    if (c.scale === "log" && c.ref != null && c.count != null) {
      const now = exactPoints(r, c, c.value);
      const target = Math.min(lost, Math.max(3, lost / 2));
      let k = 1;
      for (; k <= 500; k++) if (exactPoints(r, c, logValue(c.count + k, c.ref)) - now >= target - 0.5) break;
      const gain = Math.round(exactPoints(r, c, logValue(c.count + k, c.ref)) - now);
      if (gain < 2) continue;
      const key = (["indication", "phase", "area", "recent"] as const).find((x) => x === c.key) ?? "pediatric";
      tips.push({ gain, text: t.raise(key, gain, k, phaseText(ctx, lang), b, areaChosen(r), since(r)) });
    } else if (c.key === "completion" && r.stats.completionRate != null && lost >= 3) {
      tips.push({ gain: lost, text: t.raiseCompletion(lost, r.stats.completionRate) });
    }
  }
  if (pts.competingPenalty >= 2) tips.push({ gain: pts.competingPenalty, text: t.raiseCompeting(pts.competingPenalty, r.stats.competingTrials) });
  if (pts.equipmentPenalty > 0) tips.push({ gain: pts.equipmentPenalty, text: t.raiseEquipment(pts.equipmentPenalty, r.missingEquipment) });
  return tips
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 3)
    .map((x) => x.text);
}

export function siteKnowledge(lang: Lang): string {
  return SCORING[lang].explain.siteKnowledge;
}
export function relativeCaveat(lang: Lang): string {
  return SCORING[lang].explain.relativeCaveat;
}
