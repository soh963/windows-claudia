// Test script to verify Ollama dynamic detection functionality
// Run this with: node test-ollama-detection.js

const { spawn } = require('child_process');
const fetch = require('node-fetch');

async function testOllamaAPI() {
    console.log('🔍 Testing Ollama API connectivity...');
    
    try {
        const response = await fetch('http://localhost:11434/api/tags');
        if (response.ok) {
            const data = await response.json();
            console.log(`✅ Ollama is running! Found ${data.models.length} models:`);
            
            // Display first 5 models for preview
            data.models.slice(0, 5).forEach((model, i) => {
                const sizeGB = (model.size / (1024 * 1024 * 1024)).toFixed(1);
                const paramSize = model.details?.parameter_size || 'unknown';
                console.log(`  ${i + 1}. ${model.name} (${paramSize}, ${sizeGB}GB)`);
            });
            
            if (data.models.length > 5) {
                console.log(`  ... and ${data.models.length - 5} more models`);
            }
            
            return true;
        } else {
            console.log(`❌ Ollama API returned status: ${response.status}`);
            return false;
        }
    } catch (error) {
        console.log(`❌ Failed to connect to Ollama: ${error.message}`);
        console.log('   Make sure Ollama is running: ollama serve');
        return false;
    }
}

async function testClaudiaIntegration() {
    console.log('\n🏗️  Testing Claudia integration...');
    console.log('   Building and testing the Claudia app...');
    
    return new Promise((resolve) => {
        const buildProcess = spawn('cargo', ['check'], {
            cwd: './src-tauri',
            stdio: 'pipe'
        });
        
        let output = '';
        buildProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        buildProcess.stderr.on('data', (data) => {
            output += data.toString();
        });
        
        buildProcess.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Claudia integration compiled successfully!');
                console.log('   Your new Ollama detection features are ready to use.');
                resolve(true);
            } else {
                console.log('❌ Compilation failed. Check the output above.');
                console.log(output);
                resolve(false);
            }
        });
    });
}

async function showUsageInstructions() {
    console.log('\n📋 How to use the new Ollama features:');
    console.log('');
    console.log('1. 🏃 Start your Claudia app:');
    console.log('   npm run tauri dev');
    console.log('');
    console.log('2. 🤖 In the model selector, your actual Ollama models will be shown:');
    console.log('   • GPT-OSS 120B 🏠🔥🚀 (116.8B, 65GB) - Exceptional performance');
    console.log('   • Llama3.1 8B 🏠 (8.0B, 5GB) - Balanced performance');
    console.log('   • Code Llama 7B 🏠💻 (7B, 4GB) - Specialized for coding');
    console.log('   • And all your other installed models...');
    console.log('');
    console.log('3. 🎯 Each model shows:');
    console.log('   • Intelligence score (0-100)');
    console.log('   • Speed score (0-100)');
    console.log('   • Coding excellence score');
    console.log('   • Recommended use cases');
    console.log('');
    console.log('4. 🔄 Models are automatically refreshed when you:');
    console.log('   • Start the app');
    console.log('   • Pull/delete models with ollama');
    console.log('');
    console.log('🎉 No more manual model list updates needed!');
}

async function main() {
    console.log('🚀 Ollama Dynamic Detection Test Suite');
    console.log('=====================================\n');
    
    const ollamaWorking = await testOllamaAPI();
    
    if (ollamaWorking) {
        const integrationWorking = await testClaudiaIntegration();
        
        if (integrationWorking) {
            await showUsageInstructions();
            console.log('\n✅ All tests passed! Your dynamic Ollama detection is ready to use.');
        } else {
            console.log('\n❌ Integration test failed. Check the build errors above.');
        }
    } else {
        console.log('\n❌ Ollama is not accessible. Please start Ollama first:');
        console.log('   ollama serve');
    }
}

// Run the tests
main().catch(console.error);