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
    c = TestBed.createComponent(BarChartComponent).componentInstance;
  });

  it('adds a bar for each effort level whose value differs', () => {
    state.barMetric.set('intelligence');
    expect(c.chartData().labels).toEqual(['Lorem (high)', 'Ipsum', 'Lorem (low)']);
    state.barMetric.set('costsToRun');
    expect(c.chartData().labels).toEqual(['Lorem (high)', 'Lorem (med)', 'Ipsum', 'Lorem (low)']);
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
    expect(c.chartData().models.map(m => m.id)).toEqual(['lorem@medium', 'ipsum', 'lorem@low']);
  });
});
