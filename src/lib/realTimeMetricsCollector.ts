import { api } from './api';
import { HealthMetricsService } from './healthMetricsService';

export interface MetricsCollectionConfig {
  projectId: string;
  projectPath: string;
  intervalMs: number;
  enabledMetrics: string[];
  autoUpdate: boolean;
}

export interface CollectionStatus {
  isRunning: boolean;
  lastCollection: number | null;
  nextCollection: number | null;
  errorCount: number;
  lastError: string | null;
}

export class RealTimeMetricsCollector {
  private static instance: RealTimeMetricsCollector;
  private collections = new Map<string, {
    config: MetricsCollectionConfig;
    intervalId: NodeJS.Timeout | null;
    status: CollectionStatus;
    callbacks: Array<(metrics: any) => void>;
  }>();

  private healthService = HealthMetricsService.getInstance();

  public static getInstance(): RealTimeMetricsCollector {
    if (!RealTimeMetricsCollector.instance) {
      RealTimeMetricsCollector.instance = new RealTimeMetricsCollector();
    }
    return RealTimeMetricsCollector.instance;
  }

  /**
   * Start collecting metrics for a project
   */
  startCollection(config: MetricsCollectionConfig, callback?: (metrics: any) => void): void {
    const { projectId } = config;

    // Stop existing collection if running
    this.stopCollection(projectId);

    const collection = {
      config,
      intervalId: null as NodeJS.Timeout | null,
      status: {
        isRunning: false,
        lastCollection: null,
        nextCollection: null,
        errorCount: 0,
        lastError: null
      } as CollectionStatus,
      callbacks: callback ? [callback] : [] as Array<(metrics: any) => void>
    };

    this.collections.set(projectId, collection);

    if (config.autoUpdate) {
      this.scheduleCollection(projectId);
    }

    console.log(`Started metrics collection for project ${projectId}`);
  }

  /**
   * Stop collecting metrics for a project
   */
  stopCollection(projectId: string): void {
    const collection = this.collections.get(projectId);
    if (collection) {
      if (collection.intervalId) {
        clearInterval(collection.intervalId);
      }
      collection.status.isRunning = false;
      collection.status.nextCollection = null;
      console.log(`Stopped metrics collection for project ${projectId}`);
    }
  }

  /**
   * Add a callback for metrics updates
   */
  addCallback(projectId: string, callback: (metrics: any) => void): void {
    const collection = this.collections.get(projectId);
    if (collection) {
      collection.callbacks.push(callback);
    }
  }

  /**
   * Remove a callback
   */
  removeCallback(projectId: string, callback: (metrics: any) => void): void {
    const collection = this.collections.get(projectId);
    if (collection) {
      const index = collection.callbacks.indexOf(callback);
      if (index > -1) {
        collection.callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Get collection status for a project
   */
  getStatus(projectId: string): CollectionStatus | null {
    const collection = this.collections.get(projectId);
    return collection ? { ...collection.status } : null;
  }

  /**
   * Manually trigger collection for a project
   */
  async triggerCollection(projectId: string): Promise<void> {
    const collection = this.collections.get(projectId);
    if (!collection) {
      throw new Error(`No collection configured for project ${projectId}`);
    }

    await this.collectMetrics(projectId);
  }

  /**
   * Update collection configuration
   */
  updateConfig(projectId: string, config: Partial<MetricsCollectionConfig>): void {
    const collection = this.collections.get(projectId);
    if (collection) {
      collection.config = { ...collection.config, ...config };
      
      // Reschedule if interval changed and auto-update is enabled
      if (config.intervalMs && collection.config.autoUpdate) {
        this.scheduleCollection(projectId);
      }
    }
  }

  /**
   * Get all active collections
   */
  getActiveCollections(): string[] {
    return Array.from(this.collections.keys()).filter(projectId => {
      const collection = this.collections.get(projectId);
      return collection?.status.isRunning;
    });
  }

  /**
   * Stop all collections
   */
  stopAllCollections(): void {
    for (const projectId of this.collections.keys()) {
      this.stopCollection(projectId);
    }
  }

  /**
   * Schedule the next collection
   */
  private scheduleCollection(projectId: string): void {
    const collection = this.collections.get(projectId);
    if (!collection) return;

    // Clear existing interval
    if (collection.intervalId) {
      clearInterval(collection.intervalId);
    }

    collection.status.isRunning = true;
    collection.status.nextCollection = Date.now() + collection.config.intervalMs;

    collection.intervalId = setInterval(async () => {
      await this.collectMetrics(projectId);
    }, collection.config.intervalMs);

    // Run initial collection
    this.collectMetrics(projectId);
  }

  /**
   * Collect metrics for a project
   */
  private async collectMetrics(projectId: string): Promise<void> {
    const collection = this.collections.get(projectId);
    if (!collection) return;

    try {
      collection.status.lastCollection = Date.now();
      collection.status.nextCollection = collection.config.autoUpdate 
        ? Date.now() + collection.config.intervalMs 
        : null;

      // Clear cache to force fresh data
      this.healthService.clearCache(projectId);

      // Collect enhanced metrics
      const metrics = await this.healthService.getEnhancedHealthMetrics(
        collection.config.projectId,
        collection.config.projectPath
      );

      // Update dashboard data in background
      try {
        await api.dashboardAnalyzeProject(collection.config.projectId, collection.config.projectPath);
      } catch (error) {
        console.warn('Background dashboard analysis failed:', error);
      }

      // Notify all callbacks
      collection.callbacks.forEach(callback => {
        try {
          callback(metrics);
        } catch (error) {
          console.error('Metrics callback error:', error);
        }
      });

      // Reset error count on success
      collection.status.errorCount = 0;
      collection.status.lastError = null;

      console.log(`Collected metrics for project ${projectId}`);
    } catch (error) {
      collection.status.errorCount++;
      collection.status.lastError = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`Failed to collect metrics for project ${projectId}:`, error);

      // Stop collection after too many errors
      if (collection.status.errorCount >= 5) {
        console.warn(`Too many errors, stopping collection for project ${projectId}`);
        this.stopCollection(projectId);
      }
    }
  }

  /**
   * Create a default configuration
   */
  static createDefaultConfig(projectId: string, projectPath: string): MetricsCollectionConfig {
    return {
      projectId,
      projectPath,
      intervalMs: 5 * 60 * 1000, // 5 minutes
      enabledMetrics: ['code_quality', 'test_coverage', 'performance', 'security', 'maintainability'],
      autoUpdate: false
    };
  }

  /**
   * Get metrics collection presets
   */
  static getPresets(): Record<string, Partial<MetricsCollectionConfig>> {
    return {
      development: {
        intervalMs: 2 * 60 * 1000, // 2 minutes
        autoUpdate: true,
        enabledMetrics: ['code_quality', 'test_coverage', 'performance']
      },
      production: {
        intervalMs: 15 * 60 * 1000, // 15 minutes
        autoUpdate: true,
        enabledMetrics: ['security', 'performance', 'maintainability']
      },
      'quality-focused': {
        intervalMs: 5 * 60 * 1000, // 5 minutes
        autoUpdate: true,
        enabledMetrics: ['code_quality', 'test_coverage', 'maintainability']
      },
      minimal: {
        intervalMs: 10 * 60 * 1000, // 10 minutes
        autoUpdate: false,
        enabledMetrics: ['security', 'performance']
      }
    };
  }
}

export default RealTimeMetricsCollector;