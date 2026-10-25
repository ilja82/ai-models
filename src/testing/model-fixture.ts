import {AiModel} from '../app/models/ai-model.model';

export function testModel(overrides: Partial<AiModel> = {}): AiModel {
  return {
    id: 'lorem-1', publicName: 'Lorem 1', modelName: 'lorem-1', inputCosts: 1, outputCosts: 2,
    contextWindow: 200_000, maxInputTokens: 200_000, maxOutputTokens: 64_000, costsToRun: 10, localModel: false,
    minVramRequirement: 0, overallIntelligence: 40, codingIntelligence: 40, agenticIntelligence: 40,
    releaseDate: '2026-05-28', cutoffDate: null, reasoning: true, totalTokens: 1, totalSpend: 0, tokensPerRun: 100,
    usesCache: false, tokensPerSecond: 50, inputProcessingTime: 1, thinkingTime: 2, outputTime: 3,
    deprecated: false, deprecationInfo: '', effort: null, efforts: [],
    ...overrides,
  };
}
