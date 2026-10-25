import {TestBed} from '@angular/core/testing';
import {ScatterPlotComponent} from './scatter-plot';
import {ThemeState} from '../../state/theme.state';

describe('best per axis star icon', () => {
  it('redraws the chart when the star image of a new theme has loaded', () => {
    localStorage.clear();
    const c = TestBed.createComponent(ScatterPlotComponent).componentInstance as any;
    const theme = TestBed.inject(ThemeState);
    theme.override.set(theme.theme() === 'dark' ? 'light' : 'dark');
    const star = c.starIcon() as HTMLImageElement;
    const update = vi.fn();
    c.chart = {update, destroy: () => undefined};
    star.dispatchEvent(new Event('load'));
    expect(update).toHaveBeenCalledWith('none');
  });
});
