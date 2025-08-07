import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Send, 
  ArrowUp, 
  ArrowDown, 
  History, 
  Search,
  Settings,
  Brain,
  Zap,
  Clock,
  Command,
  Mic,
  Image,
  Paperclip
} from 'lucide-react';
import { useCommandHistory } from '@/hooks/useCommandHistory';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EnhancedChatInputProps {
  onSubmit: (message: string, options?: ChatInputOptions) => void;
  disabled?: boolean;
  placeholder?: string;
  currentModel?: string;
  autoSelectModel?: boolean;
  onModelSelect?: (modelId: string) => void;
  supportedFeatures?: {
    voice?: boolean;
    image?: boolean;
    files?: boolean;
    autoComplete?: boolean;
  };
}

interface ChatInputOptions {
  model?: string;
  useAutoSelection?: boolean;
  attachments?: File[];
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

interface ModelSuggestion {
  id: string;
  name: string;
  provider: string;
  confidence: number;
  reasoning: string;
  estimatedCost: number;
  estimatedTime: number;
}

const EnhancedChatInput: React.FC<EnhancedChatInputProps> = ({
  onSubmit,
  disabled = false,
  placeholder = "Type your message... (↑↓ for history, Tab for autocomplete)",
  currentModel = "auto",
  autoSelectModel = true,
  onModelSelect,
  supportedFeatures = {}
}) => {
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showModelSuggestions, setShowModelSuggestions] = useState(false);
  const [modelSuggestions, setModelSuggestions] = useState<ModelSuggestion[]>([]);
  const [isComposing, setIsComposing] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    history,
    navigateUp,
    navigateDown,
    addCommand,
    searchHistory,
    getRecentCommands,
    isNavigating,
    hasHistory,
    canNavigateUp,
    canNavigateDown,
    getHistoryStats
  } = useCommandHistory({
    maxHistory: 200,
    sessionKey: currentModel,
    persistHistory: true
  });

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  }, [input]);

  // Focus textarea on mount
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.focus();
    }
  }, []);

  // Get model suggestions based on input
  const getModelSuggestions = useCallback(async (text: string) => {
    if (!text.trim() || !autoSelectModel) return;

    try {
      // This would call the intelligent_routing API
      // For now, we'll use mock suggestions
      const mockSuggestions: ModelSuggestion[] = [
        {
          id: 'opus-4.1',
          name: 'Claude 4.1 Opus',
          provider: 'claude',
          confidence: 0.95,
          reasoning: 'Complex coding task detected',
          estimatedCost: 0.05,
          estimatedTime: 120
        },
        {
          id: 'gemini-2.5-flash',
          name: 'Gemini 2.5 Flash',
          provider: 'gemini',
          confidence: 0.78,
          reasoning: 'Fast response needed',
          estimatedCost: 0.02,
          estimatedTime: 45
        },
        {
          id: 'llama3.3:latest',
          name: 'Llama 3.3',
          provider: 'ollama',
          confidence: 0.65,
          reasoning: 'Local processing preferred',
          estimatedCost: 0.00,
          estimatedTime: 30
        }
      ];

      setModelSuggestions(mockSuggestions);
    } catch (error) {
      console.error('Failed to get model suggestions:', error);
    }
  }, [autoSelectModel]);

  // Handle key press
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Don't handle keys during IME composition
    if (isComposing) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newInput = navigateUp(input);
      if (newInput !== null) {
        setInput(newInput);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newInput = navigateDown();
      if (newInput !== null) {
        setInput(newInput);
      }
      return;
    }

    if (e.key === 'Tab') {
      if (modelSuggestions.length > 0 && !showModelSuggestions) {
        e.preventDefault();
        setShowModelSuggestions(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      setShowHistory(false);
      setShowModelSuggestions(false);
      return;
    }

    // Show history on Ctrl+R
    if (e.ctrlKey && e.key === 'r') {
      e.preventDefault();
      setShowHistory(!showHistory);
      return;
    }
  }, [input, isComposing, navigateUp, navigateDown, modelSuggestions.length, showModelSuggestions, showHistory]);

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    
    // Get model suggestions after a short delay
    if (autoSelectModel) {
      const timeoutId = setTimeout(() => {
        getModelSuggestions(value);
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [autoSelectModel, getModelSuggestions]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!input.trim() || disabled) return;

    const trimmedInput = input.trim();
    const options: ChatInputOptions = {
      model: currentModel,
      useAutoSelection: autoSelectModel,
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    // Add to command history
    addCommand(trimmedInput, { model: currentModel });

    // Clear input and attachments
    setInput('');
    setAttachments([]);
    setShowModelSuggestions(false);
    
    // Submit the message
    try {
      await onSubmit(trimmedInput, options);
      
      // Update command history with success status
      addCommand(trimmedInput, { model: currentModel, success: true });
    } catch (error) {
      // Update command history with failure status
      addCommand(trimmedInput, { model: currentModel, success: false });
      console.error('Failed to submit message:', error);
    }
  }, [input, disabled, currentModel, autoSelectModel, attachments, addCommand, onSubmit]);

  // Handle file attachment
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  }, []);

  // Remove attachment
  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Select from history
  const selectFromHistory = useCallback((command: string) => {
    setInput(command);
    setShowHistory(false);
    textareaRef.current?.focus();
  }, []);

  // Select model suggestion
  const selectModelSuggestion = useCallback((suggestion: ModelSuggestion) => {
    if (onModelSelect) {
      onModelSelect(suggestion.id);
    }
    setShowModelSuggestions(false);
    textareaRef.current?.focus();
  }, [onModelSelect]);

  const historyStats = getHistoryStats();
  const recentCommands = getRecentCommands(10);

  return (
    <div className="relative">
      {/* History Panel */}
      {showHistory && (
        <Card className="absolute bottom-full left-0 right-0 mb-2 max-h-80 z-10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <History className="h-4 w-4 mr-2 text-gray-500" />
                <span className="text-sm font-medium">Command History</span>
              </div>
              <div className="text-xs text-gray-500">
                {historyStats.totalCommands} commands • {Math.round(historyStats.successRate)}% success rate
              </div>
            </div>
            
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {recentCommands.map((command, index) => (
                  <div
                    key={command.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer group"
                    onClick={() => selectFromHistory(command.command)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{command.command}</div>
                      <div className="flex items-center text-xs text-gray-500 mt-1">
                        <Clock className="h-3 w-3 mr-1" />
                        {command.timestamp.toLocaleString()}
                        {command.model && (
                          <>
                            <span className="mx-1">•</span>
                            <Badge variant="outline" className="text-xs">
                              {command.model}
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                    {command.success === true && (
                      <div className="h-2 w-2 bg-green-500 rounded-full ml-2" />
                    )}
                    {command.success === false && (
                      <div className="h-2 w-2 bg-red-500 rounded-full ml-2" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Model Suggestions Panel */}
      {showModelSuggestions && modelSuggestions.length > 0 && (
        <Card className="absolute bottom-full left-0 right-0 mb-2 z-10">
          <CardContent className="p-4">
            <div className="flex items-center mb-3">
              <Brain className="h-4 w-4 mr-2 text-blue-500" />
              <span className="text-sm font-medium">Model Recommendations</span>
            </div>
            
            <div className="space-y-2">
              {modelSuggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer border"
                  onClick={() => selectModelSuggestion(suggestion)}
                >
                  <div className="flex-1">
                    <div className="flex items-center mb-1">
                      <Badge variant="outline" className="text-xs mr-2">
                        {suggestion.provider}
                      </Badge>
                      <span className="text-sm font-medium">{suggestion.name}</span>
                      <div className="ml-auto flex items-center">
                        <span className="text-xs text-green-600 mr-2">
                          ${suggestion.estimatedCost.toFixed(3)}
                        </span>
                        <span className="text-xs text-blue-600">
                          ~{suggestion.estimatedTime}s
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600">{suggestion.reasoning}</div>
                    <div className="flex items-center mt-1">
                      <div className="flex-1 bg-gray-200 rounded-full h-1">
                        <div 
                          className="bg-blue-500 h-1 rounded-full" 
                          style={{ width: `${suggestion.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 ml-2">
                        {Math.round(suggestion.confidence * 100)}% match
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Input Area */}
      <div className="border rounded-lg bg-white shadow-sm">
        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="p-3 border-b bg-gray-50">
            <div className="flex items-center flex-wrap gap-2">
              <span className="text-sm text-gray-500">Attachments:</span>
              {attachments.map((file, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="text-xs cursor-pointer"
                  onClick={() => removeAttachment(index)}
                >
                  {file.name} ×
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="flex items-end p-3">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder={placeholder}
              disabled={disabled}
              className="min-h-[40px] max-h-[200px] resize-none border-0 shadow-none focus-visible:ring-0 p-0"
              rows={1}
            />
            
            {/* Navigation hints */}
            {isNavigating && (
              <div className="absolute -top-8 left-0 right-0 text-center">
                <Badge variant="secondary" className="text-xs">
                  History {canNavigateUp && '↑'} {canNavigateDown && '↓'}
                </Badge>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2 ml-3">
            {/* File attachment button */}
            {supportedFeatures.files && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </>
            )}

            {/* Voice input button */}
            {supportedFeatures.voice && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
              >
                <Mic className="h-4 w-4" />
              </Button>
            )}

            {/* Image input button */}
            {supportedFeatures.image && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
              >
                <Image className="h-4 w-4" />
              </Button>
            )}

            {/* History toggle button */}
            {hasHistory && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                className={showHistory ? 'bg-gray-100' : ''}
              >
                <History className="h-4 w-4" />
              </Button>
            )}

            {/* Model suggestions button */}
            {autoSelectModel && modelSuggestions.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowModelSuggestions(!showModelSuggestions)}
                className={showModelSuggestions ? 'bg-blue-50 text-blue-600' : ''}
              >
                <Brain className="h-4 w-4" />
              </Button>
            )}

            {/* Submit button */}
            <Button
              type="submit"
              size="sm"
              onClick={handleSubmit}
              disabled={disabled || !input.trim()}
              className="px-3"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Status bar */}
        <div className="px-3 pb-2 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-3">
            <div className="flex items-center">
              <Brain className="h-3 w-3 mr-1" />
              {currentModel}
            </div>
            {hasHistory && (
              <div className="flex items-center">
                <History className="h-3 w-3 mr-1" />
                {historyStats.totalCommands} commands
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {autoSelectModel && (
              <Badge variant="outline" className="text-xs">
                <Zap className="h-3 w-3 mr-1" />
                Auto
              </Badge>
            )}
            <span>↑↓ History • Tab Suggest • Ctrl+R Menu</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedChatInput;