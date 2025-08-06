import { http, HttpResponse } from 'msw';

// Mock handlers for API endpoints
export const handlers = [
  // Gemini API
  http.post('/api/gemini/generate', async ({ request }) => {
    const body = await request.json();
    
    return HttpResponse.json({
      response: 'Mock Gemini response',
      model: body.model || 'gemini-pro',
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150
      }
    });
  }),

  // Claude API
  http.post('/api/claude/complete', async ({ request }) => {
    const body = await request.json();
    
    return HttpResponse.json({
      completion: 'Mock Claude completion',
      model: body.model || 'claude-3',
      usage: {
        input_tokens: 80,
        output_tokens: 40,
        total_tokens: 120
      }
    });
  }),

  // Dashboard API
  http.get('/api/dashboard/stats', () => {
    return HttpResponse.json({
      totalProjects: 5,
      activeProjects: 3,
      completedTasks: 45,
      errorCount: 2,
      performance: {
        cpu: 45,
        memory: 60,
        disk: 30
      }
    });
  }),

  // Error tracking API
  http.get('/api/errors', () => {
    return HttpResponse.json({
      errors: [
        {
          id: 'err_1',
          timestamp: Date.now() - 3600000,
          category: 'api',
          source: 'gemini-api',
          severity: 'medium',
          message: 'Rate limit exceeded',
          resolved: false
        },
        {
          id: 'err_2',
          timestamp: Date.now() - 7200000,
          category: 'runtime',
          source: 'react-component',
          severity: 'low',
          message: 'Component render warning',
          resolved: true
        }
      ],
      total: 2
    });
  }),

  // Health check
  http.get('/api/health', () => {
    return HttpResponse.json({
      status: 'healthy',
      timestamp: Date.now(),
      services: {
        database: 'up',
        cache: 'up',
        queue: 'up'
      }
    });
  }),

  // File operations
  http.post('/api/files/read', async ({ request }) => {
    const { path } = await request.json() as { path: string };
    
    return HttpResponse.json({
      content: `Mock content of ${path}`,
      size: 1024,
      lastModified: Date.now()
    });
  }),

  http.post('/api/files/write', async ({ request }) => {
    const { path, content } = await request.json() as { path: string; content: string };
    
    return HttpResponse.json({
      success: true,
      path,
      size: content.length
    });
  }),

  // Agent operations
  http.get('/api/agents', () => {
    return HttpResponse.json({
      agents: [
        {
          id: 'agent_1',
          name: 'Test Agent',
          type: 'analyzer',
          status: 'idle'
        },
        {
          id: 'agent_2',
          name: 'Build Agent',
          type: 'builder',
          status: 'running'
        }
      ]
    });
  }),

  // Monitoring operations
  http.post('/api/monitoring/track', async ({ request }) => {
    const operation = await request.json();
    
    return HttpResponse.json({
      id: `op_${Date.now()}`,
      ...operation,
      status: 'pending'
    });
  })
];

// Error response handlers for testing error scenarios
export const errorHandlers = [
  http.post('/api/gemini/generate', () => {
    return HttpResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }),

  http.get('/api/dashboard/stats', () => {
    return HttpResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }),

  http.get('/api/errors', () => {
    return new HttpResponse(null, { status: 504 });
  })
];