import {Component, computed, effect, ElementRef, inject, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {BarController, BarElement, CategoryScale, Chart, ChartConfiguration, Legend, LinearScale, Tooltip} from 'chart.js';
import {AppState} from '../../state/app.state';
import {AiModel, latencyOf, responseTimeOf} from '../../models/ai-model.model';
import {BarMetric, BENCHMARK_BAR_METRICS} from '../../models/view-types';
import {MissingDataHintComponent} from '../missing-data-hint/missing-data-hint';
import {OutdatedBenchmarkHintComponent} from '../outdated-benchmark-hint/outdated-benchmark-hint';
import {outdatedBenchmarkText} from '../../models/tooltip.util';
import {otherEffortVariants, parseEffortVariantId, shortEffortLabel} from '../../models/effort.util';
import {effortLines, groupBars, highlightColors, modelIdOf} from '../../models/bar-groups.util';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

interface MetricDef {
  key: BarMetric;
  label: string;
  unit: string;
  axisLabel: string;
  /** Sorts the bars from the best (left) to the worst value (right). */
  higherIsBetter: boolean;
  stacked: boolean;
}

interface StackSegment {
  label: string;
  color: string | string[];
  baseColor: string;
  values: number[];
  borderColor?: string[];
  borderWidth?: number[];
}

interface LegendItem {
  label: string;
  color: string;
}

interface ChartDataResult {
  /** Axis labels: in a group, the effort alone after the first bar. */
  labels: string[];
  /** Model name and effort of each bar, for the tooltip. */
  fullLabels: string[];
  segments: StackSegment[];
  isStacked: boolean;
  yMax?: number;
  yMin: number;
  /** Largest value before the Pareto filter, so the axis stays when "Pareto only" is toggled. */
  ySuggestedMax?: number;
  metricDef: MetricDef;
  models: AiModel[];
  missing: AiModel[];
  /** True if the bars of one model stand side by side. */
  grouped: boolean;
}

const DEPRECATED_BAR_COLOR = 'rgba(150,150,150,0.75)';
const DEPRECATED_STACK_COLOR = 'rgba(150,150,150,0.6)';
const API_COLOR = 'rgba(99,140,210,0.75)';
const LOCAL_COLOR = 'rgba(70,180,180,0.75)';
const SEG_COLOR_1 = 'rgba(99,140,210,0.82)';
const SEG_COLOR_2 = 'rgba(180,100,210,0.82)';
const SEG_COLOR_3 = 'rgba(70,180,180,0.82)';
const ESTIMATED_FILL_ALPHA = '0.15)';
const EFFORT_FILL_ALPHA = '0.4)';
const LINE_ALPHA = 0.55;
const DIMMED_LINE_ALPHA = 0.12;

const METRICS: MetricDef[] = [
  {key: 'intelligence', label: 'Intelligence', unit: '', axisLabel: 'Intelligence Score', higherIsBetter: true, stacked: false},
  {
    key: 'costsToRun',
    label: 'Run Cost',
    unit: '$',
    axisLabel: 'Cost per Index Run (USD), hollow: estimated tokens',
    higherIsBetter: false,
    stacked: false
  },
  {
    key: 'responseTime',
    label: 'Response Time',
    unit: 's',
    axisLabel: 'Response Time until first 500 tokens (s)',
    higherIsBetter: false,
    stacked: true
  },
  {key: 'tokensPerSecond', label: 'Tokens/sec', unit: 'tok/s', axisLabel: 'Tokens Per Second', higherIsBetter: true, stacked: false},
  {key: 'latency', label: 'Latency', unit: 's', axisLabel: 'Latency (s) - Time until first token', higherIsBetter: false, stacked: true},
  {key: 'inputCosts', label: 'Input Cost', unit: '$/M', axisLabel: 'Input Cost ($/M tokens)', higherIsBetter: false, stacked: false},
  {key: 'outputCosts', label: 'Output Cost', unit: '$/M', axisLabel: 'Output Cost ($/M tokens)', higherIsBetter: false, stacked: false},
  {key: 'contextWindow', label: 'Context', unit: 'K tokens', axisLabel: 'Context Window (K tokens)', higherIsBetter: true, stacked: false},
  {key: 'maxOutputTokens', label: 'Max Output', unit: 'K tokens', axisLabel: 'Max Output Tokens (K)', higherIsBetter: true, stacked: false},
  {key: 'maxInputTokens', label: 'Max Input', unit: 'K tokens', axisLabel: 'Max Input Tokens (K)', higherIsBetter: true, stacked: false},
];

function isEffortLevel(m: AiModel): boolean {
  return parseEffortVariantId(m.id).effort !== null;
}

function effortFill(m: AiModel, color: string): string {
  return isEffortLevel(m) ? color.replace(/[\d.]+\)$/, EFFORT_FILL_ALPHA) : color;
}

function barLabel(m: AiModel, leveled: ReadonlySet<string>): string {
  const {modelId} = parseEffortVariantId(m.id);
  return leveled.has(modelId) && m.effort ? `${m.publicName} (${shortEffortLabel(m.effort)})` : m.publicName;
}

function groupedLabels(models: AiModel[], fullLabels: string[]): string[] {
  return models.map((m, i) =>
    i > 0 && m.effort && modelIdOf(models[i - 1]) === modelIdOf(m) ? shortEffortLabel(m.effort) : fullLabels[i]);
}

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  imports: [MissingDataHintComponent, OutdatedBenchmarkHintComponent],
  templateUrl: './bar-chart.html',
  styleUrl: './bar-chart.scss',
})
export class BarChartComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly state = inject(AppState);
  readonly metrics = METRICS;
  readonly isStackedMetric = computed(() => {
    const m = this.state.barMetric();
    return m === 'latency' || m === 'responseTime';
  });
  private chart?: Chart;
  private hoveredModelId: string | null = null;

  readonly hasEffortBars = computed(() => this.chartData().models.some(isEffortLevel));

  /** The shown models while the metric comes from the benchmark, else none. */
  readonly benchmarkModels = computed(() =>
    BENCHMARK_BAR_METRICS.has(this.state.barMetric()) ? this.chartData().models : []);

  private getTotalValue(m: AiModel, metric: BarMetric): number | null {
    switch (metric) {
      case 'intelligence':
        return m.overallIntelligence;
      case 'costsToRun':
        return m.costsToRun;
      case 'inputCosts':
        return m.inputCosts;
      case 'outputCosts':
        return m.outputCosts;
      case 'contextWindow':
        return m.contextWindow === null ? null : m.contextWindow / 1000;
      case 'maxInputTokens':
        return m.maxInputTokens === null ? null : m.maxInputTokens / 1000;
      case 'maxOutputTokens':
        return m.maxOutputTokens === null ? null : m.maxOutputTokens / 1000;
      case 'tokensPerSecond':
        return m.tokensPerSecond;
      case 'latency':
        return latencyOf(m);
      case 'responseTime':
        return responseTimeOf(m);
    }
  }

  /** The other effort levels of a model whose value of the metric differs from the model value. */
  private differingLevels(m: AiModel, metric: BarMetric): AiModel[] {
    const own = this.getTotalValue(m, metric);
    return otherEffortVariants(m).filter(v => {
      const value = this.getTotalValue(v, metric);
      return value !== null && value !== own;
    });
  }

  readonly chartData = computed((): ChartDataResult => {
    const metric = this.state.barMetric();
    const metricDef = METRICS.find(x => x.key === metric)!;

    const all = this.state.filteredModels();
    const missing = all.filter(m => this.getTotalValue(m, metric) === null);
    const withValue = all.filter(m => this.getTotalValue(m, metric) !== null);
    const levels = withValue.flatMap(m => this.differingLevels(m, metric));
    const leveled = new Set(levels.map(v => parseEffortVariantId(v.id).modelId));
    const bars = withValue.concat(levels);
    const allValues = bars.map(m => this.getTotalValue(m, metric)!);
    const ySuggestedMax = allValues.length ? Math.max(...allValues) : undefined;
    const useful = this.state.usefulModelIds();
    const shown = this.state.showOnlyPareto() ? bars.filter(m => useful.has(m.id)) : bars;
    const value = (m: AiModel) => this.getTotalValue(m, metric)!;
    const grouped = this.state.barGroupByModel();
    const models = grouped
      ? groupBars(shown, value, metricDef.higherIsBetter)
      : shown.sort((a, b) => metricDef.higherIsBetter ? value(b) - value(a) : value(a) - value(b));

    const fullLabels = models.map(m => barLabel(m, leveled));
    const labels = grouped ? groupedLabels(models, fullLabels) : fullLabels;

    const stackColor = (base: string) => models.map(m => effortFill(m, m.deprecated ? DEPRECATED_STACK_COLOR : base));

    if (metric === 'latency') {
      return {
        labels,
        fullLabels,
        segments: [
          {label: 'Input Processing', color: stackColor(SEG_COLOR_1), baseColor: SEG_COLOR_1, values: models.map(m => m.inputProcessingTime!)},
          {label: 'Thinking', color: stackColor(SEG_COLOR_2), baseColor: SEG_COLOR_2, values: models.map(m => m.thinkingTime!)},
        ],
        isStacked: true,
        yMin: 0,
        ySuggestedMax,
        metricDef,
        models,
        missing,
        grouped,
      };
    }

    if (metric === 'responseTime') {
      return {
        labels,
        fullLabels,
        segments: [
          {label: 'Input Processing', color: stackColor(SEG_COLOR_1), baseColor: SEG_COLOR_1, values: models.map(m => m.inputProcessingTime!)},
          {label: 'Thinking', color: stackColor(SEG_COLOR_2), baseColor: SEG_COLOR_2, values: models.map(m => m.thinkingTime!)},
          {label: 'Output', color: stackColor(SEG_COLOR_3), baseColor: SEG_COLOR_3, values: models.map(m => m.outputTime!)},
        ],
        isStacked: true,
        yMin: 0,
        ySuggestedMax,
        metricDef,
        models,
        missing,
        grouped,
      };
    }

    const values = models.map(m => this.getTotalValue(m, metric)!);
    const solid = models.map(m => m.deprecated ? DEPRECATED_BAR_COLOR : m.localModel ? LOCAL_COLOR : API_COLOR);
    const estimated = models.map(m => metric === 'costsToRun' && m.tokensPerRunEstimated);
    let yMax: number | undefined;
    if (metric === 'intelligence') {
      yMax = Math.min(100, Math.ceil(ySuggestedMax ?? 0) + 5);
    }

    return {
      labels,
      fullLabels,
      segments: [{
        label: metricDef.label,
        color: solid.map((c, i) => estimated[i] ? c.replace(/[\d.]+\)$/, ESTIMATED_FILL_ALPHA) : effortFill(models[i], c)),
        baseColor: API_COLOR,
        values,
        borderColor: solid,
        borderWidth: estimated.map(e => e ? 1.5 : 0),
      }],
      isStacked: false,
      yMax,
      yMin: 0,
      ySuggestedMax,
      metricDef,
      models,
      missing,
      grouped,
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
    if (data.models.some(isEffortLevel)) {
      items.push({label: 'Other effort level', color: API_COLOR.replace(/[\d.]+\)$/, EFFORT_FILL_ALPHA)});
    }
    if (data.metricDef.key === 'costsToRun' && data.models.some(m => m.tokensPerRunEstimated)) {
      items.push({label: 'Estimated tokens (hollow)', color: API_COLOR.replace(/[\d.]+\)$/, ESTIMATED_FILL_ALPHA)});
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
        const model = data.models[i];
        if (model?.deprecated) {
          ctx.fillText('⚠️', x, y - 18);
        }
      });
      ctx.restore();
    },
  };

  private readonly effortLinesPlugin = {
    id: 'effortLines',
    afterDatasetsDraw: (chart: Chart) => {
      const data = this.chartData();
      if (!chart.data.datasets.length) return;
      const meta = chart.getDatasetMeta(chart.data.datasets.length - 1);
      const hovered = this.hoveredModelId;
      const ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#ddd';
      for (const line of effortLines(data.models, data.grouped, hovered)) {
        const bars = line.indexes.map(i => meta.data[i] as any).filter(Boolean);
        ctx.globalAlpha = hovered === null ? LINE_ALPHA : line.modelId === hovered ? 1 : DIMMED_LINE_ALPHA;
        ctx.lineWidth = line.modelId === hovered ? 1.5 : 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        bars.forEach((bar, i) => i ? ctx.lineTo(bar.x, bar.y) : ctx.moveTo(bar.x, bar.y));
        ctx.stroke();
        ctx.setLineDash([]);
        for (const bar of bars) {
          ctx.beginPath();
          ctx.arc(bar.x, bar.y, line.modelId === hovered ? 3 : 2, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
      ctx.restore();
    },
  };

  private onHover(elements: { index: number }[]): void {
    const models = this.chartData().models;
    const bar = elements.length ? models[elements[0].index] : undefined;
    const id = bar ? modelIdOf(bar) : null;
    const next = id !== null && models.filter(m => modelIdOf(m) === id).length > 1 ? id : null;
    if (next === this.hoveredModelId || !this.chart) return;
    this.hoveredModelId = next;
    this.applyHighlight(this.chartData());
    this.chart.update('none');
  }

  private applyHighlight(data: ChartDataResult): void {
    this.chart?.data.datasets.forEach((ds, i) => {
      const seg = data.segments[i];
      if (!seg || !Array.isArray(seg.color)) return;
      ds.backgroundColor = highlightColors(seg.color, data.models, this.hoveredModelId) as any;
      if (seg.borderColor) ds.borderColor = highlightColors(seg.borderColor, data.models, this.hoveredModelId) as any;
    });
  }

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
    const title = (items: any[]): string => items.length ? data.fullLabels[items[0].dataIndex] : '';
    const afterBody = (items: any[]): string | string[] => {
      if (!items.length) return '';
      const m = data.models[items[0].dataIndex];
      return [
        data.metricDef.key === 'costsToRun' && m?.tokensPerRunEstimated ? 'Estimated: no measured token counts' : '',
        m && BENCHMARK_BAR_METRICS.has(data.metricDef.key) && this.state.isOutdated()(m)
          ? outdatedBenchmarkText(m, this.state.latestBenchmarkVersion()) : '',
        m?.deprecated ? `⚠️ Deprecated: ${m.deprecationInfo}` : '',
      ].filter(Boolean);
    };
    if (!data.isStacked) return {title, label, afterBody};
    const afterTitle = (items: any[]): string => {
      if (!items.length) return '';
      const idx = items[0].dataIndex;
      const total = data.segments.reduce((sum, seg) => sum + (seg.values[idx] ?? 0), 0);
      return `Total: ${this.formatValue(total, unit)}`;
    };
    return {title, afterTitle, label, afterBody};
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
          borderColor: seg.borderColor,
          borderWidth: seg.borderWidth,
          borderRadius: 4,
          borderSkipped: false,
        })),
      },
      plugins: [this.valueLabelsPlugin, this.effortLinesPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {duration: 200},
        layout: {padding: {top: 28}},
        onHover: (_event, elements) => this.onHover(elements),
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
            suggestedMax: data.ySuggestedMax,
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
      borderColor: seg.borderColor,
      borderWidth: seg.borderWidth,
      borderRadius: 4,
      borderSkipped: false,
    }));

    this.hoveredModelId = null;

    (this.chart.options.scales!['x'] as any).stacked = data.isStacked;
    (this.chart.options.scales!['y'] as any).stacked = data.isStacked;
    (this.chart.options.scales!['y'] as any).min = data.yMin;
    (this.chart.options.scales!['y'] as any).max = data.yMax;
    (this.chart.options.scales!['y'] as any).suggestedMax = data.ySuggestedMax;
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
