import {Component, computed, effect, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild} from '@angular/core';
import {AppState} from '../../state/app.state';
import {ThemeState} from '../../state/theme.state';
import {AiModel, responseTimeOf} from '../../models/ai-model.model';
import {buildModelTooltipLines} from '../../models/tooltip.util';
import {getPlotColors} from '../../models/plot-colors';
import {bestBalancedId} from '../../models/balanced.util';
import {AxisField} from '../../models/view-types';
import {MissingDataHintComponent} from '../missing-data-hint/missing-data-hint';
import {effortSeries, otherEffortVariants, shortEffortLabel} from '../../models/effort.util';

type PlotlyModule = typeof import('plotly.js-dist-min');

interface AxisDef {
  key: AxisField;
  label: string;
  /** true = larger value better (e.g. intelligence, speed); false = smaller better (cost, latency) */
  higherIsBetter: boolean;
  /** suggested log scale (cost, context window) */
  logCandidate: boolean;
  /** value extractor; null = not measured */
  get: (m: AiModel) => number | null;
  /** axis tick formatter */
  format: (v: number) => string;
}

export const AXIS_DEFS: AxisDef[] = [
  {
    key: 'costsToRun', label: 'Cost per Index Run (USD)', higherIsBetter: false, logCandidate: true,
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
    key: 'intelligence', label: 'Overall Intelligence', higherIsBetter: true, logCandidate: false,
    get: m => m.overallIntelligence, format: v => `${v}`
  },
  {
    key: 'tokensPerSecond', label: 'Speed (tok/s)', higherIsBetter: true, logCandidate: false,
    get: m => m.tokensPerSecond, format: v => `${v.toFixed(0)}`
  },
  {
    key: 'inputProcessingTime', label: 'Input Processing (s)', higherIsBetter: false, logCandidate: true,
    get: m => m.inputProcessingTime, format: v => `${v.toFixed(1)}s`
  },
  {
    key: 'thinkingTime', label: 'Thinking Time (s)', higherIsBetter: false, logCandidate: true,
    get: m => m.thinkingTime, format: v => `${v.toFixed(1)}s`
  },
  {
    key: 'outputTime', label: 'Output Time (s)', higherIsBetter: false, logCandidate: true,
    get: m => m.outputTime, format: v => `${v.toFixed(1)}s`
  },
  {
    key: 'responseTime', label: 'Response Time (s)', higherIsBetter: false, logCandidate: true,
    get: m => responseTimeOf(m), format: v => `${v.toFixed(1)}s`
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
  imports: [MissingDataHintComponent],
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

  private readonly axes = computed(() =>
    [this.defOf(this.state.scatter3dX()), this.defOf(this.state.scatter3dY()), this.defOf(this.state.scatter3dZ())]);

  /** The filtered models that have a value on all three axes. */
  readonly plotModels = computed(() => {
    const axes = this.axes();
    return this.state.filteredModels().filter(m => axes.every(a => a.get(m) !== null));
  });

  readonly missingModels = computed(() => {
    const shown = new Set(this.plotModels().map(m => m.id));
    return this.state.filteredModels().filter(m => !shown.has(m.id));
  });

  readonly hasEfforts = computed(() => this.state.allModels().some(m => m.efforts.length > 1));

  /** The effort levels of each plotted model that have a value on all three axes, for models with two or more. */
  readonly effortCurves = computed<{ model: AiModel; points: AiModel[] }[]>(() => {
    if (!this.state.showEfforts()) return [];
    const axes = this.axes();
    return this.plotModels().flatMap(model => {
      const points = effortSeries(model).filter(p => axes.every(a => a.get(p) !== null));
      return points.length < 2 ? [] : [{model, points}];
    });
  });

  /** All models, plus their other effort levels while those are shown. The axis ranges use them. */
  private readonly axisModels = computed(() => {
    const models = this.state.allModels();
    return this.state.showEfforts() ? models.concat(models.flatMap(otherEffortVariants)) : models;
  });

  /** Pareto-useful IDs for the currently selected 3 axes. Effort levels have the id `<model id>@<effort>`. */
  readonly useful3d = computed<Set<string>>(() => {
    const axes = this.axes();
    const levels = this.effortCurves().flatMap(c => c.points.filter(p => p !== c.model));
    const models = this.plotModels().concat(levels).filter(m => !m.deprecated);

    const points = models.map(m => ({id: m.id, vals: axes.map(a => a.get(m)!)}));
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

  /** The plotted models, only the Pareto set of the three axes while the Pareto filter is on. */
  readonly shownModels = computed(() => {
    if (!this.state.showOnlyPareto()) return this.plotModels();
    const useful = this.useful3d();
    return this.plotModels().filter(m => useful.has(m.id));
  });

  /** The effort curves, only the Pareto levels and only curves with such a level while the Pareto filter is on. */
  readonly shownEffortCurves = computed<{ model: AiModel; points: AiModel[] }[]>(() => {
    const curves = this.effortCurves();
    if (!this.state.showOnlyPareto()) return curves;
    const useful = this.useful3d();
    return curves.flatMap(c => {
      const points = c.points.filter(p => useful.has(p.id));
      return points.some(p => p !== c.model) ? [{model: c.model, points}] : [];
    });
  });

  readonly specialMarkers3d = computed<{ axisBestIds: Set<string>; balancedId: string | null }>(() => {
    const models = this.plotModels().filter(m => !m.deprecated);
    if (models.length === 0) return {axisBestIds: new Set(), balancedId: null};
    const axes = this.axes();

    const levels = this.effortCurves()
      .filter(c => !c.model.deprecated)
      .flatMap(c => c.points.filter(p => p !== c.model));
    const candidates = models.concat(levels);

    const axisBestIds = new Set<string>();
    for (const a of axes) {
      let bestModel: AiModel | null = null;
      let bestVal = a.higherIsBetter ? -Infinity : Infinity;
      for (const m of candidates) {
        const v = a.get(m);
        if (v === null || !Number.isFinite(v)) continue;
        if (a.higherIsBetter ? v > bestVal : v < bestVal) {
          bestVal = v;
          bestModel = m;
        }
      }
      if (bestModel) axisBestIds.add(bestModel.id);
    }

    const balancedId = bestBalancedId(
      candidates,
      axes.map(a => ({get: (m: AiModel) => a.get(m)!, higherIsBetter: a.higherIsBetter, log: this.isLogAxis(a)})),
    );
    return {axisBestIds, balancedId};
  });

  private computeAxisExtent(models: AiModel[], def: AxisDef, log: boolean): AxisExtent | null {
    if (models.length === 0) return null;
    const values = models.map(m => def.get(m)).filter((v): v is number => v !== null && Number.isFinite(v));
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
    const corners: [number, number, number][] = [
      [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
      [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
    ];
    const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    const path = edges.flatMap(([a, b]) => [corners[a], corners[b], null]);
    return {
      type: 'scatter3d',
      mode: 'lines',
      name,
      x: path.map(p => p?.[0] ?? null),
      y: path.map(p => p?.[1] ?? null),
      z: path.map(p => p?.[2] ?? null),
      connectgaps: false,
      line: {color, width: 4},
      opacity,
      hoverinfo: 'skip',
      showlegend: false,
    };
  }

  readonly traces = computed(() => {
    const models = this.shownModels();
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
      else if (useful.has(m.id)) groups.useful.push(m);
      else if (m.localModel) groups.local.push(m);
      else groups.api.push(m);
    }

    const costAxis = [xDef, yDef, zDef].some(d => d.key === 'costsToRun');
    const symbolOf = (m: AiModel, symbol: string) =>
      costAxis && m.tokensPerRunEstimated && !symbol.endsWith('-open') ? `${symbol}-open` : symbol;
    const buildTrace = (items: AiModel[], name: string, color: string, symbol: string, size: number) => ({
      type: 'scatter3d',
      mode: 'markers+text',
      name,
      x: items.map(m => this.toPlotVal(xDef.get(m)!, xLog)),
      y: items.map(m => this.toPlotVal(yDef.get(m)!, yLog)),
      z: items.map(m => this.toPlotVal(zDef.get(m)!, zLog)),
      text: items.map(m => m.publicName),
      textposition: 'top center',
      textfont: {size: 10, color: '#bbb'},
      hovertext: items.map(m => buildModelTooltipLines(m).join('<br>')),
      hoverinfo: 'text',
      marker: {
        color, size, symbol: items.map(m => symbolOf(m, symbol)), line: {color: 'rgba(0,0,0,0.4)', width: 0.5},
        opacity: 0.95,
      },
    });

    const allModels = this.axisModels();
    const xExt = this.computeAxisExtent(allModels, xDef, logScale && xDef.logCandidate);
    const yExt = this.computeAxisExtent(allModels, yDef, logScale && yDef.logCandidate);
    const zExt = this.computeAxisExtent(allModels, zDef, logScale && zDef.logCandidate);

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
        this.buildCuboid(attrX, attrY, attrZ, colors.attractiveCuboid, 0.8, 'Most attractive'),
        this.buildCuboid(unX, unY, unZ, colors.unattractiveCuboid, 0.6, 'Least attractive'),
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

    const shownIds = new Set(models.map(m => m.id));
    const effortTraces = this.shownEffortCurves().map(({model, points}) => {
      const lineColor = model.deprecated ? colors.deprecated : model.localModel ? colors.local : colors.api;
      const isUseful = (p: AiModel) => p !== model && useful.has(p.id);
      const isBalanced = (p: AiModel) => p !== model && p.id === balancedId;
      const isAxisBest = (p: AiModel) => p !== model && !isBalanced(p) && axisBestIds.has(p.id);
      return {
        type: 'scatter3d',
        mode: 'lines+markers+text',
        name: `${model.publicName} effort levels`,
        showlegend: false,
        x: points.map(p => this.toPlotVal(xDef.get(p)!, xLog)),
        y: points.map(p => this.toPlotVal(yDef.get(p)!, yLog)),
        z: points.map(p => this.toPlotVal(zDef.get(p)!, zLog)),
        text: points.map(p => p === model ? ''
          : shownIds.has(model.id) ? shortEffortLabel(p.effort!) : `${model.publicName} ${shortEffortLabel(p.effort!)}`),
        textposition: 'middle right',
        textfont: {size: 9, color: lineColor},
        hovertext: points.map(p => buildModelTooltipLines(p).join('<br>')),
        hoverinfo: 'text',
        line: {color: lineColor, width: 2, dash: 'dash'},
        marker: {
          size: points.map(p => isBalanced(p) ? 16 : isAxisBest(p) ? 10 : isUseful(p) ? 4 : 2),
          sizeref: 0.5,
          color: points.map(p => isBalanced(p) ? colors.balanced : isAxisBest(p) ? colors.axisBest : isUseful(p) ? colors.useful : lineColor),
          symbol: points.map(p => isBalanced(p) ? 'square' : isAxisBest(p) ? 'diamond-open' : 'circle'),
        },
      };
    });

    return [
      ...regionTraces,
      ...effortTraces,
      buildTrace(groups.deprecated, 'Deprecated', colors.deprecated, 'circle', 4),
      buildTrace(groups.api, 'API', colors.api, 'circle', 5),
      buildTrace(groups.local, 'Local', colors.local, 'diamond', 5),
      buildTrace(groups.useful, 'Pareto efficient', colors.useful, 'circle', 8),
      buildTrace(groups.axisBest, 'Best per axis', colors.axisBest, 'diamond-open', 10),
      buildTrace(groups.balanced, 'Best balanced', colors.balanced, 'square', 16),
    ];
  });

  readonly layout = computed(() => {
    const xDef = this.defOf(this.state.scatter3dX());
    const yDef = this.defOf(this.state.scatter3dY());
    const zDef = this.defOf(this.state.scatter3dZ());
    const models = this.axisModels();

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
        const ext = this.computeAxisExtent(models, def, false);
        if (!ext) {
          base.autorange = def.higherIsBetter ? true : 'reversed';
          return base;
        }
        base.range = def.higherIsBetter ? [ext.min, ext.max] : [ext.max, ext.min];
        base.autorange = false;
        return base;
      }
      const ext = this.computeAxisExtent(models, def, true);
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
