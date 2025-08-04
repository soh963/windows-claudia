# Claude Code CLI 인증 방식 상세 가이드

## 개요

Claude Code CLI는 Anthropic의 공식 명령줄 도구로, Claude AI와 상호작용할 수 있게 해줍니다. 이 문서는 Windows 환경에서 Cygwin/MSYS2(crush)를 통해 Claude Code를 사용하기 위한 인증 방법을 상세히 설명합니다.

## 인증 방식

### 1. API Key 인증 (권장)

Claude Code CLI는 Anthropic API Key를 사용하여 인증합니다.

#### API Key 발급 방법

1. [Anthropic Console](https://console.anthropic.com/)에 로그인
2. API Keys 섹션으로 이동
3. "Create Key" 버튼 클릭
4. Key 이름 설정 및 생성
5. 생성된 API Key 복사 (한 번만 표시되므로 안전하게 보관)

#### 환경 변수 설정

**Windows 환경 변수 (영구 설정):**
```powershell
# PowerShell (관리자 권한)
[Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", "sk-ant-...", [EnvironmentVariableTarget]::User)
```

**Cygwin/MSYS2 환경 설정:**
```bash
# ~/.bashrc 또는 ~/.bash_profile에 추가
export ANTHROPIC_API_KEY="sk-ant-..."

# 설정 적용
source ~/.bashrc
```

**임시 설정 (현재 세션만):**
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

### 2. 설정 파일을 통한 인증

Claude Code는 설정 파일을 통해서도 인증할 수 있습니다.

#### 설정 파일 위치

- **Windows:** `%APPDATA%\claude\config.json`
- **Cygwin/MSYS2:** `~/.config/claude/config.json`

#### 설정 파일 구조

```json
{
  "api_key": "sk-ant-...",
  "default_model": "claude-3-opus-20240229",
  "max_tokens": 4096,
  "temperature": 0.7,
  "api_base_url": "https://api.anthropic.com"
}
```

#### 설정 파일 생성

```bash
# Cygwin/MSYS2에서
mkdir -p ~/.config/claude
cat > ~/.config/claude/config.json << EOF
{
  "api_key": "sk-ant-your-api-key-here",
  "default_model": "claude-3-opus-20240229"
}
EOF

# 파일 권한 설정 (보안)
chmod 600 ~/.config/claude/config.json
```

### 3. 명령줄 옵션을 통한 인증

매번 명령 실행 시 API Key를 직접 전달할 수도 있습니다.

```bash
claude-code --api-key "sk-ant-..." --prompt "Hello, Claude!"
```

## Cygwin/MSYS2 환경 설정

### 1. 사전 요구사항

```bash
# 필요한 패키지 설치
# Cygwin
apt-cyg install curl wget git python3

# MSYS2
pacman -S curl wget git python
```

### 2. Claude Code 설치

#### 방법 1: npm을 통한 설치 (Node.js 필요)

```bash
# Node.js 설치 확인
node --version

# Claude Code 설치
npm install -g @anthropic-ai/claude-code

# 설치 확인
claude-code --version
```

#### 방법 2: 바이너리 직접 다운로드

```bash
# 최신 릴리스 다운로드 (예시)
curl -L https://github.com/anthropics/claude-code/releases/latest/download/claude-code-windows-x64.exe -o claude-code.exe

# 실행 권한 부여
chmod +x claude-code.exe

# PATH에 추가
echo 'export PATH="$PATH:$(pwd)"' >> ~/.bashrc
source ~/.bashrc
```

### 3. 경로 문제 해결

Cygwin/MSYS2는 Windows 경로를 다르게 처리하므로 주의가 필요합니다.

#### 경로 변환

```bash
# Windows 경로를 Cygwin 경로로 변환
cygpath -u "C:\Users\username\project"
# 결과: /cygdrive/c/Users/username/project

# Cygwin 경로를 Windows 경로로 변환
cygpath -w "/home/user/project"
# 결과: C:\cygwin64\home\user\project
```

#### 별칭 설정으로 편의성 향상

```bash
# ~/.bashrc에 추가
alias claude='claude-code'

# Windows 경로 자동 변환 함수
claude-win() {
    local args=()
    for arg in "$@"; do
        if [[ -e "$arg" ]]; then
            args+=("$(cygpath -w "$arg")")
        else
            args+=("$arg")
        fi
    done
    claude-code "${args[@]}"
}
```

### 4. 인증 테스트

```bash
# 환경 변수 확인
echo $ANTHROPIC_API_KEY

# Claude Code 테스트
claude-code --prompt "Hello, Claude! Please confirm you're working."

# 파일과 함께 테스트
echo "print('Hello from Python')" > test.py
claude-code --prompt "Explain this code" test.py
```

## 일반적인 문제 해결

### 1. API Key 인식 안 됨

```bash
# 환경 변수 재설정
unset ANTHROPIC_API_KEY
export ANTHROPIC_API_KEY="sk-ant-..."

# Windows 환경 변수와 동기화
export ANTHROPIC_API_KEY=$(cmd.exe /c "echo %ANTHROPIC_API_KEY%" 2>/dev/null | tr -d '\r')
```

### 2. SSL 인증서 문제

```bash
# Cygwin/MSYS2에서 SSL 인증서 업데이트
# Cygwin
apt-cyg install ca-certificates

# MSYS2
pacman -S ca-certificates

# 환경 변수 설정
export SSL_CERT_FILE=/etc/ssl/certs/ca-bundle.crt
```

### 3. 프록시 설정

기업 환경에서 프록시를 사용하는 경우:

```bash
# HTTP 프록시 설정
export HTTP_PROXY="http://proxy.company.com:8080"
export HTTPS_PROXY="http://proxy.company.com:8080"

# Claude Code 프록시 설정
claude-code --proxy "http://proxy.company.com:8080" --prompt "Test"
```

### 4. 문자 인코딩 문제

```bash
# UTF-8 인코딩 강제
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# Windows 코드 페이지 설정
chcp.com 65001
```

## 보안 권장사항

### 1. API Key 보호

```bash
# 히스토리에 API Key 남기지 않기
# 공백으로 시작하는 명령은 히스토리에 저장되지 않음
 export ANTHROPIC_API_KEY="sk-ant-..."

# .gitignore에 추가
echo "config.json" >> ~/.gitignore
echo ".env" >> ~/.gitignore
```

### 2. 파일 권한 설정

```bash
# 설정 파일 권한 제한
chmod 600 ~/.config/claude/config.json
chmod 700 ~/.config/claude

# API Key 파일 권한
chmod 600 ~/.env
```

### 3. 환경별 설정 분리

```bash
# 개발 환경
export CLAUDE_ENV="development"
export ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY_DEV"

# 프로덕션 환경
export CLAUDE_ENV="production"
export ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY_PROD"
```

## 고급 설정

### 1. 자동 완성 설정

```bash
# Bash 자동 완성 (claude-code.completion 파일이 있는 경우)
source /path/to/claude-code.completion

# 또는 수동으로 생성
_claude_code_completion() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local opts="--help --version --api-key --prompt --model --max-tokens --temperature"
    COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
}
complete -F _claude_code_completion claude-code
```

### 2. 모델 선택

```bash
# 사용 가능한 모델
# - claude-3-opus-20240229 (가장 강력)
# - claude-3-sonnet-20240229 (균형)
# - claude-3-haiku-20240307 (빠름)

# 모델 지정
claude-code --model claude-3-opus-20240229 --prompt "Complex task"
```

### 3. 스트리밍 설정

```bash
# 스트리밍 활성화 (실시간 응답)
claude-code --stream --prompt "Write a long story"

# 스트리밍 비활성화
claude-code --no-stream --prompt "Quick answer"
```

## 통합 예제

### 1. Git 커밋 메시지 생성

```bash
# Git diff를 Claude에게 전달하여 커밋 메시지 생성
git diff --staged | claude-code --prompt "Generate a commit message for these changes"
```

### 2. 코드 리뷰

```bash
# 파일 변경사항 리뷰
git diff main..feature-branch -- "*.py" | \
  claude-code --prompt "Review this code and suggest improvements"
```

### 3. 문서 생성

```bash
# README 생성
find . -name "*.py" -type f -exec cat {} \; | \
  claude-code --prompt "Generate a comprehensive README.md for this Python project"
```

## 트러블슈팅 체크리스트

1. ✅ API Key가 올바르게 설정되었는가?
2. ✅ 환경 변수가 제대로 로드되었는가?
3. ✅ Claude Code가 PATH에 있는가?
4. ✅ 네트워크 연결이 정상인가?
5. ✅ 프록시 설정이 필요한가?
6. ✅ SSL 인증서가 최신인가?
7. ✅ 파일 경로가 올바른 형식인가?
8. ✅ 문자 인코딩이 UTF-8로 설정되었는가?

## 참고 자료

- [Claude Code 공식 문서](https://docs.anthropic.com/claude-code)
- [Anthropic API 문서](https://docs.anthropic.com/claude/reference/getting-started)
- [Cygwin 문서](https://cygwin.com/docs.html)
- [MSYS2 문서](https://www.msys2.org/docs/)

---

이 문서는 Windows 환경에서 Cygwin/MSYS2를 통해 Claude Code CLI를 사용하는 방법을 다룹니다. 추가적인 질문이나 문제가 있다면 Anthropic 지원팀에 문의하시기 바랍니다.