import { Component, computed, inject, OnDestroy, OnInit, ElementRef, ViewChild, effect } from '@angular/core';
import { Chart, ChartConfiguration, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { AppState } from '../../state/app.state';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  templateUrl: './bar-chart.html',
  styleUrl: './bar-chart.scss',
})
export class BarChartComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly state = inject(AppState);
  private chart?: Chart;

  readonly chartData = computed(() => {
    const models = [...this.state.filteredModels()].sort(
      (a, b) => this.state.getIntelligence(b) - this.state.getIntelligence(a)
    );
    const useful = this.state.usefulModelIds();
    const showUseful = this.state.showUsefulModels();

    return {
      labels: models.map(m => m.publicName),
      data: models.map(m => this.state.getIntelligence(m)),
      colors: models.map(m => {
        if (showUseful && useful.has(m.id)) return 'rgba(99, 179, 99, 0.85)';
        if (m.localModel) return 'rgba(70, 180, 180, 0.75)';
        return 'rgba(99, 140, 210, 0.75)';
      }),
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

    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Intelligence',
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
              label: ctx => `Intelligence: ${ctx.parsed.y}`,
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#888',
              maxRotation: 45,
              minRotation: 30,
              font: { size: 11 },
            },
            grid: { display: false },
          },
          y: {
            min: 0,
            max: 100,
            ticks: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#888',
              font: { size: 11 },
            },
            grid: {
              color: 'rgba(128,128,128,0.15)',
            },
          },
        },
      },
    };

    this.chart = new Chart(ctx, config);
  }

  private updateChart(data: { labels: string[]; data: number[]; colors: string[] }): void {
    if (!this.chart) return;
    this.chart.data.labels = data.labels;
    this.chart.data.datasets[0].data = data.data;
    (this.chart.data.datasets[0] as any).backgroundColor = data.colors;
    this.chart.update('none');
  }
}
