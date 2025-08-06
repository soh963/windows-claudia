# Frontend Component Library

## Overview

The Claudia Frontend Component Library provides a comprehensive set of React components for building modern, accessible, and performant user interfaces. All components follow consistent design patterns and are fully typed with TypeScript.

## Table of Contents

1. [Installation](#installation)
2. [Core Components](#core-components)
3. [Layout Components](#layout-components)
4. [Form Components](#form-components)
5. [Data Display](#data-display)
6. [Progress & Feedback](#progress--feedback)
7. [Navigation](#navigation)
8. [Utilities](#utilities)
9. [Theming](#theming)
10. [Accessibility](#accessibility)
11. [Performance](#performance)
12. [Examples](#examples)

## Installation

```bash
# npm
npm install @claudia/ui-components

# yarn
yarn add @claudia/ui-components

# pnpm
pnpm add @claudia/ui-components
```

### Basic Setup

```jsx
import { ThemeProvider, Button } from '@claudia/ui-components';
import '@claudia/ui-components/styles.css';

function App() {
  return (
    <ThemeProvider>
      <Button variant="primary">Click me</Button>
    </ThemeProvider>
  );
}
```

## Core Components

### Button

Versatile button component with multiple variants and states.

```tsx
import { Button } from '@claudia/ui-components';

// Props
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  onClick?: (event: React.MouseEvent) => void;
  children: React.ReactNode;
}

// Usage
<Button variant="primary" size="lg" icon={<SaveIcon />}>
  Save Changes
</Button>

<Button variant="danger" loading>
  Deleting...
</Button>

<Button variant="ghost" fullWidth>
  Cancel
</Button>
```

### Card

Container component for grouping related content.

```tsx
import { Card } from '@claudia/ui-components';

// Props
interface CardProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  hoverable?: boolean;
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

// Usage
<Card 
  title="Task Summary"
  subtitle="Last 24 hours"
  actions={<Button size="sm">View All</Button>}
  footer={<span>Updated 5 min ago</span>}
>
  <p>15 tasks completed</p>
  <p>3 tasks in progress</p>
</Card>
```

### Modal

Accessible modal dialog component.

```tsx
import { Modal } from '@claudia/ui-components';

// Props
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

// Usage
<Modal
  isOpen={isOpen}
  onClose={handleClose}
  title="Confirm Action"
  footer={
    <>
      <Button variant="ghost" onClick={handleClose}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleConfirm}>
        Confirm
      </Button>
    </>
  }
>
  <p>Are you sure you want to proceed?</p>
</Modal>
```

## Layout Components

### Grid

Responsive grid system based on CSS Grid.

```tsx
import { Grid, GridItem } from '@claudia/ui-components';

// Props
interface GridProps {
  columns?: number | { sm?: number; md?: number; lg?: number; xl?: number };
  gap?: number | string;
  alignItems?: 'start' | 'center' | 'end' | 'stretch';
  justifyItems?: 'start' | 'center' | 'end' | 'stretch';
}

// Usage
<Grid columns={{ sm: 1, md: 2, lg: 3 }} gap={16}>
  <GridItem>
    <Card>Item 1</Card>
  </GridItem>
  <GridItem colSpan={{ md: 2 }}>
    <Card>Item 2 - Spans 2 columns on medium screens</Card>
  </GridItem>
  <GridItem>
    <Card>Item 3</Card>
  </GridItem>
</Grid>
```

### Flex

Flexible box layout component.

```tsx
import { Flex } from '@claudia/ui-components';

// Props
interface FlexProps {
  direction?: 'row' | 'column';
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  wrap?: boolean;
  gap?: number | string;
}

// Usage
<Flex justify="between" align="center">
  <h2>Dashboard</h2>
  <Button>Add New</Button>
</Flex>
```

### Container

Responsive container with max-width constraints.

```tsx
import { Container } from '@claudia/ui-components';

// Props
interface ContainerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  padding?: boolean;
  center?: boolean;
}

// Usage
<Container size="lg" padding>
  <h1>Welcome to Claudia</h1>
  <p>Your AI-powered development assistant</p>
</Container>
```

## Form Components

### Input

Text input component with validation support.

```tsx
import { Input } from '@claudia/ui-components';

// Props
interface InputProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}

// Usage
<Input
  label="Email Address"
  type="email"
  value={email}
  onChange={setEmail}
  error={emailError}
  helperText="We'll never share your email"
  required
/>
```

### Select

Dropdown select component.

```tsx
import { Select } from '@claudia/ui-components';

// Props
interface SelectProps<T> {
  label?: string;
  options: Array<{ value: T; label: string; disabled?: boolean }>;
  value: T;
  onChange: (value: T) => void;
  placeholder?: string;
  error?: string;
  multiple?: boolean;
}

// Usage
<Select
  label="Priority"
  options={[
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' }
  ]}
  value={priority}
  onChange={setPriority}
  placeholder="Select priority"
/>
```

### Checkbox

Checkbox component with label.

```tsx
import { Checkbox } from '@claudia/ui-components';

// Usage
<Checkbox
  label="I agree to the terms and conditions"
  checked={agreed}
  onChange={setAgreed}
  required
/>
```

### Form

Form wrapper with validation.

```tsx
import { Form, FormField } from '@claudia/ui-components';

// Usage
<Form onSubmit={handleSubmit}>
  <FormField name="username" label="Username" required>
    <Input />
  </FormField>
  
  <FormField name="role" label="Role">
    <Select options={roleOptions} />
  </FormField>
  
  <Button type="submit" variant="primary">
    Submit
  </Button>
</Form>
```

## Data Display

### Table

Data table with sorting, filtering, and pagination.

```tsx
import { Table } from '@claudia/ui-components';

// Props
interface TableProps<T> {
  columns: Array<{
    key: keyof T;
    header: string;
    sortable?: boolean;
    render?: (value: any, row: T) => React.ReactNode;
  }>;
  data: T[];
  onSort?: (key: keyof T, direction: 'asc' | 'desc') => void;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  loading?: boolean;
}

// Usage
<Table
  columns={[
    { key: 'name', header: 'Name', sortable: true },
    { key: 'status', header: 'Status', render: (status) => (
      <Badge variant={status === 'active' ? 'success' : 'default'}>
        {status}
      </Badge>
    )},
    { key: 'date', header: 'Created', sortable: true }
  ]}
  data={tasks}
  onSort={handleSort}
  onRowClick={handleRowClick}
  selectable
/>
```

### List

Flexible list component.

```tsx
import { List, ListItem } from '@claudia/ui-components';

// Usage
<List>
  <ListItem
    title="Task 1"
    subtitle="Due tomorrow"
    icon={<TaskIcon />}
    actions={<Button size="sm">Edit</Button>}
  />
  <ListItem
    title="Task 2"
    subtitle="In progress"
    icon={<TaskIcon />}
    selected
  />
</List>
```

### Badge

Status indicator badge.

```tsx
import { Badge } from '@claudia/ui-components';

// Props
interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  dot?: boolean;
}

// Usage
<Badge variant="success">Active</Badge>
<Badge variant="warning" dot>Pending</Badge>
<Badge variant="danger" size="sm">3</Badge>
```

## Progress & Feedback

### ProgressBar

Visual progress indicator.

```tsx
import { ProgressBar } from '@claudia/ui-components';

// Props
interface ProgressBarProps {
  value: number;
  max?: number;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animated?: boolean;
}

// Usage
<ProgressBar 
  value={75} 
  variant="success" 
  showLabel 
  animated 
/>
```

### Spinner

Loading spinner component.

```tsx
import { Spinner } from '@claudia/ui-components';

// Usage
<Spinner size="lg" />
<Spinner size="sm" color="primary" />
```

### Toast

Toast notification system.

```tsx
import { useToast } from '@claudia/ui-components';

// Usage
function MyComponent() {
  const toast = useToast();
  
  const handleSuccess = () => {
    toast.success('Operation completed successfully!');
  };
  
  const handleError = () => {
    toast.error('Something went wrong', {
      duration: 5000,
      action: {
        label: 'Retry',
        onClick: () => console.log('Retry clicked')
      }
    });
  };
  
  return (
    <>
      <Button onClick={handleSuccess}>Show Success</Button>
      <Button onClick={handleError}>Show Error</Button>
    </>
  );
}
```

### Alert

Inline alert messages.

```tsx
import { Alert } from '@claudia/ui-components';

// Usage
<Alert variant="info" dismissible onDismiss={handleDismiss}>
  <strong>Note:</strong> This feature is in beta.
</Alert>

<Alert variant="error" icon={<ErrorIcon />}>
  Failed to save changes. Please try again.
</Alert>
```

## Navigation

### Tabs

Tab navigation component.

```tsx
import { Tabs, TabList, Tab, TabPanels, TabPanel } from '@claudia/ui-components';

// Usage
<Tabs defaultValue="overview" onChange={handleTabChange}>
  <TabList>
    <Tab value="overview">Overview</Tab>
    <Tab value="details">Details</Tab>
    <Tab value="settings">Settings</Tab>
  </TabList>
  
  <TabPanels>
    <TabPanel value="overview">
      <p>Overview content</p>
    </TabPanel>
    <TabPanel value="details">
      <p>Details content</p>
    </TabPanel>
    <TabPanel value="settings">
      <p>Settings content</p>
    </TabPanel>
  </TabPanels>
</Tabs>
```

### Breadcrumb

Breadcrumb navigation.

```tsx
import { Breadcrumb, BreadcrumbItem } from '@claudia/ui-components';

// Usage
<Breadcrumb>
  <BreadcrumbItem href="/">Home</BreadcrumbItem>
  <BreadcrumbItem href="/projects">Projects</BreadcrumbItem>
  <BreadcrumbItem current>Dashboard</BreadcrumbItem>
</Breadcrumb>
```

### Pagination

Pagination component.

```tsx
import { Pagination } from '@claudia/ui-components';

// Usage
<Pagination
  currentPage={page}
  totalPages={10}
  onPageChange={setPage}
  showFirstLast
  showPageNumbers
/>
```

## Utilities

### Tooltip

Tooltip component for additional information.

```tsx
import { Tooltip } from '@claudia/ui-components';

// Usage
<Tooltip content="This action cannot be undone">
  <Button variant="danger">Delete</Button>
</Tooltip>
```

### Popover

Popover for more complex content.

```tsx
import { Popover } from '@claudia/ui-components';

// Usage
<Popover
  trigger={<Button>More Options</Button>}
  content={
    <div>
      <p>Additional options</p>
      <Button size="sm">Action 1</Button>
      <Button size="sm">Action 2</Button>
    </div>
  }
  placement="bottom"
/>
```

### Portal

Render content outside the DOM hierarchy.

```tsx
import { Portal } from '@claudia/ui-components';

// Usage
<Portal>
  <div className="fixed-notification">
    This renders at the document body level
  </div>
</Portal>
```

## Theming

### Theme Provider

Configure global theme settings.

```tsx
import { ThemeProvider, createTheme } from '@claudia/ui-components';

const customTheme = createTheme({
  colors: {
    primary: '#007bff',
    secondary: '#6c757d',
    success: '#28a745',
    danger: '#dc3545',
    warning: '#ffc107',
    info: '#17a2b8'
  },
  typography: {
    fontFamily: 'Inter, sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem'
    }
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem'
  }
});

// Usage
<ThemeProvider theme={customTheme}>
  <App />
</ThemeProvider>
```

### Dark Mode

Built-in dark mode support.

```tsx
import { useTheme } from '@claudia/ui-components';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  
  return (
    <Button
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </Button>
  );
}
```

## Accessibility

All components follow WCAG 2.1 AA standards:

- **Keyboard Navigation**: Full keyboard support
- **Screen Reader Support**: Proper ARIA labels and announcements
- **Focus Management**: Clear focus indicators
- **Color Contrast**: Meets contrast requirements
- **Motion Preferences**: Respects `prefers-reduced-motion`

### Accessibility Features

```tsx
// Skip to content link
<SkipToContent href="#main-content" />

// Announce dynamic content
<LiveRegion>
  {message && <p>{message}</p>}
</LiveRegion>

// Focus trap for modals
<FocusTrap active={isModalOpen}>
  <Modal>...</Modal>
</FocusTrap>
```

## Performance

### Code Splitting

Components support dynamic imports:

```tsx
const Modal = lazy(() => import('@claudia/ui-components/Modal'));

function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Modal />
    </Suspense>
  );
}
```

### Tree Shaking

Import only what you need:

```tsx
// Good - only imports Button
import { Button } from '@claudia/ui-components';

// Avoid - imports entire library
import * as UI from '@claudia/ui-components';
```

### Memoization

Components are optimized with React.memo:

```tsx
// Heavy computation component
const ExpensiveList = memo(({ items }) => {
  return items.map(item => <ListItem key={item.id} {...item} />);
});
```

## Examples

### Complete Form Example

```tsx
import { 
  Form, 
  FormField, 
  Input, 
  Select, 
  Checkbox, 
  Button,
  Card 
} from '@claudia/ui-components';

function TaskForm() {
  const [formData, setFormData] = useState({
    name: '',
    priority: 'medium',
    assignee: '',
    notifyOnComplete: false
  });
  
  const handleSubmit = (data) => {
    console.log('Form submitted:', data);
  };
  
  return (
    <Card title="Create New Task">
      <Form onSubmit={handleSubmit}>
        <FormField name="name" label="Task Name" required>
          <Input
            value={formData.name}
            onChange={(value) => setFormData({ ...formData, name: value })}
            placeholder="Enter task name"
          />
        </FormField>
        
        <FormField name="priority" label="Priority">
          <Select
            value={formData.priority}
            onChange={(value) => setFormData({ ...formData, priority: value })}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' }
            ]}
          />
        </FormField>
        
        <FormField name="assignee" label="Assignee">
          <Input
            value={formData.assignee}
            onChange={(value) => setFormData({ ...formData, assignee: value })}
            placeholder="Enter assignee email"
          />
        </FormField>
        
        <Checkbox
          label="Notify on completion"
          checked={formData.notifyOnComplete}
          onChange={(checked) => setFormData({ ...formData, notifyOnComplete: checked })}
        />
        
        <Flex gap={8} justify="end">
          <Button variant="ghost">Cancel</Button>
          <Button type="submit" variant="primary">Create Task</Button>
        </Flex>
      </Form>
    </Card>
  );
}
```

### Dashboard Layout Example

```tsx
import { 
  Container, 
  Grid, 
  Card, 
  ProgressBar,
  Badge,
  Table 
} from '@claudia/ui-components';

function Dashboard() {
  return (
    <Container size="xl" padding>
      <h1>Dashboard</h1>
      
      <Grid columns={{ sm: 1, md: 2, lg: 4 }} gap={16}>
        <Card title="Total Tasks" subtitle="All time">
          <h2>1,234</h2>
          <Badge variant="success">+12%</Badge>
        </Card>
        
        <Card title="In Progress" subtitle="Current">
          <h2>45</h2>
          <ProgressBar value={45} max={100} size="sm" />
        </Card>
        
        <Card title="Completed Today" subtitle="Last 24h">
          <h2>89</h2>
          <Badge variant="info">On track</Badge>
        </Card>
        
        <Card title="Error Rate" subtitle="Last hour">
          <h2>0.3%</h2>
          <Badge variant="warning">Needs attention</Badge>
        </Card>
      </Grid>
      
      <Card title="Recent Tasks">
        <Table
          columns={[
            { key: 'name', header: 'Task' },
            { key: 'status', header: 'Status' },
            { key: 'assignee', header: 'Assignee' },
            { key: 'progress', header: 'Progress' }
          ]}
          data={recentTasks}
        />
      </Card>
    </Container>
  );
}
```

## Conclusion

The Claudia Frontend Component Library provides everything needed to build modern, accessible, and performant user interfaces. For more information:

- [Component Storybook](https://storybook.claudia.dev)
- [Design System](../standards/UI-UX-Guidelines.md)
- [Contributing Guide](../developer/Contributing-Guide.md)

---
*Version: 1.0.0*  
*Last updated: December 2024*