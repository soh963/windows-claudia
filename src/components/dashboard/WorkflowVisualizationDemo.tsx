import React, { useState, useEffect } from 'react';
import WorkflowVisualization, { 
  type WorkflowTemplate
} from './WorkflowVisualization';
import type { WorkflowStage } from '@/lib/api';

/**
 * Demo component showing the enhanced WorkflowVisualization in action
 * with sample data and interactive features
 */
const WorkflowVisualizationDemo: React.FC = () => {
  const [activeTemplate, setActiveTemplate] = useState<WorkflowTemplate>('feature');
  const [realTimeUpdates, setRealTimeUpdates] = useState(true);
  const [stages, setStages] = useState<WorkflowStage[]>([]);

  // Sample workflow stages data
  const sampleStages: Record<WorkflowTemplate, WorkflowStage[]> = {
    feature: [
      {
        id: 1,
        project_id: 'demo-project',
        stage_name: 'Planning & Design',
        stage_order: 1,
        status: 'completed',
        start_date: Math.floor(Date.now() / 1000) - 86400 * 7, // 7 days ago
        end_date: Math.floor(Date.now() / 1000) - 86400 * 5, // 5 days ago
        duration_days: 2,
        efficiency_score: 92,
        updated_at: Math.floor(Date.now() / 1000) - 86400 * 5,
      },
      {
        id: 2,
        project_id: 'demo-project',
        stage_name: 'Development',
        stage_order: 2,
        status: 'active',
        start_date: Math.floor(Date.now() / 1000) - 86400 * 5, // 5 days ago
        duration_days: 3,
        efficiency_score: 78,
        updated_at: Math.floor(Date.now() / 1000),
      },
      {
        id: 3,
        project_id: 'demo-project',
        stage_name: 'Code Review',
        stage_order: 3,
        status: 'pending',
        efficiency_score: 0,
        updated_at: Math.floor(Date.now() / 1000),
      },
      {
        id: 4,
        project_id: 'demo-project',
        stage_name: 'Testing',
        stage_order: 4,
        status: 'pending',
        efficiency_score: 0,
        updated_at: Math.floor(Date.now() / 1000),
      },
      {
        id: 5,
        project_id: 'demo-project',
        stage_name: 'Integration',
        stage_order: 5,
        status: 'pending',
        efficiency_score: 0,
        updated_at: Math.floor(Date.now() / 1000),
      },
      {
        id: 6,
        project_id: 'demo-project',
        stage_name: 'Deployment',
        stage_order: 6,
        status: 'pending',
        efficiency_score: 0,
        updated_at: Math.floor(Date.now() / 1000),
      }
    ],
    bugfix: [
      {
        id: 7,
        project_id: 'demo-project',
        stage_name: 'Bug Investigation',
        stage_order: 1,
        status: 'completed',
        start_date: Math.floor(Date.now() / 1000) - 86400 * 3, // 3 days ago
        end_date: Math.floor(Date.now() / 1000) - 86400 * 2, // 2 days ago
        duration_days: 1,
        efficiency_score: 95,
        updated_at: Math.floor(Date.now() / 1000) - 86400 * 2,
      },
      {
        id: 8,
        project_id: 'demo-project',
        stage_name: 'Implement Fix',
        stage_order: 2,
        status: 'blocked',
        start_date: Math.floor(Date.now() / 1000) - 86400 * 2, // 2 days ago
        duration_days: 1,
        efficiency_score: 45,
        bottlenecks: 'Waiting for external API documentation and third-party library update',
        updated_at: Math.floor(Date.now() / 1000),
      },
      {
        id: 9,
        project_id: 'demo-project',
        stage_name: 'Testing & Validation',
        stage_order: 3,
        status: 'pending',
        efficiency_score: 0,
        updated_at: Math.floor(Date.now() / 1000),
      },
      {
        id: 10,
        project_id: 'demo-project',
        stage_name: 'Deploy Fix',
        stage_order: 4,
        status: 'pending',
        efficiency_score: 0,
        updated_at: Math.floor(Date.now() / 1000),
      }
    ],
    refactor: [
      {
        id: 11,
        project_id: 'demo-project',
        stage_name: 'Code Analysis',
        stage_order: 1,
        status: 'completed',
        start_date: Math.floor(Date.now() / 1000) - 86400 * 10, // 10 days ago
        end_date: Math.floor(Date.now() / 1000) - 86400 * 8, // 8 days ago
        duration_days: 2,
        efficiency_score: 88,
        updated_at: Math.floor(Date.now() / 1000) - 86400 * 8,
      },
      {
        id: 12,
        project_id: 'demo-project',
        stage_name: 'Refactoring',
        stage_order: 2,
        status: 'completed',
        start_date: Math.floor(Date.now() / 1000) - 86400 * 8, // 8 days ago
        end_date: Math.floor(Date.now() / 1000) - 86400 * 4, // 4 days ago
        duration_days: 4,
        efficiency_score: 75,
        updated_at: Math.floor(Date.now() / 1000) - 86400 * 4,
      },
      {
        id: 13,
        project_id: 'demo-project',
        stage_name: 'Regression Testing',
        stage_order: 3,
        status: 'active',
        start_date: Math.floor(Date.now() / 1000) - 86400 * 4, // 4 days ago
        duration_days: 2,
        efficiency_score: 82,
        updated_at: Math.floor(Date.now() / 1000),
      },
      {
        id: 14,
        project_id: 'demo-project',
        stage_name: 'Quality Review',
        stage_order: 4,
        status: 'pending',
        efficiency_score: 0,
        updated_at: Math.floor(Date.now() / 1000),
      },
      {
        id: 15,
        project_id: 'demo-project',
        stage_name: 'Deploy Changes',
        stage_order: 5,
        status: 'pending',
        efficiency_score: 0,
        updated_at: Math.floor(Date.now() / 1000),
      }
    ],
    release: [
      {
        id: 16,
        project_id: 'demo-project',
        stage_name: 'Release Preparation',
        stage_order: 1,
        status: 'completed',
        start_date: Math.floor(Date.now() / 1000) - 86400 * 14, // 14 days ago
        end_date: Math.floor(Date.now() / 1000) - 86400 * 12, // 12 days ago
        duration_days: 2,
        efficiency_score: 90,
        updated_at: Math.floor(Date.now() / 1000) - 86400 * 12,
      },
      {
        id: 17,
        project_id: 'demo-project',
        stage_name: 'Build & Package',
        stage_order: 2,
        status: 'completed',
        start_date: Math.floor(Date.now() / 1000) - 86400 * 12, // 12 days ago
        end_date: Math.floor(Date.now() / 1000) - 86400 * 11, // 11 days ago
        duration_days: 1,
        efficiency_score: 95,
        updated_at: Math.floor(Date.now() / 1000) - 86400 * 11,
      },
      {
        id: 18,
        project_id: 'demo-project',
        stage_name: 'Staging Deployment',
        stage_order: 3,
        status: 'completed',
        start_date: Math.floor(Date.now() / 1000) - 86400 * 11, // 11 days ago
        end_date: Math.floor(Date.now() / 1000) - 86400 * 10, // 10 days ago
        duration_days: 1,
        efficiency_score: 87,
        updated_at: Math.floor(Date.now() / 1000) - 86400 * 10,
      },
      {
        id: 19,
        project_id: 'demo-project',
        stage_name: 'UAT Testing',
        stage_order: 4,
        status: 'completed',
        start_date: Math.floor(Date.now() / 1000) - 86400 * 10, // 10 days ago
        end_date: Math.floor(Date.now() / 1000) - 86400 * 7, // 7 days ago
        duration_days: 3,
        efficiency_score: 79,
        updated_at: Math.floor(Date.now() / 1000) - 86400 * 7,
      },
      {
        id: 20,
        project_id: 'demo-project',
        stage_name: 'Production Deployment',
        stage_order: 5,
        status: 'active',
        start_date: Math.floor(Date.now() / 1000) - 86400 * 1, // 1 day ago
        duration_days: 0.5,
        efficiency_score: 85,
        updated_at: Math.floor(Date.now() / 1000),
      },
      {
        id: 21,
        project_id: 'demo-project',
        stage_name: 'Post-Release Monitoring',
        stage_order: 6,
        status: 'pending',
        efficiency_score: 0,
        updated_at: Math.floor(Date.now() / 1000),
      }
    ],
    custom: []
  };

  // Update stages when template changes
  useEffect(() => {
    setStages(sampleStages[activeTemplate]);
  }, [activeTemplate]);

  // Simulate real-time updates
  useEffect(() => {
    if (!realTimeUpdates) return;

    const interval = setInterval(() => {
      setStages(currentStages => {
        const updated = [...currentStages];
        
        // Randomly update efficiency scores and status for active stages
        updated.forEach(stage => {
          if (stage.status === 'active' && Math.random() > 0.7) {
            const newEfficiency = Math.max(0, Math.min(100, 
              (stage.efficiency_score || 0) + (Math.random() - 0.5) * 10
            ));
            stage.efficiency_score = Math.round(newEfficiency);
            stage.updated_at = Math.floor(Date.now() / 1000);
          }
        });

        return updated;
      });
    }, 3000); // Update every 3 seconds

    return () => clearInterval(interval);
  }, [realTimeUpdates]);

  const handleStageClick = (stage: WorkflowStage) => {
    console.log('Stage clicked:', stage);
    // Could open a modal or navigate to stage details
  };

  const handleTemplateChange = (template: WorkflowTemplate) => {
    console.log('Template changed:', template);
    setActiveTemplate(template);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
        <div>
          <h2 className="text-lg font-semibold">Workflow Visualization Demo</h2>
          <p className="text-sm text-muted-foreground">
            Interactive workflow visualization with multiple templates and real-time updates
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium">Real-time updates:</label>
          <input
            type="checkbox"
            checked={realTimeUpdates}
            onChange={(e) => setRealTimeUpdates(e.target.checked)}
            className="rounded"
          />
        </div>
      </div>

      <WorkflowVisualization
        stages={stages}
        loading={false}
        onStageClick={handleStageClick}
        onTemplateChange={handleTemplateChange}
        activeTemplate={activeTemplate}
        realTimeUpdates={realTimeUpdates}
      />

      <div className="p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium mb-2">Features Demonstrated:</h3>
        <ul className="text-sm space-y-1 text-muted-foreground">
          <li>• Multiple workflow templates (Feature, Bug Fix, Refactor, Release)</li>
          <li>• Three visualization modes (Timeline, Flow Diagram, Kanban Board)</li>
          <li>• Interactive nodes with stage actions (play, pause, reset)</li>
          <li>• Real-time status updates and efficiency scoring</li>
          <li>• Stage filtering and detailed view</li>
          <li>• Bottleneck detection and workflow insights</li>
          <li>• Connection lines showing workflow progression</li>
          <li>• Responsive design with tooltips and hover effects</li>
        </ul>
      </div>
    </div>
  );
};

export default WorkflowVisualizationDemo;