import {
  Component, computed, inject, OnDestroy, OnInit, ElementRef, ViewChild, effect
} from '@angular/core';
import {
  Chart, ChartConfiguration, ScatterController, PointElement, LinearScale, LogarithmicScale,
  Tooltip, Legend, Plugin
} from 'chart.js';
import { AppState } from '../../state/app.state';

Chart.register(ScatterController, PointElement, LinearScale, LogarithmicScale, Tooltip, Legend);


@Component({
  selector: 'app-scatter-plot',
  standalone: true,
  templateUrl: './scatter-plot.html',
  styleUrl: './scatter-plot.scss',
})
export class ScatterPlotComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly state = inject(AppState);
  private chart?: Chart;

  readonly plotData = computed(() => {
    const models = this.state.filteredModels();
    const metric = this.state.intelligenceMetric();
    const useful = this.state.usefulModelIds();
    const showUseful = this.state.showUsefulModels();

    return models.map((m, i): {
      x: number; y: number; label: string;
      color: string; pointStyle: string;
      isUseful: boolean;
    } => {
      let color: string;
      let pointStyle: string;

      if (m.availableForLocal && m.availableInLiteLLM) {
        color = 'rgba(147,112,219,0.9)';
        pointStyle = 'rectRot';
      } else if (m.availableForLocal) {
        color = 'rgba(70,180,180,0.9)';
        pointStyle = 'triangle';
      } else {
        color = 'rgba(99,140,210,0.9)';
        pointStyle = 'circle';
      }

      const isUseful = showUseful && useful.has(m.id);
      if (isUseful) {
        color = 'rgba(80,180,80,0.95)';
      }

      const intel = metric === 'coding' ? m.codingIntelligence
        : metric === 'agentic' ? m.agenticIntelligence
        : m.overallIntelligence;

      return {
        x: m.costsToRun === 0 ? 0.001 : m.costsToRun,
        y: intel,
        label: m.publicName,
        color,
        pointStyle,
        isUseful,
      };
    });
  });

  constructor() {
    effect(() => {
      const data = this.plotData();
      const logScale = this.state.logScaleX();
      this.updateChart(data, logScale);
    });
  }

  ngOnInit(): void {
    this.initChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private labelPlugin(): Plugin {
    return {
      id: 'labelPlugin',
      afterDraw: (chart: Chart) => {
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

        // Simple anti-overlap: sort labels and nudge vertically
        const usedRects: { x1: number; y1: number; x2: number; y2: number }[] = [];

        ctx.save();
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'center';

        for (const pos of positions) {
          const labelW = ctx.measureText(pos.label).width + 4;
          const labelH = 12;
          let labelX = pos.px;
          let labelY = pos.py - 10;

          // Nudge to avoid overlap
          let attempts = 0;
          let placed = false;
          const offsets = [0, -14, 14, -28, 28, -42, 42];
          for (const offset of offsets) {
            labelY = pos.py - 10 + offset;
            const rect = { x1: labelX - labelW / 2, y1: labelY - labelH, x2: labelX + labelW / 2, y2: labelY };
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
            const rect = { x1: labelX - labelW / 2, y1: labelY - labelH, x2: labelX + labelW / 2, y2: labelY };
            usedRects.push(rect);
          }

          ctx.fillStyle = pos.color.replace('0.9', '1').replace('0.95', '1');
          ctx.fillText(pos.label, labelX, labelY);
        }

        ctx.restore();
      },
    };
  }

  private initChart(): void {
    const ctx = this.canvasRef.nativeElement.getContext('2d')!;
    const data = this.plotData();
    const logScale = this.state.logScaleX();

    const config: ChartConfiguration<'scatter'> = {
      type: 'scatter',
      plugins: [this.labelPlugin()],
      data: {
        datasets: [{
          label: 'Models',
          data: data.map(d => ({ x: d.x, y: d.y })),
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
        animation: { duration: 200 },
        layout: { padding: { top: 20, right: 20, bottom: 10, left: 10 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const pt = data[ctx.dataIndex];
                const model = this.state.filteredModels()[ctx.dataIndex];
                if (!model) return '';
                return [
                  `${model.publicName}`,
                  `Run cost: $${model.costsToRun.toFixed(2)}`,
                  `Intelligence: ${pt.y}`,
                  `LiteLLM: ${model.availableInLiteLLM ? 'Yes' : 'No'}`,
                  `Local: ${model.availableForLocal ? 'Yes' : 'No'}`,
                  model.availableForLocal ? `VRAM: ${model.minVramRequirement}GB` : '',
                ].filter(Boolean);
              },
            },
          },
        },
        scales: {
          x: {
            type: logScale ? 'logarithmic' : 'linear',
            title: {
              display: true,
              text: 'Cost to Run ($/M tokens)',
              color: '#888',
              font: { size: 11 },
            },
            ticks: {
              color: '#888',
              font: { size: 10 },
              callback: (v) => `$${v}`,
            },
            grid: { color: 'rgba(128,128,128,0.1)' },
          },
          y: {
            min: 0,
            max: 100,
            title: {
              display: true,
              text: 'Intelligence Score',
              color: '#888',
              font: { size: 11 },
            },
            ticks: { color: '#888', font: { size: 10 } },
            grid: { color: 'rgba(128,128,128,0.1)' },
          },
        },
      },
    };

    this.chart = new Chart(ctx, config);
  }

  private updateChart(
    data: { x: number; y: number; label: string; color: string; pointStyle: string; isUseful: boolean }[],
    logScale: boolean
  ): void {
    if (!this.chart) return;

    this.chart.data.datasets[0].data = data.map(d => ({ x: d.x, y: d.y }));
    (this.chart.data.datasets[0] as any).backgroundColor = data.map(d => d.color);
    (this.chart.data.datasets[0] as any).borderColor = data.map(d => d.color);
    (this.chart.data.datasets[0] as any).pointStyle = data.map(d => d.pointStyle);

    (this.chart.options.scales!['x'] as any).type = logScale ? 'logarithmic' : 'linear';

    this.chart.update('none');
  }
}
