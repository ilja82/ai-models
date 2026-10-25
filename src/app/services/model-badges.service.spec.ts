import {TestBed} from '@angular/core/testing';
import {ModelBadgesService} from './model-badges.service';
import {testModel} from '../../testing/model-fixture';

describe('ModelBadgesService models without benchmark', () => {
  const scored = [10, 20, 30, 40, 50, 60].map(i => testModel({id: `m${i}`, overallIntelligence: i, costsToRun: i}));
  const embed = testModel({id: 'embed', overallIntelligence: null, costsToRun: null, outputModalities: ['embedding']});

  function profile(id: string) {
    const all = [...scored, embed];
    return TestBed.inject(ModelBadgesService).computeProfiles(all, all, {overall: null}).find(p => p.model.id === id)!;
  }

  it('gives a model without score no intelligence badge and the headline No benchmark', () => {
    const p = profile('embed');
    const ids = p.badges.map(b => b.id);
    for (const id of ['best-overall', 'top-overall', 'top-intel', 'weak-intel', 'great-value']) {
      expect(ids).not.toContain(id);
    }
    expect(p.headline).toBe('No benchmark');
  });

  it('ranks no model without score into the top 3, also with fewer than 3 scored models', () => {
    const all = [scored[0], scored[1], embed];
    const p = TestBed.inject(ModelBadgesService).computeProfiles(all, all, {overall: null}).find(x => x.model.id === 'embed')!;
    expect(p.badges.map(b => b.id)).not.toContain('top-overall');
  });

  it('keeps the best overall badge on the best scored model', () => {
    expect(profile('m60').badges.map(b => b.id)).toContain('best-overall');
  });
});
