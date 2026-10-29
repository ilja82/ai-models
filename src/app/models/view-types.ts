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

/**
 * The bar metrics from the benchmark that keep the index version of their run. An older score and run cost are
 * estimated for the newest version instead.
 */
export const VERSIONED_BAR_METRICS: ReadonlySet<BarMetric> = new Set<BarMetric>(
  ['tokensPerSecond', 'latency', 'responseTime']);

export const PLOT_TYPE_KEYS: readonly PlotType[] = [
  'price', 'cost', 'release', 'context', 'speed', 'responseVsIntel', 'responseVsSpeed', 'costVsResponse',
];

/**
 * The 3D axes from the benchmark that keep the index version of their run. An older score and run cost are estimated
 * for the newest version instead.
 */
export const VERSIONED_AXIS_FIELDS: ReadonlySet<AxisField> = new Set<AxisField>([
  'tokensPerSecond', 'inputProcessingTime', 'thinkingTime', 'outputTime', 'responseTime',
]);

export const AXIS_FIELD_KEYS: readonly AxisField[] = [
  'costsToRun', 'inputCosts', 'outputCosts',
  'contextWindow', 'maxInputTokens', 'maxOutputTokens', 'minVramRequirement',
  'intelligence',
  'tokensPerSecond', 'inputProcessingTime', 'thinkingTime', 'outputTime', 'responseTime',
  'releaseDate',
];
