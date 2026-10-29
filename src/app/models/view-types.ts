export type ViewTab = 'table' | 'bar' | 'scatter' | 'scatter3d' | 'profiles';

export type BarMetric =
  | 'intelligence' | 'costsToRun' | 'inputCosts' | 'outputCosts' | 'contextWindow'
  | 'maxInputTokens' | 'maxOutputTokens'
  | 'tokensPerSecond' | 'latency' | 'responseTime';

export type PlotType =
  | 'price' | 'cost' | 'release' | 'context' | 'speed' | 'responseVsIntel' | 'responseVsSpeed' | 'costVsResponse';

export type AxisField =
  | 'costsToRun' | 'inputCosts' | 'outputCosts'
  | 'contextWindow' | 'maxInputTokens' | 'maxOutputTokens' | 'minVramRequirement'
  | 'intelligence'
  | 'tokensPerSecond' | 'inputProcessingTime' | 'thinkingTime' | 'outputTime' | 'responseTime'
  | 'releaseDate';

export const VIEW_TABS: readonly ViewTab[] = ['table', 'bar', 'scatter', 'scatter3d', 'profiles'];

export const BAR_METRIC_KEYS: readonly BarMetric[] = [
  'intelligence', 'costsToRun', 'inputCosts', 'outputCosts', 'contextWindow',
  'maxInputTokens', 'maxOutputTokens',
  'tokensPerSecond', 'latency', 'responseTime',
];

/** The bar metrics whose values come from the benchmark. */
export const BENCHMARK_BAR_METRICS: ReadonlySet<BarMetric> = new Set<BarMetric>(
  ['intelligence', 'costsToRun', 'tokensPerSecond', 'latency', 'responseTime']);

export const PLOT_TYPE_KEYS: readonly PlotType[] = [
  'price', 'cost', 'release', 'context', 'speed', 'responseVsIntel', 'responseVsSpeed', 'costVsResponse',
];

/** The 3D axes whose values come from the benchmark. */
export const BENCHMARK_AXIS_FIELDS: ReadonlySet<AxisField> = new Set<AxisField>([
  'costsToRun', 'intelligence', 'tokensPerSecond', 'inputProcessingTime', 'thinkingTime', 'outputTime', 'responseTime',
]);

export const AXIS_FIELD_KEYS: readonly AxisField[] = [
  'costsToRun', 'inputCosts', 'outputCosts',
  'contextWindow', 'maxInputTokens', 'maxOutputTokens', 'minVramRequirement',
  'intelligence',
  'tokensPerSecond', 'inputProcessingTime', 'thinkingTime', 'outputTime', 'responseTime',
  'releaseDate',
];
