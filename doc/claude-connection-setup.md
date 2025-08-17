# Claudia - Claude API 연결 설정 가이드

## 개요

Claudia는 Claude Code와 Claude 모델을 연결하여 AI 기반 코딩 어시스턴트 기능을 제공하는 GUI 애플리케이션입니다. 이 문서는 Claude API와의 연결 설정 방법을 설명합니다.

## 필수 요구사항

### 1. Claude Code CLI 설치
- Claude Code CLI가 시스템에 설치되어 있어야 합니다
- Windows, macOS, Linux 지원
- 최신 버전 권장

### 2. Claude API 인증
다음 중 하나의 방법으로 인증할 수 있습니다:

#### 방법 1: Claude Code Max 구독 토큰
- Claude Code Max 구독 서비스를 통한 인증
- 안정적이고 권장되는 방법
- 월 구독 기반

#### 방법 2: Anthropic API 키
- Anthropic Console에서 발급받은 API 키 사용
- 사용량 기반 요금제
- 개발자 및 고급 사용자용

## 설치 및 설정

### 1. Claudia 설치

#### NSIS 설치 파일 사용 (권장)
```bash
# 설치 파일 위치
D:\claudia\src-tauri\target\release\bundle\nsis\Claudia_0.1.0_x64-setup.exe
```

#### 직접 실행 파일 사용
```bash
# 빌드된 실행 파일 위치
D:\claudia\src-tauri\target\release\claudia.exe
```

### 2. 콘솔 창 숨김 설정

Nova 에이전트 팀 채팅 시 터미널 창이 나타나지 않도록 다음 설정이 적용되어 있습니다:

#### Cargo.toml 설정
```toml
[[bin]]
name = "claudia"
path = "src/main.rs"
```

#### main.rs 설정
```rust
// Windows 콘솔 창 숨김 (릴리즈 빌드 시)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
```

#### tauri.conf.json 설정
```json
{
  "app": {
    "windows": [
      {
        "title": "Claudia",
        "width": 800,
        "height": 600,
        "center": true,
        "visible": true,
        "skipTaskbar": false
      }
    ]
  }
}
```

### 3. Claude API 연결 설정

#### 3.1 Claude Code 설정 파일 위치
```
~/.claude/settings.json
```

#### 3.2 설정 구조
```json
{
  "apiKeyHelper": "/path/to/generate_api_key.sh",
  "anthropicModel": "claude-3-5-sonnet-20241022",
  "claudeBinaryPath": "/usr/local/bin/claude",
  "proxySettings": {
    "enabled": false,
    "http_proxy": "",
    "https_proxy": "",
    "no_proxy": "",
    "all_proxy": ""
  }
}
```

#### 3.3 환경 변수 설정 (선택사항)
```bash
# Windows
set ANTHROPIC_API_KEY=your_api_key_here
set ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# macOS/Linux
export ANTHROPIC_API_KEY=your_api_key_here
export ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

## 연결 방식

### 1. Claude Code Max 구독 인증 (권장)

1. **구독 등록**
   - Claude Code Max 서비스에 등록
   - 구독 토큰 발급받기

2. **Claudia에서 설정**
   - Claudia 실행
   - Settings 탭으로 이동
   - Claude Code 설정 섹션에서 구독 토큰 입력
   - 연결 테스트 실행

3. **자동 인증**
   - 구독 토큰이 자동으로 Claude Code CLI와 연동
   - 별도의 API 키 설정 불필요

### 2. Anthropic API 키 사용

1. **API 키 발급**
   - https://console.anthropic.com 방문
   - 계정 생성 및 로그인
   - API Keys 섹션에서 새 키 생성

2. **Claudia에서 설정**
   - Claudia 실행
   - Settings 탭으로 이동
   - API Key Helper 필드에 키 설정 스크립트 경로 입력
   - 또는 환경 변수로 직접 설정

3. **키 검증**
   - Claude 연결 상태 확인
   - 테스트 메시지 전송으로 검증

## 기능 및 특징

### 1. 주요 기능
- **Claude Code 세션 관리**: 프로젝트별 세션 관리
- **에이전트 실행**: 사용자 정의 AI 에이전트 실행
- **MCP 서버 관리**: Model Context Protocol 서버 관리
- **사용량 대시보드**: 토큰 사용량 및 비용 추적
- **체크포인트 시스템**: 세션 상태 저장 및 복원

### 2. 지원 모델
- Claude 3.5 Sonnet (기본 권장)
- Claude 3 Opus
- Claude 3 Haiku
- 사용자 정의 모델 (ANTHROPIC_MODEL 환경 변수)

### 3. 프로젝트 구조
```
~/.claude/
├── settings.json           # 전역 설정
├── projects/              # 프로젝트별 세션
│   ├── project1/
│   │   ├── session1.jsonl
│   │   └── session2.jsonl
│   └── project2/
└── checkpoints/           # 체크포인트 저장소
```

## 문제 해결

### 1. 연결 문제
- **증상**: Claude와 연결되지 않음
- **해결**: 
  1. Claude Code CLI 설치 확인
  2. API 키 또는 구독 토큰 확인
  3. 네트워크 연결 확인
  4. 프록시 설정 확인

### 2. 터미널 창 표시
- **증상**: Nova 에이전트 실행 시 터미널 창이 나타남
- **해결**:
  1. 릴리즈 빌드 사용 확인
  2. Windows subsystem 설정 확인
  3. Tauri 창 설정 확인

### 3. 권한 문제
- **증상**: 파일 읽기/쓰기 오류
- **해결**:
  1. ~/.claude 디렉토리 권한 확인
  2. 관리자 권한으로 실행
  3. 파일 시스템 권한 설정 확인

## API 참조

### 주요 Tauri 명령어

#### Claude 관련
- `get_claude_settings()`: Claude 설정 조회
- `save_claude_settings(settings)`: Claude 설정 저장
- `check_claude_version()`: Claude Code 버전 확인
- `execute_claude_code(params)`: Claude Code 실행

#### 세션 관리
- `list_projects()`: 프로젝트 목록 조회
- `get_project_sessions(projectId)`: 프로젝트 세션 목록
- `open_new_session(projectPath)`: 새 세션 생성
- `load_session_history(sessionId)`: 세션 히스토리 로드

#### 에이전트 관리
- `list_agents()`: 에이전트 목록
- `execute_agent(agentId, params)`: 에이전트 실행
- `get_agent_run(runId)`: 실행 결과 조회

## 보안 고려사항

1. **API 키 보안**
   - API 키를 코드에 하드코딩하지 마세요
   - 환경 변수 또는 안전한 설정 파일 사용
   - 키 순환 정책 수립

2. **네트워크 보안**
   - HTTPS 통신 확인
   - 프록시 설정 시 보안 검토
   - 방화벽 규칙 확인

3. **로컬 데이터 보안**
   - 세션 데이터 암호화 고려
   - 임시 파일 자동 삭제
   - 사용자 권한 최소화

## 라이선스

이 프로젝트는 AGPL-3.0 라이선스하에 배포됩니다.

## 지원 및 문의

- **이슈 신고**: GitHub Issues
- **문서**: 프로젝트 README.md
- **커뮤니티**: 관련 커뮤니티 포럼

---

*마지막 업데이트: 2025-01-17*
*문서 버전: 1.0*