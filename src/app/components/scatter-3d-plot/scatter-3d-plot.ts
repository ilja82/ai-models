import {Component, computed, effect, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild} from '@angular/core';
import {AppState} from '../../state/app.state';
import {AiModel, IntelligenceMetric} from '../../models/ai-model.model';
import {buildModelTooltipLines} from '../../models/tooltip.util';

type PlotlyModule = typeof import('plotly.js-dist-min');
type AxisField =
  | 'costsToRun' | 'inputCosts' | 'outputCosts'
  | 'contextWindow' | 'minVramRequirement'
  | 'intelligence' | 'overallIntelligence' | 'codingIntelligence' | 'agenticIntelligence'
  | 'tokensPerSecond' | 'inputProcessingTime' | 'thinkingTime' | 'outputTime' | 'responseTime'
  | 'releaseDate';

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
    key: 'costsToRun', label: 'Cost to Run ($/M)', higherIsBetter: false, logCandidate: true,
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

const KEY_X = 'ai-models.scatter3d.x';
const KEY_Y = 'ai-models.scatter3d.y';
const KEY_Z = 'ai-models.scatter3d.z';

const COLOR_API = 'rgba(99,140,210,0.9)';
const COLOR_LOCAL = 'rgba(70,180,180,0.9)';
const COLOR_USEFUL = 'rgba(180,180,80,0.95)';

const COLOR_ATTRACTIVE_FILL = 'rgb(120,220,130)';
const COLOR_UNATTRACTIVE_FILL = 'rgb(220,90,90)';
const COLOR_ATTRACTIVE_LABEL = 'rgba(80,200,90,0.9)';
const COLOR_UNATTRACTIVE_LABEL = 'rgba(220,90,90,0.85)';

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
  readonly axisDefs = AXIS_DEFS;

  readonly xAxis = signal<AxisField>((localStorage.getItem(KEY_X) as AxisField) ?? 'tokensPerSecond');
  readonly yAxis = signal<AxisField>((localStorage.getItem(KEY_Y) as AxisField) ?? 'costsToRun');
  readonly zAxis = signal<AxisField>((localStorage.getItem(KEY_Z) as AxisField) ?? 'intelligence');

  readonly loading = signal(true);
  readonly errorMsg = signal<string | null>(null);

  private plotly: PlotlyModule | null = null;
  private resizeObserver?: ResizeObserver;

  private readonly defOf = (key: AxisField): AxisDef => AXIS_DEFS.find(a => a.key === key)!;

  /** Pareto-useful model IDs for the currently selected 3 axes. */
  readonly useful3d = computed<Set<string>>(() => {
    const models = this.state.filteredModels();
    const metric = this.state.intelligenceMetric();
    const axes = [this.defOf(this.xAxis()), this.defOf(this.yAxis()), this.defOf(this.zAxis())];

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
    const xDef = this.defOf(this.xAxis());
    const yDef = this.defOf(this.yAxis());
    const zDef = this.defOf(this.zAxis());
    const logScale = this.state.logScaleX();

    const groups = {
      api: [] as AiModel[],
      local: [] as AiModel[],
      useful: [] as AiModel[],
    };
    for (const m of models) {
      if (showUseful && useful.has(m.id)) groups.useful.push(m);
      else if (m.localModel) groups.local.push(m);
      else groups.api.push(m);
    }

    const buildTrace = (items: AiModel[], name: string, color: string, symbol: string, size: number) => ({
      type: 'scatter3d',
      mode: 'markers+text',
      name,
      x: items.map(m => xDef.get(m, metric)),
      y: items.map(m => yDef.get(m, metric)),
      z: items.map(m => zDef.get(m, metric)),
      text: items.map(m => m.publicName),
      textposition: 'top center',
      textfont: {size: 10, color: '#bbb'},
      hovertext: items.map(m => buildModelTooltipLines(m, metric).join('<br>')),
      hoverinfo: 'text',
      marker: {color, size, symbol, line: {color: 'rgba(0,0,0,0.4)', width: 0.5}, opacity: 0.95},
    });

    const xExt = this.computeAxisExtent(models, xDef, metric, logScale && xDef.logCandidate);
    const yExt = this.computeAxisExtent(models, yDef, metric, logScale && yDef.logCandidate);
    const zExt = this.computeAxisExtent(models, zDef, metric, logScale && zDef.logCandidate);

    const regionTraces: any[] = [];
    if (xExt && yExt && zExt) {
      const halfRange = (ext: AxisExtent, attractive: boolean, higherIsBetter: boolean): [number, number] => {
        const pickUpper = higherIsBetter ? attractive : !attractive;
        return pickUpper ? [ext.mid, ext.max] : [ext.min, ext.mid];
      };
      const centroid = (r: [number, number], log: boolean) => log ? Math.sqrt(r[0] * r[1]) : (r[0] + r[1]) / 2;

      const attrX = halfRange(xExt, true, xDef.higherIsBetter);
      const attrY = halfRange(yExt, true, yDef.higherIsBetter);
      const attrZ = halfRange(zExt, true, zDef.higherIsBetter);
      const unX = halfRange(xExt, false, xDef.higherIsBetter);
      const unY = halfRange(yExt, false, yDef.higherIsBetter);
      const unZ = halfRange(zExt, false, zDef.higherIsBetter);

      regionTraces.push(
        this.buildCuboid(attrX, attrY, attrZ, COLOR_ATTRACTIVE_FILL, 0.35, 'Most attractive'),
        this.buildCuboid(unX, unY, unZ, COLOR_UNATTRACTIVE_FILL, 0.22, 'Least attractive'),
        {
          type: 'scatter3d',
          mode: 'text',
          name: 'Region labels',
          x: [centroid(attrX, xExt.log), centroid(unX, xExt.log)],
          y: [centroid(attrY, yExt.log), centroid(unY, yExt.log)],
          z: [centroid(attrZ, zExt.log), centroid(unZ, zExt.log)],
          text: ['Most attractive', 'Least attractive'],
          textfont: {size: 12, color: [COLOR_ATTRACTIVE_LABEL, COLOR_UNATTRACTIVE_LABEL]},
          hoverinfo: 'skip',
          showlegend: false,
        },
      );
    }

    return [
      ...regionTraces,
      buildTrace(groups.api, 'API', COLOR_API, 'circle', 5),
      buildTrace(groups.local, 'Local', COLOR_LOCAL, 'diamond', 5),
      buildTrace(groups.useful, 'Pareto efficient', COLOR_USEFUL, 'circle', 8),
    ];
  });

  readonly layout = computed(() => {
    const xDef = this.defOf(this.xAxis());
    const yDef = this.defOf(this.yAxis());
    const zDef = this.defOf(this.zAxis());
    const logScale = this.state.logScaleX();

    const axisCfg = (def: AxisDef) => ({
      title: {text: def.label, font: {color: '#aaa', size: 12}},
      type: (logScale && def.logCandidate) ? 'log' : 'linear',
      gridcolor: 'rgba(128,128,128,0.2)',
      zerolinecolor: 'rgba(128,128,128,0.35)',
      backgroundcolor: 'rgba(0,0,0,0)',
      tickfont: {color: '#888', size: 10},
      autorange: def.higherIsBetter ? true : ('reversed' as any),
    });

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
      localStorage.setItem(KEY_X, this.xAxis());
    });
    effect(() => {
      localStorage.setItem(KEY_Y, this.yAxis());
    });
    effect(() => {
      localStorage.setItem(KEY_Z, this.zAxis());
    });

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
    if (axis === 'x') this.xAxis.set(v);
    else if (axis === 'y') this.yAxis.set(v);
    else this.zAxis.set(v);
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
