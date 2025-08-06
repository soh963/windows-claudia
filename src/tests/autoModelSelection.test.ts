import { describe, it, expect, beforeEach } from 'vitest';
import { getModelById, ALL_MODELS } from '@/lib/models';

// Auto model selection logic
interface ModelSelectionContext {
  messageLength: number;
  hasImages: boolean;
  codeBlockCount: number;
  isComplexTask: boolean;
  contextWindowUsage: number;
}

const selectOptimalModel = (context: ModelSelectionContext): string => {
  // If context window usage is high, prefer Gemini models
  if (context.contextWindowUsage > 150000) {
    return 'gemini-exp-1206'; // 2M context window
  }
  
  // For image processing, ensure vision support
  if (context.hasImages) {
    // Prefer Claude for complex image analysis
    if (context.isComplexTask) {
      return 'opus';
    }
    return 'sonnet';
  }
  
  // For code-heavy tasks
  if (context.codeBlockCount > 5) {
    // Claude models are typically better for code
    return context.isComplexTask ? 'opus' : 'sonnet';
  }
  
  // For simple, fast responses
  if (context.messageLength < 500 && !context.isComplexTask) {
    return 'gemini-2.0-flash-exp'; // Fast experimental model
  }
  
  // Default to Sonnet for balanced performance
  return 'sonnet';
};

describe('Auto Model Selection', () => {
  describe('selectOptimalModel', () => {
    it('should select Gemini for large context window needs', () => {
      const context: ModelSelectionContext = {
        messageLength: 50000,
        hasImages: false,
        codeBlockCount: 2,
        isComplexTask: false,
        contextWindowUsage: 200000
      };
      
      const selected = selectOptimalModel(context);
      expect(selected).toBe('gemini-exp-1206');
      
      const model = getModelById(selected);
      expect(model?.contextWindow).toBeGreaterThanOrEqual(2000000);
    });
    
    it('should select Claude Opus for complex image analysis', () => {
      const context: ModelSelectionContext = {
        messageLength: 1000,
        hasImages: true,
        codeBlockCount: 0,
        isComplexTask: true,
        contextWindowUsage: 10000
      };
      
      const selected = selectOptimalModel(context);
      expect(selected).toBe('opus');
    });
    
    it('should select Claude for code-heavy tasks', () => {
      const context: ModelSelectionContext = {
        messageLength: 2000,
        hasImages: false,
        codeBlockCount: 10,
        isComplexTask: true,
        contextWindowUsage: 20000
      };
      
      const selected = selectOptimalModel(context);
      expect(['opus', 'sonnet']).toContain(selected);
      
      const model = getModelById(selected);
      expect(model?.provider).toBe('claude');
    });
    
    it('should select fast Gemini model for simple tasks', () => {
      const context: ModelSelectionContext = {
        messageLength: 200,
        hasImages: false,
        codeBlockCount: 0,
        isComplexTask: false,
        contextWindowUsage: 500
      };
      
      const selected = selectOptimalModel(context);
      expect(selected).toBe('gemini-2.0-flash-exp');
    });
    
    it('should default to Sonnet for balanced tasks', () => {
      const context: ModelSelectionContext = {
        messageLength: 1500,
        hasImages: false,
        codeBlockCount: 3,
        isComplexTask: false,
        contextWindowUsage: 5000
      };
      
      const selected = selectOptimalModel(context);
      expect(selected).toBe('sonnet');
    });
  });
  
  describe('Model Capabilities', () => {
    it('all models should have required properties', () => {
      ALL_MODELS.forEach(model => {
        expect(model).toHaveProperty('id');
        expect(model).toHaveProperty('name');
        expect(model).toHaveProperty('provider');
        expect(model).toHaveProperty('contextWindow');
        expect(model.contextWindow).toBeGreaterThan(0);
      });
    });
    
    it('vision-supporting models should be properly marked', () => {
      const visionModels = ALL_MODELS.filter(m => m.supportsVision);
      expect(visionModels.length).toBeGreaterThan(0);
      
      // All current models support vision
      expect(visionModels).toContainEqual(
        expect.objectContaining({ id: 'sonnet' })
      );
      expect(visionModels).toContainEqual(
        expect.objectContaining({ id: 'opus' })
      );
    });
    
    it('Gemini models should require API key', () => {
      const geminiModels = ALL_MODELS.filter(m => m.provider === 'gemini');
      geminiModels.forEach(model => {
        expect(model.requiresApiKey).toBe(true);
      });
    });
  });
  
  describe('Context Analysis', () => {
    const analyzeMessage = (message: string): Partial<ModelSelectionContext> => {
      const codeBlockRegex = /```[\s\S]*?```/g;
      const imageRegex = /!\[.*?\]\(.*?\)|<img.*?>/gi;
      
      return {
        messageLength: message.length,
        hasImages: imageRegex.test(message),
        codeBlockCount: (message.match(codeBlockRegex) || []).length,
        contextWindowUsage: message.length // Simplified for testing
      };
    };
    
    it('should detect code blocks correctly', () => {
      const message = `
        Here's some code:
        \`\`\`javascript
        console.log('Hello');
        \`\`\`
        
        And more:
        \`\`\`python
        print("World")
        \`\`\`
      `;
      
      const analysis = analyzeMessage(message);
      expect(analysis.codeBlockCount).toBe(2);
    });
    
    it('should detect images', () => {
      const message = `
        Check this image: ![alt text](image.png)
        And this: <img src="photo.jpg" />
      `;
      
      const analysis = analyzeMessage(message);
      expect(analysis.hasImages).toBe(true);
    });
  });
});