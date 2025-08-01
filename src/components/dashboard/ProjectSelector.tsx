import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Folder, Clock, Activity, FolderOpen, Plus } from 'lucide-react';
import { api, type Project } from '@/lib/api';
import { formatISOTimestamp } from '@/lib/date-utils';
import { staggerContainer, staggerItem } from '@/lib/animations';

interface ProjectSelectorProps {
  onProjectSelect: (project: Project) => void;
}

export function ProjectSelector({ onProjectSelect }: ProjectSelectorProps) {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      
      // Try to get current working directory project
      const [current, recent, all] = await Promise.all([
        api.getCurrentWorkingProject(),
        api.getRecentProjects(5),
        api.listProjects()
      ]);

      setCurrentProject(current);
      setRecentProjects(recent);
      setAllProjects(all);

      // If we have a current project, auto-select it
      if (current) {
        onProjectSelect(current);
      } else if (recent.length > 0) {
        // If no current project but we have recent projects, select the most recent
        onProjectSelect(recent[0]);
      } else if (all.length > 0) {
        // If no recent projects, select the first available project
        onProjectSelect(all[0]);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewProject = async () => {
    // For now, we'll use the current project if available
    // In a real implementation, you'd use a file dialog or similar
    try {
      if (currentProject) {
        const project = await api.createProjectIfNotExists(currentProject.path, currentProject.name);
        onProjectSelect(project);
      } else {
        // Create a project from a default path or show a dialog
        console.log('No current project to use as template');
      }
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading projects...</div>
      </div>
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Current Working Project */}
      {currentProject && (
        <motion.div variants={staggerItem}>
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-primary" />
                Current Project
              </CardTitle>
            </CardHeader>
            <CardContent>
              <button
                onClick={() => onProjectSelect(currentProject)}
                className="w-full text-left p-4 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="font-semibold">{currentProject.name || currentProject.path.split(/[/\\]/).pop()}</div>
                <div className="text-sm text-muted-foreground mt-1">{currentProject.path}</div>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    {currentProject.sessions_count || 0} sessions
                  </span>
                </div>
              </button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Quick Actions */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={handleCreateNewProject}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Project from Current Directory
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => setShowAll(!showAll)}
            >
              <Folder className="w-4 h-4 mr-2" />
              {showAll ? 'Show Recent Projects' : 'Show All Projects'}
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Projects */}
      {!showAll && recentProjects.length > 0 && (
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recent Projects
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentProjects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => onProjectSelect(project)}
                    className="w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {project.name || project.path.split(/[/\\]/).pop()}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">{project.path}</div>
                      </div>
                      <div className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
                        {project.last_accessed && formatISOTimestamp(project.last_accessed)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* All Projects */}
      {showAll && (
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Folder className="w-5 h-5" />
                All Projects ({allProjects.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                {allProjects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => onProjectSelect(project)}
                    className="text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="font-medium truncate">
                      {project.name || project.path.split(/[/\\]/).pop()}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">{project.path}</div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{project.sessions_count || 0} sessions</span>
                      {project.last_accessed && (
                        <span>{formatISOTimestamp(project.last_accessed)}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}