import {TestBed} from '@angular/core/testing';
import {BarChartComponent} from './bar-chart';
import {AppState} from '../../state/app.state';
import {testModel} from '../../../testing/model-fixture';

describe('BarChartComponent Pareto only', () => {
  let state: AppState;
  let c: BarChartComponent;

  beforeEach(() => {
    localStorage.clear();
    state = TestBed.inject(AppState);
    state.allModels.set([
      testModel({id: 'best', overallIntelligence: 60, costsToRun: 2}),
      testModel({id: 'cheap', overallIntelligence: 30, costsToRun: 1}),
      testModel({id: 'worse', overallIntelligence: 40, costsToRun: 50, tokensPerSecond: 300}),
      testModel({id: 'no-speed', overallIntelligence: 70, costsToRun: 80, tokensPerSecond: null}),
      testModel({id: 'unpriced', overallIntelligence: 90, costsToRun: null}),
    ]);
    state.disabledModelIds.set(new Set());
    state.showEfforts.set(false);
    state.showOnlyPareto.set(false);
    c = TestBed.createComponent(BarChartComponent).componentInstance;
  });

  const ids = () => c.chartData().models.map(m => m.id);

  it('shows only the Pareto set of the table while Pareto only is on', () => {
    state.barMetric.set('intelligence');
    expect(ids()).toEqual(['unpriced', 'no-speed', 'best', 'worse', 'cheap']);
    state.showOnlyPareto.set(true);
    expect(ids()).toEqual(['no-speed', 'best', 'cheap']);
  });

  it('keeps the value axis when Pareto only is toggled', () => {
    state.barMetric.set('tokensPerSecond');
    const before = [c.chartData().yMax, c.chartData().ySuggestedMax];
    expect(before).toEqual([undefined, 300]);
    state.showOnlyPareto.set(true);
    expect(ids()).not.toContain('worse');
    expect([c.chartData().yMax, c.chartData().ySuggestedMax]).toEqual(before);
    state.barMetric.set('intelligence');
    expect(c.chartData().yMax).toBe(95);
  });

  it('sorts every metric from the best value on the left to the worst on the right', () => {
    state.allModels.update(list => list.map((m, i) => ({
      ...m, inputCosts: i + 1, outputCosts: 5 - i, contextWindow: (i + 1) * 1000, maxInputTokens: (5 - i) * 1000,
      maxOutputTokens: (i + 2) * 1000, inputProcessingTime: i + 1, thinkingTime: 2 * i, outputTime: 5 - i,
    })));
    const lowerIsBetter = ['costsToRun', 'inputCosts', 'outputCosts', 'latency', 'responseTime'];
    for (const grouped of [true, false]) {
      state.barGroupByModel.set(grouped);
      for (const {key} of c.metrics) {
        state.barMetric.set(key);
        const data = c.chartData();
        const totals = data.models.map((_, i) => data.segments.reduce((sum, seg) => sum + seg.values[i], 0));
        const sorted = [...totals].sort((a, b) => lowerIsBetter.includes(key) ? a - b : b - a);
        expect(totals, `${key}, grouped ${grouped}`).toEqual(sorted);
        expect(new Set(totals).size, key).toBeGreaterThan(1);
      }
    }
  });

  it('names a model without the value as missing also while Pareto only is on', () => {
    state.allModels.update(list => [...list, testModel({id: 'dominated', overallIntelligence: 20, costsToRun: 90, tokensPerSecond: null})]);
    state.barMetric.set('tokensPerSecond');
    state.showOnlyPareto.set(true);
    expect(c.chartData().missing.map(m => m.id)).toEqual(['no-speed', 'dominated']);
  });
});

describe('BarChartComponent effort levels', () => {
  let state: AppState;
  let c: BarChartComponent;

  const level = (effort: string, overallIntelligence: number, costsToRun: number) => ({
    effort, overallIntelligence, costsToRun, tokensPerRun: 100, inputTokensPerRun: 90, outputTokensPerRun: 10,
    cacheHitRate: null, tokensPerSecond: 50, inputProcessingTime: 1, thinkingTime: 2, outputTime: 3,
  });

  beforeEach(() => {
    localStorage.clear();
    state = TestBed.inject(AppState);
    state.allModels.set([
      testModel({
        id: 'lorem', publicName: 'Lorem', overallIntelligence: 60, costsToRun: 20, effort: 'high',
        efforts: [level('low', 40, 5), level('medium', 60, 10), level('high', 60, 20)],
      }),
      testModel({id: 'ipsum', publicName: 'Ipsum', overallIntelligence: 50, costsToRun: 8}),
    ]);
    state.disabledModelIds.set(new Set());
    state.showEfforts.set(true);
    state.showOnlyPareto.set(false);
    state.barGroupByModel.set(false);
    c = TestBed.createComponent(BarChartComponent).componentInstance;
  });

  it('adds a bar for each effort level whose value differs', () => {
    state.barMetric.set('intelligence');
    expect(c.chartData().labels).toEqual(['Lorem (high)', 'Ipsum', 'Lorem (low)']);
    state.barMetric.set('costsToRun');
    expect(c.chartData().labels).toEqual(['Lorem (low)', 'Ipsum', 'Lorem (med)', 'Lorem (high)']);
    expect(c.legendItems().map(i => i.label)).toContain('Other effort level');
  });

  it('shows no effort bars for a metric without level values or while the levels are hidden', () => {
    state.barMetric.set('inputCosts');
    expect(c.chartData().labels).toEqual(['Lorem', 'Ipsum']);
    state.barMetric.set('intelligence');
    state.showEfforts.set(false);
    expect(c.chartData().labels).toEqual(['Lorem', 'Ipsum']);
    expect(c.legendItems().map(i => i.label)).not.toContain('Other effort level');
  });

  it('keeps an effort level of the Pareto set while Pareto only is on', () => {
    state.barMetric.set('costsToRun');
    state.showOnlyPareto.set(true);
    expect(c.chartData().models.map(m => m.id)).toEqual(['lorem@low', 'ipsum', 'lorem@medium']);
  });

  it('groups the levels of a model from the best value and ranks the group by its best level', () => {
    state.barGroupByModel.set(true);
    state.barMetric.set('intelligence');
    expect(c.chartData().labels).toEqual(['Lorem (high)', 'low', 'Ipsum']);
    expect(c.chartData().fullLabels).toEqual(['Lorem (high)', 'Lorem (low)', 'Ipsum']);
    expect(c.chartData().grouped).toBe(true);
    state.barMetric.set('costsToRun');
    expect(c.chartData().labels).toEqual(['Lorem (low)', 'med', 'high', 'Ipsum']);
    state.showOnlyPareto.set(true);
    expect(c.chartData().models.map(m => m.id)).toEqual(['lorem@low', 'lorem@medium', 'ipsum']);
  });

  it('shows the group toggle only with effort bars', () => {
    state.barMetric.set('intelligence');
    expect(c.hasEffortBars()).toBe(true);
    state.barMetric.set('inputCosts');
    expect(c.hasEffortBars()).toBe(false);
  });
});
