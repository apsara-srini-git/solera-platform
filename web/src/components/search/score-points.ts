/** Points each score component contributes to the 0–100 fit score. Weights are normalised (paediatric experience adds
 *  one). Rounding is distributed (largest remainder) so the maxima total exactly 100 and the earned points minus the
 *  penalties total exactly the shown score. */
export interface ScoreBreakdown {
  points: Record<string, number>;
  max: Record<string, number>;
  /** All points taken off (0 when none) = competingPenalty + equipmentPenalty. */
  penalty: number;
  /** Points taken off for similar trials recruiting now. */
  competingPenalty: number;
  /** Points taken off for required equipment the national catalogue does not list (soft equipment mode). */
  equipmentPenalty: number;
}

/** Round `exact` values so they sum to `target` (≥ the sum of their floors), giving the leftover units to the largest remainders. */
function apportion(exact: number[], target: number): number[] {
  const floors = exact.map((v) => Math.floor(v));
  let left = target - floors.reduce((s, v) => s + v, 0);
  const order = exact.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r);
  const out = [...floors];
  for (let k = 0; left > 0 && order.length; k = (k + 1) % order.length, left--) out[order[k].i]++;
  return out;
}

export function scoreBreakdown(
  components: { key: string; weight: number; value: number }[],
  score: number,
  /** Exact penalties from the search (SiteResult.penalties). Without them the whole penalty counts as competing. */
  penalties?: { competing: number; equipment: number },
): ScoreBreakdown {
  const total = components.reduce((s, c) => s + c.weight, 0) || 1;
  const maxExact = components.map((c) => (c.weight / total) * 100);
  const ptsExact = components.map((c) => ((c.weight * c.value) / total) * 100);
  const maxR = apportion(maxExact, 100);
  const earned = Math.max(score, Math.round(ptsExact.reduce((s, v) => s + v, 0)));
  const ptsR = apportion(ptsExact, earned).map((p, i) => Math.min(p, maxR[i]));
  // clamping to a component's maximum can drop a unit: give it back to components that still have room
  for (let deficit = earned - ptsR.reduce((s, v) => s + v, 0), i = 0; deficit > 0 && i < ptsR.length * 2; i++) {
    const k = i % ptsR.length;
    if (ptsR[k] < maxR[k]) {
      ptsR[k]++;
      deficit--;
    }
  }
  const sum = ptsR.reduce((s, v) => s + v, 0);
  const points: Record<string, number> = {};
  const max: Record<string, number> = {};
  components.forEach((c, i) => {
    points[c.key] = ptsR[i];
    max[c.key] = maxR[i];
  });
  const penalty = Math.max(0, sum - score);
  // the equipment penalty is a whole number; the competing one takes the remainder, so the rows always add up
  const equipmentPenalty = Math.min(penalty, Math.round(penalties?.equipment ?? 0));
  return { points, max, penalty, competingPenalty: penalty - equipmentPenalty, equipmentPenalty };
}
