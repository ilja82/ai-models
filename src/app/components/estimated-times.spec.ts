import {TestBed} from '@angular/core/testing';
import {AppState} from '../state/app.state';
import {testModel} from '../../testing/model-fixture';
import {EffortLevel} from '../models/ai-model.model';
import {effortVariant} from '../models/effort.util';
import {BarChartComponent} from './bar-chart/bar-chart';
import {ModelProfilesComponent} from './model-profiles/model-profiles';

const TEXT = 'Speed or times estimated: converted from the artificialanalysis.ai measurement before 2026-11-04';

describe('estimated speed and times', () => {
  const level = (effort: string, timesEstimated: boolean): EffortLevel => ({
    effort, overallIntelligence: 40, intelligenceEstimatedFrom: null, costsToRun: 10, tokensPerRun: 100,
    inputTokensPerRun: 90, outputTokensPerRun: 10, cacheHitRate: null, tokensPerSecond: 50, inputProcessingTime: 1,
    thinkingTime: 2, outputTime: 3, timesEstimated,
  });
  const measured = testModel({id: 'measured', publicName: 'Measured'});
  const estimated = testModel({
    id: 'estimated', publicName: 'Estimated', timesEstimated: true, effort: 'high',
    efforts: [level('low', false), level('high', true)],
  });

  beforeEach(() => {
    localStorage.clear();
    const state = TestBed.inject(AppState);
    state.allModels.set([measured, estimated]);
    state.disabledModelIds.set(new Set());
    state.hiddenProviders.set([]);
  });

  it('gives an effort variant the mark of its level, not of its model', () => {
    expect(effortVariant(estimated, estimated.efforts[0]).timesEstimated).toBe(false);
    expect(effortVariant(measured, level('low', true)).timesEstimated).toBe(true);
  });

  it('passes the speed bars with their marks to the estimated times hint', () => {
    TestBed.inject(AppState).barMetric.set('tokensPerSecond');
    const bars = TestBed.createComponent(BarChartComponent).componentInstance;
    expect(bars.timeModels().filter(m => m.timesEstimated).map(m => m.id)).toEqual(['estimated']);
  });

  it('shows the mark on the profile card of a model with estimated speed or times only', () => {
    const fixture = TestBed.createComponent(ModelProfilesComponent);
    fixture.detectChanges();
    const cards = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.card-head')];
    const badges = cards.map(c => [c.querySelector('.name')!.textContent!.trim(),
      c.querySelector('.estimated-badge')?.textContent!.trim() ?? null]);
    expect(badges).toContainEqual(['Estimated', TEXT]);
    expect(badges).toContainEqual(['Measured', null]);
  });
});
