import {parseHash, serializeHash, UrlSnapshot} from './url-sync';

const DEFAULTS: UrlSnapshot = {
  view: 'scatter', barMetric: 'intelligence', plotType: 'price', scatter3dX: 'responseTime',
  scatter3dY: 'costsToRun', scatter3dZ: 'intelligence', showAPI: true, showLocal: false,
  showDeprecated: false, showEfforts: true, logScaleX: true, logScale3d: true, onlyPareto: false,
  inputModalities: [], outputModalities: [],
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

describe('url-sync 3D scatter', () => {
  const view3d: UrlSnapshot = {...DEFAULTS, view: 'scatter3d'};

  it('omits the default axes and the default log scale', () => {
    expect(serializeHash(view3d)).toBe('#/scatter3d');
  });

  it('round-trips the speed axis and the linear scale', () => {
    const hash = serializeHash({...view3d, scatter3dX: 'tokensPerSecond', logScale3d: false});
    expect(hash).toBe('#/scatter3d?x=tokensPerSecond&log=0');
    expect(parseHash(hash)).toEqual({view: 'scatter3d', scatter3dX: 'tokensPerSecond', logScale3d: false});
  });
});

describe('url-sync modalities', () => {
  it('omits the parameters without a filter', () => {
    expect(serializeHash(DEFAULTS)).toBe('#/scatter');
    expect(parseHash('#/scatter')?.inputModalities).toBeUndefined();
  });

  it('round-trips the input and output modalities', () => {
    const hash = serializeHash({...DEFAULTS, view: 'table', inputModalities: ['image', 'audio'], outputModalities: ['embedding']});
    expect(hash).toBe('#/table?in=image&in=audio&out=embedding');
    expect(parseHash(hash)).toEqual({view: 'table', inputModalities: ['image', 'audio'], outputModalities: ['embedding']});
  });

  it('drops unknown names and sorts the names like the filter', () => {
    expect(parseHash('#/table?in=video&in=lorem&in=image&out=pdf')).toEqual({view: 'table', inputModalities: ['image', 'video']});
    expect(parseHash('#/table?in=embedding')).toEqual({view: 'table'});
  });
});

describe('url-sync PDF and rerank', () => {
  it('round-trips PDF input and rerank output', () => {
    const hash = serializeHash({...DEFAULTS, view: 'table', inputModalities: ['pdf'], outputModalities: ['rerank']});
    expect(hash).toBe('#/table?in=pdf&out=rerank');
    expect(parseHash(hash)).toEqual({view: 'table', inputModalities: ['pdf'], outputModalities: ['rerank']});
  });
});
