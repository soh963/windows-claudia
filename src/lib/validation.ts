import { invoke } from '@tauri-apps/api/core';

export interface ModelValidationResult {
  model_id: string;
  provider: string;
  test_name: string;
  success: boolean;
  response_time_ms: number;
  error_message?: string;
  response_quality_score: number;
  tool_compatibility: boolean;
  mcp_support: boolean;
}

export interface ComprehensiveValidationReport {
  timestamp: string;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  success_rate: number;
  model_results: ModelValidationResult[];
  auto_selection_accuracy: number;
  universal_executor_performance: number;
  recommendations: string[];
}

export interface ValidationTestSuite {
  test_id: string;
  test_name: string;
  input_message: string;
  expected_capabilities: string[];
  complexity_level: string;
  domain: string;
}

/**
 * Run comprehensive validation tests on all AI models
 * Tests auto selection, universal execution, and tool compatibility
 */
export async function runComprehensiveModelValidation(): Promise<ComprehensiveValidationReport> {
  try {
    console.log('🔍 Starting comprehensive model validation...');
    const report = await invoke<ComprehensiveValidationReport>('run_comprehensive_model_validation');
    
    console.log(`✅ Validation completed: ${report.success_rate.toFixed(1)}% success rate`);
    console.log(`🎯 Auto selection accuracy: ${report.auto_selection_accuracy.toFixed(1)}%`);
    console.log(`🔧 Universal executor performance: ${report.universal_executor_performance.toFixed(1)}%`);
    
    return report;
  } catch (error) {
    console.error('❌ Comprehensive validation failed:', error);
    throw error;
  }
}

/**
 * Validate a specific model with a custom test message
 */
export async function validateSpecificModel(
  modelId: string,
  provider: string,
  testMessage: string
): Promise<ModelValidationResult> {
  try {
    console.log(`🔍 Validating ${modelId} (${provider})...`);
    const result = await invoke<ModelValidationResult>('validate_specific_model', {
      modelId,
      provider,
      testMessage,
    });
    
    console.log(`${result.success ? '✅' : '❌'} ${modelId} validation: ${result.success ? 'PASSED' : 'FAILED'}`);
    if (result.error_message) {
      console.error(`Error: ${result.error_message}`);
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Failed to validate ${modelId}:`, error);
    throw error;
  }
}

/**
 * Get historical validation test reports
 */
export async function getValidationTestHistory(): Promise<ComprehensiveValidationReport[]> {
  try {
    return await invoke<ComprehensiveValidationReport[]>('get_validation_test_history');
  } catch (error) {
    console.error('❌ Failed to get validation history:', error);
    throw error;
  }
}

/**
 * Benchmark the accuracy of auto model selection
 */
export async function benchmarkAutoSelectionAccuracy(): Promise<number> {
  try {
    console.log('🎯 Benchmarking auto selection accuracy...');
    const accuracy = await invoke<number>('benchmark_auto_selection_accuracy');
    
    console.log(`🎯 Auto selection accuracy: ${accuracy.toFixed(1)}%`);
    return accuracy;
  } catch (error) {
    console.error('❌ Failed to benchmark auto selection:', error);
    throw error;
  }
}

/**
 * Run quick validation test for all available models
 */
export async function runQuickValidationTest(): Promise<ModelValidationResult[]> {
  const models = [
    { id: 'opus-4.1', provider: 'claude' },
    { id: 'sonnet-4', provider: 'claude' },
    { id: 'gemini-2.5-pro-exp', provider: 'gemini' },
    { id: 'gemini-2.5-flash', provider: 'gemini' },
    { id: 'llama3.3:latest', provider: 'ollama' },
  ];

  const testMessage = 'Hello! Can you help me write a simple JavaScript function that adds two numbers?';
  const results: ModelValidationResult[] = [];

  console.log('🚀 Running quick validation test on all models...');

  for (const model of models) {
    try {
      const result = await validateSpecificModel(model.id, model.provider, testMessage);
      results.push(result);
    } catch (error) {
      console.error(`Failed to test ${model.id}:`, error);
      // Add failed result
      results.push({
        model_id: model.id,
        provider: model.provider,
        test_name: 'Quick Test',
        success: false,
        response_time_ms: 0,
        error_message: error as string,
        response_quality_score: 0,
        tool_compatibility: false,
        mcp_support: false,
      });
    }
  }

  const successRate = (results.filter(r => r.success).length / results.length) * 100;
  console.log(`✅ Quick validation completed: ${successRate.toFixed(1)}% success rate`);

  return results;
}

/**
 * Test specific functionality across all models
 */
export async function testModelFunctionality(testType: 'coding' | 'analysis' | 'chat'): Promise<ModelValidationResult[]> {
  const testMessages = {
    coding: 'Write a TypeScript function that validates an email address using regex and returns a boolean.',
    analysis: 'Analyze this code for potential improvements: function add(a, b) { return a + b; }',
    chat: 'Explain the concept of machine learning in simple terms.',
  };

  const models = [
    { id: 'opus-4.1', provider: 'claude' },
    { id: 'gemini-2.5-flash', provider: 'gemini' },
    { id: 'llama3.3:latest', provider: 'ollama' },
  ];

  const results: ModelValidationResult[] = [];
  console.log(`🧪 Testing ${testType} functionality across models...`);

  for (const model of models) {
    try {
      const result = await validateSpecificModel(model.id, model.provider, testMessages[testType]);
      results.push(result);
    } catch (error) {
      console.error(`Failed to test ${testType} on ${model.id}:`, error);
      results.push({
        model_id: model.id,
        provider: model.provider,
        test_name: `${testType} Test`,
        success: false,
        response_time_ms: 0,
        error_message: error as string,
        response_quality_score: 0,
        tool_compatibility: false,
        mcp_support: false,
      });
    }
  }

  return results;
}

/**
 * Generate validation summary report
 */
export function generateValidationSummary(results: ModelValidationResult[]): {
  overall_success_rate: number;
  average_response_time: number;
  tool_compatibility_rate: number;
  mcp_support_rate: number;
  best_performing_model: string;
  recommendations: string[];
} {
  const totalTests = results.length;
  const successfulTests = results.filter(r => r.success).length;
  const averageResponseTime = results.reduce((sum, r) => sum + r.response_time_ms, 0) / totalTests;
  const toolCompatibleTests = results.filter(r => r.tool_compatibility).length;
  const mcpSupportTests = results.filter(r => r.mcp_support).length;

  // Find best performing model by quality score
  const bestModel = results.reduce((best, current) => {
    return current.response_quality_score > best.response_quality_score ? current : best;
  }, results[0]);

  const recommendations: string[] = [];
  
  const successRate = (successfulTests / totalTests) * 100;
  if (successRate < 80) {
    recommendations.push('Overall success rate is below 80%. Review model configurations.');
  }
  
  if (averageResponseTime > 5000) {
    recommendations.push('Average response time exceeds 5 seconds. Consider performance optimization.');
  }
  
  const toolCompatibilityRate = (toolCompatibleTests / totalTests) * 100;
  if (toolCompatibilityRate < 90) {
    recommendations.push('Tool compatibility is below 90%. Verify universal executor implementation.');
  }

  return {
    overall_success_rate: successRate,
    average_response_time: averageResponseTime,
    tool_compatibility_rate: toolCompatibilityRate,
    mcp_support_rate: (mcpSupportTests / totalTests) * 100,
    best_performing_model: bestModel?.model_id || 'Unknown',
    recommendations,
  };
}