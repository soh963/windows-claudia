import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  Filter,
  Download,
  Maximize2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';
import type { ExportOptions } from '@/lib/stores/visualizationStore';

export interface TimelineEvent {
  id: string;
  timestamp: number;
  type: 'operation_start' | 'operation_complete' | 'operation_error' | 'session_start' | 'session_end';
  title: string;
  description: string;
  status: 'success' | 'error' | 'warning' | 'info';
  metadata?: {
    duration?: number;
    model?: string;
    sessionId?: string;
    operationType?: string;
    [key: string]: any;
  };
}

interface TimelineProps {
  data: TimelineEvent[];
  title?: string;
  className?: string;
  height?: number;
  maxEvents?: number;
  groupBy?: 'day' | 'hour' | 'none';
  showFilters?: boolean;
  onExport?: (options: ExportOptions) => void;
  loading?: boolean;
}

export const Timeline: React.FC<TimelineProps> = ({
  data,
  title = 'Activity Timeline',
  className,
  height = 400,
  maxEvents = 100,
  groupBy = 'day',
  showFilters = true,
  onExport,
  loading = false,
}) => {
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Filter and sort events
  const filteredEvents = useMemo(() => {
    let filtered = [...data];
    
    if (selectedFilters.size > 0) {
      filtered = filtered.filter(event => 
        selectedFilters.has(event.status) || selectedFilters.has(event.type)
      );
    }
    
    return filtered
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, maxEvents);
  }, [data, selectedFilters, maxEvents]);

  // Group events
  const groupedEvents = useMemo(() => {
    if (groupBy === 'none') {
      return new Map([['all', filteredEvents]]);
    }

    const groups = new Map<string, TimelineEvent[]>();
    
    filteredEvents.forEach(event => {
      let groupKey: string;
      const eventDate = new Date(event.timestamp);
      
      if (groupBy === 'day') {
        if (isToday(eventDate)) {
          groupKey = 'Today';
        } else if (isYesterday(eventDate)) {
          groupKey = 'Yesterday';
        } else {
          groupKey = format(eventDate, 'MMM dd, yyyy');
        }
      } else { // groupBy === 'hour'
        groupKey = format(eventDate, 'MMM dd, HH:mm');
      }
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(event);
    });
    
    // Sort groups by most recent first
    const sortedGroups = new Map();
    Array.from(groups.entries())
      .sort((a, b) => {
        const aTime = Math.max(...a[1].map(e => e.timestamp));
        const bTime = Math.max(...b[1].map(e => e.timestamp));
        return bTime - aTime;
      })
      .forEach(([key, value]) => {
        sortedGroups.set(key, value);
        // Auto-expand today's group
        if (key === 'Today') {
          setExpandedGroups(prev => new Set([...prev, key]));
        }
      });
    
    return sortedGroups;
  }, [filteredEvents, groupBy]);

  // Get unique filter options
  const filterOptions = useMemo(() => {
    const statusTypes = new Set<string>();
    const eventTypes = new Set<string>();
    
    data.forEach(event => {
      statusTypes.add(event.status);
      eventTypes.add(event.type);
    });
    
    return {
      status: Array.from(statusTypes),
      type: Array.from(eventTypes),
    };
  }, [data]);

  // Handle filter toggle
  const toggleFilter = (filter: string) => {
    setSelectedFilters(prev => {
      const next = new Set(prev);
      if (next.has(filter)) {
        next.delete(filter);
      } else {
        next.add(filter);
      }
      return next;
    });
  };

  // Handle group toggle
  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  // Handle export
  const handleExport = (format: string) => {
    if (onExport) {
      onExport({
        format: format as any,
        chartType: 'timeline',
        dateRange: {
          start: Math.min(...filteredEvents.map(e => e.timestamp)),
          end: Math.max(...filteredEvents.map(e => e.timestamp)),
        },
        includeMetadata: true,
      });
    }
  };

  // Get status icon
  const getStatusIcon = (status: string, type: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'warning':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-500';
    }
  };

  if (loading) {
    return (
      <Card className={cn('', className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div 
            className="flex items-center justify-center bg-muted/50 rounded-lg animate-pulse"
            style={{ height }}
          >
            <div className="text-muted-foreground text-sm">Loading timeline data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data.length) {
    return (
      <Card className={cn('', className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div 
            className="flex items-center justify-center bg-muted/10 rounded-lg border-2 border-dashed border-muted-foreground/25"
            style={{ height }}
          >
            <div className="text-center text-muted-foreground">
              <div className="text-sm font-medium mb-1">No timeline events</div>
              <div className="text-xs">Events will appear here as they occur</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {title}
            <Badge variant="secondary" className="ml-2">
              {filteredEvents.length} events
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {showFilters && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Filter className="h-4 w-4 mr-1" />
                    Filter
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="text-xs font-medium text-muted-foreground px-2 py-1">
                    Status
                  </div>
                  {filterOptions.status.map(status => (
                    <DropdownMenuCheckboxItem
                      key={status}
                      checked={selectedFilters.has(status)}
                      onCheckedChange={() => toggleFilter(status)}
                    >
                      <div className="flex items-center gap-2">
                        {getStatusIcon(status, '')}
                        <span className="capitalize">{status}</span>
                      </div>
                    </DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuSeparator />
                  <div className="text-xs font-medium text-muted-foreground px-2 py-1">
                    Event Type
                  </div>
                  {filterOptions.type.map(type => (
                    <DropdownMenuCheckboxItem
                      key={type}
                      checked={selectedFilters.has(type)}
                      onCheckedChange={() => toggleFilter(type)}
                    >
                      <span className="capitalize">{type.replace('_', ' ')}</span>
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Download className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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
      <CardContent>
        <ScrollArea style={{ height }}>
          <div className="space-y-4">
            {Array.from(groupedEvents.entries()).map(([groupName, events]) => (
              <div key={groupName}>
                {groupBy !== 'none' && (
                  <button
                    className="flex items-center gap-2 text-sm font-medium text-foreground mb-3 hover:text-primary transition-colors w-full text-left"
                    onClick={() => toggleGroup(groupName)}
                  >
                    {expandedGroups.has(groupName) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    {groupName}
                    <Badge variant="outline" className="ml-auto">
                      {events.length}
                    </Badge>
                  </button>
                )}
                
                <AnimatePresence>
                  {(groupBy === 'none' || expandedGroups.has(groupName)) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="relative">
                        {/* Timeline line */}
                        <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                        
                        <div className="space-y-4">
                          {events.map((event, index) => (
                            <motion.div
                              key={event.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className="relative flex gap-4"
                            >
                              {/* Timeline dot */}
                              <div className="relative flex-shrink-0">
                                <div 
                                  className={cn(
                                    'w-8 h-8 rounded-full border-2 border-background flex items-center justify-center',
                                    getStatusColor(event.status)
                                  )}
                                >
                                  <div className="w-4 h-4 text-white">
                                    {getStatusIcon(event.status, event.type)}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Event content */}
                              <div className="flex-1 min-w-0 pb-4">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <h4 className="text-sm font-medium text-foreground mb-1">
                                      {event.title}
                                    </h4>
                                    <p className="text-xs text-muted-foreground mb-2">
                                      {event.description}
                                    </p>
                                    
                                    {/* Metadata */}
                                    {event.metadata && (
                                      <div className="flex flex-wrap gap-1 mb-2">
                                        {event.metadata.model && (
                                          <Badge variant="secondary" className="text-xs">
                                            {event.metadata.model}
                                          </Badge>
                                        )}
                                        {event.metadata.operationType && (
                                          <Badge variant="outline" className="text-xs">
                                            {event.metadata.operationType}
                                          </Badge>
                                        )}
                                        {event.metadata.duration && (
                                          <Badge variant="outline" className="text-xs">
                                            {(event.metadata.duration / 1000).toFixed(1)}s
                                          </Badge>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                                    <Clock className="h-3 w-3" />
                                    {format(new Date(event.timestamp), 'HH:mm:ss')}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
            
            {filteredEvents.length === 0 && selectedFilters.size > 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <div className="text-sm font-medium mb-1">No events match your filters</div>
                <div className="text-xs">Try adjusting your filter selection</div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default Timeline;