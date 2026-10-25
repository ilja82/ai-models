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
