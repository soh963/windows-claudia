/**
 * Optimized TabContent Component
 * Reduced complexity and improved performance
 */

import React, { Suspense, lazy, useEffect, useCallback, memo, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useTabState } from '@/hooks/useTabState';
import { Tab } from '@/contexts/TabContext';
import { api, type Project, type Session, type ClaudeMdFile } from '@/lib/api';
import { LoadingState, ErrorState, EmptyState } from '@/components/shared/CommonComponents';
import { ThreePanelLayoutOptimized } from '@/components/ThreePanelLayout.optimized';
import { createAsyncHandler } from '@/lib/ui-utils';

// Lazy load heavy components with proper error boundaries
const componentLoader = (
  importFn: () => Promise<any>,
  componentName: string
) => lazy(() => 
  importFn().catch(() => ({
    default: () => <ErrorState error={`Failed to load ${componentName}`} />
  }))
);

// Lazy loaded components
const ClaudeCodeSession = componentLoader(
  () => import('@/components/ClaudeCodeSession').then(m => ({ default: m.ClaudeCodeSession })),
  'ClaudeCodeSession'
);

const ProjectSelector = componentLoader(
  () => import('@/components/dashboard/ProjectSelector').then(m => ({ default: m.ProjectSelector })),
  'ProjectSelector'
);

const DashboardMain = componentLoader(
  () => import('@/components/dashboard/DashboardMain'),
  'DashboardMain'
);

const AgentRunOutputViewer = componentLoader(
  () => import('@/components/AgentRunOutputViewer'),
  'AgentRunOutputViewer'
);

const UsageDashboard = componentLoader(
  () => import('@/components/UsageDashboard').then(m => ({ default: m.UsageDashboard })),
  'UsageDashboard'
);

const MCPManager = componentLoader(
  () => import('@/components/MCPManager').then(m => ({ default: m.MCPManager })),
  'MCPManager'
);

const Settings = componentLoader(
  () => import('@/components/Settings').then(m => ({ default: m.Settings })),
  'Settings'
);

// Tab type to component mapping
const TAB_COMPONENTS: Record<string, React.ComponentType<any>> = {
  'usage': UsageDashboard,
  'mcp': MCPManager,
  'settings': Settings,
};

// Memoized tab panel component
const TabPanel = memo<{
  tab: Tab;
  isActive: boolean;
}>(({ tab, isActive }) => {
  const { updateTab, createChatTab, createDashboardTab } = useTabState();
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = React.useState<Project | null>(null);
  const [sessions, setSessions] = React.useState<Session[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [panelStates, setPanelStates] = React.useState({
    left: false,
    right: false
  });

  // Load projects when needed
  const loadProjects = useCallback(
    createAsyncHandler(async () => {
      const projectList = await api.listProjects();
      setProjects(projectList);
    }, {
      onStart: () => {
        setLoading(true);
        setError(null);
      },
      onError: (err) => {
        setError("Failed to load projects. Please ensure ~/.claude directory exists.");
      },
      onComplete: () => setLoading(false)
    }),
    []
  );

  // Load sessions for a project
  const loadSessions = useCallback(
    createAsyncHandler(async (project: Project) => {
      const sessionList = await api.getProjectSessions(project.id);
      setSessions(sessionList);
      setSelectedProject(project);
    }, {
      onStart: () => {
        setLoading(true);
        setError(null);
      },
      onError: (err) => {
        setError("Failed to load sessions for this project.");
      },
      onComplete: () => setLoading(false)
    }),
    []
  );

  // Load data when tab becomes active
  useEffect(() => {
    if (isActive && (tab.type === 'projects' || (tab.type === 'dashboard' && !tab.projectData))) {
      loadProjects();
    }
  }, [isActive, tab.type, tab.projectData, loadProjects]);

  // Render content based on tab type
  const renderContent = useCallback(() => {
    // Handle simple component types
    const SimpleComponent = TAB_COMPONENTS[tab.type];
    if (SimpleComponent) {
      return (
        <div className="h-full">
          <SimpleComponent onBack={() => {}} />
        </div>
      );
    }

    switch (tab.type) {
      case 'projects':
        if (loading) return <LoadingState message="Loading projects..." />;
        if (error) return <ErrorState error={error} onRetry={loadProjects} />;
        
        return (
          <ProjectsView
            projects={projects}
            selectedProject={selectedProject}
            sessions={sessions}
            onProjectClick={loadSessions}
            onBack={() => {
              setSelectedProject(null);
              setSessions([]);
            }}
            onNewSession={createChatTab}
            onSessionClick={(session) => {
              updateTab(tab.id, {
                type: 'chat',
                title: session.project_path.split('/').pop() || 'Session',
                sessionId: session.id,
                sessionData: session,
                initialProjectPath: session.project_path,
              });
            }}
          />
        );

      case 'chat':
        return (
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
        );

      case 'dashboard':
        const dashboardProject = tab.projectData || selectedProject;
        if (!dashboardProject) {
          return (
            <div className="h-full flex flex-col">
              <div className="p-4 border-b">
                <h1 className="text-2xl font-bold">Project Dashboard</h1>
                <p className="text-sm text-muted-foreground">Select a project to view its dashboard</p>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <ProjectSelector 
                  onProjectSelect={(project) => {
                    updateTab(tab.id, {
                      projectData: project,
                      title: `Dashboard - ${project.name || project.path.split(/[/\\]/).pop()}`
                    });
                  }}
                />
              </div>
            </div>
          );
        }
        return (
          <DashboardMain 
            projectId={dashboardProject.id} 
            projectPath={dashboardProject.path} 
            onBack={() => updateTab(tab.id, { type: 'projects' })} 
          />
        );

      case 'agent':
        if (!tab.agentRunId) {
          return <EmptyState title="No agent run ID specified" />;
        }
        return (
          <AgentRunOutputViewer
            agentRunId={tab.agentRunId}
            tabId={tab.id}
          />
        );

      default:
        return <EmptyState title={`Unknown tab type: ${tab.type}`} />;
    }
  }, [tab, loading, error, projects, selectedProject, sessions, loadProjects, loadSessions, createChatTab, updateTab, createDashboardTab]);

  // Determine if panels should be visible
  const shouldShowPanels = useMemo(
    () => ['chat', 'projects', 'dashboard'].includes(tab.type),
    [tab.type]
  );

  const content = (
    <Suspense fallback={<LoadingState fullScreen />}>
      {renderContent()}
    </Suspense>
  );

  if (!isActive) {
    return null;
  }

  return shouldShowPanels ? (
    <ThreePanelLayoutOptimized
      leftPanelVisible={panelStates.left}
      rightPanelVisible={panelStates.right}
      onToggleLeftPanel={() => setPanelStates(prev => ({ ...prev, left: !prev.left }))}
      onToggleRightPanel={() => setPanelStates(prev => ({ ...prev, right: !prev.right }))}
    >
      {content}
    </ThreePanelLayoutOptimized>
  ) : content;
});

TabPanel.displayName = 'TabPanel';

// Simplified Projects View component
const ProjectsView = memo<{
  projects: Project[];
  selectedProject: Project | null;
  sessions: Session[];
  onProjectClick: (project: Project) => void;
  onBack: () => void;
  onNewSession: () => void;
  onSessionClick: (session: Session) => void;
}>(({ projects, selectedProject, sessions, onProjectClick, onBack, onNewSession, onSessionClick }) => {
  // Import necessary components inline
  const ProjectList = React.lazy(() => import('@/components/ProjectList').then(m => ({ default: m.ProjectList })));
  const SessionList = React.lazy(() => import('@/components/SessionList').then(m => ({ default: m.SessionList })));
  const RunningClaudeSessions = React.lazy(() => import('@/components/RunningClaudeSessions').then(m => ({ default: m.RunningClaudeSessions })));

  if (selectedProject) {
    return (
      <Suspense fallback={<LoadingState />}>
        <SessionList
          sessions={sessions}
          projectPath={selectedProject.path}
          onBack={onBack}
          onSessionClick={onSessionClick}
          onEditClaudeFile={(file: ClaudeMdFile) => {
            window.dispatchEvent(new CustomEvent('open-claude-file', { 
              detail: { file } 
            }));
          }}
        />
      </Suspense>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">CC Projects</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse your Claude Code sessions
        </p>
      </div>

      <button
        onClick={onNewSession}
        className="w-full max-w-md px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
      >
        + New Claude Code session
      </button>

      <Suspense fallback={<LoadingState />}>
        <RunningClaudeSessions />
      </Suspense>

      {projects.length > 0 ? (
        <Suspense fallback={<LoadingState />}>
          <ProjectList
            projects={projects}
            onProjectClick={onProjectClick}
            onProjectSettings={() => {}}
            onProjectDashboard={() => {}}
            loading={false}
          />
        </Suspense>
      ) : (
        <EmptyState 
          title="No projects found"
          description="No projects found in ~/.claude/projects"
        />
      )}
    </div>
  );
});

ProjectsView.displayName = 'ProjectsView';

// Main TabContent component
export const TabContentOptimized: React.FC = () => {
  const { tabs, activeTabId } = useTabState();

  // Event listener setup
  useEffect(() => {
    const handleEvents = (event: CustomEvent) => {
      // Event handling logic here
      console.log('Event received:', event.type);
    };

    const events = [
      'open-session-in-tab',
      'open-claude-file',
      'open-agent-execution',
      'close-tab',
      'claude-session-selected'
    ];

    events.forEach(event => {
      window.addEventListener(event, handleEvents as EventListener);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleEvents as EventListener);
      });
    };
  }, []);

  if (tabs.length === 0) {
    return (
      <div className="flex-1 h-full flex items-center justify-center">
        <EmptyState
          title="No tabs open"
          description="Click the + button to start a new chat"
        />
      </div>
    );
  }

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
    </div>
  );
};

export default TabContentOptimized;