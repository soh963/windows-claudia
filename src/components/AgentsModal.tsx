import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Plus, Loader2, Play, Clock, CheckCircle, XCircle, Trash2, Import, ChevronDown, FileJson, Globe, Download, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Toast } from '@/components/ui/toast';
import { Input } from '@/components/ui/input';
import { api, type Agent, type AgentRunWithMetrics } from '@/lib/api';
import { useTabState } from '@/hooks/useTabState';
import { formatISOTimestamp } from '@/lib/date-utils';
import { open as openDialog, save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { GitHubAgentBrowser } from '@/components/GitHubAgentBrowser';

interface AgentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AgentsModal: React.FC<AgentsModalProps> = ({ open, onOpenChange }) => {
  const [activeTab, setActiveTab] = useState('agents');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runningAgents, setRunningAgents] = useState<AgentRunWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showGitHubBrowser, setShowGitHubBrowser] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { createAgentTab, createCreateAgentTab } = useTabState();

  // Load agents when modal opens
  useEffect(() => {
    if (open) {
      loadAgents();
      loadRunningAgents();
    }
  }, [open]);

  // Refresh running agents periodically
  useEffect(() => {
    if (!open) return;
    
    const interval = setInterval(() => {
      loadRunningAgents();
    }, 3000); // Refresh every 3 seconds

    return () => clearInterval(interval);
  }, [open]);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const agentList = await api.listAgents();
      setAgents(agentList);
    } catch (error) {
      console.error('Failed to load agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRunningAgents = async () => {
    try {
      const runs = await api.listRunningAgentSessions();
      const agentRuns = runs.map(run => ({
        id: run.id,
        agent_id: run.agent_id,
        agent_name: run.agent_name,
        task: run.task,
        model: run.model,
        status: 'running' as const,
        created_at: run.created_at,
        project_path: run.project_path,
      } as AgentRunWithMetrics));
      
      setRunningAgents(agentRuns);
    } catch (error) {
      console.error('Failed to load running agents:', error);
    }
  };

  const handleRunAgent = async (agent: Agent) => {
    // Create a new agent execution tab
    const tabId = `agent-exec-${agent.id}-${Date.now()}`;
    
    // Close modal
    onOpenChange(false);
    
    // Dispatch event to open agent execution in the new tab
    window.dispatchEvent(new CustomEvent('open-agent-execution', { 
      detail: { agent, tabId } 
    }));
  };

  const handleDeleteAgent = async (agent: Agent) => {
    setAgentToDelete(agent);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!agentToDelete?.id) return;
    try {
      await api.deleteAgent(agentToDelete.id);
      loadAgents(); // Refresh the list
      setShowDeleteDialog(false);
      setAgentToDelete(null);
    } catch (error) {
      console.error('Failed to delete agent:', error);
    }
  };

  const handleOpenAgentRun = (run: AgentRunWithMetrics) => {
    // Create new tab for this agent run
    createAgentTab(run.id!.toString(), run.agent_name);
    onOpenChange(false);
  };

  const handleCreateAgent = () => {
    // Close modal and create new tab
    onOpenChange(false);
    createCreateAgentTab();
  };

  const handleImportFromFile = async () => {
    try {
      const filePath = await openDialog({
        multiple: false,
        filters: [{
          name: 'JSON',
          extensions: ['json']
        }]
      });
      
      if (filePath) {
        const agent = await api.importAgentFromFile(filePath as string);
        loadAgents(); // Refresh list
        setToast({ message: `Agent "${agent.name}" imported successfully`, type: "success" });
      }
    } catch (error) {
      console.error('Failed to import agent:', error);
      setToast({ message: "Failed to import agent", type: "error" });
    }
  };

  const handleImportFromGitHub = () => {
    setShowGitHubBrowser(true);
  };

  const handleExportAgent = async (agent: Agent) => {
    try {
      const exportData = await api.exportAgent(agent.id!);
      const filePath = await save({
        defaultPath: `${agent.name.toLowerCase().replace(/\s+/g, '-')}.json`,
        filters: [{
          name: 'JSON',
          extensions: ['json']
        }]
      });
      
      if (filePath) {
        await invoke('write_file', { path: filePath, content: JSON.stringify(exportData, null, 2) });
        setToast({ message: "Agent exported successfully", type: "success" });
      }
    } catch (error) {
      console.error('Failed to export agent:', error);
      setToast({ message: "Failed to export agent", type: "error" });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  // Filter agents based on search query
  const filteredAgents = agents.filter(agent => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      agent.name.toLowerCase().includes(query) ||
      (agent.default_task && agent.default_task.toLowerCase().includes(query))
    );
  });

  // Filter running agents based on search query
  const filteredRunningAgents = runningAgents.filter(run => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      run.agent_name.toLowerCase().includes(query) ||
      run.task.toLowerCase().includes(query)
    );
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[600px] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Agent Management
          </DialogTitle>
          <DialogDescription>
            Create new agents or manage running agent executions
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => {
          setActiveTab(value);
          setSearchQuery(''); // Clear search when switching tabs
        }} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-4 mb-0">
            <TabsTrigger value="agents">Available Agents</TabsTrigger>
            <TabsTrigger value="running" className="relative">
              Running Agents
              {runningAgents.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                  {runningAgents.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-hidden">
            <TabsContent value="agents" className="h-full m-0 data-[state=active]:flex data-[state=active]:flex-col">
              <div className="flex flex-col h-full min-h-0">
                {/* Search and action buttons at the top */}
                <div className="px-6 pt-4 pb-2 flex-shrink-0">
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search agents..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleCreateAgent} className="flex-1">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Agent
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="flex-1">
                          <Import className="w-4 h-4 mr-2" />
                          Import Agent
                          <ChevronDown className="w-4 h-4 ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={handleImportFromFile}>
                          <FileJson className="w-4 h-4 mr-2" />
                          From File
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleImportFromGitHub}>
                          <Globe className="w-4 h-4 mr-2" />
                          From GitHub
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  <ScrollArea className="h-full px-6 pb-6">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredAgents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <Bot className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium mb-2">
                      {searchQuery ? 'No agents found' : 'No agents available'}
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      {searchQuery ? `No agents match "${searchQuery}"` : 'Create your first agent to get started'}
                    </p>
                    <Button onClick={() => {
                      onOpenChange(false);
                      window.dispatchEvent(new CustomEvent('open-create-agent-tab'));
                    }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Agent
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4 py-4">
                    {filteredAgents.map((agent) => (
                      <motion.div
                        key={agent.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-medium flex items-center gap-2">
                              <Bot className="w-4 h-4" />
                              {agent.name}
                            </h3>
                            {agent.default_task && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {agent.default_task}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleExportAgent(agent)}
                            >
                              <Download className="w-3 h-3 mr-1" />
                              Export
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteAgent(agent)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Delete
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleRunAgent(agent)}
                            >
                              <Play className="w-3 h-3 mr-1" />
                              Run
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="running" className="h-full m-0 data-[state=active]:flex data-[state=active]:flex-col">
              <div className="flex flex-col h-full min-h-0">
                {/* Search input for running agents */}
                <div className="px-6 pt-4 pb-2 flex-shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search running agents..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  <ScrollArea className="h-full px-6 pb-6">
                {filteredRunningAgents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <Clock className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium mb-2">
                      {searchQuery ? 'No running agents found' : 'No running agents'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {searchQuery ? `No running agents match "${searchQuery}"` : 'Agent executions will appear here when started'}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 py-4">
                    <AnimatePresence mode="popLayout">
                      {filteredRunningAgents.map((run) => (
                        <motion.div
                          key={run.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => handleOpenAgentRun(run)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-medium flex items-center gap-2">
                                {getStatusIcon(run.status)}
                                {run.agent_name}
                              </h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                {run.task}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                <span>Started: {formatISOTimestamp(run.created_at)}</span>
                                <Badge variant="outline" className="text-xs">
                                  {run.model === 'opus' ? 'Claude 4 Opus' : 'Claude 4 Sonnet'}
                                </Badge>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenAgentRun(run);
                              }}
                            >
                              View
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>

    {/* Delete Confirmation Dialog */}
    <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Agent</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{agentToDelete?.name}"? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 mt-4">
          <Button
            variant="outline"
            onClick={() => {
              setShowDeleteDialog(false);
              setAgentToDelete(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={confirmDelete}
          >
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* GitHub Agent Browser */}
    <GitHubAgentBrowser
      isOpen={showGitHubBrowser}
      onClose={() => setShowGitHubBrowser(false)}
      onImportSuccess={() => {
        setShowGitHubBrowser(false);
        loadAgents(); // Refresh the agents list
        setToast({ message: "Agent imported successfully", type: "success" });
      }}
    />

    {/* Toast notifications */}
    {toast && (
      <Toast
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast(null)}
      />
    )}
    </>
  );
};

export default AgentsModal;