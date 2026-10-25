import {EffortLevel} from './ai-model.model';
import {estimatedTokenRatio, fitTokenFactors, NO_TOKEN_FACTORS} from './token-factors.util';
import {testModel} from '../../testing/model-fixture';

function level(effort: string, tokensPerRun: number | null): EffortLevel {
  return {
    effort, overallIntelligence: 40, tokensPerRun, inputTokensPerRun: null, outputTokensPerRun: null, cacheHitRate: null,
    tokensPerSecond: 50,
    inputProcessingTime: 1, thinkingTime: 2, outputTime: 3, costsToRun: 1,
  };
}

function withTokens(id: string, tokens: Record<string, number | null>, localModel = false) {
  return testModel({id, localModel, efforts: Object.entries(tokens).map(([e, t]) => level(e, t))});
}

describe('fitTokenFactors', () => {
  it('estimates the ratio of two effort names from the models that measure both', () => {
    const factors = fitTokenFactors([
      withTokens('a', {low: 100, high: 400}),
      withTokens('b', {low: 50, high: 200}),
    ]);
    expect(estimatedTokenRatio(factors, 'high', 'low')).toBeCloseTo(0.25);
    expect(estimatedTokenRatio(factors, 'low', 'high')).toBeCloseTo(4);
  });

  it('chains two effort names over a third one', () => {
    const factors = fitTokenFactors([
      withTokens('a', {low: 100, high: 400}),
      withTokens('b', {high: 100, max: 300}),
    ]);
    expect(estimatedTokenRatio(factors, 'low', 'max')).toBeCloseTo(12);
  });

  it('ignores one outlier model by the median', () => {
    const factors = fitTokenFactors([
      withTokens('a', {low: 100, high: 400}),
      withTokens('b', {low: 100, high: 400}),
      withTokens('c', {low: 400, high: 100}),
    ]);
    expect(estimatedTokenRatio(factors, 'high', 'low')).toBeCloseTo(0.25);
  });

  it('leaves out local models, models with one measured level and unmeasured levels', () => {
    const factors = fitTokenFactors([
      withTokens('a', {low: 100, high: 400}),
      withTokens('a-local', {low: 100, high: 100}, true),
      withTokens('b', {reasoning: 500, high: null}),
      withTokens('c', {high: 7}),
      withTokens('d', {high: 9}),
      withTokens('e', {low: 7}),
      withTokens('f', {low: 9}),
    ]);
    expect(estimatedTokenRatio(factors, 'high', 'low')).toBeCloseTo(0.25);
    expect(estimatedTokenRatio(factors, 'high', 'reasoning')).toBeNull();
  });

  it('returns null for effort names that no model links', () => {
    const factors = fitTokenFactors([
      withTokens('a', {low: 100, high: 400}),
      withTokens('b', {'non-reasoning': 100, reasoning: 300}),
    ]);
    expect(estimatedTokenRatio(factors, 'high', 'reasoning')).toBeNull();
    expect(estimatedTokenRatio(factors, 'non-reasoning', 'reasoning')).toBeCloseTo(3);
    expect(estimatedTokenRatio(NO_TOKEN_FACTORS, 'high', 'low')).toBeNull();
  });
});
