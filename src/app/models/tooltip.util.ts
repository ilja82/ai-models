import {AiModel, effectiveCutoffDate, IntelligenceMetric} from './ai-model.model';

export function buildModelTooltipLines(model: AiModel, metric: IntelligenceMetric): string[] {
  const intel = metric === 'coding' ? model.codingIntelligence
    : metric === 'agentic' ? model.agenticIntelligence
      : model.overallIntelligence;
  const metricLabel = metric === 'coding' ? 'Coding Intelligence'
    : metric === 'agentic' ? 'Agentic Intelligence'
      : 'Overall Intelligence';
  const responseTime = model.inputProcessingTime + model.thinkingTime + model.outputTime;
  return [
    `${model.publicName}`,
    model.deprecated ? `⚠️ Deprecated: ${model.deprecationInfo}` : '',
    `★ ${metricLabel}: ${intel}`,
    `★ Speed: ${model.tokensPerSecond} tok/s`,
    `★ Response time: ${responseTime.toFixed(1)}s (in: ${model.inputProcessingTime}s, think: ${model.thinkingTime}s, out: ${model.outputTime}s)`,
    `★ Run cost: $${model.costsToRun.toFixed(2)}/M tokens`,
    `★ Release: ${model.releaseDate}`,
    `─────────────────`,
    `Type: ${model.localModel ? 'Local' : 'API'}`,
    `Input: $${model.inputCosts.toFixed(3)}/M tokens`,
    `Output: $${model.outputCosts.toFixed(3)}/M tokens`,
    `Context: ${(model.contextWindow / 1000).toFixed(0)}K tokens`,
    `Max In: ${(model.maxInputTokens / 1000).toFixed(0)}K tokens`,
    `Max Out: ${(model.maxOutputTokens / 1000).toFixed(0)}K tokens`,
    `Cutoff: ${model.cutoffDate ?? `${effectiveCutoffDate(model)} (estimated)`}`,
    model.localModel ? `VRAM: ${model.minVramRequirement}GB` : '',
  ].filter(Boolean);
}
