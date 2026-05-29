import { TestBed } from '@angular/core/testing';
import { provideServiceWorker } from '@angular/service-worker';
import { App } from './app';
import { AppState } from './state/app.state';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideServiceWorker('ngsw-worker.js', { enabled: false })],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    // The chart tabs render to <canvas>, which jsdom cannot lay out. The <h1>
    // lives in the always-rendered header, so switch to the canvas-free table
    // view to validate the title without instantiating chart.js.
    TestBed.inject(AppState).activeTab.set('table');
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('AI Models');
  });
});
