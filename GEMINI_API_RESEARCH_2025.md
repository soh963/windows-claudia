# Gemini API Research Document - 2025
## Universal Model Compatibility Implementation Guide

### Executive Summary
This document provides comprehensive research on the latest Gemini API patterns, best practices, and critical implementation details for achieving universal model compatibility in 2025. Key findings include significant model deprecations, new authentication requirements, and important changes to model availability.

---

## 1. Latest Gemini API Model Naming Conventions

### Currently Available Models (2025)

#### Gemini 2.5 Series (Latest)
- **gemini-2.5-pro** - State-of-the-art thinking model with 1M token context (2M coming soon)
- **gemini-2.5-flash** - Cost-efficient model with thinking capabilities (coming soon)
- **gemini-2.5-pro-preview-tts** - Most powerful text-to-speech model

#### Gemini 2.0 Series
- **gemini-2.0-flash** - Fast, versatile model
- **gemini-2.0-flash-live** - Real-time streaming model

#### Gemini 1.5 Series (Restricted)
- **gemini-1.5-pro** - ⚠️ Not available for new projects after April 29, 2025
- **gemini-1.5-flash** - ⚠️ Not available for new projects after April 29, 2025

#### Deprecated Models
- **gemini-1.0-pro** - ❌ Discontinued April 2025
- **gemini-pro** - ❌ Returns 404 errors

### Model Naming Best Practices
```javascript
// ✅ CORRECT: Use full model names
const model = "gemini-2.5-pro";
const model = "gemini-2.0-flash";

// ❌ INCORRECT: Don't use deprecated aliases
const model = "gemini-pro"; // Will cause 404 error
const model = "gemini-1.0-pro"; // Discontinued

// ✅ PRODUCTION: Use explicit stable versions
const model = "gemini-2.5-pro"; // No three-digit suffix for stable versions

// ⚠️ PREVIEW: Three-digit suffixes indicate preview versions
const model = "gemini-2.5-pro-001"; // Preview version
```

---

## 2. Common Error Codes and Solutions

### Error: Model Not Found (404)

#### Causes and Solutions

1. **Model Deprecation**
```javascript
// Problem: Using deprecated model
const model = genAI.getGenerativeModel({ model: "gemini-pro" }); // 404 error

// Solution: Use current model
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // ✅
```

2. **API Version Mismatch**
```javascript
// Problem: Wrong API version
const url = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro";

// Solution: Use v1beta for 1.5 models
const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro";
```

3. **New Project Restrictions**
```javascript
// Check available models programmatically
async function getAvailableModels() {
  try {
    const response = await genAI.listModels();
    console.log("Available models:", response);
    return response;
  } catch (error) {
    console.error("Error listing models:", error);
  }
}
```

### Error: Rate Limit Exceeded (429)

```javascript
// Implement exponential backoff
async function callWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

### Error: Invalid API Key (401/403)

```javascript
// Correct authentication header
const headers = {
  'x-goog-api-key': API_KEY, // ✅ Correct header
  // NOT 'Authorization': `Bearer ${API_KEY}` ❌
};
```

---

## 3. Model-Specific Requirements and Limitations

### Gemini 2.5 Models (Thinking Models)

#### Special Considerations
```javascript
// Gemini 2.5 has thinking enabled by default
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-pro",
  generationConfig: {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 8192,
    // Thinking is ON by default - review documentation if migrating
  }
});
```

#### Context Window Limits
```javascript
const contextLimits = {
  "gemini-2.5-pro": 1000000,  // 1M tokens (2M coming soon)
  "gemini-2.0-flash": 1000000, // 1M tokens
  "gemini-1.5-pro": 2000000,   // 2M tokens (if available)
  "gemini-1.5-flash": 1000000  // 1M tokens (if available)
};
```

### Multimodal Capabilities
```javascript
// Different models support different modalities
const modalitySupport = {
  "gemini-2.5-pro": ["text", "image", "audio", "video", "code"],
  "gemini-2.0-flash": ["text", "image", "audio", "video"],
  "gemini-2.0-flash-live": ["text", "audio", "video"], // Real-time streaming
  "veo-2": ["video"] // Video generation only
};

// Note: Audio inputs negatively impact function calling
if (useAudio && useFunctionCalling) {
  console.warn("Audio + function calling may reduce accuracy");
}
```

---

## 4. Authentication and Rate Limiting Best Practices

### Authentication Methods

#### 1. Developer API (Quick Start)
```javascript
// Simple API key authentication
const genAI = new GoogleGenerativeAI(API_KEY);

// Include in HTTP requests
const headers = {
  'x-goog-api-key': API_KEY,
  'Content-Type': 'application/json'
};
```

#### 2. Vertex AI (Enterprise)
```javascript
// Service account authentication with ephemeral tokens
const {GoogleAuth} = require('google-auth-library');
const auth = new GoogleAuth({
  scopes: 'https://www.googleapis.com/auth/cloud-platform'
});

// Token must be refreshed every hour
async function getAuthToken() {
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  return accessToken.token;
}
```

### Rate Limit Management

#### Tier Structure (2025)
```javascript
const rateLimits = {
  free: {
    rpm: 5,        // Requests per minute
    tpm: 32000,    // Tokens per minute
    rpd: 25,       // Requests per day
    suitable: "development only"
  },
  tier1: {
    rpm: 300,      // Immediately after billing enabled
    tpm: 1000000,
    rpd: 1000,
    suitable: "small-medium production"
  },
  tier2: {
    rpm: 2000,     // After $250 spend + 30 days
    tpm: 4000000,
    rpd: 10000,
    suitable: "enterprise production"
  }
};
```

#### Request Batching Strategy
```javascript
// Batch multiple requests to optimize rate limits
async function batchRequests(prompts, batchSize = 10) {
  const batches = [];
  for (let i = 0; i < prompts.length; i += batchSize) {
    batches.push(prompts.slice(i, i + batchSize));
  }
  
  const results = [];
  for (const batch of batches) {
    const batchPrompt = batch.join('\n---\n');
    const result = await model.generateContent(batchPrompt);
    results.push(...parseBatchResponse(result));
  }
  return results;
}
```

#### Cost Optimization
```javascript
// Use batch mode for 50% cost reduction (non-real-time)
const batchConfig = {
  mode: 'batch',
  outputConfig: {
    gcsDestination: 'gs://bucket/output/'
  }
};

// Implement caching for repeated contexts
const cache = new Map();
async function generateWithCache(prompt, context) {
  const cacheKey = `${context}_${prompt}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  const result = await model.generateContent(prompt);
  cache.set(cacheKey, result);
  return result;
}
```

---

## 5. Streaming and Function Calling Requirements

### Streaming Implementation
```javascript
// Streaming with proper error handling
async function streamGeneration(prompt) {
  try {
    const result = await model.generateContentStream(prompt);
    
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      process.stdout.write(chunkText);
    }
    
    // Get the final aggregated response
    const response = await result.response;
    return response.text();
  } catch (error) {
    if (error.message.includes("stream")) {
      console.error("Streaming error - falling back to non-streaming");
      return await model.generateContent(prompt);
    }
    throw error;
  }
}
```

### Function Calling Best Practices
```javascript
// Define functions with robust error handling
const functions = [
  {
    name: "getWeather",
    description: "Get weather for a location",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "City and state"
        }
      },
      required: ["location"]
    }
  }
];

// Configure model with functions
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  tools: [{ functionDeclarations: functions }]
});

// Handle function calls
async function handleFunctionCall(response) {
  const call = response.functionCall;
  if (call) {
    try {
      const result = await executeFunction(call.name, call.args);
      // Return result to model for final response
      return await model.generateContent({
        contents: [
          { role: "model", parts: [{ functionCall: call }] },
          { role: "function", parts: [{ functionResponse: { 
            name: call.name, 
            response: result 
          }}]}
        ]
      });
    } catch (error) {
      // Return error to model for graceful handling
      return await model.generateContent({
        contents: [
          { role: "model", parts: [{ functionCall: call }] },
          { role: "function", parts: [{ functionResponse: { 
            name: call.name, 
            response: { error: error.message }
          }}]}
        ]
      });
    }
  }
  return response;
}
```

### Live API for Real-time Streaming
```javascript
// Live API with WebSocket for real-time interaction
const liveConfig = {
  model: "gemini-2.0-flash-live",
  config: {
    voiceActivityDetection: true,
    sessionManagement: true,
    functionCalling: true // Note: Limited with audio
  }
};

// Use BidiGenerateContentToolResponse for function responses
const toolResponse = {
  type: "BidiGenerateContentToolResponse",
  functionResponse: {
    name: "functionName",
    response: result
  }
};
```

---

## 6. Universal Model Compatibility Implementation

### Model Abstraction Layer
```javascript
class UniversalGeminiClient {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.availableModels = [];
    this.fallbackChain = options.fallbackChain || [
      "gemini-2.5-pro",
      "gemini-2.0-flash",
      "gemini-1.5-flash" // May not be available for new projects
    ];
  }
  
  async initialize() {
    // Discover available models
    try {
      const genAI = new GoogleGenerativeAI(this.apiKey);
      const models = await genAI.listModels();
      this.availableModels = models.map(m => m.name);
    } catch (error) {
      console.warn("Could not list models, using defaults");
      this.availableModels = this.fallbackChain;
    }
  }
  
  async getModel(preferredModel = null) {
    const modelToUse = preferredModel || this.fallbackChain[0];
    
    // Check if model is available
    if (this.availableModels.includes(modelToUse)) {
      return new GoogleGenerativeAI(this.apiKey)
        .getGenerativeModel({ model: modelToUse });
    }
    
    // Try fallback models
    for (const fallback of this.fallbackChain) {
      if (this.availableModels.includes(fallback)) {
        console.warn(`Model ${modelToUse} not available, using ${fallback}`);
        return new GoogleGenerativeAI(this.apiKey)
          .getGenerativeModel({ model: fallback });
      }
    }
    
    throw new Error("No compatible Gemini models available");
  }
  
  async generateContent(prompt, options = {}) {
    const model = await this.getModel(options.model);
    
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      if (error.status === 404) {
        // Model not found, try next fallback
        const nextModel = this.getNextFallback(options.model);
        if (nextModel) {
          return this.generateContent(prompt, { ...options, model: nextModel });
        }
      }
      throw error;
    }
  }
  
  getNextFallback(currentModel) {
    const index = this.fallbackChain.indexOf(currentModel);
    if (index >= 0 && index < this.fallbackChain.length - 1) {
      return this.fallbackChain[index + 1];
    }
    return null;
  }
}
```

### Error Recovery System
```javascript
class RobustGeminiClient extends UniversalGeminiClient {
  async generateContentWithRecovery(prompt, options = {}) {
    const maxRetries = options.maxRetries || 3;
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Try primary generation
        return await this.generateContent(prompt, options);
      } catch (error) {
        lastError = error;
        
        // Handle specific errors
        if (error.status === 429) {
          // Rate limit - exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(r => setTimeout(r, delay));
        } else if (error.status === 404) {
          // Model not found - handled by parent class
          throw error;
        } else if (error.status === 503) {
          // Service unavailable - wait and retry
          await new Promise(r => setTimeout(r, 5000));
        } else if (error.message?.includes("context length")) {
          // Context too long - truncate and retry
          prompt = this.truncatePrompt(prompt);
        } else {
          // Unknown error - log and retry
          console.error(`Attempt ${attempt + 1} failed:`, error);
        }
      }
    }
    
    throw lastError;
  }
  
  truncatePrompt(prompt, maxTokens = 30000) {
    // Simple truncation - in production, use proper tokenizer
    const estimatedTokens = prompt.length / 4;
    if (estimatedTokens > maxTokens) {
      const truncateRatio = maxTokens / estimatedTokens;
      return prompt.substring(0, prompt.length * truncateRatio);
    }
    return prompt;
  }
}
```

---

## 7. Production Deployment Checklist

### Pre-Deployment
- [ ] Verify model availability using `listModels()` API
- [ ] Implement model fallback chain for resilience
- [ ] Set up proper authentication (API key for dev, service account for production)
- [ ] Configure rate limit handling with exponential backoff
- [ ] Implement request batching for efficiency
- [ ] Set up monitoring for 429 and 404 errors
- [ ] Test with all target model versions

### Deployment Configuration
```javascript
const productionConfig = {
  // Model selection
  primaryModel: "gemini-2.5-pro",
  fallbackModels: ["gemini-2.0-flash", "gemini-1.5-flash"],
  
  // Rate limiting
  maxRequestsPerMinute: 250, // Leave buffer from 300 RPM limit
  batchSize: 10,
  
  // Error handling
  maxRetries: 3,
  retryDelay: 1000,
  exponentialBackoff: true,
  
  // Monitoring
  logErrors: true,
  alertOn429: true,
  trackModelUsage: true,
  
  // Cost optimization
  useBatchMode: true, // For non-real-time requests
  enableCaching: true,
  cacheTimeout: 3600,
  
  // Safety
  maxContextLength: 900000, // Leave buffer from 1M limit
  truncateOnOverflow: true
};
```

### Monitoring and Alerts
```javascript
// Monitor critical metrics
const metrics = {
  modelAvailability: async () => {
    const models = await client.listModels();
    return models.length > 0;
  },
  
  errorRate: () => {
    const errors = getErrorCount();
    const total = getTotalRequests();
    return errors / total;
  },
  
  rateLimitUtilization: () => {
    const current = getCurrentRPM();
    const limit = getRateLimit();
    return current / limit;
  },
  
  costPerRequest: () => {
    const totalCost = getBillingCost();
    const requests = getTotalRequests();
    return totalCost / requests;
  }
};

// Set up alerts
if (metrics.errorRate() > 0.05) {
  alert("High error rate detected");
}
if (metrics.rateLimitUtilization() > 0.8) {
  alert("Approaching rate limit");
}
```

---

## 8. Migration Guide from Deprecated Models

### From gemini-pro to gemini-2.0-flash
```javascript
// OLD CODE (will fail)
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// NEW CODE
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// With compatibility wrapper
const model = await getCompatibleModel("gemini-pro", {
  mapping: {
    "gemini-pro": "gemini-2.0-flash",
    "gemini-1.0-pro": "gemini-2.0-flash",
    "gemini-1.0-pro-vision": "gemini-2.0-flash"
  }
});
```

### Handling Thinking Models (2.5 Series)
```javascript
// When migrating to 2.5 models
if (modelName.includes("2.5")) {
  console.log("Note: This model includes thinking capabilities by default");
  // Review thinking guide documentation
  // Adjust prompts if necessary
}
```

---

## Key Takeaways

1. **Model Deprecation is Real**: gemini-1.0-pro is gone, gemini-1.5 models restricted for new projects
2. **Use Full Model Names**: Always use complete model names (e.g., "gemini-2.0-flash")
3. **Implement Fallbacks**: Multiple models may be unavailable, always have alternatives
4. **Free Tier is Unusable**: 5 RPM is only for testing, upgrade for production
5. **Batch Requests**: Critical for staying within rate limits
6. **Monitor Everything**: Track errors, usage, and costs proactively
7. **Plan for Changes**: Google is actively updating models and policies

## Resources

- [Official Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
- [Google AI Studio](https://ai.google.dev)
- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/generative-ai/docs)
- [Gemini API Cookbook](https://github.com/google-gemini/cookbook)

---

*Last Updated: August 2025*
*Document Version: 1.0*