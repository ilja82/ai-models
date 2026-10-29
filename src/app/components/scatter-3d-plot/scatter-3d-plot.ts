import {Component, computed, effect, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild} from '@angular/core';
import {AppState} from '../../state/app.state';
import {ThemeState} from '../../state/theme.state';
import {AiModel, releaseTimeOf, responseTimeOf} from '../../models/ai-model.model';
import {buildModelTooltipLines} from '../../models/tooltip.util';
import {darken, getPlotColors} from '../../models/plot-colors';
import {bestBalancedId} from '../../models/balanced.util';
import {AxisField, BENCHMARK_AXIS_FIELDS} from '../../models/view-types';
import {paretoIds} from '../../models/pareto.util';
import {MissingDataHintComponent} from '../missing-data-hint/missing-data-hint';
import {OutdatedBenchmarkHintComponent} from '../outdated-benchmark-hint/outdated-benchmark-hint';
import {effortSeries, effortVariantId, shortEffortLabel} from '../../models/effort.util';
import {Rect, Shift, spreadLabels} from '../../models/label-layout.util';
import {percentile} from '../../models/median.util';

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
  /** The percentile (0 to 1) of all values where the zones split; the median when not set. */
  zoneSplit?: number;
}

export const AXIS_DEFS: AxisDef[] = [
  {
    key: 'intelligence', label: 'Overall Intelligence', higherIsBetter: true, logCandidate: false,
    get: m => m.overallIntelligence, format: v => `${v}`, zoneSplit: 0.75
  },
  {
    key: 'costsToRun', label: 'Cost per Index Run (USD)', higherIsBetter: false, logCandidate: true,
    get: m => m.costsToRun === 0 ? 0.001 : m.costsToRun, format: v => `$${v.toFixed(2)}`
  },
  {
    key: 'responseTime', label: 'Response Time (s)', higherIsBetter: false, logCandidate: true,
    get: m => responseTimeOf(m), format: v => `${v.toFixed(1)}s`
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
    key: 'maxOutputTokens', label: 'Max Output Tokens', higherIsBetter: true, logCandidate: true,
    get: m => m.maxOutputTokens, format: v => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`
  },
  {
    key: 'maxInputTokens', label: 'Max Input Tokens', higherIsBetter: true, logCandidate: true,
    get: m => m.maxInputTokens, format: v => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`
  },
  {
    key: 'minVramRequirement', label: 'Min VRAM (GB)', higherIsBetter: false, logCandidate: false,
    get: m => m.minVramRequirement, format: v => `${v}GB`
  },
  {
    key: 'releaseDate', label: 'Release Date', higherIsBetter: true, logCandidate: false,
    get: m => releaseTimeOf(m),
    format: v => new Date(v).toLocaleDateString('en-US', {month: 'short', year: 'numeric'})
  },
];

interface AxisExtent {
  min: number;
  max: number;
  log: boolean;
}

export const MARKER_SIZE_3D = {useful: 10, axisBest: 13, balanced: 18};
export const LABEL_SIZE_3D = 10;
export const HIGHLIGHT_LABEL_SIZE_3D = 14;
export const BALANCED_LABEL_SIZE_3D = 17;
const LABEL_GAP_3D = 3;
const HIDDEN_TEXT = 'rgba(0,0,0,0)';
const NO_SHIFT: Shift = {dx: 0, dy: 0};
const SETTLED_FRAMES = 3;
const MAX_SETTLE_FRAMES = 120;

type ModelGroup = 'deprecated' | 'api' | 'local' | 'useful' | 'axisBest' | 'balanced';

const MODEL_MARKER_SIZE: Record<ModelGroup, number> = {
  deprecated: 4, api: 5, local: 5,
  useful: MARKER_SIZE_3D.useful, axisBest: MARKER_SIZE_3D.axisBest, balanced: MARKER_SIZE_3D.balanced,
};
const GROUP_RANK: Record<ModelGroup, number> = {deprecated: 0, api: 0, local: 0, useful: 1, axisBest: 2, balanced: 3};
const LEVEL_MARKER_SIZE = [2, MARKER_SIZE_3D.useful, MARKER_SIZE_3D.axisBest, MARKER_SIZE_3D.balanced];

export interface Label3d {
  /** The model id, or `<model id>@<effort>` for an effort level. */
  id: string;
  point: AiModel;
  text: string;
  color: string;
  size: number;
  bold: boolean;
  /** 3 for best balanced, 2 for best per axis, 1 for Pareto efficient, 0 for the others. */
  rank: number;
  /** The drawn marker diameter in pixels. */
  marker: number;
  side: 'top' | 'right';
}

/** The pixel offset of the label from its point at the base place: above the marker, or right of it. */
export function baseOffset(l: Pick<Label3d, 'marker' | 'side'>): { ax: number; ay: number } {
  const d = l.marker / 2 + LABEL_GAP_3D;
  return l.side === 'right' ? {ax: d, ay: 0} : {ax: 0, ay: -d};
}

/** The scene annotation of a label; a shifted label gets a line to its point. */
export function labelAnnotation(l: Label3d, [x, y, z]: [number, number, number], shift: Shift = NO_SHIFT): any {
  const base = baseOffset(l);
  const moved = shift.dx !== 0 || shift.dy !== 0;
  return {
    x, y, z,
    text: l.text,
    showarrow: true,
    ax: base.ax + shift.dx,
    ay: base.ay + shift.dy,
    xanchor: l.side === 'right' ? 'left' : 'center',
    yanchor: l.side === 'right' ? 'middle' : 'bottom',
    arrowhead: 0,
    arrowwidth: 1,
    standoff: l.marker / 2,
    arrowcolor: moved ? l.color : 'rgba(0,0,0,0)',
    font: {size: l.size, color: l.color, weight: l.bold ? 'bold' : 'normal'},
  };
}

/**
 * The label shifts that clear the overlaps, from the drawn label boxes.
 *
 * @param rects the drawn box of each label in pixels, null for a label that is not drawn
 * @param current the shift of each label when its box was drawn
 */
export function shiftsFromRects(labels: Label3d[], rects: (Rect | null)[], current: Shift[]): Shift[] {
  const items = labels.flatMap((l, i) => {
    const r = rects[i];
    if (!r || r.w === 0 || r.h === 0) return [];
    return [{i, l, box: {x: r.x - current[i].dx, y: r.y - current[i].dy, w: r.w, h: r.h, rank: l.rank}}];
  });
  const markers = items.filter(({l}) => l.rank > 0).map(({l, box}) => {
    const {ax, ay} = baseOffset(l);
    const cx = l.side === 'right' ? box.x - ax : box.x + box.w / 2;
    const cy = l.side === 'right' ? box.y + box.h / 2 : box.y + box.h - ay;
    return {x: cx - l.marker / 2, y: cy - l.marker / 2, w: l.marker, h: l.marker};
  });
  const spread = spreadLabels(items.map(it => it.box), markers);
  const shifts = labels.map(() => NO_SHIFT);
  items.forEach((it, k) => shifts[it.i] = {dx: Math.round(spread[k].dx), dy: Math.round(spread[k].dy)});
  return shifts;
}

@Component({
  selector: 'app-scatter-3d-plot',
  standalone: true,
  imports: [MissingDataHintComponent, OutdatedBenchmarkHintComponent],
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
  private settleFrame = 0;
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

  /** The plotted models while an axis comes from the benchmark, else none. */
  readonly benchmarkModels = computed(() =>
    this.axes().some(a => BENCHMARK_AXIS_FIELDS.has(a.key)) ? this.plotModels() : []);

  readonly hasEfforts = computed(() => this.state.allModels().some(m => m.efforts.length > 1));

  /** The effort levels of each plotted model that have a value on all three axes, for models with two or more. */
  readonly effortCurves = computed<{ model: AiModel; points: AiModel[] }[]>(() => {
    const axes = this.axes();
    return this.plotModels().flatMap(model => {
      const points = effortSeries(model).filter(p => axes.every(a => a.get(p) !== null));
      return points.length < 2 ? [] : [{model, points}];
    });
  });

  /** The filtered models and effort levels before the Pareto filter. The axis ranges and the regions fit them. */
  private readonly axisModels = computed(() =>
    this.plotModels().concat(this.effortCurves().flatMap(c => c.points.filter(p => p !== c.model))));

  /** Pareto-useful IDs for the currently selected 3 axes. Effort levels have the id `<model id>@<effort>`. */
  readonly useful3d = computed<Set<string>>(() => {
    const axes = this.axes();
    const levels = this.effortCurves().flatMap(c => c.points.filter(p => p !== c.model));
    const models = this.plotModels().concat(levels).filter(m => !m.deprecated);
    return paretoIds(models, axes);
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

  /** The shown best balanced point and its label; the layout draws the label as an annotation beside the marker. */
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
      return {min, max, log: true};
    }

    const range = max - min;
    min = min - range * 0.05;
    max = max + range * 0.05;
    return {min, max, log: false};
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

  /** The `zoneSplit` percentile of each axis over all models with a value on all three axes, before any filter. */
  readonly zoneSplit3d = computed<[number, number, number] | null>(() => {
    const axes = this.axes();
    const models = this.state.allModels().filter(m => axes.every(a => a.get(m) !== null));
    const split = axes.map(a => percentile(models.map(m => a.get(m)!), a.zoneSplit ?? 0.5));
    return split.some(v => v === null) ? null : split as [number, number, number];
  });

  /** The plotted ranges of the "Most attractive" and "Least attractive" cuboids per axis; null for a cuboid without volume. */
  private readonly regions = computed<{ attractive: [number, number][] | null; unattractive: [number, number][] | null } | null>(() => {
    const defs = this.axes();
    const allModels = this.axisModels();
    const exts = defs.map(def => this.computeAxisExtent(allModels, def, this.isLogAxis(def)));
    const split = this.zoneSplit3d();
    if (!split || exts.some(ext => !ext)) return null;
    const region = (attractive: boolean): [number, number][] | null => {
      const ranges = defs.map((def, i): [number, number] => {
        const ext = exts[i]!;
        const mid = Math.max(ext.min, Math.min(ext.max, split[i]));
        const pickUpper = def.higherIsBetter ? attractive : !attractive;
        const r: [number, number] = pickUpper ? [mid, ext.max] : [ext.min, mid];
        const log = this.isLogAxis(def);
        return [this.toPlotVal(r[0], log), this.toPlotVal(r[1], log)];
      });
      return ranges.some(([lo, hi]) => lo === hi) ? null : ranges;
    };
    return {attractive: region(true), unattractive: region(false)};
  });

  private plotPoint(m: AiModel): [number, number, number] {
    const defs = [this.defOf(this.state.scatter3dX()), this.defOf(this.state.scatter3dY()), this.defOf(this.state.scatter3dZ())];
    return defs.map(def => this.toPlotVal(def.get(m)!, this.isLogAxis(def))) as [number, number, number];
  }

  /** The label text color, darkened by `attractiveTextShade` for a point inside the "Most attractive" box. */
  private labelColor(m: AiModel, color: string): string {
    const box = this.regions()?.attractive;
    if (!box) return color;
    const inside = this.plotPoint(m).every((v, i) => v >= Math.min(...box[i]) && v <= Math.max(...box[i]));
    return inside ? darken(color, getPlotColors(this.themeState.theme()).attractiveTextShade) : color;
  }

  /** The labels of the shown models and effort levels, drawn as scene annotations so they can move apart. */
  readonly labels3d = computed<Label3d[]>(() => {
    const models = this.shownModels();
    const useful = this.useful3d();
    const {axisBestIds, balancedId} = this.specialMarkers3d();
    const colors = getPlotColors(this.themeState.theme());
    const style = (m: AiModel, rank: number, plainColor: string) => ({
      color: rank === 3 ? colors.balanced
        : this.labelColor(m, rank === 2 ? colors.axisBestLabel : rank === 1 ? colors.usefulLabel : plainColor),
      size: rank === 3 ? BALANCED_LABEL_SIZE_3D : rank > 0 ? HIGHLIGHT_LABEL_SIZE_3D : LABEL_SIZE_3D,
      bold: rank > 0,
      rank,
      side: (rank === 3 ? 'right' : 'top') as Label3d['side'],
    });

    const modelLabels = models.map(m => {
      const group = this.groupOf(m, useful, axisBestIds, balancedId);
      return {id: m.id, point: m, text: m.publicName, marker: MODEL_MARKER_SIZE[group], ...style(m, GROUP_RANK[group], colors.pointLabel3d)};
    });

    const shownIds = new Set(models.map(m => m.id));
    const effortLabels = this.shownEffortCurves().flatMap(({model, points}) => {
      const lineColor = model.deprecated ? colors.deprecated : model.localModel ? colors.local : colors.api;
      const plainColor = darken(lineColor, colors.effortLabelShade3d);
      return points.map(p => {
        const current = p === model;
        const group = this.groupOf(model, useful, axisBestIds, balancedId);
        const rank = current ? GROUP_RANK[group] : this.levelRank(p, useful, axisBestIds, balancedId);
        const effort = shortEffortLabel(p.effort!);
        return {
          id: current ? effortVariantId(model.id, p.effort!) : p.id, point: p,
          text: shownIds.has(model.id) ? effort : `${model.publicName} ${effort}`,
          marker: current ? MODEL_MARKER_SIZE[group] : LEVEL_MARKER_SIZE[rank],
          ...style(p, rank, plainColor), side: 'right' as const,
        };
      });
    });
    return modelLabels.concat(effortLabels);
  });

  private groupOf(m: AiModel, useful: Set<string>, axisBestIds: Set<string>, balancedId: string | null): ModelGroup {
    if (m.deprecated) return 'deprecated';
    if (m.id === balancedId) return 'balanced';
    if (axisBestIds.has(m.id)) return 'axisBest';
    if (useful.has(m.id)) return 'useful';
    return m.localModel ? 'local' : 'api';
  }

  /** 3 for best balanced, 2 for best per axis, 1 for Pareto efficient, 0 for any other effort level. */
  private levelRank(p: AiModel, useful: Set<string>, axisBestIds: Set<string>, balancedId: string | null): number {
    return p.id === balancedId ? 3 : axisBestIds.has(p.id) ? 2 : useful.has(p.id) ? 1 : 0;
  }

  readonly traces = computed(() => {
    const models = this.shownModels();
    const useful = this.useful3d();
    const {axisBestIds, balancedId} = this.specialMarkers3d();
    const colors = getPlotColors(this.themeState.theme());
    const coords = (items: AiModel[]) => {
      const pts = items.map(m => this.plotPoint(m));
      return {x: pts.map(p => p[0]), y: pts.map(p => p[1]), z: pts.map(p => p[2])};
    };

    const groups: Record<ModelGroup, AiModel[]> = {deprecated: [], api: [], local: [], useful: [], axisBest: [], balanced: []};
    for (const m of models) groups[this.groupOf(m, useful, axisBestIds, balancedId)].push(m);

    const defs = [this.defOf(this.state.scatter3dX()), this.defOf(this.state.scatter3dY()), this.defOf(this.state.scatter3dZ())];
    const costAxis = defs.some(d => d.key === 'costsToRun');
    const latest = this.state.latestBenchmarkVersion();
    const symbolOf = (m: AiModel, symbol: string) =>
      costAxis && m.tokensPerRunEstimated && !symbol.endsWith('-open') ? `${symbol}-open` : symbol;
    const buildTrace = (group: ModelGroup, name: string, color: string, symbol: string) => ({
      type: 'scatter3d',
      mode: 'markers+text',
      name,
      ...coords(groups[group]),
      text: groups[group].map(m => m.publicName),
      textfont: {size: LABEL_SIZE_3D, color: HIDDEN_TEXT},
      hovertext: groups[group].map(m => buildModelTooltipLines(m, latest).join('<br>')),
      hoverinfo: 'text',
      marker: {
        color, size: MODEL_MARKER_SIZE[group], symbol: groups[group].map(m => symbolOf(m, symbol)),
        line: group === 'balanced' ? {color: colors.balancedRing, width: 3} : {color: 'rgba(0,0,0,0.4)', width: 0.5},
        opacity: 0.95,
      },
    });

    const regionTraces: any[] = [];
    const regions = this.regions();
    const centroid = (r: [number, number]) => (r[0] + r[1]) / 2;
    const shownRegions = [
      {box: regions?.attractive, name: 'Most attractive', line: colors.attractiveCuboid, label: colors.attractiveLabel, opacity: 0.8},
      {box: regions?.unattractive, name: 'Least attractive', line: colors.unattractiveCuboid, label: colors.unattractiveLabel, opacity: 0.6},
    ].filter((r): r is typeof r & { box: [number, number][] } => !!r.box);
    if (shownRegions.length > 0) {
      regionTraces.push(
        ...shownRegions.map(({box: [x, y, z], line, opacity, name}) => this.buildCuboid(x, y, z, line, opacity, name)),
        {
          type: 'scatter3d',
          mode: 'text',
          name: 'Region labels',
          x: shownRegions.map(r => centroid(r.box[0])),
          y: shownRegions.map(r => centroid(r.box[1])),
          z: shownRegions.map(r => centroid(r.box[2])),
          text: shownRegions.map(r => r.name),
          textfont: {size: 12, color: shownRegions.map(r => r.label)},
          hoverinfo: 'skip',
          showlegend: false,
        },
      );
    }

    const shownIds = new Set(models.map(m => m.id));
    const effortTraces = this.shownEffortCurves().map(({model, points}) => {
      const lineColor = model.deprecated ? colors.deprecated : model.localModel ? colors.local : colors.api;
      const rankOf = (p: AiModel) => p === model ? 0 : this.levelRank(p, useful, axisBestIds, balancedId);
      return {
        type: 'scatter3d',
        mode: 'lines+markers+text',
        name: `${model.publicName} effort levels`,
        showlegend: false,
        ...coords(points),
        text: points.map(p => shownIds.has(model.id) ? shortEffortLabel(p.effort!) : `${model.publicName} ${shortEffortLabel(p.effort!)}`),
        textposition: 'middle right',
        textfont: {size: LABEL_SIZE_3D, color: HIDDEN_TEXT},
        hovertext: points.map(p => buildModelTooltipLines(p, latest).join('<br>')),
        hoverinfo: 'text',
        line: {color: lineColor, width: 2, dash: 'dash'},
        marker: {
          size: points.map(p => LEVEL_MARKER_SIZE[rankOf(p)]),
          sizeref: 0.5,
          color: points.map(p => [lineColor, colors.useful, colors.axisBest, colors.balanced][rankOf(p)]),
          symbol: points.map(p => ['circle', 'circle', 'diamond-open', 'square'][rankOf(p)]),
        },
      };
    });

    return [
      ...regionTraces,
      ...effortTraces,
      buildTrace('deprecated', 'Deprecated', colors.deprecated, 'circle'),
      buildTrace('api', 'API', colors.api, 'circle'),
      buildTrace('local', 'Local', colors.local, 'diamond'),
      buildTrace('useful', 'Pareto efficient', colors.useful, 'circle'),
      buildTrace('axisBest', 'Best per axis', colors.axisBest, 'diamond-open'),
      buildTrace('balanced', 'Best balanced', colors.balanced, 'square'),
    ];
  });

  /** The shift of each label away from its base place, by label id; `measureLabels` sets it after each render. */
  readonly labelShifts = signal<ReadonlyMap<string, Shift>>(new Map());

  readonly layout = computed(() => {
    const xDef = this.defOf(this.state.scatter3dX());
    const yDef = this.defOf(this.state.scatter3dY());
    const zDef = this.defOf(this.state.scatter3dZ());
    const models = this.axisModels();
    const shifts = this.labelShifts();

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
      uirevision: 'scatter3d',
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      margin: {l: 0, r: 0, t: 10, b: 0},
      showlegend: true,
      legend: {orientation: 'h', y: -0.05, font: {color: '#aaa', size: 11}},
      scene: {
        xaxis: axisCfg(xDef),
        yaxis: axisCfg(yDef),
        zaxis: axisCfg(zDef),
        annotations: this.labels3d().map(l => labelAnnotation(l, this.plotPoint(l.point), shifts.get(l.id))),
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
      (this.plotRef.nativeElement as any).on('plotly_relayout', () => this.measureLabels());
      this.resizeObserver = new ResizeObserver(() => {
        if (this.plotly && this.plotRef.nativeElement) {
          Promise.resolve(this.plotly.Plots.resize(this.plotRef.nativeElement)).then(() => this.measureLabels());
        }
      });
      this.resizeObserver.observe(this.plotRef.nativeElement);
    } catch (e: any) {
      this.errorMsg.set(`Failed to load 3D library: ${e?.message ?? e}`);
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.settleFrame);
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

  /** Measures the labels once the drawn annotations keep their place for a few frames; the camera moves on after a drag. */
  private measureLabels(): void {
    cancelAnimationFrame(this.settleFrame);
    let last = '';
    let stillFrames = 0;
    let frames = 0;
    const tick = () => {
      const signature = [...this.plotRef.nativeElement.querySelectorAll('.annotation-text-g')]
        .map(el => el.getAttribute('transform')).join('|');
      stillFrames = signature === last ? stillFrames + 1 : 0;
      last = signature;
      if (stillFrames >= SETTLED_FRAMES || ++frames > MAX_SETTLE_FRAMES) this.measureDrawnLabels();
      else this.settleFrame = requestAnimationFrame(tick);
    };
    this.settleFrame = requestAnimationFrame(tick);
  }

  /** Reads the drawn label boxes and moves the labels apart where they overlap. */
  private measureDrawnLabels(): void {
    const root = this.plotRef?.nativeElement;
    if (!root) return;
    const origin = root.getBoundingClientRect();
    const labels = this.labels3d();
    const drawn: any[] = (root as any).layout?.scene?.annotations ?? [];
    if (drawn.length !== labels.length || drawn.some((a, i) => a.text !== labels[i].text)) return;
    const drawnShifts = labels.map((l, i) => {
      const base = baseOffset(l);
      return {dx: drawn[i].ax - base.ax, dy: drawn[i].ay - base.ay};
    });
    const rects = labels.map((_, i) => {
      const el = root.querySelector(`.annotation-scene[data-index="${i}"] .annotation-text-g`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height};
    });
    const current = this.labelShifts();
    const next = shiftsFromRects(labels, rects, drawnShifts);
    const changed = labels.some((l, i) => {
      const c = current.get(l.id) ?? NO_SHIFT;
      return c.dx !== next[i].dx || c.dy !== next[i].dy;
    });
    if (changed) this.labelShifts.set(new Map(labels.map((l, i) => [l.id, next[i]])));
  }

  private render(traces: any[], layout: any): void {
    if (!this.plotly || !this.plotRef?.nativeElement) return;
    this.plotly.react(this.plotRef.nativeElement, traces, layout, {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['toImage', 'sendDataToCloud'],
    }).then(() => this.measureLabels());
  }
}
