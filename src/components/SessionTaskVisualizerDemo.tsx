import React, { useState } from 'react';
import { SessionTaskVisualizer } from './SessionTaskVisualizer';
import { useSessionTaskTracking } from '@/hooks/useSessionTaskTracking';
import { Button } from '@/components/ui/button';
import { Activity, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SessionTaskVisualizerDemoProps {
  sessionId?: string;
  className?: string;
}

export const SessionTaskVisualizerDemo: React.FC<SessionTaskVisualizerDemoProps> = ({
  sessionId = 'demo-session',
  className
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const { tasks, isTracking, generateMockTasks, resetTasks } = useSessionTaskTracking(sessionId);

  return (
    <div className={cn('relative', className)}>
      {/* Control buttons */}
      <div className="fixed top-20 left-4 z-50 flex flex-col gap-2">
        <Button
          variant={isVisible ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIsVisible(!isVisible)}
          className="gap-2"
        >
          {isVisible ? (
            <>
              <EyeOff className="h-4 w-4" />
              Hide Tasks
            </>
          ) : (
            <>
              <Eye className="h-4 w-4" />
              Show Tasks
            </>
          )}
        </Button>
        
        {isVisible && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={generateMockTasks}
              className="gap-2"
            >
              <Activity className="h-4 w-4" />
              Generate Mock Tasks
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={resetTasks}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reset Tasks
            </Button>
            
            <div className="text-xs text-muted-foreground bg-background/90 px-2 py-1 rounded-md">
              {isTracking ? 'Tracking active' : 'Tracking inactive'}
            </div>
          </>
        )}
      </div>

      {/* Task Visualizer */}
      <SessionTaskVisualizer
        tasks={tasks}
        sessionId={sessionId}
        isVisible={isVisible}
        onClose={() => setIsVisible(false)}
      />
    </div>
  );
};