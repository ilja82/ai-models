export type ViewTab = 'table' | 'bar' | 'scatter' | 'scatter3d' | 'profiles';

export type BarMetric =
  | 'intelligence' | 'costsToRun' | 'inputCosts' | 'outputCosts' | 'contextWindow'
  | 'maxInputTokens' | 'maxOutputTokens'
  | 'tokensPerSecond' | 'latency' | 'responseTime';

export type PlotType =
  | 'cost' | 'release' | 'context' | 'speed' | 'responseVsIntel' | 'responseVsSpeed';

export type AxisField =
  | 'costsToRun' | 'inputCosts' | 'outputCosts'
  | 'contextWindow' | 'maxInputTokens' | 'maxOutputTokens' | 'minVramRequirement'
  | 'intelligence' | 'overallIntelligence' | 'codingIntelligence' | 'agenticIntelligence'
  | 'tokensPerSecond' | 'inputProcessingTime' | 'thinkingTime' | 'outputTime' | 'responseTime'
  | 'releaseDate';

export const VIEW_TABS: readonly ViewTab[] = ['table', 'bar', 'scatter', 'scatter3d', 'profiles'];

export const BAR_METRIC_KEYS: readonly BarMetric[] = [
  'intelligence', 'costsToRun', 'inputCosts', 'outputCosts', 'contextWindow',
  'maxInputTokens', 'maxOutputTokens',
  'tokensPerSecond', 'latency', 'responseTime',
];

export const PLOT_TYPE_KEYS: readonly PlotType[] = [
  'cost', 'release', 'context', 'speed', 'responseVsIntel', 'responseVsSpeed',
];

export const AXIS_FIELD_KEYS: readonly AxisField[] = [
  'costsToRun', 'inputCosts', 'outputCosts',
  'contextWindow', 'maxInputTokens', 'maxOutputTokens', 'minVramRequirement',
  'intelligence', 'overallIntelligence', 'codingIntelligence', 'agenticIntelligence',
  'tokensPerSecond', 'inputProcessingTime', 'thinkingTime', 'outputTime', 'responseTime',
  'releaseDate',
];
