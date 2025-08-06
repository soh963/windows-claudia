# Claudia API Reference

## Overview

The Claudia API provides comprehensive programmatic access to all Claudia features. This reference documents all available endpoints, request/response formats, authentication, and best practices.

## Table of Contents

1. [Authentication](#authentication)
2. [Base Configuration](#base-configuration)
3. [Core Endpoints](#core-endpoints)
4. [Task Management API](#task-management-api)
5. [Progress Monitoring API](#progress-monitoring-api)
6. [Error Tracking API](#error-tracking-api)
7. [Agent Management API](#agent-management-api)
8. [WebSocket APIs](#websocket-apis)
9. [Rate Limiting](#rate-limiting)
10. [Error Responses](#error-responses)
11. [Versioning](#versioning)
12. [SDK Usage](#sdk-usage)

## Authentication

### API Key Authentication

```bash
# Header authentication
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.claudia.dev/v1/tasks

# Query parameter authentication (not recommended)
curl https://api.claudia.dev/v1/tasks?api_key=YOUR_API_KEY
```

### OAuth 2.0

```javascript
// OAuth flow
const oauth = {
  authorizationUrl: 'https://auth.claudia.dev/authorize',
  tokenUrl: 'https://auth.claudia.dev/token',
  clientId: 'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
  redirectUri: 'https://your-app.com/callback',
  scope: 'read write admin'
};
```

### JWT Authentication

```javascript
// JWT payload structure
{
  "sub": "user123",
  "iat": 1702224000,
  "exp": 1702227600,
  "scope": ["read", "write"],
  "tenant": "org456"
}
```

## Base Configuration

### Base URLs

```
Production: https://api.claudia.dev/v1
Staging: https://staging-api.claudia.dev/v1
Development: http://localhost:3000/api/v1
```

### Request Headers

```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer YOUR_API_KEY
X-Request-ID: unique-request-id
X-Client-Version: 1.0.0
```

### Response Headers

```http
Content-Type: application/json
X-Request-ID: unique-request-id
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1702228800
```

## Core Endpoints

### Health Check

```http
GET /health

Response 200:
{
  "status": "healthy",
  "version": "1.2.3",
  "timestamp": "2024-12-10T10:00:00Z",
  "services": {
    "database": "connected",
    "cache": "connected",
    "queue": "connected"
  }
}
```

### System Status

```http
GET /status

Response 200:
{
  "operational": true,
  "uptime": 864000,
  "metrics": {
    "requests_per_minute": 1250,
    "average_response_time": 45,
    "active_connections": 324
  }
}
```

## Task Management API

### Create Task

```http
POST /tasks
{
  "name": "Process Data",
  "description": "Process user data export",
  "type": "data_processing",
  "priority": "high",
  "parameters": {
    "userId": "user123",
    "format": "csv"
  },
  "metadata": {
    "department": "analytics",
    "requestor": "john.doe"
  }
}

Response 201:
{
  "id": "task_abc123",
  "name": "Process Data",
  "status": "pending",
  "createdAt": "2024-12-10T10:00:00Z",
  "estimatedDuration": 300000,
  "queuePosition": 5
}
```

### Get Task

```http
GET /tasks/{taskId}

Response 200:
{
  "id": "task_abc123",
  "name": "Process Data",
  "description": "Process user data export",
  "status": "in_progress",
  "progress": 45,
  "startedAt": "2024-12-10T10:05:00Z",
  "estimatedCompletion": "2024-12-10T10:10:00Z",
  "logs": [
    {
      "timestamp": "2024-12-10T10:05:00Z",
      "level": "info",
      "message": "Task started"
    }
  ]
}
```

### Update Task

```http
PATCH /tasks/{taskId}
{
  "status": "paused",
  "metadata": {
    "pauseReason": "Resource constraints"
  }
}

Response 200:
{
  "id": "task_abc123",
  "status": "paused",
  "updatedAt": "2024-12-10T10:07:00Z"
}
```

### Cancel Task

```http
DELETE /tasks/{taskId}

Response 200:
{
  "id": "task_abc123",
  "status": "cancelled",
  "cancelledAt": "2024-12-10T10:08:00Z"
}
```

### List Tasks

```http
GET /tasks?status=in_progress&priority=high&limit=20&offset=0

Response 200:
{
  "tasks": [
    {
      "id": "task_abc123",
      "name": "Process Data",
      "status": "in_progress",
      "progress": 45,
      "priority": "high",
      "createdAt": "2024-12-10T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 156,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

### Batch Operations

```http
POST /tasks/batch
{
  "operation": "cancel",
  "taskIds": ["task_123", "task_456", "task_789"],
  "reason": "System maintenance"
}

Response 200:
{
  "successful": ["task_123", "task_456"],
  "failed": [
    {
      "taskId": "task_789",
      "error": "Task already completed"
    }
  ]
}
```

## Progress Monitoring API

### Get Progress

```http
GET /progress/{taskId}

Response 200:
{
  "taskId": "task_abc123",
  "progress": 75,
  "phase": "processing",
  "subTasks": [
    {
      "name": "Data validation",
      "progress": 100,
      "status": "completed"
    },
    {
      "name": "Data transformation",
      "progress": 50,
      "status": "in_progress"
    }
  ],
  "metrics": {
    "itemsProcessed": 7500,
    "itemsTotal": 10000,
    "throughput": 150,
    "estimatedTimeRemaining": 60
  }
}
```

### Subscribe to Progress

```http
POST /progress/subscribe
{
  "taskIds": ["task_123", "task_456"],
  "webhookUrl": "https://your-app.com/progress",
  "events": ["progress", "completed", "failed"]
}

Response 201:
{
  "subscriptionId": "sub_xyz789",
  "expiresAt": "2024-12-11T10:00:00Z"
}
```

### Progress History

```http
GET /progress/{taskId}/history

Response 200:
{
  "taskId": "task_abc123",
  "history": [
    {
      "timestamp": "2024-12-10T10:05:00Z",
      "progress": 0,
      "event": "started"
    },
    {
      "timestamp": "2024-12-10T10:06:00Z",
      "progress": 25,
      "event": "progress_update"
    }
  ]
}
```

## Error Tracking API

### Report Error

```http
POST /errors
{
  "type": "APPLICATION_ERROR",
  "message": "Failed to process payment",
  "severity": "high",
  "stack": "Error: Failed to process payment\n  at processPayment (payment.js:45)",
  "context": {
    "userId": "user123",
    "orderId": "order456",
    "amount": 99.99
  },
  "tags": ["payment", "critical-path"],
  "fingerprint": "payment-processing-error"
}

Response 201:
{
  "errorId": "err_def456",
  "trackingUrl": "https://claudia.dev/errors/err_def456",
  "similar": 12,
  "suggestedFix": {
    "description": "Check payment gateway connection",
    "documentation": "https://docs.claudia.dev/errors/payment"
  }
}
```

### Get Error Details

```http
GET /errors/{errorId}

Response 200:
{
  "errorId": "err_def456",
  "type": "APPLICATION_ERROR",
  "message": "Failed to process payment",
  "severity": "high",
  "firstSeen": "2024-12-10T09:00:00Z",
  "lastSeen": "2024-12-10T10:15:00Z",
  "occurrences": 23,
  "affected": {
    "users": 15,
    "transactions": 23
  },
  "resolution": {
    "status": "investigating",
    "assignee": "team-payments",
    "eta": "2024-12-10T11:00:00Z"
  }
}
```

### Error Analytics

```http
GET /errors/analytics?timeRange=24h&groupBy=type

Response 200:
{
  "timeRange": "24h",
  "summary": {
    "total": 156,
    "critical": 2,
    "high": 23,
    "medium": 67,
    "low": 64
  },
  "trends": [
    {
      "timestamp": "2024-12-10T00:00:00Z",
      "count": 5,
      "types": {
        "API_ERROR": 3,
        "VALIDATION_ERROR": 2
      }
    }
  ],
  "topErrors": [
    {
      "message": "Database connection timeout",
      "count": 45,
      "severity": "high",
      "trend": "increasing"
    }
  ]
}
```

## Agent Management API

### List Agents

```http
GET /agents

Response 200:
{
  "agents": [
    {
      "id": "agent_001",
      "name": "Data Processor",
      "type": "worker",
      "status": "active",
      "capabilities": ["data_processing", "file_handling"],
      "workload": {
        "current": 3,
        "capacity": 10
      }
    }
  ]
}
```

### Create Agent

```http
POST /agents
{
  "name": "Custom Worker",
  "type": "specialized",
  "capabilities": ["image_processing", "ml_inference"],
  "configuration": {
    "maxConcurrent": 5,
    "timeout": 300000
  }
}

Response 201:
{
  "id": "agent_xyz",
  "name": "Custom Worker",
  "status": "initializing",
  "endpoint": "wss://agents.claudia.dev/agent_xyz"
}
```

### Agent Commands

```http
POST /agents/{agentId}/command
{
  "command": "process",
  "parameters": {
    "taskId": "task_123",
    "priority": "high"
  }
}

Response 200:
{
  "commandId": "cmd_789",
  "status": "accepted",
  "estimatedCompletion": "2024-12-10T10:20:00Z"
}
```

## WebSocket APIs

### Real-time Progress

```javascript
// Connect to progress WebSocket
const ws = new WebSocket('wss://api.claudia.dev/v1/ws/progress');

ws.on('open', () => {
  // Subscribe to task progress
  ws.send(JSON.stringify({
    action: 'subscribe',
    taskIds: ['task_123', 'task_456']
  }));
});

ws.on('message', (data) => {
  const update = JSON.parse(data);
  // Handle progress update
  console.log(`Task ${update.taskId}: ${update.progress}%`);
});
```

### Error Stream

```javascript
// Connect to error stream
const errorWs = new WebSocket('wss://api.claudia.dev/v1/ws/errors');

errorWs.on('message', (data) => {
  const error = JSON.parse(data);
  if (error.severity === 'critical') {
    // Handle critical error
    alertOncall(error);
  }
});
```

### Agent Communication

```javascript
// Direct agent WebSocket
const agentWs = new WebSocket('wss://agents.claudia.dev/agent_001');

agentWs.on('message', (data) => {
  const message = JSON.parse(data);
  switch (message.type) {
    case 'status':
      updateAgentStatus(message);
      break;
    case 'result':
      handleTaskResult(message);
      break;
  }
});
```

## Rate Limiting

### Rate Limit Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1702228800
X-RateLimit-Reset-After: 3600
```

### Rate Limit Response

```http
429 Too Many Requests
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded",
    "retryAfter": 60,
    "limit": 1000,
    "window": "1h"
  }
}
```

### Rate Limit Tiers

| Tier | Requests/Hour | Burst | WebSocket Connections |
|------|--------------|-------|---------------------|
| Free | 100 | 10 | 1 |
| Basic | 1,000 | 100 | 5 |
| Pro | 10,000 | 1,000 | 20 |
| Enterprise | Custom | Custom | Unlimited |

## Error Responses

### Standard Error Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "priority",
        "message": "Must be one of: low, normal, high, critical"
      }
    ],
    "requestId": "req_abc123",
    "documentation": "https://docs.claudia.dev/errors/VALIDATION_ERROR"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| UNAUTHORIZED | 401 | Invalid or missing authentication |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Invalid request parameters |
| RATE_LIMITED | 429 | Rate limit exceeded |
| INTERNAL_ERROR | 500 | Server error |
| SERVICE_UNAVAILABLE | 503 | Service temporarily unavailable |

## Versioning

### Version Header

```http
Accept: application/vnd.claudia.v1+json
```

### Version in URL

```
https://api.claudia.dev/v1/tasks
https://api.claudia.dev/v2/tasks
```

### Deprecation Notice

```http
Sunset: Sat, 31 Dec 2024 23:59:59 GMT
Deprecation: true
Link: <https://docs.claudia.dev/migrations/v2>; rel="alternate"
```

## SDK Usage

### JavaScript/TypeScript

```typescript
import { ClaudiaClient } from '@claudia/sdk';

const client = new ClaudiaClient({
  apiKey: process.env.CLAUDIA_API_KEY,
  baseUrl: 'https://api.claudia.dev/v1'
});

// Create a task
const task = await client.tasks.create({
  name: 'Process Data',
  type: 'data_processing',
  priority: 'high'
});

// Monitor progress
client.progress.subscribe(task.id, (update) => {
  console.log(`Progress: ${update.progress}%`);
});
```

### Python

```python
from claudia import Client

client = Client(api_key=os.environ['CLAUDIA_API_KEY'])

# Create task
task = client.tasks.create(
    name='Process Data',
    type='data_processing',
    priority='high'
)

# Get progress
progress = client.progress.get(task.id)
print(f"Progress: {progress.percentage}%")
```

### Go

```go
import "github.com/claudia/claudia-go"

client := claudia.NewClient(os.Getenv("CLAUDIA_API_KEY"))

// Create task
task, err := client.Tasks.Create(&claudia.TaskRequest{
    Name:     "Process Data",
    Type:     "data_processing",
    Priority: "high",
})

// Monitor progress
updates := client.Progress.Subscribe(task.ID)
for update := range updates {
    fmt.Printf("Progress: %d%%\n", update.Progress)
}
```

## API Best Practices

### 1. Pagination

Always use pagination for list endpoints:

```javascript
async function getAllTasks() {
  let tasks = [];
  let offset = 0;
  const limit = 100;
  
  while (true) {
    const response = await client.tasks.list({ limit, offset });
    tasks = tasks.concat(response.tasks);
    
    if (!response.pagination.hasMore) break;
    offset += limit;
  }
  
  return tasks;
}
```

### 2. Retry Logic

Implement exponential backoff:

```javascript
async function retryRequest(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### 3. Request Idempotency

Use idempotency keys for critical operations:

```javascript
const response = await client.request({
  method: 'POST',
  path: '/tasks',
  headers: {
    'Idempotency-Key': generateUUID()
  },
  body: taskData
});
```

### 4. Efficient Polling

Use exponential backoff for polling:

```javascript
async function pollTaskStatus(taskId) {
  let delay = 1000; // Start with 1 second
  
  while (true) {
    const task = await client.tasks.get(taskId);
    
    if (task.status === 'completed') {
      return task;
    }
    
    await new Promise(resolve => setTimeout(resolve, delay));
    delay = Math.min(delay * 1.5, 30000); // Max 30 seconds
  }
}
```

## Conclusion

The Claudia API provides comprehensive access to all system features. For additional information:

- [Authentication Guide](../guides/Authentication-Guide.md)
- [WebSocket Guide](../guides/WebSocket-Guide.md)
- [SDK Documentation](../developer/SDK-Documentation.md)
- [API Changelog](../CHANGELOG.md)

---
*API Version: 1.0*  
*Last updated: December 2024*