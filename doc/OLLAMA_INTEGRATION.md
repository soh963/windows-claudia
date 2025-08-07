# Claudia: Ollama Integration

**Date**: August 2025
**Version**: 1.0.0

This document provides a comprehensive analysis of the Ollama integration within the Claudia AI assistant platform, detailing the streaming bug, its root cause, and the final implemented solution.

---

## Table of Contents
1.  [Final Solution for Ollama Streaming Fix](#1-final-solution-for-ollama-streaming-fix)
2.  [Final Analysis Report on Ollama Streaming Bug](#2-final-analysis-report-on-ollama-streaming-bug)
3.  [Analysis of Ollama Streaming Fix Attempts](#3-analysis-of-ollama-streaming-fix-attempts)

---

## 1. Final Solution for Ollama Streaming Fix

### Problem Analysis
The Ollama streaming process was hanging because it was configured as an OpenAI-compatible endpoint (`http://localhost:11434/v1`), but the OpenAI streaming protocol differs from Ollama's native implementation. Even when non-streaming mode was forced, the request still hung.

### Recommended Solution
The best long-term solution is to use Ollama's native API directly, rather than relying on the OpenAI compatibility layer. This involves:
1.  Changing the base URL from `http://localhost:11434/v1` to `http://localhost:11434`.
2.  Utilizing the native Ollama provider implementation that already exists in the codebase.
3.  Modifying the provider factory to support the native Ollama provider type.

As a quick fix, it was suggested to force non-streaming for Ollama, but this also resulted in a hanging request, indicating a deeper incompatibility with the OpenAI client library.

---

## 2. Final Analysis Report on Ollama Streaming Bug

### Executive Summary
The Ollama streaming bug persists due to a fundamental issue with the OpenAI Go client library (`github.com/openai/openai-go`), which hangs when communicating with Ollama's OpenAI-compatible endpoint, even in non-streaming mode. The client library does not properly respect context timeouts in this scenario.

### Root Cause
- **API Incompatibility**: Ollama's OpenAI compatibility layer may not fully implement the OpenAI API specification.
- **Client Library Issue**: The OpenAI Go client may have specific expectations that Ollama does not meet.
- **Missing Headers/Parameters**: The requests might be lacking specific headers or parameters that Ollama requires.

### Recommended Solutions
- **Use Native Ollama Implementation (Recommended)**: The codebase already contains a native Ollama provider (`internal/ollama/provider.go`) that is not currently being used. The best solution is to add `TypeOllama` to the provider types and modify the provider factory to use this native implementation.
- **Direct HTTP Implementation**: Bypass the OpenAI client library entirely and make direct HTTP calls to Ollama's native API endpoints (e.g., `/api/chat`).

---

## 3. Analysis of Ollama Streaming Fix Attempts

### Root Cause Analysis
The streaming bug was caused by an architectural issue where Ollama was configured as an OpenAI-compatible provider, but the native Ollama provider implementation was not being used. The streaming protocols for OpenAI and Ollama differ, leading to the failure.

### Why Fixes Failed
- The timeout fix in `openai.go` was ineffective because Ollama's streaming response format differs from OpenAI's, and the idle timeout detection did not trigger as expected.

### Proposed Solutions
- **Immediate Fix**: Force non-streaming for Ollama by detecting the endpoint URL and using the synchronous API instead. This was implemented as a temporary workaround.
- **Long-term Solution (Recommended)**: Modify the provider factory to support the native Ollama provider. This involves adding a `TypeOllama` to the provider types and updating the configuration to use the native implementation, which would resolve the protocol mismatch.
