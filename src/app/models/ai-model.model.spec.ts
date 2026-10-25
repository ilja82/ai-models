import {
  blendedPriceOf,
  byIntelligenceDesc,
  costPerRequestOf,
  effectiveCutoffDate,
  hasModalities,
  INPUT_MODALITIES,
  latencyOf,
  OUTPUT_MODALITIES,
  PRICE_BLEND,
  priceBlendLabel,
  releaseTimeOf,
  responseTimeOf,
  runCostOf,
} from './ai-model.model';
import {testModel} from '../../testing/model-fixture';
import {buildModelTooltipLines, formatUsd, formatUsdTick} from './tooltip.util';
import {AI_MODELS} from './ai-models.data';

const BLEND_7_2_1 = {cache: 7, input: 2, reasoning: 0, output: 1};

describe('runCostOf', () => {
  const prices = {inputCosts: 3, outputCosts: 15, cacheCosts: 0.3};
  const tokens = {inputTokensPerRun: 100, outputTokensPerRun: 10, cacheHitRate: 0.9};

  it('prices cache hits at the cache price, other input at the input price and output at the output price', () => {
    expect(runCostOf(prices, tokens)).toBeCloseTo(100 * (0.9 * 0.3 + 0.1 * 3) + 10 * 15);
  });

  it('prices all input at the input price without a cache price or without a cache hit rate', () => {
    expect(runCostOf({...prices, cacheCosts: null}, tokens)).toBeCloseTo(450);
    expect(runCostOf(prices, {...tokens, cacheHitRate: null})).toBeCloseTo(450);
  });

  it('gives no run cost without the token split', () => {
    expect(runCostOf(prices, {...tokens, inputTokensPerRun: null})).toBeNull();
    expect(runCostOf(prices, {...tokens, outputTokensPerRun: null})).toBeNull();
  });

  it('gives each data entry with a token split its run cost in USD', () => {
    for (const m of AI_MODELS) {
      expect(m.costsToRun).toEqual(runCostOf(m, m));
      if (m.tokensPerRun !== null) expect(m.costsToRun).not.toBeNull();
    }
  });
});

describe('costPerRequestOf', () => {
  it('divides the spend by the requests, and gives null without requests', () => {
    expect(costPerRequestOf({totalSpend: 12, totalRequests: 400})).toBeCloseTo(0.03);
    expect(costPerRequestOf({totalSpend: 12, totalRequests: 0})).toBeNull();
  });
});

describe('missing measurements', () => {
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
      `★ Price: $${blendedPriceOf(testModel())!.toFixed(3)}/M tokens (blended by usage: ${priceBlendLabel()})`);
  });

  it('shows the run cost, the token split and the cost per request in the tooltip', () => {
    const m = testModel({costsToRun: 207, cacheHitRate: 0.9, totalSpend: 12, totalRequests: 400});
    const lines = buildModelTooltipLines(m);
    expect(lines).toContain('★ Run cost: $207.00 per index run');
    expect(lines).toContain('Tokens per run: 100M (in: 90M, out: 10M, 90% cache hits)');
    expect(lines).toContain('Cost per request: $0.03 (LiteLLM, 400 requests)');
    expect(buildModelTooltipLines(testModel()).some(l => l.startsWith('Cost per request'))).toBe(false);
  });

  it('marks estimated token counts in the tooltip', () => {
    const lines = buildModelTooltipLines(testModel({tokensPerRunEstimated: true}));
    expect(lines).toContain('★ Run cost: $10.00 per index run (estimated tokens)');
    expect(lines).toContain('Tokens per run: 100M (in: 90M, out: 10M) estimated');
  });

  it('formats small USD values with two significant digits', () => {
    expect(formatUsd(0.000234)).toBe('$0.00023');
    expect(formatUsd(0.0135)).toBe('$0.01');
    expect(formatUsd(12.345)).toBe('$12.35');
    expect(formatUsd(0)).toBe('$0.00');
  });

  it('shows the overall intelligence in the tooltip', () => {
    expect(buildModelTooltipLines(testModel())).toContain('★ Overall Intelligence: 40');
  });
});

describe('blendedPriceOf', () => {
  it('blends cache, input and output price by the weights', () => {
    expect(blendedPriceOf(testModel({inputCosts: 3, outputCosts: 15, cacheCosts: 0.3}), BLEND_7_2_1)).toBeCloseTo(2.31);
  });

  it('uses the input price for cached tokens without a cache price', () => {
    expect(blendedPriceOf(testModel({inputCosts: 3, outputCosts: 15, cacheCosts: null}), BLEND_7_2_1)).toBeCloseTo(4.2);
  });

  it('uses the usage blend by default', () => {
    const m = testModel({inputCosts: 3, outputCosts: 15, cacheCosts: 0.3});
    expect(blendedPriceOf(m)).toBeCloseTo(blendedPriceOf(m, PRICE_BLEND)!);
    expect(priceBlendLabel(BLEND_7_2_1)).toBe('7% cache, 2% input, 1% output');
  });

  it('gives a non-reasoning model the same price, because the reasoning weight is 0', () => {
    const m = testModel({inputCosts: 3, outputCosts: 15, cacheCosts: 0.3});
    expect(blendedPriceOf({...m, reasoning: false})).toBeCloseTo(blendedPriceOf(m)!);
  });
});

describe('hasModalities', () => {
  const vision = testModel({inputModalities: ['text', 'image'], outputModalities: ['text']});

  it('needs every asked input and output modality', () => {
    expect(hasModalities(vision, ['image'], [])).toBe(true);
    expect(hasModalities(vision, ['image', 'audio'], [])).toBe(false);
    expect(hasModalities(vision, [], ['text'])).toBe(true);
    expect(hasModalities(vision, ['text'], ['embedding'])).toBe(false);
  });

  it('matches every model without a filter', () => {
    expect(hasModalities(vision, [], [])).toBe(true);
  });
});

describe('modalities of the data entries', () => {
  it('gives each entry known input and output modalities in filter order', () => {
    for (const m of AI_MODELS) {
      expect(m.inputModalities.length, m.id).toBeGreaterThan(0);
      expect(m.outputModalities.length, m.id).toBeGreaterThan(0);
      expect(m.inputModalities, m.id).toEqual(INPUT_MODALITIES.filter(x => m.inputModalities.includes(x)));
      expect(m.outputModalities, m.id).toEqual(OUTPUT_MODALITIES.filter(x => m.outputModalities.includes(x)));
    }
  });
});

describe('tooltip modalities', () => {
  it('names the input and output modalities', () => {
    const lines = buildModelTooltipLines(testModel({inputModalities: ['text', 'image'], outputModalities: ['text']}));
    expect(lines).toContain('Modalities: Text, Image → Text');
  });
});

describe('models without benchmark or price', () => {
  const embed = testModel({
    overallIntelligence: null, inputCosts: 0.1, outputCosts: null, maxOutputTokens: null, contextWindow: null,
    maxInputTokens: null, releaseDate: null, outputModalities: ['embedding'],
  });

  it('gives no blended price and no run cost without both prices', () => {
    expect(blendedPriceOf(embed)).toBeNull();
    expect(blendedPriceOf({...embed, inputCosts: null, outputCosts: 2})).toBeNull();
    expect(runCostOf(embed, {inputTokensPerRun: 1, outputTokensPerRun: 1, cacheHitRate: null})).toBeNull();
  });

  it('sorts models without a score last', () => {
    const ids = [embed, testModel({id: 'a', overallIntelligence: 10}), testModel({id: 'b', overallIntelligence: 30})]
      .sort(byIntelligenceDesc).map(m => m.id);
    expect(ids).toEqual(['b', 'a', 'lorem-1']);
  });

  it('has no release time and no estimated cutoff without a release date', () => {
    expect(releaseTimeOf(embed)).toBeNull();
    expect(effectiveCutoffDate(embed)).toBe('unknown');
  });

  it('names each missing value in the tooltip', () => {
    const lines = buildModelTooltipLines(embed);
    for (const line of ['★ Overall Intelligence: no data', '★ Price: no data', '★ Release: no data', 'Input: $0.100/M tokens',
      'Output: no data', 'Context: no data', 'Max Out: no data', 'Modalities: Text → Embedding']) {
      expect(lines).toContain(line);
    }
    expect(buildModelTooltipLines({...embed, contextWindow: 512})).toContain('Context: 512 tokens');
  });
});

describe('data entries without token output', () => {
  it('give embedding and rerank models no output limit and no output price', () => {
    const tokenFree = AI_MODELS.filter(m => m.outputModalities.every(x => x === 'embedding' || x === 'rerank'));
    expect(tokenFree.length).toBeGreaterThan(0);
    for (const m of tokenFree) {
      expect(m.maxOutputTokens, m.id).toBeNull();
      expect(m.outputCosts, m.id).toBeNull();
      expect(m.overallIntelligence, m.id).toBeNull();
    }
  });
});

describe('formatUsdTick', () => {
  it('gives each power-of-two tick of the log price axis its own label', () => {
    const labels = [3, 2, 1, 0, -1, -2, -3, -4, -8, -9, -10].map(e => formatUsdTick(2 ** e));
    expect(labels).toEqual(['$8.00', '$4.00', '$2.00', '$1.00', '$0.50', '$0.25', '$0.125', '$0.0625', '$0.00391',
      '$0.00195', '$0.000977']);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('shows whole dollars from $100 and $0.00 for zero', () => {
    expect(formatUsdTick(4096)).toBe('$4096');
    expect(formatUsdTick(0)).toBe('$0.00');
  });
});
