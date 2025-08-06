import { create } from 'zustand';

interface Project {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectState {
  currentProject: Project | null;
  projects: Project[];
  createNewProject: () => void;
  setCurrentProject: (project: Project) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  currentProject: null,
  projects: [],
  
  createNewProject: () => {
    const newProject: Project = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'New Project',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    set((state) => ({
      currentProject: newProject,
      projects: [...state.projects, newProject],
    }));
  },
  
  setCurrentProject: (project) => {
    set({ currentProject: project });
  },
}));