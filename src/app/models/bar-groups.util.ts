import {AiModel} from './ai-model.model';
import {parseEffortVariantId} from './effort.util';

const DIMMED_ALPHA = '0.12)';

/** The id of the model a bar belongs to; an effort level bar has the id `<model id>@<effort>`. */
export function modelIdOf(m: Pick<AiModel, 'id'>): string {
  return parseEffortVariantId(m.id).modelId;
}

/** The position of the bar's effort among the levels of its model; -1 for a model without levels. */
export function effortIndex(m: Pick<AiModel, 'effort' | 'efforts'>): number {
  return m.efforts.findIndex(l => l.effort === m.effort);
}

/**
 * The bars from the best to the worst value, with the bars of one model side by side (ties in effort order). The
 * groups are ranked by their best value.
 */
export function groupBars<T extends Pick<AiModel, 'id' | 'effort' | 'efforts'>>(
  bars: T[], value: (m: T) => number, higherIsBetter: boolean,
): T[] {
  const groups = new Map<string, T[]>();
  for (const bar of bars) {
    const id = modelIdOf(bar);
    groups.set(id, [...(groups.get(id) ?? []), bar]);
  }
  const better = (a: T, b: T) => (higherIsBetter ? value(b) - value(a) : value(a) - value(b)) || effortIndex(a) - effortIndex(b);
  const ranked = [...groups.values()].map(group => {
    const sorted = [...group].sort(better);
    return {bars: sorted, rank: value(sorted[0])};
  });
  ranked.sort((a, b) => higherIsBetter ? b.rank - a.rank : a.rank - b.rank);
  return ranked.flatMap(g => g.bars);
}

/** The bar colors with every bar outside the model dimmed; unchanged without a model. */
export function highlightColors(colors: string[], bars: Pick<AiModel, 'id'>[], modelId: string | null): string[] {
  if (modelId === null) return colors;
  return colors.map((c, i) => modelIdOf(bars[i]) === modelId ? c : c.replace(/[\d.]+\)$/, DIMMED_ALPHA));
}

/**
 * The bar indexes of each model with two or more bars, in drawing order of its line: the bar order if the bars are
 * grouped, else the effort order. Without grouping, only the line of the hovered model.
 */
export function effortLines(
  bars: Pick<AiModel, 'id' | 'effort' | 'efforts'>[], grouped: boolean, hoveredModelId: string | null = null,
): { modelId: string; indexes: number[] }[] {
  const lines = new Map<string, number[]>();
  bars.forEach((bar, i) => {
    const id = modelIdOf(bar);
    lines.set(id, [...(lines.get(id) ?? []), i]);
  });
  return [...lines].filter(([id, indexes]) => indexes.length > 1 && (grouped || id === hoveredModelId)).map(([modelId, indexes]) => ({
    modelId,
    indexes: grouped ? indexes : [...indexes].sort((a, b) => effortIndex(bars[a]) - effortIndex(bars[b])),
  }));
}
