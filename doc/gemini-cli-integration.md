# Gemini CLI와 Claudia 통합 가이드

## 개요
이 문서는 Google Gemini CLI와 Claudia의 통합 방법과 관련된 모든 내용을 포함합니다.

## 목차
1. [개요](#개요)
2. [Gemini CLI 설치 및 설정](#gemini-cli-설치-및-설정)
3. [Claudia에서 Gemini CLI 통합 구조](#claudia에서-gemini-cli-통합-구조)
4. [구현 계획](#구현-계획)
5. [API 설계](#api-설계)
6. [UI 컴포넌트 설계](#ui-컴포넌트-설계)
7. [Tauri 백엔드 구현](#tauri-백엔드-구현)
8. [프론트엔드 구현](#프론트엔드-구현)
9. [설정 관리](#설정-관리)
10. [테스트 계획](#테스트-계획)
11. [배포 및 릴리스](#배포-및-릴리스)
12. [문제 해결](#문제-해결)

---

## Gemini CLI 설치 및 설정

### 1. Gemini CLI 설치

#### Windows에서 설치
```bash
# npm을 통한 설치
npm install -g @google/generative-ai-cli

# 또는 Google AI Studio에서 직접 설치
curl -O https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe
```

#### API 키 설정
```bash
# API 키 설정
gemini auth login
# 또는 환경 변수로 설정
set GEMINI_API_KEY=your_api_key_here
```

### 2. 기본 명령어
```bash
# 기본 채팅
gemini chat "Hello, how are you?"

# 파일과 함께 채팅
gemini chat "Analyze this code" --file path/to/file.js

# 모델 지정
gemini chat "Hello" --model gemini-pro

# 출력 형식 지정
gemini chat "Generate JSON" --format json
```

---

## Claudia에서 Gemini CLI 통합 구조

### 아키텍처 개요
```
┌─────────────────────┐
│    Claudia UI       │
│  ┌───────────────┐  │
│  │ Gemini Panel  │  │
│  │ - Chat UI     │  │
│  │ - Settings    │  │
│  │ - History     │  │
│  └───────────────┘  │
└─────────┬───────────┘
          │
┌─────────▼───────────┐
│   Tauri Backend     │
│  ┌───────────────┐  │
│  │ Gemini Service│  │
│  │ - CLI Wrapper │  │
│  │ - Process Mgmt│  │
│  │ - Config      │  │
│  └───────────────┘  │
└─────────┬───────────┘
          │
┌─────────▼───────────┐
│   Gemini CLI        │
│ - Google AI API     │
│ - Model Access      │
│ - Authentication    │
└─────────────────────┘
```

---

## 구현 계획

### Phase 1: 기본 통합 (1-2주)
- [x] Gemini CLI 설치 및 테스트
- [ ] Tauri 백엔드에 Gemini CLI 래퍼 구현
- [ ] 기본 채팅 인터페이스 구현
- [ ] API 키 관리 시스템

### Phase 2: 고급 기능 (2-3주)
- [ ] 파일 업로드 및 분석 기능
- [ ] 다중 모델 지원 (Gemini Pro, Gemini Vision 등)
- [ ] 채팅 히스토리 저장 및 관리
- [ ] 설정 UI 구현

### Phase 3: 최적화 및 고급 통합 (2-3주)
- [ ] Claude Code와 Gemini 간 컨텍스트 공유
- [ ] 멀티모달 지원 (이미지, 문서 분석)
- [ ] 배치 처리 및 자동화 기능
- [ ] 성능 최적화

### Phase 4: 고급 에이전트 통합 (3-4주)
- [ ] CC Agents에 Gemini 백엔드 추가
- [ ] 하이브리드 AI 워크플로우 구현
- [ ] 비교 분석 도구
- [ ] 다중 AI 에이전트 조정

---

## API 설계

### Tauri Commands 구조

```rust
// src-tauri/src/commands/gemini.rs

use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct GeminiConfig {
    pub api_key: Option<String>,
    pub default_model: String,
    pub temperature: f32,
    pub max_tokens: Option<u32>,
    pub cli_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeminiChatRequest {
    pub message: String,
    pub model: Option<String>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub files: Option<Vec<String>>,
    pub context: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeminiChatResponse {
    pub content: String,
    pub model_used: String,
    pub tokens_used: Option<u32>,
    pub timestamp: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeminiModel {
    pub name: String,
    pub display_name: String,
    pub description: String,
    pub input_token_limit: u32,
    pub output_token_limit: u32,
    pub supports_vision: bool,
}

// Tauri Commands
#[tauri::command]
pub async fn gemini_chat(request: GeminiChatRequest) -> Result<GeminiChatResponse, String> {
    // Gemini CLI 호출 구현
}

#[tauri::command]
pub async fn gemini_get_models() -> Result<Vec<GeminiModel>, String> {
    // 사용 가능한 모델 목록 조회
}

#[tauri::command]
pub async fn gemini_set_config(config: GeminiConfig) -> Result<(), String> {
    // 설정 저장
}

#[tauri::command]
pub async fn gemini_get_config() -> Result<GeminiConfig, String> {
    // 설정 조회
}

#[tauri::command]
pub async fn gemini_check_cli() -> Result<bool, String> {
    // CLI 설치 상태 확인
}

#[tauri::command]
pub async fn gemini_install_cli() -> Result<String, String> {
    // CLI 자동 설치 (npm을 통해)
}
```

### TypeScript 타입 정의

```typescript
// src/lib/types/gemini.ts

export interface GeminiConfig {
  apiKey?: string;
  defaultModel: string;
  temperature: number;
  maxTokens?: number;
  cliPath?: string;
}

export interface GeminiChatRequest {
  message: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  files?: string[];
  context?: string;
}

export interface GeminiChatResponse {
  content: string;
  modelUsed: string;
  tokensUsed?: number;
  timestamp: string;
  error?: string;
}

export interface GeminiModel {
  name: string;
  displayName: string;
  description: string;
  inputTokenLimit: number;
  outputTokenLimit: number;
  supportsVision: boolean;
}

export interface GeminiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  model?: string;
  files?: string[];
  tokensUsed?: number;
}

export interface GeminiSession {
  id: string;
  title: string;
  messages: GeminiChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  model: string;
  totalTokens: number;
}
```

---

## UI 컴포넌트 설계

### 1. GeminiPanel 메인 컴포넌트

```typescript
// src/components/GeminiPanel.tsx

import React, { useState, useEffect } from 'react';
import { GeminiChatInterface } from './GeminiChatInterface';
import { GeminiSettings } from './GeminiSettings';
import { GeminiSessionList } from './GeminiSessionList';

interface GeminiPanelProps {
  isVisible: boolean;
}

export const GeminiPanel: React.FC<GeminiPanelProps> = ({ isVisible }) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'sessions' | 'settings'>('chat');
  const [isCliInstalled, setIsCliInstalled] = useState(false);

  useEffect(() => {
    checkGeminiCli();
  }, []);

  const checkGeminiCli = async () => {
    try {
      const installed = await invoke<boolean>('gemini_check_cli');
      setIsCliInstalled(installed);
    } catch (error) {
      console.error('Failed to check Gemini CLI:', error);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="gemini-panel h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Gemini AI</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-3 py-1 rounded ${activeTab === 'chat' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            Chat
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`px-3 py-1 rounded ${activeTab === 'sessions' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            Sessions
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1 rounded ${activeTab === 'settings' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            Settings
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {!isCliInstalled ? (
          <GeminiInstallPrompt onInstall={checkGeminiCli} />
        ) : (
          <>
            {activeTab === 'chat' && <GeminiChatInterface />}
            {activeTab === 'sessions' && <GeminiSessionList />}
            {activeTab === 'settings' && <GeminiSettings />}
          </>
        )}
      </div>
    </div>
  );
};
```

### 2. GeminiChatInterface 컴포넌트

```typescript
// src/components/GeminiChatInterface.tsx

import React, { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { GeminiChatRequest, GeminiChatResponse, GeminiChatMessage } from '../lib/types/gemini';

export const GeminiChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<GeminiChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-pro');
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: GeminiChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date(),
      files: attachedFiles.length > 0 ? [...attachedFiles] : undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setAttachedFiles([]);
    setIsLoading(true);

    try {
      const request: GeminiChatRequest = {
        message: inputMessage,
        model: selectedModel,
        files: attachedFiles.length > 0 ? attachedFiles : undefined,
      };

      const response = await invoke<GeminiChatResponse>('gemini_chat', { request });

      const assistantMessage: GeminiChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        model: response.modelUsed,
        tokensUsed: response.tokensUsed,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: GeminiChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${error}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileAttach = async () => {
    try {
      const { open } = await import('@tauri-apps/api/dialog');
      const selected = await open({
        multiple: true,
        filters: [{
          name: 'All Files',
          extensions: ['*']
        }]
      });

      if (selected && Array.isArray(selected)) {
        setAttachedFiles(prev => [...prev, ...selected]);
      } else if (selected) {
        setAttachedFiles(prev => [...prev, selected]);
      }
    } catch (error) {
      console.error('Failed to select files:', error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-3/4 p-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-gray-800 border'
              }`}
            >
              <div className="prose dark:prose-invert max-w-none">
                {message.content}
              </div>
              {message.files && (
                <div className="mt-2 text-xs opacity-75">
                  Files: {message.files.map(f => f.split('/').pop()).join(', ')}
                </div>
              )}
              <div className="text-xs opacity-75 mt-1">
                {message.timestamp.toLocaleTimeString()}
                {message.model && ` • ${message.model}`}
                {message.tokensUsed && ` • ${message.tokensUsed} tokens`}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-800 border p-3 rounded-lg">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Attached Files */}
      {attachedFiles.length > 0 && (
        <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-t">
          <div className="flex flex-wrap gap-2">
            {attachedFiles.map((file, index) => (
              <div key={index} className="flex items-center bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded text-sm">
                <span>{file.split('/').pop()}</span>
                <button
                  onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== index))}
                  className="ml-2 text-red-500 hover:text-red-700"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t bg-white dark:bg-gray-800">
        <div className="flex items-center space-x-2 mb-2">
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="px-2 py-1 border rounded text-sm"
          >
            <option value="gemini-pro">Gemini Pro</option>
            <option value="gemini-pro-vision">Gemini Pro Vision</option>
            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
          </select>
          <button
            onClick={handleFileAttach}
            className="px-3 py-1 bg-gray-200 dark:bg-gray-600 rounded text-sm hover:bg-gray-300"
            disabled={isLoading}
          >
            📎 Attach
          </button>
        </div>
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            placeholder="Type your message..."
            className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputMessage.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};
```

### 3. GeminiSettings 컴포넌트

```typescript
// src/components/GeminiSettings.tsx

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { GeminiConfig, GeminiModel } from '../lib/types/gemini';

export const GeminiSettings: React.FC = () => {
  const [config, setConfig] = useState<GeminiConfig>({
    defaultModel: 'gemini-pro',
    temperature: 0.7,
    maxTokens: 4096,
  });
  const [models, setModels] = useState<GeminiModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadConfig();
    loadModels();
  }, []);

  const loadConfig = async () => {
    try {
      const loadedConfig = await invoke<GeminiConfig>('gemini_get_config');
      setConfig(loadedConfig);
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const loadModels = async () => {
    setIsLoading(true);
    try {
      const loadedModels = await invoke<GeminiModel[]>('gemini_get_models');
      setModels(loadedModels);
    } catch (error) {
      console.error('Failed to load models:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = async () => {
    setIsSaving(true);
    try {
      await invoke('gemini_set_config', { config });
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save config:', error);
      alert('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const installCli = async () => {
    setIsLoading(true);
    try {
      const result = await invoke<string>('gemini_install_cli');
      alert(`CLI installation result: ${result}`);
    } catch (error) {
      console.error('Failed to install CLI:', error);
      alert('Failed to install CLI');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-6">
      <h3 className="text-lg font-semibold">Gemini Settings</h3>

      {/* API Configuration */}
      <div className="space-y-4">
        <h4 className="font-medium">API Configuration</h4>
        
        <div>
          <label className="block text-sm font-medium mb-1">API Key</label>
          <input
            type="password"
            value={config.apiKey || ''}
            onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
            placeholder="Enter your Gemini API key"
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Default Model</label>
          <select
            value={config.defaultModel}
            onChange={(e) => setConfig(prev => ({ ...prev, defaultModel: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {models.map(model => (
              <option key={model.name} value={model.name}>
                {model.displayName} - {model.description}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Temperature: {config.temperature}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={config.temperature}
            onChange={(e) => setConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>Conservative</span>
            <span>Creative</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Max Tokens</label>
          <input
            type="number"
            value={config.maxTokens || ''}
            onChange={(e) => setConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) || undefined }))}
            placeholder="Leave empty for model default"
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">CLI Path (Optional)</label>
          <input
            type="text"
            value={config.cliPath || ''}
            onChange={(e) => setConfig(prev => ({ ...prev, cliPath: e.target.value }))}
            placeholder="Auto-detected if empty"
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* CLI Management */}
      <div className="space-y-4">
        <h4 className="font-medium">CLI Management</h4>
        <button
          onClick={installCli}
          disabled={isLoading}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
        >
          {isLoading ? 'Installing...' : 'Install/Update Gemini CLI'}
        </button>
      </div>

      {/* Available Models */}
      <div className="space-y-4">
        <h4 className="font-medium">Available Models</h4>
        {isLoading ? (
          <div>Loading models...</div>
        ) : (
          <div className="space-y-2">
            {models.map(model => (
              <div key={model.name} className="p-3 border rounded-lg">
                <div className="font-medium">{model.displayName}</div>
                <div className="text-sm text-gray-600">{model.description}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Input: {model.inputTokenLimit.toLocaleString()} tokens • 
                  Output: {model.outputTokenLimit.toLocaleString()} tokens
                  {model.supportsVision && ' • Supports Vision'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex space-x-4">
        <button
          onClick={saveConfig}
          disabled={isSaving}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
        <button
          onClick={loadConfig}
          className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
        >
          Reset
        </button>
      </div>
    </div>
  );
};
```

---

## Tauri 백엔드 구현

### 1. Gemini CLI 래퍼 서비스

```rust
// src-tauri/src/services/gemini_service.rs

use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use std::collections::HashMap;
use serde_json::{Value, json};
use tokio::process::Command as TokioCommand;

pub struct GeminiService {
    cli_path: String,
    config: GeminiConfig,
}

impl GeminiService {
    pub fn new(cli_path: Option<String>) -> Self {
        let cli_path = cli_path.unwrap_or_else(|| "gemini".to_string());
        Self {
            cli_path,
            config: GeminiConfig::default(),
        }
    }

    pub async fn chat(&self, request: &GeminiChatRequest) -> Result<GeminiChatResponse, String> {
        let mut cmd = TokioCommand::new(&self.cli_path);
        cmd.arg("chat");
        cmd.arg(&request.message);

        // Model selection
        if let Some(ref model) = request.model {
            cmd.arg("--model").arg(model);
        }

        // Temperature
        if let Some(temp) = request.temperature {
            cmd.arg("--temperature").arg(temp.to_string());
        }

        // Max tokens
        if let Some(max_tokens) = request.max_tokens {
            cmd.arg("--max-tokens").arg(max_tokens.to_string());
        }

        // Files
        if let Some(ref files) = request.files {
            for file in files {
                cmd.arg("--file").arg(file);
            }
        }

        // Format as JSON for easier parsing
        cmd.arg("--format").arg("json");

        // Execute command
        let output = cmd.output().await.map_err(|e| format!("Failed to execute command: {}", e))?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Gemini CLI error: {}", error));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        
        // Parse JSON response
        let json_response: Value = serde_json::from_str(&stdout)
            .map_err(|e| format!("Failed to parse JSON response: {}", e))?;

        Ok(GeminiChatResponse {
            content: json_response["content"].as_str().unwrap_or("").to_string(),
            model_used: json_response["model"].as_str().unwrap_or("unknown").to_string(),
            tokens_used: json_response["tokens_used"].as_u64().map(|t| t as u32),
            timestamp: chrono::Utc::now().to_rfc3339(),
            error: None,
        })
    }

    pub async fn get_models(&self) -> Result<Vec<GeminiModel>, String> {
        let mut cmd = TokioCommand::new(&self.cli_path);
        cmd.arg("models");
        cmd.arg("--format").arg("json");

        let output = cmd.output().await.map_err(|e| format!("Failed to execute command: {}", e))?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to get models: {}", error));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let json_response: Value = serde_json::from_str(&stdout)
            .map_err(|e| format!("Failed to parse JSON response: {}", e))?;

        let models = json_response["models"].as_array()
            .ok_or("Invalid response format")?
            .iter()
            .filter_map(|model| {
                Some(GeminiModel {
                    name: model["name"].as_str()?.to_string(),
                    display_name: model["displayName"].as_str()?.to_string(),
                    description: model["description"].as_str().unwrap_or("").to_string(),
                    input_token_limit: model["inputTokenLimit"].as_u64().unwrap_or(32768) as u32,
                    output_token_limit: model["outputTokenLimit"].as_u64().unwrap_or(4096) as u32,
                    supports_vision: model["supportsVision"].as_bool().unwrap_or(false),
                })
            })
            .collect();

        Ok(models)
    }

    pub async fn check_cli_installation(&self) -> bool {
        let output = TokioCommand::new(&self.cli_path)
            .arg("--version")
            .output()
            .await;

        matches!(output, Ok(output) if output.status.success())
    }

    pub async fn install_cli() -> Result<String, String> {
        // Try to install via npm
        let output = TokioCommand::new("npm")
            .args(&["install", "-g", "@google/generative-ai-cli"])
            .output()
            .await
            .map_err(|e| format!("Failed to run npm: {}", e))?;

        if output.status.success() {
            Ok("Gemini CLI installed successfully via npm".to_string())
        } else {
            let error = String::from_utf8_lossy(&output.stderr);
            Err(format!("Failed to install Gemini CLI: {}", error))
        }
    }
}
```

### 2. 설정 관리

```rust
// src-tauri/src/config/gemini_config.rs

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiConfig {
    pub api_key: Option<String>,
    pub default_model: String,
    pub temperature: f32,
    pub max_tokens: Option<u32>,
    pub cli_path: Option<String>,
}

impl Default for GeminiConfig {
    fn default() -> Self {
        Self {
            api_key: None,
            default_model: "gemini-pro".to_string(),
            temperature: 0.7,
            max_tokens: Some(4096),
            cli_path: None,
        }
    }
}

impl GeminiConfig {
    pub fn load() -> Result<Self, String> {
        let config_path = Self::config_path()?;
        
        if !config_path.exists() {
            let default_config = Self::default();
            default_config.save()?;
            return Ok(default_config);
        }

        let content = fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read config file: {}", e))?;

        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse config: {}", e))
    }

    pub fn save(&self) -> Result<(), String> {
        let config_path = Self::config_path()?;
        
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create config directory: {}", e))?;
        }

        let content = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;

        fs::write(&config_path, content)
            .map_err(|e| format!("Failed to write config file: {}", e))
    }

    fn config_path() -> Result<PathBuf, String> {
        let app_data_dir = dirs::config_dir()
            .ok_or("Failed to get config directory")?
            .join("claudia")
            .join("gemini_config.json");

        Ok(app_data_dir)
    }
}
```

---

## 프론트엔드 구현

### 1. Gemini 훅

```typescript
// src/hooks/useGemini.ts

import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { 
  GeminiChatRequest, 
  GeminiChatResponse, 
  GeminiConfig, 
  GeminiModel,
  GeminiSession,
  GeminiChatMessage 
} from '../lib/types/gemini';

export const useGemini = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chat = useCallback(async (request: GeminiChatRequest): Promise<GeminiChatResponse> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await invoke<GeminiChatResponse>('gemini_chat', { request });
      return response;
    } catch (err) {
      const errorMessage = err as string;
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getModels = useCallback(async (): Promise<GeminiModel[]> => {
    setIsLoading(true);
    setError(null);
    try {
      return await invoke<GeminiModel[]>('gemini_get_models');
    } catch (err) {
      const errorMessage = err as string;
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getConfig = useCallback(async (): Promise<GeminiConfig> => {
    return await invoke<GeminiConfig>('gemini_get_config');
  }, []);

  const setConfig = useCallback(async (config: GeminiConfig): Promise<void> => {
    await invoke('gemini_set_config', { config });
  }, []);

  const checkCli = useCallback(async (): Promise<boolean> => {
    return await invoke<boolean>('gemini_check_cli');
  }, []);

  const installCli = useCallback(async (): Promise<string> => {
    setIsLoading(true);
    setError(null);
    try {
      return await invoke<string>('gemini_install_cli');
    } catch (err) {
      const errorMessage = err as string;
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    chat,
    getModels,
    getConfig,
    setConfig,
    checkCli,
    installCli,
    isLoading,
    error,
  };
};
```

### 2. Gemini 세션 관리

```typescript
// src/hooks/useGeminiSessions.ts

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { GeminiSession, GeminiChatMessage } from '../lib/types/gemini';

export const useGeminiSessions = () => {
  const [sessions, setSessions] = useState<GeminiSession[]>([]);
  const [currentSession, setCurrentSession] = useState<GeminiSession | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const loadedSessions = await invoke<GeminiSession[]>('gemini_get_sessions');
      setSessions(loadedSessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  }, []);

  const createSession = useCallback(async (title: string, model: string): Promise<GeminiSession> => {
    const newSession: GeminiSession = {
      id: Date.now().toString(),
      title,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      model,
      totalTokens: 0,
    };

    try {
      await invoke('gemini_save_session', { session: newSession });
      setSessions(prev => [newSession, ...prev]);
      return newSession;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  }, []);

  const updateSession = useCallback(async (sessionId: string, updates: Partial<GeminiSession>) => {
    try {
      const updatedSession = { ...sessions.find(s => s.id === sessionId), ...updates };
      await invoke('gemini_save_session', { session: updatedSession });
      setSessions(prev => prev.map(s => s.id === sessionId ? updatedSession as GeminiSession : s));
      
      if (currentSession?.id === sessionId) {
        setCurrentSession(updatedSession as GeminiSession);
      }
    } catch (error) {
      console.error('Failed to update session:', error);
      throw error;
    }
  }, [sessions, currentSession]);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await invoke('gemini_delete_session', { sessionId });
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
      throw error;
    }
  }, [currentSession]);

  const addMessageToSession = useCallback(async (sessionId: string, message: GeminiChatMessage) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const updatedMessages = [...session.messages, message];
    const totalTokens = session.totalTokens + (message.tokensUsed || 0);

    await updateSession(sessionId, {
      messages: updatedMessages,
      updatedAt: new Date(),
      totalTokens,
    });
  }, [sessions, updateSession]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return {
    sessions,
    currentSession,
    setCurrentSession,
    loadSessions,
    createSession,
    updateSession,
    deleteSession,
    addMessageToSession,
  };
};
```

---

## 설정 관리

### 1. 환경 변수 설정

```bash
# .env.example
GEMINI_API_KEY=your_api_key_here
GEMINI_CLI_PATH=/path/to/gemini/cli
GEMINI_DEFAULT_MODEL=gemini-pro
```

### 2. 설정 파일 구조

```json
// ~/.config/claudia/gemini_config.json
{
  "api_key": "your_api_key_here",
  "default_model": "gemini-pro",
  "temperature": 0.7,
  "max_tokens": 4096,
  "cli_path": null,
  "preferences": {
    "auto_save_sessions": true,
    "session_timeout": 3600000,
    "max_sessions": 50,
    "enable_streaming": true
  }
}
```

---

## 테스트 계획

### 1. 단위 테스트

```typescript
// src/tests/gemini.test.ts

import { describe, it, expect, vi } from 'vitest';
import { useGemini } from '../hooks/useGemini';
import { GeminiChatRequest } from '../lib/types/gemini';

describe('Gemini Integration', () => {
  it('should send chat message successfully', async () => {
    const { chat } = useGemini();
    
    const request: GeminiChatRequest = {
      message: 'Hello, world!',
      model: 'gemini-pro',
    };

    const response = await chat(request);
    expect(response.content).toBeDefined();
    expect(response.model_used).toBe('gemini-pro');
  });

  it('should handle file attachments', async () => {
    const { chat } = useGemini();
    
    const request: GeminiChatRequest = {
      message: 'Analyze this file',
      files: ['/path/to/test/file.txt'],
    };

    const response = await chat(request);
    expect(response.content).toBeDefined();
  });
});
```

### 2. 통합 테스트

```rust
// src-tauri/src/tests/gemini_integration.rs

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::gemini_service::GeminiService;

    #[tokio::test]
    async fn test_cli_installation_check() {
        let service = GeminiService::new(None);
        let is_installed = service.check_cli_installation().await;
        
        // This might be false in CI environment
        println!("CLI installed: {}", is_installed);
    }

    #[tokio::test]
    async fn test_chat_functionality() {
        let service = GeminiService::new(None);
        
        if !service.check_cli_installation().await {
            println!("Skipping test - CLI not installed");
            return;
        }

        let request = GeminiChatRequest {
            message: "Hello, how are you?".to_string(),
            model: Some("gemini-pro".to_string()),
            temperature: Some(0.7),
            max_tokens: Some(100),
            files: None,
            context: None,
        };

        let result = service.chat(&request).await;
        assert!(result.is_ok());
        
        let response = result.unwrap();
        assert!(!response.content.is_empty());
    }
}
```

---

## 배포 및 릴리스

### 1. 빌드 스크립트 수정

```json
// package.json
{
  "scripts": {
    "tauri:build": "tauri build",
    "tauri:dev": "tauri dev",
    "build:with-gemini": "npm run check:gemini && npm run tauri:build",
    "check:gemini": "node scripts/check-gemini.js"
  }
}
```

```javascript
// scripts/check-gemini.js
const { exec } = require('child_process');

exec('gemini --version', (error, stdout, stderr) => {
  if (error) {
    console.warn('Gemini CLI not found. Installing...');
    exec('npm install -g @google/generative-ai-cli', (installError) => {
      if (installError) {
        console.error('Failed to install Gemini CLI:', installError);
        process.exit(1);
      }
      console.log('Gemini CLI installed successfully');
    });
  } else {
    console.log('Gemini CLI found:', stdout.trim());
  }
});
```

### 2. GitHub Actions 워크플로우

```yaml
# .github/workflows/build-with-gemini.yml
name: Build with Gemini Integration

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Install Rust
      uses: actions-rs/toolchain@v1
      with:
        toolchain: stable

    - name: Install dependencies
      run: npm install

    - name: Install Gemini CLI
      run: npm install -g @google/generative-ai-cli

    - name: Build application
      run: npm run tauri:build
      env:
        GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}

    - name: Upload artifacts
      uses: actions/upload-artifact@v3
      with:
        name: app-${{ matrix.os }}
        path: src-tauri/target/release/bundle/
```

---

## 문제 해결

### 1. 일반적인 문제들

#### Gemini CLI 설치 실패
```bash
# 문제: npm install 실패
# 해결: 권한 또는 네트워크 문제
npm install -g @google/generative-ai-cli --unsafe-perm=true

# 문제: PATH 설정 문제
# 해결: 수동으로 PATH 추가
export PATH="$PATH:/usr/local/lib/node_modules/@google/generative-ai-cli/bin"
```

#### API 키 문제
```bash
# 문제: API 키 인증 실패
# 해결: 환경 변수 확인
echo $GEMINI_API_KEY

# 문제: API 할당량 초과
# 해결: Google AI Studio에서 할당량 확인
```

#### CLI 호출 실패
```rust
// 문제: CLI 프로세스 실행 실패
// 해결: 전체 경로 사용 및 권한 확인
let cli_path = which::which("gemini")
    .map_err(|_| "Gemini CLI not found in PATH")?;
```

### 2. 디버깅 도구

```typescript
// Debug 모드 활성화
const DEBUG_GEMINI = process.env.NODE_ENV === 'development';

if (DEBUG_GEMINI) {
  console.log('Gemini request:', request);
  console.log('Gemini response:', response);
}
```

```rust
// Rust 로깅 설정
use log::{info, warn, error, debug};

impl GeminiService {
    pub async fn chat(&self, request: &GeminiChatRequest) -> Result<GeminiChatResponse, String> {
        debug!("Gemini chat request: {:?}", request);
        
        // ... 구현 ...
        
        debug!("Gemini chat response: {:?}", response);
        Ok(response)
    }
}
```

### 3. 성능 최적화

```typescript
// 응답 캐싱
const responseCache = new Map<string, GeminiChatResponse>();

const getCachedResponse = (request: GeminiChatRequest): GeminiChatResponse | null => {
  const key = JSON.stringify(request);
  return responseCache.get(key) || null;
};

const setCachedResponse = (request: GeminiChatRequest, response: GeminiChatResponse) => {
  const key = JSON.stringify(request);
  responseCache.set(key, response);
  
  // 캐시 크기 제한
  if (responseCache.size > 100) {
    const firstKey = responseCache.keys().next().value;
    responseCache.delete(firstKey);
  }
};
```

---

## 향후 계획

### 단기 (1-3개월)
- [ ] 기본 채팅 인터페이스 완성
- [ ] 파일 업로드 및 분석 기능
- [ ] 설정 UI 개선
- [ ] 세션 관리 시스템

### 중기 (3-6개월)
- [ ] Claude Code와의 깊은 통합
- [ ] 멀티모달 지원 (이미지, 문서)
- [ ] 고급 에이전트 시스템
- [ ] 성능 최적화

### 장기 (6개월+)
- [ ] 플러그인 시스템
- [ ] 클라우드 동기화
- [ ] 협업 기능
- [ ] 엔터프라이즈 기능

---

## 참고 자료

### 공식 문서
- [Google Gemini API Documentation](https://ai.google.dev/docs)
- [Gemini CLI GitHub Repository](https://github.com/google/generative-ai-cli)
- [Tauri Documentation](https://tauri.app/v1/guides/)

### 예제 및 튜토리얼
- [Gemini CLI Examples](https://github.com/google/generative-ai-cli/tree/main/examples)
- [Tauri + AI Integration Examples](https://github.com/tauri-apps/examples)

### 커뮤니티 리소스
- [Gemini API Community](https://developers.googleblog.com/2023/12/gemini-api-developer-competition.html)
- [Tauri Discord Server](https://discord.com/invite/SpmNs4S)

---

**마지막 업데이트**: 2024년 1월 31일
**버전**: 1.0.0
**작성자**: Claude AI Assistant