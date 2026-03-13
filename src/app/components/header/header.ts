import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppState } from '../../state/app.state';
import { IntelligenceMetric } from '../../models/ai-model.model';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class HeaderComponent {
  readonly state = inject(AppState);

  setMetric(metric: IntelligenceMetric): void {
    this.state.intelligenceMetric.set(metric);
  }

  setVram(value: string): void {
    const num = parseFloat(value);
    this.state.maxVram.set(isNaN(num) || value === '' ? null : num);
  }

  get vramValue(): string {
    const v = this.state.maxVram();
    return v === null ? '' : String(v);
  }
}
