import {Theme} from '../state/theme.state';

export interface PlotColors {
  api: string;
  local: string;
  useful: string;
  /** Text color of the labels of Pareto efficient points; darker than `useful` where the yellow is faint. */
  usefulLabel: string;
  axisBest: string;
  /** Text color of the labels of best per axis points; darker than `axisBest` where the yellow is faint. */
  axisBestLabel: string;
  balanced: string;
  /** Outline around the best balanced marker; contrasts with the plot background. */
  balancedRing: string;
  deprecated: string;
  attractiveFill: string;
  unattractiveFill: string;
  attractiveLabel: string;
  /** Share of black mixed into a point label that lies in the "Most attractive" zone; 0 keeps the color. */
  attractiveTextShade: number;
  /** Text color of the model names in the 3D plot. */
  pointLabel3d: string;
  /** Share of black mixed into the effort labels of the 3D plot; 0 keeps the line color. */
  effortLabelShade3d: number;
  unattractiveLabel: string;
  /** Solid RGB for the edges of a Plotly 3D cuboid (opacity applied separately). */
  attractiveCuboid: string;
  unattractiveCuboid: string;
}

const DARK: PlotColors = {
  api: 'rgba(109,160,240,1)',
  local: 'rgba(64,200,200,1)',
  useful: 'rgba(220,210,70,1)',
  usefulLabel: 'rgba(220,210,70,1)',
  axisBest: '#ffd60a',
  axisBestLabel: '#ffd60a',
  balanced: '#ff6a1a',
  balancedRing: '#ffffff',
  deprecated: 'rgba(160,160,160,0.65)',
  attractiveFill: 'rgba(120,220,130,0.35)',
  unattractiveFill: 'rgba(220,90,90,0.22)',
  attractiveLabel: 'rgba(80,200,90,0.9)',
  attractiveTextShade: 0,
  pointLabel3d: '#a3a8b0',
  effortLabelShade3d: 0,
  unattractiveLabel: 'rgba(220,90,90,0.85)',
  attractiveCuboid: 'rgb(120,220,130)',
  unattractiveCuboid: 'rgb(220,90,90)',
};

const LIGHT: PlotColors = {
  api: '#1e5bc6',
  local: '#0d7a7a',
  useful: '#a67c00',
  usefulLabel: '#6b5000',
  axisBest: '#eab308',
  axisBestLabel: '#a16207',
  balanced: '#d4400b',
  balancedRing: '#1a202c',
  deprecated: 'rgba(90,90,90,0.7)',
  attractiveFill: 'rgba(34,160,60,0.22)',
  unattractiveFill: 'rgba(200,50,50,0.18)',
  attractiveLabel: 'rgba(25,125,50,1)',
  attractiveTextShade: 0.45,
  pointLabel3d: '#4a5568',
  effortLabelShade3d: 0.35,
  unattractiveLabel: 'rgba(170,40,40,1)',
  attractiveCuboid: 'rgb(34,160,60)',
  unattractiveCuboid: 'rgb(200,50,50)',
};

export function getPlotColors(theme: Theme): PlotColors {
  return theme === 'light' ? LIGHT : DARK;
}

function channelsOf(color: string): number[] {
  return color.startsWith('#')
    ? [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16))
    : color.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number);
}

/** Mixes a hex or rgb(a) color with black; `amount` 0 returns the color, 1 returns black. */
export function darken(color: string, amount: number): string {
  if (amount <= 0) return color;
  const [r, g, b] = channelsOf(color).map(c => Math.round(c * (1 - amount)));
  return `rgb(${r},${g},${b})`;
}

/** A hex or rgb(a) color with the given alpha. */
export function withAlpha(color: string, alpha: number): string {
  const [r, g, b] = channelsOf(color);
  return `rgba(${r},${g},${b},${alpha})`;
}
