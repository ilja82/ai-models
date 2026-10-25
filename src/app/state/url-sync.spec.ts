import {parseHash, serializeHash, UrlSnapshot} from './url-sync';

const DEFAULTS: UrlSnapshot = {
  view: 'scatter', barMetric: 'intelligence', plotType: 'cost', scatter3dX: 'tokensPerSecond',
  scatter3dY: 'costsToRun', scatter3dZ: 'intelligence', showAPI: true, showLocal: false,
  showDeprecated: false, showEfforts: false, logScaleX: true, logScale3d: false, showUseful: true,
};

describe('url-sync effort levels', () => {
  it('omits the parameter by default', () => {
    expect(serializeHash(DEFAULTS)).toBe('#/scatter');
    expect(parseHash('#/scatter')?.showEfforts).toBeUndefined();
  });

  it('round-trips showEfforts', () => {
    const hash = serializeHash({...DEFAULTS, showEfforts: true});
    expect(hash).toBe('#/scatter?efforts=1');
    expect(parseHash(hash)?.showEfforts).toBe(true);
    expect(parseHash('#/scatter?efforts=0')?.showEfforts).toBe(false);
  });
});

describe('url-sync intelligence', () => {
  it('ignores the removed intel parameter and intelligence axes of old links', () => {
    const parsed = parseHash('#/scatter3d?intel=coding&x=codingIntelligence&z=agenticIntelligence');
    expect(parsed).toEqual({view: 'scatter3d'});
  });
});
