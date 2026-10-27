import {apiTwinId, groupProfiles, sortProfiles, vramClassOf} from './profile.util';
import {ProfileEntry} from './profile.model';
import {AiModel} from './ai-model.model';
import {testModel} from '../../testing/model-fixture';

function entry(overrides: Partial<AiModel>): ProfileEntry {
  const model = testModel(overrides);
  return {model, group: model.localModel ? 'local' : 'api', peerCount: 1, headline: '', badges: [], metrics: [], alternative: null};
}

const ids = (entries: ProfileEntry[]) => entries.map(e => e.model.id);

describe('sortProfiles', () => {
  const entries = [
    entry({id: 'old', deprecated: true, costsToRun: 1}),
    entry({id: 'none', costsToRun: null, overallIntelligence: 60}),
    entry({id: 'pricey', costsToRun: 50, overallIntelligence: 50}),
    entry({id: 'cheap', costsToRun: 5, overallIntelligence: 20}),
  ];

  it('sorts best first, missing values and deprecated models last', () => {
    expect(ids(sortProfiles(entries, 'cost'))).toEqual(['cheap', 'pricey', 'none', 'old']);
    expect(ids(sortProfiles(entries, 'intelligence'))).toEqual(['none', 'pricey', 'cheap', 'old']);
    expect(ids(sortProfiles(entries, 'value'))).toEqual(['cheap', 'pricey', 'none', 'old']);
  });
});

describe('groupProfiles', () => {
  const api = entry({id: 'glm'});
  const twin = entry({id: 'glm-local', localModel: true, minVramRequirement: 452});
  const small = entry({id: 'tiny-local', localModel: true, minVramRequirement: 8});
  const mid = entry({id: 'mid-local', localModel: true, minVramRequirement: 17});
  const unknown = entry({id: 'x-local', localModel: true, minVramRequirement: 0});
  const all = [twin, small, api, mid, unknown];

  it('merges a local twin into the card of its API model without grouping', () => {
    const [section] = groupProfiles(all, 'none');
    expect(section.cards.map(c => [c.entry.model.id, c.twin?.model.id ?? null])).toEqual([
      ['tiny-local', null], ['glm', 'glm-local'], ['mid-local', null], ['x-local', null],
    ]);
  });

  it('keeps a local twin alone when its API model is not shown', () => {
    expect(groupProfiles([twin], 'none')[0].cards[0]).toEqual({entry: twin, twin: null});
  });

  it('groups by hosting and by VRAM class, without empty sections', () => {
    expect(groupProfiles(all, 'hosting').map(s => [s.label, s.cards.length])).toEqual([['API models', 1], ['Local models', 4]]);
    expect(groupProfiles(all, 'vram').map(s => [s.label, s.cards.map(c => c.entry.model.id)])).toEqual([
      ['API models', ['glm']],
      ['Local, up to 16 GB VRAM', ['tiny-local']],
      ['Local, 17 to 32 GB VRAM', ['mid-local']],
      ['Local, over 128 GB VRAM', ['glm-local']],
      ['Local, VRAM unknown', ['x-local']],
    ]);
  });
});

describe('profile helpers', () => {
  it('finds the API twin id and the VRAM class', () => {
    expect(apiTwinId({id: 'glm-local', localModel: true})).toBe('glm');
    expect(apiTwinId({id: 'glm', localModel: false})).toBeNull();
    expect([0, 16, 17, 128, 129].map(vramClassOf)).toEqual([null, 0, 1, 2, 3]);
  });
});
