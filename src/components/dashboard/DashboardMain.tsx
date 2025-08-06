import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, RefreshCw, BarChart3, Database } from 'lucide-react';
import { api } from '@/lib/api';
import type { DashboardSummary } from '@/lib/api';
import { SkeletonDashboard } from '@/components/ui/skeleton';
import { dashboardVariants, pageVariants, pageTransition, buttonVariants } from '@/lib/animations';
import { performanceMonitor, measureAsync } from '@/lib/performance';

// Import all dashboard components
import { HealthMetrics } from './HealthMetrics';
import { EnhancedHealthMetrics } from './EnhancedHealthMetrics';
import CompletionStatus from './CompletionStatus';
import FeatureIndependence from './FeatureIndependence';
import FeatureStatusMatrix from './FeatureStatusMatrix';
import AIAnalytics from './AIAnalytics';
import RiskAssessment from './RiskAssessment';
import DocumentationStatus from './DocumentationStatus';
import WorkflowVisualization from './WorkflowVisualization';
import ProjectGoals from './ProjectGoals';

interface DashboardMainProps {
  projectId: string;
  projectPath: string;
  onBack: () => void;
}

function DashboardMain({ projectId, projectPath, onBack }: DashboardMainProps) {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchDashboardData = async () => {
    try {
      const { result: summary } = await measureAsync(
        'dashboard:fetchSummary',
        () => api.dashboardGetSummary(projectId),
        { projectId }
      );
      
      setData(summary);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      
      // Try to auto-seed data if the project exists but has no dashboard data
      try {
        await api.dashboardSeedData(projectId);
        
        // Retry fetching after seeding
        const { result: summary } = await measureAsync(
          'dashboard:fetchSummaryAfterSeed',
          () => api.dashboardGetSummary(projectId),
          { projectId }
        );
        
        setData(summary);
      } catch (seedError) {
        console.error('Failed to seed and fetch dashboard data:', seedError);
        // Set null to prevent errors, but log the issue
        setData(null);
        
        // Show user-friendly error message
        if (typeof window !== 'undefined' && 'showToast' in window) {
          (window as any).showToast({
            title: "Dashboard Data Error",
            description: "Unable to load dashboard data. Click 'Seed Data' to initialize.",
            variant: "destructive"
          });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    performanceMonitor.startTiming('dashboard:initialLoad');
    fetchDashboardData().finally(() => {
      performanceMonitor.endTiming('dashboard:initialLoad');
    });
  }, [projectId]);

  const handleRefresh = async () => {
    setLoading(true);
    await fetchDashboardData();
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      await measureAsync(
        'dashboard:analyzeProject',
        () => api.dashboardAnalyzeProject(projectId, projectPath),
        { projectId, projectPath }
      );
      // Analysis completed successfully
      // Refresh data after analysis
      await fetchDashboardData();
    } catch (error) {
      console.error('Failed to analyze project:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSeedData = async () => {
    setLoading(true);
    try {
      await measureAsync(
        'dashboard:seedData',
        () => api.dashboardSeedData(projectId),
        { projectId }
      );
      // Show success message (assuming you have a toast system)
      // Seeded successfully
      // Refresh the data
      await fetchDashboardData();
    } catch (error) {
      console.error('Failed to seed data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <motion.div 
        className="h-full p-4"
        initial="hidden"
        animate="show"
        variants={dashboardVariants.container}
      >
        <SkeletonDashboard />
      </motion.div>
    );
  }

  return (
    <motion.div 
      className="h-full flex flex-col"
      variants={pageVariants}
      initial="initial"
      animate="in"
      exit="out"
      transition={pageTransition}
    >
      {/* Header */}
      <motion.div 
        className="flex items-center justify-between p-4 border-b bg-background/80 backdrop-blur-sm"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-4">
          <motion.div
            variants={buttonVariants}
            whileHover="hover"
            whileTap="tap"
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="text-2xl font-bold">Project Dashboard</h1>
            <p className="text-sm text-muted-foreground">{projectPath}</p>
          </motion.div>
        </div>
        <motion.div 
          className="flex items-center gap-2"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeedData}
              disabled={loading}
            >
              <Database className="h-4 w-4 mr-2" />
              Seed Data
            </Button>
          </motion.div>
          <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAnalyze}
              disabled={analyzing}
            >
              <AnimatePresence mode="sync">
                {analyzing ? (
                  <motion.div
                    key="analyzing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center"
                  >
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </motion.div>
                ) : (
                  <motion.div
                    key="analyze"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center"
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Analyze
                  </motion.div>
                )}
              </AnimatePresence>
            </Button>
          </motion.div>
          <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Main Content */}
      <motion.div 
        className="flex-1 overflow-y-auto p-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <TabsList className="grid w-full grid-cols-6 mb-6">
              <TabsTrigger value="overview" className="relative">
                Overview
                {activeTab === 'overview' && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    layoutId="activeTab"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </TabsTrigger>
              <TabsTrigger value="features" className="relative">
                Features
                {activeTab === 'features' && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    layoutId="activeTab"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </TabsTrigger>
              <TabsTrigger value="matrix" className="relative">
                Matrix
                {activeTab === 'matrix' && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    layoutId="activeTab"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </TabsTrigger>
              <TabsTrigger value="quality" className="relative">
                Quality
                {activeTab === 'quality' && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    layoutId="activeTab"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </TabsTrigger>
              <TabsTrigger value="workflow" className="relative">
                Workflow
                {activeTab === 'workflow' && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    layoutId="activeTab"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </TabsTrigger>
              <TabsTrigger value="ai" className="relative">
                AI Usage
                {activeTab === 'ai' && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    layoutId="activeTab"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </TabsTrigger>
            </TabsList>
          </motion.div>

          <AnimatePresence mode="sync">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <TabsContent value="overview" className="space-y-4">
                <motion.div 
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  variants={dashboardVariants.container}
                  initial="hidden"
                  animate="show"
                >
                  <motion.div variants={dashboardVariants.item}>
                    <ProjectGoals goals={data?.project_goals} loading={loading} />
                  </motion.div>
                  <motion.div variants={dashboardVariants.item}>
                    <CompletionStatus 
                      goals={data?.project_goals} 
                      workflowStages={data?.workflow_stages || []} 
                      loading={loading} 
                    />
                  </motion.div>
                </motion.div>
                <motion.div variants={dashboardVariants.item}>
                  <EnhancedHealthMetrics 
                    projectId={projectId} 
                    projectPath={projectPath} 
                    loading={loading}
                    onRefresh={handleRefresh}
                  />
                </motion.div>
                <motion.div variants={dashboardVariants.item}>
                  <RiskAssessment 
                    risks={data?.risk_items || []} 
                    loading={loading}
                    compact={true}
                    onRefresh={handleRefresh}
                    realTimeUpdates={true}
                  />
                </motion.div>
              </TabsContent>

              <TabsContent value="features" className="space-y-4">
                <motion.div variants={dashboardVariants.item}>
                  <FeatureIndependence features={data?.feature_status || []} loading={loading} />
                </motion.div>
              </TabsContent>

              <TabsContent value="matrix" className="space-y-4">
                <motion.div variants={dashboardVariants.item}>
                  <FeatureStatusMatrix 
                    features={data?.feature_status || []} 
                    loading={loading}
                    onFeatureClick={(feature) => {
                      console.log('Feature clicked:', feature);
                      // Handle feature click - could open a detail modal or navigate
                    }}
                    onFeatureUpdate={(feature) => {
                      console.log('Feature update requested:', feature);
                      // Handle feature update - could trigger a refresh or update state
                      handleRefresh();
                    }}
                  />
                </motion.div>
              </TabsContent>

              <TabsContent value="quality" className="space-y-4">
                <motion.div 
                  className="space-y-4"
                  variants={dashboardVariants.container}
                  initial="hidden"
                  animate="show"
                >
                  <motion.div variants={dashboardVariants.item}>
                    <EnhancedHealthMetrics 
                      projectId={projectId} 
                      projectPath={projectPath} 
                      loading={loading}
                      onRefresh={handleRefresh}
                    />
                  </motion.div>
                  <motion.div variants={dashboardVariants.item}>
                    <DocumentationStatus 
                      docs={data?.documentation_status || []} 
                      loading={loading}
                      compact={false}
                      onRefresh={handleRefresh}
                      showFilters={true}
                    />
                  </motion.div>
                  <motion.div variants={dashboardVariants.item}>
                    <RiskAssessment 
                      risks={data?.risk_items || []} 
                      loading={loading}
                      compact={false}
                      onRefresh={handleRefresh}
                      realTimeUpdates={true}
                    />
                  </motion.div>
                </motion.div>
              </TabsContent>

              <TabsContent value="workflow" className="space-y-4">
                <motion.div variants={dashboardVariants.item}>
                  <WorkflowVisualization stages={data?.workflow_stages || []} loading={loading} />
                </motion.div>
              </TabsContent>

              <TabsContent value="ai" className="space-y-4">
                <motion.div variants={dashboardVariants.item}>
                  <AIAnalytics usage={data?.ai_usage || []} loading={loading} />
                </motion.div>
              </TabsContent>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </motion.div>
    </motion.div>
  );
}

export default DashboardMain;