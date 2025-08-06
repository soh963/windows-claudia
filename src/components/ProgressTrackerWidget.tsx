import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  CheckCircle,
  AlertCircle,
  Clock,
  BarChart3,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUnifiedChatStore } from '@/stores/unifiedChatStore';

interface ProgressMetrics {
  completionPercentage: number;
  errorRate: number;
  goalsAchieved: number;
  totalGoals: number;
  averageResponseTime: number;
  messagesProcessed: number;
  modelSwitches: number;
  activeTime: number; // in minutes
}

interface ProgressTrackerProps {
  sessionId?: string;
  className?: string;
  compact?: boolean;
  showDetails?: boolean;
}

const calculateMetrics = (session: any): ProgressMetrics => {
  if (!session) {
    return {
      completionPercentage: 0,
      errorRate: 0,
      goalsAchieved: 0,
      totalGoals: 0,
      averageResponseTime: 0,
      messagesProcessed: 0,
      modelSwitches: 0,
      activeTime: 0
    };
  }

  const messages = session.messages || [];
  const errorMessages = messages.filter((m: any) => m.metadata?.error);
  const successfulMessages = messages.filter((m: any) => m.role === 'assistant' && !m.metadata?.error);
  
  // Calculate completion based on successful responses
  const completionPercentage = messages.length > 0 
    ? Math.round((successfulMessages.length / messages.filter((m: any) => m.role === 'user').length) * 100) || 0
    : 0;
  
  // Calculate error rate
  const errorRate = messages.length > 0
    ? Math.round((errorMessages.length / messages.length) * 100)
    : 0;
  
  // Calculate average response time
  const responseTimes = messages
    .filter((m: any) => m.metadata?.processingTime)
    .map((m: any) => m.metadata.processingTime);
  const averageResponseTime = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0;
  
  // Calculate active time
  const sessionStart = session.created_at ? new Date(session.created_at) : new Date();
  const activeTime = Math.round((Date.now() - sessionStart.getTime()) / 1000 / 60);
  
  return {
    completionPercentage,
    errorRate,
    goalsAchieved: session.todo_data?.completed || 0,
    totalGoals: session.todo_data?.total || 0,
    averageResponseTime,
    messagesProcessed: messages.length,
    modelSwitches: session.modelSwitchHistory?.length || 0,
    activeTime
  };
};

const MetricCard: React.FC<{
  label: string;
  value: number | string;
  unit?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
  compact?: boolean;
}> = ({ label, value, unit, icon, trend, color = 'text-foreground', compact = false }) => {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null;
  
  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <div className={cn("p-1 rounded", color)}>{icon}</div>
        <span className="text-sm font-medium">{value}{unit}</span>
      </div>
    );
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-lg p-3"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold mt-1">
            {value}
            {unit && <span className="text-sm font-normal text-muted-foreground ml-0.5">{unit}</span>}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <div className={cn("p-1.5 rounded-md bg-background", color)}>
            {icon}
          </div>
          {TrendIcon && (
            <TrendIcon className={cn(
              "h-3 w-3",
              trend === 'up' ? 'text-green-500' : 'text-red-500'
            )} />
          )}
        </div>
      </div>
    </motion.div>
  );
};

export const ProgressTrackerWidget: React.FC<ProgressTrackerProps> = ({
  sessionId,
  className,
  compact = false,
  showDetails = true
}) => {
  const { sessions, activeSessionId } = useUnifiedChatStore();
  const [metrics, setMetrics] = useState<ProgressMetrics>(calculateMetrics(null));
  const [isUpdating, setIsUpdating] = useState(false);
  
  const currentSessionId = sessionId || activeSessionId;
  const session = currentSessionId ? sessions[currentSessionId] : null;
  
  useEffect(() => {
    if (session) {
      setIsUpdating(true);
      const newMetrics = calculateMetrics(session);
      setMetrics(newMetrics);
      
      // Animate the update
      setTimeout(() => setIsUpdating(false), 300);
    }
  }, [session]);
  
  if (!session) {
    return (
      <div className={cn("p-4 text-center text-muted-foreground", className)}>
        <p className="text-sm">No active session</p>
      </div>
    );
  }
  
  if (compact) {
    return (
      <div className={cn("flex items-center gap-4 p-2", className)}>
        <MetricCard
          label="Completion"
          value={metrics.completionPercentage}
          unit="%"
          icon={<CheckCircle className="h-3.5 w-3.5" />}
          color="text-green-500"
          compact
        />
        <MetricCard
          label="Errors"
          value={metrics.errorRate}
          unit="%"
          icon={<AlertCircle className="h-3.5 w-3.5" />}
          color={metrics.errorRate > 10 ? "text-red-500" : "text-yellow-500"}
          compact
        />
        <MetricCard
          label="Response"
          value={metrics.averageResponseTime}
          unit="ms"
          icon={<Zap className="h-3.5 w-3.5" />}
          color="text-blue-500"
          compact
        />
      </div>
    );
  }
  
  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Progress Tracking
          {isUpdating && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Clock className="h-3 w-3 text-muted-foreground" />
            </motion.div>
          )}
        </h3>
        <span className="text-xs text-muted-foreground">
          {metrics.activeTime} min active
        </span>
      </div>
      
      {/* Main metrics */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label="Completion Rate"
          value={metrics.completionPercentage}
          unit="%"
          icon={<CheckCircle className="h-4 w-4" />}
          trend={metrics.completionPercentage > 80 ? 'up' : 'down'}
          color="text-green-500"
        />
        <MetricCard
          label="Error Rate"
          value={metrics.errorRate}
          unit="%"
          icon={<AlertCircle className="h-4 w-4" />}
          trend={metrics.errorRate > 10 ? 'down' : 'neutral'}
          color={metrics.errorRate > 10 ? "text-red-500" : "text-yellow-500"}
        />
      </div>
      
      {showDetails && (
        <>
          {/* Goals progress */}
          {metrics.totalGoals > 0 && (
            <div className="bg-card border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  Goals Progress
                </span>
                <span className="text-xs font-medium">
                  {metrics.goalsAchieved} / {metrics.totalGoals}
                </span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(metrics.goalsAchieved / metrics.totalGoals) * 100}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="h-full bg-primary rounded-full"
                />
              </div>
            </div>
          )}
          
          {/* Additional metrics */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 bg-muted/50 rounded-md">
              <p className="text-xs text-muted-foreground">Messages</p>
              <p className="text-sm font-medium">{metrics.messagesProcessed}</p>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded-md">
              <p className="text-xs text-muted-foreground">Avg Response</p>
              <p className="text-sm font-medium">{metrics.averageResponseTime}ms</p>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded-md">
              <p className="text-xs text-muted-foreground">Model Switches</p>
              <p className="text-sm font-medium">{metrics.modelSwitches}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};