import {AiModel, EffortLevel, responseTimeOf} from './ai-model.model';
import {PlotType} from './view-types';

export interface EffortPoint {
  effort: string;
  x: number;
  y: number;
  current: boolean;
  level: EffortLevel;
}

const SHORT_LABELS: Record<string, string> = {
  'non-reasoning': 'off',
  reasoning: 'on',
  minimal: 'min',
  medium: 'med',
};

export function shortEffortLabel(effort: string): string {
  return SHORT_LABELS[effort] ?? effort;
}

export function effortResponseTime(level: EffortLevel): number | null {
  return responseTimeOf(level);
}

function effortXY(model: AiModel, level: EffortLevel, plotType: PlotType): { x: number | null; y: number | null } {
  const intel = level.overallIntelligence;
  switch (plotType) {
    case 'release':
      return {x: new Date(model.releaseDate).getTime(), y: intel};
    case 'context':
      return {x: model.contextWindow, y: intel};
    case 'speed':
      return {x: level.tokensPerSecond, y: intel};
    case 'responseVsIntel':
      return {x: effortResponseTime(level), y: intel};
    case 'responseVsSpeed':
      return {x: effortResponseTime(level), y: level.tokensPerSecond};
    default:
      return {x: level.costsToRun === null ? null : level.costsToRun === 0 ? 0.001 : level.costsToRun, y: intel};
  }
}

/** The effort levels of a model that have a value on both axes of the plot type. */
export function effortPoints(model: AiModel, plotType: PlotType): EffortPoint[] {
  const points: EffortPoint[] = [];
  for (const level of model.efforts) {
    const {x, y} = effortXY(model, level, plotType);
    if (x === null || y === null) continue;
    points.push({effort: level.effort, x, y, current: level.effort === model.effort, level});
  }
  return points;
}
