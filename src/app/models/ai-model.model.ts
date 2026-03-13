export interface AiModel {
  id: string;
  publicName: string;
  modelName: string;
  inputCosts: number;
  outputCosts: number;
  contextWindow: number;
  costsToRun: number;
  localModel: boolean;
  minVramRequirement: number;
  overallIntelligence: number;
  codingIntelligence: number;
  agenticIntelligence: number;
}

export type IntelligenceMetric = 'overall' | 'coding' | 'agentic';

export function computeCostsToRun(inputCosts: number, outputCosts: number): number {
  return inputCosts + 5.0 * outputCosts;
}
