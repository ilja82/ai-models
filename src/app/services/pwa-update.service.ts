import {DOCUMENT, inject, Injectable, OnDestroy, signal} from '@angular/core';
import {SwUpdate, VersionReadyEvent} from '@angular/service-worker';
import {filter} from 'rxjs/operators';
import {Subscription} from 'rxjs';

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

@Injectable({providedIn: 'root'})
export class PwaUpdateService implements OnDestroy {
  private readonly swUpdate = inject(SwUpdate);
  private readonly document = inject(DOCUMENT);

  readonly updateAvailable = signal(false);
  readonly unrecoverable = signal(false);

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly subs = new Subscription();
  private readonly onVisibilityChange = () => {
    if (this.document.visibilityState === 'visible') {
      void this.swUpdate.checkForUpdate();
    }
  };

  constructor() {
    if (!this.swUpdate.isEnabled) {
      return;
    }

    this.subs.add(
      this.swUpdate.versionUpdates
        .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
        .subscribe(() => this.updateAvailable.set(true)),
    );

    this.subs.add(
      this.swUpdate.unrecoverable.subscribe(() => this.unrecoverable.set(true)),
    );

    this.intervalId = setInterval(() => {
      void this.swUpdate.checkForUpdate();
    }, CHECK_INTERVAL_MS);

    this.document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  async applyUpdate(): Promise<void> {
    if (this.swUpdate.isEnabled) {
      try {
        await this.swUpdate.activateUpdate();
      } catch {
        // fall through to reload — reload alone also picks up the new SW
      }
    }
    this.document.defaultView?.location.reload();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
    }
    this.document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }
}
