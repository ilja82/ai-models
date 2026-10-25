import {AiModel} from './ai-model.model';

export interface BalancedAxis<T = AiModel> {
  /** value extractor for this axis */
  get: (m: T) => number;
  /** true = larger value is better (e.g. intelligence); false = smaller is better (e.g. cost) */
  higherIsBetter: boolean;
  /** true = normalize log2 of the value, as on a log axis; a value <= 0 counts as 0.001 */
  log?: boolean;
}

/**
 * The single "best balanced" model: the one closest to the ideal corner in
 * normalized axis space. Each axis is normalized linearly to [0,1] with 1 = best,
 * on log2 of the values for a log axis;
 * the winner minimizes the squared distance to the all-best corner.
 *
 * Iterates in input order with a strict `<` comparison, so ties keep the first model.
 * Returns null when there are no models or any axis is degenerate (no finite spread).
 */
export function bestBalancedId<T extends { id: string }>(models: T[], axes: BalancedAxis<T>[]): string | null {
  if (models.length === 0 || axes.length === 0) return null;

  const valueOf = (a: BalancedAxis<T>, m: T): number => {
    const v = a.get(m);
    if (!a.log || !Number.isFinite(v)) return v;
    return Math.log2(v > 0 ? v : 0.001);
  };

  const bounds = axes.map(a => {
    const values = models.map(m => valueOf(a, m)).filter(v => Number.isFinite(v));
    if (values.length === 0) return null;
    return {min: Math.min(...values), max: Math.max(...values)};
  });
  if (bounds.some(b => b === null)) return null;

  const norm = (v: number, lo: number, hi: number, higherIsBetter: boolean): number => {
    if (hi === lo) return 0.5;
    const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
    return higherIsBetter ? t : 1 - t;
  };

  let bestId: string | null = null;
  let bestDist = Infinity;
  for (const m of models) {
    let sumSq = 0;
    let ok = true;
    for (let i = 0; i < axes.length; i++) {
      const v = valueOf(axes[i], m);
      if (!Number.isFinite(v)) {
        ok = false;
        break;
      }
      const d = 1 - norm(v, bounds[i]!.min, bounds[i]!.max, axes[i].higherIsBetter);
      sumSq += d * d;
    }
    if (ok && sumSq < bestDist) {
      bestDist = sumSq;
      bestId = m.id;
    }
  }
  return bestId;
}
