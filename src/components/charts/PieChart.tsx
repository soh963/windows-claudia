import React, { useMemo, useRef } from 'react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { motion } from 'framer-motion';
import { Download, Maximize2, PieChart as PieIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ExportOptions } from '@/lib/stores/visualizationStore';

interface PieChartData {
  name: string;
  value: number;
  color?: string;
  percentage?: number;
  [key: string]: any;
}

interface PieChartProps {
  data: PieChartData[];
  title?: string;
  className?: string;
  height?: number;
  showLegend?: boolean;
  showTooltip?: boolean;
  animated?: boolean;
  colors?: string[];
  innerRadius?: number;
  outerRadius?: number;
  showLabels?: boolean;
  showPercentages?: boolean;
  centerLabel?: string;
  centerValue?: string | number;
  onExport?: (options: ExportOptions) => void;
  loading?: boolean;
  donut?: boolean;
}

const DEFAULT_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export const PieChart: React.FC<PieChartProps> = ({
  data,
  title,
  className,
  height = 300,
  showLegend = true,
  showTooltip = true,
  animated = true,
  colors = DEFAULT_COLORS,
  innerRadius = 0,
  outerRadius = 80,
  showLabels = false,
  showPercentages = true,
  centerLabel,
  centerValue,
  onExport,
  loading = false,
  donut = false,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  // Calculate percentages and prepare data
  const chartData = useMemo(() => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    return data.map((item, index) => ({
      ...item,
      percentage: total > 0 ? (item.value / total) * 100 : 0,
      color: item.color || colors[index % colors.length],
    }));
  }, [data, colors]);

  // Get the actual inner radius (donut mode)
  const actualInnerRadius = useMemo(() => {
    return donut ? Math.max(innerRadius, outerRadius * 0.4) : innerRadius;
  }, [donut, innerRadius, outerRadius]);

  // Handle export
  const handleExport = (format: string) => {
    if (onExport) {
      onExport({
        format: format as any,
        chartType: 'pie-chart',
        dateRange: {
          start: Date.now() - (24 * 60 * 60 * 1000), // Last 24 hours
          end: Date.now(),
        },
        includeMetadata: true,
      });
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;

    const data = payload[0].payload;

    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: data.color }}
          />
          <p className="text-sm font-medium text-foreground">{data.name}</p>
        </div>
        <div className="space-y-1">
          <div className="text-sm">
            <span className="text-muted-foreground">Value: </span>
            <span className="font-medium text-foreground">
              {data.value.toLocaleString()}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Percentage: </span>
            <span className="font-medium text-foreground">
              {data.percentage.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Custom label component
  const CustomLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, value, percentage, name } = props;
    
    if (!showLabels || percentage < 5) return null; // Don't show labels for small slices
    
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 30;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="hsl(var(--foreground))"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={12}
        className="font-medium"
      >
        {showPercentages ? `${percentage.toFixed(1)}%` : value.toLocaleString()}
      </text>
    );
  };

  // Center label for donut chart
  const CenterLabel = () => {
    if (!donut && !centerLabel) return null;

    const total = chartData.reduce((sum, item) => sum + item.value, 0);

    return (
      <g>
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-muted-foreground text-sm"
          dy="-0.5em"
        >
          {centerLabel || 'Total'}
        </text>
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-foreground text-lg font-bold"
          dy="0.8em"
        >
          {centerValue || total.toLocaleString()}
        </text>
      </g>
    );
  };

  if (loading) {
    return (
      <Card className={cn('', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <PieIcon className="h-4 w-4" />
              {title || 'Pie Chart'}
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
              <PieIcon className="h-4 w-4" />
              {title || 'Pie Chart'}
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
              <PieIcon className="h-4 w-4" />
              {title || 'Pie Chart'}
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
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Chart */}
            <div className="flex-1" style={{ height }}>
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={showLabels ? <CustomLabel /> : false}
                    outerRadius={outerRadius}
                    innerRadius={actualInnerRadius}
                    paddingAngle={2}
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={animated ? 800 : 0}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  {showTooltip && <Tooltip content={<CustomTooltip />} />}
                  <CenterLabel />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Custom Legend */}
            {showLegend && (
              <div className="w-full lg:w-48 space-y-2">
                <div className="text-sm font-medium text-foreground mb-3">Legend</div>
                {chartData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-foreground truncate">{entry.name}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <Badge variant="secondary" className="text-xs font-mono">
                        {entry.percentage.toFixed(1)}%
                      </Badge>
                      <span className="text-muted-foreground font-mono text-xs">
                        {entry.value.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default PieChart;