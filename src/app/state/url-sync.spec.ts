import {parseHash, serializeHash, UrlSnapshot} from './url-sync';

const DEFAULTS: UrlSnapshot = {
  view: 'scatter', barMetric: 'intelligence', plotType: 'price', scatter3dX: 'tokensPerSecond',
  scatter3dY: 'costsToRun', scatter3dZ: 'intelligence', showAPI: true, showLocal: false,
  showDeprecated: false, showEfforts: true, logScaleX: true, logScale3d: false, onlyPareto: false,
};

describe('url-sync effort levels', () => {
  it('omits the parameter by default', () => {
    expect(serializeHash(DEFAULTS)).toBe('#/scatter');
    expect(parseHash('#/scatter')?.showEfforts).toBeUndefined();
  });

  it('round-trips showEfforts', () => {
    const hash = serializeHash({...DEFAULTS, showEfforts: false});
    expect(hash).toBe('#/scatter?efforts=0');
    expect(parseHash(hash)?.showEfforts).toBe(false);
    expect(parseHash('#/scatter?efforts=1')?.showEfforts).toBe(true);
  });
});

describe('url-sync plot types', () => {
  it('omits the default price plot and round-trips the cost plot', () => {
    expect(serializeHash(DEFAULTS)).toBe('#/scatter');
    expect(serializeHash({...DEFAULTS, plotType: 'speed'})).toBe('#/scatter?metric=speed');
    expect(serializeHash({...DEFAULTS, plotType: 'cost'})).toBe('#/scatter?metric=cost');
    expect(parseHash('#/scatter?metric=cost')).toEqual({view: 'scatter', plotType: 'cost'});
  });
});

describe('url-sync intelligence', () => {
  it('ignores the removed intel parameter and intelligence axes of old links', () => {
    const parsed = parseHash('#/scatter3d?intel=coding&x=codingIntelligence&z=agenticIntelligence');
    expect(parsed).toEqual({view: 'scatter3d'});
  });
});

describe('url-sync show only Pareto best', () => {
  it('omits the parameter by default and round-trips the filter', () => {
    expect(serializeHash(DEFAULTS)).toBe('#/scatter');
    const hash = serializeHash({...DEFAULTS, onlyPareto: true});
    expect(hash).toBe('#/scatter?pareto=1');
    expect(parseHash(hash)?.onlyPareto).toBe(true);
    expect(parseHash('#/scatter?pareto=0')?.onlyPareto).toBe(false);
  });
});
