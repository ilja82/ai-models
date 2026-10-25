import {AiModel, EffortLevel} from './ai-model.model';
import {effortPoints, effortResponseTime, effortSeries, effortVariant, otherEffortVariants, shortEffortLabel} from './effort.util';
import {testModel} from '../../testing/model-fixture';

function level(effort: string, overrides: Partial<EffortLevel> = {}): EffortLevel {
  return {
    effort,
    overallIntelligence: 40,
    tokensPerRun: 100,
    tokensPerSecond: 50,
    inputProcessingTime: 1,
    thinkingTime: 2,
    outputTime: 3,
    costsToRun: 10,
    ...overrides,
  };
}

function model(efforts: EffortLevel[], effort: string | null = 'high'): AiModel {
  return testModel({effort, efforts});
}

describe('effortPoints', () => {
  it('maps each level to the model price and the level intelligence and marks the current level', () => {
    const m = model([level('low', {overallIntelligence: 30}), level('high')]);
    const points = effortPoints(m, 'price');
    expect(points.map(p => [p.effort, p.x, p.y, p.current])).toEqual([
      ['low', 1.1, 30, false],
      ['high', 1.1, 40, true],
    ]);
  });

  it('skips a level without a value on the x axis', () => {
    const m = model([level('low', {tokensPerSecond: null}), level('high')]);
    expect(effortPoints(m, 'speed').map(p => p.effort)).toEqual(['high']);
  });

  it('uses the summed response time and the level speed', () => {
    const m = model([level('high', {tokensPerSecond: 80})]);
    expect(effortPoints(m, 'responseVsSpeed')[0]).toMatchObject({x: 6, y: 80});
    expect(effortPoints(model([level('high', {thinkingTime: null})]), 'responseVsIntel')).toEqual([]);
  });

  it('uses the level speed, not the model speed', () => {
    const m = model([level('low', {tokensPerSecond: 80}), level('high')]);
    expect(effortPoints(m, 'speed').map(p => p.x)).toEqual([80, 50]);
  });

  it('keeps the model value for axes that do not depend on the effort', () => {
    const m = model([level('low'), level('max')]);
    expect(effortPoints(m, 'context').map(p => p.x)).toEqual([200_000, 200_000]);
  });

  it('returns nothing for a model without effort levels', () => {
    expect(effortPoints(model([], null), 'price')).toEqual([]);
  });
});

describe('effort variants', () => {
  it('takes the level values and keeps the model values', () => {
    const v = effortVariant(model([]), level('low', {overallIntelligence: 30, tokensPerSecond: 80, costsToRun: 4}));
    expect(v).toMatchObject({
      id: 'lorem-1@low', effort: 'low', overallIntelligence: 30, tokensPerSecond: 80, costsToRun: 4, inputCosts: 1,
    });
  });

  it('leaves out the current level, which the model itself shows', () => {
    const m = model([level('low'), level('high'), level('max')]);
    expect(otherEffortVariants(m).map(v => v.id)).toEqual(['lorem-1@low', 'lorem-1@max']);
    const series = effortSeries(m);
    expect(series.map(v => v.id)).toEqual(['lorem-1@low', 'lorem-1', 'lorem-1@max']);
    expect(series[1]).toBe(m);
  });
});

describe('effort labels', () => {
  it('shortens long effort names', () => {
    expect(['non-reasoning', 'medium', 'xhigh'].map(shortEffortLabel)).toEqual(['off', 'med', 'xhigh']);
  });

  it('returns null when one time is missing', () => {
    expect(effortResponseTime(level('high', {outputTime: null}))).toBeNull();
    expect(effortResponseTime(level('high'))).toBe(6);
  });
});
