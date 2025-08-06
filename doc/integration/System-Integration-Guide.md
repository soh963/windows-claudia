# System Integration Guide

## Overview

This guide provides comprehensive instructions for integrating various Claudia components and connecting Claudia with external systems. It covers internal component integration, third-party service connections, and best practices for building robust integrations.

## Table of Contents

1. [Integration Architecture](#integration-architecture)
2. [Component Integration](#component-integration)
3. [API Integration](#api-integration)
4. [Database Integration](#database-integration)
5. [Authentication & Authorization](#authentication--authorization)
6. [Real-time Communication](#real-time-communication)
7. [Third-Party Services](#third-party-services)
8. [Event System](#event-system)
9. [Testing Integrations](#testing-integrations)
10. [Monitoring & Debugging](#monitoring--debugging)
11. [Best Practices](#best-practices)
12. [Troubleshooting](#troubleshooting)

## Integration Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                           │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌──────────┐    │
│  │Dashboard│  │ Progress │  │  Error  │  │  Agent   │    │
│  │   UI    │  │ Monitor  │  │ Tracker │  │ Manager  │    │
│  └────┬────┘  └────┬─────┘  └────┬────┘  └────┬─────┘    │
└───────┼────────────┼──────────────┼────────────┼───────────┘
        │            │              │            │
┌───────┼────────────┼──────────────┼────────────┼───────────┐
│       │         API Gateway       │            │           │
│       └────────────┬──────────────┘            │           │
│                    │                            │           │
│  ┌─────────────────┼──────────────────────────┼─────────┐ │
│  │   Core Services │                          │         │ │
│  │  ┌──────────┐  ┌┼─────────┐  ┌───────────┼──┐      │ │
│  │  │   Task   │  ││Progress │  │   Error   │  │      │ │
│  │  │ Service  │  ││ Service │  │  Service  │  │      │ │
│  │  └──────────┘  └┼─────────┘  └───────────┼──┘      │ │
│  └─────────────────┼──────────────────────────┼─────────┘ │
│                    │                          │           │
│  ┌─────────────────┼──────────────────────────┼─────────┐ │
│  │  Data Layer     │                          │         │ │
│  │  ┌──────────┐  ┌┼─────────┐  ┌───────────┼──┐      │ │
│  │  │Database  │  ││  Cache  │  │   Queue   │  │      │ │
│  │  │(MongoDB) │  ││ (Redis) │  │ (RabbitMQ)│  │      │ │
│  │  └──────────┘  └┼─────────┘  └───────────┼──┘      │ │
│  └─────────────────┼──────────────────────────┼─────────┘ │
└────────────────────┴──────────────────────────┴───────────┘
```

### Integration Points

1. **Service-to-Service**: REST APIs, gRPC, Message Queues
2. **Frontend-to-Backend**: GraphQL, REST, WebSocket
3. **External Services**: Webhooks, OAuth, API Keys
4. **Data Synchronization**: Event sourcing, CDC, Polling

## Component Integration

### Task Service Integration

```javascript
// Task Service Client
class TaskServiceClient {
  constructor(config) {
    this.baseUrl = config.baseUrl || 'http://localhost:3001';
    this.apiKey = config.apiKey;
  }

  async createTask(taskData) {
    const response = await fetch(`${this.baseUrl}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(taskData)
    });
    
    if (!response.ok) {
      throw new Error(`Task creation failed: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getTaskProgress(taskId) {
    // Real-time progress via WebSocket
    const ws = new WebSocket(`${this.baseUrl}/ws/tasks/${taskId}`);
    
    return new Promise((resolve, reject) => {
      ws.on('message', (data) => {
        const progress = JSON.parse(data);
        if (progress.status === 'completed') {
          ws.close();
          resolve(progress);
        }
      });
      
      ws.on('error', reject);
    });
  }
}

// Usage in another service
const taskClient = new TaskServiceClient({
  apiKey: process.env.TASK_SERVICE_API_KEY
});

const task = await taskClient.createTask({
  type: 'data_processing',
  payload: { fileId: 'file123' }
});
```

### Progress Monitor Integration

```javascript
// Progress Monitor Integration
class ProgressMonitorIntegration {
  constructor(progressService, taskService) {
    this.progressService = progressService;
    this.taskService = taskService;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Listen for task events
    this.taskService.on('task:started', async (task) => {
      await this.progressService.createProgress({
        taskId: task.id,
        total: task.estimatedSteps,
        status: 'active'
      });
    });

    this.taskService.on('task:progress', async (update) => {
      await this.progressService.updateProgress({
        taskId: update.taskId,
        current: update.currentStep,
        message: update.message
      });
    });

    this.taskService.on('task:completed', async (task) => {
      await this.progressService.completeProgress(task.id);
    });
  }

  // Bridge method for external updates
  async reportProgress(taskId, progress) {
    // Validate task exists
    const task = await this.taskService.getTask(taskId);
    if (!task) throw new Error('Task not found');

    // Update progress
    await this.progressService.updateProgress({
      taskId,
      current: progress.current,
      total: progress.total,
      percentage: (progress.current / progress.total) * 100
    });

    // Emit event for other listeners
    this.emit('progress:updated', { taskId, progress });
  }
}
```

### Error Tracking Integration

```javascript
// Error Tracking Integration
class ErrorTrackingIntegration {
  constructor(errorService, config) {
    this.errorService = errorService;
    this.config = config;
    this.setupGlobalHandlers();
  }

  setupGlobalHandlers() {
    // Node.js global error handlers
    process.on('uncaughtException', (error) => {
      this.captureError(error, {
        type: 'uncaught_exception',
        fatal: true
      });
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.captureError(reason, {
        type: 'unhandled_rejection',
        promise: promise.toString()
      });
    });
  }

  async captureError(error, context = {}) {
    try {
      const errorData = {
        message: error.message,
        stack: error.stack,
        type: error.constructor.name,
        context: {
          ...context,
          service: this.config.serviceName,
          environment: process.env.NODE_ENV,
          timestamp: new Date().toISOString()
        }
      };

      await this.errorService.reportError(errorData);
      
      // Also log locally
      console.error('Error captured:', errorData);
      
    } catch (reportError) {
      // Fallback logging if error service fails
      console.error('Failed to report error:', reportError);
      console.error('Original error:', error);
    }
  }

  // Express middleware
  expressMiddleware() {
    return (err, req, res, next) => {
      this.captureError(err, {
        method: req.method,
        url: req.url,
        headers: req.headers,
        query: req.query,
        body: req.body,
        user: req.user
      });

      res.status(err.status || 500).json({
        error: {
          message: err.message,
          id: err.id
        }
      });
    };
  }
}
```

## API Integration

### RESTful API Integration

```javascript
// Generic REST Client
class RestApiClient {
  constructor(config) {
    this.baseUrl = config.baseUrl;
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers
    };
    this.timeout = config.timeout || 30000;
  }

  async request(method, path, data = null) {
    const url = `${this.baseUrl}${path}`;
    const options = {
      method,
      headers: this.headers,
      timeout: this.timeout
    };

    if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new ApiError(response.status, await response.text());
      }
      
      return response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  get(path) { return this.request('GET', path); }
  post(path, data) { return this.request('POST', path, data); }
  put(path, data) { return this.request('PUT', path, data); }
  patch(path, data) { return this.request('PATCH', path, data); }
  delete(path) { return this.request('DELETE', path); }
}

// Service-specific client
class ClaudiaApiClient extends RestApiClient {
  constructor(apiKey) {
    super({
      baseUrl: 'https://api.claudia.dev/v1',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
  }

  // Convenience methods
  getTasks() { return this.get('/tasks'); }
  createTask(data) { return this.post('/tasks', data); }
  getTaskProgress(id) { return this.get(`/tasks/${id}/progress`); }
}
```

### GraphQL Integration

```javascript
// GraphQL Client
class GraphQLClient {
  constructor(endpoint, options = {}) {
    this.endpoint = endpoint;
    this.headers = options.headers || {};
  }

  async query(query, variables = {}) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers
      },
      body: JSON.stringify({ query, variables })
    });

    const result = await response.json();
    
    if (result.errors) {
      throw new GraphQLError(result.errors);
    }
    
    return result.data;
  }
}

// Usage example
const client = new GraphQLClient('https://api.claudia.dev/graphql', {
  headers: {
    'Authorization': `Bearer ${apiKey}`
  }
});

const tasks = await client.query(`
  query GetTasks($status: String) {
    tasks(status: $status) {
      id
      name
      status
      progress {
        percentage
        message
      }
    }
  }
`, { status: 'active' });
```

## Database Integration

### MongoDB Integration

```javascript
// MongoDB Service
const { MongoClient } = require('mongodb');

class MongoDBService {
  constructor(connectionString, dbName) {
    this.connectionString = connectionString;
    this.dbName = dbName;
    this.client = null;
    this.db = null;
  }

  async connect() {
    try {
      this.client = new MongoClient(this.connectionString, {
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
      });

      await this.client.connect();
      this.db = this.client.db(this.dbName);
      
      console.log('MongoDB connected successfully');
    } catch (error) {
      console.error('MongoDB connection failed:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      console.log('MongoDB disconnected');
    }
  }

  collection(name) {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection(name);
  }

  // Helper methods
  async findOne(collectionName, filter) {
    return this.collection(collectionName).findOne(filter);
  }

  async insertOne(collectionName, document) {
    const result = await this.collection(collectionName).insertOne({
      ...document,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return result.insertedId;
  }

  async updateOne(collectionName, filter, update) {
    return this.collection(collectionName).updateOne(filter, {
      $set: {
        ...update,
        updatedAt: new Date()
      }
    });
  }
}

// Usage
const db = new MongoDBService(
  process.env.MONGODB_URI,
  'claudia'
);

await db.connect();

// In services
class TaskRepository {
  constructor(db) {
    this.db = db;
    this.collection = 'tasks';
  }

  async create(taskData) {
    const id = await this.db.insertOne(this.collection, taskData);
    return { id, ...taskData };
  }

  async findById(id) {
    return this.db.findOne(this.collection, { _id: id });
  }

  async updateProgress(id, progress) {
    return this.db.updateOne(this.collection, 
      { _id: id },
      { progress, status: progress === 100 ? 'completed' : 'in_progress' }
    );
  }
}
```

### Redis Integration

```javascript
// Redis Cache Service
const redis = require('redis');

class CacheService {
  constructor(config) {
    this.client = redis.createClient({
      url: config.url || 'redis://localhost:6379',
      password: config.password
    });

    this.client.on('error', (err) => {
      console.error('Redis error:', err);
    });

    this.defaultTTL = config.defaultTTL || 3600; // 1 hour
  }

  async connect() {
    await this.client.connect();
    console.log('Redis connected');
  }

  async get(key) {
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key, value, ttl = this.defaultTTL) {
    await this.client.setex(
      key, 
      ttl, 
      JSON.stringify(value)
    );
  }

  async delete(key) {
    await this.client.del(key);
  }

  async invalidatePattern(pattern) {
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(keys);
    }
  }

  // Caching decorator
  cache(keyGenerator, ttl) {
    return (target, propertyKey, descriptor) => {
      const originalMethod = descriptor.value;

      descriptor.value = async function(...args) {
        const key = keyGenerator(...args);
        
        // Try cache first
        const cached = await this.get(key);
        if (cached) return cached;

        // Execute original method
        const result = await originalMethod.apply(this, args);
        
        // Cache result
        await this.set(key, result, ttl);
        
        return result;
      };

      return descriptor;
    };
  }
}

// Usage with caching decorator
class TaskService {
  constructor(cache) {
    this.cache = cache;
  }

  @cache((id) => `task:${id}`, 300)
  async getTask(id) {
    // Expensive database operation
    return await db.findOne('tasks', { _id: id });
  }
}
```

## Authentication & Authorization

### JWT Authentication

```javascript
// JWT Authentication Service
const jwt = require('jsonwebtoken');

class AuthService {
  constructor(config) {
    this.secret = config.secret;
    this.expiresIn = config.expiresIn || '1h';
    this.refreshExpiresIn = config.refreshExpiresIn || '7d';
  }

  generateTokens(payload) {
    const accessToken = jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn
    });

    const refreshToken = jwt.sign(
      { ...payload, type: 'refresh' }, 
      this.secret, 
      { expiresIn: this.refreshExpiresIn }
    );

    return { accessToken, refreshToken };
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, this.secret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      }
      throw new Error('Invalid token');
    }
  }

  // Express middleware
  authenticate() {
    return async (req, res, next) => {
      try {
        const token = this.extractToken(req);
        if (!token) {
          return res.status(401).json({ error: 'No token provided' });
        }

        const payload = this.verifyToken(token);
        req.user = payload;
        next();
      } catch (error) {
        res.status(401).json({ error: error.message });
      }
    };
  }

  extractToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return null;
  }
}

// Usage
const auth = new AuthService({
  secret: process.env.JWT_SECRET
});

app.use('/api/protected', auth.authenticate());
```

### OAuth Integration

```javascript
// OAuth 2.0 Integration
class OAuthProvider {
  constructor(config) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.authorizationUrl = config.authorizationUrl;
    this.tokenUrl = config.tokenUrl;
  }

  getAuthorizationUrl(state, scope = []) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      state: state,
      scope: scope.join(' ')
    });

    return `${this.authorizationUrl}?${params}`;
  }

  async exchangeCodeForToken(code) {
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri
      })
    });

    if (!response.ok) {
      throw new Error('Token exchange failed');
    }

    return response.json();
  }

  async refreshToken(refreshToken) {
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret
      })
    });

    return response.json();
  }
}

// GitHub OAuth example
const githubOAuth = new OAuthProvider({
  clientId: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  redirectUri: 'http://localhost:3000/auth/github/callback',
  authorizationUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token'
});
```

## Real-time Communication

### WebSocket Integration

```javascript
// WebSocket Server
const WebSocket = require('ws');

class WebSocketService {
  constructor(server) {
    this.wss = new WebSocket.Server({ server });
    this.clients = new Map();
    this.setupHandlers();
  }

  setupHandlers() {
    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      this.clients.set(clientId, {
        ws,
        subscriptions: new Set(),
        metadata: {
          connectedAt: new Date(),
          ip: req.socket.remoteAddress
        }
      });

      ws.on('message', (message) => {
        this.handleMessage(clientId, message);
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for ${clientId}:`, error);
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        clientId,
        timestamp: new Date()
      }));
    });
  }

  handleMessage(clientId, message) {
    try {
      const data = JSON.parse(message);
      const client = this.clients.get(clientId);

      switch (data.type) {
        case 'subscribe':
          this.subscribe(clientId, data.channel);
          break;
        case 'unsubscribe':
          this.unsubscribe(clientId, data.channel);
          break;
        case 'ping':
          client.ws.send(JSON.stringify({ type: 'pong' }));
          break;
      }
    } catch (error) {
      console.error('Invalid message:', error);
    }
  }

  subscribe(clientId, channel) {
    const client = this.clients.get(clientId);
    if (client) {
      client.subscriptions.add(channel);
      client.ws.send(JSON.stringify({
        type: 'subscribed',
        channel
      }));
    }
  }

  broadcast(channel, data) {
    for (const [clientId, client] of this.clients) {
      if (client.subscriptions.has(channel)) {
        client.ws.send(JSON.stringify({
          type: 'message',
          channel,
          data,
          timestamp: new Date()
        }));
      }
    }
  }

  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Integration with services
class RealtimeTaskUpdates {
  constructor(taskService, wsService) {
    this.taskService = taskService;
    this.wsService = wsService;

    // Listen for task events
    this.taskService.on('task:created', (task) => {
      this.wsService.broadcast('tasks', {
        event: 'created',
        task
      });
    });

    this.taskService.on('task:updated', (task) => {
      this.wsService.broadcast(`task:${task.id}`, {
        event: 'updated',
        task
      });
    });

    this.taskService.on('task:progress', (update) => {
      this.wsService.broadcast(`task:${update.taskId}`, {
        event: 'progress',
        progress: update.progress
      });
    });
  }
}
```

### Server-Sent Events (SSE)

```javascript
// SSE Service for one-way real-time updates
class SSEService {
  constructor() {
    this.connections = new Map();
  }

  addConnection(id, res) {
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // Send initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({ id })}\n\n`);

    // Store connection
    this.connections.set(id, res);

    // Handle client disconnect
    res.on('close', () => {
      this.connections.delete(id);
    });
  }

  sendEvent(id, event, data) {
    const connection = this.connections.get(id);
    if (connection) {
      connection.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  }

  broadcast(event, data) {
    for (const [id, connection] of this.connections) {
      connection.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  }
}

// Express endpoint
app.get('/events/:userId', (req, res) => {
  const userId = req.params.userId;
  sseService.addConnection(userId, res);
});
```

## Third-Party Services

### Webhook Integration

```javascript
// Webhook Service
class WebhookService {
  constructor(config) {
    this.webhooks = new Map();
    this.secret = config.secret;
    this.retryAttempts = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 1000;
  }

  register(id, url, events = []) {
    this.webhooks.set(id, {
      url,
      events,
      active: true,
      createdAt: new Date()
    });
  }

  async send(event, data) {
    const payload = {
      event,
      data,
      timestamp: new Date().toISOString()
    };

    const signature = this.generateSignature(payload);

    for (const [id, webhook] of this.webhooks) {
      if (webhook.active && webhook.events.includes(event)) {
        this.sendWebhook(webhook.url, payload, signature)
          .catch(err => console.error(`Webhook ${id} failed:`, err));
      }
    }
  }

  async sendWebhook(url, payload, signature, attempt = 1) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature
        },
        body: JSON.stringify(payload),
        timeout: 5000
      });

      if (!response.ok && attempt < this.retryAttempts) {
        await this.delay(this.retryDelay * attempt);
        return this.sendWebhook(url, payload, signature, attempt + 1);
      }

      return response;
    } catch (error) {
      if (attempt < this.retryAttempts) {
        await this.delay(this.retryDelay * attempt);
        return this.sendWebhook(url, payload, signature, attempt + 1);
      }
      throw error;
    }
  }

  generateSignature(payload) {
    const crypto = require('crypto');
    return crypto
      .createHmac('sha256', this.secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Verify incoming webhooks
  verifySignature(payload, signature) {
    const expectedSignature = this.generateSignature(payload);
    return signature === expectedSignature;
  }
}
```

### Email Service Integration

```javascript
// Email Service Integration
class EmailService {
  constructor(config) {
    this.provider = config.provider; // 'sendgrid', 'mailgun', 'ses'
    this.apiKey = config.apiKey;
    this.from = config.from;
    this.templates = new Map();
  }

  async send(to, subject, content, options = {}) {
    switch (this.provider) {
      case 'sendgrid':
        return this.sendWithSendGrid(to, subject, content, options);
      case 'mailgun':
        return this.sendWithMailgun(to, subject, content, options);
      case 'ses':
        return this.sendWithSES(to, subject, content, options);
      default:
        throw new Error(`Unknown email provider: ${this.provider}`);
    }
  }

  async sendWithSendGrid(to, subject, content, options) {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(this.apiKey);

    const msg = {
      to,
      from: this.from,
      subject,
      html: content,
      ...options
    };

    return sgMail.send(msg);
  }

  // Template management
  registerTemplate(name, template) {
    this.templates.set(name, template);
  }

  async sendTemplate(to, templateName, data) {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }

    const content = this.renderTemplate(template, data);
    return this.send(to, template.subject, content);
  }

  renderTemplate(template, data) {
    // Simple template rendering (use a proper template engine in production)
    let content = template.html;
    for (const [key, value] of Object.entries(data)) {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return content;
  }
}

// Usage
const emailService = new EmailService({
  provider: 'sendgrid',
  apiKey: process.env.SENDGRID_API_KEY,
  from: 'noreply@claudia.dev'
});

// Register templates
emailService.registerTemplate('task_completed', {
  subject: 'Task Completed Successfully',
  html: `
    <h1>Task Completed</h1>
    <p>Hi {{userName}},</p>
    <p>Your task "{{taskName}}" has been completed successfully.</p>
    <p>Duration: {{duration}}</p>
    <p>Result: {{result}}</p>
  `
});

// Send templated email
await emailService.sendTemplate('user@example.com', 'task_completed', {
  userName: 'John',
  taskName: 'Data Processing',
  duration: '5 minutes',
  result: 'Success'
});
```

## Event System

### Event Bus Implementation

```javascript
// Central Event Bus
class EventBus {
  constructor() {
    this.events = new Map();
    this.wildcardHandlers = [];
  }

  on(event, handler) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event).push(handler);
    
    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  off(event, handler) {
    const handlers = this.events.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    // Specific event handlers
    const handlers = this.events.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });

    // Wildcard handlers
    this.wildcardHandlers.forEach(handler => {
      try {
        handler(event, data);
      } catch (error) {
        console.error(`Error in wildcard handler:`, error);
      }
    });
  }

  onAny(handler) {
    this.wildcardHandlers.push(handler);
    return () => {
      const index = this.wildcardHandlers.indexOf(handler);
      if (index > -1) {
        this.wildcardHandlers.splice(index, 1);
      }
    };
  }

  // Async event handling
  async emitAsync(event, data) {
    const handlers = this.events.get(event) || [];
    const results = await Promise.allSettled(
      handlers.map(handler => handler(data))
    );

    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      console.error(`${failures.length} handlers failed for event ${event}`);
    }

    return results;
  }
}

// Service integration
class ServiceIntegration {
  constructor(eventBus, services) {
    this.eventBus = eventBus;
    this.services = services;
    this.setupIntegrations();
  }

  setupIntegrations() {
    // Task created -> Start progress monitoring
    this.eventBus.on('task:created', async (task) => {
      await this.services.progressMonitor.initializeProgress(task.id);
      await this.services.notificationService.notify('task_created', task);
    });

    // Task failed -> Log error and notify
    this.eventBus.on('task:failed', async (data) => {
      await this.services.errorTracker.reportError({
        type: 'TASK_FAILURE',
        taskId: data.taskId,
        error: data.error
      });
      
      await this.services.notificationService.notifyError(
        'task_failed',
        data
      );
    });

    // Progress updated -> Broadcast to clients
    this.eventBus.on('progress:updated', (progress) => {
      this.services.websocket.broadcast('progress', progress);
    });
  }
}
```

## Testing Integrations

### Integration Test Framework

```javascript
// Integration Test Helper
class IntegrationTestHelper {
  constructor() {
    this.services = {};
    this.mocks = {};
  }

  async setup() {
    // Start test database
    this.db = await this.setupTestDatabase();
    
    // Start test Redis
    this.cache = await this.setupTestCache();
    
    // Initialize services
    this.services = {
      task: new TaskService(this.db),
      progress: new ProgressService(this.db, this.cache),
      error: new ErrorService(this.db)
    };

    // Setup mocks
    this.setupMocks();
  }

  async teardown() {
    await this.db.close();
    await this.cache.disconnect();
    this.restoreMocks();
  }

  setupTestDatabase() {
    // Use in-memory MongoDB for tests
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongod = new MongoMemoryServer();
    const uri = await mongod.getUri();
    
    return new MongoDBService(uri, 'test');
  }

  setupTestCache() {
    // Use redis-mock for tests
    const redis = require('redis-mock');
    return redis.createClient();
  }

  setupMocks() {
    // Mock external services
    this.mocks.email = jest.fn();
    this.mocks.webhook = jest.fn();
    
    // Replace real implementations
    this.services.email = { send: this.mocks.email };
    this.services.webhook = { send: this.mocks.webhook };
  }

  // Helper methods for tests
  async createTestTask(data = {}) {
    return this.services.task.create({
      name: 'Test Task',
      type: 'test',
      ...data
    });
  }

  async waitForEvent(eventName, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for event: ${eventName}`));
      }, timeout);

      this.services.eventBus.once(eventName, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }
}

// Example integration test
describe('Task Progress Integration', () => {
  let helper;

  beforeEach(async () => {
    helper = new IntegrationTestHelper();
    await helper.setup();
  });

  afterEach(async () => {
    await helper.teardown();
  });

  test('should update progress when task processes', async () => {
    // Create task
    const task = await helper.createTestTask();
    
    // Start processing
    await helper.services.task.start(task.id);
    
    // Simulate progress updates
    for (let i = 0; i <= 100; i += 25) {
      await helper.services.progress.update(task.id, i);
    }
    
    // Verify final state
    const finalProgress = await helper.services.progress.get(task.id);
    expect(finalProgress.percentage).toBe(100);
    expect(finalProgress.status).toBe('completed');
    
    // Verify notifications were sent
    expect(helper.mocks.email).toHaveBeenCalledWith(
      expect.objectContaining({
        template: 'task_completed'
      })
    );
  });
});
```

## Monitoring & Debugging

### Integration Health Checks

```javascript
// Health Check Service
class HealthCheckService {
  constructor(services) {
    this.services = services;
    this.checks = new Map();
    this.registerDefaultChecks();
  }

  registerDefaultChecks() {
    // Database health
    this.register('database', async () => {
      try {
        await this.services.db.ping();
        return { status: 'healthy', latency: Date.now() - start };
      } catch (error) {
        return { status: 'unhealthy', error: error.message };
      }
    });

    // Cache health
    this.register('cache', async () => {
      try {
        const testKey = 'health:check';
        await this.services.cache.set(testKey, 'ok', 1);
        const value = await this.services.cache.get(testKey);
        return { status: value === 'ok' ? 'healthy' : 'unhealthy' };
      } catch (error) {
        return { status: 'unhealthy', error: error.message };
      }
    });

    // External API health
    this.register('external_api', async () => {
      try {
        const response = await fetch('https://api.external.com/health');
        return { 
          status: response.ok ? 'healthy' : 'unhealthy',
          statusCode: response.status
        };
      } catch (error) {
        return { status: 'unhealthy', error: error.message };
      }
    });
  }

  register(name, checkFn) {
    this.checks.set(name, checkFn);
  }

  async runAll() {
    const results = {};
    
    for (const [name, checkFn] of this.checks) {
      try {
        results[name] = await checkFn();
      } catch (error) {
        results[name] = {
          status: 'error',
          error: error.message
        };
      }
    }

    const overallStatus = Object.values(results)
      .every(r => r.status === 'healthy') ? 'healthy' : 'unhealthy';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: results
    };
  }

  // Express endpoint
  endpoint() {
    return async (req, res) => {
      const health = await this.runAll();
      const statusCode = health.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(health);
    };
  }
}
```

### Integration Monitoring

```javascript
// Integration Metrics Collector
class IntegrationMetrics {
  constructor() {
    this.metrics = new Map();
    this.intervals = new Map();
  }

  recordLatency(integration, latency) {
    this.record(integration, 'latency', latency);
  }

  recordError(integration, error) {
    this.record(integration, 'errors', 1);
    this.record(integration, 'last_error', {
      message: error.message,
      timestamp: new Date()
    });
  }

  recordSuccess(integration) {
    this.record(integration, 'successes', 1);
  }

  record(integration, metric, value) {
    const key = `${integration}:${metric}`;
    
    if (typeof value === 'number') {
      const current = this.metrics.get(key) || 0;
      this.metrics.set(key, current + value);
    } else {
      this.metrics.set(key, value);
    }
  }

  getMetrics(integration) {
    const metrics = {};
    const prefix = `${integration}:`;
    
    for (const [key, value] of this.metrics) {
      if (key.startsWith(prefix)) {
        const metricName = key.substring(prefix.length);
        metrics[metricName] = value;
      }
    }
    
    return metrics;
  }

  // Middleware to track API calls
  trackApiCall(integrationName) {
    return async (req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const latency = Date.now() - start;
        this.recordLatency(integrationName, latency);
        
        if (res.statusCode >= 400) {
          this.recordError(integrationName, {
            message: `HTTP ${res.statusCode}`
          });
        } else {
          this.recordSuccess(integrationName);
        }
      });
      
      next();
    };
  }
}
```

## Best Practices

### 1. Error Handling

```javascript
// Centralized error handling for integrations
class IntegrationError extends Error {
  constructor(integration, message, originalError) {
    super(message);
    this.name = 'IntegrationError';
    this.integration = integration;
    this.originalError = originalError;
    this.timestamp = new Date();
  }
}

// Retry with exponential backoff
async function retryWithBackoff(fn, options = {}) {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    factor = 2
  } = options;

  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxAttempts) break;
      
      const delay = Math.min(
        initialDelay * Math.pow(factor, attempt - 1),
        maxDelay
      );
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}
```

### 2. Configuration Management

```javascript
// Environment-based configuration
class IntegrationConfig {
  constructor() {
    this.env = process.env.NODE_ENV || 'development';
    this.configs = {
      development: {
        api: {
          baseUrl: 'http://localhost:3000',
          timeout: 30000
        },
        database: {
          url: 'mongodb://localhost:27017/claudia-dev'
        },
        cache: {
          url: 'redis://localhost:6379'
        }
      },
      production: {
        api: {
          baseUrl: process.env.API_BASE_URL,
          timeout: 10000
        },
        database: {
          url: process.env.MONGODB_URI
        },
        cache: {
          url: process.env.REDIS_URL
        }
      }
    };
  }

  get(path) {
    const config = this.configs[this.env];
    return path.split('.').reduce((obj, key) => obj?.[key], config);
  }

  getAll() {
    return this.configs[this.env];
  }
}
```

### 3. Circuit Breaker Pattern

```javascript
// Circuit breaker for unreliable integrations
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.nextAttempt = Date.now();
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failures++;
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
    }
  }
}
```

## Troubleshooting

### Common Integration Issues

1. **Connection Timeouts**
   - Increase timeout values
   - Implement retry logic
   - Check network connectivity
   - Verify firewall rules

2. **Authentication Failures**
   - Verify API keys/tokens
   - Check token expiration
   - Validate permissions
   - Review authentication flow

3. **Data Synchronization Issues**
   - Implement idempotency
   - Use versioning
   - Add conflict resolution
   - Monitor data consistency

4. **Performance Problems**
   - Add caching layers
   - Implement pagination
   - Use connection pooling
   - Optimize queries

### Debugging Tools

```javascript
// Integration debugging helper
class IntegrationDebugger {
  constructor() {
    this.logs = [];
    this.maxLogs = 1000;
  }

  log(integration, operation, data) {
    const entry = {
      timestamp: new Date(),
      integration,
      operation,
      data
    };

    this.logs.push(entry);
    
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    if (process.env.DEBUG) {
      console.log('[Integration Debug]', entry);
    }
  }

  getLogs(filter = {}) {
    return this.logs.filter(log => {
      if (filter.integration && log.integration !== filter.integration) {
        return false;
      }
      if (filter.operation && log.operation !== filter.operation) {
        return false;
      }
      if (filter.since && log.timestamp < filter.since) {
        return false;
      }
      return true;
    });
  }

  // Express endpoint for debugging
  endpoint() {
    return (req, res) => {
      const logs = this.getLogs(req.query);
      res.json({ logs, count: logs.length });
    };
  }
}
```

## Conclusion

This guide provides comprehensive instructions for integrating Claudia components and external services. Following these patterns and best practices will help you build robust, scalable integrations.

For more specific integration scenarios:
- [API Documentation](../technical/API-Reference.md)
- [WebSocket Guide](../guides/WebSocket-Guide.md)
- [Database Guide](../technical/Database-Schema.md)
- [Security Guide](../maintenance/Security-Best-Practices.md)

---
*Last updated: December 2024*