# Gemini API Key 설정 문제 해결

이 문서는 Claudia 애플리케이션에서 Gemini API 키 설정이 제대로 동작하지 않던 문제를 해결한 과정을 기록합니다.

## 문제 상황

Claudia의 설정 화면에서 Gemini API 키를 입력하고 저장한 후에도, 채팅 기능에서 해당 키를 사용할 수 없는 문제가 발생했습니다.

## 원인 분석

1. `Settings.tsx` 컴포넌트는 Gemini API 키를 브라우저의 `localStorage`에 저장하고 있었습니다.
2. 반면, 백엔드의 `gemini.rs`는 API 키를 SQLite 데이터베이스의 `app_settings` 테이블에 저장하고 불러오고 있었습니다.
3. 이러한 불일치로 인해 프런트엔드에서 설정한 키가 백엔드에서 사용되지 못하는 문제가 발생했습니다.

## 해결 과정

### 1. API 인터페이스 추가

`api.ts` 파일에 다음 함수들을 추가하여 프런트엔드가 백엔드의 Tauri 명령을 호출할 수 있도록 했습니다:

- `getGeminiApiKey()`: 저장된 Gemini API 키를 가져옵니다.
- `setGeminiApiKey(apiKey: string)`: Gemini API 키를 저장합니다.

### 2. 설정 컴포넌트 수정

`Settings.tsx` 파일을 수정하여:

- `useEffect` 훅에서 설정을 로드할 때 `localStorage` 대신 `api.getGeminiApiKey()`를 사용하도록 변경했습니다.
- `saveSettings` 함수에서 키를 저장할 때 `localStorage` 대신 `api.setGeminiApiKey()`를 사용하도록 변경했습니다.

이를 통해 설정 화면에서의 키 관리가 백엔드와 동일한 저장소를 사용하도록 수정되었습니다.

## 결과

이제 Claudia의 설정 화면에서 Gemini API 키를 입력하고 저장하면, 해당 키가 올바르게 백엔드에 저장되어 채팅 기능에서 사용할 수 있게 되었습니다.