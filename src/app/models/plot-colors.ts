import {Theme} from '../state/theme.state';

export interface PlotColors {
  api: string;
  local: string;
  useful: string;
  axisBest: string;
  balanced: string;
  deprecated: string;
  attractiveFill: string;
  unattractiveFill: string;
  attractiveLabel: string;
  unattractiveLabel: string;
  /** Solid RGB for Plotly mesh3d cuboid (opacity applied separately). */
  attractiveCuboid: string;
  unattractiveCuboid: string;
}

const DARK: PlotColors = {
  api: 'rgba(109,160,240,1)',
  local: 'rgba(64,200,200,1)',
  useful: 'rgba(220,210,70,1)',
  axisBest: '#ffd166',
  balanced: '#e7b94a',
  deprecated: 'rgba(160,160,160,0.65)',
  attractiveFill: 'rgba(120,220,130,0.35)',
  unattractiveFill: 'rgba(220,90,90,0.22)',
  attractiveLabel: 'rgba(80,200,90,0.9)',
  unattractiveLabel: 'rgba(220,90,90,0.85)',
  attractiveCuboid: 'rgb(120,220,130)',
  unattractiveCuboid: 'rgb(220,90,90)',
};

const LIGHT: PlotColors = {
  api: '#1e5bc6',
  local: '#0d7a7a',
  useful: '#a67c00',
  axisBest: '#d97706',
  balanced: '#a05a00',
  deprecated: 'rgba(90,90,90,0.7)',
  attractiveFill: 'rgba(34,160,60,0.22)',
  unattractiveFill: 'rgba(200,50,50,0.18)',
  attractiveLabel: 'rgba(25,125,50,1)',
  unattractiveLabel: 'rgba(170,40,40,1)',
  attractiveCuboid: 'rgb(34,160,60)',
  unattractiveCuboid: 'rgb(200,50,50)',
};

export function getPlotColors(theme: Theme): PlotColors {
  return theme === 'light' ? LIGHT : DARK;
}
