import {TestBed} from '@angular/core/testing';
import {AppState} from './app.state';
import {testModel} from '../../testing/model-fixture';
import {EffortLevel} from '../models/ai-model.model';

describe('AppState stored 3D axes', () => {
  afterEach(() => localStorage.clear());

  it('falls back to the default for an axis that no longer exists', () => {
    localStorage.setItem('ai-models.scatter3d.z', 'codingIntelligence');
    localStorage.setItem('ai-models.scatter3d.x', 'contextWindow');
    const state = TestBed.inject(AppState);
    expect(state.scatter3dZ()).toBe('intelligence');
    expect(state.scatter3dX()).toBe('contextWindow');
  });

  it('falls back to the price plot for the removed cost plot', () => {
    localStorage.setItem('ai-models.plotType', 'cost');
    expect(TestBed.inject(AppState).plotType()).toBe('price');
  });
});

describe('AppState effort levels', () => {
  afterEach(() => localStorage.clear());

  function level(effort: string, overallIntelligence: number, costsToRun: number): EffortLevel {
    return {
      effort, overallIntelligence, costsToRun, tokensPerRun: 1, tokensPerSecond: 50,
      inputProcessingTime: 1, thinkingTime: 2, outputTime: 3,
    };
  }

  function setUp(): AppState {
    const state = TestBed.inject(AppState);
    state.allModels.set([
      testModel({
        id: 'a', overallIntelligence: 50, costsToRun: 10, effort: 'high',
        efforts: [level('low', 35, 2), level('high', 50, 10)],
      }),
      testModel({id: 'b', overallIntelligence: 30, costsToRun: 5}),
    ]);
    state.disabledModelIds.set(new Set());
    return state;
  }

  it('shows the effort levels by default', () => {
    expect(TestBed.inject(AppState).showEfforts()).toBe(true);
  });

  it('puts the effort levels into the Pareto set while they are shown', () => {
    const state = setUp();
    expect([...state.usefulModelIds()].sort()).toEqual(['a', 'a@low']);
    state.showEfforts.set(false);
    expect([...state.usefulModelIds()].sort()).toEqual(['a', 'b']);
  });

  it('ranks each level on the price plot by the model price scaled by its tokens per run', () => {
    const state = TestBed.inject(AppState);
    state.allModels.set([
      testModel({
        id: 'a', overallIntelligence: 50, tokensPerRun: 100, effort: 'high',
        efforts: [{...level('low', 35, 2), tokensPerRun: 10}, {...level('medium', 45, 5), tokensPerRun: null}, level('high', 50, 10)],
      }),
      testModel({id: 'b', overallIntelligence: 30, inputCosts: 0.5, outputCosts: 0.5}),
      testModel({id: 'c', overallIntelligence: 40, inputCosts: 0.2, outputCosts: 0.2}),
    ]);
    state.disabledModelIds.set(new Set());
    expect([...state.usefulPriceModelIds()].sort()).toEqual(['a', 'a@low', 'c']);
    state.allModels.update(models => [...models, testModel({
      id: 'd', overallIntelligence: 20, effort: 'high', deprecated: true,
      efforts: [{...level('medium', 15, 5), tokensPerRun: 0.5}, level('high', 20, 1)],
    })]);
    expect([...state.usefulPriceModelIds()].sort()).toEqual(['a', 'a@low', 'a@medium', 'c']);
    state.showEfforts.set(false);
    expect([...state.usefulPriceModelIds()].sort()).toEqual(['a', 'c']);
  });
});
