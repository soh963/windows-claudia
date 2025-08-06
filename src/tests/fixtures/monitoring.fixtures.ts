import type { Operation, ErrorLog } from '@/stores/monitoringStore';
import type { ErrorEntry } from '@/stores/errorTrackingStore';

// Sample operations for testing
export const mockOperations = {
  apiCall: {
    type: 'api_call',
    name: 'Fetch User Data',
    description: 'Loading user profile from API',
    metadata: {
      endpoint: '/api/users/123',
      method: 'GET',
      headers: {
        'Authorization': 'Bearer token',
        'Content-Type': 'application/json'
      }
    }
  } as const,

  fileOperation: {
    type: 'file_operation',
    name: 'Upload Document',
    description: 'Uploading report.pdf to cloud storage',
    metadata: {
      fileName: 'report.pdf',
      fileSize: 2048000,
      mimeType: 'application/pdf'
    }
  } as const,

  buildProcess: {
    type: 'build_process',
    name: 'Build Application',
    description: 'Compiling and bundling the application',
    metadata: {
      environment: 'production',
      version: '1.2.3',
      features: ['optimization', 'minification']
    }
  } as const,

  geminiRequest: {
    type: 'gemini_request',
    name: 'Generate Text',
    description: 'Using Gemini API for text generation',
    metadata: {
      model: 'gemini-pro',
      temperature: 0.7,
      maxTokens: 1000,
      prompt: 'Write a summary about...'
    }
  } as const,

  claudeRequest: {
    type: 'claude_request',
    name: 'Analyze Code',
    description: 'Claude analyzing code for improvements',
    metadata: {
      model: 'claude-3-opus',
      context: 'code-review',
      fileCount: 5
    }
  } as const,
};

// Sample errors for testing
export const mockErrors = {
  apiError: {
    category: 'api',
    source: 'gemini-api',
    severity: 'high',
    message: 'Rate limit exceeded',
    code: 'RATE_LIMITED',
    context: {
      endpoint: '/api/generate',
      operation: 'text-generation',
      userId: 'user123'
    },
    details: {
      status: 429,
      retryAfter: 60,
      limit: 100,
      used: 100
    },
    impact: {
      userImpact: 'major',
      functionalityImpact: ['text-generation', 'chat-features']
    },
    tags: ['rate-limit', 'api', 'production']
  } as Omit<ErrorEntry, 'id' | 'timestamp'>,

  runtimeError: {
    category: 'runtime',
    source: 'react-component',
    severity: 'critical',
    message: 'Cannot read property "map" of undefined',
    stack: `TypeError: Cannot read property 'map' of undefined
      at UserList (UserList.tsx:45:23)
      at renderWithHooks (react-dom.development.js:14803:18)`,
    context: {
      component: 'UserList',
      operation: 'render',
      browser: 'Chrome 120.0'
    },
    impact: {
      userImpact: 'blocking',
      functionalityImpact: ['user-list-display']
    },
    tags: ['react', 'ui', 'critical']
  } as Omit<ErrorEntry, 'id' | 'timestamp'>,

  validationError: {
    category: 'validation',
    source: 'user-input',
    severity: 'low',
    message: 'Invalid email format',
    context: {
      component: 'RegistrationForm',
      field: 'email',
      value: 'user@invalid'
    },
    impact: {
      userImpact: 'minor',
      functionalityImpact: ['form-submission']
    },
    preventionSuggestion: 'Add real-time email validation with clear error messages'
  } as Omit<ErrorEntry, 'id' | 'timestamp'>,

  networkError: {
    category: 'network',
    source: 'tauri-backend',
    severity: 'medium',
    message: 'Connection timeout',
    code: 'ETIMEDOUT',
    context: {
      operation: 'file-download',
      url: 'https://example.com/large-file.zip',
      timeout: 30000
    },
    impact: {
      userImpact: 'major',
      functionalityImpact: ['file-download', 'sync']
    },
    tags: ['network', 'timeout', 'backend']
  } as Omit<ErrorEntry, 'id' | 'timestamp'>,
};

// Helper to create operation with progress
export function createOperationWithProgress(
  base: typeof mockOperations[keyof typeof mockOperations],
  progress: number,
  status: Operation['status'] = 'running'
): Operation {
  return {
    ...base,
    id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    status,
    progress,
    startTime: Date.now() - (progress * 100), // Simulate time based on progress
  };
}

// Helper to create completed operation
export function createCompletedOperation(
  base: typeof mockOperations[keyof typeof mockOperations],
  duration: number = 5000,
  error?: Operation['error']
): Operation {
  const startTime = Date.now() - duration;
  return {
    ...base,
    id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    status: error ? 'error' : 'completed',
    progress: 100,
    startTime,
    endTime: startTime + duration,
    error,
  };
}

// Helper to create error log
export function createErrorLog(
  message: string,
  severity: ErrorLog['severity'] = 'medium',
  category: string = 'general'
): ErrorLog {
  return {
    id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    message,
    severity,
    category,
    acknowledged: false,
  };
}

// Helper to create multiple operations
export function createMultipleOperations(count: number): Operation[] {
  const operations: Operation[] = [];
  const types = Object.keys(mockOperations) as Array<keyof typeof mockOperations>;
  
  for (let i = 0; i < count; i++) {
    const typeIndex = i % types.length;
    const base = mockOperations[types[typeIndex]];
    const progress = Math.floor(Math.random() * 100);
    
    operations.push(createOperationWithProgress(base, progress));
  }
  
  return operations;
}

// Helper to create error patterns
export function createErrorPattern(baseError: typeof mockErrors[keyof typeof mockErrors], count: number) {
  const errors: ErrorEntry[] = [];
  
  for (let i = 0; i < count; i++) {
    errors.push({
      ...baseError,
      id: `err_${Date.now()}_${i}`,
      timestamp: Date.now() - (i * 60000), // Space out by 1 minute
      resolved: false,
    } as ErrorEntry);
  }
  
  return errors;
}

// Test data generators
export const generators = {
  // Generate operation history over time
  operationHistory(hours: number = 24): Operation[] {
    const operations: Operation[] = [];
    const now = Date.now();
    const hourMs = 60 * 60 * 1000;
    
    for (let h = 0; h < hours; h++) {
      const hourStart = now - (h * hourMs);
      const opsPerHour = Math.floor(Math.random() * 10) + 5;
      
      for (let i = 0; i < opsPerHour; i++) {
        const types = Object.keys(mockOperations) as Array<keyof typeof mockOperations>;
        const type = types[Math.floor(Math.random() * types.length)];
        const base = mockOperations[type];
        
        const duration = Math.random() * 10000 + 1000; // 1-11 seconds
        const startTime = hourStart - Math.random() * hourMs;
        const hasError = Math.random() < 0.1; // 10% error rate
        
        operations.push({
          ...base,
          id: `op_hist_${h}_${i}`,
          status: hasError ? 'error' : 'completed',
          progress: 100,
          startTime,
          endTime: startTime + duration,
          error: hasError ? {
            message: 'Random error occurred',
            severity: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)] as any,
          } : undefined,
        });
      }
    }
    
    return operations;
  },

  // Generate error trends
  errorTrends(days: number = 7): ErrorEntry[] {
    const errors: ErrorEntry[] = [];
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const errorTypes = Object.keys(mockErrors) as Array<keyof typeof mockErrors>;
    
    for (let d = 0; d < days; d++) {
      const dayStart = now - (d * dayMs);
      const errorsPerDay = Math.floor(Math.random() * 20) + 10;
      
      for (let i = 0; i < errorsPerDay; i++) {
        const type = errorTypes[Math.floor(Math.random() * errorTypes.length)];
        const base = mockErrors[type];
        
        errors.push({
          ...base,
          id: `err_trend_${d}_${i}`,
          timestamp: dayStart - Math.random() * dayMs,
          resolved: Math.random() < 0.7, // 70% resolution rate
          resolvedAt: Math.random() < 0.7 ? dayStart - Math.random() * (dayMs / 2) : undefined,
        } as ErrorEntry);
      }
    }
    
    return errors;
  },
};