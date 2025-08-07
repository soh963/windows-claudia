import React from 'react';
import TaskTimeline from './TaskTimeline';

export default function RightPanel() {
  return (
    <div className="right-panel h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold text-foreground">Session Timeline</h3>
        <p className="text-sm text-muted-foreground">Task analytics and session insights</p>
      </div>
      
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          <TaskTimeline />
        </div>
      </div>
    </div>
  );
}