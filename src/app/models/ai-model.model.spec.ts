import {blendedPriceOf, computeCostsToRun, latencyOf, responseTimeOf} from './ai-model.model';
import {testModel} from '../../testing/model-fixture';
import {buildModelTooltipLines} from './tooltip.util';

describe('missing measurements', () => {
  it('gives no run cost without tokens per run', () => {
    expect(computeCostsToRun(10, 1_000_000, null)).toBeNull();
    expect(computeCostsToRun(10, 1_000_000, 2)).toBe(20);
  });

  it('gives no latency or response time if one part is missing', () => {
    expect(latencyOf(testModel())).toBe(3);
    expect(responseTimeOf(testModel())).toBe(6);
    expect(latencyOf(testModel({thinkingTime: null}))).toBeNull();
    expect(responseTimeOf(testModel({outputTime: null}))).toBeNull();
  });

  it('says "no data" in the tooltip', () => {
    const lines = buildModelTooltipLines(
      testModel({tokensPerSecond: null, outputTime: null, costsToRun: null}));
    expect(lines).toContain('★ Speed: no data');
    expect(lines).toContain('★ Response time: no data');
    expect(lines).toContain('★ Run cost: no data');
  });

  it('shows the cache price in the tooltip', () => {
    expect(buildModelTooltipLines(testModel())).toContain('Cache: no cache, input price');
    expect(buildModelTooltipLines(testModel({cacheCosts: 0.1}))).toContain('Cache: $0.100/M tokens');
    expect(buildModelTooltipLines(testModel())).toContain(
      '★ Price: $1.100/M tokens (blended 7:2:1 cache:input:output)');
  });

  it('shows the overall intelligence in the tooltip', () => {
    expect(buildModelTooltipLines(testModel())).toContain('★ Overall Intelligence: 40');
  });
});

describe('blendedPriceOf', () => {
  it('blends cache, input and output price at 7:2:1', () => {
    expect(blendedPriceOf(testModel({inputCosts: 3, outputCosts: 15, cacheCosts: 0.3}))).toBeCloseTo(2.31);
  });

  it('uses the input price for cached tokens without a cache price', () => {
    expect(blendedPriceOf(testModel({inputCosts: 3, outputCosts: 15, cacheCosts: null}))).toBeCloseTo(4.2);
  });

  it('gives a non-reasoning model the same price, because the reasoning weight is 0', () => {
    const m = testModel({inputCosts: 3, outputCosts: 15, cacheCosts: 0.3});
    expect(blendedPriceOf({...m, reasoning: false})).toBeCloseTo(blendedPriceOf(m));
  });
});
