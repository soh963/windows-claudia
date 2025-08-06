# Ollama Streaming Fix Analysis

## Root Cause Analysis

The streaming bug persists because of a fundamental architectural issue:

1. **Ollama is configured as an OpenAI-compatible provider** (`"type": "openai"` in crush.json)
2. **There's a native Ollama provider implementation** that's not being used
3. **The OpenAI streaming protocol differs from Ollama's native protocol**

## Why the Current Fix Failed

The timeout fix in `openai.go` (lines 340-402) attempts to handle streaming timeouts, but:
- Ollama's streaming response format might differ from OpenAI's
- The idle timeout detection might not trigger properly if Ollama sends keep-alive messages
- The OpenAI client expects specific streaming chunk formats that Ollama might not provide

## Evidence of the Issue

From the code analysis:
- `provider.go` only handles specific types (Anthropic, OpenAI, Gemini, etc.) but no Ollama type
- `config/load.go` creates an Ollama provider with `Type: catwalk.TypeOpenAI`
- The native `ollama/provider.go` implements proper Ollama streaming but isn't used

## Proposed Solutions

### Solution 1: Use Native Ollama Provider (Recommended)

Modify the provider factory to support native Ollama:

1. Add `TypeOllama` to catwalk types
2. Update `provider.NewProvider` to handle Ollama type
3. Change configuration to use native Ollama instead of OpenAI compatibility

### Solution 2: Fix Ollama-Specific Streaming in OpenAI Provider

Add Ollama-specific handling in the OpenAI provider:

1. Detect when the endpoint is Ollama (by checking base URL)
2. Implement Ollama-specific streaming parsing
3. Handle Ollama's response format differences

### Solution 3: Force Non-Streaming for Ollama

As a quick workaround, disable streaming for Ollama:

1. Detect Ollama endpoint in the OpenAI provider
2. Force `stream: false` for Ollama requests
3. Use the synchronous API instead

## Recommended Implementation

The best approach is **Solution 3** as an immediate fix, followed by **Solution 1** for a proper long-term solution.

### Immediate Fix (Solution 3)

```go
// In openai.go, modify the stream function:
func (o *openaiClient) stream(ctx context.Context, messages []message.Message, tools []tools.BaseTool) <-chan ProviderEvent {
    // Detect if this is Ollama
    isOllama := strings.Contains(o.providerOptions.baseURL, "localhost:11434") || 
                strings.Contains(o.providerOptions.baseURL, "ollama")
    
    if isOllama {
        // Force non-streaming for Ollama
        eventChan := make(chan ProviderEvent, 1)
        go func() {
            defer close(eventChan)
            
            response, err := o.send(ctx, messages, tools)
            if err != nil {
                eventChan <- ProviderEvent{Type: EventError, Error: err}
                return
            }
            
            // Send the complete response as a single event
            eventChan <- ProviderEvent{
                Type:    EventContentDelta,
                Content: response.Content,
            }
            eventChan <- ProviderEvent{
                Type:     EventComplete,
                Response: response,
            }
        }()
        return eventChan
    }
    
    // Continue with normal streaming for non-Ollama providers
    // ... existing streaming code ...
}
```

## Test Commands

After implementing the fix:

```bash
# Test basic completion
crush run "Hello, how are you?"

# Test with specific model
crush run "Write a short poem about coding" --model llama3.2:3b

# Test with longer response
crush run "Explain quantum computing in simple terms"
```

## Success Criteria

- Commands complete within 10 seconds
- No hanging or infinite "Generating..." dots
- Proper response displayed in the terminal
- Both streaming and non-streaming modes work correctly