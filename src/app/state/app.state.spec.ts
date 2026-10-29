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
      effort, overallIntelligence, intelligenceEstimatedFrom: null, costsToRun, tokensPerRun: 1, inputTokensPerRun: 1,
      outputTokensPerRun: 0, cacheHitRate: null, tokensPerSecond: 50, inputProcessingTime: 1, thinkingTime: 2,
      outputTime: 3,
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

describe('AppState deprecated models', () => {
  afterEach(() => localStorage.clear());

  function setUp(): AppState {
    const state = TestBed.inject(AppState);
    state.allModels.set([
      testModel({id: 'active', publicName: 'Lorem Active'}),
      testModel({id: 'old', publicName: 'Lorem Old', deprecated: true, releaseDate: '2025-01-10'}),
      testModel({id: 'fresh', publicName: 'Ipsum Fresh', modelName: 'ipsum-fresh', deprecated: true, releaseDate: '2026-09-01'}),
    ]);
    state.today.set(new Date(2026, 9, 26));
    state.showDeprecated.set(false);
    state.showNewModels.set(false);
    state.disabledModelIds.set(new Set());
    state.pickedDeprecatedIds.set(new Set());
    state.modelSearch.set('');
    return state;
  }

  const ids = (models: { id: string }[] | null) => (models ?? []).map(m => m.id);

  it('hides deprecated models by default', () => {
    expect(ids(setUp().filteredModels())).toEqual(['active']);
  });

  it('shows the deprecated models released in the last 3 months', () => {
    const state = setUp();
    state.showNewModels.set(true);
    expect(ids(state.filteredModels())).toEqual(['active', 'fresh']);
  });

  it('sets one deprecated mode at a time', () => {
    const state = setUp();
    expect(state.deprecatedMode()).toBe('none');
    state.setDeprecatedMode('new');
    expect([state.showDeprecated(), state.showNewModels()]).toEqual([false, true]);
    expect(ids(state.filteredModels())).toEqual(['active', 'fresh']);
    state.setDeprecatedMode('all');
    expect([state.showDeprecated(), state.showNewModels()]).toEqual([true, false]);
    expect(ids(state.filteredModels())).toEqual(['active', 'old', 'fresh']);
    state.setDeprecatedMode('none');
    expect([state.showDeprecated(), state.showNewModels()]).toEqual([false, false]);
  });

  it('turns on the models that a mode switch adds to the list', () => {
    const state = setUp();
    state.setDeprecatedMode('all');
    state.disabledModelIds.set(new Set(['active', 'old', 'fresh']));
    state.setDeprecatedMode('none');
    state.setDeprecatedMode('new');
    expect(ids(state.filteredModels())).toEqual(['fresh']);
    state.setDeprecatedMode('all');
    expect(ids(state.filteredModels())).toEqual(['old', 'fresh']);
  });

  it('reads both stored toggles on as the mode all', () => {
    const state = setUp();
    state.showDeprecated.set(true);
    state.showNewModels.set(true);
    expect(state.deprecatedMode()).toBe('all');
  });

  it('turns all models off and on and clears the manual choices', () => {
    const state = setUp();
    state.toggleModel('old');
    state.toggleModel('active');
    expect(ids(state.filteredModels())).toEqual(['old']);

    state.setAllModelsActive(true);
    expect(ids(state.filteredModels())).toEqual(['active']);
    expect(state.pickedDeprecatedIds().size).toBe(0);
    expect(state.disabledModelIds().size).toBe(0);

    state.toggleModel('old');
    state.setAllModelsActive(false);
    expect(ids(state.filteredModels())).toEqual([]);
    expect(state.pickedDeprecatedIds().size).toBe(0);
    expect([...state.disabledModelIds()].sort()).toEqual(['active', 'fresh', 'old']);
    state.setDeprecatedMode('new');
    state.setAllModelsActive(true);
    expect(ids(state.filteredModels())).toEqual(['active', 'fresh']);
  });

  it('searches all models, deprecated ones included', () => {
    const state = setUp();
    state.modelSearch.set(' lorem ');
    expect(ids(state.searchResults())).toEqual(['active', 'old']);
    expect(state.isActive()(state.allModels()[1])).toBe(false);
    state.modelSearch.set('');
    expect(state.searchResults()).toBeNull();
  });

  it('names the reasons why the filters hide a model', () => {
    const state = setUp();
    const [active, old] = state.allModels();
    state.hiddenProviders.set(['bedrock']);
    state.outputModalities.set(['image']);
    state.disabledModelIds.set(new Set(['active']));
    expect(state.hiddenReasons()(active)).toEqual(['AWS Bedrock hidden', 'Modality filter', 'Turned off']);
    expect(state.hiddenReasons()(old)).toEqual(['AWS Bedrock hidden', 'Deprecated', 'Modality filter']);
    state.hiddenProviders.set([]);
    state.outputModalities.set([]);
    state.disabledModelIds.set(new Set());
    expect(state.hiddenReasons()(active)).toEqual([]);
  });

  it('names the availability and VRAM filters as reasons', () => {
    const state = setUp();
    const local = testModel({id: 'local', localModel: true, provider: null, minVramRequirement: 48});
    state.showAPI.set(false);
    state.showLocal.set(false);
    state.maxVram.set(24);
    expect(state.hiddenReasons()(state.allModels()[0])).toEqual(['API models hidden']);
    expect(state.hiddenReasons()(local)).toEqual(['Local models hidden', 'Needs 48 GB VRAM']);
  });

  it('turns a single deprecated model on and off', () => {
    const state = setUp();
    state.toggleModel('old');
    expect([...state.pickedDeprecatedIds()]).toEqual(['old']);
    expect(ids(state.filteredModels())).toEqual(['active', 'old']);
    state.toggleModel('old');
    expect(state.pickedDeprecatedIds().size).toBe(0);
    expect(state.disabledModelIds().size).toBe(0);
    expect(ids(state.filteredModels())).toEqual(['active']);
  });

  it('turns off a deprecated model that a toggle lists', () => {
    const state = setUp();
    state.showDeprecated.set(true);
    state.toggleModel('old');
    expect(state.pickedDeprecatedIds().size).toBe(0);
    expect(ids(state.filteredModels())).toEqual(['active', 'fresh']);
  });
});
