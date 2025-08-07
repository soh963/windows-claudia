import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX,
  Eye,
  EyeOff,
  Info,
  Keyboard,
} from 'lucide-react';

interface AccessibilityFeatures {
  announceUpdates?: boolean;
  keyboardNavigation?: boolean;
  highContrast?: boolean;
  reduceMotion?: boolean;
  dataTable?: boolean;
  audioDescription?: boolean;
}

interface AccessibleChartProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  data: any[];
  className?: string;
  accessibility?: AccessibilityFeatures;
  onDataChange?: (data: any[]) => void;
}

export const AccessibleChart: React.FC<AccessibleChartProps> = ({
  children,
  title,
  description,
  data,
  className,
  accessibility = {},
  onDataChange,
}) => {
  const {
    announceUpdates = true,
    keyboardNavigation = true,
    highContrast = false,
    reduceMotion = false,
    dataTable = false,
    audioDescription = false,
  } = accessibility;

  const [isAnnouncing, setIsAnnouncing] = useState(announceUpdates);
  const [showDataTable, setShowDataTable] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentDataIndex, setCurrentDataIndex] = useState(0);
  const announcementRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  
  // Data summary for screen readers
  const dataSummary = React.useMemo(() => {
    if (!data.length) return 'No data available';
    
    const total = data.length;
    const hasValues = data.every(item => typeof item.value === 'number');
    
    if (hasValues) {
      const values = data.map(item => item.value);
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      
      return `Chart contains ${total} data points. Values range from ${min.toLocaleString()} to ${max.toLocaleString()}, with an average of ${avg.toFixed(2)}.`;
    }
    
    return `Chart contains ${total} data points.`;
  }, [data]);

  // Keyboard navigation
  useEffect(() => {
    if (!keyboardNavigation) return;

    const handleKeyPress = (event: KeyboardEvent) => {
      if (!chartRef.current?.contains(event.target as Node)) return;

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          setCurrentDataIndex(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowRight':
          event.preventDefault();
          setCurrentDataIndex(prev => Math.min(data.length - 1, prev + 1));
          break;
        case 'Home':
          event.preventDefault();
          setCurrentDataIndex(0);
          break;
        case 'End':
          event.preventDefault();
          setCurrentDataIndex(data.length - 1);
          break;
        case ' ':
          event.preventDefault();
          announceCurrentDataPoint();
          break;
        case 'Enter':
          event.preventDefault();
          if (audioDescription) {
            toggleAudioDescription();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [keyboardNavigation, data.length]);

  // Announce data changes
  useEffect(() => {
    if (isAnnouncing && announcementRef.current && data.length > 0) {
      const announcement = `Chart updated. ${dataSummary}`;
      announcementRef.current.textContent = announcement;
    }
  }, [data, dataSummary, isAnnouncing]);

  const announceCurrentDataPoint = () => {
    if (!data[currentDataIndex] || !announcementRef.current) return;
    
    const point = data[currentDataIndex];
    const announcement = `Data point ${currentDataIndex + 1} of ${data.length}: ${point.name || 'Item'} with value ${point.value?.toLocaleString() || 'unknown'}`;
    announcementRef.current.textContent = announcement;
  };

  const toggleAudioDescription = () => {
    if (!audioDescription) return;
    
    setIsPlaying(!isPlaying);
    if (!isPlaying) {
      // Start audio description
      playAudioDescription();
    }
  };

  const playAudioDescription = () => {
    // This would integrate with a text-to-speech service
    // For now, we'll just announce through aria-live
    if (!announcementRef.current) return;
    
    const descriptions = data.map((point, index) => 
      `Point ${index + 1}: ${point.name || 'Item'} with value ${point.value?.toLocaleString() || 'unknown'}`
    );
    
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex >= descriptions.length || !isPlaying) {
        clearInterval(interval);
        setIsPlaying(false);
        return;
      }
      
      if (announcementRef.current) {
        announcementRef.current.textContent = descriptions[currentIndex];
      }
      currentIndex++;
    }, 2000);
  };

  const generateDataTable = () => {
    if (!data.length) return null;
    
    const headers = Object.keys(data[0]);
    
    return (
      <div className="overflow-x-auto mt-4">
        <table className="w-full border-collapse border border-border">
          <caption className="sr-only">
            Data table for {title}. {dataSummary}
          </caption>
          <thead>
            <tr className="bg-muted">
              {headers.map((header, index) => (
                <th
                  key={header}
                  className="border border-border p-2 text-left text-sm font-medium"
                  scope="col"
                >
                  {header.charAt(0).toUpperCase() + header.slice(1)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/50'}>
                {headers.map((header, colIndex) => (
                  <td
                    key={header}
                    className="border border-border p-2 text-sm"
                    {...(colIndex === 0 ? { scope: 'row' } : {})}
                  >
                    {typeof row[header] === 'number' 
                      ? row[header].toLocaleString() 
                      : row[header] || '--'
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div 
      ref={chartRef}
      className={cn('relative', className)}
      role="img"
      aria-labelledby={`chart-title-${title.replace(/\s+/g, '-').toLowerCase()}`}
      aria-describedby={`chart-desc-${title.replace(/\s+/g, '-').toLowerCase()}`}
      tabIndex={keyboardNavigation ? 0 : -1}
      style={{
        filter: highContrast ? 'contrast(150%) saturate(150%)' : undefined,
      }}
    >
      {/* Screen reader announcements */}
      <div
        ref={announcementRef}
        className="sr-only"
        aria-live={isAnnouncing ? 'polite' : 'off'}
        aria-atomic="true"
      />
      
      {/* Chart title and description for screen readers */}
      <div className="sr-only">
        <h3 id={`chart-title-${title.replace(/\s+/g, '-').toLowerCase()}`}>
          {title}
        </h3>
        <div id={`chart-desc-${title.replace(/\s+/g, '-').toLowerCase()}`}>
          {description || dataSummary}
        </div>
      </div>

      {/* Accessibility Controls */}
      <div className="absolute top-2 right-2 flex items-center gap-1 bg-background/80 backdrop-blur rounded-md p-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => setIsAnnouncing(!isAnnouncing)}
          title={`${isAnnouncing ? 'Disable' : 'Enable'} announcements`}
          aria-label={`${isAnnouncing ? 'Disable' : 'Enable'} screen reader announcements`}
        >
          {isAnnouncing ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
        </Button>
        
        {dataTable && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setShowDataTable(!showDataTable)}
            title={`${showDataTable ? 'Hide' : 'Show'} data table`}
            aria-label={`${showDataTable ? 'Hide' : 'Show'} accessible data table`}
          >
            {showDataTable ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </Button>
        )}
        
        {audioDescription && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={toggleAudioDescription}
            title={`${isPlaying ? 'Stop' : 'Start'} audio description`}
            aria-label={`${isPlaying ? 'Stop' : 'Start'} audio description of chart data`}
          >
            {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </Button>
        )}
        
        {keyboardNavigation && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title="Keyboard navigation help"
            aria-label="Show keyboard navigation help"
            onClick={() => {
              if (announcementRef.current) {
                announcementRef.current.textContent = 
                  'Keyboard navigation: Arrow keys to navigate data points, Space to announce current point, Home/End for first/last point';
              }
            }}
          >
            <Keyboard className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Main chart content */}
      <div 
        className={cn(
          'transition-all',
          reduceMotion && 'motion-reduce:transition-none'
        )}
      >
        {children}
      </div>

      {/* Keyboard navigation indicator */}
      {keyboardNavigation && currentDataIndex < data.length && (
        <div className="absolute bottom-2 left-2 bg-primary/10 backdrop-blur rounded-md px-2 py-1">
          <Badge variant="outline" className="text-xs">
            Point {currentDataIndex + 1}/{data.length}
          </Badge>
        </div>
      )}

      {/* Data table */}
      {showDataTable && dataTable && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-sm">Accessible Data Table</CardTitle>
          </CardHeader>
          <CardContent>
            {generateDataTable()}
          </CardContent>
        </Card>
      )}

      {/* Instructions for screen reader users */}
      <div className="sr-only">
        {keyboardNavigation && (
          <div>
            <p>This chart supports keyboard navigation. Use arrow keys to navigate between data points, spacebar to announce the current point, and Home/End keys to jump to the first or last data point.</p>
          </div>
        )}
        {audioDescription && (
          <div>
            <p>Audio description is available. Press Enter to start or stop audio description of the chart data.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccessibleChart;