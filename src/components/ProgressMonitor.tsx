import React, { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { StatusBar } from './StatusBar';
import { useMonitoringStore } from '@/stores/monitoringStore';
import { useMonitoringIntegration } from '@/hooks/useMonitoringIntegration';
import { Button } from '@/components/ui/button';
import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProgressMonitorProps {
  className?: string;
}

export const ProgressMonitor: React.FC<ProgressMonitorProps> = ({ className }) => {
  const { isProgressTrackerVisible, toggleProgressTracker } = useMonitoringStore();
  
  // Initialize monitoring integration
  useMonitoringIntegration();

  return (
    <>
      {/* Progress Tracker Toggle Button - Only show when ThreePanelLayout isn't managing it */}
      {/* Removed the floating button since ThreePanelLayout handles the ProgressTracker */}
      
      {/* Status Bar */}
      <StatusBar />
    </>
  );
};

export default ProgressMonitor;