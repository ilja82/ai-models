import {Component, computed, effect, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild} from '@angular/core';
import {BarController, BarElement, CategoryScale, Chart, ChartConfiguration, Legend, LinearScale, Tooltip} from 'chart.js';
import {AppState} from '../../state/app.state';
import {AiModel} from '../../models/ai-model.model';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

type BarMetric = 'intelligence' | 'costsToRun' | 'inputCosts' | 'outputCosts' | 'contextWindow'
  | 'maxInputTokens' | 'maxOutputTokens'
  | 'tokensPerSecond' | 'latency' | 'responseTime';

const BAR_METRIC_KEY = 'ai-models.barMetric';

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
  values: number[];
}

interface ChartDataResult {
  labels: string[];
  segments: StackSegment[];
  isStacked: boolean;
  yMax?: number;
  yMin: number;
  metricDef: MetricDef;
}

const METRICS: MetricDef[] = [
  {key: 'intelligence', label: 'Intelligence', unit: '', axisLabel: 'Intelligence Score', sortAsc: false, stacked: false},
  {key: 'costsToRun', label: 'Run Cost', unit: '$/M', axisLabel: 'Cost to Run ($/M tokens)', sortAsc: false, stacked: false},
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
  readonly barMetric = signal<BarMetric>((localStorage.getItem(BAR_METRIC_KEY) as BarMetric) ?? 'intelligence');
  readonly metrics = METRICS;
  readonly isStackedMetric = computed(() => this.barMetric() === 'latency' || this.barMetric() === 'responseTime');
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
    const metric = this.barMetric();
    const metricDef = METRICS.find(x => x.key === metric)!;

    const models = [...this.state.filteredModels()].sort((a, b) => {
      const va = this.getTotalValue(a, metric);
      const vb = this.getTotalValue(b, metric);
      return metricDef.sortAsc ? va - vb : vb - va;
    });

    const labels = models.map(m => m.publicName);

    if (metric === 'latency') {
      return {
        labels,
        segments: [
          {label: 'Input Processing', color: 'rgba(99,140,210,0.82)', values: models.map(m => m.inputProcessingTime)},
          {label: 'Thinking', color: 'rgba(180,100,210,0.82)', values: models.map(m => m.thinkingTime)},
        ],
        isStacked: true,
        yMin: 0,
        metricDef,
      };
    }

    if (metric === 'responseTime') {
      return {
        labels,
        segments: [
          {label: 'Input Processing', color: 'rgba(99,140,210,0.82)', values: models.map(m => m.inputProcessingTime)},
          {label: 'Thinking', color: 'rgba(180,100,210,0.82)', values: models.map(m => m.thinkingTime)},
          {label: 'Output', color: 'rgba(70,180,180,0.82)', values: models.map(m => m.outputTime)},
        ],
        isStacked: true,
        yMin: 0,
        metricDef,
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
        color: models.map(m => m.localModel ? 'rgba(70,180,180,0.75)' : 'rgba(99,140,210,0.75)'),
        values,
      }],
      isStacked: false,
      yMax,
      yMin: 0,
      metricDef,
    };
  });

  constructor() {
    effect(() => {
      localStorage.setItem(BAR_METRIC_KEY, this.barMetric());
    });
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
    if (!data.isStacked) return {label};
    const afterTitle = (items: any[]): string => {
      if (!items.length) return '';
      const idx = items[0].dataIndex;
      const total = data.segments.reduce((sum, seg) => sum + (seg.values[idx] ?? 0), 0);
      return `Total: ${this.formatValue(total, unit)}`;
    };
    return {afterTitle, label};
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
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {duration: 200},
        plugins: {
          legend: {display: data.isStacked},
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
    (this.chart.options.plugins!.legend as any).display = data.isStacked;
    (this.chart.options.plugins!.tooltip as any).mode = 'index';
    (this.chart.options.plugins!.tooltip as any).callbacks = this.buildTooltipCallbacks(data);

    this.chart.update('none');
  }
}
