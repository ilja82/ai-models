export interface AiModel {
  id: string;
  publicName: string;
  modelName: string;
  inputCosts: number;
  outputCosts: number;
  contextWindow: number;
  costsToRun: number;
  availableInLiteLLM: boolean;
  availableForLocal: boolean;
  minVramRequirement: number;
  overallIntelligence: number;
  codingIntelligence: number;
  agenticIntelligence: number;
}

export type IntelligenceMetric = 'overall' | 'coding' | 'agentic';
