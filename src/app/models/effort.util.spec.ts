import {AiModel, EffortLevel} from './ai-model.model';
import {effortPoints, effortResponseTime, shortEffortLabel} from './effort.util';
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
  it('maps each level to cost and intelligence and marks the current level', () => {
    const m = model([level('low', {overallIntelligence: 30, costsToRun: 2}), level('high', {costsToRun: 9})]);
    const points = effortPoints(m, 'cost');
    expect(points.map(p => [p.effort, p.x, p.y, p.current])).toEqual([
      ['low', 2, 30, false],
      ['high', 9, 40, true],
    ]);
  });

  it('skips a level without a value on the x axis', () => {
    const m = model([level('low', {costsToRun: null}), level('high')]);
    expect(effortPoints(m, 'cost').map(p => p.effort)).toEqual(['high']);
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
    expect(effortPoints(model([], null), 'cost')).toEqual([]);
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
