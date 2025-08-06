# Ollama Streaming Fix - Final Solution

## Problem Analysis

The Ollama streaming hang was caused by:
1. Ollama is configured as an OpenAI-compatible endpoint (`http://localhost:11434/v1`)
2. The OpenAI streaming protocol differs from Ollama's native implementation
3. Even with non-streaming mode forced, the request still hangs

## Investigation Results

From the logs:
```
2025/08/06 15:58:48 INFO baseProvider.StreamResponse called providerType=openai baseURL=http://localhost:11434/v1
2025/08/06 15:58:48 WARN Detected Ollama endpoint, using non-streaming mode to avoid hanging baseURL=http://localhost:11434/v1
```

The detection is working, but the non-streaming request also hangs. This indicates that:
1. The issue might be with the OpenAI client library's interaction with Ollama
2. The `/v1` endpoint might not be fully compatible with OpenAI's API
3. There could be an issue with how the request is being formatted

## Recommended Solution

### Option 1: Use Ollama's Native API (Best Long-term Solution)

Instead of using the OpenAI compatibility layer, use Ollama's native API directly:

1. Change the base URL from `http://localhost:11434/v1` to `http://localhost:11434`
2. Use the native Ollama provider implementation that already exists in the codebase
3. This requires modifying the provider factory to support native Ollama

### Option 2: Fix the OpenAI Compatibility (Quick Fix)

The issue might be that Ollama's OpenAI compatibility expects specific headers or parameters. Try:

1. Remove the `/v1` suffix and use `/api/chat` directly
2. Add specific headers that Ollama might expect
3. Ensure the model name format is correct

### Option 3: Use a Different Configuration

Configure Ollama differently in crush.json:

```json
{
  "providers": {
    "ollama": {
      "base_url": "http://localhost:11434/api",
      "api_key": "not-needed",
      "type": "openai",
      "models": [
        {
          "id": "llama3.2:3b",
          "name": "llama3.2:3b",
          "max_tokens": 4096
        }
      ]
    }
  }
}
```

## Implementation Status

- ✅ Ollama detection implemented
- ✅ Non-streaming mode forced for Ollama
- ❌ Request still hangs - likely due to API incompatibility

## Next Steps

1. Test with direct Ollama API calls to verify the server is working
2. Modify the configuration to use the correct Ollama endpoints
3. Consider implementing native Ollama provider support
4. Add timeout handling for non-streaming requests

## Test Commands

```bash
# Test Ollama directly
curl -X POST http://localhost:11434/api/chat -d '{
  "model": "llama3.2:3b",
  "messages": [{"role": "user", "content": "Hello"}],
  "stream": false
}'

# Test with crush (after fix)
crush run "Hello, how are you?"
```