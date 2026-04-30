import {Component, inject} from '@angular/core';
import {AppState} from './state/app.state';
import {HeaderComponent} from './components/header/header';
import {ModelToggleComponent} from './components/model-toggle/model-toggle';
import {DataTableComponent} from './components/data-table/data-table';
import {BarChartComponent} from './components/bar-chart/bar-chart';
import {ScatterPlotComponent} from './components/scatter-plot/scatter-plot';
import {Scatter3dPlotComponent} from './components/scatter-3d-plot/scatter-3d-plot';
import {ModelProfilesComponent} from './components/model-profiles/model-profiles';
import {UpdateBannerComponent} from './components/update-banner/update-banner';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    HeaderComponent,
    ModelToggleComponent,
    DataTableComponent,
    BarChartComponent,
    ScatterPlotComponent,
    Scatter3dPlotComponent,
    ModelProfilesComponent,
    UpdateBannerComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly state = inject(AppState);
}
