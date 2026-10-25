/**
 * The p-th percentile (0 to 1) of the finite values, linearly interpolated between the two nearest ranks.
 * Returns null when there is no finite value.
 */
export function percentile(values: number[], p: number): number | null {
  const sorted = values.filter(v => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const rank = p * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

/**
 * The median of the finite values, the mean of the two middle values for an even count.
 * Returns null when there is no finite value.
 */
export function median(values: number[]): number | null {
  return percentile(values, 0.5);
}
