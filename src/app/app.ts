import {Component, effect, signal} from '@angular/core';
import {HeaderComponent} from './components/header/header';
import {ModelToggleComponent} from './components/model-toggle/model-toggle';
import {DataTableComponent} from './components/data-table/data-table';
import {BarChartComponent} from './components/bar-chart/bar-chart';
import {ScatterPlotComponent} from './components/scatter-plot/scatter-plot';

type ViewTab = 'table' | 'bar' | 'scatter';
const TAB_KEY = 'ai-models.activeTab';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    HeaderComponent,
    ModelToggleComponent,
    DataTableComponent,
    BarChartComponent,
    ScatterPlotComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly activeTab = signal<ViewTab>((localStorage.getItem(TAB_KEY) as ViewTab) ?? 'scatter');

  constructor() {
    effect(() => {
      localStorage.setItem(TAB_KEY, this.activeTab());
    });
  }
}
