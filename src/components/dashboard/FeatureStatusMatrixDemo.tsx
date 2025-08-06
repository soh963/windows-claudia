import React from 'react';
import FeatureStatusMatrix from './FeatureStatusMatrix';
import type { FeatureItem } from '@/lib/api';

// Sample feature data for demonstration
const sampleFeatures: FeatureItem[] = [
  {
    id: 1,
    project_id: 'demo-project',
    name: 'User Authentication',
    description: 'Complete user authentication system with login, registration, and password reset functionality',
    status: 'completed',
    independence_score: 85,
    complexity_score: 65,
    dependencies: JSON.stringify(['user-management', 'security', 'email-service']),
    file_paths: JSON.stringify([
      'src/auth/AuthProvider.tsx',
      'src/auth/LoginForm.tsx',
      'src/auth/RegisterForm.tsx',
      'src/auth/PasswordReset.tsx'
    ]),
    created_at: Math.floor(Date.now() / 1000) - 86400 * 30, // 30 days ago
    updated_at: Math.floor(Date.now() / 1000) - 86400 * 2   // 2 days ago
  },
  {
    id: 2,
    project_id: 'demo-project',
    name: 'Dashboard Analytics',
    description: 'Real-time analytics dashboard with charts, metrics, and data visualization',
    status: 'in_progress',
    independence_score: 70,
    complexity_score: 85,
    dependencies: JSON.stringify(['data-api', 'charting-library', 'real-time-updates']),
    file_paths: JSON.stringify([
      'src/dashboard/AnalyticsDashboard.tsx',
      'src/dashboard/MetricsCards.tsx',
      'src/dashboard/ChartsContainer.tsx'
    ]),
    created_at: Math.floor(Date.now() / 1000) - 86400 * 20, // 20 days ago
    updated_at: Math.floor(Date.now() / 1000) - 86400 * 1   // 1 day ago
  },
  {
    id: 3,
    project_id: 'demo-project',
    name: 'File Upload System',
    description: 'Drag-and-drop file upload with progress tracking and cloud storage integration',
    status: 'planned',
    independence_score: 60,
    complexity_score: 45,
    dependencies: JSON.stringify(['cloud-storage', 'file-validation', 'progress-tracking']),
    file_paths: JSON.stringify([
      'src/upload/FileUploader.tsx',
      'src/upload/ProgressTracker.tsx'
    ]),
    created_at: Math.floor(Date.now() / 1000) - 86400 * 15, // 15 days ago
    updated_at: Math.floor(Date.now() / 1000) - 86400 * 5   // 5 days ago
  },
  {
    id: 4,
    project_id: 'demo-project',
    name: 'Real-time Chat',
    description: 'WebSocket-based real-time chat system with message history and online status',
    status: 'blocked',
    independence_score: 40,
    complexity_score: 90,
    dependencies: JSON.stringify(['websocket-server', 'message-storage', 'user-presence', 'authentication']),
    file_paths: JSON.stringify([
      'src/chat/ChatInterface.tsx',
      'src/chat/MessageList.tsx',
      'src/chat/WebSocketManager.ts'
    ]),
    created_at: Math.floor(Date.now() / 1000) - 86400 * 25, // 25 days ago
    updated_at: Math.floor(Date.now() / 1000) - 86400 * 7   // 7 days ago
  },
  {
    id: 5,
    project_id: 'demo-project',
    name: 'Search Functionality',
    description: 'Full-text search with filters, autocomplete, and advanced query options',
    status: 'in_progress',
    independence_score: 75,
    complexity_score: 55,
    dependencies: JSON.stringify(['search-engine', 'data-indexing']),
    file_paths: JSON.stringify([
      'src/search/SearchBar.tsx',
      'src/search/SearchResults.tsx',
      'src/search/SearchFilters.tsx'
    ]),
    created_at: Math.floor(Date.now() / 1000) - 86400 * 12, // 12 days ago
    updated_at: Math.floor(Date.now() / 1000) - 86400 * 3   // 3 days ago
  },
  {
    id: 6,
    project_id: 'demo-project',
    name: 'Mobile Responsive Design',
    description: 'Complete mobile-first responsive design implementation across all components',
    status: 'pending',
    independence_score: 90,
    complexity_score: 35,
    dependencies: JSON.stringify(['ui-components']),
    file_paths: JSON.stringify([
      'src/styles/responsive.css',
      'src/components/mobile/MobileNavigation.tsx'
    ]),
    created_at: Math.floor(Date.now() / 1000) - 86400 * 8,  // 8 days ago
    updated_at: Math.floor(Date.now() / 1000) - 86400 * 4   // 4 days ago
  },
  {
    id: 7,
    project_id: 'demo-project',
    name: 'API Rate Limiting',
    description: 'Implementation of rate limiting middleware for API endpoints',
    status: 'completed',
    independence_score: 95,
    complexity_score: 25,
    dependencies: JSON.stringify(['express-middleware']),
    file_paths: JSON.stringify([
      'src/middleware/rateLimiter.ts',
      'src/middleware/rateLimitConfig.ts'
    ]),
    created_at: Math.floor(Date.now() / 1000) - 86400 * 18, // 18 days ago
    updated_at: Math.floor(Date.now() / 1000) - 86400 * 10  // 10 days ago
  },
  {
    id: 8,
    project_id: 'demo-project',
    name: 'Notification System',
    description: 'Push notifications and in-app messaging system with user preferences',
    status: 'in_progress',
    independence_score: 50,
    complexity_score: 75,
    dependencies: JSON.stringify(['push-service', 'user-preferences', 'message-queue', 'authentication']),
    file_paths: JSON.stringify([
      'src/notifications/NotificationCenter.tsx',
      'src/notifications/PushService.ts',
      'src/notifications/NotificationSettings.tsx'
    ]),
    created_at: Math.floor(Date.now() / 1000) - 86400 * 14, // 14 days ago
    updated_at: Math.floor(Date.now() / 1000) - 86400 * 1   // 1 day ago
  }
];

interface FeatureStatusMatrixDemoProps {
  loading?: boolean;
}

const FeatureStatusMatrixDemo: React.FC<FeatureStatusMatrixDemoProps> = ({ loading = false }) => {
  const handleFeatureClick = (feature: FeatureItem) => {
    console.log('Demo: Feature clicked', feature);
    // In a real app, this might open a modal or navigate to a detail page
  };

  const handleFeatureUpdate = (feature: FeatureItem) => {
    console.log('Demo: Feature update requested', feature);
    // In a real app, this might trigger an API call to update the feature
  };

  return (
    <FeatureStatusMatrix 
      features={sampleFeatures}
      loading={loading}
      onFeatureClick={handleFeatureClick}
      onFeatureUpdate={handleFeatureUpdate}
    />
  );
};

export default FeatureStatusMatrixDemo;