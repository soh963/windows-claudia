import React, { useMemo, useRef, useEffect } from 'react';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import { motion } from 'framer-motion';
import { Download, Maximize2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { ChartData, ExportOptions } from '@/lib/stores/visualizationStore';

interface LineChartProps {
  data: ChartData[];
  title?: string;
  className?: string;
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  animated?: boolean;
  colors?: string[];
  xAxisKey?: string;
  yAxisLabel?: string;
  xAxisLabel?: string;
  strokeWidth?: number;
  dot?: boolean;
  onExport?: (options: ExportOptions) => void;
  loading?: boolean;
}

const DEFAULT_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export const LineChart: React.FC<LineChartProps> = ({
  data,
  title,
  className,
  height = 300,
  showLegend = true,
  showGrid = true,
  showTooltip = true,
  animated = true,
  colors = DEFAULT_COLORS,
  xAxisKey = 'timestamp',
  yAxisLabel,
  xAxisLabel,
  strokeWidth = 2,
  dot = false,
  onExport,
  loading = false,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  // Transform data for Recharts
  const chartData = useMemo(() => {
    if (!data.length) return [];
    
    // Get all timestamps from all series
    const allTimestamps = new Set<number>();
    data.forEach(series => {
      series.data.forEach(point => {
        allTimestamps.add(point.timestamp);
      });
    });
    
    // Create combined data points
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);
    
    return sortedTimestamps.map(timestamp => {
      const dataPoint: any = {
        timestamp,
        label: new Date(timestamp).toLocaleTimeString(),
      };
      
      data.forEach(series => {
        const point = series.data.find(p => p.timestamp === timestamp);
        dataPoint[series.id] = point?.value || null;
      });
      
      return dataPoint;
    });
  }, [data]);

  // Handle export
  const handleExport = (format: string) => {
    if (onExport) {
      onExport({
        format: format as any,
        chartType: 'line-chart',
        dateRange: {
          start: Math.min(...data.flatMap(d => d.data.map(p => p.timestamp))),
          end: Math.max(...data.flatMap(d => d.data.map(p => p.timestamp))),
        },
        includeMetadata: true,
      });
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium text-foreground mb-2">
          {new Date(label).toLocaleString()}
        </p>
        {payload.map((entry: any, index: number) => {
          const series = data.find(d => d.id === entry.dataKey);
          return (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{series?.name || entry.dataKey}:</span>
              <span className="font-medium text-foreground">
                {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <Card className={cn('', className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{title || 'Line Chart'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div 
            className="flex items-center justify-center bg-muted/50 rounded-lg animate-pulse"
            style={{ height }}
          >
            <div className="text-muted-foreground text-sm">Loading chart data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data.length || !chartData.length) {
    return (
      <Card className={cn('', className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{title || 'Line Chart'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div 
            className="flex items-center justify-center bg-muted/10 rounded-lg border-2 border-dashed border-muted-foreground/25"
            style={{ height }}
          >
            <div className="text-center text-muted-foreground">
              <div className="text-sm font-medium mb-1">No data available</div>
              <div className="text-xs">Chart will update when data is available</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={animated ? { opacity: 0, y: 20 } : false}
      animate={animated ? { opacity: 1, y: 0 } : false}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn('', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">{title || 'Line Chart'}</CardTitle>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Download className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport('png')}>
                    Export as PNG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('svg')}>
                    Export as SVG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('csv')}>
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('json')}>
                    Export as JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent ref={chartRef}>
          <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              <RechartsLineChart
                data={chartData}
                margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
              >
                {showGrid && (
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke="hsl(var(--border))"
                    opacity={0.5}
                  />
                )}
                <XAxis
                  dataKey="label"
                  fontSize={12}
                  stroke="hsl(var(--muted-foreground))"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  fontSize={12}
                  stroke="hsl(var(--muted-foreground))"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  label={yAxisLabel ? { 
                    value: yAxisLabel, 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))' }
                  } : undefined}
                />
                {showTooltip && <Tooltip content={<CustomTooltip />} />}
                {showLegend && (
                  <Legend 
                    wrapperStyle={{
                      paddingTop: '20px',
                      fontSize: '12px',
                    }}
                  />
                )}
                {data.map((series, index) => (
                  <Line
                    key={series.id}
                    type="monotone"
                    dataKey={series.id}
                    name={series.name}
                    stroke={colors[index % colors.length]}
                    strokeWidth={strokeWidth}
                    dot={dot ? { r: 3, fill: colors[index % colors.length] } : false}
                    activeDot={{ r: 4, fill: colors[index % colors.length] }}
                    connectNulls={false}
                    animationDuration={animated ? 750 : 0}
                  />
                ))}
              </RechartsLineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default LineChart;