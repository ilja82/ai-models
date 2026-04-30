import {IntelligenceMetric} from '../models/ai-model.model';
import {AXIS_FIELD_KEYS, AxisField, BAR_METRIC_KEYS, BarMetric, PLOT_TYPE_KEYS, PlotType, VIEW_TABS, ViewTab,} from '../models/view-types';

export interface UrlState {
  view: ViewTab;
  barMetric?: BarMetric;
  plotType?: PlotType;
  scatter3dX?: AxisField;
  scatter3dY?: AxisField;
  scatter3dZ?: AxisField;
  intel?: IntelligenceMetric;
  showAPI?: boolean;
  showLocal?: boolean;
  showDeprecated?: boolean;
  logScaleX?: boolean;
  logScale3d?: boolean;
  showUseful?: boolean;
}

export interface UrlSnapshot {
  view: ViewTab;
  barMetric: BarMetric;
  plotType: PlotType;
  scatter3dX: AxisField;
  scatter3dY: AxisField;
  scatter3dZ: AxisField;
  intel: IntelligenceMetric;
  showAPI: boolean;
  showLocal: boolean;
  showDeprecated: boolean;
  logScaleX: boolean;
  logScale3d: boolean;
  showUseful: boolean;
}

const INTEL_VALUES: readonly IntelligenceMetric[] = ['overall', 'coding', 'agentic'];

export function parseHash(hash: string): UrlState | null {
  if (!hash || hash.length < 2) return null;
  const stripped = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!stripped.startsWith('/')) return null;

  const qIdx = stripped.indexOf('?');
  const path = qIdx === -1 ? stripped.slice(1) : stripped.slice(1, qIdx);
  const query = qIdx === -1 ? '' : stripped.slice(qIdx + 1);

  if (!VIEW_TABS.includes(path as ViewTab)) return null;
  const view = path as ViewTab;
  const out: UrlState = {view};

  const params = new URLSearchParams(query);

  const metric = params.get('metric');
  if (metric) {
    if (view === 'bar' && (BAR_METRIC_KEYS as readonly string[]).includes(metric)) {
      out.barMetric = metric as BarMetric;
    } else if (view === 'scatter' && (PLOT_TYPE_KEYS as readonly string[]).includes(metric)) {
      out.plotType = metric as PlotType;
    }
  }

  if (view === 'scatter3d') {
    const x = params.get('x');
    const y = params.get('y');
    const z = params.get('z');
    if (x && (AXIS_FIELD_KEYS as readonly string[]).includes(x)) out.scatter3dX = x as AxisField;
    if (y && (AXIS_FIELD_KEYS as readonly string[]).includes(y)) out.scatter3dY = y as AxisField;
    if (z && (AXIS_FIELD_KEYS as readonly string[]).includes(z)) out.scatter3dZ = z as AxisField;
  }

  const intel = params.get('intel');
  if (intel && (INTEL_VALUES as readonly string[]).includes(intel)) {
    out.intel = intel as IntelligenceMetric;
  }

  const avail = params.get('avail');
  if (avail === 'api') {
    out.showAPI = true;
    out.showLocal = false;
  } else if (avail === 'local') {
    out.showAPI = false;
    out.showLocal = true;
  } else if (avail === 'both') {
    out.showAPI = true;
    out.showLocal = true;
  } else if (avail === 'none') {
    out.showAPI = false;
    out.showLocal = false;
  }

  const deprecated = params.get('deprecated');
  if (deprecated === '1') out.showDeprecated = true;
  else if (deprecated === '0') out.showDeprecated = false;

  const log = params.get('log');
  if (log === '1' || log === '0') {
    const v = log === '1';
    if (view === 'scatter3d') out.logScale3d = v;
    else if (view === 'scatter') out.logScaleX = v;
  }

  const pareto = params.get('pareto');
  if (pareto === '1') out.showUseful = true;
  else if (pareto === '0') out.showUseful = false;

  return out;
}

export function serializeHash(s: UrlSnapshot): string {
  const params = new URLSearchParams();

  if (s.view === 'bar' && s.barMetric !== 'intelligence') params.set('metric', s.barMetric);
  if (s.view === 'scatter' && s.plotType !== 'cost') params.set('metric', s.plotType);
  if (s.view === 'scatter3d') {
    if (s.scatter3dX !== 'tokensPerSecond') params.set('x', s.scatter3dX);
    if (s.scatter3dY !== 'costsToRun') params.set('y', s.scatter3dY);
    if (s.scatter3dZ !== 'intelligence') params.set('z', s.scatter3dZ);
  }

  if (s.intel !== 'overall') params.set('intel', s.intel);

  // availability defaults: showAPI=true, showLocal=false → omit
  if (!(s.showAPI && !s.showLocal)) {
    let avail = 'none';
    if (!s.showAPI && s.showLocal) avail = 'local';
    else if (s.showAPI && s.showLocal) avail = 'both';
    params.set('avail', avail);
  }

  if (s.showDeprecated) params.set('deprecated', '1');

  // log default: scatter true, scatter3d false
  if (s.view === 'scatter' && !s.logScaleX) params.set('log', '0');
  if (s.view === 'scatter3d' && s.logScale3d) params.set('log', '1');

  if (!s.showUseful) params.set('pareto', '0');

  const q = params.toString();
  return q ? `#/${s.view}?${q}` : `#/${s.view}`;
}
