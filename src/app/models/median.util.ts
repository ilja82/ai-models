/**
 * The median of the finite values, the mean of the two middle values for an even count.
 * Returns null when there is no finite value.
 */
export function median(values: number[]): number | null {
  const sorted = values.filter(v => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
