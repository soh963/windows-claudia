# 클라우디아 문제 해결 가이드 (Claudia Troubleshooting Guide)

## 📋 개요

클라우디아 프로젝트에서 발생하는 주요 문제들과 해결방법을 상세히 정리한 문서입니다.

---

## 🔴 1. Gemini 모델 사용 불가 문제

### 🔍 문제 현황

현재 제공되는 Gemini 모델들의 사용 가능성:

| 모델 | 상태 | 이유 |
|------|------|------|
| **Gemini 1.5 Pro** ✅ | 사용 가능 | 안정적인 공식 모델 |
| **Gemini 1.5 Flash** ✅ | 사용 가능 | 안정적인 공식 모델 |
| **Gemini 2.0 Flash (Experimental)** ⚗️ | 사용 가능 | 실험적 모델, 제한적 |
| **Gemini Experimental 1206** ⚗️ | 사용 가능 | 레거시 실험 모델 |
| **Gemini 2.5 Pro** 🔄 | **사용 불가** | **아직 정식 출시되지 않음** |
| **Gemini 2.5 Flash** 🔄 | **사용 불가** | **아직 정식 출시되지 않음** |

### 🚨 주요 문제

1. **미출시 모델 매핑**: Gemini 2.5 시리즈는 아직 Google에서 정식 출시하지 않았지만, UI에 표시됨
2. **엔드포인트 오류**: 존재하지 않는 API 엔드포인트 호출로 인한 404 오류
3. **사용자 혼란**: 사용할 수 없는 모델이 선택 가능하게 표시됨

### 💡 해결 방법

#### A. 즉시 해결 (Hotfix)
```typescript
// src/lib/models.ts 수정
export const GEMINI_MODELS: Model[] = [
  // 작동하는 모델들만 유지
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro ✅',
    // ... 기존 설정 유지
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash ✅',
    // ... 기존 설정 유지
  },
  {
    id: 'gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash (Experimental) ⚗️',
    // ... 기존 설정 유지
  },
  // Gemini 2.5 모델들 제거 또는 비활성화
];
```

#### B. 장기 해결책
1. **동적 모델 감지 시스템 구현**:
   ```rust
   // src-tauri/src/commands/gemini_models.rs
   pub async fn validate_gemini_model(
       model_id: String,
       api_key: String,
   ) -> Result<bool, String> {
       // 실제 API 호출로 모델 존재 여부 확인
   }
   ```

2. **모델 상태 표시 개선**:
   ```typescript
   interface ModelStatus {
     available: boolean;
     reason?: string; // "Not yet released", "API Error", etc.
     lastChecked: Date;
   }
   ```

---

## 🔴 2. Ollama 모델 로딩 실패 문제

### 🔍 문제 분석

**현재 구현 상태**: ✅ 코드는 정상적으로 구현되어 있음

**주요 이슈**:
1. **Ollama 서버 미실행**: `http://localhost:11434` 연결 불가
2. **모델 미설치**: Ollama는 실행되지만 모델이 설치되지 않음
3. **방화벽/포트 충돌**: 11434 포트 접근 차단

### 💡 해결 방법

#### A. Ollama 설치 및 실행 확인
```bash
# 1. Ollama 설치 여부 확인
ollama --version

# 2. Ollama 서비스 시작
ollama serve

# 3. 모델 설치 (예시)
ollama pull llama3.3:latest
ollama pull codellama:latest
ollama pull mistral:latest

# 4. 설치된 모델 확인
ollama list
```

#### B. 연결 테스트
```bash
# API 엔드포인트 테스트
curl http://localhost:11434/api/tags

# 응답 예시 (정상):
# {"models":[{"name":"llama3.3:latest","modified_at":"..."}]}
```

#### C. 자동 진단 시스템
```typescript
// 추가 구현 제안
export const DiagnosticSystem = {
  async checkOllamaStatus(): Promise<DiagnosticResult> {
    try {
      // 1. 서버 연결 확인
      const serverStatus = await api.checkOllamaStatus();
      
      // 2. 모델 목록 확인  
      const models = await api.getOllamaModels();
      
      // 3. 진단 결과 반환
      return {
        status: 'healthy',
        server: serverStatus,
        modelCount: models.length,
        recommendations: models.length === 0 ? ['Install models with: ollama pull llama3.3:latest'] : []
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        recommendations: [
          'Install Ollama from https://ollama.ai',
          'Run: ollama serve',
          'Check firewall settings for port 11434'
        ]
      };
    }
  }
};
```

---

## 🔴 3. UI 중복 표시 문제

### 🔍 문제 분석

**주요 중복 영역**:
1. **TaskProgress + SessionSummary**: 좌측/우측 패널이 동시에 같은 정보 표시
2. **TabManager 중복**: 탭 제목이나 컨트롤 요소의 중복 렌더링
3. **Progress 컴포넌트**: ProgressMonitor와 개별 컴포넌트의 중복

### 💡 해결 방법

#### A. 패널 동기화 시스템 (이미 구현됨)
```typescript
// src/hooks/usePanelSync.ts 활용
export const usePanelSync = () => {
  // 패널 간 중복 데이터 방지
  // 동일한 데이터는 한 곳에서만 표시
};
```

#### B. 컨텍스트 관리 개선
```typescript
// src/contexts/TabContext.tsx
export const TabProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 중복 렌더링 방지를 위한 상태 관리
  const [activeTab, setActiveTab] = useState<string | null>(null);
  
  return (
    <TabContext.Provider value={{ activeTab, setActiveTab, /* ... */ }}>
      {children}
    </TabContext.Provider>
  );
};
```

#### C. 렌더링 최적화
```typescript
// App.tsx에서 중복 제거
const AppContent = () => {
  return (
    <div className="h-full flex flex-col">
      <TabManager />
      <div className="flex-1 overflow-hidden flex">
        {/* 조건부 렌더링으로 중복 방지 */}
        {showTaskProgress && <TaskProgress />}
        <TabContent />
        {showSessionSummary && <SessionSummary />}
      </div>
    </div>
  );
};
```

---

## 🔴 4. 채팅 중지 버튼 작동 안 함 문제

### 🔍 문제 분석

**현재 구현 상태**: ✅ 중지 기능은 올바르게 구현됨

**코드 분석 결과**:
- `ExecutionControlBar`: Stop 버튼 UI ✅
- `handleStopExecution()`: 중지 로직 ✅ 
- `handleCancelExecution()`: 취소 로직 ✅
- 세션 격리: UUID 기반 세션 관리 ✅

### 🔍 실제 문제 원인

1. **버튼 상태 관리**: `isExecuting` 상태와 실제 실행 상태 불일치
2. **이벤트 전파**: Stop 이벤트가 백엔드까지 전달되지 않음
3. **UI 피드백 부족**: 사용자가 버튼을 눌렀는지 확인하기 어려움

### 💡 해결 방법

#### A. 상태 동기화 개선
```typescript
// ExecutionControlBar.tsx 개선
const ExecutionControlBar: React.FC<ExecutionControlBarProps> = ({
  isExecuting,
  onStop,
  status
}) => {
  const [isStoppingOperation, setIsStoppingOperation] = useState(false);
  
  const handleStopClick = async () => {
    setIsStoppingOperation(true);
    try {
      await onStop();
      // 피드백 표시
      showToast("Execution stopped successfully", "success");
    } catch (error) {
      showToast("Failed to stop execution", "error");
    } finally {
      setIsStoppingOperation(false);
    }
  };

  return (
    <Button
      onClick={handleStopClick}
      disabled={isStoppingOperation || !isExecuting}
      className="gap-2"
    >
      {isStoppingOperation ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <StopCircle className="h-3.5 w-3.5" />
      )}
      {isStoppingOperation ? 'Stopping...' : 'Stop'}
    </Button>
  );
};
```

#### B. 백엔드 연결 강화
```typescript
// ClaudeCodeSession.tsx 개선  
const handleStopExecution = async () => {
  try {
    console.log('🛑 Stop button clicked - Session ID:', claudeSessionId);
    
    // 1. UI 상태 즉시 업데이트
    setIsLoading(false);
    
    // 2. 백엔드 중지 요청
    if (claudeSessionId) {
      await api.cancelClaudeExecution(claudeSessionId);
    }
    
    // 3. 실행 컨트롤 중지
    if (executionControl.stopExecution) {
      await executionControl.stopExecution();
    }
    
    // 4. 성공 피드백
    showToast("Execution stopped", "success");
    
  } catch (error) {
    console.error('❌ Stop execution failed:', error);
    showToast("Failed to stop execution", "error");
  }
};
```

#### C. 디버깅 도구 추가
```typescript
// 개발자 도구 추가
const DebugPanel = () => {
  return (
    <div className="fixed top-4 right-4 bg-black/80 text-white p-2 text-xs rounded">
      <div>Session ID: {claudeSessionId}</div>
      <div>Is Executing: {isExecuting ? '✅' : '❌'}</div>
      <div>Status: {status}</div>
      <div>Stop Available: {isExecuting ? '✅' : '❌'}</div>
    </div>
  );
};
```

---

## 🔴 5. 추가 개선 사항

### A. 통합 모델 상태 관리
```typescript
interface ModelStatus {
  id: string;
  name: string;
  provider: 'claude' | 'gemini' | 'ollama';
  available: boolean;
  lastChecked: Date;
  error?: string;
  version?: string;
}

export const ModelStatusManager = {
  async checkAllModels(): Promise<ModelStatus[]> {
    // 모든 모델의 실시간 상태 확인
  },
  
  async refreshModelStatus(modelId: string): Promise<void> {
    // 특정 모델 상태 새로고침
  }
};
```

### B. 오류 추적 시스템
```typescript
export const ErrorTracker = {
  logModelError(modelId: string, error: string) {
    console.error(`[${modelId}] ${error}`);
    // 오류를 로컬 스토리지나 서버에 저장
  },
  
  getModelErrorHistory(modelId: string): ErrorRecord[] {
    // 특정 모델의 오류 히스토리 반환
  }
};
```

### C. 사용자 가이드 통합
```typescript
export const HelpSystem = {
  showModelHelp(modelId: string) {
    // 특정 모델 사용법 도움말 표시
  },
  
  showTroubleshootingSteps(issue: string) {
    // 문제 해결 단계별 가이드 표시
  }
};
```

---

## 📊 문제별 우선순위

| 순위 | 문제 | 심각도 | 해결 난이도 | 사용자 영향 |
|------|------|--------|-------------|-------------|
| 1 | Gemini 2.5 모델 오류 | 높음 | 낮음 | 높음 |
| 2 | 중지 버튼 미작동 | 높음 | 중간 | 높음 |  
| 3 | UI 중복 표시 | 중간 | 낮음 | 중간 |
| 4 | Ollama 연결 실패 | 중간 | 중간 | 낮음 |

---

## 🔧 즉시 적용 가능한 수정사항

### 1. Gemini 모델 필터링 (1분 소요)
```typescript
// src/lib/models.ts
export const GEMINI_MODELS = [
  // 작동하는 모델들만 남기고 2.5 시리즈 제거
].filter(model => !model.id.includes('2.5'));
```

### 2. Stop 버튼 피드백 개선 (2분 소요)  
```typescript  
// ExecutionControlBar.tsx에 로딩 상태 추가
const [stopping, setStopping] = useState(false);
```

### 3. 오류 메시지 개선 (1분 소요)
```typescript
// 사용자 친화적 오류 메시지 추가
const ERROR_MESSAGES = {
  'MODEL_NOT_FOUND': '선택한 모델을 사용할 수 없습니다. 다른 모델을 선택해 주세요.',
  'OLLAMA_NOT_RUNNING': 'Ollama가 실행되지 않았습니다. ollama serve 명령으로 시작해 주세요.',
  'STOP_FAILED': '실행 중지에 실패했습니다. 페이지를 새로고침 해보세요.'
};
```

---

## 📞 지원 및 문의

이 문서에서 해결되지 않은 문제가 있다면:

1. **GitHub Issues**: 프로젝트 리포지토리에 이슈 등록
2. **로그 수집**: 브라우저 개발자 도구 콘솔 로그 첨부
3. **환경 정보**: OS, 브라우저, Ollama/API 키 설정 상태 명시

---

**마지막 업데이트**: 2025년 8월 7일
**문서 버전**: 1.0
**작성자**: Claude Code SuperClaude