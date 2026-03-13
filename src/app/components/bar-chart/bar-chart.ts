import {Component, computed, effect, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild} from '@angular/core';
import {BarController, BarElement, CategoryScale, Chart, ChartConfiguration, Legend, LinearScale, Tooltip} from 'chart.js';
import {AppState} from '../../state/app.state';
import {AiModel} from '../../models/ai-model.model';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

type BarMetric = 'intelligence' | 'costsToRun' | 'inputCosts' | 'outputCosts' | 'contextWindow';

interface MetricDef {
  key: BarMetric;
  label: string;
  unit: string;
  axisLabel: string;
}

const METRICS: MetricDef[] = [
  {key: 'intelligence', label: 'Intelligence', unit: '', axisLabel: 'Intelligence Score'},
  {key: 'costsToRun', label: 'Run Cost', unit: '$/M', axisLabel: 'Cost to Run ($/M tokens)'},
  {key: 'inputCosts', label: 'Input Cost', unit: '$/M', axisLabel: 'Input Cost ($/M tokens)'},
  {key: 'outputCosts', label: 'Output Cost', unit: '$/M', axisLabel: 'Output Cost ($/M tokens)'},
  {key: 'contextWindow', label: 'Context', unit: 'K tokens', axisLabel: 'Context Window (K tokens)'},
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
  readonly barMetric = signal<BarMetric>('intelligence');
  readonly metrics = METRICS;
  private chart?: Chart;

  private getValue(m: AiModel, metric: BarMetric): number {
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
    }
  }

  readonly chartData = computed(() => {
    const metric = this.barMetric();
    const models = [...this.state.filteredModels()].sort(
      (a, b) => this.getValue(b, metric) - this.getValue(a, metric)
    );
    const metricDef = METRICS.find(x => x.key === metric)!;

    const values = models.map(m => this.getValue(m, metric));
    const maxVal = values.length ? Math.max(...values) : 0;

    let yMax: number | undefined;
    let yMin: number | undefined = 0;
    if (metric === 'intelligence') {
      yMax = Math.min(100, Math.ceil(maxVal) + 5);
    }

    return {
      labels: models.map(m => m.publicName),
      data: values,
      colors: models.map(m => {
        if (m.localModel) return 'rgba(70, 180, 180, 0.75)';
        return 'rgba(99, 140, 210, 0.75)';
      }),
      yMax,
      yMin,
      metricDef,
    };
  });

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

  private initChart(): void {
    const ctx = this.canvasRef.nativeElement.getContext('2d')!;
    const data = this.chartData();
    const textMuted = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#888';

    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          label: data.metricDef.label,
          data: data.data,
          backgroundColor: data.colors,
          borderRadius: 4,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 200 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const unit = data.metricDef.unit;
                const val: number = ctx.parsed.y ?? 0;
                const formatted = unit === '$/M' ? `$${val.toFixed(2)}/M` : unit === 'K tokens' ? `${val.toFixed(0)}K tokens` : String(val);
                return `${data.metricDef.label}: ${formatted}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {color: textMuted, maxRotation: 45, minRotation: 30, font: {size: 11}},
            grid: { display: false },
          },
          y: {
            min: data.yMin,
            max: data.yMax,
            title: {
              display: true,
              text: data.metricDef.axisLabel,
              color: textMuted,
              font: { size: 11 },
            },
            ticks: {color: textMuted, font: {size: 11}},
            grid: {color: 'rgba(128,128,128,0.15)'},
          },
        },
      },
    };

    this.chart = new Chart(ctx, config);
  }

  private updateChart(data: ReturnType<typeof this.chartData>): void {
    if (!this.chart) return;
    this.chart.data.labels = data.labels;
    this.chart.data.datasets[0].data = data.data;
    this.chart.data.datasets[0].label = data.metricDef.label;
    (this.chart.data.datasets[0] as any).backgroundColor = data.colors;

    (this.chart.options.scales!['y'] as any).min = data.yMin;
    (this.chart.options.scales!['y'] as any).max = data.yMax;
    (this.chart.options.scales!['y'] as any).title = {
      display: true,
      text: data.metricDef.axisLabel,
      color: '#888',
      font: {size: 11},
    };
    (this.chart.options.plugins!.tooltip as any).callbacks = {
      label: (ctx: any) => {
        const unit = data.metricDef.unit;
        const val: number = ctx.parsed.y ?? 0;
        const formatted = unit === '$/M' ? `$${val.toFixed(2)}/M` : unit === 'K tokens' ? `${val.toFixed(0)}K tokens` : String(val);
        return `${data.metricDef.label}: ${formatted}`;
      },
    };

    this.chart.update('none');
  }
}
