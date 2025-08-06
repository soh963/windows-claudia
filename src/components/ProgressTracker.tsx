import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  ChevronDown,
  Activity,
  FileText,
  Code,
  Package,
  Brain,
  Zap,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMonitoringStore, type OperationType } from '@/stores/monitoringStore';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { format } from 'date-fns';

interface ProgressTrackerProps {
  className?: string;
  onClose?: () => void;
}

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({ className, onClose }) => {
  const {
    operations,
    activeOperations,
    isProgressTrackerVisible,
    selectedOperationId,
    selectOperation,
    clearCompletedOperations,
  } = useMonitoringStore();

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['active']));

  // Group operations by type and status
  const groupedOperations = useMemo(() => {
    const groups = new Map<string, Array<ReturnType<typeof operations.get>>>();
    
    operations.forEach((op) => {
      if (!op) return;
      
      const key = op.status === 'running' || op.status === 'pending' ? 'active' : op.type;
      const group = groups.get(key) || [];
      group.push(op);
      groups.set(key, group);
    });

    // Sort operations within each group by start time (newest first)
    groups.forEach((ops) => {
      ops.sort((a, b) => (b?.startTime || 0) - (a?.startTime || 0));
    });

    return groups;
  }, [operations]);

  // Calculate statistics
  const stats = useMemo(() => {
    let total = 0;
    let completed = 0;
    let failed = 0;
    let totalDuration = 0;
    let operationsByType: Record<OperationType, number> = {
      api_call: 0,
      file_operation: 0,
      tool_execution: 0,
      build_process: 0,
      gemini_request: 0,
      claude_request: 0,
    };

    operations.forEach((op) => {
      if (!op) return;
      
      total++;
      if (op.status === 'completed') completed++;
      if (op.status === 'error') failed++;
      if (op.endTime) {
        totalDuration += op.endTime - op.startTime;
      }
      operationsByType[op.type]++;
    });

    const avgDuration = total > 0 ? totalDuration / total : 0;

    return {
      total,
      completed,
      failed,
      active: activeOperations.length,
      avgDuration,
      successRate: total > 0 ? (completed / total) * 100 : 0,
      operationsByType,
    };
  }, [operations, activeOperations]);

  // Progress over time data for chart
  const progressData = useMemo(() => {
    const dataPoints: Array<{ time: string; progress: number; operations: number }> = [];
    const now = Date.now();
    const timeWindow = 5 * 60 * 1000; // 5 minutes
    const interval = 10 * 1000; // 10 seconds

    for (let time = now - timeWindow; time <= now; time += interval) {
      let totalProgress = 0;
      let operationCount = 0;

      operations.forEach((op) => {
        if (!op) return;
        
        if (op.startTime <= time && (!op.endTime || op.endTime >= time)) {
          operationCount++;
          // Estimate progress at this time
          if (op.endTime && op.endTime <= time) {
            totalProgress += 100;
          } else if (op.status === 'running') {
            const elapsed = time - op.startTime;
            const estimatedDuration = stats.avgDuration || 5000;
            const estimatedProgress = Math.min(100, (elapsed / estimatedDuration) * 100);
            totalProgress += estimatedProgress;
          }
        }
      });

      dataPoints.push({
        time: format(new Date(time), 'HH:mm:ss'),
        progress: operationCount > 0 ? totalProgress / operationCount : 0,
        operations: operationCount,
      });
    }

    return dataPoints;
  }, [operations, stats.avgDuration]);

  // Pie chart data for operation types
  const pieData = useMemo(() => {
    return Object.entries(stats.operationsByType)
      .filter(([_, count]) => count > 0)
      .map(([type, count]) => ({
        name: getOperationTypeLabel(type as OperationType),
        value: count,
      }));
  }, [stats.operationsByType]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  if (!isProgressTrackerVisible) return null;

  return (
    <motion.div
      initial={{ x: -320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -320, opacity: 0 }}
      transition={{ type: 'spring', damping: 20 }}
      className={cn(
        "fixed left-0 top-0 h-full w-80 bg-background border-r shadow-lg z-40",
        className
      )}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Progress Tracker</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Overview Stats */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Total Operations</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Active</p>
                    <p className="text-2xl font-bold text-primary">{stats.active}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Success Rate</p>
                    <p className="text-2xl font-bold text-green-500">{stats.successRate.toFixed(0)}%</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Avg Duration</p>
                    <p className="text-2xl font-bold">{(stats.avgDuration / 1000).toFixed(1)}s</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Progress Chart */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Activity Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={progressData}>
                      <defs>
                        <linearGradient id="progressGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="time" 
                        fontSize={10}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis 
                        fontSize={10}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="progress"
                        stroke="hsl(var(--primary))"
                        fillOpacity={1}
                        fill="url(#progressGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Operation Types Distribution */}
            {pieData.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Operation Types</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={30}
                          outerRadius={50}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((_, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={COLORS[index % COLORS.length]} 
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 space-y-1">
                    {pieData.map((entry, index) => (
                      <div key={entry.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span>{entry.name}</span>
                        </div>
                        <span className="text-muted-foreground">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Operations List */}
            <div className="space-y-2">
              {Array.from(groupedOperations.entries()).map(([category, ops]) => (
                <OperationCategory
                  key={category}
                  category={category}
                  operations={ops}
                  isExpanded={expandedCategories.has(category)}
                  onToggle={() => toggleCategory(category)}
                  selectedOperationId={selectedOperationId}
                  onSelectOperation={selectOperation}
                />
              ))}
            </div>

            {/* Actions */}
            {stats.completed > 0 && (
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={clearCompletedOperations}
                >
                  Clear Completed Operations
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </motion.div>
  );
};

interface OperationCategoryProps {
  category: string;
  operations: Array<NonNullable<ReturnType<typeof useMonitoringStore>['operations']['get']>>;
  isExpanded: boolean;
  onToggle: () => void;
  selectedOperationId: string | null;
  onSelectOperation: (id: string | null) => void;
}

const OperationCategory: React.FC<OperationCategoryProps> = ({
  category,
  operations,
  isExpanded,
  onToggle,
  selectedOperationId,
  onSelectOperation,
}) => {
  const getCategoryIcon = () => {
    if (category === 'active') return <Activity className="h-4 w-4" />;
    
    switch (category as OperationType) {
      case 'api_call':
        return <Zap className="h-4 w-4" />;
      case 'file_operation':
        return <FileText className="h-4 w-4" />;
      case 'tool_execution':
        return <Code className="h-4 w-4" />;
      case 'build_process':
        return <Package className="h-4 w-4" />;
      case 'gemini_request':
      case 'claude_request':
        return <Brain className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getCategoryLabel = () => {
    if (category === 'active') return 'Active Operations';
    return getOperationTypeLabel(category as OperationType);
  };

  return (
    <Card>
      <CardHeader
        className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getCategoryIcon()}
            <span className="text-sm font-medium">{getCategoryLabel()}</span>
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {operations.length}
            </Badge>
          </div>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <CardContent className="p-2 pt-0 space-y-1">
              {operations.map((op) => (
                <OperationListItem
                  key={op.id}
                  operation={op}
                  isSelected={selectedOperationId === op.id}
                  onSelect={() => onSelectOperation(op.id === selectedOperationId ? null : op.id)}
                />
              ))}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

interface OperationListItemProps {
  operation: NonNullable<ReturnType<typeof useMonitoringStore>['operations']['get']>;
  isSelected: boolean;
  onSelect: () => void;
}

const OperationListItem: React.FC<OperationListItemProps> = ({
  operation,
  isSelected,
  onSelect,
}) => {
  const getStatusIcon = () => {
    switch (operation.status) {
      case 'running':
        return <Loader2 className="h-3 w-3 animate-spin text-primary" />;
      case 'completed':
        return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      case 'error':
        return <XCircle className="h-3 w-3 text-destructive" />;
      default:
        return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getDuration = () => {
    const endTime = operation.endTime || Date.now();
    const duration = endTime - operation.startTime;
    return formatDuration(duration);
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "p-2 rounded-md cursor-pointer transition-colors",
        isSelected ? "bg-primary/10" : "hover:bg-muted/50"
      )}
      onClick={onSelect}
    >
      <div className="flex items-start gap-2">
        {getStatusIcon()}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate">{operation.name}</div>
          {operation.description && (
            <div className="text-xs text-muted-foreground truncate">{operation.description}</div>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">{getDuration()}</span>
            {operation.status === 'running' && (
              <Progress value={operation.progress} className="h-1 flex-1" />
            )}
          </div>
        </div>
      </div>
      {isSelected && operation.error && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="mt-2 p-2 rounded bg-destructive/10 border border-destructive/20"
        >
          <p className="text-xs text-destructive">{operation.error.message}</p>
        </motion.div>
      )}
    </motion.div>
  );
};

// Helper functions
function getOperationTypeLabel(type: OperationType): string {
  const labels: Record<OperationType, string> = {
    api_call: 'API Calls',
    file_operation: 'File Operations',
    tool_execution: 'Tool Executions',
    build_process: 'Build Processes',
    gemini_request: 'Gemini Requests',
    claude_request: 'Claude Requests',
  };
  return labels[type] || type;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export default ProgressTracker;