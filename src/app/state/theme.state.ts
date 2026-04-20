import {computed, effect, Injectable, signal} from '@angular/core';

export type Theme = 'light' | 'dark';

const KEY = 'ai-models.theme';

@Injectable({providedIn: 'root'})
export class ThemeState {
  private readonly mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  private readonly systemTheme = signal<Theme>(this.mediaQuery.matches ? 'dark' : 'light');
  readonly override = signal<Theme | null>(this.loadOverride());
  readonly theme = computed<Theme>(() => this.override() ?? this.systemTheme());

  constructor() {
    this.mediaQuery.addEventListener('change', e =>
      this.systemTheme.set(e.matches ? 'dark' : 'light'));

    effect(() => {
      const o = this.override();
      const root = document.documentElement;
      if (o === null) {
        root.removeAttribute('data-theme');
        localStorage.removeItem(KEY);
      } else {
        root.setAttribute('data-theme', o);
        localStorage.setItem(KEY, o);
      }
    });
  }

  toggle(): void {
    this.override.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  private loadOverride(): Theme | null {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  }
}
