import {AiModel} from './ai-model.model';

/** Fitted log token factor of each effort name. Two factors compare only within one group. */
export interface TokenFactors {
  log: Map<string, number>;
  group: Map<string, string>;
}

export const NO_TOKEN_FACTORS: TokenFactors = {log: new Map(), group: new Map()};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Fits log(tokens per run) = model offset + effort factor by median polish.
 * Only API models with two or more measured levels count, because one level carries no ratio.
 */
export function fitTokenFactors(models: AiModel[], rounds = 20): TokenFactors {
  const rows = models
    .filter(m => !m.localModel)
    .map(m => m.efforts.flatMap(l =>
      l.tokensPerRun !== null && l.tokensPerRun > 0 ? [{effort: l.effort, value: Math.log(l.tokensPerRun)}] : []))
    .filter(row => row.length >= 2);

  const parent = new Map<string, string>();
  const root = (effort: string): string => {
    while (parent.get(effort) !== effort) effort = parent.get(effort)!;
    return effort;
  };
  for (const row of rows) for (const cell of row) if (!parent.has(cell.effort)) parent.set(cell.effort, cell.effort);
  for (const row of rows) for (const cell of row.slice(1)) parent.set(root(cell.effort), root(row[0].effort));

  const log = new Map([...parent.keys()].map(e => [e, 0]));
  for (let i = 0; i < rounds; i++) {
    const residuals = new Map<string, number[]>();
    for (const row of rows) {
      const offset = median(row.map(c => c.value - log.get(c.effort)!));
      for (const c of row) residuals.set(c.effort, [...residuals.get(c.effort) ?? [], c.value - offset]);
    }
    for (const [effort, values] of residuals) log.set(effort, median(values));
  }
  return {log, group: new Map([...parent.keys()].map(e => [e, root(e)]))};
}

/** The estimated tokens per run of effort `to` relative to effort `from`, or null if the data does not link them. */
export function estimatedTokenRatio(factors: TokenFactors, from: string, to: string): number | null {
  const group = factors.group.get(from);
  if (group === undefined || group !== factors.group.get(to)) return null;
  return Math.exp(factors.log.get(to)! - factors.log.get(from)!);
}
