import {PRICE_BLEND} from './price-blend.data';

export {PRICE_BLEND};

export const INPUT_MODALITIES = ['text', 'image', 'audio', 'video', 'pdf'] as const;
export const OUTPUT_MODALITIES = ['text', 'image', 'audio', 'video', 'embedding', 'rerank'] as const;
export type Modality = InputModality | OutputModality;
export type InputModality = typeof INPUT_MODALITIES[number];
export type OutputModality = typeof OUTPUT_MODALITIES[number];

export const MODALITY_LABELS: Record<Modality, string> = {
  text: 'Text', image: 'Image', audio: 'Audio', video: 'Video', pdf: 'PDF', embedding: 'Embedding', rerank: 'Rerank',
};

export const MODALITY_ICONS: Record<Modality, string> = {
  text: '🔤', image: '🖼️', audio: '🔊', video: '🎬', pdf: '📄', embedding: '🔢', rerank: '🔃',
};

export interface AiModel {
  id: string;
  publicName: string;
  modelName: string;
  /** USD per 1M input tokens, or null if the provider does not bill input per token. */
  inputCosts: number | null;
  /** USD per 1M output tokens, or null if the model returns no tokens or the price is unknown. */
  outputCosts: number | null;
  /** Cache read price per 1M tokens, or null if the provider has no cache. */
  cacheCosts: number | null;
  /** Token limits, or null if no source names them; an embedding or rerank model has no maxOutputTokens. */
  contextWindow: number | null;
  maxInputTokens: number | null;
  maxOutputTokens: number | null;
  /** USD for one Intelligence Index run, or null without token counts. */
  costsToRun: number | null;
  localModel: boolean;
  minVramRequirement: number;
  /** Intelligence Index score, or null for a model without benchmark (embedding, speech, rerank). */
  overallIntelligence: number | null;
  releaseDate: string | null;
  cutoffDate: string | null;
  reasoning: boolean;
  /** What the model accepts, in the order of INPUT_MODALITIES. */
  inputModalities: InputModality[];
  /** What the model returns, in the order of OUTPUT_MODALITIES. */
  outputModalities: OutputModality[];
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
 * the input price. Returns null without the token counts or without an input or output price.
 */
export function runCostOf(prices: Pick<AiModel, 'inputCosts' | 'outputCosts' | 'cacheCosts'>, tokens: RunTokens): number | null {
  if (tokens.inputTokensPerRun === null || tokens.outputTokensPerRun === null) return null;
  if (prices.inputCosts === null || prices.outputCosts === null) return null;
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

/**
 * Weighted mean of the cache, input, reasoning and output price in USD per 1M tokens. Without a cache price, cached
 * tokens cost the input price. Returns null without an input or output price.
 */
export function blendedPriceOf(
  m: Pick<AiModel, 'inputCosts' | 'outputCosts' | 'cacheCosts' | 'reasoning'>,
  blend: PriceBlend = PRICE_BLEND,
): number | null {
  if (m.inputCosts === null || m.outputCosts === null) return null;
  const reasoning = m.reasoning ? blend.reasoning : 0;
  const sum = blend.cache * (m.cacheCosts ?? m.inputCosts) + blend.input * m.inputCosts
    + reasoning * m.outputCosts + blend.output * m.outputCosts;
  return sum / (blend.cache + blend.input + reasoning + blend.output);
}

/** True if the model accepts every input and returns every output modality asked for. Empty lists ask for nothing. */
export function hasModalities(
  m: Pick<AiModel, 'inputModalities' | 'outputModalities'>,
  inputs: readonly InputModality[],
  outputs: readonly OutputModality[],
): boolean {
  return inputs.every(x => m.inputModalities.includes(x)) && outputs.every(x => m.outputModalities.includes(x));
}

/** Sort order by intelligence, highest first; models without a score go last. */
export function byIntelligenceDesc(a: Pick<AiModel, 'overallIntelligence'>, b: Pick<AiModel, 'overallIntelligence'>): number {
  return (b.overallIntelligence ?? -Infinity) - (a.overallIntelligence ?? -Infinity) || 0;
}

/** Release date in ms since 1970, or null if unknown. */
export function releaseTimeOf(m: Pick<AiModel, 'releaseDate'>): number | null {
  return m.releaseDate ? new Date(m.releaseDate).getTime() : null;
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
  if (!model.releaseDate) return 'unknown';
  const d = new Date(model.releaseDate);
  if (Number.isNaN(d.getTime())) return 'unknown';
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}
