# Ollama Streaming Bug - Final Analysis Report

## Executive Summary

The Ollama streaming bug persists despite implementing multiple fixes. The root cause is deeper than initially suspected - the OpenAI Go client library appears to hang when communicating with Ollama's OpenAI-compatible endpoint, even in non-streaming mode.

## Fixes Attempted

1. **Timeout Protection in Streaming** ✅
   - Added idle timeout detection (3 seconds)
   - Added overall stream timeout (10 seconds)
   - Result: Still hangs during streaming

2. **Force Non-Streaming for Ollama** ✅
   - Detect Ollama endpoints by URL patterns
   - Force non-streaming mode when Ollama detected
   - Result: Detection works, but non-streaming also hangs

3. **Timeout on Non-Streaming Requests** ✅
   - Added 30-second timeout to non-streaming requests
   - Result: Timeout doesn't trigger - hang occurs in OpenAI client

## Root Cause Analysis

The hang occurs within the OpenAI Go client library (`github.com/openai/openai-go`) when:
1. Making requests to Ollama's OpenAI-compatible endpoint (`http://localhost:11434/v1`)
2. Both streaming and non-streaming modes are affected
3. The client library doesn't respect context timeouts properly

Evidence from logs:
```
2025/08/06 16:00:08 INFO Sending non-streaming request to Ollama timeout=30s
[No timeout error after 30s - process hangs until killed]
```

## Why Current Approach Failed

1. **API Incompatibility**: Ollama's OpenAI compatibility layer may not fully implement the OpenAI API spec
2. **Client Library Issue**: The OpenAI Go client might have specific expectations that Ollama doesn't meet
3. **Missing Headers/Parameters**: Ollama might require specific headers or parameters not being sent

## Recommended Solutions

### Solution 1: Use Native Ollama Implementation (Recommended)

The codebase already has a native Ollama provider implementation that's not being used:
- `internal/ollama/provider.go` - Native Ollama provider
- `internal/ollama/client.go` - Native Ollama HTTP client

To implement:
1. Add `TypeOllama` to the catwalk provider types
2. Modify `provider.NewProvider` to support Ollama type
3. Update configuration to use native Ollama instead of OpenAI compatibility

### Solution 2: Direct HTTP Implementation

Bypass the OpenAI client library entirely for Ollama:
1. Implement direct HTTP calls to Ollama's API
2. Use Ollama's native endpoints (`/api/chat` instead of `/v1/chat/completions`)
3. Handle the response format differences

### Solution 3: Alternative Ollama Configuration

Try different Ollama endpoint configurations:
```json
{
  "providers": {
    "ollama": {
      "base_url": "http://localhost:11434/api",  // Use native API
      "type": "custom",  // Custom type with direct implementation
      "models": [...]
    }
  }
}
```

### Solution 4: Fix OpenAI Client Timeout Handling

The OpenAI client library might not respect Go context timeouts. Options:
1. Fork and fix the OpenAI client library
2. Wrap the client with proper timeout handling
3. Use a different OpenAI-compatible client library

## Immediate Workaround

For users needing to use Ollama immediately:
1. Use a different LLM provider (OpenAI, Anthropic, etc.)
2. Run Ollama through a proxy that properly implements OpenAI compatibility
3. Use the Ollama CLI directly instead of crush

## Test Results

- ✅ Ollama server is running and responding (verified with curl)
- ✅ Crush detects Ollama endpoints correctly
- ✅ Non-streaming mode is activated for Ollama
- ❌ Both streaming and non-streaming requests hang
- ❌ Timeouts don't trigger within OpenAI client

## Conclusion

The issue is not with the streaming implementation but with the OpenAI client library's interaction with Ollama's compatibility layer. The best solution is to use the native Ollama implementation that already exists in the codebase, which would bypass all compatibility issues.