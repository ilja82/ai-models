import {DOCUMENT, computed, inject, Injectable, OnDestroy, signal} from '@angular/core';
import {SwUpdate, VersionReadyEvent} from '@angular/service-worker';
import {filter} from 'rxjs/operators';
import {Subscription} from 'rxjs';

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const RELOADED_HASH_KEY = 'pwa-update.reloaded-hash';

@Injectable({providedIn: 'root'})
export class PwaUpdateService implements OnDestroy {
  private readonly swUpdate = inject(SwUpdate);
  private readonly document = inject(DOCUMENT);

  readonly updateAvailable = signal(false);
  readonly unrecoverable = signal(false);
  readonly showHint = computed(() => this.updateAvailable() || this.unrecoverable());

  private current: Promise<void> | null = null;
  private pending: {manualOwnsReload: boolean} | null = null;
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
        .subscribe(e => void this.autoApply(e.latestVersion.hash)),
    );

    this.subs.add(
      this.swUpdate.unrecoverable.subscribe(() => this.unrecoverable.set(true)),
    );

    this.intervalId = setInterval(() => {
      void this.swUpdate.checkForUpdate();
    }, CHECK_INTERVAL_MS);

    this.document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  private async autoApply(hash: string): Promise<void> {
    if (this.current) {
      this.updateAvailable.set(true);
      return;
    }
    const own = {manualOwnsReload: false};
    this.pending = own;
    this.current = this.attempt(hash, own);
    try {
      await this.current;
    } finally {
      this.current = null;
      this.pending = null;
    }
  }

  private async attempt(hash: string, own: {manualOwnsReload: boolean}): Promise<void> {
    const storage = this.guardStorage();
    try {
      if (!storage || storage.getItem(RELOADED_HASH_KEY) === hash) {
        throw new Error('guard');
      }
      storage.setItem(RELOADED_HASH_KEY, hash);
    } catch {
      this.updateAvailable.set(true);
      return;
    }
    this.updateAvailable.set(false);
    try {
      await this.swUpdate.activateUpdate();
    } catch {
      if (!own.manualOwnsReload) {
        this.updateAvailable.set(true);
      }
      return;
    }
    if (own.manualOwnsReload) {
      return;
    }
    try {
      this.document.defaultView!.location.reload();
    } catch {
      this.updateAvailable.set(true);
    }
  }

  private guardStorage(): Storage | null {
    try {
      return this.document.defaultView?.sessionStorage ?? null;
    } catch {
      return null;
    }
  }

  async applyUpdate(): Promise<void> {
    if (this.pending) {
      this.pending.manualOwnsReload = true;
    }
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
