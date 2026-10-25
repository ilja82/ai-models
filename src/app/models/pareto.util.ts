export interface ParetoAxis<T> {
  /** value extractor for this axis; null = not measured */
  get: (p: T) => number | null;
  /** true = larger value is better (e.g. intelligence); false = smaller is better (e.g. cost) */
  higherIsBetter: boolean;
}

/**
 * Ids of the items that no other item dominates: at least as good on every axis and better on one.
 * Items without a finite value on an axis are left out, so they neither join the set nor dominate another item.
 */
export function paretoIds<T extends { id: string }>(items: T[], axes: ParetoAxis<T>[]): Set<string> {
  const points = items.flatMap(item => {
    const vals = axes.map(a => a.get(item));
    if (!vals.every((v): v is number => v !== null && Number.isFinite(v))) return [];
    return [{id: item.id, vals: vals.map((v, i) => axes[i].higherIsBetter ? v : -v)}];
  });

  const dominates = (q: number[], p: number[]) =>
    q.every((v, i) => v >= p[i]) && q.some((v, i) => v > p[i]);

  const useful = new Set<string>();
  for (const p of points) {
    if (!points.some(q => dominates(q.vals, p.vals))) useful.add(p.id);
  }
  return useful;
}
