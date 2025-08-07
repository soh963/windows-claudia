import { invoke } from '@tauri-apps/api/core';
import { MemoryType, MemoryPriority } from '@/hooks/useMemorySystem';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface ToolInvocation {
  tool_name: string;
  parameters: Record<string, any>;
  result?: any;
  error?: string;
  timestamp: string;
}

interface FileOperation {
  operation: 'read' | 'write' | 'edit' | 'delete';
  path: string;
  content?: string;
  timestamp: string;
}

/**
 * Automatically capture and store conversation context as memories
 */
export class MemoryCapture {
  private sessionId: string;
  private currentModel: string;
  private messageBuffer: Message[] = [];
  private toolBuffer: ToolInvocation[] = [];
  private fileBuffer: FileOperation[] = [];
  private captureInterval: number | null = null;
  private isCapturing = false;

  constructor(sessionId: string, model: string) {
    this.sessionId = sessionId;
    this.currentModel = model;
  }

  /**
   * Start automatic memory capture
   */
  startCapture(intervalMs: number = 5000) {
    if (this.isCapturing) return;
    
    this.isCapturing = true;
    this.captureInterval = window.setInterval(() => {
      this.flushBuffers();
    }, intervalMs);
  }

  /**
   * Stop automatic memory capture
   */
  stopCapture() {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
    this.isCapturing = false;
    this.flushBuffers(); // Final flush
  }

  /**
   * Update the current model
   */
  setModel(model: string) {
    this.currentModel = model;
  }

  /**
   * Capture a conversation message
   */
  async captureMessage(message: Message) {
    this.messageBuffer.push(message);
    
    // Immediately store critical messages
    if (this.isImportantMessage(message)) {
      await this.storeMessageMemory(message, MemoryPriority.High);
    }
    
    // Auto-flush if buffer is getting large
    if (this.messageBuffer.length >= 10) {
      await this.flushMessageBuffer();
    }
  }

  /**
   * Capture a tool invocation
   */
  async captureTool(tool: ToolInvocation) {
    this.toolBuffer.push(tool);
    
    // Store immediately for important tools
    if (this.isImportantTool(tool)) {
      await this.storeToolMemory(tool, MemoryPriority.High);
    }
    
    if (this.toolBuffer.length >= 5) {
      await this.flushToolBuffer();
    }
  }

  /**
   * Capture a file operation
   */
  async captureFileOperation(operation: FileOperation) {
    this.fileBuffer.push(operation);
    
    // Store immediately for write operations
    if (operation.operation === 'write' || operation.operation === 'delete') {
      await this.storeFileMemory(operation, MemoryPriority.High);
    }
    
    if (this.fileBuffer.length >= 5) {
      await this.flushFileBuffer();
    }
  }

  /**
   * Capture system prompt or configuration
   */
  async captureSystemPrompt(prompt: string, metadata?: Record<string, string>) {
    try {
      await invoke('store_memory_entry', {
        sessionId: this.sessionId,
        model: this.currentModel,
        memoryType: MemoryType.SystemPrompt,
        content: prompt,
        metadata: metadata || {},
        priority: MemoryPriority.Critical
      });
    } catch (error) {
      console.error('Failed to capture system prompt:', error);
    }
  }

  /**
   * Capture project metadata
   */
  async captureProjectMetadata(metadata: Record<string, any>) {
    try {
      await invoke('store_memory_entry', {
        sessionId: this.sessionId,
        model: this.currentModel,
        memoryType: MemoryType.ProjectMetadata,
        content: JSON.stringify(metadata, null, 2),
        metadata: {
          type: 'project_config',
          timestamp: new Date().toISOString()
        },
        priority: MemoryPriority.High
      });
    } catch (error) {
      console.error('Failed to capture project metadata:', error);
    }
  }

  /**
   * Flush all buffers
   */
  private async flushBuffers() {
    await Promise.all([
      this.flushMessageBuffer(),
      this.flushToolBuffer(),
      this.flushFileBuffer()
    ]);
  }

  /**
   * Flush message buffer
   */
  private async flushMessageBuffer() {
    if (this.messageBuffer.length === 0) return;
    
    // Create a conversation summary if we have multiple messages
    if (this.messageBuffer.length > 1) {
      const summary = this.createConversationSummary(this.messageBuffer);
      await this.storeConversationMemory(summary);
    } else if (this.messageBuffer.length === 1) {
      await this.storeMessageMemory(this.messageBuffer[0], MemoryPriority.Medium);
    }
    
    this.messageBuffer = [];
  }

  /**
   * Flush tool buffer
   */
  private async flushToolBuffer() {
    if (this.toolBuffer.length === 0) return;
    
    for (const tool of this.toolBuffer) {
      await this.storeToolMemory(tool, MemoryPriority.Medium);
    }
    
    this.toolBuffer = [];
  }

  /**
   * Flush file buffer
   */
  private async flushFileBuffer() {
    if (this.fileBuffer.length === 0) return;
    
    // Group file operations by path
    const grouped = this.groupFileOperations(this.fileBuffer);
    
    for (const [path, operations] of grouped.entries()) {
      await this.storeFileGroupMemory(path, operations);
    }
    
    this.fileBuffer = [];
  }

  /**
   * Store a message as memory
   */
  private async storeMessageMemory(message: Message, priority: MemoryPriority) {
    try {
      await invoke('store_memory_entry', {
        sessionId: this.sessionId,
        model: message.model || this.currentModel,
        memoryType: MemoryType.Conversation,
        content: `${message.role}: ${message.content}`,
        metadata: {
          message_id: message.id,
          role: message.role,
          timestamp: message.timestamp,
          ...message.metadata
        },
        priority
      });
    } catch (error) {
      console.error('Failed to store message memory:', error);
    }
  }

  /**
   * Store a conversation summary
   */
  private async storeConversationMemory(summary: string) {
    try {
      await invoke('store_memory_entry', {
        sessionId: this.sessionId,
        model: this.currentModel,
        memoryType: MemoryType.Conversation,
        content: summary,
        metadata: {
          type: 'conversation_summary',
          message_count: this.messageBuffer.length.toString(),
          timestamp: new Date().toISOString()
        },
        priority: MemoryPriority.Medium
      });
    } catch (error) {
      console.error('Failed to store conversation memory:', error);
    }
  }

  /**
   * Store a tool invocation as memory
   */
  private async storeToolMemory(tool: ToolInvocation, priority: MemoryPriority) {
    try {
      const content = tool.error 
        ? `Tool ${tool.tool_name} failed: ${tool.error}`
        : `Tool ${tool.tool_name} invoked successfully`;
      
      await invoke('store_memory_entry', {
        sessionId: this.sessionId,
        model: this.currentModel,
        memoryType: MemoryType.ToolUsage,
        content,
        metadata: {
          tool_name: tool.tool_name,
          parameters: JSON.stringify(tool.parameters),
          has_error: tool.error ? 'true' : 'false',
          timestamp: tool.timestamp
        },
        priority
      });
    } catch (error) {
      console.error('Failed to store tool memory:', error);
    }
  }

  /**
   * Store a file operation as memory
   */
  private async storeFileMemory(operation: FileOperation, priority: MemoryPriority) {
    try {
      const content = `File ${operation.operation}: ${operation.path}`;
      
      await invoke('store_memory_entry', {
        sessionId: this.sessionId,
        model: this.currentModel,
        memoryType: MemoryType.WorkContext,
        content,
        metadata: {
          operation: operation.operation,
          path: operation.path,
          timestamp: operation.timestamp
        },
        priority
      });
    } catch (error) {
      console.error('Failed to store file memory:', error);
    }
  }

  /**
   * Store grouped file operations
   */
  private async storeFileGroupMemory(path: string, operations: FileOperation[]) {
    try {
      const summary = `${operations.length} operations on ${path}: ${operations.map(o => o.operation).join(', ')}`;
      
      await invoke('store_memory_entry', {
        sessionId: this.sessionId,
        model: this.currentModel,
        memoryType: MemoryType.WorkContext,
        content: summary,
        metadata: {
          path,
          operation_count: operations.length.toString(),
          operations: operations.map(o => o.operation).join(','),
          timestamp: new Date().toISOString()
        },
        priority: MemoryPriority.Medium
      });
    } catch (error) {
      console.error('Failed to store file group memory:', error);
    }
  }

  /**
   * Check if a message is important
   */
  private isImportantMessage(message: Message): boolean {
    const importantKeywords = [
      'error', 'failed', 'critical', 'important', 'bug', 'issue',
      'fix', 'solved', 'complete', 'done', 'success'
    ];
    
    const lowerContent = message.content.toLowerCase();
    return importantKeywords.some(keyword => lowerContent.includes(keyword));
  }

  /**
   * Check if a tool is important
   */
  private isImportantTool(tool: ToolInvocation): boolean {
    const importantTools = [
      'execute_command', 'write_file', 'delete_file', 
      'create_checkpoint', 'deploy', 'test'
    ];
    
    return importantTools.includes(tool.tool_name) || !!tool.error;
  }

  /**
   * Create a conversation summary
   */
  private createConversationSummary(messages: Message[]): string {
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    
    let summary = `Conversation with ${messages.length} messages:\n`;
    
    if (userMessages.length > 0) {
      const userTopics = this.extractTopics(userMessages.map(m => m.content).join(' '));
      summary += `User discussed: ${userTopics.join(', ')}\n`;
    }
    
    if (assistantMessages.length > 0) {
      const assistantTopics = this.extractTopics(assistantMessages.map(m => m.content).join(' '));
      summary += `Assistant provided: ${assistantTopics.join(', ')}\n`;
    }
    
    return summary;
  }

  /**
   * Extract topics from text (simplified)
   */
  private extractTopics(text: string): string[] {
    // Simple keyword extraction - in production, use NLP
    const words = text.split(/\s+/)
      .filter(w => w.length > 5)
      .map(w => w.toLowerCase())
      .filter(w => !this.isCommonWord(w));
    
    // Get unique topics
    const unique = Array.from(new Set(words));
    return unique.slice(0, 5); // Top 5 topics
  }

  /**
   * Check if a word is common (to filter out)
   */
  private isCommonWord(word: string): boolean {
    const common = [
      'the', 'and', 'for', 'with', 'this', 'that', 'have', 'from',
      'will', 'would', 'could', 'should', 'about', 'which', 'their'
    ];
    return common.includes(word);
  }

  /**
   * Group file operations by path
   */
  private groupFileOperations(operations: FileOperation[]): Map<string, FileOperation[]> {
    const grouped = new Map<string, FileOperation[]>();
    
    for (const op of operations) {
      if (!grouped.has(op.path)) {
        grouped.set(op.path, []);
      }
      grouped.get(op.path)!.push(op);
    }
    
    return grouped;
  }
}

/**
 * Create a memory capture instance for a session
 */
export function createMemoryCapture(sessionId: string, model: string): MemoryCapture {
  return new MemoryCapture(sessionId, model);
}