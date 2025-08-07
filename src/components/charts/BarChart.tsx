import React, { useMemo, useRef } from 'react';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { motion } from 'framer-motion';
import { Download, Maximize2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { ExportOptions } from '@/lib/stores/visualizationStore';

interface BarChartData {
  name: string;
  value: number;
  category?: string;
  color?: string;
  [key: string]: any;
}

interface BarChartProps {
  data: BarChartData[];
  title?: string;
  className?: string;
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  animated?: boolean;
  colors?: string[];
  layout?: 'horizontal' | 'vertical';
  yAxisLabel?: string;
  xAxisLabel?: string;
  barSize?: number;
  showValues?: boolean;
  onExport?: (options: ExportOptions) => void;
  loading?: boolean;
  stacked?: boolean;
  stackKeys?: string[];
}

const DEFAULT_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export const BarChart: React.FC<BarChartProps> = ({
  data,
  title,
  className,
  height = 300,
  showLegend = true,
  showGrid = true,
  showTooltip = true,
  animated = true,
  colors = DEFAULT_COLORS,
  layout = 'vertical',
  yAxisLabel,
  xAxisLabel,
  barSize = 40,
  showValues = false,
  onExport,
  loading = false,
  stacked = false,
  stackKeys = [],
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  // Sort data by value for better visualization
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => b.value - a.value);
  }, [data]);

  // Handle export
  const handleExport = (format: string) => {
    if (onExport) {
      onExport({
        format: format as any,
        chartType: 'bar-chart',
        dateRange: {
          start: Date.now() - (24 * 60 * 60 * 1000), // Last 24 hours
          end: Date.now(),
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
        <p className="text-sm font-medium text-foreground mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name || 'Value'}:</span>
            <span className="font-medium text-foreground">
              {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Custom label component for showing values on bars
  const CustomLabel = (props: any) => {
    const { x, y, width, height, value } = props;
    
    if (!showValues) return null;
    
    return (
      <text
        x={layout === 'horizontal' ? x + width + 5 : x + width / 2}
        y={layout === 'horizontal' ? y + height / 2 : y - 5}
        fill="hsl(var(--muted-foreground))"
        textAnchor={layout === 'horizontal' ? 'start' : 'middle'}
        dominantBaseline={layout === 'horizontal' ? 'middle' : 'auto'}
        fontSize={12}
      >
        {value.toLocaleString()}
      </text>
    );
  };

  if (loading) {
    return (
      <Card className={cn('', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {title || 'Bar Chart'}
            </CardTitle>
          </div>
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

  if (!data.length) {
    return (
      <Card className={cn('', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {title || 'Bar Chart'}
            </CardTitle>
          </div>
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
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {title || 'Bar Chart'}
            </CardTitle>
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
              <RechartsBarChart
                data={sortedData}
                layout={layout}
                margin={{ 
                  top: 10, 
                  right: showValues ? 30 : 10, 
                  left: 10, 
                  bottom: 5 
                }}
              >
                {showGrid && (
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke="hsl(var(--border))"
                    opacity={0.5}
                  />
                )}
                {layout === 'horizontal' ? (
                  <>
                    <XAxis
                      type="number"
                      fontSize={12}
                      stroke="hsl(var(--muted-foreground))"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      label={xAxisLabel ? { 
                        value: xAxisLabel, 
                        position: 'insideBottom',
                        offset: -5,
                        style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))' }
                      } : undefined}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      fontSize={12}
                      stroke="hsl(var(--muted-foreground))"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      width={80}
                      label={yAxisLabel ? { 
                        value: yAxisLabel, 
                        angle: -90, 
                        position: 'insideLeft',
                        style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))' }
                      } : undefined}
                    />
                  </>
                ) : (
                  <>
                    <XAxis
                      type="category"
                      dataKey="name"
                      fontSize={12}
                      stroke="hsl(var(--muted-foreground))"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                      label={xAxisLabel ? { 
                        value: xAxisLabel, 
                        position: 'insideBottom',
                        offset: -5,
                        style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))' }
                      } : undefined}
                    />
                    <YAxis
                      type="number"
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
                  </>
                )}
                {showTooltip && <Tooltip content={<CustomTooltip />} />}
                {showLegend && stacked && (
                  <Legend 
                    wrapperStyle={{
                      paddingTop: '20px',
                      fontSize: '12px',
                    }}
                  />
                )}
                
                {stacked && stackKeys.length > 0 ? (
                  // Stacked bars
                  stackKeys.map((key, index) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      stackId="stack"
                      fill={colors[index % colors.length]}
                      radius={index === stackKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                      animationDuration={animated ? 750 : 0}
                      label={showValues && index === stackKeys.length - 1 ? <CustomLabel /> : undefined}
                    />
                  ))
                ) : (
                  // Single bar
                  <Bar
                    dataKey="value"
                    fill={colors[0]}
                    radius={[4, 4, 4, 4]}
                    maxBarSize={barSize}
                    animationDuration={animated ? 750 : 0}
                    label={showValues ? <CustomLabel /> : undefined}
                  >
                    {sortedData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color || colors[index % colors.length]} 
                      />
                    ))}
                  </Bar>
                )}
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default BarChart;