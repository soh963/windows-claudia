# Task Visualization System

A comprehensive real-time task progress visualization system for the Claudia application, featuring interactive charts, accessibility support, and seamless integration with existing monitoring systems.

## Features

### 📊 Interactive Charts
- **Line Charts**: Progress over time, performance metrics
- **Bar Charts**: Model comparisons, operation statistics  
- **Pie Charts**: Distribution analysis with donut mode
- **Timeline**: Activity feed with event categorization

### ⚡ Real-Time Updates
- Live data streaming with configurable refresh intervals
- Automatic updates on operation changes
- WebSocket-ready architecture
- Intelligent caching and optimization

### ♿ Accessibility Features
- Screen reader support with ARIA labels
- Keyboard navigation (arrow keys, space, enter)
- High contrast mode support
- Audio descriptions and announcements
- Data table alternatives for charts
- Reduce motion preferences respected

### 📤 Export Capabilities
- PNG/SVG image exports with high quality
- PDF reports with metadata
- CSV/JSON data exports
- Multi-chart combined exports
- Customizable export options

### 🎨 Responsive Design
- Grid and list layout modes
- Fullscreen chart views
- Mobile-optimized interfaces
- Customizable dashboard layouts
- Split-view integration with Progress Tracker

## Quick Start

### Basic Usage

```tsx
import { TaskVisualizationDashboard } from '@/components/TaskVisualization';

function App() {
  return (
    <div className="h-screen">
      <TaskVisualizationDashboard />
    </div>
  );
}
```

### Integrated with Progress Tracker

```tsx
import { IntegratedProgressDashboard } from '@/components/TaskVisualization';

function App() {
  return (
    <div className="h-screen">
      <IntegratedProgressDashboard 
        defaultLayout="split"
        showToggle={true}
      />
    </div>
  );
}
```

### Individual Charts

```tsx
import { LineChart, BarChart, PieChart } from '@/components/TaskVisualization';

function CustomDashboard() {
  const progressData = [
    { id: 'progress', name: 'Task Progress', data: [...] }
  ];
  
  const modelData = [
    { name: 'Claude 4', value: 1500, successRate: 98 },
    { name: 'Gemini 2.5', value: 1200, successRate: 96 }
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      <LineChart 
        data={progressData}
        title="Progress Over Time"
        height={300}
        animated={true}
      />
      <BarChart
        data={modelData}
        title="Model Performance"
        layout="horizontal"
        showValues={true}
      />
    </div>
  );
}
```

### Real-Time Hook

```tsx
import { useRealTimeVisualization } from '@/components/TaskVisualization';

function MyComponent() {
  const { data, isLoading, refresh, isRealTimeEnabled } = useRealTimeVisualization({
    enabled: true,
    updateInterval: 5000,
    onUpdate: (newData) => console.log('Data updated:', newData),
    onError: (error) => console.error('Update failed:', error)
  });

  return (
    <div>
      <button onClick={refresh}>Refresh Data</button>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
```

### Chart Export

```tsx
import { useChartExport } from '@/components/TaskVisualization';

function ExportableChart() {
  const { exportChart, exportData } = useChartExport();
  const chartRef = useRef<HTMLDivElement>(null);

  const handleExport = () => {
    exportChart(chartRef.current, {
      format: 'png',
      chartType: 'performance-chart',
      quality: 1.0,
      includeMetadata: true
    });
  };

  return (
    <div>
      <div ref={chartRef}>
        {/* Your chart component */}
      </div>
      <button onClick={handleExport}>Export as PNG</button>
    </div>
  );
}
```

## Component API

### TaskVisualizationDashboard

Main dashboard component with full visualization suite.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |
| `isFullscreen` | `boolean` | `false` | Fullscreen mode |
| `onToggleFullscreen` | `() => void` | - | Fullscreen toggle handler |

### IntegratedProgressDashboard

Combined progress tracker and visualization dashboard.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |
| `defaultLayout` | `'split' \| 'dashboard-only' \| 'tracker-only'` | `'split'` | Initial layout mode |
| `showToggle` | `boolean` | `true` | Show layout toggle controls |

### LineChart

Time-series line chart component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `ChartData[]` | - | Chart data series |
| `title` | `string` | - | Chart title |
| `height` | `number` | `300` | Chart height in pixels |
| `animated` | `boolean` | `true` | Enable animations |
| `showLegend` | `boolean` | `true` | Show chart legend |
| `colors` | `string[]` | `DEFAULT_COLORS` | Color palette |
| `onExport` | `(options) => void` | - | Export handler |

### BarChart

Horizontal/vertical bar chart component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `BarChartData[]` | - | Chart data |
| `layout` | `'horizontal' \| 'vertical'` | `'vertical'` | Bar orientation |
| `showValues` | `boolean` | `false` | Show values on bars |
| `stacked` | `boolean` | `false` | Enable stacked bars |
| `barSize` | `number` | `40` | Maximum bar size |

### PieChart

Pie/donut chart component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `PieChartData[]` | - | Chart data |
| `donut` | `boolean` | `false` | Donut chart mode |
| `showPercentages` | `boolean` | `true` | Show percentages |
| `innerRadius` | `number` | `0` | Inner radius |
| `outerRadius` | `number` | `80` | Outer radius |

### Timeline

Activity timeline component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `TimelineEvent[]` | - | Timeline events |
| `maxEvents` | `number` | `100` | Maximum events to show |
| `groupBy` | `'day' \| 'hour' \| 'none'` | `'day'` | Event grouping |
| `showFilters` | `boolean` | `true` | Show filter controls |

## Accessibility Features

### Keyboard Navigation
- **Arrow Keys**: Navigate between data points
- **Space**: Announce current data point
- **Enter**: Toggle audio description
- **Home/End**: Jump to first/last data point

### Screen Reader Support
- ARIA labels and descriptions
- Live region announcements
- Structured heading hierarchy
- Alternative data table views

### Visual Accessibility
- High contrast mode support
- Respect for reduced motion preferences
- Focus indicators and keyboard navigation
- Scalable text and UI elements

## Data Integration

The visualization system integrates with Claudia's existing stores:

- **MonitoringStore**: Real-time operation tracking
- **SessionStore**: Session management and metrics
- **ModelHealthStore**: Model performance data
- **ErrorTrackerStore**: Error analysis and tracking

## Configuration

### Visualization Settings

```tsx
import { useVisualizationStore } from '@/lib/stores/visualizationStore';

function Settings() {
  const { settings, setSettings } = useVisualizationStore();
  
  const updateSettings = (newSettings) => {
    setSettings({
      refreshInterval: 5000,     // Update interval in ms
      timeWindow: 60,            // Data time window in minutes
      enableRealTimeUpdates: true,
      chartAnimations: true,
      maxDataPoints: 100,
      colorScheme: 'auto'
    });
  };
}
```

### Export Configuration

```tsx
const exportOptions = {
  format: 'png',           // 'png' | 'svg' | 'pdf' | 'csv' | 'json'
  quality: 1.0,            // Image quality (0-1)
  width: 1200,             // Export width
  height: 800,             // Export height
  includeMetadata: true,   // Include chart metadata
  filename: 'my-chart'     // Custom filename
};
```

## Performance

### Optimization Features
- Intelligent data caching
- Debounced updates
- Virtual scrolling for large datasets
- Lazy loading of chart components
- Memory leak prevention
- Efficient re-rendering strategies

### Memory Management
- Automatic cleanup of old data points
- Configurable data retention limits
- Resource monitoring and alerts
- Garbage collection optimization

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Dependencies

- React 18+
- Recharts 2.5+
- Framer Motion 10+
- date-fns 2.29+
- html-to-image 1.11+
- jsPDF 2.5+
- Zustand 4.3+

## Development

### Adding New Chart Types

1. Create chart component in `src/components/charts/`
2. Implement accessibility features with `AccessibleChart`
3. Add export functionality
4. Update index exports
5. Add to dashboard configuration

### Extending Data Sources

1. Update `visualizationStore.ts` with new data transformers
2. Add real-time update logic in hooks
3. Update TypeScript interfaces
4. Test with existing chart components

## License

This visualization system is part of the Claudia project and follows the project's licensing terms.