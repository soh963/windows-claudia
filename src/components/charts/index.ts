export { default as LineChart } from './LineChart';
export { default as BarChart } from './BarChart';
export { default as PieChart } from './PieChart';
export { default as Timeline } from './Timeline';
export { default as AccessibleChart } from './AccessibleChart';

export type { TimelineEvent } from './Timeline';

// Chart utilities and common types
export interface ChartBaseProps {
  title?: string;
  className?: string;
  height?: number;
  loading?: boolean;
  animated?: boolean;
  onExport?: (options: any) => void;
}

export const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export const CHART_THEMES = {
  light: {
    background: 'hsl(var(--background))',
    foreground: 'hsl(var(--foreground))',
    muted: 'hsl(var(--muted-foreground))',
    border: 'hsl(var(--border))',
  },
  dark: {
    background: 'hsl(var(--background))',
    foreground: 'hsl(var(--foreground))',
    muted: 'hsl(var(--muted-foreground))',
    border: 'hsl(var(--border))',
  },
};