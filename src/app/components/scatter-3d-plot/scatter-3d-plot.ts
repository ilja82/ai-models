import {Component, computed, effect, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild} from '@angular/core';
import {AppState} from '../../state/app.state';
import {ThemeState} from '../../state/theme.state';
import {AiModel, IntelligenceMetric} from '../../models/ai-model.model';
import {buildModelTooltipLines} from '../../models/tooltip.util';
import {getPlotColors} from '../../models/plot-colors';
import {AxisField} from '../../models/view-types';

type PlotlyModule = typeof import('plotly.js-dist-min');

interface AxisDef {
  key: AxisField;
  label: string;
  /** true = larger value better (e.g. intelligence, speed); false = smaller better (cost, latency) */
  higherIsBetter: boolean;
  /** suggested log scale (cost, context window) */
  logCandidate: boolean;
  /** value extractor; metric used only when key === 'intelligence' */
  get: (m: AiModel, metric: IntelligenceMetric) => number;
  /** axis tick formatter */
  format: (v: number) => string;
}

const AXIS_DEFS: AxisDef[] = [
  {
    key: 'costsToRun', label: 'Total Usage Cost ($)', higherIsBetter: false, logCandidate: true,
    get: m => m.costsToRun === 0 ? 0.001 : m.costsToRun, format: v => `$${v.toFixed(2)}`
  },
  {
    key: 'inputCosts', label: 'Input Cost ($/M)', higherIsBetter: false, logCandidate: true,
    get: m => m.inputCosts === 0 ? 0.001 : m.inputCosts, format: v => `$${v.toFixed(3)}`
  },
  {
    key: 'outputCosts', label: 'Output Cost ($/M)', higherIsBetter: false, logCandidate: true,
    get: m => m.outputCosts === 0 ? 0.001 : m.outputCosts, format: v => `$${v.toFixed(3)}`
  },
  {
    key: 'contextWindow', label: 'Context Window (tokens)', higherIsBetter: true, logCandidate: true,
    get: m => m.contextWindow, format: v => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`
  },
  {
    key: 'maxInputTokens', label: 'Max Input Tokens', higherIsBetter: true, logCandidate: true,
    get: m => m.maxInputTokens, format: v => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`
  },
  {
    key: 'maxOutputTokens', label: 'Max Output Tokens', higherIsBetter: true, logCandidate: true,
    get: m => m.maxOutputTokens, format: v => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`
  },
  {
    key: 'minVramRequirement', label: 'Min VRAM (GB)', higherIsBetter: false, logCandidate: false,
    get: m => m.minVramRequirement, format: v => `${v}GB`
  },
  {
    key: 'intelligence', label: 'Intelligence (current metric)', higherIsBetter: true, logCandidate: false,
    get: (m, metric) => metric === 'coding' ? m.codingIntelligence : metric === 'agentic' ? m.agenticIntelligence : m.overallIntelligence,
    format: v => `${v}`
  },
  {
    key: 'overallIntelligence', label: 'Overall Intelligence', higherIsBetter: true, logCandidate: false,
    get: m => m.overallIntelligence, format: v => `${v}`
  },
  {
    key: 'codingIntelligence', label: 'Coding Intelligence', higherIsBetter: true, logCandidate: false,
    get: m => m.codingIntelligence, format: v => `${v}`
  },
  {
    key: 'agenticIntelligence', label: 'Agentic Intelligence', higherIsBetter: true, logCandidate: false,
    get: m => m.agenticIntelligence, format: v => `${v}`
  },
  {
    key: 'tokensPerSecond', label: 'Speed (tok/s)', higherIsBetter: true, logCandidate: false,
    get: m => m.tokensPerSecond, format: v => `${v.toFixed(0)}`
  },
  {
    key: 'inputProcessingTime', label: 'Input Processing (s)', higherIsBetter: false, logCandidate: false,
    get: m => m.inputProcessingTime, format: v => `${v.toFixed(1)}s`
  },
  {
    key: 'thinkingTime', label: 'Thinking Time (s)', higherIsBetter: false, logCandidate: false,
    get: m => m.thinkingTime, format: v => `${v.toFixed(1)}s`
  },
  {
    key: 'outputTime', label: 'Output Time (s)', higherIsBetter: false, logCandidate: false,
    get: m => m.outputTime, format: v => `${v.toFixed(1)}s`
  },
  {
    key: 'responseTime', label: 'Response Time (s)', higherIsBetter: false, logCandidate: false,
    get: m => m.inputProcessingTime + m.thinkingTime + m.outputTime, format: v => `${v.toFixed(1)}s`
  },
  {
    key: 'releaseDate', label: 'Release Date', higherIsBetter: true, logCandidate: false,
    get: m => new Date(m.releaseDate).getTime(),
    format: v => new Date(v).toLocaleDateString('en-US', {month: 'short', year: 'numeric'})
  },
];

interface AxisExtent {
  min: number;
  max: number;
  mid: number;
  log: boolean;
}

@Component({
  selector: 'app-scatter-3d-plot',
  standalone: true,
  templateUrl: './scatter-3d-plot.html',
  styleUrl: './scatter-3d-plot.scss',
})
export class Scatter3dPlotComponent implements OnInit, OnDestroy {
  @ViewChild('plot', {static: true}) plotRef!: ElementRef<HTMLDivElement>;

  readonly state = inject(AppState);
  readonly themeState = inject(ThemeState);
  readonly axisDefs = AXIS_DEFS;

  readonly loading = signal(true);
  readonly errorMsg = signal<string | null>(null);

  private plotly: PlotlyModule | null = null;
  private resizeObserver?: ResizeObserver;

  private readonly defOf = (key: AxisField): AxisDef => AXIS_DEFS.find(a => a.key === key)!;

  private isLogAxis(def: AxisDef): boolean {
    return this.state.logScale3d() && def.logCandidate;
  }

  private toPlotVal(v: number, log: boolean): number {
    if (!log) return v;
    return v > 0 ? Math.log2(v) : Math.log2(0.001);
  }

  /** Pareto-useful model IDs for the currently selected 3 axes. */
  readonly useful3d = computed<Set<string>>(() => {
    const models = this.state.filteredModels().filter(m => !m.deprecated);
    const metric = this.state.intelligenceMetric();
    const axes = [this.defOf(this.state.scatter3dX()), this.defOf(this.state.scatter3dY()), this.defOf(this.state.scatter3dZ())];

    const points = models.map(m => ({id: m.id, vals: axes.map(a => a.get(m, metric))}));
    const useful = new Set<string>();

    for (const p of points) {
      let dominated = false;
      for (const q of points) {
        if (q.id === p.id) continue;
        let allAtLeast = true;
        let strictlyBetter = false;
        for (let i = 0; i < axes.length; i++) {
          const better = axes[i].higherIsBetter
            ? q.vals[i] >= p.vals[i]
            : q.vals[i] <= p.vals[i];
          const strict = axes[i].higherIsBetter
            ? q.vals[i] > p.vals[i]
            : q.vals[i] < p.vals[i];
          if (!better) {
            allAtLeast = false;
            break;
          }
          if (strict) strictlyBetter = true;
        }
        if (allAtLeast && strictlyBetter) {
          dominated = true;
          break;
        }
      }
      if (!dominated) useful.add(p.id);
    }
    return useful;
  });

  /** Returns a value in [0,1] where 1 = best on this axis. */
  private normalizeToBest(v: number, ext: AxisExtent, higherIsBetter: boolean): number {
    let t: number;
    if (ext.log && v > 0 && ext.min > 0 && ext.max > 0) {
      const lo = Math.log(ext.min);
      const hi = Math.log(ext.max);
      t = hi === lo ? 0.5 : (Math.log(v) - lo) / (hi - lo);
    } else {
      t = ext.max === ext.min ? 0.5 : (v - ext.min) / (ext.max - ext.min);
    }
    t = Math.max(0, Math.min(1, t));
    return higherIsBetter ? t : 1 - t;
  }

  readonly specialMarkers3d = computed<{ axisBestIds: Set<string>; balancedId: string | null }>(() => {
    const models = this.state.filteredModels().filter(m => !m.deprecated);
    if (models.length === 0) return {axisBestIds: new Set(), balancedId: null};
    const metric = this.state.intelligenceMetric();
    const axes = [this.defOf(this.state.scatter3dX()), this.defOf(this.state.scatter3dY()), this.defOf(this.state.scatter3dZ())];

    const axisBestIds = new Set<string>();
    for (const a of axes) {
      let bestModel: AiModel | null = null;
      let bestVal = a.higherIsBetter ? -Infinity : Infinity;
      for (const m of models) {
        const v = a.get(m, metric);
        if (!Number.isFinite(v)) continue;
        if (a.higherIsBetter ? v > bestVal : v < bestVal) {
          bestVal = v;
          bestModel = m;
        }
      }
      if (bestModel) axisBestIds.add(bestModel.id);
    }

    const exts = axes.map(a => this.computeAxisExtent(models, a, metric, false));
    let balancedId: string | null = null;
    if (exts.every(e => e !== null)) {
      let bestDist = Infinity;
      for (const m of models) {
        let sumSq = 0;
        for (let i = 0; i < axes.length; i++) {
          const v = axes[i].get(m, metric);
          const n = this.normalizeToBest(v, exts[i]!, axes[i].higherIsBetter);
          const d = 1 - n;
          sumSq += d * d;
        }
        if (sumSq < bestDist) {
          bestDist = sumSq;
          balancedId = m.id;
        }
      }
    }
    return {axisBestIds, balancedId};
  });

  private computeAxisExtent(models: AiModel[], def: AxisDef, metric: IntelligenceMetric, log: boolean): AxisExtent | null {
    if (models.length === 0) return null;
    const values = models.map(m => def.get(m, metric)).filter(v => Number.isFinite(v));
    if (values.length === 0) return null;
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) return null;

    if (log && min > 0) {
      const pad = 1.05;
      min = min / pad;
      max = max * pad;
      const mid = Math.sqrt(min * max);
      return {min, max, mid, log: true};
    }

    const range = max - min;
    min = min - range * 0.05;
    max = max + range * 0.05;
    return {min, max, mid: (min + max) / 2, log: false};
  }

  private buildCuboid(
    xr: [number, number], yr: [number, number], zr: [number, number],
    color: string, opacity: number, name: string,
  ): any {
    const [x0, x1] = xr, [y0, y1] = yr, [z0, z1] = zr;
    return {
      type: 'mesh3d',
      name,
      x: [x0, x1, x1, x0, x0, x1, x1, x0],
      y: [y0, y0, y1, y1, y0, y0, y1, y1],
      z: [z0, z0, z0, z0, z1, z1, z1, z1],
      i: [0, 0, 4, 4, 0, 0, 3, 3, 0, 0, 1, 1],
      j: [1, 2, 5, 6, 1, 5, 2, 6, 3, 7, 2, 6],
      k: [2, 3, 6, 7, 5, 4, 6, 7, 7, 4, 6, 5],
      color,
      opacity,
      flatshading: true,
      hoverinfo: 'skip',
      showlegend: false,
    };
  }

  readonly traces = computed(() => {
    const models = this.state.filteredModels();
    const metric = this.state.intelligenceMetric();
    const showUseful = this.state.showUsefulModels();
    const useful = this.useful3d();
    const xDef = this.defOf(this.state.scatter3dX());
    const yDef = this.defOf(this.state.scatter3dY());
    const zDef = this.defOf(this.state.scatter3dZ());
    const logScale = this.state.logScale3d();
    const {axisBestIds, balancedId} = this.specialMarkers3d();
    const xLog = this.isLogAxis(xDef);
    const yLog = this.isLogAxis(yDef);
    const zLog = this.isLogAxis(zDef);
    const colors = getPlotColors(this.themeState.theme());

    const groups = {
      deprecated: [] as AiModel[],
      api: [] as AiModel[],
      local: [] as AiModel[],
      useful: [] as AiModel[],
      axisBest: [] as AiModel[],
      balanced: [] as AiModel[],
    };
    for (const m of models) {
      if (m.deprecated) groups.deprecated.push(m);
      else if (m.id === balancedId) groups.balanced.push(m);
      else if (axisBestIds.has(m.id)) groups.axisBest.push(m);
      else if (showUseful && useful.has(m.id)) groups.useful.push(m);
      else if (m.localModel) groups.local.push(m);
      else groups.api.push(m);
    }

    const buildTrace = (items: AiModel[], name: string, color: string, symbol: string, size: number) => ({
      type: 'scatter3d',
      mode: 'markers+text',
      name,
      x: items.map(m => this.toPlotVal(xDef.get(m, metric), xLog)),
      y: items.map(m => this.toPlotVal(yDef.get(m, metric), yLog)),
      z: items.map(m => this.toPlotVal(zDef.get(m, metric), zLog)),
      text: items.map(m => m.publicName),
      textposition: 'top center',
      textfont: {size: 10, color: '#bbb'},
      hovertext: items.map(m => buildModelTooltipLines(m, metric).join('<br>')),
      hoverinfo: 'text',
      marker: {color, size, symbol, line: {color: 'rgba(0,0,0,0.4)', width: 0.5}, opacity: 0.95},
    });

    const allModels = this.state.allModels();
    const xExt = this.computeAxisExtent(allModels, xDef, metric, logScale && xDef.logCandidate);
    const yExt = this.computeAxisExtent(allModels, yDef, metric, logScale && yDef.logCandidate);
    const zExt = this.computeAxisExtent(allModels, zDef, metric, logScale && zDef.logCandidate);

    const regionTraces: any[] = [];
    if (xExt && yExt && zExt) {
      const halfRange = (ext: AxisExtent, attractive: boolean, higherIsBetter: boolean, log: boolean): [number, number] => {
        const pickUpper = higherIsBetter ? attractive : !attractive;
        const r: [number, number] = pickUpper ? [ext.mid, ext.max] : [ext.min, ext.mid];
        return [this.toPlotVal(r[0], log), this.toPlotVal(r[1], log)];
      };
      const centroid = (r: [number, number]) => (r[0] + r[1]) / 2;

      const attrX = halfRange(xExt, true, xDef.higherIsBetter, xLog);
      const attrY = halfRange(yExt, true, yDef.higherIsBetter, yLog);
      const attrZ = halfRange(zExt, true, zDef.higherIsBetter, zLog);
      const unX = halfRange(xExt, false, xDef.higherIsBetter, xLog);
      const unY = halfRange(yExt, false, yDef.higherIsBetter, yLog);
      const unZ = halfRange(zExt, false, zDef.higherIsBetter, zLog);

      regionTraces.push(
        this.buildCuboid(attrX, attrY, attrZ, colors.attractiveCuboid, 0.35, 'Most attractive'),
        this.buildCuboid(unX, unY, unZ, colors.unattractiveCuboid, 0.22, 'Least attractive'),
        {
          type: 'scatter3d',
          mode: 'text',
          name: 'Region labels',
          x: [centroid(attrX), centroid(unX)],
          y: [centroid(attrY), centroid(unY)],
          z: [centroid(attrZ), centroid(unZ)],
          text: ['Most attractive', 'Least attractive'],
          textfont: {size: 12, color: [colors.attractiveLabel, colors.unattractiveLabel]},
          hoverinfo: 'skip',
          showlegend: false,
        },
      );
    }

    return [
      ...regionTraces,
      buildTrace(groups.deprecated, 'Deprecated', colors.deprecated, 'circle', 4),
      buildTrace(groups.api, 'API', colors.api, 'circle', 5),
      buildTrace(groups.local, 'Local', colors.local, 'diamond', 5),
      buildTrace(groups.useful, 'Pareto efficient', colors.useful, 'circle', 8),
      buildTrace(groups.axisBest, 'Best per axis', colors.axisBest, 'diamond-open', 10),
      buildTrace(groups.balanced, 'Best balanced', colors.balanced, 'square', 10),
    ];
  });

  readonly layout = computed(() => {
    const xDef = this.defOf(this.state.scatter3dX());
    const yDef = this.defOf(this.state.scatter3dY());
    const zDef = this.defOf(this.state.scatter3dZ());
    const models = this.state.allModels();
    const metric = this.state.intelligenceMetric();

    const axisCfg = (def: AxisDef): any => {
      const base: any = {
        title: {text: def.label, font: {color: '#aaa', size: 12}},
        type: 'linear',
        gridcolor: 'rgba(128,128,128,0.2)',
        zerolinecolor: 'rgba(128,128,128,0.35)',
        backgroundcolor: 'rgba(0,0,0,0)',
        tickfont: {color: '#888', size: 10},
      };
      if (!this.isLogAxis(def)) {
        const ext = this.computeAxisExtent(models, def, metric, false);
        if (!ext) {
          base.autorange = def.higherIsBetter ? true : 'reversed';
          return base;
        }
        base.range = def.higherIsBetter ? [ext.min, ext.max] : [ext.max, ext.min];
        base.autorange = false;
        return base;
      }
      const ext = this.computeAxisExtent(models, def, metric, true);
      if (!ext || ext.min <= 0) {
        base.autorange = def.higherIsBetter ? true : 'reversed';
        return base;
      }
      const minL = Math.log2(ext.min);
      const maxL = Math.log2(ext.max);
      const lo = Math.floor(minL);
      const hi = Math.ceil(maxL);
      const tickvals: number[] = [];
      const ticktext: string[] = [];
      for (let i = lo; i <= hi; i++) {
        tickvals.push(i);
        ticktext.push(def.format(Math.pow(2, i)));
      }
      base.tickmode = 'array';
      base.tickvals = tickvals;
      base.ticktext = ticktext;
      base.range = def.higherIsBetter ? [lo, hi] : [hi, lo];
      base.autorange = false;
      return base;
    };

    return {
      autosize: true,
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      margin: {l: 0, r: 0, t: 10, b: 0},
      showlegend: true,
      legend: {orientation: 'h', y: -0.05, font: {color: '#aaa', size: 11}},
      scene: {
        xaxis: axisCfg(xDef),
        yaxis: axisCfg(yDef),
        zaxis: axisCfg(zDef),
        camera: {eye: {x: 1.6, y: -1.6, z: 1.2}},
      },
    };
  });

  constructor() {
    effect(() => {
      const traces = this.traces();
      const layout = this.layout();
      if (this.plotly) this.render(traces, layout);
    });
  }

  async ngOnInit(): Promise<void> {
    try {
      const mod = await import('plotly.js-dist-min');
      this.plotly = (mod as any).default ?? mod;
      this.loading.set(false);
      this.render(this.traces(), this.layout());
      this.resizeObserver = new ResizeObserver(() => {
        if (this.plotly && this.plotRef.nativeElement) {
          this.plotly.Plots.resize(this.plotRef.nativeElement);
        }
      });
      this.resizeObserver.observe(this.plotRef.nativeElement);
    } catch (e: any) {
      this.errorMsg.set(`Failed to load 3D library: ${e?.message ?? e}`);
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.plotly && this.plotRef?.nativeElement) {
      this.plotly.purge(this.plotRef.nativeElement);
    }
  }

  onAxisChange(axis: 'x' | 'y' | 'z', value: string): void {
    const v = value as AxisField;
    if (axis === 'x') this.state.scatter3dX.set(v);
    else if (axis === 'y') this.state.scatter3dY.set(v);
    else this.state.scatter3dZ.set(v);
  }

  private render(traces: any[], layout: any): void {
    if (!this.plotly || !this.plotRef?.nativeElement) return;
    this.plotly.react(this.plotRef.nativeElement, traces, layout, {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['toImage', 'sendDataToCloud'],
    });
  }
}
