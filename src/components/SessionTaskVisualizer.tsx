import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  Circle,
  AlertCircle,
  Sparkles,
  Bot,
  Server,
  Wrench,
  Brain,
  Users,
  Activity,
  FileEdit,
  Code,
  Layers,
  Globe,
  Shield,
  Zap,
  GitBranch,
  Database,
  Terminal,
  Package,
  Settings,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';

// Types
export interface Task {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'high' | 'medium' | 'low';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  model?: 'claude' | 'gemini';
  agents?: Agent[];
  mcpServers?: MCPServer[];
  tools?: Tool[];
  tokens?: number;
  error?: string;
  parentId?: string;
  subtasks?: Task[];
}

export interface Agent {
  id: string;
  name: string;
  type: 'architect' | 'frontend' | 'backend' | 'analyzer' | 'security' | 'qa' | 'performance' | 'devops' | 'refactorer' | 'mentor' | 'scribe';
  active: boolean;
}

export interface MCPServer {
  id: string;
  name: string;
  type: 'context7' | 'sequential' | 'magic' | 'playwright';
  active: boolean;
}

export interface Tool {
  id: string;
  name: string;
  type: 'read' | 'write' | 'edit' | 'bash' | 'grep' | 'glob' | 'ls' | 'webfetch' | 'websearch' | 'todowrite' | 'notebookedit';
  count: number;
}

interface SessionTaskVisualizerProps {
  tasks: Task[];
  sessionId: string;
  isVisible?: boolean;
  onClose?: () => void;
  className?: string;
}

// Icon mappings
const modelIcons = {
  claude: { icon: Brain, color: 'text-purple-500' },
  gemini: { icon: Sparkles, color: 'text-blue-500' }
};

const agentIcons = {
  architect: { icon: Layers, color: 'text-indigo-500' },
  frontend: { icon: Globe, color: 'text-pink-500' },
  backend: { icon: Server, color: 'text-green-500' },
  analyzer: { icon: Activity, color: 'text-orange-500' },
  security: { icon: Shield, color: 'text-red-500' },
  qa: { icon: CheckCircle2, color: 'text-cyan-500' },
  performance: { icon: Zap, color: 'text-yellow-500' },
  devops: { icon: GitBranch, color: 'text-purple-500' },
  refactorer: { icon: Code, color: 'text-blue-500' },
  mentor: { icon: Users, color: 'text-emerald-500' },
  scribe: { icon: FileEdit, color: 'text-gray-500' }
};

const mcpIcons = {
  context7: { icon: Database, color: 'text-blue-500' },
  sequential: { icon: Layers, color: 'text-purple-500' },
  magic: { icon: Sparkles, color: 'text-pink-500' },
  playwright: { icon: Globe, color: 'text-green-500' }
};

const toolIcons = {
  read: { icon: Eye, color: 'text-gray-500' },
  write: { icon: FileEdit, color: 'text-blue-500' },
  edit: { icon: Code, color: 'text-green-500' },
  bash: { icon: Terminal, color: 'text-orange-500' },
  grep: { icon: Activity, color: 'text-purple-500' },
  glob: { icon: Package, color: 'text-yellow-500' },
  ls: { icon: Layers, color: 'text-cyan-500' },
  webfetch: { icon: Globe, color: 'text-indigo-500' },
  websearch: { icon: Globe, color: 'text-pink-500' },
  todowrite: { icon: CheckCircle2, color: 'text-emerald-500' },
  notebookedit: { icon: FileEdit, color: 'text-red-500' }
};

const statusIcons = {
  pending: { icon: Circle, color: 'text-gray-400' },
  in_progress: { icon: Clock, color: 'text-blue-500' },
  completed: { icon: CheckCircle2, color: 'text-green-500' },
  blocked: { icon: AlertCircle, color: 'text-red-500' }
};

const priorityColors = {
  high: 'bg-red-500/10 text-red-500 border-red-500/20',
  medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  low: 'bg-green-500/10 text-green-500 border-green-500/20'
};

export const SessionTaskVisualizer: React.FC<SessionTaskVisualizerProps> = ({
  tasks,
  sessionId,
  isVisible = true,
  onClose,
  className
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate session statistics
  const sessionStats = useMemo(() => {
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const totalTokens = tasks.reduce((sum, t) => sum + (t.tokens || 0), 0);
    const totalDuration = tasks.reduce((sum, t) => sum + (t.duration || 0), 0);
    const progressPercentage = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;

    const modelUsage = tasks.reduce((acc, task) => {
      if (task.model) {
        acc[task.model] = (acc[task.model] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const activeAgents = new Set<string>();
    const activeMCP = new Set<string>();
    const toolUsage = new Map<string, number>();

    tasks.forEach(task => {
      task.agents?.forEach(agent => {
        if (agent.active) activeAgents.add(agent.type);
      });
      task.mcpServers?.forEach(mcp => {
        if (mcp.active) activeMCP.add(mcp.type);
      });
      task.tools?.forEach(tool => {
        toolUsage.set(tool.type, (toolUsage.get(tool.type) || 0) + tool.count);
      });
    });

    return {
      total: tasks.length,
      completed: completedTasks,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      pending: tasks.filter(t => t.status === 'pending').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
      progressPercentage,
      totalTokens,
      totalDuration,
      modelUsage,
      activeAgents: Array.from(activeAgents),
      activeMCP: Array.from(activeMCP),
      toolUsage: Array.from(toolUsage.entries()).map(([type, count]) => ({ type, count }))
    };
  }, [tasks]);

  // Format duration
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  // Format relative time
  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  if (!isVisible) return null;

  return (
    <TooltipProvider>
      <AnimatePresence>
        <motion.div
          initial={{ x: -320 }}
          animate={{ x: 0 }}
          exit={{ x: -320 }}
          transition={{ type: 'spring', damping: 20 }}
          className={cn(
            'fixed left-0 top-0 bottom-0 z-30 flex',
            className
          )}
        >
          {/* Main panel */}
          <div className={cn(
            'bg-background border-r shadow-xl transition-all duration-300',
            isCollapsed ? 'w-16' : isExpanded ? 'w-96' : 'w-80'
          )}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              {!isCollapsed && (
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Session Tasks</span>
                  <Badge variant="secondary" className="text-xs">
                    {sessionStats.total}
                  </Badge>
                </div>
              )}
              <div className="flex items-center gap-1">
                {!isCollapsed && (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setIsExpanded(!isExpanded)}
                        >
                          {isExpanded ? (
                            <Minimize2 className="h-4 w-4" />
                          ) : (
                            <Maximize2 className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isExpanded ? 'Minimize' : 'Maximize'}
                      </TooltipContent>
                    </Tooltip>
                  </>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setIsCollapsed(!isCollapsed)}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4" />
                      ) : (
                        <ChevronLeft className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isCollapsed ? 'Expand' : 'Collapse'}
                  </TooltipContent>
                </Tooltip>
                {onClose && !isCollapsed && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={onClose}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Close</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>

            {!isCollapsed && (
              <>
                {/* Progress overview */}
                <div className="p-4 border-b">
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{sessionStats.progressPercentage.toFixed(0)}%</span>
                    </div>
                    <Progress value={sessionStats.progressPercentage} className="h-2" />
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1">
                        <div className={cn('h-2 w-2 rounded-full', statusIcons.completed.color, 'bg-current')} />
                        <span className="text-muted-foreground">Completed:</span>
                        <span className="font-medium">{sessionStats.completed}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className={cn('h-2 w-2 rounded-full', statusIcons.in_progress.color, 'bg-current animate-pulse')} />
                        <span className="text-muted-foreground">Active:</span>
                        <span className="font-medium">{sessionStats.inProgress}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className={cn('h-2 w-2 rounded-full', statusIcons.pending.color, 'bg-current')} />
                        <span className="text-muted-foreground">Pending:</span>
                        <span className="font-medium">{sessionStats.pending}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className={cn('h-2 w-2 rounded-full', statusIcons.blocked.color, 'bg-current')} />
                        <span className="text-muted-foreground">Blocked:</span>
                        <span className="font-medium">{sessionStats.blocked}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resource usage */}
                {isExpanded && (
                  <div className="p-4 border-b space-y-3">
                    {/* Model usage */}
                    {Object.entries(sessionStats.modelUsage).length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-medium text-muted-foreground">AI Models</span>
                        <div className="flex gap-2">
                          {Object.entries(sessionStats.modelUsage).map(([model, count]) => {
                            const ModelIcon = modelIcons[model as keyof typeof modelIcons]?.icon || Bot;
                            const color = modelIcons[model as keyof typeof modelIcons]?.color || 'text-gray-500';
                            return (
                              <Badge key={model} variant="secondary" className="gap-1">
                                <ModelIcon className={cn('h-3 w-3', color)} />
                                {model}: {count}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Active agents */}
                    {sessionStats.activeAgents.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-medium text-muted-foreground">Active Agents</span>
                        <div className="flex flex-wrap gap-1">
                          {sessionStats.activeAgents.map(agent => {
                            const AgentIcon = agentIcons[agent as keyof typeof agentIcons]?.icon || Users;
                            const color = agentIcons[agent as keyof typeof agentIcons]?.color || 'text-gray-500';
                            return (
                              <Tooltip key={agent}>
                                <TooltipTrigger>
                                  <div className={cn('p-1.5 rounded-md bg-secondary/50 hover:bg-secondary transition-colors', color)}>
                                    <AgentIcon className="h-4 w-4" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>{agent}</TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* MCP servers */}
                    {sessionStats.activeMCP.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-medium text-muted-foreground">MCP Servers</span>
                        <div className="flex flex-wrap gap-1">
                          {sessionStats.activeMCP.map(mcp => {
                            const MCPIcon = mcpIcons[mcp as keyof typeof mcpIcons]?.icon || Server;
                            const color = mcpIcons[mcp as keyof typeof mcpIcons]?.color || 'text-gray-500';
                            return (
                              <Tooltip key={mcp}>
                                <TooltipTrigger>
                                  <div className={cn('p-1.5 rounded-md bg-secondary/50 hover:bg-secondary transition-colors', color)}>
                                    <MCPIcon className="h-4 w-4" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>{mcp}</TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="space-y-1">
                        <span className="text-muted-foreground">Total Tokens</span>
                        <p className="font-medium">{sessionStats.totalTokens.toLocaleString()}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-muted-foreground">Duration</span>
                        <p className="font-medium">{formatDuration(sessionStats.totalDuration)}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Task timeline */}
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-2">
                    {tasks.map((task, index) => {
                      const StatusIcon = statusIcons[task.status]?.icon || Circle;
                      const statusColor = statusIcons[task.status]?.color || 'text-gray-400';
                      const isSelected = selectedTask?.id === task.id;

                      return (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className={cn(
                            'relative cursor-pointer rounded-lg border p-3 transition-all',
                            'hover:border-primary/50 hover:bg-secondary/30',
                            isSelected && 'border-primary bg-secondary/50',
                            task.status === 'completed' && 'opacity-60'
                          )}
                          onClick={() => setSelectedTask(task)}
                        >
                          {/* Status indicator */}
                          <div className="flex items-start gap-3">
                            <div className={cn('mt-0.5', statusColor)}>
                              <StatusIcon className={cn(
                                'h-4 w-4',
                                task.status === 'in_progress' && 'animate-pulse'
                              )} />
                            </div>

                            <div className="flex-1 space-y-2">
                              {/* Task content */}
                              <p className={cn(
                                'text-sm line-clamp-2',
                                task.status === 'completed' && 'line-through'
                              )}>
                                {task.content}
                              </p>

                              {/* Metadata */}
                              <div className="flex items-center gap-2 flex-wrap">
                                {/* Priority */}
                                {task.priority && (
                                  <Badge
                                    variant="outline"
                                    className={cn('text-xs', priorityColors[task.priority])}
                                  >
                                    {task.priority}
                                  </Badge>
                                )}

                                {/* Model */}
                                {task.model && (
                                  <div className="flex items-center gap-1">
                                    {React.createElement(
                                      modelIcons[task.model]?.icon || Bot,
                                      {
                                        className: cn('h-3 w-3', modelIcons[task.model]?.color)
                                      }
                                    )}
                                  </div>
                                )}

                                {/* Time */}
                                <span className="text-xs text-muted-foreground">
                                  {formatRelativeTime(task.createdAt)}
                                </span>

                                {/* Duration */}
                                {task.duration && (
                                  <span className="text-xs text-muted-foreground">
                                    {formatDuration(task.duration)}
                                  </span>
                                )}
                              </div>

                              {/* Tools preview (collapsed view) */}
                              {!isExpanded && task.tools && task.tools.length > 0 && (
                                <div className="flex items-center gap-1 mt-1">
                                  <Wrench className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">
                                    {task.tools.length} tools
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Expanded details */}
                          {isSelected && isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-3 pt-3 border-t space-y-3"
                            >
                              {/* Agents */}
                              {task.agents && task.agents.length > 0 && (
                                <div className="space-y-1">
                                  <span className="text-xs font-medium text-muted-foreground">Agents</span>
                                  <div className="flex flex-wrap gap-1">
                                    {task.agents.map(agent => {
                                      const AgentIcon = agentIcons[agent.type as keyof typeof agentIcons]?.icon || Users;
                                      const color = agentIcons[agent.type as keyof typeof agentIcons]?.color || 'text-gray-500';
                                      return (
                                        <Badge
                                          key={agent.id}
                                          variant={agent.active ? 'default' : 'secondary'}
                                          className="gap-1 text-xs"
                                        >
                                          <AgentIcon className={cn('h-3 w-3', color)} />
                                          {agent.name}
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* MCP Servers */}
                              {task.mcpServers && task.mcpServers.length > 0 && (
                                <div className="space-y-1">
                                  <span className="text-xs font-medium text-muted-foreground">MCP Servers</span>
                                  <div className="flex flex-wrap gap-1">
                                    {task.mcpServers.map(mcp => {
                                      const MCPIcon = mcpIcons[mcp.type as keyof typeof mcpIcons]?.icon || Server;
                                      const color = mcpIcons[mcp.type as keyof typeof mcpIcons]?.color || 'text-gray-500';
                                      return (
                                        <Badge
                                          key={mcp.id}
                                          variant={mcp.active ? 'default' : 'secondary'}
                                          className="gap-1 text-xs"
                                        >
                                          <MCPIcon className={cn('h-3 w-3', color)} />
                                          {mcp.name}
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Tools */}
                              {task.tools && task.tools.length > 0 && (
                                <div className="space-y-1">
                                  <span className="text-xs font-medium text-muted-foreground">Tools Used</span>
                                  <div className="flex flex-wrap gap-1">
                                    {task.tools.map(tool => {
                                      const ToolIcon = toolIcons[tool.type as keyof typeof toolIcons]?.icon || Wrench;
                                      const color = toolIcons[tool.type as keyof typeof toolIcons]?.color || 'text-gray-500';
                                      return (
                                        <Badge
                                          key={tool.id}
                                          variant="outline"
                                          className="gap-1 text-xs"
                                        >
                                          <ToolIcon className={cn('h-3 w-3', color)} />
                                          {tool.name} ({tool.count})
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Error */}
                              {task.error && (
                                <div className="p-2 rounded-md bg-destructive/10 border border-destructive/20">
                                  <p className="text-xs text-destructive">{task.error}</p>
                                </div>
                              )}

                              {/* Timestamps */}
                              <div className="text-xs text-muted-foreground space-y-1">
                                <div>Created: {task.createdAt.toLocaleString()}</div>
                                {task.startedAt && <div>Started: {task.startedAt.toLocaleString()}</div>}
                                {task.completedAt && <div>Completed: {task.completedAt.toLocaleString()}</div>}
                              </div>
                            </motion.div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </>
            )}

            {/* Collapsed state */}
            {isCollapsed && (
              <div className="flex-1 flex flex-col items-center py-4 gap-4">
                <Tooltip>
                  <TooltipTrigger>
                    <div className="relative">
                      <Activity className="h-6 w-6 text-primary" />
                      <Badge
                        variant="secondary"
                        className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                      >
                        {sessionStats.total}
                      </Badge>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {sessionStats.total} tasks
                  </TooltipContent>
                </Tooltip>

                {/* Progress indicator */}
                <div className="relative h-32 w-2 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 bg-primary rounded-full"
                    initial={{ height: 0 }}
                    animate={{ height: `${sessionStats.progressPercentage}%` }}
                    transition={{ type: 'spring', damping: 20 }}
                  />
                </div>

                {/* Status indicators */}
                <div className="space-y-2">
                  {sessionStats.inProgress > 0 && (
                    <Tooltip>
                      <TooltipTrigger>
                        <div className={cn('h-2 w-2 rounded-full animate-pulse', statusIcons.in_progress.color, 'bg-current')} />
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        {sessionStats.inProgress} active
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {sessionStats.blocked > 0 && (
                    <Tooltip>
                      <TooltipTrigger>
                        <div className={cn('h-2 w-2 rounded-full', statusIcons.blocked.color, 'bg-current')} />
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        {sessionStats.blocked} blocked
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </TooltipProvider>
  );
};