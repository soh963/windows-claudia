import { useState, useEffect, useCallback, useRef } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { Task, Agent, MCPServer, Tool } from '@/components/SessionTaskVisualizer';

interface TaskUpdate {
  id: string;
  content?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority?: 'high' | 'medium' | 'low';
  model?: 'claude' | 'gemini';
  agents?: Agent[];
  mcpServers?: MCPServer[];
  tools?: Tool[];
  tokens?: number;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
}

interface TodoWriteEvent {
  todos: Array<{
    id: string;
    content: string;
    status: string;
    priority: string;
  }>;
}

interface ToolCallEvent {
  tool: string;
  params?: any;
  sessionId?: string;
}

interface ModelEvent {
  model: 'claude' | 'gemini';
  tokens?: number;
  sessionId?: string;
}

interface AgentActivationEvent {
  agent: string;
  active: boolean;
  sessionId?: string;
}

interface MCPServerEvent {
  server: string;
  active: boolean;
  sessionId?: string;
}

export const useSessionTaskTracking = (sessionId: string | null) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const unlistenRefs = useRef<UnlistenFn[]>([]);
  const taskTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Tool type mapping
  const getToolType = (toolName: string): Tool['type'] => {
    const toolMap: Record<string, Tool['type']> = {
      'Read': 'read',
      'Write': 'write',
      'Edit': 'edit',
      'MultiEdit': 'edit',
      'Bash': 'bash',
      'Grep': 'grep',
      'Glob': 'glob',
      'LS': 'ls',
      'WebFetch': 'webfetch',
      'WebSearch': 'websearch',
      'TodoWrite': 'todowrite',
      'NotebookEdit': 'notebookedit'
    };
    return toolMap[toolName] || 'bash';
  };

  // Agent type mapping
  const getAgentType = (agentName: string): Agent['type'] => {
    const agentMap: Record<string, Agent['type']> = {
      'architect': 'architect',
      'frontend': 'frontend',
      'backend': 'backend',
      'analyzer': 'analyzer',
      'security': 'security',
      'qa': 'qa',
      'performance': 'performance',
      'devops': 'devops',
      'refactorer': 'refactorer',
      'mentor': 'mentor',
      'scribe': 'scribe'
    };
    return agentMap[agentName.toLowerCase()] || 'architect';
  };

  // MCP server type mapping
  const getMCPType = (serverName: string): MCPServer['type'] => {
    const mcpMap: Record<string, MCPServer['type']> = {
      'context7': 'context7',
      'sequential': 'sequential',
      'magic': 'magic',
      'playwright': 'playwright'
    };
    return mcpMap[serverName.toLowerCase()] || 'context7';
  };

  // Update task
  const updateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId 
        ? { ...task, ...updates }
        : task
    ));
  }, []);

  // Add or update task from TodoWrite event
  const handleTodoUpdate = useCallback((event: TodoWriteEvent) => {
    const currentTime = new Date();
    
    setTasks(prev => {
      const newTasks = [...prev];
      
      event.todos.forEach(todo => {
        const existingIndex = newTasks.findIndex(t => t.id === todo.id);
        
        if (existingIndex >= 0) {
          // Update existing task
          const existing = newTasks[existingIndex];
          const wasInProgress = existing.status === 'in_progress';
          const isNowInProgress = todo.status === 'in_progress';
          const isNowCompleted = todo.status === 'completed';
          
          newTasks[existingIndex] = {
            ...existing,
            content: todo.content,
            status: todo.status as Task['status'],
            priority: todo.priority as Task['priority'],
            startedAt: !wasInProgress && isNowInProgress ? currentTime : existing.startedAt,
            completedAt: isNowCompleted && !existing.completedAt ? currentTime : existing.completedAt,
            duration: isNowCompleted && existing.startedAt 
              ? currentTime.getTime() - existing.startedAt.getTime()
              : existing.duration
          };
          
          // Clear timer if task is completed
          if (isNowCompleted && taskTimers.current.has(todo.id)) {
            clearInterval(taskTimers.current.get(todo.id));
            taskTimers.current.delete(todo.id);
          }
          
          // Start timer if task is in progress
          if (isNowInProgress && !taskTimers.current.has(todo.id)) {
            const timer = setInterval(() => {
              setTasks(prev => prev.map(t => 
                t.id === todo.id && t.status === 'in_progress' && t.startedAt
                  ? { ...t, duration: new Date().getTime() - t.startedAt.getTime() }
                  : t
              ));
            }, 1000);
            taskTimers.current.set(todo.id, timer);
          }
        } else {
          // Add new task
          newTasks.push({
            id: todo.id,
            content: todo.content,
            status: todo.status as Task['status'],
            priority: todo.priority as Task['priority'],
            createdAt: currentTime,
            startedAt: todo.status === 'in_progress' ? currentTime : undefined,
            completedAt: todo.status === 'completed' ? currentTime : undefined,
            duration: todo.status === 'completed' ? 0 : undefined,
            agents: [],
            mcpServers: [],
            tools: [],
            tokens: 0
          });
        }
      });
      
      return newTasks;
    });
  }, []);

  // Handle tool call
  const handleToolCall = useCallback((event: ToolCallEvent) => {
    if (event.sessionId !== sessionId) return;
    
    // Find the current in-progress task
    setTasks(prev => {
      const inProgressTask = prev.find(t => t.status === 'in_progress');
      if (!inProgressTask) return prev;
      
      return prev.map(task => {
        if (task.id === inProgressTask.id) {
          const existingTool = task.tools?.find(t => t.name === event.tool);
          if (existingTool) {
            return {
              ...task,
              tools: task.tools?.map(t => 
                t.name === event.tool 
                  ? { ...t, count: t.count + 1 }
                  : t
              )
            };
          } else {
            return {
              ...task,
              tools: [
                ...(task.tools || []),
                {
                  id: `${task.id}-tool-${event.tool}`,
                  name: event.tool,
                  type: getToolType(event.tool),
                  count: 1
                }
              ]
            };
          }
        }
        return task;
      });
    });
  }, [sessionId]);

  // Handle model event
  const handleModelEvent = useCallback((event: ModelEvent) => {
    if (event.sessionId !== sessionId) return;
    
    setTasks(prev => {
      const inProgressTask = prev.find(t => t.status === 'in_progress');
      if (!inProgressTask) return prev;
      
      return prev.map(task => {
        if (task.id === inProgressTask.id) {
          return {
            ...task,
            model: event.model,
            tokens: (task.tokens || 0) + (event.tokens || 0)
          };
        }
        return task;
      });
    });
  }, [sessionId]);

  // Handle agent activation
  const handleAgentActivation = useCallback((event: AgentActivationEvent) => {
    if (event.sessionId !== sessionId) return;
    
    setTasks(prev => {
      const inProgressTask = prev.find(t => t.status === 'in_progress');
      if (!inProgressTask) return prev;
      
      return prev.map(task => {
        if (task.id === inProgressTask.id) {
          const existingAgent = task.agents?.find(a => a.name === event.agent);
          if (existingAgent) {
            return {
              ...task,
              agents: task.agents?.map(a => 
                a.name === event.agent 
                  ? { ...a, active: event.active }
                  : a
              )
            };
          } else {
            return {
              ...task,
              agents: [
                ...(task.agents || []),
                {
                  id: `${task.id}-agent-${event.agent}`,
                  name: event.agent,
                  type: getAgentType(event.agent),
                  active: event.active
                }
              ]
            };
          }
        }
        return task;
      });
    });
  }, [sessionId]);

  // Handle MCP server event
  const handleMCPServerEvent = useCallback((event: MCPServerEvent) => {
    if (event.sessionId !== sessionId) return;
    
    setTasks(prev => {
      const inProgressTask = prev.find(t => t.status === 'in_progress');
      if (!inProgressTask) return prev;
      
      return prev.map(task => {
        if (task.id === inProgressTask.id) {
          const existingServer = task.mcpServers?.find(s => s.name === event.server);
          if (existingServer) {
            return {
              ...task,
              mcpServers: task.mcpServers?.map(s => 
                s.name === event.server 
                  ? { ...s, active: event.active }
                  : s
              )
            };
          } else {
            return {
              ...task,
              mcpServers: [
                ...(task.mcpServers || []),
                {
                  id: `${task.id}-mcp-${event.server}`,
                  name: event.server,
                  type: getMCPType(event.server),
                  active: event.active
                }
              ]
            };
          }
        }
        return task;
      });
    });
  }, [sessionId]);

  // Start tracking
  const startTracking = useCallback(async () => {
    if (!sessionId || isTracking) return;
    
    try {
      // Listen for TodoWrite events
      const unlistenTodo = await listen('todo-update', (event) => {
        handleTodoUpdate(event.payload as TodoWriteEvent);
      });
      unlistenRefs.current.push(unlistenTodo);

      // Listen for tool calls
      const unlistenTool = await listen('tool-call', (event) => {
        handleToolCall(event.payload as ToolCallEvent);
      });
      unlistenRefs.current.push(unlistenTool);

      // Listen for model events
      const unlistenModel = await listen('model-event', (event) => {
        handleModelEvent(event.payload as ModelEvent);
      });
      unlistenRefs.current.push(unlistenModel);

      // Listen for agent activations
      const unlistenAgent = await listen('agent-activation', (event) => {
        handleAgentActivation(event.payload as AgentActivationEvent);
      });
      unlistenRefs.current.push(unlistenAgent);

      // Listen for MCP server events
      const unlistenMCP = await listen('mcp-server-event', (event) => {
        handleMCPServerEvent(event.payload as MCPServerEvent);
      });
      unlistenRefs.current.push(unlistenMCP);

      setIsTracking(true);
    } catch (error) {
      console.error('Failed to start task tracking:', error);
    }
  }, [sessionId, isTracking, handleTodoUpdate, handleToolCall, handleModelEvent, handleAgentActivation, handleMCPServerEvent]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    unlistenRefs.current.forEach(unlisten => unlisten());
    unlistenRefs.current = [];
    
    // Clear all timers
    taskTimers.current.forEach(timer => clearInterval(timer));
    taskTimers.current.clear();
    
    setIsTracking(false);
  }, []);

  // Reset tasks
  const resetTasks = useCallback(() => {
    setTasks([]);
    taskTimers.current.forEach(timer => clearInterval(timer));
    taskTimers.current.clear();
  }, []);

  // Mock data for testing
  const generateMockTasks = useCallback(() => {
    const mockTasks: Task[] = [
      {
        id: 'task-1',
        content: 'Analyze project structure and dependencies',
        status: 'completed',
        priority: 'high',
        createdAt: new Date(Date.now() - 3600000),
        startedAt: new Date(Date.now() - 3500000),
        completedAt: new Date(Date.now() - 3000000),
        duration: 500000,
        model: 'claude',
        agents: [
          { id: 'a1', name: 'Analyzer', type: 'analyzer', active: true },
          { id: 'a2', name: 'Architect', type: 'architect', active: true }
        ],
        mcpServers: [
          { id: 'm1', name: 'Sequential', type: 'sequential', active: true }
        ],
        tools: [
          { id: 't1', name: 'Read', type: 'read', count: 15 },
          { id: 't2', name: 'Grep', type: 'grep', count: 8 }
        ],
        tokens: 2500
      },
      {
        id: 'task-2',
        content: 'Implement session task visualization component with real-time updates',
        status: 'in_progress',
        priority: 'high',
        createdAt: new Date(Date.now() - 1800000),
        startedAt: new Date(Date.now() - 1200000),
        duration: 1200000,
        model: 'claude',
        agents: [
          { id: 'a3', name: 'Frontend', type: 'frontend', active: true }
        ],
        mcpServers: [
          { id: 'm2', name: 'Magic', type: 'magic', active: true }
        ],
        tools: [
          { id: 't3', name: 'Write', type: 'write', count: 3 },
          { id: 't4', name: 'Edit', type: 'edit', count: 5 }
        ],
        tokens: 3200
      },
      {
        id: 'task-3',
        content: 'Create integration hooks for session management',
        status: 'pending',
        priority: 'medium',
        createdAt: new Date(Date.now() - 600000),
        agents: [],
        mcpServers: [],
        tools: [],
        tokens: 0
      },
      {
        id: 'task-4',
        content: 'Test real-time updates and event handling',
        status: 'pending',
        priority: 'medium',
        createdAt: new Date(Date.now() - 300000),
        agents: [],
        mcpServers: [],
        tools: [],
        tokens: 0
      }
    ];
    
    setTasks(mockTasks);
    
    // Start timer for in-progress task
    const inProgressTask = mockTasks.find(t => t.status === 'in_progress');
    if (inProgressTask && inProgressTask.startedAt) {
      const timer = setInterval(() => {
        setTasks(prev => prev.map(t => 
          t.id === inProgressTask.id && t.status === 'in_progress' && t.startedAt
            ? { ...t, duration: new Date().getTime() - t.startedAt.getTime() }
            : t
        ));
      }, 1000);
      taskTimers.current.set(inProgressTask.id, timer);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  // Auto-start tracking when sessionId is available
  useEffect(() => {
    if (sessionId) {
      startTracking();
    } else {
      stopTracking();
    }
  }, [sessionId, startTracking, stopTracking]);

  return {
    tasks,
    isTracking,
    startTracking,
    stopTracking,
    resetTasks,
    updateTask,
    generateMockTasks
  };
};