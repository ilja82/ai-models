import {AiModel, blendedPriceOf, effectiveCutoffDate, PRICE_BLEND, responseTimeOf} from './ai-model.model';

const MISSING = 'no data';

export function buildModelTooltipLines(model: AiModel): string[] {
  const responseTime = responseTimeOf(model);
  return [
    `${model.publicName}`,
    model.deprecated ? `⚠️ Deprecated: ${model.deprecationInfo}` : '',
    `★ Overall Intelligence: ${model.overallIntelligence}`,
    model.effort ? `★ Effort: ${model.effort}${model.efforts.length > 1 ? ` (${model.efforts.length} levels measured)` : ''}` : '',
    `★ Speed: ${model.tokensPerSecond === null ? MISSING : `${model.tokensPerSecond} tok/s`}`,
    responseTime === null
      ? `★ Response time: ${MISSING}`
      : `★ Response time: ${responseTime.toFixed(1)}s (in: ${model.inputProcessingTime}s, think: ${model.thinkingTime}s, out: ${model.outputTime}s)`,
    `★ Run cost: ${model.costsToRun === null ? MISSING : `$${model.costsToRun.toFixed(2)}`}`,
    `★ Price: $${blendedPriceOf(model).toFixed(3)}/M tokens (blended ${PRICE_BLEND.cache}:${PRICE_BLEND.input}:${PRICE_BLEND.output} cache:input:output)`,
    `★ Release: ${model.releaseDate}`,
    `─────────────────`,
    `Type: ${model.localModel ? 'Local' : 'API'}`,
    `Input: $${model.inputCosts.toFixed(3)}/M tokens`,
    `Output: $${model.outputCosts.toFixed(3)}/M tokens`,
    `Cache: ${model.cacheCosts === null ? 'no cache, input price' : `$${model.cacheCosts.toFixed(3)}/M tokens`}`,
    `Context: ${(model.contextWindow / 1000).toFixed(0)}K tokens`,
    `Max In: ${(model.maxInputTokens / 1000).toFixed(0)}K tokens`,
    `Max Out: ${(model.maxOutputTokens / 1000).toFixed(0)}K tokens`,
    `Cutoff: ${model.cutoffDate ?? `${effectiveCutoffDate(model)} (estimated)`}`,
    model.localModel ? `VRAM: ${model.minVramRequirement}GB` : '',
  ].filter(Boolean);
}
