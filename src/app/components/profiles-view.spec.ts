import {TestBed} from '@angular/core/testing';
import {AppState} from '../state/app.state';
import {testModel} from '../../testing/model-fixture';
import {ModelProfilesComponent} from './model-profiles/model-profiles';

describe('profiles view', () => {
  const models = [
    testModel({id: 'glm', publicName: 'glm', overallIntelligence: 45, costsToRun: 3000}),
    testModel({id: 'glm-local', publicName: 'glm-local', localModel: true, minVramRequirement: 452, overallIntelligence: 44, costsToRun: 250}),
    testModel({id: 'gemma-local', publicName: 'gemma-local', localModel: true, minVramRequirement: 8, overallIntelligence: 14, costsToRun: 15}),
    testModel({id: 'mistral-local', publicName: 'mistral-local', localModel: true, minVramRequirement: 77, overallIntelligence: 14, costsToRun: 120}),
  ];

  let state: AppState;
  beforeEach(() => {
    localStorage.clear();
    state = TestBed.inject(AppState);
    state.allModels.set(models);
    state.disabledModelIds.set(new Set());
    state.showLocal.set(true);
    state.maxVram.set(null);
  });

  const create = () => TestBed.createComponent(ModelProfilesComponent).componentInstance;
  const headline = (c: ModelProfilesComponent, id: string) => c.profiles().find(p => p.model.id === id)!.headline;

  it('rates against the filtered models', () => {
    const c = create();
    expect(headline(c, 'gemma-local')).toMatch(/^#2 of 3 local/);
    state.disabledModelIds.set(new Set(['glm-local']));
    expect(headline(c, 'gemma-local')).toMatch(/^#1 of 2 local/);
  });

  it('does not change the ratings with the text search', () => {
    const c = create();
    c.searchText.set('gemma');
    expect(c.profiles().map(p => p.model.id)).toEqual(['gemma-local']);
    expect(headline(c, 'gemma-local')).toMatch(/^#2 of 3 local/);
  });

  it('sorts, groups and merges the local twin into the API card', () => {
    const c = create();
    c.sortBy.set('cost');
    expect(c.sections()[0].cards.map(card => [card.entry.model.id, card.twin?.model.id ?? null])).toEqual([
      ['gemma-local', null], ['mistral-local', null], ['glm', 'glm-local'],
    ]);
    c.grouping.set('hosting');
    expect(c.sections().map(s => s.cards.map(card => card.entry.model.id))).toEqual([
      ['glm'], ['gemma-local', 'mistral-local', 'glm-local'],
    ]);
  });

  it('names the better local model on the card of a dominated one', () => {
    const p = create().profiles().find(e => e.model.id === 'mistral-local')!;
    expect(p.alternative?.model.id).toBe('gemma-local');
  });
});
