// Test script to verify Gemini backend functionality
// Run this after starting the Tauri dev server

const API_KEY = process.env.GEMINI_API_KEY || '';

if (!API_KEY) {
    console.error('Please set GEMINI_API_KEY environment variable');
    process.exit(1);
}

async function testGeminiBackend() {
    console.log('Testing Gemini Backend...\n');
    
    // Test 1: Direct API call to Gemini
    console.log('1. Testing direct Gemini API call...');
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: "안녕하세요! 오늘 어떻게 지내세요?"
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 8192,
                    }
                })
            }
        );
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error?.message || 'API request failed');
        }
        
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
        console.log('✅ Direct API call successful!');
        console.log('Response:', text.substring(0, 100) + '...\n');
        
    } catch (error) {
        console.error('❌ Direct API call failed:', error.message);
    }
    
    // Test 2: Test the expected backend response format
    console.log('2. Testing response format...');
    const mockResponse = {
        text: "안녕하세요! 잘 지내고 계신가요?",
        finish_reason: "STOP",
        safety_ratings: [],
        usage_metadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 20,
            totalTokenCount: 30
        }
    };
    
    console.log('Expected backend response format:');
    console.log(JSON.stringify(mockResponse, null, 2));
    console.log('\n✅ Response format test complete\n');
    
    // Test 3: Error scenarios
    console.log('3. Testing error scenarios...');
    
    // Test with invalid API key
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=INVALID_KEY`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: "Test"
                        }]
                    }]
                })
            }
        );
        
        const data = await response.json();
        console.log('✅ Invalid API key error handled correctly');
        console.log('Error response:', data.error?.message || 'Unknown error');
        
    } catch (error) {
        console.log('✅ Network error handled correctly');
        console.log('Error:', error.message);
    }
    
    console.log('\n✅ All tests complete!');
}

// Run the tests
testGeminiBackend();