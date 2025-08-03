# Claude Code CLI 인증 및 사용 방법 가이드

Claudia 프로젝트에서 Claude Code CLI를 사용하기 위한 상세 인증 및 사용법을 설명합니다.

## 📋 목차

1. [Claude Code CLI 설치](#claude-code-cli-설치)
2. [구독 기반 인증 방식](#구독-기반-인증-방식)
3. [Claudia에서의 Claude Code CLI 통합](#claudia에서의-claude-code-cli-통합)
4. [사용법 및 예제](#사용법-및-예제)
5. [에러 해결](#에러-해결)
6. [모니터링 및 관리](#모니터링-및-관리)

## 🚀 Claude Code CLI 설치

### 1. NPM을 통한 설치
```bash
npm install -g @anthropic-ai/claude-code
```

### 2. 설치 확인
```bash
claude --version
# 출력: 1.0.67 (Claude Code)
```

### 3. 경로 확인
- Windows: `C:\nvm4w\nodejs\claude.cmd`
- 또는 시스템 환경변수 PATH에 추가된 경로

## 🔐 구독 기반 인증 방식

Claude Code CLI는 **API 키가 아닌 구독 기반 인증**을 사용합니다.

### 1. 인증 방법
Claude Code CLI는 브라우저 기반 OAuth 인증을 사용합니다:

```bash
claude login
```

이 명령어 실행 시:
1. 기본 브라우저가 자동으로 열립니다
2. Anthropic 계정으로 로그인합니다
3. Claude Pro 또는 Claude Team 구독이 필요합니다
4. 인증이 완료되면 토큰이 로컬에 저장됩니다

### 2. 인증 상태 확인
```bash
claude auth whoami
```

### 3. 로그아웃
```bash
claude logout
```

### 4. 구독 요구사항
- **Claude Pro**: 개인 사용자용 구독
- **Claude Team**: 팀/조직용 구독
- **무료 계정으로는 Claude Code CLI 사용 불가**

### 5. 인증 토큰 저장 위치
- Windows: `%USERPROFILE%\.claude\`
- macOS/Linux: `~/.claude/`

## 🔧 Claudia에서의 Claude Code CLI 통합

Claudia는 Claude Code CLI를 래핑하여 사용합니다.

### 1. 바이너리 탐지
Claudia는 다음 순서로 Claude CLI를 찾습니다:

```rust
// src-tauri/src/claude_binary.rs
pub async fn find_claude_binary() -> Result<String, String> {
    // 1. 데이터베이스에 저장된 경로 확인
    // 2. which/where 명령어로 시스템 PATH 검색
    // 3. 일반적인 설치 경로 확인
    // 4. 사용자 지정 경로 설정 가능
}
```

### 2. 자동 탐지 경로
- `claude` (PATH에 있는 경우)
- `C:\nvm4w\nodejs\claude.cmd`
- `%APPDATA%\npm\claude.cmd`
- `/usr/local/bin/claude`
- `~/.local/bin/claude`

### 3. 수동 경로 설정
Claudia UI에서 Settings → Claude Binary Path에서 직접 경로를 설정할 수 있습니다.

### 4. 버전 동기화
```rust
// Claudia는 주기적으로 Claude CLI 명령어를 동기화
pub async fn sync_claude_commands() -> Result<(), String> {
    // 1. claude --help 파싱
    // 2. 사용 가능한 슬래시 명령어 추출
    // 3. 데이터베이스에 저장
    // 4. UI에서 자동완성 지원
}
```

## 💻 사용법 및 예제

### 1. 기본 Claude Code 실행
```bash
# 대화형 모드
claude

# 단일 명령어 실행
claude "Hello, analyze this file: app.js"

# 파일 컨텍스트와 함께
claude --project ./my-project "Explain this codebase"
```

### 2. Claudia에서의 사용법

#### 프로젝트 선택
1. Claudia 실행
2. 왼쪽 상단에서 프로젝트 선택 또는 생성
3. 채팅 입력창에서 메시지 입력

#### 슬래시 명령어 사용
```
/analyze src/components/App.tsx
/implement Create a login component
/build --watch
/test run unit tests
```

#### 파일 업로드
- 드래그 앤 드롭으로 파일 첨부
- 클립보드에서 이미지 붙여넣기
- 파일 선택기를 통한 파일 선택

### 3. 고급 기능

#### 체크포인트 관리
```
# 현재 세션 저장
/checkpoint save "Before refactoring"

# 체크포인트 복원
/checkpoint restore checkpoint-id
```

#### MCP 서버 연동
Claudia는 다음 MCP 서버들을 지원합니다:
- **Desktop Commander**: 파일 시스템 작업
- **Web Search**: 실시간 정보 검색
- **GitHub**: 저장소 관리

## 🚨 에러 해결

### 1. 인증 관련 에러

#### "Not authenticated" 에러
```bash
# 해결: 재인증
claude logout
claude login
```

#### "Subscription required" 에러
- Claude Pro 또는 Claude Team 구독 필요
- 무료 계정으로는 CLI 사용 불가

### 2. 바이너리 탐지 에러

#### "Claude binary not found"
1. Claude Code CLI 설치 확인: `npm install -g @anthropic-ai/claude-code`
2. PATH 환경변수 확인
3. Claudia Settings에서 수동 경로 설정

#### 버전 호환성 에러
```bash
# 최신 버전으로 업데이트
npm update -g @anthropic-ai/claude-code
```

### 3. 네트워크 관련 에러

#### 프록시 환경에서의 설정
```bash
# 프록시 설정
claude config set proxy http://proxy.company.com:8080

# 또는 환경변수
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080
```

## 📊 모니터링 및 관리

### 1. 사용량 모니터링
Claudia는 다음 정보를 추적합니다:
- API 호출 횟수
- 토큰 사용량
- 응답 시간
- 에러 발생률

### 2. 로그 관리
```
# 로그 위치
Windows: %APPDATA%\claudia\logs\
macOS: ~/Library/Logs/claudia/
Linux: ~/.local/share/claudia/logs/
```

### 3. 세션 관리
- 자동 세션 저장
- 세션 히스토리 검색
- 세션 내보내기/가져오기

### 4. 성능 최적화
```rust
// 응답 캐싱
pub struct ResponseCache {
    cache: HashMap<String, CachedResponse>,
    ttl: Duration,
}

// 배치 처리
pub async fn batch_claude_requests(requests: Vec<ClaudeRequest>) -> Vec<ClaudeResponse> {
    // 여러 요청을 효율적으로 처리
}
```

## 🛠️ 개발자 정보

### Claudia의 Claude Code CLI 통합 아키텍처

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Claudia UI    │───▶│  Tauri Backend  │───▶│ Claude Code CLI │
│                 │    │                 │    │                 │
│ - 채팅 인터페이스  │    │ - 프로세스 관리    │    │ - 실제 AI 처리    │
│ - 파일 업로드     │    │ - 응답 파싱      │    │ - Anthropic API  │
│ - 설정 관리      │    │ - 에러 처리      │    │ - 인증 관리      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 주요 코드 파일
- `src-tauri/src/claude_binary.rs`: CLI 바이너리 탐지 및 관리
- `src-tauri/src/commands/claude.rs`: Claude CLI 명령어 실행
- `src-tauri/src/commands/claude_sync.rs`: 명령어 동기화
- `src/components/ClaudeCodeSession.tsx`: 채팅 UI 컴포넌트

---

**마지막 업데이트**: 2025-08-03  
**Claudia 버전**: v0.2.1  
**Claude Code CLI 버전**: 1.0.67