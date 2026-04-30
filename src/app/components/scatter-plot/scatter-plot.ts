import {Component, computed, effect, ElementRef, inject, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {Chart, ChartConfiguration, Legend, LinearScale, LogarithmicScale, Plugin, PointElement, ScatterController, Tooltip} from 'chart.js';
import {AppState} from '../../state/app.state';
import {ThemeState} from '../../state/theme.state';
import {AiModel, IntelligenceMetric} from '../../models/ai-model.model';
import {buildModelTooltipLines} from '../../models/tooltip.util';
import {getPlotColors} from '../../models/plot-colors';
import {PlotType} from '../../models/view-types';

Chart.register(ScatterController, PointElement, LinearScale, LogarithmicScale, Tooltip, Legend);

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
  {key: 'cost', label: 'Cost vs Intelligence', supportsLogX: true, reverseX: true},
  {key: 'release', label: 'Release vs Intelligence', supportsLogX: false, reverseX: false},
  {key: 'context', label: 'Context vs Intelligence', supportsLogX: true, reverseX: false},
  {key: 'speed', label: 'Tokens/s vs Intelligence', supportsLogX: false, reverseX: false},
  {key: 'responseVsIntel', label: 'Response Time vs Intelligence', supportsLogX: false, reverseX: true},
  {key: 'responseVsSpeed', label: 'Response Time vs Speed', supportsLogX: false, reverseX: true},
];

@Component({
  selector: 'app-scatter-plot',
  standalone: true,
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

  private getXY(m: AiModel, plotType: PlotType, metric: IntelligenceMetric): { x: number; y: number } {
    const intel = metric === 'coding' ? m.codingIntelligence
      : metric === 'agentic' ? m.agenticIntelligence
        : m.overallIntelligence;
    const responseTime = m.inputProcessingTime + m.thinkingTime + m.outputTime;

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
      default: // cost
        return {x: m.costsToRun === 0 ? 0.001 : m.costsToRun, y: intel};
    }
  }

  readonly specialMarkers2d = computed<{ axisBestIds: Set<string>; balancedId: string | null }>(() => {
    const models = this.state.filteredModels().filter(m => !m.deprecated);
    if (models.length === 0) return {axisBestIds: new Set(), balancedId: null};
    const metric = this.state.intelligenceMetric();
    const plotType = this.state.plotType();
    const plotDef = this.currentPlotDef();
    const higherXIsBetter = !plotDef.reverseX;
    const higherYIsBetter = true;

    const pts = models.map(m => ({id: m.id, ...this.getXY(m, plotType, metric)}));

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

    const xs = pts.map(p => p.x).filter(v => Number.isFinite(v));
    const ys = pts.map(p => p.y).filter(v => Number.isFinite(v));
    if (xs.length === 0 || ys.length === 0) return {axisBestIds, balancedId: null};
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const xLog = this.state.logScaleX() && (plotType === 'cost' || plotType === 'context') && xMin > 0;

    const norm = (v: number, lo: number, hi: number, log: boolean, higherIsBetter: boolean): number => {
      if (hi === lo) return 0.5;
      let t: number;
      if (log && v > 0 && lo > 0) {
        const a = Math.log(lo), b = Math.log(hi);
        t = (Math.log(v) - a) / (b - a);
      } else {
        t = (v - lo) / (hi - lo);
      }
      t = Math.max(0, Math.min(1, t));
      return higherIsBetter ? t : 1 - t;
    };

    let balancedId: string | null = null;
    let bestDist = Infinity;
    for (const p of pts) {
      const nx = norm(p.x, xMin, xMax, xLog, higherXIsBetter);
      const ny = norm(p.y, yMin, yMax, false, higherYIsBetter);
      const d = (1 - nx) * (1 - nx) + (1 - ny) * (1 - ny);
      if (d < bestDist) {
        bestDist = d;
        balancedId = p.id;
      }
    }

    return {axisBestIds, balancedId};
  });

  private isLogX(plotType: PlotType): boolean {
    return this.state.logScaleX() && (plotType === 'cost' || plotType === 'context');
  }

  private transformX(x: number, plotType: PlotType): number {
    return this.isLogX(plotType) && x > 0 ? Math.log2(x) : x;
  }

  readonly plotData = computed(() => {
    const models = this.state.filteredModels();
    const metric = this.state.intelligenceMetric();
    const useful = this.state.usefulModelIds();
    const showUseful = this.state.showUsefulModels();
    const plotType = this.state.plotType();
    const {axisBestIds, balancedId} = this.specialMarkers2d();
    const colors = getPlotColors(this.themeState.theme());
    const starIcon = this.starIcon();

    return models.map(m => {
      if (m.deprecated) {
        const {x, y} = this.getXY(m, plotType, metric);
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

      const {x, y} = this.getXY(m, plotType, metric);
      return {x: this.transformX(x, plotType), y, label: m.publicName, color, pointStyle, radius, isUseful};
    });
  });

  private readonly allAxisData = computed(() => {
    const models = this.state.allModels();
    const metric = this.state.intelligenceMetric();
    const plotType = this.state.plotType();
    return models.map(m => this.getXY(m, plotType, metric));
  });

  readonly yBounds = computed(() => {
    const plotType = this.state.plotType();
    const models = this.state.allModels();

    if (plotType === 'responseVsSpeed') {
      const ys = models.map(m => m.tokensPerSecond);
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
      const logScale = this.state.logScaleX();
      const bounds = this.yBounds();
      const xBounds = this.xBounds();
      const plotType = this.state.plotType();
      this.updateChart(data, logScale, bounds, xBounds, plotType);
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
      default: // cost
        title = 'Total Usage Cost ($)';
        tickCallback = (v: any) => `${(+v).toFixed(1)}`;
        axisType = 'linear';
    }

    let stepSize: number | undefined;
    if (logScale && (plotType === 'cost' || plotType === 'context')) {
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
      plugins: [this.quadrantPlugin(), this.labelPlugin()],
      data: {
        datasets: [{
          label: 'Models',
          data: data.map(d => ({x: d.x, y: d.y})),
          backgroundColor: data.map(d => d.color),
          borderColor: data.map(d => d.color),
          pointStyle: data.map(d => d.pointStyle) as any,
          pointRadius: data.map(d => d.radius),
          pointHoverRadius: data.map(d => d.radius + 3),
        }],
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
              label: (ctx) => this.buildTooltipLines(ctx.dataIndex, plotType),
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

  private buildTooltipLines(dataIndex: number, _plotType: PlotType): string[] {
    const model = this.state.filteredModels()[dataIndex];
    if (!model) return [];
    return buildModelTooltipLines(model, this.state.intelligenceMetric());
  }

  private updateChart(
    data: { x: number; y: number; label: string; color: string; pointStyle: string | HTMLImageElement; radius: number; isUseful: boolean }[],
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
      label: (ctx: any) => this.buildTooltipLines(ctx.dataIndex, plotType),
    };

    this.chart.update('none');
  }
}
