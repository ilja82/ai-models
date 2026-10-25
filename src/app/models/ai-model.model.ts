import {PRICE_BLEND} from './price-blend.data';

export {PRICE_BLEND};

export interface AiModel {
  id: string;
  publicName: string;
  modelName: string;
  inputCosts: number;
  outputCosts: number;
  /** Cache read price per 1M tokens, or null if the provider has no cache. */
  cacheCosts: number | null;
  contextWindow: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  /** USD for one Intelligence Index run, or null without token counts. */
  costsToRun: number | null;
  localModel: boolean;
  minVramRequirement: number;
  overallIntelligence: number;
  releaseDate: string;
  cutoffDate: string | null;
  reasoning: boolean;
  totalTokens: number;
  totalSpend: number;
  totalRequests: number;
  tokensPerRun: number | null;
  /** Input tokens of one index run in millions. */
  inputTokensPerRun: number | null;
  /** Reasoning and answer tokens of one index run in millions. */
  outputTokensPerRun: number | null;
  /** Share of the input tokens read from the cache. */
  cacheHitRate: number | null;
  /** True if the token counts are estimated from the score, the reasoning flag and the release date. */
  tokensPerRunEstimated: boolean;
  usesCache: boolean;
  tokensPerSecond: number | null;
  inputProcessingTime: number | null;
  thinkingTime: number | null;
  outputTime: number | null;
  deprecated: boolean;
  deprecationInfo: string;
  /** Effort level of the values above, or null if the source names none. */
  effort: string | null;
  /** All measured effort levels of the model, from lowest to highest effort. */
  efforts: EffortLevel[];
}

/** Measured values of one effort level. A value is null if the source does not publish it. */
export interface EffortLevelInput {
  effort: string;
  overallIntelligence: number;
  tokensPerRun: number | null;
  inputTokensPerRun: number | null;
  outputTokensPerRun: number | null;
  cacheHitRate: number | null;
  tokensPerSecond: number | null;
  inputProcessingTime: number | null;
  thinkingTime: number | null;
  outputTime: number | null;
}

export interface EffortLevel extends EffortLevelInput {
  costsToRun: number | null;
}

export interface ModelEfforts {
  effort: string | null;
  levels: EffortLevelInput[];
}

type RunTokens = Pick<EffortLevelInput, 'inputTokensPerRun' | 'outputTokensPerRun' | 'cacheHitRate'>;

/**
 * USD for one Intelligence Index run at the prices of the model: cache hits at the cache price, the other input tokens
 * at the input price, reasoning and answer tokens at the output price. Without a cache price, all input tokens cost
 * the input price. Returns null without the token counts.
 */
export function runCostOf(prices: Pick<AiModel, 'inputCosts' | 'outputCosts' | 'cacheCosts'>, tokens: RunTokens): number | null {
  if (tokens.inputTokensPerRun === null || tokens.outputTokensPerRun === null) return null;
  const hits = prices.cacheCosts === null ? 0 : tokens.cacheHitRate ?? 0;
  const inputPrice = hits * (prices.cacheCosts ?? 0) + (1 - hits) * prices.inputCosts;
  return tokens.inputTokensPerRun * inputPrice + tokens.outputTokensPerRun * prices.outputCosts;
}

/** USD per request in the LiteLLM usage, or null without requests. */
export function costPerRequestOf(m: Pick<AiModel, 'totalSpend' | 'totalRequests'>): number | null {
  return m.totalRequests > 0 ? m.totalSpend / m.totalRequests : null;
}

export type PriceBlend = { readonly [K in keyof typeof PRICE_BLEND]: number };

/** The weights of the blend as text, for axis titles and tooltips. */
export function priceBlendLabel(blend: PriceBlend = PRICE_BLEND): string {
  return `${blend.cache}% cache, ${blend.input}% input, ${blend.output}% output`;
}

/** Weighted mean of the cache, input, reasoning and output price in USD per 1M tokens. Without a cache price, cached tokens cost the input price. */
export function blendedPriceOf(
  m: Pick<AiModel, 'inputCosts' | 'outputCosts' | 'cacheCosts' | 'reasoning'>,
  blend: PriceBlend = PRICE_BLEND,
): number {
  const reasoning = m.reasoning ? blend.reasoning : 0;
  const sum = blend.cache * (m.cacheCosts ?? m.inputCosts) + blend.input * m.inputCosts
    + reasoning * m.outputCosts + blend.output * m.outputCosts;
  return sum / (blend.cache + blend.input + reasoning + blend.output);
}

/** Input processing plus thinking time, or null if one of them is not measured. */
export function latencyOf(m: Pick<AiModel, 'inputProcessingTime' | 'thinkingTime'>): number | null {
  return m.inputProcessingTime === null || m.thinkingTime === null ? null : m.inputProcessingTime + m.thinkingTime;
}

/** Input processing, thinking and output time, or null if one of them is not measured. */
export function responseTimeOf(m: Pick<AiModel, 'inputProcessingTime' | 'thinkingTime' | 'outputTime'>): number | null {
  const latency = latencyOf(m);
  return latency === null || m.outputTime === null ? null : latency + m.outputTime;
}

/** Returns the known cutoffDate, or an estimate of releaseDate minus 12 months. */
export function effectiveCutoffDate(model: Pick<AiModel, 'cutoffDate' | 'releaseDate'>): string {
  if (model.cutoffDate) return model.cutoffDate;
  const d = new Date(model.releaseDate);
  if (Number.isNaN(d.getTime())) return 'unknown';
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}
