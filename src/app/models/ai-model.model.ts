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

export const PROVIDERS = ['bedrock', 'tensorx'] as const;
export type Provider = typeof PROVIDERS[number];

export const PROVIDER_LABELS: Record<Provider, string> = {bedrock: 'AWS Bedrock', tensorx: 'TensorX'};

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
  /** The provider that serves the API model, or null for a local model. */
  provider: Provider | null;
  minVramRequirement: number;
  /**
   * Intelligence Index score on the scale of the newest index version, or null for a model without benchmark
   * (embedding, speech, rerank). It is an estimate if `intelligenceEstimatedFrom` is set.
   */
  overallIntelligence: number | null;
  /** The score measured in the older `benchmarkVersion` that `overallIntelligence` is estimated from, else null. */
  intelligenceEstimatedFrom: number | null;
  /** Intelligence Index version of the measured score, the token counts, the speed and the times; null without benchmark. */
  benchmarkVersion: string | null;
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
  /** Tokens of one index run in millions, on the scale of the newest index version, like the three values below. */
  tokensPerRun: number | null;
  /** Input tokens of one index run in millions. */
  inputTokensPerRun: number | null;
  /** Reasoning and answer tokens of one index run in millions. */
  outputTokensPerRun: number | null;
  /** Share of the input tokens read from the cache. */
  cacheHitRate: number | null;
  /**
   * True if the token counts are estimated: from the score, the reasoning flag and the release date, or scaled from
   * the run of an older `benchmarkVersion` (`tokensPerRunScaled`).
   */
  tokensPerRunEstimated: boolean;
  /** True if the token counts are scaled from the run of the older `benchmarkVersion` with its `TokenScale`. */
  tokensPerRunScaled: boolean;
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
  intelligenceEstimatedFrom: number | null;
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

/** Factors from the token counts of an older Intelligence Index run to the newest version. */
export interface TokenScale {
  /** Ratio of the input tokens. */
  input: number;
  /** Ratio of the reasoning and answer tokens. */
  output: number;
  /** Ratio of the share of the input tokens that miss the cache. */
  cacheMiss: number;
}

export interface ModelEfforts {
  effort: string | null;
  levels: EffortLevelInput[];
}

type RunTokens = Pick<EffortLevelInput, 'inputTokensPerRun' | 'outputTokensPerRun' | 'cacheHitRate'>;

/**
 * The token counts of a run of an older index version on the scale of the newest version: the input and the output
 * tokens times their factors, the cache misses times theirs. A cache hit rate of 0 or null stays. Token counts without
 * the input and output split stay as they are.
 */
export function scaleRunTokens<T extends RunTokens & Pick<EffortLevelInput, 'tokensPerRun'>>(
  tokens: T,
  scale: TokenScale,
): T {
  if (tokens.inputTokensPerRun === null || tokens.outputTokensPerRun === null) return tokens;
  const input = tokens.inputTokensPerRun * scale.input;
  const output = tokens.outputTokensPerRun * scale.output;
  const hits = tokens.cacheHitRate;
  return {
    ...tokens,
    tokensPerRun: Math.round(input + output),
    inputTokensPerRun: Math.round(input),
    outputTokensPerRun: Math.round(output * 10) / 10,
    cacheHitRate: hits === null || hits <= 0 ? hits : Math.round((1 - (1 - hits) * scale.cacheMiss) * 1000) / 1000,
  };
}

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

/** Order of two Intelligence Index versions such as 'v4.3.2' and 'v5.0': negative if `a` is older than `b`. */
export function compareBenchmarkVersions(a: string, b: string): number {
  const parts = (v: string) => v.replace(/^v/, '').split('.').map(Number);
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff) return diff;
  }
  return 0;
}

/** The newest benchmark version of the models, or null if no model has a benchmark. */
export function latestBenchmarkVersion(models: readonly Pick<AiModel, 'benchmarkVersion'>[]): string | null {
  let latest: string | null = null;
  for (const {benchmarkVersion: v} of models) {
    if (v !== null && (latest === null || compareBenchmarkVersions(v, latest) > 0)) latest = v;
  }
  return latest;
}

/** True if the benchmark values come from an older Intelligence Index version than `latest`. */
export function isBenchmarkOutdated(m: Pick<AiModel, 'benchmarkVersion'>, latest: string | null): boolean {
  return m.benchmarkVersion !== null && latest !== null && compareBenchmarkVersions(m.benchmarkVersion, latest) < 0;
}

/** True if the score is estimated from the score of an older Intelligence Index version. */
export function hasEstimatedScore(m: Pick<AiModel, 'intelligenceEstimatedFrom'>): boolean {
  return m.intelligenceEstimatedFrom !== null;
}

/** Release date in ms since 1970, or null if unknown. */
export function releaseTimeOf(m: Pick<AiModel, 'releaseDate'>): number | null {
  return m.releaseDate ? new Date(m.releaseDate).getTime() : null;
}

export const NEW_MODEL_MONTHS = 3;

/** True if the model was released less than NEW_MODEL_MONTHS months before `today`. */
export function isNewModel(m: Pick<AiModel, 'releaseDate'>, today: Date): boolean {
  if (!m.releaseDate) return false;
  const since = new Date(Date.UTC(today.getFullYear(), today.getMonth() - NEW_MODEL_MONTHS, today.getDate()));
  return m.releaseDate > since.toISOString().slice(0, 10);
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
