# ProgressTracker System

A comprehensive real-time progress tracking system for the Claudia chat application, designed to provide visual feedback on task completion, model performance comparison, and session analytics without interfering with the chat interface.

## Features

### 🎯 Core Functionality
- **Real-time Progress Visualization**: Circular progress indicators and timeline charts
- **Model Performance Comparison**: Side-by-side comparison of Claude vs Gemini performance
- **Task Lifecycle Management**: Complete task tracking from start to completion
- **Compact & Collapsible Interface**: Minimal footprint with expandable details
- **Multiple Positioning Options**: Top-right, top-left, bottom-right, bottom-left placement

### 📊 Metrics & Analytics
- **Response Time Tracking**: Average, min, max, and 95th percentile latencies
- **Success Rate Monitoring**: Real-time accuracy and error rate tracking
- **Token Usage Analysis**: Input, output, and total token consumption
- **Session Analytics**: Comprehensive session-level metrics and throughput analysis
- **Historical Data**: Time-series data for performance trends

### 🎨 User Experience
- **Responsive Design**: Adapts to different screen sizes (200-300px width)
- **Auto-collapse**: Configurable auto-hide after inactivity
- **Interactive Charts**: Hover tooltips and clickable elements
- **Model Switching**: Quick toggle between Claude and Gemini
- **Export/Import**: Data persistence and sharing capabilities

## Components

### ProgressTrackerEmbedded
The main component designed for embedding in chat windows.

```tsx
import { ProgressTrackerEmbedded } from '@/components/ProgressTrackerEmbedded';

<ProgressTrackerEmbedded
  position="top-right"
  maxWidth={300}
  minWidth={200}
  data={progressData}
  onModelSwitch={handleModelSwitch}
  onTaskSelect={handleTaskSelect}
  config={{
    autoCollapse: true,
    collapseDelay: 5000,
    showModelComparison: true,
    showPerformanceGraphs: true,
  }}
/>
```

### ChatWindowWithProgressTracker
Integration example showing how to embed the tracker in a chat window.

```tsx
import { ChatWindowWithProgressTracker } from '@/components/ChatWindowWithProgressTracker';

<ChatWindowWithProgressTracker
  session={session}
  initialProjectPath={projectPath}
  onBack={handleBack}
  onProjectSettings={handleProjectSettings}
  onStreamingChange={handleStreamingChange}
/>
```

### ProgressTrackerDemo
Comprehensive demo showcasing all features and configuration options.

```tsx
import { ProgressTrackerDemo } from '@/components/ProgressTrackerDemo';

// Standalone demo component
<ProgressTrackerDemo />
```

## Hooks

### useProgressTracking
The main hook for progress tracking data management.

```tsx
import { useProgressTracking } from '@/hooks/useProgressTracking';

const {
  progressData,
  startTask,
  updateTask,
  completeTask,
  recordModelRequest,
  switchModel,
  exportData,
  importData,
} = useProgressTracking({
  enableRealTime: true,
  updateInterval: 1000,
  historyRetention: 100,
});
```

## Types

### Core Types
- `ProgressData`: Complete progress state structure
- `Task`: Individual task with status, progress, and metadata
- `ModelPerformanceMetrics`: Performance metrics for AI models
- `SessionMetrics`: Session-level analytics

### Configuration
- `ProgressTrackerConfig`: Component configuration options
- `UseProgressTrackingOptions`: Hook configuration options

## Usage Examples

### Basic Integration

```tsx
import React from 'react';
import { ProgressTrackerEmbedded, useProgressTracking } from '@/components';

export const MyComponent = () => {
  const { progressData, startTask, completeTask } = useProgressTracking();

  const handleStartOperation = () => {
    const taskId = startTask({
      name: 'Processing request',
      description: 'Analyzing user input',
      priority: 'high',
      category: 'ai_request',
    });

    // Simulate completion after 3 seconds
    setTimeout(() => completeTask(taskId, true), 3000);
  };

  return (
    <div className="relative">
      <button onClick={handleStartOperation}>Start Task</button>
      
      <ProgressTrackerEmbedded
        data={progressData}
        position="top-right"
      />
    </div>
  );
};
```

### Advanced Configuration

```tsx
const config = {
  position: 'top-right',
  maxWidth: 300,
  minWidth: 200,
  autoCollapse: true,
  collapseDelay: 10000,
  showNotifications: true,
  historyRetention: 100,
  updateInterval: 500,
  showModelComparison: true,
  showPerformanceGraphs: true,
  showSessionHistory: true,
  enableRealTimeUpdates: true,
};

<ProgressTrackerEmbedded
  data={progressData}
  config={config}
  onModelSwitch={handleModelSwitch}
  onTaskSelect={handleTaskSelect}
/>
```

### Model Performance Tracking

```tsx
const trackModelRequest = async (model: 'claude' | 'gemini') => {
  const startTime = Date.now();
  
  try {
    const response = await makeAIRequest(model, prompt);
    const responseTime = Date.now() - startTime;
    
    recordModelRequest(model, responseTime, true, {
      input: prompt.length,
      output: response.length,
      total: prompt.length + response.length,
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    recordModelRequest(model, responseTime, false);
  }
};
```

### Data Export/Import

```tsx
// Export progress data
const exportedData = exportData();
localStorage.setItem('progressData', exportedData);

// Import progress data
const savedData = localStorage.getItem('progressData');
if (savedData) {
  importData(savedData);
}
```

## Styling & Customization

The ProgressTracker uses Tailwind CSS and supports theming through CSS custom properties. Key classes:

- `.progress-tracker-container`: Main container
- `.progress-tracker-expanded`: Expanded state
- `.progress-tracker-collapsed`: Collapsed state
- `.model-switch-claude`: Claude model styling
- `.model-switch-gemini`: Gemini model styling

### Custom Styling

```css
.progress-tracker-container {
  --progress-primary: hsl(var(--primary));
  --progress-success: hsl(var(--success));
  --progress-error: hsl(var(--destructive));
  --progress-warning: hsl(var(--warning));
}
```

## Performance Considerations

### Optimization Features
- **Virtual Scrolling**: Efficient rendering of large task lists
- **Debounced Updates**: Batched state updates to prevent excessive re-renders
- **Memoized Calculations**: Cached computed values for expensive operations
- **Selective Re-rendering**: Only update changed components

### Memory Management
- **History Retention**: Configurable limit on historical data points
- **Automatic Cleanup**: Task cleanup after session completion
- **Lazy Loading**: Charts and graphs loaded only when needed

## Browser Support

- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile Support**: iOS Safari 14+, Android Chrome 90+
- **Features Used**: CSS Grid, Flexbox, CSS Custom Properties, IntersectionObserver

## Accessibility

- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Reader Support**: ARIA labels and descriptions
- **High Contrast**: Supports high contrast mode
- **Reduced Motion**: Respects `prefers-reduced-motion`

## API Reference

### ProgressTrackerEmbedded Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `position` | `'top-right' \| 'top-left' \| 'bottom-right' \| 'bottom-left'` | `'top-right'` | Position in the viewport |
| `maxWidth` | `number` | `300` | Maximum width in pixels |
| `minWidth` | `number` | `200` | Minimum width in pixels |
| `data` | `ProgressData` | - | Progress tracking data |
| `onModelSwitch` | `(model: ModelType) => void` | - | Model switch callback |
| `onTaskSelect` | `(task: Task \| null) => void` | - | Task selection callback |
| `config` | `Partial<ProgressTrackerConfig>` | - | Configuration overrides |

### useProgressTracking Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `updateInterval` | `number` | `1000` | Update interval in milliseconds |
| `enableRealTime` | `boolean` | `true` | Enable real-time updates |
| `historyRetention` | `number` | `100` | Number of historical points to keep |
| `autoStartSession` | `boolean` | `true` | Auto-start session on mount |

## Contributing

1. **Development Setup**:
   ```bash
   npm install
   npm run dev
   ```

2. **Testing**:
   ```bash
   npm run test
   npm run test:e2e
   ```

3. **Building**:
   ```bash
   npm run build
   ```

## License

This project is part of the Claudia chat application and follows the same licensing terms.