import {Component, computed, effect, ElementRef, inject, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {
  Chart,
  ChartConfiguration,
  ChartDataset,
  Legend,
  LinearScale,
  LineElement,
  LogarithmicScale,
  Plugin,
  PointElement,
  ScatterController,
  Ticks,
  Tooltip
} from 'chart.js';
import {AppState} from '../../state/app.state';
import {ThemeState} from '../../state/theme.state';
import {AiModel, blendedPriceOf, priceBlendLabel, releaseTimeOf, responseTimeOf} from '../../models/ai-model.model';
import {buildModelTooltipLines, formatUsd, formatUsdTick, intelligenceLine} from '../../models/tooltip.util';
import {darken, getPlotColors} from '../../models/plot-colors';
import {bestBalancedId} from '../../models/balanced.util';
import {PlotType} from '../../models/view-types';
import {EffortPoint, effortPoints, effortResponseTime, effortVariantId, shortEffortLabel} from '../../models/effort.util';
import {paretoIds} from '../../models/pareto.util';
import {median, percentile} from '../../models/median.util';
import {MissingDataHintComponent} from '../missing-data-hint/missing-data-hint';
import {OutdatedBenchmarkHintComponent} from '../outdated-benchmark-hint/outdated-benchmark-hint';

Chart.register(ScatterController, PointElement, LineElement, LinearScale, LogarithmicScale, Tooltip, Legend);

interface EffortCurve {
  model: AiModel;
  color: string;
  points: (EffortPoint & {
    px: number;
    py: number;
    label: string;
    useful: boolean;
    axisBest: boolean;
    balanced: boolean;
    labelRole: MarkerRole;
    labelRadius: number;
  })[];
}

const LABEL_FONT = '13px system-ui, sans-serif';
const HIGHLIGHT_LABEL_FONT = 'bold 16px system-ui, sans-serif';
const BALANCED_LABEL_FONT = 'bold 17px system-ui, sans-serif';
const EFFORT_LABEL_FONT = '10px system-ui, sans-serif';
const HIGHLIGHT_EFFORT_LABEL_FONT = 'bold 13px system-ui, sans-serif';
const BALANCED_EFFORT_LABEL_FONT = 'bold 15px system-ui, sans-serif';
const BALANCED_BORDER_WIDTH = 2.5;
export const STAR_SIZE = 26;

const LABEL_GAP = 3;

/** Candidate text baselines for a centered label: above the marker first, then below, then further out. */
export function labelBaselines(py: number, radius: number, labelH: number): number[] {
  const above = py - radius - LABEL_GAP;
  const below = py + radius + LABEL_GAP + labelH;
  return [above, above - 14, below, above - 28, below + 14, above - 42, below + 28];
}

/** Offset of a left-aligned, vertically centered effort label: small points get it below right, large ones beside. */
export function effortLabelOffset(radius: number): { dx: number; dy: number } {
  return radius > 5 ? {dx: radius + LABEL_GAP, dy: 0} : {dx: 5, dy: 8};
}

export interface MarkerRole {
  balanced: boolean;
  axisBest: boolean;
  useful: boolean;
}

/** 3 for best balanced, 2 for best per axis, 1 for Pareto efficient, 0 for any other point. */
export function markerRank(p: MarkerRole): number {
  return p.balanced ? 3 : p.axisBest ? 2 : p.useful ? 1 : 0;
}

export function modelPointRadius(p: MarkerRole): number {
  return [7, 9, STAR_SIZE / 2, 17][markerRank(p)];
}

export function effortPointRadius(p: MarkerRole): number {
  return [3, 7, STAR_SIZE / 2, 15][markerRank(p)];
}

export function modelLabelFont(p: MarkerRole): string {
  return [LABEL_FONT, HIGHLIGHT_LABEL_FONT, HIGHLIGHT_LABEL_FONT, BALANCED_LABEL_FONT][markerRank(p)];
}

export function effortLabelFont(p: MarkerRole): string {
  return [EFFORT_LABEL_FONT, HIGHLIGHT_EFFORT_LABEL_FONT, HIGHLIGHT_EFFORT_LABEL_FONT, BALANCED_EFFORT_LABEL_FONT][markerRank(p)];
}

function makeStarImage(color: string, size: number, onLoad: () => void): HTMLImageElement {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">` +
    `<polygon fill="${color}" points="50,2 61,38 98,38 68,60 79,96 50,74 21,96 32,60 2,38 39,38"/></svg>`;
  const img = new Image(size, size);
  img.onload = onLoad;
  img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  return img;
}

interface PlotTypeDef {
  key: PlotType;
  label: string;
  supportsLogX: boolean;
  reverseX: boolean;
  reverseY: boolean;
  logY: boolean;
  showsEfforts: boolean;
  /** The percentile (0 to 1) of all y values where the zones split. */
  ySplit: number;
}

const PLOT_TYPES: PlotTypeDef[] = [
  {key: 'cost', label: 'Cost vs Intelligence', supportsLogX: true, reverseX: true, reverseY: false, logY: false, showsEfforts: true, ySplit: 0.75},
  {key: 'price', label: 'Price vs Intelligence', supportsLogX: true, reverseX: true, reverseY: false, logY: false, showsEfforts: false, ySplit: 0.75},
  {
    key: 'responseVsIntel',
    label: 'Response Time vs Intelligence',
    supportsLogX: true,
    reverseX: true,
    reverseY: false,
    logY: false,
    showsEfforts: true,
    ySplit: 0.75
  },
  {
    key: 'costVsResponse',
    label: 'Cost vs Response Time',
    supportsLogX: true,
    reverseX: true,
    reverseY: true,
    logY: true,
    showsEfforts: true,
    ySplit: 0.5
  },
  {
    key: 'speed',
    label: 'Tokens/s vs Intelligence',
    supportsLogX: false,
    reverseX: false,
    reverseY: false,
    logY: false,
    showsEfforts: true,
    ySplit: 0.75
  },
  {
    key: 'responseVsSpeed',
    label: 'Response Time vs Speed',
    supportsLogX: true,
    reverseX: true,
    reverseY: false,
    logY: false,
    showsEfforts: true,
    ySplit: 0.5
  },
  {
    key: 'context',
    label: 'Context vs Intelligence',
    supportsLogX: true,
    reverseX: false,
    reverseY: false,
    logY: false,
    showsEfforts: false,
    ySplit: 0.75
  },
  {
    key: 'release',
    label: 'Release vs Intelligence',
    supportsLogX: false,
    reverseX: false,
    reverseY: false,
    logY: false,
    showsEfforts: false,
    ySplit: 0.75
  },
];

function plotTypeDef(plotType: PlotType): PlotTypeDef {
  return PLOT_TYPES.find(p => p.key === plotType)!;
}

/** Whole powers of two around min and max, at least one apart, so a single value at a power of two gets an axis. */
function log2Bounds(min: number, max: number): { min: number; max: number } {
  const lo = Math.floor(Math.log2(min));
  return {min: lo, max: Math.max(lo + 1, Math.ceil(Math.log2(max)))};
}

function hasRunCostX(plotType: PlotType): boolean {
  return plotType === 'cost' || plotType === 'costVsResponse';
}

@Component({
  selector: 'app-scatter-plot',
  standalone: true,
  imports: [MissingDataHintComponent, OutdatedBenchmarkHintComponent],
  templateUrl: './scatter-plot.html',
  styleUrl: './scatter-plot.scss',
})
export class ScatterPlotComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', {static: true}) canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly state = inject(AppState);
  readonly themeState = inject(ThemeState);
  private chart?: Chart;

  private readonly starIcon = computed(() =>
    makeStarImage(getPlotColors(this.themeState.theme()).axisBest, STAR_SIZE, () => this.chart?.update('none')));

  readonly plotTypes = PLOT_TYPES;
  readonly currentPlotDef = computed(() => plotTypeDef(this.state.plotType()));

  /** True while the current plot type shows the effort levels. */
  readonly effortsShown = computed(() => this.currentPlotDef().showsEfforts);

  private getXY(m: AiModel, plotType: PlotType): { x: number | null; y: number | null } {
    const intel = m.overallIntelligence;
    const responseTime = responseTimeOf(m);

    switch (plotType) {
      case 'release':
        return {x: releaseTimeOf(m), y: intel};
      case 'context':
        return {x: m.contextWindow, y: intel};
      case 'speed':
        return {x: m.tokensPerSecond, y: intel};
      case 'responseVsIntel':
        return {x: responseTime, y: intel};
      case 'responseVsSpeed':
        return {x: responseTime, y: m.tokensPerSecond};
      case 'cost':
        return {x: m.costsToRun === 0 ? 0.001 : m.costsToRun, y: intel};
      case 'costVsResponse':
        return {x: m.costsToRun === 0 ? 0.001 : m.costsToRun, y: responseTime};
      default: { // price
        const price = blendedPriceOf(m);
        return {x: price === 0 ? 0.001 : price, y: intel};
      }
    }
  }

  private plotXY(m: AiModel, plotType: PlotType): { x: number; y: number } | null {
    const {x, y} = this.getXY(m, plotType);
    return x === null || y === null ? null : {x, y};
  }

  /** The filtered models that have both values of the current plot type, in chart order. */
  private readonly plottable = computed(() => {
    const plotType = this.state.plotType();
    return this.state.filteredModels().flatMap(m => {
      const xy = this.plotXY(m, plotType);
      return xy ? [{model: m, ...xy}] : [];
    });
  });

  /** The median x and the `ySplit` percentile y of all models with both values of the current plot type, before any filter. */
  readonly zoneSplit = computed<{ x: number; y: number } | null>(() => {
    const plotType = this.state.plotType();
    const points = this.state.allModels().flatMap(m => {
      const xy = this.plotXY(m, plotType);
      return xy ? [xy] : [];
    });
    const x = median(points.map(p => p.x));
    const y = percentile(points.map(p => p.y), plotTypeDef(plotType).ySplit);
    return x === null || y === null ? null : {x, y};
  });

  /** The plottable models, only the Pareto set while the Pareto filter is on. */
  readonly plotted = computed(() => {
    if (!this.state.showOnlyPareto()) return this.plottable();
    const useful = this.usefulIds();
    return this.plottable().filter(p => useful.has(p.model.id));
  });

  readonly missingModels = computed(() => {
    const shown = new Set(this.plottable().map(p => p.model.id));
    return this.state.filteredModels().filter(m => !shown.has(m.id));
  });

  /** The plotted models, for the outdated benchmark hint. */
  readonly plottedModels = computed(() => this.plotted().map(p => p.model));

  /** The effort points of each plottable model with two or more, while the plot type shows effort levels. */
  private readonly allEffortPoints = computed(() => this.effortPointsOf(this.plottable().map(p => p.model)));

  private effortPointsOf(models: AiModel[]): { model: AiModel; points: EffortPoint[] }[] {
    if (!this.effortsShown()) return [];
    const plotType = this.state.plotType();
    return models.flatMap(model => {
      const points = effortPoints(model, plotType);
      return points.length < 2 ? [] : [{model, points}];
    });
  }

  /** The effort points, only the Pareto points and only curves with such a level while the Pareto filter is on. */
  private readonly plottedEffortPoints = computed<{ model: AiModel; points: EffortPoint[] }[]>(() => {
    const all = this.allEffortPoints();
    if (!this.state.showOnlyPareto()) return all;
    const useful = this.usefulIds();
    return all.flatMap(({model, points}) => {
      const shown = points.filter(p => useful.has(p.current ? model.id : effortVariantId(model.id, p.effort)));
      return shown.some(p => !p.current) ? [{model, points: shown}] : [];
    });
  });

  /** The non-deprecated model points and their other effort points, which compete for the Pareto set and the markers. */
  private readonly rankedPoints = computed(() =>
    this.rankedPointsOf(this.plottable(), this.allEffortPoints()));

  /** The ranked points of all non-deprecated models in the database, before any filter; they set the best balanced bounds. */
  private readonly allRankedPoints = computed(() => {
    const plotType = this.state.plotType();
    const models = this.state.allModels().flatMap(m => {
      const xy = this.plotXY(m, plotType);
      return xy ? [{model: m, ...xy}] : [];
    });
    return this.rankedPointsOf(models, this.effortPointsOf(models.map(p => p.model)));
  });

  private rankedPointsOf(
    models: { model: AiModel; x: number; y: number }[],
    curves: { model: AiModel; points: EffortPoint[] }[],
  ): { id: string; x: number; y: number }[] {
    const pts = models.filter(p => !p.model.deprecated).map(p => ({id: p.model.id, x: p.x, y: p.y}));
    const levelPts = curves
      .filter(c => !c.model.deprecated)
      .flatMap(c => c.points.filter(p => !p.current).map(p => ({id: effortVariantId(c.model.id, p.effort), x: p.x, y: p.y})));
    return pts.concat(levelPts);
  }

  /** Pareto set on the two axes of the current plot type. Effort levels have the id `<model id>@<effort>`. */
  readonly usefulIds = computed(() => {
    const plotDef = this.currentPlotDef();
    return paretoIds(this.rankedPoints(), [
      {get: p => p.x, higherIsBetter: !plotDef.reverseX},
      {get: p => p.y, higherIsBetter: !plotDef.reverseY},
    ]);
  });

  readonly specialMarkers2d = computed<{ axisBestIds: Set<string>; balancedId: string | null }>(() => {
    const candidates = this.rankedPoints();
    if (candidates.length === 0) return {axisBestIds: new Set(), balancedId: null};
    const plotDef = this.currentPlotDef();
    const higherXIsBetter = !plotDef.reverseX;
    const higherYIsBetter = !plotDef.reverseY;

    const bestOn = (key: 'x' | 'y', higherIsBetter: boolean): string | null => {
      let bestId: string | null = null;
      let bestVal = higherIsBetter ? -Infinity : Infinity;
      for (const p of candidates) {
        const v = p[key];
        if (!Number.isFinite(v)) continue;
        if (higherIsBetter ? v > bestVal : v < bestVal) {
          bestVal = v;
          bestId = p.id;
        }
      }
      return bestId;
    };

    const axisBestIds = new Set<string>();
    const bx = bestOn('x', higherXIsBetter);
    const by = bestOn('y', higherYIsBetter);
    if (bx) axisBestIds.add(bx);
    if (by) axisBestIds.add(by);

    const balancedId = bestBalancedId(candidates, [
      {get: p => p.x, higherIsBetter: higherXIsBetter, log: this.isLogX(this.state.plotType())},
      {get: p => p.y, higherIsBetter: higherYIsBetter, log: plotDef.logY},
    ], this.allRankedPoints());

    return {axisBestIds, balancedId};
  });

  private isLogX(plotType: PlotType): boolean {
    return this.state.logScaleX() && plotTypeDef(plotType).supportsLogX;
  }

  private transformX(x: number, plotType: PlotType): number {
    return this.isLogX(plotType) && x > 0 ? Math.log2(x) : x;
  }

  private transformY(y: number, plotType: PlotType): number {
    return plotTypeDef(plotType).logY && y > 0 ? Math.log2(y) : y;
  }

  readonly plotData = computed(() => {
    const plotted = this.plotted();
    const plotType = this.state.plotType();
    const useful = this.usefulIds();
    const {axisBestIds, balancedId} = this.specialMarkers2d();
    const colors = getPlotColors(this.themeState.theme());
    const starIcon = this.starIcon();

    return plotted.map(({model: m, x, y}) => {
      if (m.deprecated) {
        return {
          x: this.transformX(x, plotType), y: this.transformY(y, plotType), label: m.publicName,
          color: colors.deprecated,
          pointStyle: (m.localModel ? 'triangle' : 'circle') as string | HTMLImageElement,
          radius: 6,
          isUseful: false,
          hollow: hasRunCostX(plotType) && m.tokensPerRunEstimated,
          balanced: false,
          axisBest: false,
        };
      }

      let color = m.localModel ? colors.local : colors.api;
      let pointStyle: string | HTMLImageElement = m.localModel ? 'triangle' : 'circle';
      const isUseful = useful.has(m.id);
      const axisBest = axisBestIds.has(m.id);
      const balanced = m.id === balancedId;
      if (isUseful) color = colors.useful;
      if (axisBest) {
        pointStyle = starIcon;
        color = colors.axisBest;
      }
      if (balanced) {
        pointStyle = 'rectRot';
        color = colors.balanced;
      }
      const radius = modelPointRadius({balanced, axisBest, useful: isUseful});

      const hollow = hasRunCostX(plotType) && m.tokensPerRunEstimated;
      return {
        x: this.transformX(x, plotType),
        y: this.transformY(y, plotType),
        label: m.publicName,
        color,
        pointStyle,
        radius,
        isUseful,
        hollow,
        balanced,
        axisBest
      };
    });
  });

  readonly hasEfforts = computed(() => this.state.allModels().some(m => m.efforts.length > 1));

  readonly effortCurves = computed<EffortCurve[]>(() => {
    const plotType = this.state.plotType();
    const colors = getPlotColors(this.themeState.theme());
    const useful = this.usefulIds();
    const {axisBestIds, balancedId} = this.specialMarkers2d();
    const plotData = this.plotData();
    const modelPoint = new Map(this.plotted().map((p, i) => [p.model.id, plotData[i]]));
    return this.plottedEffortPoints().map(({model: m, points}) => ({
      model: m,
      color: m.deprecated ? colors.deprecated : m.localModel ? colors.local : colors.api,
      points: points.map(p => {
        const id = effortVariantId(m.id, p.effort);
        const role = {
          useful: !p.current && useful.has(id),
          axisBest: !p.current && axisBestIds.has(id),
          balanced: !p.current && balancedId === id,
        };
        return {
          ...p,
          ...role,
          px: this.transformX(p.x, plotType),
          py: this.transformY(p.y, plotType),
          label: modelPoint.has(m.id) ? shortEffortLabel(p.effort) : `${m.publicName} ${shortEffortLabel(p.effort)}`,
          ...this.effortLabelPlace(role, p.current ? modelPoint.get(m.id) : undefined),
        };
      }),
    }));
  });

  private effortLabelPlace(role: MarkerRole, modelPoint?: { isUseful: boolean; axisBest: boolean; balanced: boolean; radius: number }) {
    if (!modelPoint) return {labelRole: role, labelRadius: effortPointRadius(role)};
    const {isUseful: useful, axisBest, balanced, radius} = modelPoint;
    return {labelRole: {useful, axisBest, balanced}, labelRadius: radius};
  }

  /** The raw values of the filtered model and effort points before the Pareto filter; the axes fit them. */
  private readonly shownAxisData = computed(() => {
    const main = this.plottable().map(({x, y}) => ({x, y}));
    return main.concat(this.allEffortPoints().flatMap(c => c.points.map(({x, y}) => ({x, y}))));
  });

  readonly yBounds = computed(() => {
    const plotType = this.state.plotType();

    if (plotTypeDef(plotType).logY) {
      const ys = this.shownAxisData().map(d => d.y).filter(y => y > 0);
      if (ys.length === 0) return {min: 0, max: 8};
      return log2Bounds(Math.min(...ys), Math.max(...ys));
    }

    if (plotType === 'responseVsSpeed') {
      const ys = this.shownAxisData().map(d => d.y);
      if (ys.length === 0) return {min: 0, max: 150};
      const range = Math.max(...ys) - Math.min(...ys) || 1;
      return {
        min: Math.max(0, Math.floor(Math.min(...ys) - range * 0.05)),
        max: Math.ceil(Math.max(...ys) + range * 0.05),
      };
    }

    const ys = this.shownAxisData().map(d => d.y);
    if (ys.length === 0) return {min: 0, max: 100};
    const pad = 3;
    return {
      min: Math.max(0, Math.floor(Math.min(...ys) - pad)),
      max: Math.min(100, Math.ceil(Math.max(...ys) + pad)),
    };
  });

  readonly xBounds = computed(() => {
    const xs = this.shownAxisData().map(d => d.x);
    if (xs.length === 0) return {min: undefined, max: undefined};
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const plotType = this.state.plotType();

    if (plotType === 'release') {
      const range = maxX - minX || 1;
      return {min: minX - range * 0.05, max: Date.now()};
    }

    if (this.isLogX(plotType) && minX > 0) return log2Bounds(minX, maxX);

    const range = maxX - minX || 1;
    return {min: Math.max(0, minX - range * 0.05), max: maxX + range * 0.05};
  });

  constructor() {
    effect(() => {
      const data = this.plotData();
      const curves = this.effortCurves();
      const logScale = this.state.logScaleX();
      const bounds = this.yBounds();
      const xBounds = this.xBounds();
      const plotType = this.state.plotType();
      this.updateChart(data, curves, logScale, bounds, xBounds, plotType);
    });
  }

  ngOnInit(): void {
    this.initChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private zoneMidPixels(chart: Chart): { xMid: number; yMid: number } | null {
    const xAxis = chart.scales['x'];
    const yAxis = chart.scales['y'];
    const split = this.zoneSplit();
    if (!xAxis || !yAxis || !split) return null;
    const plotType = this.state.plotType();
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    return {
      xMid: clamp(xAxis.getPixelForValue(this.transformX(split.x, plotType)), xAxis.left, xAxis.right),
      yMid: clamp(yAxis.getPixelForValue(this.transformY(split.y, plotType)), yAxis.top, yAxis.bottom),
    };
  }

  /** The label color, darkened by `attractiveTextShade` where the pixel lies in the "Most attractive" zone. */
  labelColorAt(chart: Chart, color: string, x: number, y: number): string {
    const mid = this.zoneMidPixels(chart);
    const shade = getPlotColors(this.themeState.theme()).attractiveTextShade;
    const inZone = !!mid && x >= mid.xMid && x <= chart.scales['x'].right && y >= chart.scales['y'].top && y <= mid.yMid;
    return inZone ? darken(color, shade) : color;
  }

  /** The text color of a model label: the marker color, with `usefulLabel` and `axisBestLabel` for the yellow points. */
  pointLabelColor(markerColor: string): string {
    const colors = getPlotColors(this.themeState.theme());
    if (markerColor === colors.useful) return colors.usefulLabel;
    if (markerColor === colors.axisBest) return colors.axisBestLabel;
    return markerColor;
  }

  effortLabelColor(curve: EffortCurve, p: MarkerRole): string {
    const colors = getPlotColors(this.themeState.theme());
    return p.balanced ? colors.balanced : p.axisBest ? colors.axisBestLabel : p.useful ? colors.usefulLabel : curve.color;
  }

  private quadrantPlugin(): Plugin {
    return {
      id: 'quadrantBackground',
      beforeDraw: (chart: Chart) => {
        const ctx = chart.ctx;
        const xAxis = chart.scales['x'];
        const yAxis = chart.scales['y'];
        if (!xAxis || !yAxis) return;

        const mid = this.zoneMidPixels(chart);
        if (!mid) return;

        const {left, right} = xAxis;
        const {top, bottom} = yAxis;
        const {xMid, yMid} = mid;
        const colors = getPlotColors(this.themeState.theme());

        ctx.save();

        // Most attractive is always upper-right
        ctx.font = '10px system-ui, sans-serif';
        if (right > xMid && yMid > top) {
          ctx.fillStyle = colors.attractiveFill;
          ctx.fillRect(xMid, top, right - xMid, yMid - top);
          ctx.fillStyle = colors.attractiveLabel;
          ctx.textAlign = 'right';
          ctx.fillText('Most attractive', right - 6, top + 14);
        }
        if (xMid > left && bottom > yMid) {
          ctx.fillStyle = colors.unattractiveFill;
          ctx.fillRect(left, yMid, xMid - left, bottom - yMid);
          ctx.fillStyle = colors.unattractiveLabel;
          ctx.textAlign = 'left';
          ctx.fillText('Least attractive', left + 6, bottom - 6);
        }

        ctx.restore();
      },
    };
  }

  private labelPlugin(): Plugin {
    return {
      id: 'labelPlugin',
      afterDatasetsDraw: (chart: Chart) => {
        const ctx = chart.ctx;
        const points = this.plotData();
        const xAxis = chart.scales['x'];
        const yAxis = chart.scales['y'];
        if (!xAxis || !yAxis) return;

        const positions = points.map(p => ({
          px: xAxis.getPixelForValue(p.x),
          py: yAxis.getPixelForValue(p.y),
          label: p.label,
          color: this.pointLabelColor(p.color),
          balanced: p.balanced,
          axisBest: p.axisBest,
          useful: p.isUseful,
          radius: p.radius,
        })).sort((a, b) => markerRank(b) - markerRank(a));

        const usedRects: { x1: number; y1: number; x2: number; y2: number }[] = positions
          .filter(pos => pos.balanced)
          .map(pos => ({x1: pos.px - pos.radius, y1: pos.py - pos.radius, x2: pos.px + pos.radius, y2: pos.py + pos.radius}));

        ctx.save();
        ctx.textAlign = 'center';

        for (const pos of positions) {
          ctx.font = modelLabelFont(pos);
          const labelW = ctx.measureText(pos.label).width + 4;
          const labelH = markerRank(pos) > 0 ? 16 : 12;
          const labelX = pos.px;
          let labelY = pos.py - 10;

          let placed = false;
          for (const baseline of labelBaselines(pos.py, pos.radius, labelH)) {
            labelY = baseline;
            const rect = {x1: labelX - labelW / 2, y1: labelY - labelH, x2: labelX + labelW / 2, y2: labelY};
            const overlaps = usedRects.some(r =>
              !(rect.x2 < r.x1 || rect.x1 > r.x2 || rect.y2 < r.y1 || rect.y1 > r.y2)
            );
            if (!overlaps) {
              usedRects.push(rect);
              placed = true;
              break;
            }
          }
          if (!placed) {
            const rect = {x1: labelX - labelW / 2, y1: labelY - labelH, x2: labelX + labelW / 2, y2: labelY};
            usedRects.push(rect);
          }

          ctx.fillStyle = this.labelColorAt(chart, pos.color, labelX, labelY - labelH / 2);
          ctx.fillText(pos.label, labelX, labelY);
        }

        ctx.restore();
      },
    };
  }

  private effortLabelPlugin(): Plugin {
    return {
      id: 'effortLabels',
      afterDatasetsDraw: (chart: Chart) => {
        const xAxis = chart.scales['x'];
        const yAxis = chart.scales['y'];
        if (!xAxis || !yAxis) return;
        const ctx = chart.ctx;
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        for (const curve of this.effortCurves()) {
          for (const p of curve.points) {
            const color = this.effortLabelColor(curve, p.labelRole);
            ctx.font = effortLabelFont(p.labelRole);
            const offset = effortLabelOffset(p.labelRadius);
            const x = xAxis.getPixelForValue(p.px) + offset.dx;
            const y = yAxis.getPixelForValue(p.py) + offset.dy;
            ctx.fillStyle = this.labelColorAt(chart, color, x, y);
            ctx.fillText(p.label, x, y);
          }
        }
        ctx.restore();
      },
    };
  }

  private borderColorOf(d: { color: string; hollow: boolean; balanced: boolean }): string {
    return d.balanced && !d.hollow ? getPlotColors(this.themeState.theme()).balancedRing : d.color;
  }

  private borderWidthOf(d: { hollow: boolean; balanced: boolean }): number {
    return d.balanced ? BALANCED_BORDER_WIDTH : d.hollow ? 1.5 : 1;
  }

  private effortDatasets(curves: EffortCurve[]): ChartDataset<'scatter'>[] {
    const {useful, balanced, balancedRing, axisBest} = getPlotColors(this.themeState.theme());
    const pointColor = (c: EffortCurve, p: EffortCurve['points'][number]) =>
      p.balanced ? balanced : p.axisBest ? axisBest : p.useful ? useful : c.color;
    const starIcon = this.starIcon();
    return curves.map(c => ({
      label: c.model.publicName,
      data: c.points.map(p => ({x: p.px, y: p.py})),
      showLine: true,
      borderColor: c.color,
      backgroundColor: c.points.map(p => pointColor(c, p)),
      pointBorderColor: c.points.map(p => p.balanced ? balancedRing : pointColor(c, p)),
      pointBorderWidth: c.points.map(p => p.balanced ? BALANCED_BORDER_WIDTH : 1),
      pointStyle: c.points.map(p => p.balanced ? 'rectRot' : p.axisBest ? starIcon : 'circle'),
      borderWidth: 1.5,
      borderDash: [4, 3],
      pointRadius: c.points.map(effortPointRadius),
      pointHoverRadius: c.points.map(p => effortPointRadius(p) + 2),
      order: 1,
    }));
  }

  private xAxisConfig(plotType: PlotType, logScale: boolean, xBounds: {
    min: number | undefined;
    max: number | undefined
  }, reverseX: boolean = false) {
    let title: string;
    let tickCallback: (v: any) => string;
    let axisType: string;

    switch (plotType) {
      case 'release':
        title = 'Release Date';
        tickCallback = (v: any) => new Date(+v).toLocaleDateString('en-US', {month: 'short', year: 'numeric'});
        axisType = 'linear';
        break;
      case 'context':
        title = 'Context Window (tokens)';
        tickCallback = (v: any) => {
          const n = +v;
          if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
          if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
          return String(n);
        };
        axisType = 'linear';
        break;
      case 'speed':
        title = 'Tokens Per Second';
        tickCallback = (v: any) => `${(+v).toFixed(0)}`;
        axisType = 'linear';
        break;
      case 'responseVsIntel':
      case 'responseVsSpeed':
        title = 'Response Time until first 500 tokens (s)';
        tickCallback = (v: any) => `${(+v).toFixed(1)}s`;
        axisType = 'linear';
        break;
      case 'cost':
      case 'costVsResponse':
        title = 'Cost per Index Run (USD), hollow: estimated tokens';
        tickCallback = (v: any) => formatUsdTick(+v);
        axisType = 'linear';
        break;
      default: // price
        title = `Blended Price (USD per 1M tokens, usage mix ${priceBlendLabel()})`;
        tickCallback = (v: any) => formatUsdTick(+v);
        axisType = 'linear';
    }

    let stepSize: number | undefined;
    if (logScale && plotTypeDef(plotType).supportsLogX) {
      const baseCallback = tickCallback;
      tickCallback = (v: any) => baseCallback(Math.pow(2, +v));
      stepSize = 1;
    }

    return {
      type: axisType,
      min: xBounds.min,
      max: xBounds.max,
      reverse: reverseX,
      title: {display: true, text: title, color: '#888', font: {size: 13}},
      ticks: {color: '#888', font: {size: 10}, callback: tickCallback, stepSize},
      grid: {color: 'rgba(128,128,128,0.1)'},
    };
  }

  private yAxisLabel(plotType: PlotType): string {
    if (plotType === 'costVsResponse') return 'Response Time until first 500 tokens (s)';
    return plotType === 'responseVsSpeed' ? 'Tokens Per Second' : 'Intelligence Score';
  }

  private yTickCallback(plotType: PlotType): any {
    if (plotType !== 'costVsResponse') return Ticks.formatters.numeric;
    return (v: any) => {
      const seconds = Math.pow(2, +v);
      return seconds >= 1 ? `${seconds.toFixed(0)}s` : `${seconds}s`;
    };
  }

  private yStepSize(plotType: PlotType): number | undefined {
    return plotTypeDef(plotType).logY ? 1 : undefined;
  }

  private initChart(): void {
    const ctx = this.canvasRef.nativeElement.getContext('2d')!;
    const data = this.plotData();
    const logScale = this.state.logScaleX();
    const bounds = this.yBounds();
    const xBounds = this.xBounds();
    const plotType = this.state.plotType();

    const config: ChartConfiguration<'scatter'> = {
      type: 'scatter',
      plugins: [this.quadrantPlugin(), this.effortLabelPlugin(), this.labelPlugin()],
      data: {
        datasets: [{
          label: 'Models',
          data: data.map(d => ({x: d.x, y: d.y})),
          backgroundColor: data.map(d => d.hollow ? 'transparent' : d.color),
          borderColor: data.map(d => this.borderColorOf(d)),
          pointBorderWidth: data.map(d => this.borderWidthOf(d)),
          pointStyle: data.map(d => d.pointStyle) as any,
          pointRadius: data.map(d => d.radius),
          pointHoverRadius: data.map(d => d.radius + 3),
          order: 0,
        }, ...this.effortDatasets(this.effortCurves())],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {duration: 200},
        layout: {padding: {top: 10, right: 10, bottom: 10, left: 10}},
        plugins: {
          legend: {display: false},
          tooltip: {
            backgroundColor: 'rgba(30, 30, 40, 0.97)',
            callbacks: {
              label: (ctx) => this.buildTooltipLines(ctx.datasetIndex, ctx.dataIndex, plotType),
            },
          },
        },
        scales: {
          x: this.xAxisConfig(plotType, logScale, xBounds, this.currentPlotDef().reverseX) as any,
          y: {
            min: bounds.min,
            max: bounds.max,
            reverse: this.currentPlotDef().reverseY,
            title: {display: true, text: this.yAxisLabel(plotType), color: '#888', font: {size: 13}},
            ticks: {color: '#888', font: {size: 10}, callback: this.yTickCallback(plotType), stepSize: this.yStepSize(plotType)},
            grid: {color: 'rgba(128,128,128,0.1)'},
          },
        },
      },
    };

    this.chart = new Chart(ctx, config);
  }

  private buildTooltipLines(datasetIndex: number, dataIndex: number, _plotType: PlotType): string[] {
    if (datasetIndex > 0) return this.buildEffortTooltipLines(datasetIndex - 1, dataIndex);
    const model = this.plotted()[dataIndex]?.model;
    if (!model) return [];
    return buildModelTooltipLines(model, this.state.latestBenchmarkVersion());
  }

  private buildEffortTooltipLines(curveIndex: number, pointIndex: number): string[] {
    const curve = this.effortCurves()[curveIndex];
    const point = curve?.points[pointIndex];
    if (!point) return [];
    const l = point.level;
    const responseTime = effortResponseTime(l);
    return [
      `${curve.model.publicName} (effort: ${point.effort}${point.current ? ', shown' : ''})`,
      point.balanced ? '★ Best balanced' : '',
      point.axisBest ? '★ Best on an axis' : '',
      point.useful ? '★ Pareto efficient' : '',
      intelligenceLine(l.overallIntelligence, curve.model, this.state.latestBenchmarkVersion()),
      l.tokensPerSecond !== null ? `★ Speed: ${l.tokensPerSecond} tok/s` : '',
      responseTime !== null
        ? `★ Response time: ${responseTime.toFixed(1)}s (in: ${l.inputProcessingTime}s, think: ${l.thinkingTime}s, out: ${l.outputTime}s)`
        : '',
      l.costsToRun !== null ? `★ Run cost: ${formatUsd(l.costsToRun)} per index run` : '',
      l.tokensPerRun !== null ? `Tokens per run: ${l.tokensPerRun}M` : '',
    ].filter(Boolean);
  }

  private updateChart(
    data: {
      x: number;
      y: number;
      label: string;
      color: string;
      pointStyle: string | HTMLImageElement;
      radius: number;
      isUseful: boolean;
      hollow: boolean;
      balanced: boolean;
      axisBest: boolean
    }[],
    curves: EffortCurve[],
    logScale: boolean,
    bounds: { min: number; max: number },
    xBounds: { min: number | undefined; max: number | undefined },
    plotType: PlotType,
  ): void {
    if (!this.chart) return;

    this.chart.data.datasets[0].data = data.map(d => ({x: d.x, y: d.y}));
    (this.chart.data.datasets[0] as any).backgroundColor = data.map(d => d.hollow ? 'transparent' : d.color);
    (this.chart.data.datasets[0] as any).borderColor = data.map(d => this.borderColorOf(d));
    (this.chart.data.datasets[0] as any).pointBorderWidth = data.map(d => this.borderWidthOf(d));
    (this.chart.data.datasets[0] as any).pointStyle = data.map(d => d.pointStyle);
    (this.chart.data.datasets[0] as any).pointRadius = data.map(d => d.radius);
    (this.chart.data.datasets[0] as any).pointHoverRadius = data.map(d => d.radius + 3);
    this.chart.data.datasets.splice(1, this.chart.data.datasets.length - 1, ...this.effortDatasets(curves));

    const xConf = this.xAxisConfig(plotType, logScale, xBounds, this.currentPlotDef().reverseX);
    const xScale = this.chart.options.scales!['x'] as any;
    xScale.type = xConf.type;
    xScale.min = xConf.min;
    xScale.max = xConf.max;
    xScale.reverse = xConf.reverse;
    xScale.title.text = xConf.title.text;
    xScale.ticks.callback = xConf.ticks.callback;

    const yScale = this.chart.options.scales!['y'] as any;
    yScale.min = bounds.min;
    yScale.max = bounds.max;
    yScale.reverse = this.currentPlotDef().reverseY;
    yScale.title.text = this.yAxisLabel(plotType);
    yScale.ticks.callback = this.yTickCallback(plotType);
    yScale.ticks.stepSize = this.yStepSize(plotType);

    (this.chart.options.plugins!.tooltip as any).callbacks = {
      label: (ctx: any) => this.buildTooltipLines(ctx.datasetIndex, ctx.dataIndex, plotType),
    };

    this.chart.update('none');
  }
}
