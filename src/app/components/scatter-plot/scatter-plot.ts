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
  Tooltip
} from 'chart.js';
import {AppState} from '../../state/app.state';
import {ThemeState} from '../../state/theme.state';
import {AiModel, blendedPriceOf, PRICE_BLEND, responseTimeOf} from '../../models/ai-model.model';
import {buildModelTooltipLines} from '../../models/tooltip.util';
import {getPlotColors} from '../../models/plot-colors';
import {bestBalancedId} from '../../models/balanced.util';
import {PlotType} from '../../models/view-types';
import {EffortPoint, effortPoints, effortResponseTime, shortEffortLabel} from '../../models/effort.util';
import {MissingDataHintComponent} from '../missing-data-hint/missing-data-hint';

Chart.register(ScatterController, PointElement, LineElement, LinearScale, LogarithmicScale, Tooltip, Legend);

interface EffortCurve {
  model: AiModel;
  color: string;
  points: (EffortPoint & { px: number })[];
}

function makeStarImage(color: string, size: number): HTMLImageElement {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">` +
    `<polygon fill="${color}" points="50,2 61,38 98,38 68,60 79,96 50,74 21,96 32,60 2,38 39,38"/></svg>`;
  const img = new Image(size, size);
  img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  return img;
}

interface PlotTypeDef {
  key: PlotType;
  label: string;
  supportsLogX: boolean;
  reverseX: boolean;
}

const PLOT_TYPES: PlotTypeDef[] = [
  {key: 'price', label: 'Price vs Intelligence', supportsLogX: true, reverseX: true},
  {key: 'release', label: 'Release vs Intelligence', supportsLogX: false, reverseX: false},
  {key: 'context', label: 'Context vs Intelligence', supportsLogX: true, reverseX: false},
  {key: 'speed', label: 'Tokens/s vs Intelligence', supportsLogX: false, reverseX: false},
  {key: 'responseVsIntel', label: 'Response Time vs Intelligence', supportsLogX: false, reverseX: true},
  {key: 'responseVsSpeed', label: 'Response Time vs Speed', supportsLogX: false, reverseX: true},
];

@Component({
  selector: 'app-scatter-plot',
  standalone: true,
  imports: [MissingDataHintComponent],
  templateUrl: './scatter-plot.html',
  styleUrl: './scatter-plot.scss',
})
export class ScatterPlotComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', {static: true}) canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly state = inject(AppState);
  readonly themeState = inject(ThemeState);
  private chart?: Chart;

  private readonly starIcon = computed(() => makeStarImage(getPlotColors(this.themeState.theme()).axisBest, 22));

  readonly plotTypes = PLOT_TYPES;
  readonly currentPlotDef = computed(() => PLOT_TYPES.find(p => p.key === this.state.plotType())!);

  private getXY(m: AiModel, plotType: PlotType): { x: number | null; y: number | null } {
    const intel = m.overallIntelligence;
    const responseTime = responseTimeOf(m);

    switch (plotType) {
      case 'release':
        return {x: new Date(m.releaseDate).getTime(), y: intel};
      case 'context':
        return {x: m.contextWindow, y: intel};
      case 'speed':
        return {x: m.tokensPerSecond, y: intel};
      case 'responseVsIntel':
        return {x: responseTime, y: intel};
      case 'responseVsSpeed':
        return {x: responseTime, y: m.tokensPerSecond};
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
  readonly plotted = computed(() => {
    const plotType = this.state.plotType();
    return this.state.filteredModels().flatMap(m => {
      const xy = this.plotXY(m, plotType);
      return xy ? [{model: m, ...xy}] : [];
    });
  });

  readonly missingModels = computed(() => {
    const shown = new Set(this.plotted().map(p => p.model.id));
    return this.state.filteredModels().filter(m => !shown.has(m.id));
  });

  readonly specialMarkers2d = computed<{ axisBestIds: Set<string>; balancedId: string | null }>(() => {
    const active = this.plotted().filter(p => !p.model.deprecated);
    if (active.length === 0) return {axisBestIds: new Set(), balancedId: null};
    const models = active.map(p => p.model);
    const pts = active.map(p => ({id: p.model.id, x: p.x, y: p.y}));
    const byId = new Map(pts.map(p => [p.id, p]));
    const plotDef = this.currentPlotDef();
    const higherXIsBetter = !plotDef.reverseX;
    const higherYIsBetter = true;

    const bestOn = (key: 'x' | 'y', higherIsBetter: boolean): string | null => {
      let bestId: string | null = null;
      let bestVal = higherIsBetter ? -Infinity : Infinity;
      for (const p of pts) {
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

    const balancedId = bestBalancedId(models, [
      {get: m => byId.get(m.id)!.x, higherIsBetter: higherXIsBetter},
      {get: m => byId.get(m.id)!.y, higherIsBetter: higherYIsBetter},
    ]);

    return {axisBestIds, balancedId};
  });

  private isLogX(plotType: PlotType): boolean {
    return this.state.logScaleX() && (plotType === 'price' || plotType === 'context');
  }

  private transformX(x: number, plotType: PlotType): number {
    return this.isLogX(plotType) && x > 0 ? Math.log2(x) : x;
  }

  readonly plotData = computed(() => {
    const plotted = this.plotted();
    const showUseful = this.state.showUsefulModels();
    const plotType = this.state.plotType();
    const useful = plotType === 'price' ? this.state.usefulPriceModelIds() : this.state.usefulModelIds();
    const {axisBestIds, balancedId} = this.specialMarkers2d();
    const colors = getPlotColors(this.themeState.theme());
    const starIcon = this.starIcon();

    return plotted.map(({model: m, x, y}) => {
      if (m.deprecated) {
        return {
          x: this.transformX(x, plotType), y, label: m.publicName,
          color: colors.deprecated,
          pointStyle: (m.localModel ? 'triangle' : 'circle') as string | HTMLImageElement,
          radius: 6,
          isUseful: false,
        };
      }

      let color = m.localModel ? colors.local : colors.api;
      let pointStyle: string | HTMLImageElement = m.localModel ? 'triangle' : 'circle';
      let radius = 7;
      const isUseful = showUseful && useful.has(m.id);
      if (isUseful) color = colors.useful;
      if (axisBestIds.has(m.id)) {
        pointStyle = starIcon;
        color = colors.axisBest;
        radius = 11;
      }
      if (m.id === balancedId) {
        pointStyle = 'rectRot';
        color = colors.balanced;
        radius = 10;
      }

      return {x: this.transformX(x, plotType), y, label: m.publicName, color, pointStyle, radius, isUseful};
    });
  });

  readonly hasEfforts = computed(() => this.state.allModels().some(m => m.efforts.length > 1));

  readonly effortCurves = computed<EffortCurve[]>(() => {
    if (!this.state.showEfforts()) return [];
    const plotType = this.state.plotType();
    const colors = getPlotColors(this.themeState.theme());
    const curves: EffortCurve[] = [];
    for (const {model: m} of this.plotted()) {
      const points = effortPoints(m, plotType);
      if (points.length < 2) continue;
      curves.push({
        model: m,
        color: m.deprecated ? colors.deprecated : m.localModel ? colors.local : colors.api,
        points: points.map(p => ({...p, px: this.transformX(p.x, plotType)})),
      });
    }
    return curves;
  });

  private readonly allAxisData = computed(() => {
    const models = this.state.allModels();
    const plotType = this.state.plotType();
    const main = models.flatMap(m => this.plotXY(m, plotType) ?? []);
    if (!this.state.showEfforts()) return main;
    return main.concat(models.flatMap(m => effortPoints(m, plotType).map(p => ({x: p.x, y: p.y}))));
  });

  readonly yBounds = computed(() => {
    const plotType = this.state.plotType();
    const models = this.state.allModels();

    if (plotType === 'responseVsSpeed') {
      const ys = this.allAxisData().map(d => d.y);
      if (ys.length === 0) return {min: 0, max: 150};
      const range = Math.max(...ys) - Math.min(...ys) || 1;
      return {
        min: Math.max(0, Math.floor(Math.min(...ys) - range * 0.05)),
        max: Math.ceil(Math.max(...ys) + range * 0.05),
      };
    }

    const ys = this.allAxisData().map(d => d.y);
    if (ys.length === 0) return {min: 0, max: 100};
    const pad = 3;
    return {
      min: Math.max(0, Math.floor(Math.min(...ys) - pad)),
      max: Math.min(100, Math.ceil(Math.max(...ys) + pad)),
    };
  });

  readonly xBounds = computed(() => {
    const xs = this.allAxisData().map(d => d.x);
    if (xs.length === 0) return {min: undefined, max: undefined};
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const plotType = this.state.plotType();

    if (plotType === 'release') {
      const range = maxX - minX || 1;
      return {min: minX - range * 0.05, max: Date.now()};
    }

    if (this.isLogX(plotType) && minX > 0) {
      return {
        min: Math.floor(Math.log2(minX)),
        max: Math.ceil(Math.log2(maxX)),
      };
    }

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

  private quadrantPlugin(): Plugin {
    return {
      id: 'quadrantBackground',
      beforeDraw: (chart: Chart) => {
        const ctx = chart.ctx;
        const xAxis = chart.scales['x'];
        const yAxis = chart.scales['y'];
        if (!xAxis || !yAxis) return;

        const {left, right} = xAxis;
        const {top, bottom} = yAxis;
        const xMid = (left + right) / 2;
        const yMid = (top + bottom) / 2;
        const colors = getPlotColors(this.themeState.theme());

        ctx.save();

        // Most attractive is always upper-right
        ctx.fillStyle = colors.attractiveFill;
        ctx.fillRect(xMid, top, right - xMid, yMid - top);
        ctx.fillStyle = colors.unattractiveFill;
        ctx.fillRect(left, yMid, xMid - left, bottom - yMid);
        ctx.font = '10px system-ui, sans-serif';
        ctx.fillStyle = colors.attractiveLabel;
        ctx.textAlign = 'right';
        ctx.fillText('Most attractive', right - 6, top + 14);
        ctx.fillStyle = colors.unattractiveLabel;
        ctx.textAlign = 'left';
        ctx.fillText('Least attractive', left + 6, bottom - 6);

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
          color: p.color,
        }));

        const usedRects: { x1: number; y1: number; x2: number; y2: number }[] = [];

        ctx.save();
        ctx.font = '13px system-ui, sans-serif';
        ctx.textAlign = 'center';

        for (const pos of positions) {
          const labelW = ctx.measureText(pos.label).width + 4;
          const labelH = 12;
          const labelX = pos.px;
          let labelY = pos.py - 10;

          let placed = false;
          const offsets = [0, -14, 14, -28, 28, -42, 42];
          for (const offset of offsets) {
            labelY = pos.py - 10 + offset;
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

          ctx.fillStyle = pos.color;
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
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        for (const curve of this.effortCurves()) {
          ctx.fillStyle = curve.color;
          for (const p of curve.points) {
            // The current level sits under the model point, which has its own label.
            if (p.current) continue;
            ctx.fillText(shortEffortLabel(p.effort), xAxis.getPixelForValue(p.px) + 5, yAxis.getPixelForValue(p.y) + 8);
          }
        }
        ctx.restore();
      },
    };
  }

  private effortDatasets(curves: EffortCurve[]): ChartDataset<'scatter'>[] {
    return curves.map(c => ({
      label: c.model.publicName,
      data: c.points.map(p => ({x: p.px, y: p.y})),
      showLine: true,
      borderColor: c.color,
      backgroundColor: c.color,
      borderWidth: 1.5,
      borderDash: [4, 3],
      pointRadius: 3,
      pointHoverRadius: 5,
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
      default: // price
        title = `Blended Price (USD per 1M tokens, ${PRICE_BLEND.cache}:${PRICE_BLEND.input}:${PRICE_BLEND.output} cache:input:output)`;
        tickCallback = (v: any) => `$${(+v).toFixed(2)}`;
        axisType = 'linear';
    }

    let stepSize: number | undefined;
    if (logScale && (plotType === 'price' || plotType === 'context')) {
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
    return plotType === 'responseVsSpeed' ? 'Tokens Per Second' : 'Intelligence Score';
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
          backgroundColor: data.map(d => d.color),
          borderColor: data.map(d => d.color),
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
            title: {display: true, text: this.yAxisLabel(plotType), color: '#888', font: {size: 13}},
            ticks: {color: '#888', font: {size: 10}},
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
    return buildModelTooltipLines(model);
  }

  private buildEffortTooltipLines(curveIndex: number, pointIndex: number): string[] {
    const curve = this.effortCurves()[curveIndex];
    const point = curve?.points[pointIndex];
    if (!point) return [];
    const l = point.level;
    const responseTime = effortResponseTime(l);
    return [
      `${curve.model.publicName} (effort: ${point.effort}${point.current ? ', shown' : ''})`,
      `★ Overall Intelligence: ${l.overallIntelligence}`,
      l.tokensPerSecond !== null ? `★ Speed: ${l.tokensPerSecond} tok/s` : '',
      responseTime !== null
        ? `★ Response time: ${responseTime.toFixed(1)}s (in: ${l.inputProcessingTime}s, think: ${l.thinkingTime}s, out: ${l.outputTime}s)`
        : '',
      l.costsToRun !== null ? `★ Run cost: $${l.costsToRun.toFixed(2)}` : '',
      l.tokensPerRun !== null ? `Tokens per run: ${l.tokensPerRun}M` : '',
    ].filter(Boolean);
  }

  private updateChart(
    data: { x: number; y: number; label: string; color: string; pointStyle: string | HTMLImageElement; radius: number; isUseful: boolean }[],
    curves: EffortCurve[],
    logScale: boolean,
    bounds: { min: number; max: number },
    xBounds: { min: number | undefined; max: number | undefined },
    plotType: PlotType,
  ): void {
    if (!this.chart) return;

    this.chart.data.datasets[0].data = data.map(d => ({x: d.x, y: d.y}));
    (this.chart.data.datasets[0] as any).backgroundColor = data.map(d => d.color);
    (this.chart.data.datasets[0] as any).borderColor = data.map(d => d.color);
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
    yScale.title.text = this.yAxisLabel(plotType);

    (this.chart.options.plugins!.tooltip as any).callbacks = {
      label: (ctx: any) => this.buildTooltipLines(ctx.datasetIndex, ctx.dataIndex, plotType),
    };

    this.chart.update('none');
  }
}
