import React from 'react';
import VisualProgressTracker from './VisualProgressTracker';
import { Separator } from '@/components/ui/separator';

export default function LeftPanel() {
  return (
    <div className="left-panel h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold text-foreground">Progress Tracker</h3>
        <p className="text-sm text-muted-foreground">Monitor session progress and performance</p>
      </div>
      
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          <VisualProgressTracker />
        </div>
      </div>
    </div>
  );
}