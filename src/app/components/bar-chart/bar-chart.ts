import {Component, computed, effect, ElementRef, inject, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {BarController, BarElement, CategoryScale, Chart, ChartConfiguration, Legend, LinearScale, Tooltip} from 'chart.js';
import {AppState} from '../../state/app.state';
import {AiModel} from '../../models/ai-model.model';
import {COSTS_TO_RUN_SCALE} from '../../models/ai-models.data';
import {BarMetric} from '../../models/view-types';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

interface MetricDef {
  key: BarMetric;
  label: string;
  unit: string;
  axisLabel: string;
  sortAsc: boolean;
  stacked: boolean;
}

interface StackSegment {
  label: string;
  color: string | string[];
  baseColor: string;
  values: number[];
}

interface LegendItem {
  label: string;
  color: string;
}

interface ChartDataResult {
  labels: string[];
  segments: StackSegment[];
  isStacked: boolean;
  yMax?: number;
  yMin: number;
  metricDef: MetricDef;
  models: AiModel[];
}

const DEPRECATED_BAR_COLOR = 'rgba(150,150,150,0.75)';
const DEPRECATED_STACK_COLOR = 'rgba(150,150,150,0.6)';
const API_COLOR = 'rgba(99,140,210,0.75)';
const LOCAL_COLOR = 'rgba(70,180,180,0.75)';
const SEG_COLOR_1 = 'rgba(99,140,210,0.82)';
const SEG_COLOR_2 = 'rgba(180,100,210,0.82)';
const SEG_COLOR_3 = 'rgba(70,180,180,0.82)';

const METRICS: MetricDef[] = [
  {key: 'intelligence', label: 'Intelligence', unit: '', axisLabel: 'Intelligence Score', sortAsc: false, stacked: false},
  {key: 'costsToRun', label: 'Run Cost', unit: '$', axisLabel: 'Total Usage Cost ($)', sortAsc: false, stacked: true},
  {key: 'inputCosts', label: 'Input Cost', unit: '$/M', axisLabel: 'Input Cost ($/M tokens)', sortAsc: false, stacked: false},
  {key: 'outputCosts', label: 'Output Cost', unit: '$/M', axisLabel: 'Output Cost ($/M tokens)', sortAsc: false, stacked: false},
  {key: 'contextWindow', label: 'Context', unit: 'K tokens', axisLabel: 'Context Window (K tokens)', sortAsc: false, stacked: false},
  {key: 'maxInputTokens', label: 'Max Input', unit: 'K tokens', axisLabel: 'Max Input Tokens (K)', sortAsc: false, stacked: false},
  {key: 'maxOutputTokens', label: 'Max Output', unit: 'K tokens', axisLabel: 'Max Output Tokens (K)', sortAsc: false, stacked: false},
  {key: 'tokensPerSecond', label: 'Tokens/sec', unit: 'tok/s', axisLabel: 'Tokens Per Second', sortAsc: false, stacked: false},
  {key: 'latency', label: 'Latency', unit: 's', axisLabel: 'Latency (s) - Time until first token', sortAsc: true, stacked: true},
  {key: 'responseTime', label: 'Response Time', unit: 's', axisLabel: 'Response Time until first 500 tokens (s)', sortAsc: true, stacked: true},
];

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  templateUrl: './bar-chart.html',
  styleUrl: './bar-chart.scss',
})
export class BarChartComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly state = inject(AppState);
  readonly metrics = METRICS;
  readonly isStackedMetric = computed(() => {
    const m = this.state.barMetric();
    return m === 'latency' || m === 'responseTime' || m === 'costsToRun';
  });
  private chart?: Chart;

  private getTotalValue(m: AiModel, metric: BarMetric): number {
    switch (metric) {
      case 'intelligence':
        return this.state.getIntelligence(m);
      case 'costsToRun':
        return m.costsToRun;
      case 'inputCosts':
        return m.inputCosts;
      case 'outputCosts':
        return m.outputCosts;
      case 'contextWindow':
        return m.contextWindow / 1000;
      case 'maxInputTokens':
        return m.maxInputTokens / 1000;
      case 'maxOutputTokens':
        return m.maxOutputTokens / 1000;
      case 'tokensPerSecond':
        return m.tokensPerSecond;
      case 'latency':
        return m.inputProcessingTime + m.thinkingTime;
      case 'responseTime':
        return m.inputProcessingTime + m.thinkingTime + m.outputTime;
    }
  }

  readonly chartData = computed((): ChartDataResult => {
    const metric = this.state.barMetric();
    const metricDef = METRICS.find(x => x.key === metric)!;

    const models = [...this.state.filteredModels()].sort((a, b) => {
      const va = this.getTotalValue(a, metric);
      const vb = this.getTotalValue(b, metric);
      return metricDef.sortAsc ? va - vb : vb - va;
    });

    const labels = models.map(m => m.publicName);

    const stackColor = (base: string) => models.map(m => m.deprecated ? DEPRECATED_STACK_COLOR : base);

    if (metric === 'latency') {
      return {
        labels,
        segments: [
          {label: 'Input Processing', color: stackColor(SEG_COLOR_1), baseColor: SEG_COLOR_1, values: models.map(m => m.inputProcessingTime)},
          {label: 'Thinking', color: stackColor(SEG_COLOR_2), baseColor: SEG_COLOR_2, values: models.map(m => m.thinkingTime)},
        ],
        isStacked: true,
        yMin: 0,
        metricDef,
        models,
      };
    }

    if (metric === 'responseTime') {
      return {
        labels,
        segments: [
          {label: 'Input Processing', color: stackColor(SEG_COLOR_1), baseColor: SEG_COLOR_1, values: models.map(m => m.inputProcessingTime)},
          {label: 'Thinking', color: stackColor(SEG_COLOR_2), baseColor: SEG_COLOR_2, values: models.map(m => m.thinkingTime)},
          {label: 'Output', color: stackColor(SEG_COLOR_3), baseColor: SEG_COLOR_3, values: models.map(m => m.outputTime)},
        ],
        isStacked: true,
        yMin: 0,
        metricDef,
        models,
      };
    }

    if (metric === 'costsToRun') {
      return {
        labels,
        segments: [
          {
            label: 'Input Cost',
            color: stackColor(SEG_COLOR_1),
            baseColor: SEG_COLOR_1,
            values: models.map(m => m.inputFactor * m.inputCosts * COSTS_TO_RUN_SCALE)
          },
          {
            label: 'Reasoning Cost',
            color: stackColor(SEG_COLOR_2),
            baseColor: SEG_COLOR_2,
            values: models.map(m => m.reasoningFactor * m.outputCosts * COSTS_TO_RUN_SCALE)
          },
          {
            label: 'Output Cost',
            color: stackColor(SEG_COLOR_3),
            baseColor: SEG_COLOR_3,
            values: models.map(m => m.outputFactor * m.outputCosts * COSTS_TO_RUN_SCALE)
          },
        ],
        isStacked: true,
        yMin: 0,
        metricDef,
        models,
      };
    }

    const values = models.map(m => this.getTotalValue(m, metric));
    const maxVal = values.length ? Math.max(...values) : 0;
    let yMax: number | undefined;
    if (metric === 'intelligence') {
      yMax = Math.min(100, Math.ceil(maxVal) + 5);
    }

    return {
      labels,
      segments: [{
        label: metricDef.label,
        color: models.map(m =>
          m.deprecated ? DEPRECATED_BAR_COLOR
            : m.localModel ? LOCAL_COLOR
              : API_COLOR),
        baseColor: API_COLOR,
        values,
      }],
      isStacked: false,
      yMax,
      yMin: 0,
      metricDef,
      models,
    };
  });

  readonly legendItems = computed((): LegendItem[] => {
    const data = this.chartData();
    const items: LegendItem[] = [];
    if (data.isStacked) {
      for (const seg of data.segments) {
        items.push({label: seg.label, color: seg.baseColor});
      }
    } else {
      items.push({label: 'API', color: API_COLOR});
      items.push({label: 'Local', color: LOCAL_COLOR});
    }
    if (data.models.some(m => m.deprecated)) {
      items.push({label: 'Deprecated', color: DEPRECATED_BAR_COLOR});
    }
    return items;
  });

  private readonly valueLabelsPlugin = {
    id: 'valueLabels',
    afterDatasetsDraw: (chart: Chart) => {
      const data = this.chartData();
      if (!chart.data.datasets.length || !data.models.length) return;
      const lastIdx = chart.data.datasets.length - 1;
      const meta = chart.getDatasetMeta(lastIdx);
      const ctx = chart.ctx;
      const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#ddd';
      ctx.save();
      ctx.fillStyle = textColor;
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      meta.data.forEach((bar: any, i: number) => {
        const total = data.segments.reduce((s, seg) => s + (seg.values[i] ?? 0), 0);
        const label = this.formatValue(total, data.metricDef.unit);
        const x = bar.x;
        const y = bar.y;
        ctx.fillText(label, x, y - 4);
        if (data.models[i]?.deprecated) {
          ctx.fillText('⚠️', x, y - 18);
        }
      });
      ctx.restore();
    },
  };

  constructor() {
    effect(() => {
      const data = this.chartData();
      this.updateChart(data);
    });
  }

  ngOnInit(): void {
    this.initChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private formatValue(val: number, unit: string): string {
    if (unit === '$') return `$${val.toFixed(2)}`;
    if (unit === '$/M') return `$${val.toFixed(2)}/M`;
    if (unit === 'K tokens') return `${val.toFixed(0)}K tokens`;
    if (unit === 's') return `${val.toFixed(2)}s`;
    if (unit === 'tok/s') return `${val.toFixed(0)} tok/s`;
    return `${val}`;
  }

  private buildTooltipCallbacks(data: ChartDataResult) {
    const {unit} = data.metricDef;
    const label = (ctx: any): string => {
      const val: number = ctx.parsed.y ?? 0;
      return `${ctx.dataset.label}: ${this.formatValue(val, unit)}`;
    };
    const afterBody = (items: any[]): string | string[] => {
      if (!items.length) return '';
      const m = data.models[items[0].dataIndex];
      return m?.deprecated ? `⚠️ Deprecated: ${m.deprecationInfo}` : '';
    };
    if (!data.isStacked) return {label, afterBody};
    const afterTitle = (items: any[]): string => {
      if (!items.length) return '';
      const idx = items[0].dataIndex;
      const total = data.segments.reduce((sum, seg) => sum + (seg.values[idx] ?? 0), 0);
      return `Total: ${this.formatValue(total, unit)}`;
    };
    return {afterTitle, label, afterBody};
  }

  private initChart(): void {
    const ctx = this.canvasRef.nativeElement.getContext('2d')!;
    const data = this.chartData();
    const textMuted = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#888';

    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: data.segments.map(seg => ({
          label: seg.label,
          data: seg.values,
          backgroundColor: seg.color as any,
          borderRadius: 4,
          borderSkipped: false,
        })),
      },
      plugins: [this.valueLabelsPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {duration: 200},
        layout: {padding: {top: 28}},
        plugins: {
          legend: {display: false},
          tooltip: {
            mode: 'index',
            callbacks: this.buildTooltipCallbacks(data),
          },
        },
        scales: {
          x: {
            stacked: data.isStacked,
            ticks: {color: textMuted, maxRotation: 45, minRotation: 30, font: {size: 11}},
            grid: {display: false},
          },
          y: {
            stacked: data.isStacked,
            min: data.yMin,
            max: data.yMax,
            title: {
              display: true,
              text: data.metricDef.axisLabel,
              color: textMuted,
              font: {size: 11},
            },
            ticks: {color: textMuted, font: {size: 11}},
            grid: {color: 'rgba(128,128,128,0.15)'},
          },
        },
      },
    };

    this.chart = new Chart(ctx, config);
  }

  private updateChart(data: ChartDataResult): void {
    if (!this.chart) return;

    this.chart.data.labels = data.labels;
    this.chart.data.datasets = data.segments.map(seg => ({
      label: seg.label,
      data: seg.values,
      backgroundColor: seg.color as any,
      borderRadius: 4,
      borderSkipped: false,
    }));

    (this.chart.options.scales!['x'] as any).stacked = data.isStacked;
    (this.chart.options.scales!['y'] as any).stacked = data.isStacked;
    (this.chart.options.scales!['y'] as any).min = data.yMin;
    (this.chart.options.scales!['y'] as any).max = data.yMax;
    (this.chart.options.scales!['y'] as any).title = {
      display: true,
      text: data.metricDef.axisLabel,
      color: '#888',
      font: {size: 13},
    };
    (this.chart.options.plugins!.legend as any).display = false;
    (this.chart.options.plugins!.tooltip as any).mode = 'index';
    (this.chart.options.plugins!.tooltip as any).callbacks = this.buildTooltipCallbacks(data);

    this.chart.update('none');
  }
}
