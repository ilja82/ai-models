import {Component, computed, effect, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild} from '@angular/core';
import {Chart, ChartConfiguration, Legend, LinearScale, LogarithmicScale, Plugin, PointElement, ScatterController, Tooltip} from 'chart.js';
import {AppState} from '../../state/app.state';
import {AiModel, effectiveCutoffDate, IntelligenceMetric} from '../../models/ai-model.model';

Chart.register(ScatterController, PointElement, LinearScale, LogarithmicScale, Tooltip, Legend);

export type PlotType = 'cost' | 'release' | 'context' | 'speed' | 'responseVsIntel' | 'responseVsSpeed';

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

const PLOT_TYPE_KEY = 'ai-models.plotType';

@Component({
  selector: 'app-scatter-plot',
  standalone: true,
  templateUrl: './scatter-plot.html',
  styleUrl: './scatter-plot.scss',
})
export class ScatterPlotComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', {static: true}) canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly state = inject(AppState);
  private chart?: Chart;

  readonly plotType = signal<PlotType>((localStorage.getItem(PLOT_TYPE_KEY) as PlotType) ?? 'cost');
  readonly plotTypes = PLOT_TYPES;
  readonly currentPlotDef = computed(() => PLOT_TYPES.find(p => p.key === this.plotType())!);

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

  readonly plotData = computed(() => {
    const models = this.state.filteredModels();
    const metric = this.state.intelligenceMetric();
    const useful = this.state.usefulModelIds();
    const showUseful = this.state.showUsefulModels();
    const plotType = this.plotType();

    return models.map(m => {
      let color = m.localModel ? 'rgba(70,180,180,0.9)' : 'rgba(99,140,210,0.9)';
      const pointStyle = m.localModel ? 'triangle' : 'circle';
      const isUseful = showUseful && useful.has(m.id);
      if (isUseful) color = 'rgba(180,180,80,0.95)';

      const {x, y} = this.getXY(m, plotType, metric);
      return {x, y, label: m.publicName, color, pointStyle, isUseful};
    });
  });

  private readonly allAxisData = computed(() => {
    const models = this.state.allModels();
    const metric = this.state.intelligenceMetric();
    const plotType = this.plotType();
    return models.map(m => this.getXY(m, plotType, metric));
  });

  readonly yBounds = computed(() => {
    const plotType = this.plotType();
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
    const plotType = this.plotType();

    if (plotType === 'release') {
      const range = maxX - minX || 1;
      return {min: minX - range * 0.05, max: Date.now()};
    }

    if (this.state.logScaleX() && (plotType === 'cost' || plotType === 'context')) {
      return {min: minX / 1.4, max: maxX * 1.4};
    }

    const range = maxX - minX || 1;
    return {min: Math.max(0, minX - range * 0.05), max: maxX + range * 0.05};
  });

  constructor() {
    effect(() => {
      localStorage.setItem(PLOT_TYPE_KEY, this.plotType());
    });
    effect(() => {
      const data = this.plotData();
      const logScale = this.state.logScaleX();
      const bounds = this.yBounds();
      const xBounds = this.xBounds();
      const plotType = this.plotType();
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

        ctx.save();

        // Most attractive is always upper-right
        ctx.fillStyle = 'rgba(120, 220, 130, 0.35)';
        ctx.fillRect(xMid, top, right - xMid, yMid - top);
        ctx.fillStyle = 'rgba(170, 170, 170, 0.13)';
        ctx.fillRect(left, yMid, xMid - left, bottom - yMid);
        ctx.font = '10px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(80, 200, 90, 0.9)';
        ctx.textAlign = 'right';
        ctx.fillText('Most attractive', right - 6, top + 14);
        ctx.fillStyle = 'rgba(130, 130, 130, 0.55)';
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

          ctx.fillStyle = pos.color.replace('0.9', '1').replace('0.95', '1');
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
        axisType = logScale ? 'logarithmic' : 'linear';
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
        title = 'Cost to Run ($/M tokens)';
        tickCallback = (v: any) => `${(+v).toFixed(1)}`;
        axisType = logScale ? 'logarithmic' : 'linear';
    }

    return {
      type: axisType,
      min: xBounds.min,
      max: xBounds.max,
      reverse: reverseX,
      title: {display: true, text: title, color: '#888', font: {size: 13}},
      ticks: {color: '#888', font: {size: 10}, callback: tickCallback},
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
    const plotType = this.plotType();

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
          pointRadius: 7,
          pointHoverRadius: 10,
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

  private buildTooltipLines(dataIndex: number, plotType: PlotType): string[] {
    const model = this.state.filteredModels()[dataIndex];
    if (!model) return [];
    const metric = this.state.intelligenceMetric();
    const intel = metric === 'coding' ? model.codingIntelligence
      : metric === 'agentic' ? model.agenticIntelligence
        : model.overallIntelligence;
    const metricLabel = metric === 'coding' ? 'Coding Intelligence'
      : metric === 'agentic' ? 'Agentic Intelligence'
        : 'Overall Intelligence';
    const responseTime = model.inputProcessingTime + model.thinkingTime + model.outputTime;
    return [
      `${model.publicName}`,
      `★ ${metricLabel}: ${intel}`,
      `★ Speed: ${model.tokensPerSecond} tok/s`,
      `★ Response time: ${responseTime.toFixed(1)}s (in: ${model.inputProcessingTime}s, think: ${model.thinkingTime}s, out: ${model.outputTime}s)`,
      `★ Run cost: $${model.costsToRun.toFixed(2)}/M tokens`,
      `★ Release: ${model.releaseDate}`,
      `─────────────────`,
      `Type: ${model.localModel ? 'Local' : 'API'}`,
      `Input: $${model.inputCosts.toFixed(3)}/M tokens`,
      `Output: $${model.outputCosts.toFixed(3)}/M tokens`,
      `Context: ${(model.contextWindow / 1000).toFixed(0)}K tokens`,
      `Cutoff: ${model.cutoffDate ?? `${effectiveCutoffDate(model)} (estimated)`}`,
      model.localModel ? `VRAM: ${model.minVramRequirement}GB` : '',
    ].filter(Boolean);
  }

  private updateChart(
    data: { x: number; y: number; label: string; color: string; pointStyle: string; isUseful: boolean }[],
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
