import React, { Suspense, lazy, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTabState } from '@/hooks/useTabState';
import { Tab } from '@/contexts/TabContext';
import { Loader2, Plus } from 'lucide-react';
import { api, type Project, type Session, type ClaudeMdFile } from '@/lib/api';
import { ProjectList } from '@/components/ProjectList';
import { SessionList } from '@/components/SessionList';
import { RunningClaudeSessions } from '@/components/RunningClaudeSessions';
import { Button } from '@/components/ui/button';
import { SkeletonList } from '@/components/ui/skeleton';
import { ThreePanelLayout } from '@/components/ThreePanelLayout';
import { pageVariants, slideVariants, staggerContainer, staggerItem, buttonVariants } from '@/lib/animations';

// Lazy load heavy components - Production-safe imports with fallbacks
const ErrorFallback: React.FC<{ componentName: string }> = ({ componentName }) => (
  <div className="p-4 text-red-500 border border-red-300 rounded">
    Error: {componentName} failed to load
  </div>
);

const ClaudeCodeSession = lazy(() => 
  import('@/components/ClaudeCodeSession')
    .then(module => ({ default: module.ClaudeCodeSession }))
    .catch(() => ({ default: () => <ErrorFallback componentName="ClaudeCodeSession" /> }))
);

const ProjectSelector = lazy(() => 
  import('@/components/dashboard/ProjectSelector')
    .then(module => ({ default: module.ProjectSelector }))
    .catch(() => ({ default: () => <ErrorFallback componentName="ProjectSelector" /> }))
);

const AgentRunOutputViewer = lazy(() => 
  import('@/components/AgentRunOutputViewer')
    .then(module => ({ default: module.default }))
    .catch(() => ({ default: () => <ErrorFallback componentName="AgentRunOutputViewer" /> }))
);

const AgentExecution = lazy(() => 
  import('@/components/AgentExecution')
    .then(module => ({ default: module.AgentExecution }))
    .catch(() => ({ default: () => <ErrorFallback componentName="AgentExecution" /> }))
);

const CreateAgent = lazy(() => 
  import('@/components/CreateAgent')
    .then(module => ({ default: module.CreateAgent }))
    .catch(() => ({ default: () => <ErrorFallback componentName="CreateAgent" /> }))
);

const UsageDashboard = lazy(() => 
  import('@/components/UsageDashboard')
    .then(module => ({ default: module.UsageDashboard }))
    .catch(() => ({ default: () => <ErrorFallback componentName="UsageDashboard" /> }))
);

const MCPManager = lazy(() => 
  import('@/components/MCPManager')
    .then(module => ({ default: module.MCPManager }))
    .catch(() => ({ default: () => <ErrorFallback componentName="MCPManager" /> }))
);

const Settings = lazy(() => 
  import('@/components/Settings')
    .then(module => ({ default: module.Settings }))
    .catch(() => ({ default: () => <ErrorFallback componentName="Settings" /> }))
);

const MarkdownEditor = lazy(() => 
  import('@/components/MarkdownEditor')
    .then(module => ({ default: module.MarkdownEditor }))
    .catch(() => ({ default: () => <ErrorFallback componentName="MarkdownEditor" /> }))
);

const DashboardMain = lazy(() => 
  import('@/components/dashboard/DashboardMain')
    .then(module => ({ default: module.default }))
    .catch(() => ({ default: () => <ErrorFallback componentName="DashboardMain" /> }))
);
// const ClaudeFileEditor = lazy(() => import('@/components/ClaudeFileEditor').then(m => ({ default: m.ClaudeFileEditor })));

// Import non-lazy components for projects view

interface TabPanelProps {
  tab: Tab;
  isActive: boolean;
}

const TabPanel: React.FC<TabPanelProps> = ({ tab, isActive }) => {
  const { updateTab, createChatTab, createDashboardTab } = useTabState();
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = React.useState<Project | null>(null);
  const [sessions, setSessions] = React.useState<Session[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  // Load projects when tab becomes active and is of type 'projects' or 'dashboard' without project
  useEffect(() => {
    if (isActive && (tab.type === 'projects' || (tab.type === 'dashboard' && !tab.projectData))) {
      loadProjects();
    }
  }, [isActive, tab.type, tab.projectData]);
  
  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const projectList = await api.listProjects();
      setProjects(projectList);
    } catch (err) {
      console.error("Failed to load projects:", err);
      setError("Failed to load projects. Please ensure ~/.claude directory exists.");
    } finally {
      setLoading(false);
    }
  };
  
  const handleProjectClick = async (project: Project) => {
    try {
      setLoading(true);
      setError(null);
      const sessionList = await api.getProjectSessions(project.id);
      setSessions(sessionList);
      setSelectedProject(project);
    } catch (err) {
      console.error("Failed to load sessions:", err);
      setError("Failed to load sessions for this project.");
    } finally {
      setLoading(false);
    }
  };
  
  const handleBack = () => {
    setSelectedProject(null);
    setSessions([]);
  };
  
  const handleNewSession = () => {
    // Create a new chat tab
    createChatTab();
  };
  
  // Panel visibility - hide when not active
  const panelVisibilityClass = isActive ? "" : "hidden";
  
  const renderContent = () => {
    switch (tab.type) {
      case 'projects':
        return (
          <motion.div 
            className="h-full overflow-y-auto"
            variants={pageVariants}
            initial="initial"
            animate="in"
            exit="out"
          >
            <div className="container mx-auto p-6">
              {/* Header */}
              <motion.div 
                className="mb-6"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <h1 className="text-3xl font-bold tracking-tight">CC Projects</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Browse your Claude Code sessions
                </p>
              </motion.div>

              {/* Error display */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive max-w-2xl overflow-hidden"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Loading state */}
              {loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <SkeletonList items={6} className="mb-6" />
                </motion.div>
              )}

              {/* Content */}
              {!loading && (
                <AnimatePresence mode="sync">
                  {selectedProject ? (
                    <motion.div
                      key="sessions"
                      variants={slideVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      custom={1}
                      transition={{ duration: 0.3 }}
                    >
                      <SessionList
                        sessions={sessions}
                        projectPath={selectedProject.path}
                        onBack={handleBack}
                        onSessionClick={(session) => {
                          // Update tab to show this session
                          updateTab(tab.id, {
                            type: 'chat',
                            title: session.project_path.split('/').pop() || 'Session',
                            sessionId: session.id,
                            sessionData: session, // Store full session object
                            initialProjectPath: session.project_path,
                          });
                        }}
                        onEditClaudeFile={(file: ClaudeMdFile) => {
                          // Open CLAUDE.md file in a new tab
                          window.dispatchEvent(new CustomEvent('open-claude-file', { 
                            detail: { file } 
                          }));
                        }}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="projects"
                      variants={slideVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      custom={-1}
                      transition={{ duration: 0.3 }}
                    >
                      <motion.div
                        variants={staggerContainer}
                        initial="hidden"
                        animate="show"
                        className="space-y-6"
                      >
                        {/* New session button at the top */}
                        <motion.div variants={staggerItem} className="mb-4">
                          <motion.div
                            variants={buttonVariants}
                            whileHover="hover"
                            whileTap="tap"
                          >
                            <Button
                              onClick={handleNewSession}
                              size="default"
                              className="w-full max-w-md transition-all duration-200"
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              New Claude Code session
                            </Button>
                          </motion.div>
                        </motion.div>

                        {/* Running Claude Sessions */}
                        <motion.div variants={staggerItem}>
                          <RunningClaudeSessions />
                        </motion.div>

                        {/* Project list */}
                        <motion.div variants={staggerItem}>
                          {projects.length > 0 ? (
                            <ProjectList
                              projects={projects}
                              onProjectClick={handleProjectClick}
                              onProjectSettings={(project) => {
                                // Project settings functionality can be added here if needed
                                console.log('Project settings clicked for:', project);
                              }}
                              onProjectDashboard={(project) => {
                                // Create a dashboard tab with project data
                                createDashboardTab(project);
                              }}
                              loading={loading}
                              className="animate-fade-in"
                            />
                          ) : (
                            <motion.div 
                              className="py-8 text-center"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 0.5 }}
                            >
                              <p className="text-sm text-muted-foreground">
                                No projects found in ~/.claude/projects
                              </p>
                            </motion.div>
                          )}
                        </motion.div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        );
      
      case 'chat':
        return (
          <div className="h-full">
            <ClaudeCodeSession
              session={tab.sessionData}
              initialProjectPath={tab.initialProjectPath || tab.sessionId}
              onBack={() => {
                updateTab(tab.id, {
                  type: 'projects',
                  title: 'CC Projects',
                });
              }}
            />
          </div>
        );
      
      case 'agent':
        if (!tab.agentRunId) {
          return <div className="p-4">No agent run ID specified</div>;
        }
        return (
          <AgentRunOutputViewer
            agentRunId={tab.agentRunId}
            tabId={tab.id}
          />
        );
      
      
      case 'usage':
        return (
          <div className="h-full">
            <UsageDashboard onBack={() => {}} />
          </div>
        );
      
      case 'mcp':
        return (
          <div className="h-full">
            <MCPManager onBack={() => {}} />
          </div>
        );
      
      case 'settings':
        return (
          <div className="h-full">
            <Settings onBack={() => {}} />
          </div>
        );
      
      case 'dashboard':
        // Use project data from tab if available, otherwise show project selector
        const dashboardProject = tab.projectData || selectedProject;
        if (!dashboardProject) {
          // Show project selector within dashboard
          return (
            <motion.div className="h-full flex flex-col">
              <div className="p-4 border-b">
                <h1 className="text-2xl font-bold">Project Dashboard</h1>
                <p className="text-sm text-muted-foreground">Select a project to view its dashboard</p>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <ProjectSelector 
                  onProjectSelect={(project) => {
                    console.log('Dashboard project selected:', project);
                    // Update tab with selected project data
                    updateTab(tab.id, {
                      projectData: project,
                      title: `Dashboard - ${project.name || project.path.split(/[/\\]/).pop()}`
                    });
                  }}
                />
              </div>
            </motion.div>
          );
        }
        // Rendering DashboardMain with selected project
        return (
          <DashboardMain 
            projectId={dashboardProject.id} 
            projectPath={dashboardProject.path} 
            onBack={() => updateTab(tab.id, { type: 'projects' })} 
          />
        );
      
      case 'claude-md':
        return (
          <div className="h-full">
            <MarkdownEditor onBack={() => {}} />
          </div>
        );
      
      case 'claude-file':
        if (!tab.claudeFileId) {
          return <div className="p-4">No Claude file ID specified</div>;
        }
        // Note: We need to get the actual file object for ClaudeFileEditor
        // For now, returning a placeholder
        return <div className="p-4">Claude file editor not yet implemented in tabs</div>;
      
      case 'agent-execution':
        if (!tab.agentData) {
          return <div className="p-4">No agent data specified</div>;
        }
        return (
          <div className="h-full">
            <AgentExecution
              agent={tab.agentData}
              onBack={() => {}}
            />
          </div>
        );
      
      case 'create-agent':
        return (
          <div className="h-full">
            <CreateAgent
              onAgentCreated={() => {
                window.dispatchEvent(new CustomEvent('close-tab', { detail: { tabId: tab.id } }));
              }}
              onBack={() => {
                window.dispatchEvent(new CustomEvent('close-tab', { detail: { tabId: tab.id } }));
              }}
            />
          </div>
        );
      
      case 'import-agent':
        // TODO: Implement import agent component
        return <div className="p-4">Import agent functionality coming soon...</div>;
      
      default:
        return <div className="p-4">Unknown tab type: {tab.type}</div>;
    }
  };

  // Determine if panels should be visible based on tab type
  const shouldShowPanels = ['chat', 'projects', 'dashboard'].includes(tab.type);

  const content = (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      {renderContent()}
    </Suspense>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className={`h-full w-full ${panelVisibilityClass}`}
    >
      {shouldShowPanels ? (
        <ThreePanelLayout
          leftPanelVisible={tab.type === 'chat' || tab.type === 'dashboard'}
          rightPanelVisible={tab.type === 'chat' || tab.type === 'projects'}
        >
          {content}
        </ThreePanelLayout>
      ) : (
        content
      )}
    </motion.div>
  );
};

export const TabContent: React.FC = () => {
  const { tabs, activeTabId, createChatTab, findTabBySessionId, createClaudeFileTab, createAgentExecutionTab, createCreateAgentTab, createImportAgentTab, closeTab, updateTab } = useTabState();
  
  // Listen for events to open sessions in tabs
  useEffect(() => {
    const handleOpenSessionInTab = (event: CustomEvent) => {
      const { session } = event.detail;
      
      // Check if tab already exists for this session
      const existingTab = findTabBySessionId(session.id);
      if (existingTab) {
        // Update existing tab with session data and switch to it
        updateTab(existingTab.id, {
          sessionData: session,
          title: session.project_path.split('/').pop() || 'Session'
        });
        window.dispatchEvent(new CustomEvent('switch-to-tab', { detail: { tabId: existingTab.id } }));
      } else {
        // Create new tab for this session
        const projectName = session.project_path.split('/').pop() || 'Session';
        const newTabId = createChatTab(session.id, projectName);
        // Update the new tab with session data
        updateTab(newTabId, {
          sessionData: session,
          initialProjectPath: session.project_path
        });
      }
    };

    const handleOpenClaudeFile = (event: CustomEvent) => {
      const { file } = event.detail;
      createClaudeFileTab(file.id, file.name || 'CLAUDE.md');
    };

    const handleOpenAgentExecution = (event: CustomEvent) => {
      const { agent, tabId } = event.detail;
      createAgentExecutionTab(agent, tabId);
    };

    const handleOpenCreateAgentTab = () => {
      createCreateAgentTab();
    };

    const handleOpenImportAgentTab = () => {
      createImportAgentTab();
    };

    const handleCloseTab = (event: CustomEvent) => {
      const { tabId } = event.detail;
      closeTab(tabId);
    };

    const handleClaudeSessionSelected = (event: CustomEvent) => {
      const { session } = event.detail;
      // Reuse same logic as handleOpenSessionInTab
      const existingTab = findTabBySessionId(session.id);
      if (existingTab) {
        updateTab(existingTab.id, {
          sessionData: session,
          title: session.project_path.split('/').pop() || 'Session',
        });
        window.dispatchEvent(new CustomEvent('switch-to-tab', { detail: { tabId: existingTab.id } }));
      } else {
        const projectName = session.project_path.split('/').pop() || 'Session';
        const newTabId = createChatTab(session.id, projectName);
        updateTab(newTabId, {
          sessionData: session,
          initialProjectPath: session.project_path,
        });
      }
    };

    window.addEventListener('open-session-in-tab', handleOpenSessionInTab as EventListener);
    window.addEventListener('open-claude-file', handleOpenClaudeFile as EventListener);
    window.addEventListener('open-agent-execution', handleOpenAgentExecution as EventListener);
    window.addEventListener('open-create-agent-tab', handleOpenCreateAgentTab);
    window.addEventListener('open-import-agent-tab', handleOpenImportAgentTab);
    window.addEventListener('close-tab', handleCloseTab as EventListener);
    window.addEventListener('claude-session-selected', handleClaudeSessionSelected as EventListener);
    return () => {
      window.removeEventListener('open-session-in-tab', handleOpenSessionInTab as EventListener);
      window.removeEventListener('open-claude-file', handleOpenClaudeFile as EventListener);
      window.removeEventListener('open-agent-execution', handleOpenAgentExecution as EventListener);
      window.removeEventListener('open-create-agent-tab', handleOpenCreateAgentTab);
      window.removeEventListener('open-import-agent-tab', handleOpenImportAgentTab);
      window.removeEventListener('close-tab', handleCloseTab as EventListener);
      window.removeEventListener('claude-session-selected', handleClaudeSessionSelected as EventListener);
    };
  }, [createChatTab, findTabBySessionId, createClaudeFileTab, createAgentExecutionTab, createCreateAgentTab, createImportAgentTab, closeTab, updateTab]);
  
  return (
    <div className="flex-1 h-full relative">
      <AnimatePresence mode="sync">
        {tabs.map((tab) => (
          <TabPanel
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
          />
        ))}
      </AnimatePresence>
      
      {tabs.length === 0 && (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <div className="text-center">
            <p className="text-lg mb-2">No tabs open</p>
            <p className="text-sm">Click the + button to start a new chat</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TabContent;
