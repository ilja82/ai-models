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

  it('restores a stored price plot', () => {
    localStorage.setItem('ai-models.plotType', 'price');
    expect(TestBed.inject(AppState).plotType()).toBe('price');
  });

  it('falls back to the cost plot for an unknown plot', () => {
    localStorage.setItem('ai-models.plotType', 'lorem');
    expect(TestBed.inject(AppState).plotType()).toBe('cost');
  });

  it('opens the cost plot for a scatter link without a plot', () => {
    localStorage.setItem('ai-models.plotType', 'price');
    history.replaceState(null, '', '#/scatter');
    try {
      expect(TestBed.inject(AppState).plotType()).toBe('cost');
    } finally {
      history.replaceState(null, '', window.location.pathname);
    }
  });
});

describe('AppState effort levels', () => {
  afterEach(() => localStorage.clear());

  function level(effort: string, overallIntelligence: number, costsToRun: number): EffortLevel {
    return {
      effort, overallIntelligence, costsToRun, tokensPerRun: 1, inputTokensPerRun: 1, outputTokensPerRun: 0,
      cacheHitRate: null, tokensPerSecond: 50,
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

  it('puts the effort levels into the Pareto set', () => {
    const state = setUp();
    expect([...state.usefulModelIds()].sort()).toEqual(['a', 'a@low']);
  });
});

describe('AppState modality filter', () => {
  afterEach(() => localStorage.clear());

  function setUp(): AppState {
    const state = TestBed.inject(AppState);
    state.allModels.set([
      testModel({id: 'text'}),
      testModel({id: 'vision', inputModalities: ['text', 'image']}),
      testModel({id: 'omni', inputModalities: ['text', 'image', 'audio', 'video']}),
      testModel({id: 'embed', outputModalities: ['embedding']}),
    ]);
    state.disabledModelIds.set(new Set());
    state.clearModalities();
    return state;
  }

  const ids = (state: AppState) => state.availableModels().map(m => m.id);

  it('shows all models without a filter', () => {
    expect(ids(setUp())).toEqual(['text', 'vision', 'omni', 'embed']);
  });

  it('keeps the models with every selected modality', () => {
    const state = setUp();
    state.toggleInputModality('image');
    expect(ids(state)).toEqual(['vision', 'omni']);
    state.toggleInputModality('audio');
    expect(ids(state)).toEqual(['omni']);
    expect(state.modalityPool().length).toBe(4);
  });

  it('filters by output and clears both lists', () => {
    const state = setUp();
    state.toggleOutputModality('embedding');
    expect(ids(state)).toEqual(['embed']);
    state.toggleInputModality('image');
    expect(ids(state)).toEqual([]);
    state.clearModalities();
    expect(ids(state).length).toBe(4);
  });

  it('keeps the selection in filter order and toggles a modality off', () => {
    const state = setUp();
    state.toggleInputModality('video');
    state.toggleInputModality('image');
    expect(state.inputModalities()).toEqual(['image', 'video']);
    state.toggleInputModality('video');
    expect(state.inputModalities()).toEqual(['image']);
  });

  it('ignores unknown stored modalities and broken JSON', () => {
    localStorage.setItem('ai-models.inputModalities', JSON.stringify(['lorem', 'video', 'image']));
    localStorage.setItem('ai-models.outputModalities', '{');
    const state = TestBed.inject(AppState);
    expect(state.inputModalities()).toEqual(['image', 'video']);
    expect(state.outputModalities()).toEqual([]);
  });
});

describe('AppState provider filter', () => {
  afterEach(() => localStorage.clear());

  function setUp(): AppState {
    const state = TestBed.inject(AppState);
    state.allModels.set([
      testModel({id: 'aws', provider: 'bedrock'}),
      testModel({id: 'tx', provider: 'tensorx'}),
      testModel({id: 'local', provider: null, localModel: true}),
    ]);
    state.showLocal.set(true);
    state.maxVram.set(null);
    state.hiddenProviders.set([]);
    return state;
  }

  const ids = (state: AppState) => state.availableModels().map(m => m.id);

  it('hides the models of a provider and keeps the local models', () => {
    const state = setUp();
    state.toggleProvider('tensorx');
    expect(ids(state)).toEqual(['aws', 'local']);
    state.toggleProvider('bedrock');
    expect(state.hiddenProviders()).toEqual(['bedrock', 'tensorx']);
    expect(ids(state)).toEqual(['local']);
    state.toggleProvider('tensorx');
    expect(ids(state)).toEqual(['tx', 'local']);
  });

  it('ignores unknown stored providers', () => {
    localStorage.setItem('ai-models.hiddenProviders', JSON.stringify(['lorem', 'tensorx']));
    expect(TestBed.inject(AppState).hiddenProviders()).toEqual(['tensorx']);
  });
});

describe('AppState bar groups', () => {
  afterEach(() => localStorage.clear());

  it('groups the bars by model by default', () => {
    localStorage.clear();
    expect(TestBed.inject(AppState).barGroupByModel()).toBe(true);
  });

  it('restores a stored choice', () => {
    localStorage.setItem('ai-models.barGroupByModel', 'false');
    expect(TestBed.inject(AppState).barGroupByModel()).toBe(false);
  });
});
