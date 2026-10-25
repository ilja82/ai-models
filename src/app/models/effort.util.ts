import {AiModel, blendedPriceOf, EffortLevel, responseTimeOf} from './ai-model.model';
import {PlotType} from './view-types';
import {estimatedTokenRatio, NO_TOKEN_FACTORS, TokenFactors} from './token-factors.util';

export interface EffortPoint {
  effort: string;
  x: number;
  y: number;
  current: boolean;
  level: EffortLevel;
  /** Tokens per run relative to the level of the model values, on the price plot only. */
  tokenRatio: number | null;
  estimated: boolean;
}

export interface EffortPrice {
  price: number;
  tokenRatio: number;
  estimated: boolean;
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

/**
 * The blended price of the model, scaled by the tokens per run of the level relative to the tokens per run of the model.
 * Without both token counts, the ratio is estimated from the token factors of the two effort names.
 * Returns the blended price for the level of the model values, and null if no ratio is known.
 */
export function effortPrice(model: AiModel, level: EffortLevel, factors: TokenFactors = NO_TOKEN_FACTORS): EffortPrice | null {
  const price = blendedPriceOf(model);
  if (level.effort === model.effort) return {price, tokenRatio: 1, estimated: false};
  if (level.tokensPerRun !== null && model.tokensPerRun !== null && model.tokensPerRun > 0) {
    const tokenRatio = level.tokensPerRun / model.tokensPerRun;
    return {price: price * tokenRatio, tokenRatio, estimated: false};
  }
  const tokenRatio = model.effort === null ? null : estimatedTokenRatio(factors, model.effort, level.effort);
  return tokenRatio === null ? null : {price: price * tokenRatio, tokenRatio, estimated: true};
}

function effortXY(model: AiModel, level: EffortLevel, plotType: PlotType, factors: TokenFactors): {
  x: number | null;
  y: number | null;
  price?: EffortPrice
} {
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
    default: {
      const price = effortPrice(model, level, factors);
      return price ? {x: price.price, y: intel, price} : {x: null, y: intel};
    }
  }
}

/** The effort levels of a model that have a value on both axes of the plot type. */
export function effortPoints(model: AiModel, plotType: PlotType, factors: TokenFactors = NO_TOKEN_FACTORS): EffortPoint[] {
  const points: EffortPoint[] = [];
  for (const level of model.efforts) {
    const {x, y, price} = effortXY(model, level, plotType, factors);
    if (x === null || y === null) continue;
    points.push({
      effort: level.effort, x, y, current: level.effort === model.effort, level,
      tokenRatio: price?.tokenRatio ?? null, estimated: price?.estimated ?? false,
    });
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
    tokensPerRun: level.tokensPerRun,
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
