export interface AiModel {
  id: string;
  publicName: string;
  modelName: string;
  inputCosts: number;
  outputCosts: number;
  contextWindow: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  costsToRun: number;
  localModel: boolean;
  minVramRequirement: number;
  overallIntelligence: number;
  codingIntelligence: number;
  agenticIntelligence: number;
  releaseDate: string;
  cutoffDate: string | null;
  reasoning: boolean;
  totalTokens: number;
  totalSpend: number;
  tokensPerRun: number;
  usesCache: boolean;
  tokensPerSecond: number;
  inputProcessingTime: number;
  thinkingTime: number;
  outputTime: number;
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

export type IntelligenceMetric = 'overall' | 'coding' | 'agentic';

export function computeCostsToRun(totalSpend: number, totalTokens: number, tokensPerRun: number): number {
  if (totalTokens <= 0) return 0;
  return (totalSpend / totalTokens) * tokensPerRun * 1_000_000;
}

/** Returns the known cutoffDate, or an estimate of releaseDate minus 12 months. */
export function effectiveCutoffDate(model: Pick<AiModel, 'cutoffDate' | 'releaseDate'>): string {
  if (model.cutoffDate) return model.cutoffDate;
  const d = new Date(model.releaseDate);
  if (Number.isNaN(d.getTime())) return 'unknown';
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}
