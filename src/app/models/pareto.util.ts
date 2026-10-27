export interface ParetoAxis<T> {
  /** value extractor for this axis; null = not measured */
  get: (p: T) => number | null;
  /** true = larger value is better (e.g. intelligence); false = smaller is better (e.g. cost) */
  higherIsBetter: boolean;
}

interface Point<T> {
  item: T;
  vals: number[];
}

function toPoint<T>(item: T, axes: ParetoAxis<T>[]): Point<T> | null {
  const vals = axes.map(a => a.get(item));
  if (!vals.every((v): v is number => v !== null && Number.isFinite(v))) return null;
  return {item, vals: vals.map((v, i) => axes[i].higherIsBetter ? v : -v)};
}

const dominates = (q: number[], p: number[]) =>
  q.every((v, i) => v >= p[i]) && q.some((v, i) => v > p[i]);

/**
 * Ids of the items that no other item dominates: at least as good on every axis and better on one.
 * Items without a finite value on an axis are left out, so they neither join the set nor dominate another item.
 */
export function paretoIds<T extends { id: string }>(items: T[], axes: ParetoAxis<T>[]): Set<string> {
  const points = items.map(item => toPoint(item, axes)).filter(p => p !== null);
  const useful = new Set<string>();
  for (const p of points) {
    if (!points.some(q => dominates(q.vals, p.vals))) useful.add(p.item.id);
  }
  return useful;
}

/**
 * The items that dominate `item`, in input order. Empty if `item` or no other item has a finite value on every axis.
 */
export function dominators<T>(item: T, items: T[], axes: ParetoAxis<T>[]): T[] {
  const p = toPoint(item, axes);
  if (p === null) return [];
  return items.map(other => toPoint(other, axes)).filter(q => q !== null && dominates(q.vals, p.vals)).map(q => q!.item);
}
