# Gemini Model Integration Guide for Claudia

## Overview
This document outlines the integration of Google Gemini models into Claudia's chat interface, enabling users to select and use Gemini models alongside Claude with API key authentication.

## Requirements
- Add Gemini models (gemini-pro, gemini-pro-vision, gemini-1.5-pro) to the model selector in Claudia's chat interface
- API key authentication for Gemini access
- Full feature parity with Claude - all Claudia features must work identically with Gemini
- Seamless switching between Claude and Gemini models

## Architecture

### System Overview
```
Claudia Chat Interface
    ├── Model Selector (Claude + Gemini)
    ├── API Key Management
    └── Unified Chat Experience
           ↓
Tauri Backend (Rust)
    ├── Claude Service (existing)
    └── Gemini Service (new)
           ↓
External APIs
    ├── Claude API
    └── Gemini API
```

## Implementation Plan

### 1. Backend Implementation (Rust)

#### Gemini Service Module
Create `src-tauri/src/services/gemini_service.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct GeminiConfig {
    pub api_key: Option<String>,
    pub model: String,
    pub temperature: f32,
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeminiRequest {
    pub prompt: String,
    pub model: String,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeminiResponse {
    pub content: String,
    pub model: String,
    pub usage: TokenUsage,
}

pub struct GeminiService {
    api_key: String,
}

impl GeminiService {
    pub async fn chat(&self, request: GeminiRequest) -> Result<GeminiResponse, String> {
        // Implement Gemini API call
    }
}
```

#### Tauri Commands
Add to `src-tauri/src/main.rs`:

```rust
#[tauri::command]
async fn gemini_chat(request: GeminiRequest) -> Result<GeminiResponse, String> {
    // Implementation
}

#[tauri::command]
async fn set_gemini_api_key(api_key: String) -> Result<(), String> {
    // Securely store API key
}

#[tauri::command]
async fn verify_gemini_api_key(api_key: String) -> Result<bool, String> {
    // Verify API key validity
}
```

### 2. Frontend Implementation (TypeScript/React)

#### Update Model Types
Update `src/lib/types.ts`:

```typescript
export type ModelProvider = 'claude' | 'gemini';

export interface Model {
  id: string;
  name: string;
  provider: ModelProvider;
  description: string;
  contextWindow: number;
  supportsVision?: boolean;
}

export const AVAILABLE_MODELS: Model[] = [
  // Existing Claude models
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'claude', contextWindow: 200000 },
  { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', provider: 'claude', contextWindow: 200000 },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'claude', contextWindow: 200000 },
  
  // New Gemini models
  { id: 'gemini-pro', name: 'Gemini Pro', provider: 'gemini', contextWindow: 32768 },
  { id: 'gemini-pro-vision', name: 'Gemini Pro Vision', provider: 'gemini', contextWindow: 32768, supportsVision: true },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'gemini', contextWindow: 1048576 },
];
```

#### Model Selector Component
Update the model selector to include Gemini models:

```typescript
interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ selectedModel, onModelChange }) => {
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  
  const handleModelChange = async (modelId: string) => {
    const model = AVAILABLE_MODELS.find(m => m.id === modelId);
    
    if (model?.provider === 'gemini') {
      // Check if Gemini API key is set
      const hasKey = await checkGeminiApiKey();
      if (!hasKey) {
        setShowApiKeyModal(true);
        return;
      }
    }
    
    onModelChange(modelId);
  };
  
  return (
    <>
      <select value={selectedModel} onChange={(e) => handleModelChange(e.target.value)}>
        <optgroup label="Claude Models">
          {AVAILABLE_MODELS.filter(m => m.provider === 'claude').map(model => (
            <option key={model.id} value={model.id}>{model.name}</option>
          ))}
        </optgroup>
        <optgroup label="Gemini Models">
          {AVAILABLE_MODELS.filter(m => m.provider === 'gemini').map(model => (
            <option key={model.id} value={model.id}>{model.name}</option>
          ))}
        </optgroup>
      </select>
      
      {showApiKeyModal && (
        <ApiKeyModal
          onSubmit={async (key) => {
            await setGeminiApiKey(key);
            setShowApiKeyModal(false);
            onModelChange(selectedModel);
          }}
          onCancel={() => setShowApiKeyModal(false)}
        />
      )}
    </>
  );
};
```

#### API Key Modal Component
```typescript
interface ApiKeyModalProps {
  onSubmit: (key: string) => void;
  onCancel: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onSubmit, onCancel }) => {
  const [apiKey, setApiKey] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  
  const handleSubmit = async () => {
    setIsVerifying(true);
    const isValid = await verifyGeminiApiKey(apiKey);
    if (isValid) {
      onSubmit(apiKey);
    } else {
      alert('Invalid API key');
    }
    setIsVerifying(false);
  };
  
  return (
    <div className="modal">
      <div className="modal-content">
        <h2>Enter Gemini API Key</h2>
        <p>To use Gemini models, please provide your API key from Google AI Studio.</p>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter your Gemini API key"
        />
        <div className="modal-actions">
          <button onClick={handleSubmit} disabled={!apiKey || isVerifying}>
            {isVerifying ? 'Verifying...' : 'Submit'}
          </button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
};
```

### 3. Chat Service Updates

Update the chat service to handle both Claude and Gemini:

```typescript
export class UnifiedChatService {
  async sendMessage(message: string, modelId: string): Promise<ChatResponse> {
    const model = AVAILABLE_MODELS.find(m => m.id === modelId);
    
    if (model?.provider === 'claude') {
      return await this.sendClaudeMessage(message, modelId);
    } else if (model?.provider === 'gemini') {
      return await this.sendGeminiMessage(message, modelId);
    }
    
    throw new Error('Unknown model provider');
  }
  
  private async sendClaudeMessage(message: string, modelId: string): Promise<ChatResponse> {
    // Existing Claude implementation
  }
  
  private async sendGeminiMessage(message: string, modelId: string): Promise<ChatResponse> {
    const response = await invoke('gemini_chat', {
      request: {
        prompt: message,
        model: modelId,
        temperature: 0.7,
        max_tokens: 4096
      }
    });
    
    return {
      content: response.content,
      model: modelId,
      usage: response.usage
    };
  }
}
```

### 4. Settings Integration

Add Gemini API key management to settings:

```typescript
// In Settings component
<SettingsSection title="API Keys">
  <SettingItem
    label="Gemini API Key"
    description="Your Google AI Studio API key for Gemini models"
  >
    <input
      type="password"
      value={geminiApiKey}
      onChange={(e) => setGeminiApiKey(e.target.value)}
      placeholder="sk-..."
    />
    <button onClick={saveGeminiApiKey}>Save</button>
  </SettingItem>
</SettingsSection>
```

## Security Considerations

1. **API Key Storage**: Store Gemini API keys securely using Tauri's built-in secure storage
2. **Key Validation**: Verify API keys before saving
3. **Error Handling**: Gracefully handle API errors and quota limits
4. **Rate Limiting**: Implement rate limiting to prevent API abuse

## Testing Requirements

1. **Model Switching**: Verify seamless switching between Claude and Gemini models
2. **Feature Parity**: Test all Claudia features with Gemini models:
   - File uploads
   - Code execution
   - Project context
   - Search functionality
   - All existing commands and tools
3. **API Key Management**: Test key validation, storage, and error handling
4. **Performance**: Ensure response times are comparable between providers

## Migration Notes

- No breaking changes to existing Claude functionality
- API keys are stored per-provider (Claude and Gemini keys are separate)
- User can switch between models at any time during a conversation
- Context is maintained when switching models within the same session