# Quick Start Tutorial

## Overview

Get up and running with Claudia in just 10 minutes! This tutorial will guide you through installation, basic configuration, and creating your first task.

## What You'll Learn

- Installing Claudia
- Starting the dashboard
- Creating and monitoring tasks
- Using the progress monitor
- Handling errors
- Basic API usage

## Prerequisites

Before starting, ensure you have:
- Node.js 14.0 or higher installed
- MongoDB 4.4 or higher running
- A modern web browser
- Basic command line knowledge

## Step 1: Installation (3 minutes)

### 1.1 Clone the Repository

Open your terminal and run:

```bash
git clone https://github.com/claudia/claudia.git
cd claudia
```

### 1.2 Install Dependencies

```bash
npm install
```

### 1.3 Configure Environment

Copy the example configuration:

```bash
cp .env.example .env
```

Edit `.env` with your favorite editor:

```env
# Basic configuration
PORT=3000
NODE_ENV=development

# MongoDB connection
MONGODB_URI=mongodb://localhost:27017/claudia

# Secret key (generate a random string)
SECRET_KEY=your-secret-key-here

# Optional: Redis for caching
# REDIS_URL=redis://localhost:6379
```

## Step 2: Start Claudia (1 minute)

### 2.1 Start the Server

```bash
npm start
```

You should see:

```
[INFO] Starting Claudia...
[INFO] Connected to MongoDB
[INFO] Server running on http://localhost:3000
[INFO] Dashboard available at http://localhost:3000
```

### 2.2 Open the Dashboard

Open your browser and navigate to:
```
http://localhost:3000
```

You should see the Claudia dashboard!

## Step 3: Create Your First Task (2 minutes)

### 3.1 Using the Dashboard

1. Click the **"New Task"** button in the top right
2. Fill in the task details:
   - **Name**: "My First Task"
   - **Type**: "data_processing"
   - **Priority**: "Medium"
   - **Description**: "Testing Claudia task creation"

3. Click **"Create Task"**

### 3.2 Using the API

Alternatively, create a task via API:

```bash
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First API Task",
    "type": "data_processing",
    "priority": "high"
  }'
```

Response:
```json
{
  "id": "task_123abc",
  "name": "My First API Task",
  "status": "pending",
  "createdAt": "2024-12-10T10:00:00Z"
}
```

## Step 4: Monitor Task Progress (2 minutes)

### 4.1 Real-time Progress

1. Navigate to the **"Monitor"** tab in the dashboard
2. You'll see your task with a progress bar
3. Watch as the task progresses from 0% to 100%

### 4.2 Understanding Status Indicators

- 🔵 **Blue (Running)**: Task is actively processing
- 🟡 **Yellow (Pending)**: Task is queued
- 🟢 **Green (Completed)**: Task finished successfully
- 🔴 **Red (Failed)**: Task encountered an error
- ⏸️ **Gray (Paused)**: Task is temporarily suspended

### 4.3 Task Details

Click on any task to see:
- Detailed progress information
- Execution logs
- Resource usage
- Time estimates

## Step 5: Explore Features (2 minutes)

### 5.1 Error Tracking

1. Navigate to the **"Errors"** tab
2. View any errors that occurred
3. Click on an error for:
   - Stack trace
   - Context information
   - Suggested fixes

### 5.2 Task Queue

1. Go to **"Queue"** tab
2. See pending tasks
3. Drag and drop to reorder priorities
4. Batch actions:
   - Select multiple tasks
   - Pause, resume, or cancel in bulk

### 5.3 Analytics Dashboard

1. Click **"Analytics"**
2. View:
   - Task completion rates
   - Average processing times
   - Error frequency
   - System performance

## Your First Script

Create a file `my-first-script.js`:

```javascript
const { ClaudiaClient } = require('@claudia/sdk');

// Initialize client
const claudia = new ClaudiaClient({
  baseUrl: 'http://localhost:3000'
});

async function runExample() {
  try {
    // Create a task
    console.log('Creating task...');
    const task = await claudia.tasks.create({
      name: 'Process User Data',
      type: 'data_processing',
      parameters: {
        inputFile: 'users.csv',
        outputFormat: 'json'
      }
    });
    
    console.log(`Task created with ID: ${task.id}`);
    
    // Monitor progress
    console.log('Monitoring progress...');
    claudia.progress.subscribe(task.id, (update) => {
      console.log(`Progress: ${update.percentage}% - ${update.message}`);
    });
    
    // Wait for completion
    const result = await claudia.tasks.waitForCompletion(task.id);
    console.log('Task completed!', result);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

runExample();
```

Run the script:
```bash
node my-first-script.js
```

## Common Patterns

### Pattern 1: Batch Processing

```javascript
// Process multiple files
const files = ['file1.csv', 'file2.csv', 'file3.csv'];

const tasks = await Promise.all(
  files.map(file => 
    claudia.tasks.create({
      name: `Process ${file}`,
      type: 'data_processing',
      parameters: { file }
    })
  )
);

// Monitor all tasks
tasks.forEach(task => {
  claudia.progress.subscribe(task.id, (update) => {
    console.log(`${task.name}: ${update.percentage}%`);
  });
});
```

### Pattern 2: Error Handling

```javascript
// Robust error handling
try {
  const task = await claudia.tasks.create({
    name: 'Risky Operation',
    type: 'external_api'
  });
  
  const result = await claudia.tasks.waitForCompletion(task.id);
  
} catch (error) {
  // Report to error tracking
  await claudia.errors.report({
    error,
    context: {
      operation: 'risky_operation',
      timestamp: new Date()
    },
    severity: 'high'
  });
  
  // Handle gracefully
  console.error('Operation failed, but error was tracked');
}
```

### Pattern 3: Scheduled Tasks

```javascript
// Schedule a daily backup
const schedule = await claudia.schedules.create({
  name: 'Daily Backup',
  cron: '0 2 * * *', // 2 AM daily
  task: {
    type: 'backup',
    parameters: {
      target: 'database',
      destination: 's3://backups/'
    }
  }
});

console.log(`Scheduled task created: ${schedule.id}`);
```

## What's Next?

Congratulations! You've successfully:
- ✅ Installed and configured Claudia
- ✅ Created your first task
- ✅ Monitored task progress
- ✅ Explored the dashboard
- ✅ Written your first Claudia script

### Next Steps

1. **Read the Full Documentation**
   - [API Reference](../technical/API-Reference.md)
   - [Task Management Guide](./Task-Management-Guide.md)
   - [Error Tracking Guide](./Error-Tracking-Guide.md)

2. **Explore Advanced Features**
   - Multi-agent orchestration
   - Custom task types
   - WebSocket real-time updates
   - Performance optimization

3. **Join the Community**
   - [GitHub Discussions](https://github.com/claudia/discussions)
   - [Discord Server](https://discord.gg/claudia)
   - [Twitter](https://twitter.com/claudiadev)

## Troubleshooting Quick Reference

### Can't connect to MongoDB?
```bash
# Check if MongoDB is running
sudo systemctl status mongod

# Start MongoDB if needed
sudo systemctl start mongod
```

### Port 3000 already in use?
```bash
# Use a different port
PORT=3001 npm start

# Or kill the process using port 3000
lsof -ti:3000 | xargs kill
```

### Dashboard not loading?
1. Check browser console for errors (F12)
2. Try clearing browser cache
3. Verify server is running: `curl http://localhost:3000/health`

## Quick Commands Cheat Sheet

```bash
# Start Claudia
npm start

# Run in development mode
npm run dev

# Run tests
npm test

# Check configuration
npm run check-env

# Database migrations
npm run migrate

# Build for production
npm run build

# Start production server
npm run start:prod
```

## Summary

You've learned the basics of Claudia! In just 10 minutes, you can now:
- Install and configure Claudia
- Create and monitor tasks
- Use the dashboard effectively
- Write scripts using the SDK
- Handle errors properly

Keep exploring, and don't hesitate to check the documentation or ask for help in our community channels!

---
*Happy coding with Claudia! 🚀*  
*Last updated: December 2024*