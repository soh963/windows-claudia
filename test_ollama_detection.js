// Test script for Ollama dynamic model detection
const { invoke } = require('@tauri-apps/api/tauri');

async function testOllamaDetection() {
    console.log('Testing Ollama dynamic model detection...\n');
    
    try {
        // Test 1: Check Ollama status
        console.log('1. Testing Ollama connection...');
        const status = await invoke('check_ollama_status');
        console.log('   Ollama Status:', status);
        
        // Test 2: Get basic model list
        console.log('\n2. Getting basic Ollama models...');
        const basicModels = await invoke('get_ollama_models');
        console.log('   Found', basicModels.length, 'models');
        basicModels.forEach(model => {
            console.log(`   - ${model.name} (${(model.size / 1e9).toFixed(1)}GB)`);
        });
        
        // Test 3: Dynamic model detection with analysis
        console.log('\n3. Testing dynamic model detection with capabilities...');
        const detectedModels = await invoke('detect_available_ollama_models');
        console.log('   Analyzed', detectedModels.length, 'models with capabilities');
        
        detectedModels.slice(0, 5).forEach(model => {
            console.log(`   📊 ${model.name}`);
            console.log(`      Intelligence: ${model.capabilities.intelligence}/100`);
            console.log(`      Speed: ${model.capabilities.speed}/100`);
            console.log(`      Coding: ${model.capabilities.coding_excellence}/100`);
            console.log(`      Context: ${model.capabilities.context_window} tokens`);
            console.log(`      Vision: ${model.capabilities.supports_vision ? '✅' : '❌'}`);
        });
        
        // Test 4: Check specific model
        console.log('\n4. Testing specific model check...');
        const modelExists = await invoke('check_ollama_model_exists', { modelId: 'llama3.2:3b' });
        console.log('   llama3.2:3b exists:', modelExists);
        
        // Test 5: Get recommendations
        console.log('\n5. Testing model recommendations...');
        const codingModels = await invoke('get_recommended_ollama_models', { useCase: 'coding' });
        console.log('   Coding recommendations:', codingModels.length);
        codingModels.forEach(model => {
            console.log(`   💻 ${model.name} (Coding: ${model.capabilities.coding_excellence}/100)`);
        });
        
        const fastModels = await invoke('get_recommended_ollama_models', { useCase: 'fast' });
        console.log('\n   Fast recommendations:', fastModels.length);
        fastModels.forEach(model => {
            console.log(`   ⚡ ${model.name} (Speed: ${model.capabilities.speed}/100)`);
        });
        
        console.log('\n✅ All Ollama detection tests completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run if this is the main module
if (require.main === module) {
    testOllamaDetection();
}

module.exports = { testOllamaDetection };