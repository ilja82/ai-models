import { Component, inject } from '@angular/core';
import { AppState } from '../../state/app.state';

@Component({
  selector: 'app-model-toggle',
  standalone: true,
  templateUrl: './model-toggle.html',
  styleUrl: './model-toggle.scss',
})
export class ModelToggleComponent {
  readonly state = inject(AppState);
}
