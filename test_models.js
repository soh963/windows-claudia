import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 모델 리스트 (models.ts에서 추출)
const models = [
  // Claude 모델들
  { id: 'auto', name: 'Auto (Smart Selection)', provider: 'claude', description: '자동 선택' },
  { id: 'opus-4.1', name: 'Claude 4.1 Opus', provider: 'claude', description: '최고 지능, 최고 코딩' },
  { id: 'sonnet-4', name: 'Claude 4 Sonnet', provider: 'claude', description: '균형잡힌 성능' },
  { id: 'sonnet-3.7', name: 'Claude 3.7 Sonnet', provider: 'claude', description: '하이브리드 추론' },
  { id: 'sonnet', name: 'Claude 3.5 Sonnet (Legacy)', provider: 'claude', description: '레거시' },
  { id: 'opus', name: 'Claude 3 Opus (Legacy)', provider: 'claude', description: '레거시' },
  
  // Gemini 모델들
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'gemini', description: '검증된 작동' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'gemini', description: '검증된 작동' },
  { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash Exp', provider: 'gemini', description: '실험적' },
  { id: 'gemini-exp-1206', name: 'Gemini Exp 1206', provider: 'gemini', description: '실험적' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'gemini', description: '미래 모델' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'gemini', description: '미래 모델' },
  
  // Ollama 모델들
  { id: 'llama3.3:latest', name: 'Llama 3.3', provider: 'ollama', description: '로컬 모델' },
  { id: 'llama3.2:latest', name: 'Llama 3.2', provider: 'ollama', description: '로컬 모델' },
  { id: 'codellama:latest', name: 'Code Llama', provider: 'ollama', description: '코딩 전용' },
  { id: 'qwen2.5:latest', name: 'Qwen 2.5', provider: 'ollama', description: '이중언어' },
  { id: 'mistral:latest', name: 'Mistral', provider: 'ollama', description: '유럽 모델' },
  { id: 'phi3:latest', name: 'Phi-3', provider: 'ollama', description: 'Microsoft 모델' }
];

// 테스트 결과 저장할 배열
const testResults = [];

console.log('🤖 Claudia AI 모델 테스트를 시작합니다...\n');
console.log('=' .repeat(80));

// 각 모델별 정보만 출력 (실제 API 테스트는 브라우저에서 수행)
models.forEach((model, index) => {
  console.log(`${index + 1}. ${model.name} (${model.provider})`);
  console.log(`   ID: ${model.id}`);
  console.log(`   설명: ${model.description}`);
  
  // 모델 상태 예측
  let expectedStatus = '❓ 확인 필요';
  if (model.provider === 'claude') {
    if (model.id === 'auto' || model.id === 'opus-4.1' || model.id === 'sonnet-4') {
      expectedStatus = '✅ 정상 작동 예상';
    } else if (model.id.includes('Legacy') || model.id === 'sonnet' || model.id === 'opus') {
      expectedStatus = '🔶 레거시 (작동하지만 곧 은퇴)';
    }
  } else if (model.provider === 'gemini') {
    if (model.description === '검증된 작동') {
      expectedStatus = '✅ 정상 작동 확인됨';
    } else if (model.description === '실험적') {
      expectedStatus = '⚗️ 실험적 (불안정할 수 있음)';
    } else if (model.description === '미래 모델') {
      expectedStatus = '🔄 엔드포인트 매핑 (1.5 시리즈로 연결)';
    }
  } else if (model.provider === 'ollama') {
    expectedStatus = '🏠 로컬 설치 필요';
  }
  
  console.log(`   상태: ${expectedStatus}`);
  console.log('   -'.repeat(40));
  
  testResults.push({
    model: model.name,
    id: model.id,
    provider: model.provider,
    expectedStatus,
    testQuestion: '2+2는 몇인가요?'
  });
});

console.log('\n' + '='.repeat(80));
console.log('📊 테스트 요약');
console.log('='.repeat(80));

const providerSummary = {
  claude: models.filter(m => m.provider === 'claude').length,
  gemini: models.filter(m => m.provider === 'gemini').length,
  ollama: models.filter(m => m.provider === 'ollama').length
};

console.log(`총 모델 개수: ${models.length}개`);
console.log(`- Claude: ${providerSummary.claude}개 모델`);
console.log(`- Gemini: ${providerSummary.gemini}개 모델`);
console.log(`- Ollama: ${providerSummary.ollama}개 모델`);

console.log('\n🔧 실제 테스트 방법:');
console.log('1. 브라우저에서 http://localhost:1428 접속');
console.log('2. 각 모델을 선택하여 "2+2는 몇인가요?" 질문');
console.log('3. 응답이 나오는지 확인');
console.log('4. 응답 속도와 정확성 체크');

console.log('\n⚙️ API 명령어를 통한 테스트:');
console.log('다음 Tauri 명령어들을 사용할 수 있습니다:');
console.log('- validate_all_models_comprehensive()');
console.log('- test_specific_model(model_id, provider, message)');
console.log('- system_health_check()');
console.log('- quick_model_health_check()');

// 결과를 JSON 파일로 저장
fs.writeFileSync(
  path.join(__dirname, 'model_test_results.json'), 
  JSON.stringify({ testResults, summary: providerSummary, timestamp: new Date().toISOString() }, null, 2)
);

console.log('\n✅ 테스트 정보가 model_test_results.json에 저장되었습니다.');
console.log('브라우저에서 실제 모델 테스트를 진행해주세요!');