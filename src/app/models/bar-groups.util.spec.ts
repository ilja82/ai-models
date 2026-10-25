import {effortLines, groupBars, highlightColors, modelIdOf} from './bar-groups.util';
import {testModel} from '../../testing/model-fixture';

const lvl = (effort: string) => ({
  effort, overallIntelligence: 0, costsToRun: 0, tokensPerRun: null, inputTokensPerRun: null, outputTokensPerRun: null,
  cacheHitRate: null, tokensPerSecond: null, inputProcessingTime: null, thinkingTime: null, outputTime: null,
});
const efforts = [lvl('low'), lvl('medium'), lvl('high')];

describe('groupBars', () => {
  const bars = [
    testModel({id: 'a', effort: 'high', efforts, overallIntelligence: 50}),
    testModel({id: 'b', overallIntelligence: 55}),
    testModel({id: 'a@low', effort: 'low', efforts, overallIntelligence: 60}),
    testModel({id: 'a@medium', effort: 'medium', efforts, overallIntelligence: 20}),
  ];
  const ids = (list: { id: string }[]) => list.map(m => m.id);

  it('puts the levels of a model side by side from the best value and ranks the group by it', () => {
    expect(ids(groupBars(bars, m => m.overallIntelligence!, true))).toEqual(['a@low', 'a', 'a@medium', 'b']);
  });

  it('ranks by the lowest value when lower is better', () => {
    expect(ids(groupBars(bars, m => m.overallIntelligence!, false))).toEqual(['a@medium', 'a', 'a@low', 'b']);
  });

  it('keeps the effort order for equal values', () => {
    const tied = [bars[0], {...bars[3], overallIntelligence: 50}, {...bars[2], overallIntelligence: 50}];
    expect(ids(groupBars(tied, m => m.overallIntelligence!, true))).toEqual(['a@low', 'a@medium', 'a']);
  });
});

describe('highlightColors', () => {
  it('dims the bars of every other model', () => {
    const bars = [{id: 'a'}, {id: 'b'}, {id: 'a@low'}];
    const colors = ['rgba(1,2,3,0.75)', 'rgba(1,2,3,0.75)', 'rgba(1,2,3,0.4)'];
    expect(highlightColors(colors, bars, 'a')).toEqual(['rgba(1,2,3,0.75)', 'rgba(1,2,3,0.12)', 'rgba(1,2,3,0.4)']);
    expect(highlightColors(colors, bars, null)).toBe(colors);
    expect(modelIdOf({id: 'c@x'})).toBe('c');
  });
});

describe('effortLines', () => {
  const bars = [
    testModel({id: 'a@high', effort: 'high', efforts}),
    testModel({id: 'b'}),
    testModel({id: 'a@low', effort: 'low', efforts}),
    testModel({id: 'a', effort: 'medium', efforts}),
  ];

  it('joins the bars of the hovered model in effort order without grouping', () => {
    expect(effortLines(bars, false, 'a')).toEqual([{modelId: 'a', indexes: [2, 3, 0]}]);
    expect(effortLines(bars, false)).toEqual([]);
    expect(effortLines(bars, false, 'b')).toEqual([]);
  });

  it('keeps the bar order of grouped bars', () => {
    expect(effortLines(bars, true)).toEqual([{modelId: 'a', indexes: [0, 2, 3]}]);
    expect(effortLines(bars, true, 'b')).toEqual([{modelId: 'a', indexes: [0, 2, 3]}]);
  });
});
