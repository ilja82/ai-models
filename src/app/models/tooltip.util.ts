import {
  AiModel,
  blendedPriceOf,
  costPerRequestOf,
  effectiveCutoffDate,
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

function tokensPerRunLine(model: AiModel): string {
  if (model.tokensPerRun === null) return '';
  const split = model.inputTokensPerRun === null || model.outputTokensPerRun === null
    ? ''
    : ` (in: ${model.inputTokensPerRun}M, out: ${model.outputTokensPerRun}M`
    + `${model.cacheHitRate === null ? '' : `, ${Math.round(model.cacheHitRate * 100)}% cache hits`})`;
  return `Tokens per run: ${model.tokensPerRun}M${split}${model.tokensPerRunEstimated ? ' estimated' : ''}`;
}

/** Modality names for a sentence, e.g. "Text, Image". */
export function modalityNames(list: readonly Modality[]): string {
  return list.map(m => MODALITY_LABELS[m]).join(', ');
}

export function runCostText(model: Pick<AiModel, 'costsToRun' | 'tokensPerRunEstimated'>): string {
  if (model.costsToRun === null) return MISSING;
  return `${formatUsd(model.costsToRun)} per index run${model.tokensPerRunEstimated ? ' (estimated tokens)' : ''}`;
}

export function buildModelTooltipLines(model: AiModel): string[] {
  const responseTime = responseTimeOf(model);
  const perRequest = costPerRequestOf(model);
  return [
    `${model.publicName}`,
    model.deprecated ? `⚠️ Deprecated: ${model.deprecationInfo}` : '',
    `★ Overall Intelligence: ${model.overallIntelligence}`,
    model.effort ? `★ Effort: ${model.effort}${model.efforts.length > 1 ? ` (${model.efforts.length} levels measured)` : ''}` : '',
    `★ Speed: ${model.tokensPerSecond === null ? MISSING : `${model.tokensPerSecond} tok/s`}`,
    responseTime === null
      ? `★ Response time: ${MISSING}`
      : `★ Response time: ${responseTime.toFixed(1)}s (in: ${model.inputProcessingTime}s, think: ${model.thinkingTime}s, out: ${model.outputTime}s)`,
    `★ Run cost: ${runCostText(model)}`,
    `★ Price: $${blendedPriceOf(model).toFixed(3)}/M tokens (blended by usage: ${priceBlendLabel()})`,
    `★ Release: ${model.releaseDate}`,
    `─────────────────`,
    `Type: ${model.localModel ? 'Local' : 'API'}`,
    `Modalities: ${modalityNames(model.inputModalities)} → ${modalityNames(model.outputModalities)}`,
    `Input: $${model.inputCosts.toFixed(3)}/M tokens`,
    `Output: $${model.outputCosts.toFixed(3)}/M tokens`,
    `Cache: ${model.cacheCosts === null ? 'no cache, input price' : `$${model.cacheCosts.toFixed(3)}/M tokens`}`,
    tokensPerRunLine(model),
    perRequest === null ? '' : `Cost per request: ${formatUsd(perRequest)} (LiteLLM, ${model.totalRequests} requests)`,
    `Context: ${(model.contextWindow / 1000).toFixed(0)}K tokens`,
    `Max In: ${(model.maxInputTokens / 1000).toFixed(0)}K tokens`,
    `Max Out: ${(model.maxOutputTokens / 1000).toFixed(0)}K tokens`,
    `Cutoff: ${model.cutoffDate ?? `${effectiveCutoffDate(model)} (estimated)`}`,
    model.localModel ? `VRAM: ${model.minVramRequirement}GB` : '',
  ].filter(Boolean);
}
