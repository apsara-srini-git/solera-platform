/**
 * Shared score colour scale (0–100 match score → colour), used by list badges, bars and map markers.
 *
 * Ordinal, single-hue teal ramp in 5 equal bins, light → dark = low → high. Generated in OKLCH
 * (L 0.73 → 0.385, hue ≈ 191–196) and validated with the dataviz skill's validator (`--ordinal`, light mode,
 * surfaces #ffffff and #f6f7f9): lightness monotone, adjacent ΔL ≥ 0.06, light end ≥ 2:1 vs surface (2.31:1),
 * single hue. Being one hue that changes only in lightness, it stays ordered under protan/deutan/tritan vision.
 * Map markers ALSO encode score as radius (scoreRadius) and badges always print the number, so colour never
 * carries meaning alone.
 *
 * Keep in sync with --color-score-1…5 in src/app/globals.css.
 */

export interface ScoreColor {
  /** Mark colour: marker fill, bar fill, badge swatch. */
  fill: string;
  /** Outline for map markers (darker step of the same hue). */
  stroke: string;
  /** Text colour that is readable ON `fill` (white or dark ink, WCAG ≥ 4.5:1 except bin 1 where ink is used). */
  text: string;
  /** Light tint for badge / chip backgrounds; put dark `ink` text on it. */
  bg: string;
  /** Dark same-hue ink, readable on `bg` and on white (≥ 7:1). */
  ink: string;
  /** Bin index 0–4. */
  bin: number;
}

const INK = "#0f1d22";

/** Five steps, low → high. */
export const SCORE_STEPS = ["#5ab9ba", "#1da19f", "#00837f", "#006967", "#005051"] as const;

const BINS: ScoreColor[] = [
  { fill: SCORE_STEPS[0], stroke: "#2f8f90", text: INK, bg: "#eef8f8", ink: "#1f5556", bin: 0 },
  { fill: SCORE_STEPS[1], stroke: "#0f7f7d", text: INK, bg: "#e3f4f3", ink: "#0f5250", bin: 1 },
  { fill: SCORE_STEPS[2], stroke: "#006361", text: "#ffffff", bg: "#d8efed", ink: "#004b49", bin: 2 },
  { fill: SCORE_STEPS[3], stroke: "#004b4a", text: "#ffffff", bg: "#cde9e7", ink: "#00403f", bin: 3 },
  { fill: SCORE_STEPS[4], stroke: "#003435", text: "#ffffff", bg: "#c2e2e1", ink: "#003334", bin: 4 },
];

/** Bin edges (inclusive lower bound). 0–19, 20–39, 40–59, 60–79, 80–100. */
export const SCORE_BIN_EDGES = [0, 20, 40, 60, 80] as const;

const clamp = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0);

export function scoreBin(score: number): number {
  const s = clamp(score);
  return Math.min(4, Math.floor(s / 20));
}

/** Colour set for a 0–100 score. */
export function scoreColor(score: number): ScoreColor {
  return BINS[scoreBin(score)];
}

/** Short qualitative word for a score - print it next to the number, never instead of it. */
export function scoreWord(score: number, lang: "en" | "es" = "en"): string {
  const en = ["Low", "Fair", "Good", "Strong", "Excellent"];
  const es = ["Baja", "Moderada", "Buena", "Alta", "Excelente"];
  return (lang === "es" ? es : en)[scoreBin(score)];
}

/**
 * Map-marker radius in px. Area (not radius) grows linearly with score so big markers don't over-shout.
 * Defaults: 6px at score 0 → 16px at 100.
 */
export function scoreRadius(score: number, { min = 6, max = 16 }: { min?: number; max?: number } = {}): number {
  const t = clamp(score) / 100;
  return Math.sqrt(min * min + t * (max * max - min * min));
}

export interface ScoreLegendItem {
  bin: number;
  from: number;
  to: number;
  /** e.g. "80–100" */
  range: string;
  /** e.g. "Excellent" */
  label: string;
  color: ScoreColor;
  /** Marker radius at the bin midpoint, for drawing legend circles. */
  radius: number;
}

/** Legend rows, low → high. */
export function scoreLegend(lang: "en" | "es" = "en", radius?: { min?: number; max?: number }): ScoreLegendItem[] {
  return SCORE_BIN_EDGES.map((from, bin) => {
    const to = bin === 4 ? 100 : from + 19;
    const mid = (from + to) / 2;
    return {
      bin,
      from,
      to,
      range: `${from}–${to}`,
      label: scoreWord(mid, lang),
      color: BINS[bin],
      radius: scoreRadius(mid, radius),
    };
  });
}
