import {computeCostsToRun, latencyOf, responseTimeOf} from './ai-model.model';
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
      testModel({tokensPerSecond: null, outputTime: null, costsToRun: null}), 'overall');
    expect(lines).toContain('★ Speed: no data');
    expect(lines).toContain('★ Response time: no data');
    expect(lines).toContain('★ Run cost: no data');
  });
});
