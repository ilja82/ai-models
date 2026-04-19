import {Component, inject} from '@angular/core';
import {PwaUpdateService} from '../../services/pwa-update.service';

@Component({
  selector: 'app-update-banner',
  standalone: true,
  templateUrl: './update-banner.html',
  styleUrl: './update-banner.scss',
})
export class UpdateBannerComponent {
  readonly svc = inject(PwaUpdateService);
}
