import {AiModel, EffortLevel, releaseTimeOf, responseTimeOf} from './ai-model.model';
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
      return {x: releaseTimeOf(model), y: intel};
    case 'context':
      return {x: model.contextWindow, y: intel};
    case 'speed':
      return {x: level.tokensPerSecond, y: intel};
    case 'responseVsIntel':
      return {x: effortResponseTime(level), y: intel};
    case 'responseVsSpeed':
      return {x: effortResponseTime(level), y: level.tokensPerSecond};
    case 'cost':
      return {x: level.effort === model.effort ? model.costsToRun : level.costsToRun, y: intel};
    case 'costVsResponse':
      return {x: level.effort === model.effort ? model.costsToRun : level.costsToRun, y: effortResponseTime(level)};
    case 'price':
      return {x: null, y: null};
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

export function effortVariantId(modelId: string, effort: string): string {
  return `${modelId}@${effort}`;
}

/** The model id and the effort of an id from `effortVariantId`. A plain model id has the effort null. */
export function parseEffortVariantId(id: string): { modelId: string; effort: string | null } {
  const at = id.indexOf('@');
  return at < 0 ? {modelId: id, effort: null} : {modelId: id.slice(0, at), effort: id.slice(at + 1)};
}

/** The model with the measured values of one effort level and the id `<model id>@<effort>`. */
export function effortVariant(model: AiModel, level: EffortLevel): AiModel {
  return {
    ...model,
    id: effortVariantId(model.id, level.effort),
    effort: level.effort,
    overallIntelligence: level.overallIntelligence,
    intelligenceEstimatedFrom: level.intelligenceEstimatedFrom,
    tokensPerRun: level.tokensPerRun,
    inputTokensPerRun: level.inputTokensPerRun,
    outputTokensPerRun: level.outputTokensPerRun,
    cacheHitRate: level.cacheHitRate,
    tokensPerRunEstimated: model.tokensPerRunScaled && level.tokensPerRun !== null,
    tokensPerRunScaled: model.tokensPerRunScaled && level.tokensPerRun !== null,
    tokensPerSecond: level.tokensPerSecond,
    inputProcessingTime: level.inputProcessingTime,
    thinkingTime: level.thinkingTime,
    outputTime: level.outputTime,
    costsToRun: level.costsToRun,
  };
}

/** The effort levels of a model other than the level of its main values, as models. */
export function otherEffortVariants(model: AiModel): AiModel[] {
  return model.efforts.filter(l => l.effort !== model.effort).map(l => effortVariant(model, l));
}

/** All effort levels of a model in effort order. The current level is the model itself. */
export function effortSeries(model: AiModel): AiModel[] {
  return model.efforts.map(l => l.effort === model.effort ? model : effortVariant(model, l));
}
