import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
  FolderOpen, 
  Calendar, 
  FileText, 
  ChevronRight, 
  Settings,
  MoreVertical,
  Activity,
  Search,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Project } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/date-utils";
import { Pagination } from "@/components/ui/pagination";

interface ProjectListProps {
  /**
   * Array of projects to display
   */
  projects: Project[];
  /**
   * Callback when a project is clicked
   */
  onProjectClick: (project: Project) => void;
  /**
   * Callback when hooks configuration is clicked
   */
  onProjectSettings?: (project: Project) => void;
  /**
   * Callback when dashboard is clicked for a project
   */
  onProjectDashboard?: (project: Project) => void;
  /**
   * Whether the list is currently loading
   */
  loading?: boolean;
  /**
   * Optional className for styling
   */
  className?: string;
}

const ITEMS_PER_PAGE = 12;

/**
 * Extracts the project name from the full path
 */
const getProjectName = (path: string): string => {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] || path;
};

/**
 * ProjectList component - Displays a paginated list of projects with hover animations
 * 
 * @example
 * <ProjectList
 *   projects={projects}
 *   onProjectClick={(project) => console.log('Selected:', project)}
 * />
 */
export const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  onProjectClick,
  onProjectSettings,
  onProjectDashboard,
  className,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Filter projects based on search query
  const filteredProjects = projects.filter(project => {
    const projectName = getProjectName(project.path).toLowerCase();
    const projectPath = project.path.toLowerCase();
    const query = searchQuery.toLowerCase();
    
    return projectName.includes(query) || projectPath.includes(query);
  });
  
  // Calculate pagination
  const totalPages = Math.ceil(filteredProjects.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentProjects = filteredProjects.slice(startIndex, endIndex);
  
  // Reset to page 1 if projects change or search query changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [projects.length, searchQuery]);
  
  return (
    <div className={cn("space-y-4", className)}>
      {/* Search bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-10"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
            onClick={() => setSearchQuery("")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Results info */}
      {searchQuery && (
        <p className="text-sm text-muted-foreground">
          Found {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''} 
          {searchQuery && ` matching "${searchQuery}"`}
        </p>
      )}

      {/* Empty state for no results */}
      {filteredProjects.length === 0 && searchQuery ? (
        <div className="text-center py-12">
          <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No projects found</h3>
          <p className="text-sm text-muted-foreground">
            No projects match your search for "{searchQuery}"
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setSearchQuery("")}
          >
            Clear search
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {currentProjects.map((project, index) => (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.3,
              delay: index * 0.05,
              ease: [0.4, 0, 0.2, 1],
            }}
          >
            <Card
              className="p-4 hover:shadow-md transition-all duration-200 cursor-pointer group h-full"
              onClick={() => onProjectClick(project)}
            >
              <div className="flex flex-col h-full">
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FolderOpen className="h-5 w-5 text-primary shrink-0" />
                      <h3 className="font-semibold text-base truncate">
                        {getProjectName(project.path)}
                      </h3>
                    </div>
                    {(project.sessions?.length || project.sessions_count) && (
                      <Badge variant="secondary" className="shrink-0 ml-2">
                        {project.sessions?.length || project.sessions_count || 0}
                      </Badge>
                    )}
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-3 font-mono truncate">
                    {project.path}
                  </p>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{formatTimeAgo(new Date(project.created_at).getTime())}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      <span>{project.sessions?.length || project.sessions_count || 0}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {(onProjectSettings || onProjectDashboard) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {onProjectDashboard && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                onProjectDashboard(project);
                              }}
                            >
                              <Activity className="h-4 w-4 mr-2" />
                              Dashboard
                            </DropdownMenuItem>
                          )}
                          {onProjectSettings && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                onProjectSettings(project);
                              }}
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              Hooks
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
          ))}
        </div>
      )}
      
      {/* Pagination - only show if we have filtered projects and more than one page */}
      {filteredProjects.length > 0 && totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}; 
