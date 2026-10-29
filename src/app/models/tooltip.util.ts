import {
  AiModel,
  blendedPriceOf,
  costPerRequestOf,
  effectiveCutoffDate,
  hasEstimatedScore,
  isBenchmarkOutdated,
  Modality,
  MODALITY_LABELS,
  priceBlendLabel,
  responseTimeOf,
} from './ai-model.model';

const MISSING = 'no data';

/** USD with 2 decimals, or 2 significant digits below one cent. */
export function formatUsd(value: number): string {
  return value > 0 && value < 0.01 ? `$${value.toPrecision(2)}` : `$${value.toFixed(2)}`;
}

function tokensPerRunLine(model: AiModel, latest: string | null): string {
  if (model.tokensPerRun === null) return '';
  const split = model.inputTokensPerRun === null || model.outputTokensPerRun === null
    ? ''
    : ` (in: ${model.inputTokensPerRun}M, out: ${model.outputTokensPerRun}M`
    + `${model.cacheHitRate === null ? '' : `, ${Math.round(model.cacheHitRate * 100)}% cache hits`})`;
  const estimate = model.tokensPerRunScaled
    ? ` estimated${latest ? ` for ${latest}` : ''} from the ${model.benchmarkVersion} run`
    : model.tokensPerRunEstimated ? ' estimated' : '';
  return `Tokens per run: ${model.tokensPerRun}M${split}${estimate}`;
}

/** Modality names for a sentence, e.g. "Text, Image". */
export function modalityNames(list: readonly Modality[]): string {
  return list.map(m => MODALITY_LABELS[m]).join(', ');
}

function perMillion(price: number | null): string {
  return price === null ? MISSING : `$${price.toFixed(3)}/M tokens`;
}

function kiloTokens(tokens: number | null): string {
  if (tokens === null) return MISSING;
  return tokens < 1000 ? `${tokens} tokens` : `${(tokens / 1000).toFixed(0)}K tokens`;
}

/** USD for an axis tick: whole dollars from $100, else at least 2 decimals and 3 significant digits ($0.125, $0.00391). */
export function formatUsdTick(value: number): string {
  if (value >= 100) return `$${value.toFixed(0)}`;
  const precise = String(Number(value.toPrecision(3)));
  return (precise.split('.')[1] ?? '').length > 2 ? `$${precise}` : `$${value.toFixed(2)}`;
}

export function runCostText(model: Pick<AiModel, 'costsToRun' | 'tokensPerRunEstimated'>): string {
  if (model.costsToRun === null) return MISSING;
  return `${formatUsd(model.costsToRun)} per index run${model.tokensPerRunEstimated ? ' (estimated tokens)' : ''}`;
}

/** The title of a run cost from estimated token counts: scaled from an older index run, or estimated by a fit. */
export function estimatedTokensText(
  model: Pick<AiModel, 'tokensPerRunScaled' | 'benchmarkVersion'>,
  latest: string | null,
): string {
  return model.tokensPerRunScaled
    ? `Token counts estimated${latest ? ` for ${latest}` : ''} from the ${model.benchmarkVersion} run`
    : 'Estimated: the benchmark publishes no token counts for this model';
}

/** The text that marks the values of an outdated benchmark, for titles and tooltips. */
export function outdatedBenchmarkText(model: Pick<AiModel, 'benchmarkVersion'>, latest: string | null): string {
  return `Outdated benchmark: speed and times from Intelligence Index ${model.benchmarkVersion}, not comparable with ${latest}`;
}

/** The title of the "Estimated score" legend item. */
export const ESTIMATED_SCORE_TITLE = 'Estimated from the score of an older Intelligence Index version, '
  + 'with a curve fitted on the models that have a score in both versions';

/** The text that names the measured score an estimated score comes from, for titles and tooltips. */
export function estimatedScoreText(
  values: Pick<AiModel, 'intelligenceEstimatedFrom'>,
  model: Pick<AiModel, 'benchmarkVersion'>,
  latest: string | null,
): string {
  return `estimated${latest ? ` for ${latest}` : ''} from the ${model.benchmarkVersion} score ${values.intelligenceEstimatedFrom}`;
}

/** The score with `~` if it is estimated, or `fallback` without a score. */
export function scoreText(values: Pick<AiModel, 'overallIntelligence' | 'intelligenceEstimatedFrom'>, fallback = MISSING): string {
  if (values.overallIntelligence === null) return fallback;
  return `${hasEstimatedScore(values) ? '~' : ''}${values.overallIntelligence}`;
}

/** The intelligence line of a tooltip; `values` is the model or one of its effort levels. */
export function intelligenceLine(
  values: Pick<AiModel, 'overallIntelligence' | 'intelligenceEstimatedFrom'>,
  model: Pick<AiModel, 'benchmarkVersion'>,
  latest: string | null,
): string {
  const estimate = hasEstimatedScore(values) ? ` (${estimatedScoreText(values, model, latest)})` : '';
  return `★ Overall Intelligence: ${scoreText(values)}${estimate}`;
}

/** Tooltip lines of a model; `latest` is the newest benchmark version, to name an outdated one. */
export function buildModelTooltipLines(model: AiModel, latest: string | null = null): string[] {
  const responseTime = responseTimeOf(model);
  const perRequest = costPerRequestOf(model);
  const blended = blendedPriceOf(model);
  return [
    `${model.publicName}`,
    model.deprecated ? `⚠️ Deprecated: ${model.deprecationInfo}` : '',
    intelligenceLine(model, model, latest),
    isBenchmarkOutdated(model, latest) ? outdatedBenchmarkText(model, latest) : '',
    model.effort ? `★ Effort: ${model.effort}${model.efforts.length > 1 ? ` (${model.efforts.length} levels measured)` : ''}` : '',
    `★ Speed: ${model.tokensPerSecond === null ? MISSING : `${model.tokensPerSecond} tok/s`}`,
    responseTime === null
      ? `★ Response time: ${MISSING}`
      : `★ Response time: ${responseTime.toFixed(1)}s (in: ${model.inputProcessingTime}s, think: ${model.thinkingTime}s, out: ${model.outputTime}s)`,
    `★ Run cost: ${runCostText(model)}`,
    `★ Price: ${blended === null ? MISSING : `$${blended.toFixed(3)}/M tokens (blended by usage: ${priceBlendLabel()})`}`,
    `★ Release: ${model.releaseDate ?? MISSING}`,
    `─────────────────`,
    `Type: ${model.localModel ? 'Local' : 'API'}`,
    `Modalities: ${modalityNames(model.inputModalities)} → ${modalityNames(model.outputModalities)}`,
    `Input: ${perMillion(model.inputCosts)}`,
    `Output: ${perMillion(model.outputCosts)}`,
    `Cache: ${model.cacheCosts === null ? 'no cache, input price' : `$${model.cacheCosts.toFixed(3)}/M tokens`}`,
    tokensPerRunLine(model, latest),
    perRequest === null ? '' : `Cost per request: ${formatUsd(perRequest)} (LiteLLM, ${model.totalRequests} requests)`,
    `Context: ${kiloTokens(model.contextWindow)}`,
    `Max In: ${kiloTokens(model.maxInputTokens)}`,
    `Max Out: ${kiloTokens(model.maxOutputTokens)}`,
    `Cutoff: ${model.cutoffDate ?? `${effectiveCutoffDate(model)} (estimated)`}`,
    model.localModel ? `VRAM: ${model.minVramRequirement}GB` : '',
  ].filter(Boolean);
}
