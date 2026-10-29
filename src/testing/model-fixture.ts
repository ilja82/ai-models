import {AiModel} from '../app/models/ai-model.model';

export function testModel(overrides: Partial<AiModel> = {}): AiModel {
  return {
    id: 'lorem-1', publicName: 'Lorem 1', modelName: 'lorem-1', inputCosts: 1, outputCosts: 2, cacheCosts: null,
    contextWindow: 200_000, maxInputTokens: 200_000, maxOutputTokens: 64_000, costsToRun: 10, localModel: false,
    provider: 'bedrock', minVramRequirement: 0, overallIntelligence: 40, benchmarkVersion: 'v5.0',
    releaseDate: '2026-05-28', cutoffDate: null, reasoning: true, inputModalities: ['text'], outputModalities: ['text'],
    totalTokens: 1, totalSpend: 0, totalRequests: 0, tokensPerRun: 100,
    inputTokensPerRun: 90, outputTokensPerRun: 10, cacheHitRate: null, tokensPerRunEstimated: false,
    usesCache: false, tokensPerSecond: 50, inputProcessingTime: 1, thinkingTime: 2, outputTime: 3,
    deprecated: false, deprecationInfo: '', effort: null, efforts: [],
    ...overrides,
  };
}
