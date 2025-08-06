# Unified Chat System Documentation

## Overview

The Unified Chat System enables seamless sharing of chat sessions between Claude and Gemini models, allowing users to switch between AI models without losing conversation context. This system provides a unified interface for managing conversations across different AI providers.

## Architecture

### Core Components

1. **UnifiedChatStore** (`src/stores/unifiedChatStore.ts`)
   - Central state management for unified sessions
   - Handles model switching and message synchronization
   - Maintains session history and model switch tracking

2. **Progress Tracker Widget** (`src/components/ProgressTrackerWidget.tsx`)
   - Real-time visualization of conversation metrics
   - Tracks completion rates, error rates, and response times
   - Displays goal achievement and model switching statistics

3. **Model Selector Compact** (`src/components/ModelSelectorCompact.tsx`)
   - Optimized UI component with reduced width
   - Shows only essential model information
   - Handles API key requirements for Gemini models

## Features

### 1. Shared Session Management

Sessions can be shared between Claude and Gemini models with full context preservation:

```typescript
interface UnifiedSession extends Session {
  messages: ChatMessage[];
  currentModel: string;
  provider: ModelProvider;
  isActive: boolean;
  lastActivity: Date;
  sharedBetweenModels: boolean;
  modelSwitchHistory: Array<{
    fromModel: string;
    toModel: string;
    timestamp: Date;
    messageIndex: number;
  }>;
}
```

### 2. Auto Model Selection

The system includes intelligent model selection based on:
- **Context window usage**: Switches to Gemini for large contexts (>150K tokens)
- **Task complexity**: Uses Claude Opus for complex tasks
- **Code analysis**: Prefers Claude for code-heavy conversations
- **Performance needs**: Uses Gemini Flash for quick responses
- **Image processing**: Selects models with vision capabilities

### 3. Progress Tracking

Real-time metrics include:
- **Completion Percentage**: Successful responses / total user messages
- **Error Rate**: Failed messages / total messages
- **Average Response Time**: Mean processing time across messages
- **Goals Achievement**: Completed vs total goals
- **Model Switches**: Number of model changes in session
- **Active Time**: Session duration in minutes

## Usage

### Creating a Unified Session

```typescript
import { useUnifiedChatStore } from '@/stores/unifiedChatStore';

const { createSession } = useUnifiedChatStore();

// Create new session with initial model
const session = await createSession(projectId, 'sonnet');
```

### Switching Models

```typescript
const { switchModel } = useUnifiedChatStore();

// Switch to Gemini model within same session
switchModel(sessionId, 'gemini-2.0-flash-exp');
```

### Sending Messages

```typescript
const { sendMessage } = useUnifiedChatStore();

// Send message - automatically routes to correct provider
await sendMessage(sessionId, 'Hello, can you help with this code?');
```

### Progress Tracking Integration

```tsx
import { ProgressTrackerWidget } from '@/components/ProgressTrackerWidget';

// Full view with details
<ProgressTrackerWidget 
  sessionId={currentSessionId}
  showDetails={true}
/>

// Compact view for chat header
<ProgressTrackerWidget 
  sessionId={currentSessionId}
  compact={true}
/>
```

### Model Selector Usage

```tsx
import { ModelSelectorCompact } from '@/components/ModelSelectorCompact';

<ModelSelectorCompact
  value={currentModel}
  onChange={(modelId) => switchModel(sessionId, modelId)}
  onGeminiApiKeyNeeded={() => openApiKeyModal()}
/>
```

## Model Selection Strategy

### Auto Mode Logic

When using the "Auto" model selection, the system analyzes:

1. **Context Window Requirements**
   - Switches to Gemini models for contexts exceeding Claude's limits
   - Prioritizes models with larger context windows for document analysis

2. **Task Complexity Analysis**
   - Uses pattern recognition to identify complex reasoning needs
   - Routes to Claude Opus for sophisticated analysis

3. **Performance Optimization**
   - Selects faster models for simple queries
   - Balances response quality with speed

4. **Capability Matching**
   - Ensures selected model supports required features (vision, etc.)
   - Validates API key availability for Gemini models

## Error Handling

The system includes comprehensive error handling:

1. **API Key Validation**: Checks for Gemini API key before switching
2. **Graceful Degradation**: Falls back to available models on failure
3. **Error Tracking**: Monitors and displays error rates in progress tracker
4. **Recovery Mechanisms**: Automatic retry with exponential backoff

## Testing

### Running Tests

```bash
# Run auto-model selection tests
npm run test:run -- src/tests/autoModelSelection.test.ts

# Run integration tests
npm run test:integration
```

### Test Coverage

- Model selection logic validation
- Context analysis accuracy
- API integration testing
- UI component behavior
- Error handling scenarios

## Future Enhancements

1. **Advanced Context Analysis**
   - Semantic understanding of conversation topics
   - Predictive model switching based on patterns

2. **Performance Optimization**
   - Response caching across models
   - Parallel model queries for comparison

3. **Enhanced Metrics**
   - Cost tracking per model
   - Quality scoring for responses
   - User satisfaction metrics

4. **Multi-Model Collaboration**
   - Concurrent queries to multiple models
   - Ensemble responses for critical tasks