import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles,
  Download,
  CheckCircle,
  AlertCircle,
  Loader
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolInvocation {
  tool_type: {
    agent?: string;
    slash_command?: string;
    super_claude?: boolean;
    mcp_server?: string;
  };
  confidence: number;
  reason: string;
  priority: number;
}

interface RoutingResult {
  invocations: ToolInvocation[];
  detected_intent: string;
  complexity_score: number;
  domain: string;
}

interface McpInstallRequest {
  query: string;
  detected_packages: string[];
  confidence: number;
}

interface McpInstallStatus {
  server_name: string;
  status: 'searching' | 'found' | 'installing' | 'configuring' | 'testing' | 'completed' | 'failed';
  message: string;
  progress: number;
}

interface IntelligentChatProps {
  input: string;
  onToolsDetected?: (tools: ToolInvocation[]) => void;
}

const getToolIcon = (toolType: ToolInvocation['tool_type']) => {
  if (toolType.agent) {
    switch (toolType.agent) {
      case 'frontend': return '🎨';
      case 'backend': return '⚙️';
      case 'security': return '🛡️';
      default: return '🤖';
    }
  }
  if (toolType.slash_command) return '⚡';
  if (toolType.super_claude) return '✨';
  if (toolType.mcp_server) return '🔌';
  return '🔧';
};

const getToolName = (toolType: ToolInvocation['tool_type']) => {
  if (toolType.agent) return `Agent: ${toolType.agent}`;
  if (toolType.slash_command) return `/${toolType.slash_command}`;
  if (toolType.super_claude) return 'SuperClaude';
  if (toolType.mcp_server) return `MCP: ${toolType.mcp_server}`;
  return 'Unknown Tool';
};

export const IntelligentChat: React.FC<IntelligentChatProps> = ({ 
  input,
  onToolsDetected 
}) => {
  const [routingResult, setRoutingResult] = useState<RoutingResult | null>(null);
  const [mcpInstallRequest, setMcpInstallRequest] = useState<McpInstallRequest | null>(null);
  const [installStatuses, setInstallStatuses] = useState<McpInstallStatus[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // Analyze input whenever it changes
  useEffect(() => {
    if (!input || input.length < 3) {
      setRoutingResult(null);
      setMcpInstallRequest(null);
      return;
    }

    const analyzeInput = async () => {
      setIsAnalyzing(true);
      try {
        // Analyze for routing
        const routing = await invoke<RoutingResult>('analyze_chat_input', { input });
        setRoutingResult(routing);
        
        if (onToolsDetected) {
          onToolsDetected(routing.invocations);
        }

        // Check for MCP installation request
        const mcpRequest = await invoke<McpInstallRequest>('parse_mcp_install_request', { input });
        if (mcpRequest.confidence > 0.5 && mcpRequest.detected_packages.length > 0) {
          setMcpInstallRequest(mcpRequest);
        } else {
          setMcpInstallRequest(null);
        }
      } catch (error) {
        console.error('Failed to analyze input:', error);
      } finally {
        setIsAnalyzing(false);
      }
    };

    // Debounce the analysis
    const timer = setTimeout(analyzeInput, 300);
    return () => clearTimeout(timer);
  }, [input, onToolsDetected]);

  // Handle MCP installation
  const handleMcpInstall = async () => {
    if (!mcpInstallRequest) return;

    setIsInstalling(true);
    try {
      const statuses = await invoke<McpInstallStatus[]>('auto_install_mcp', {
        detectedPackages: mcpInstallRequest.detected_packages
      });
      setInstallStatuses(statuses);
    } catch (error) {
      console.error('Failed to install MCP:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  if (!routingResult && !mcpInstallRequest) return null;

  return (
    <div className="space-y-4">
      {/* Tool Detection Display */}
      {routingResult && routingResult.invocations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-muted/50 border border-border rounded-lg p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Intelligent Routing Active</span>
            {isAnalyzing && <Loader className="w-3 h-3 animate-spin" />}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
            <div className="text-xs">
              <span className="text-muted-foreground">Intent:</span>{' '}
              <span className="font-medium">{routingResult.detected_intent}</span>
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground">Domain:</span>{' '}
              <span className="font-medium">{routingResult.domain}</span>
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground">Complexity:</span>{' '}
              <span className="font-medium">{(routingResult.complexity_score * 100).toFixed(0)}%</span>
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground">Tools:</span>{' '}
              <span className="font-medium">{routingResult.invocations.length}</span>
            </div>
          </div>

          <div className="space-y-2">
            <AnimatePresence>
              {routingResult.invocations.map((invocation, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-md",
                    "bg-background/50 border border-border/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getToolIcon(invocation.tool_type)}</span>
                    <div>
                      <div className="text-sm font-medium">
                        {getToolName(invocation.tool_type)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {invocation.reason}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-right">
                      <div className="text-muted-foreground">Confidence</div>
                      <div className="font-medium">{(invocation.confidence * 100).toFixed(0)}%</div>
                    </div>
                    <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${invocation.confidence * 100}%` }}
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* MCP Installation UI */}
      {mcpInstallRequest && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Download className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium">MCP Installation Request Detected</span>
          </div>

          <div className="space-y-2 mb-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Detected packages:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {mcpInstallRequest.detected_packages.map((pkg, index) => (
                <span 
                  key={index}
                  className="px-2 py-1 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-md text-xs font-medium"
                >
                  {pkg}
                </span>
              ))}
            </div>
          </div>

          {!isInstalling && installStatuses.length === 0 && (
            <button
              onClick={handleMcpInstall}
              className="w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium transition-colors"
            >
              Install MCP Servers
            </button>
          )}

          {/* Installation Progress */}
          {(isInstalling || installStatuses.length > 0) && (
            <div className="space-y-2">
              {installStatuses.map((status, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{status.server_name}</span>
                    <span className="text-xs">
                      {status.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-500" />}
                      {status.status === 'failed' && <AlertCircle className="w-4 h-4 text-red-500" />}
                      {!['completed', 'failed'].includes(status.status) && (
                        <Loader className="w-4 h-4 animate-spin" />
                      )}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">{status.message}</div>
                  <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all",
                        status.status === 'completed' ? 'bg-green-500' :
                        status.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
                      )}
                      style={{ width: `${status.progress * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};