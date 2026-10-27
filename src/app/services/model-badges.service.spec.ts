import {TestBed} from '@angular/core/testing';
import {BalancedIds, ModelBadgesService} from './model-badges.service';
import {testModel} from '../../testing/model-fixture';
import {AiModel} from '../models/ai-model.model';

const NO_BALANCED: BalancedIds = {api: null, local: null};

function profilesOf(models: AiModel[], peers: AiModel[] = models) {
  return TestBed.inject(ModelBadgesService).computeProfiles(models, peers, NO_BALANCED);
}

function profileOf(models: AiModel[], id: string, peers: AiModel[] = models) {
  return profilesOf(models, peers).find(p => p.model.id === id)!;
}

const badgeIds = (p: { badges: { id: string }[] }) => p.badges.map(b => b.id);

describe('ModelBadgesService models without benchmark', () => {
  const scored = [10, 20, 30, 40, 50, 60].map(i => testModel({id: `m${i}`, overallIntelligence: i, costsToRun: i}));
  const embed = testModel({id: 'embed', overallIntelligence: null, costsToRun: null, outputModalities: ['embedding']});

  it('gives a model without score no intelligence badge and the headline No benchmark', () => {
    const p = profileOf([...scored, embed], 'embed');
    for (const id of ['best-overall', 'top-overall', 'top-intel', 'weak-intel', 'great-value', 'pareto-front']) {
      expect(badgeIds(p)).not.toContain(id);
    }
    expect(p.headline).toBe('No benchmark');
    expect(p.alternative).toBeNull();
  });

  it('ranks no model without score into the top 3, also with fewer than 3 scored models', () => {
    expect(badgeIds(profileOf([scored[0], scored[1], embed], 'embed'))).not.toContain('top-overall');
  });

  it('keeps the best overall badge on the best scored model', () => {
    expect(badgeIds(profileOf([...scored, embed], 'm60'))).toContain('best-overall');
  });
});

describe('ModelBadgesService peer groups', () => {
  const api = [100, 200, 300, 400, 500].map((cost, i) =>
    testModel({id: `api${i}`, overallIntelligence: 40 + i, costsToRun: cost}));
  const local = [1, 2, 3, 4, 5].map((cost, i) =>
    testModel({id: `local${i}`, localModel: true, minVramRequirement: 8 * (i + 1), overallIntelligence: 10 + i, costsToRun: cost}));
  const all = [...api, ...local];

  it('rates API and local models only against their own group', () => {
    expect(badgeIds(profileOf(all, 'api0'))).not.toContain('expensive');
    expect(badgeIds(profileOf(all, 'api0'))).toContain('affordable');
    expect(badgeIds(profileOf(all, 'local4'))).toContain('best-overall');
    expect(profileOf(all, 'local4').badges.find(b => b.id === 'best-overall')!.label).toBe('Best local model');
  });

  it('rates against the given peers, not all models', () => {
    expect(profileOf(all, 'local3').headline).toMatch(/^#2 of 5 local/);
    expect(profileOf([local[3]], 'local3', local.slice(0, 4)).headline).toMatch(/^#1 of 4 local/);
  });

  it('leaves out the percentile badges with fewer than 5 peers', () => {
    const two = [testModel({id: 'a', tokensPerSecond: 10}), testModel({id: 'b', tokensPerSecond: 500, overallIntelligence: 50})];
    expect(badgeIds(profileOf(two, 'b'))).not.toContain('fastest');
    expect(badgeIds(profileOf(two, 'a'))).not.toContain('slow');
    expect(badgeIds(profileOf(two, 'b'))).toContain('best-overall');
  });
});

describe('ModelBadgesService headline', () => {
  it('shows the rank in the peer group and the largest VRAM class the model leads', () => {
    const models = [
      testModel({id: 'big', localModel: true, minVramRequirement: 200, overallIntelligence: 40, costsToRun: 50}),
      testModel({id: 'mid', localModel: true, minVramRequirement: 30, overallIntelligence: 30, costsToRun: 20}),
      testModel({id: 'small', localModel: true, minVramRequirement: 8, overallIntelligence: 20, costsToRun: 5}),
    ];
    expect(profileOf(models, 'big').headline).toBe('#1 of 3 local');
    expect(profileOf(models, 'mid').headline).toBe('#2 of 3 local · best up to 128 GB VRAM');
    expect(profileOf(models, 'small').headline).toBe('#3 of 3 local · best up to 16 GB VRAM');
  });

  it('names the best value, the cheapest or the fastest API model', () => {
    const models = [
      testModel({id: 'top', overallIntelligence: 50, costsToRun: 100, tokensPerSecond: 10}),
      testModel({id: 'value', overallIntelligence: 40, costsToRun: 10, tokensPerSecond: 20}),
      testModel({id: 'fast', overallIntelligence: 20, costsToRun: 90, tokensPerSecond: 300}),
    ];
    expect(profileOf(models, 'value').headline).toBe('#2 of 3 API · best value');
    expect(profileOf(models, 'fast').headline).toBe('#3 of 3 API · fastest');
  });

  it('keeps Deprecated for a deprecated model', () => {
    const models = [testModel({id: 'old', deprecated: true}), testModel({id: 'new'})];
    expect(profileOf(models, 'old').headline).toBe('Deprecated');
  });
});

describe('ModelBadgesService alternative and Pareto front', () => {
  const heavy = testModel({id: 'heavy', publicName: 'Heavy', localModel: true, minVramRequirement: 77, overallIntelligence: 13.9, costsToRun: 120});
  const light = testModel({id: 'light', publicName: 'Light', localModel: true, minVramRequirement: 8, overallIntelligence: 13.9, costsToRun: 15});
  const strong = testModel({id: 'strong', localModel: true, minVramRequirement: 200, overallIntelligence: 40, costsToRun: 100});

  it('names the dominating model with the highest intelligence and the reason', () => {
    const p = profileOf([heavy, light, strong], 'heavy');
    expect(p.alternative?.model.id).toBe('light');
    expect(p.alternative?.reason).toBe('same intelligence, 88% lower run cost, 8 GB instead of 77 GB VRAM');
    expect(badgeIds(p)).not.toContain('pareto-front');
  });

  it('marks the models that nothing dominates as Pareto-optimal, without alternative', () => {
    for (const id of ['light', 'strong']) {
      const p = profileOf([heavy, light, strong], id);
      expect(badgeIds(p)).toContain('pareto-front');
      expect(p.alternative).toBeNull();
    }
  });

  it('names only an alternative that accepts and returns all modalities of the model', () => {
    const vision = testModel({
      id: 'vision', localModel: true, minVramRequirement: 3, overallIntelligence: 5, costsToRun: 3,
      inputModalities: ['text', 'image']
    });
    const text = testModel({id: 'text', localModel: true, minVramRequirement: 1, overallIntelligence: 8, costsToRun: 3});
    const p = profileOf([vision, text], 'vision');
    expect(p.alternative).toBeNull();
    expect(badgeIds(p)).toContain('pareto-front');
    expect(profileOf([vision, text], 'text').alternative).toBeNull();
  });

  it('ignores VRAM for API models', () => {
    const a = testModel({id: 'a', overallIntelligence: 30, costsToRun: 10});
    const b = testModel({id: 'b', overallIntelligence: 20, costsToRun: 20});
    expect(profileOf([a, b], 'b').alternative?.reason).toBe('intelligence 30 instead of 20, 50% lower run cost');
  });
});

describe('ModelBadgesService metrics', () => {
  it('shows the key numbers with a rank and n/a for a missing value', () => {
    const models = [
      testModel({id: 'a', overallIntelligence: 50, costsToRun: 10, tokensPerSecond: null}),
      testModel({id: 'b', overallIntelligence: 30, costsToRun: 20, tokensPerSecond: 80}),
      testModel({id: 'c', overallIntelligence: 10, costsToRun: 30, tokensPerSecond: 40}),
    ];
    const metrics = profileOf(models, 'b').metrics;
    expect(metrics.map(m => m.id)).toEqual(['intelligence', 'cost', 'speed', 'latency', 'context']);
    expect(metrics.find(m => m.id === 'intelligence')).toEqual(
      {id: 'intelligence', label: 'Intelligence', value: 30, text: '30', rank: 0.5});
    expect(metrics.find(m => m.id === 'speed')!.rank).toBe(1);
    const missing = profileOf(models, 'a').metrics.find(m => m.id === 'speed')!;
    expect([missing.text, missing.rank]).toEqual(['n/a', null]);
  });

  it('shows VRAM instead of context for a local model', () => {
    const p = profileOf([testModel({id: 'l', localModel: true, minVramRequirement: 24})], 'l');
    expect(p.metrics.at(-1)).toEqual({id: 'vram', label: 'VRAM', value: 24, text: '24 GB', rank: null});
  });
});

describe('ModelBadgesService neutral badges', () => {
  it('marks only a model without reasoning, and shows no Local or API badge', () => {
    const models = [testModel({id: 'think'}), testModel({id: 'plain', reasoning: false, localModel: true})];
    expect(badgeIds(profileOf(models, 'think'))).not.toContain('reasoning');
    expect(badgeIds(profileOf(models, 'plain'))).toContain('no-reasoning');
    for (const id of ['local', 'api', 'reasoning']) {
      expect(badgeIds(profileOf(models, 'plain'))).not.toContain(id);
    }
  });

  it('gives Recently released only to the newest 20% of the peer group', () => {
    const now = new Date();
    const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString().slice(0, 10);
    const models = [5, 10, 20, 30, 40, 50].map((d, i) => testModel({id: `r${i}`, releaseDate: daysAgo(d)}));
    const fresh = profilesOf(models).filter(p => badgeIds(p).includes('fresh')).map(p => p.model.id);
    expect(fresh).toEqual(['r0', 'r1']);
  });
});
