import { useState, useEffect } from 'react';
import { useProjectStore } from '../store';

export function useAutoSave() {
  const [lastSaveTime, setLastSaveTime] = useState<number | null>(null);
  const [isAutoSaveEnabled] = useState(true);
  const currentProject = useProjectStore((state) => state.currentProject);

  useEffect(() => {
    if (!isAutoSaveEnabled || !currentProject) return;

    const interval = setInterval(() => {
      // Simulate auto-save
      setLastSaveTime(Date.now());
      console.log('Auto-save triggered for project:', currentProject.name);
    }, 30000); // Auto-save every 30 seconds

    return () => clearInterval(interval);
  }, [isAutoSaveEnabled, currentProject]);

  return {
    lastSaveTime,
    isAutoSaveEnabled,
  };
}