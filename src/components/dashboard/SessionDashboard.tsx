import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  TrendingUp, 
  Clock, 
  MessageSquare, 
  Bot, 
  Cpu, 
  Zap,
  CheckCircle,
  AlertCircle,
  Info,
  ChevronDown
} from 'lucide-react';
import { monitoringStore } from '@/lib/stores/monitoringStore';
import { sessionStore } from '@/lib/stores/sessionStore';
import { getSharedSessions, type SharedSession } from '@/lib/universal-ai-integration';
import { formatDistanceToNow } from 'date-fns';

interface SessionDashboardProps {
  projectId: string;
  projectPath: string;
  className?: string;
}

interface SessionMetrics {
  totalSessions: number;
  activeSessions: number;
  totalMessages: number;
  modelsUsed: Set<string>;
  averageResponseTime: number;
  successRate: number;
  mcpUsage: number;
  agentUsage: number;
  toolUsage: number;
}

export function SessionDashboard({ projectId, projectPath, className = '' }: SessionDashboardProps) {
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SharedSession[]>([]);
  const [metrics, setMetrics] = useState<SessionMetrics>({
    totalSessions: 0,
    activeSessions: 0,
    totalMessages: 0,
    modelsUsed: new Set(),
    averageResponseTime: 0,
    successRate: 100,
    mcpUsage: 0,
    agentUsage: 0,
    toolUsage: 0
  });
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Real-time monitoring subscription
  useEffect(() => {
    const unsubscribe = monitoringStore.subscribe((state) => {
      // Update metrics based on monitoring data
      updateMetricsFromMonitoring(state);
    });

    return () => unsubscribe();
  }, []);

  // Load sessions on mount and periodically
  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [projectId]);

  const loadSessions = async () => {
    try {
      const sharedSessions = await getSharedSessions(projectId);
      setSessions(sharedSessions);
      
      // Calculate metrics from sessions
      const newMetrics = calculateMetrics(sharedSessions);
      setMetrics(newMetrics);
      
      setLoading(false);
    } catch (error) {
      console.error('Failed to load sessions:', error);
      setLoading(false);
    }
  };

  const calculateMetrics = (sessions: SharedSession[]): SessionMetrics => {
    const now = Date.now();
    const activeThreshold = 5 * 60 * 1000; // 5 minutes

    const metrics: SessionMetrics = {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => now - s.updated_at < activeThreshold).length,
      totalMessages: sessions.reduce((sum, s) => sum + s.messages.length, 0),
      modelsUsed: new Set(sessions.map(s => s.model_id)),
      averageResponseTime: 0,
      successRate: 100,
      mcpUsage: 0,
      agentUsage: 0,
      toolUsage: 0
    };

    // Calculate tool usage from messages
    sessions.forEach(session => {
      session.messages.forEach(msg => {
        if (msg.mcp_servers_used?.length > 0) metrics.mcpUsage++;
        if (msg.agent_used) metrics.agentUsage++;
        if (msg.tools_used?.length > 0) metrics.toolUsage++;
      });
    });

    return metrics;
  };

  const updateMetricsFromMonitoring = (monitoringState: any) => {
    // Update real-time metrics from monitoring store
    setMetrics(prev => ({
      ...prev,
      averageResponseTime: monitoringState.averageResponseTime || prev.averageResponseTime,
      successRate: monitoringState.successRate || prev.successRate
    }));
  };

  const selectedSessionData = useMemo(() => {
    if (!selectedSession) return null;
    return sessions.find(s => s.id === selectedSession);
  }, [selectedSession, sessions]);

  const getModelIcon = (modelId: string) => {
    if (modelId.includes('claude')) return <Bot className="w-4 h-4" />;
    if (modelId.includes('gemini')) return <Cpu className="w-4 h-4" />;
    return <Zap className="w-4 h-4" />;
  };

  const getStatusColor = (session: SharedSession) => {
    const now = Date.now();
    const timeSinceUpdate = now - session.updated_at;
    
    if (timeSinceUpdate < 60000) return 'text-green-500'; // Active (< 1 min)
    if (timeSinceUpdate < 300000) return 'text-yellow-500'; // Recent (< 5 min)
    return 'text-gray-500'; // Inactive
  };

  return (
    <div className={`bg-card rounded-lg border border-border p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-semibold text-primary">Session Dashboard</h2>
        </div>
        
        {/* Session Dropdown Selector */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
          >
            <span className="text-sm font-medium">
              {selectedSession ? `Session: ${selectedSession.slice(0, 8)}...` : 'Select Session'}
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 mt-2 w-64 bg-popover border border-border rounded-md shadow-lg z-50 max-h-64 overflow-y-auto"
              >
                {sessions.map(session => (
                  <button
                    key={session.id}
                    onClick={() => {
                      setSelectedSession(session.id);
                      setDropdownOpen(false);
                    }}
                    className="flex items-center justify-between w-full px-4 py-2 text-left hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {getModelIcon(session.model_id)}
                      <span className="text-sm truncate">{session.model_id}</span>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(session)}`} />
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-secondary/50 rounded-lg p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <MessageSquare className="w-5 h-5 text-muted-foreground" />
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-primary">{metrics.totalMessages}</div>
          <div className="text-sm text-muted-foreground">Total Messages</div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-secondary/50 rounded-lg p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <Activity className="w-5 h-5 text-muted-foreground" />
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-500">{metrics.activeSessions}</span>
            </div>
          </div>
          <div className="text-2xl font-bold text-primary">{metrics.totalSessions}</div>
          <div className="text-sm text-muted-foreground">Total Sessions</div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-secondary/50 rounded-lg p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <CheckCircle className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-primary">
            {metrics.averageResponseTime.toFixed(0)}ms
          </div>
          <div className="text-sm text-muted-foreground">Avg Response</div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-secondary/50 rounded-lg p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <Zap className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs font-medium text-primary">{metrics.successRate.toFixed(0)}%</span>
          </div>
          <div className="text-2xl font-bold text-primary">{metrics.modelsUsed.size}</div>
          <div className="text-sm text-muted-foreground">Models Used</div>
        </motion.div>
      </div>

      {/* Tool Usage Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-accent/20 rounded-lg p-3 text-center">
          <div className="text-lg font-semibold text-primary">{metrics.mcpUsage}</div>
          <div className="text-xs text-muted-foreground">MCP Calls</div>
        </div>
        <div className="bg-accent/20 rounded-lg p-3 text-center">
          <div className="text-lg font-semibold text-primary">{metrics.agentUsage}</div>
          <div className="text-xs text-muted-foreground">Agent Uses</div>
        </div>
        <div className="bg-accent/20 rounded-lg p-3 text-center">
          <div className="text-lg font-semibold text-primary">{metrics.toolUsage}</div>
          <div className="text-xs text-muted-foreground">Tool Calls</div>
        </div>
      </div>

      {/* Selected Session Details */}
      {selectedSessionData && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-t border-border pt-4"
        >
          <h3 className="text-lg font-semibold text-primary mb-3">Session Details</h3>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Model</span>
              <div className="flex items-center gap-2">
                {getModelIcon(selectedSessionData.model_id)}
                <span className="text-sm font-medium text-primary">{selectedSessionData.model_id}</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Messages</span>
              <span className="text-sm font-medium text-primary">{selectedSessionData.messages.length}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Created</span>
              <span className="text-sm font-medium text-primary">
                {formatDistanceToNow(selectedSessionData.created_at, { addSuffix: true })}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last Active</span>
              <span className="text-sm font-medium text-primary">
                {formatDistanceToNow(selectedSessionData.updated_at, { addSuffix: true })}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Features</span>
              <div className="flex items-center gap-2">
                {selectedSessionData.tools_enabled && (
                  <span className="px-2 py-1 bg-green-500/20 text-green-500 text-xs rounded">Tools</span>
                )}
                {selectedSessionData.mcp_enabled && (
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-500 text-xs rounded">MCP</span>
                )}
                {selectedSessionData.agents_enabled && (
                  <span className="px-2 py-1 bg-purple-500/20 text-purple-500 text-xs rounded">Agents</span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Real-time Status Indicator */}
      <div className="mt-4 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-muted-foreground">Real-time updates active</span>
        </div>
        <span className="text-muted-foreground">
          Last updated: {formatDistanceToNow(Date.now(), { addSuffix: true })}
        </span>
      </div>
    </div>
  );
}