import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Maximize2,
  Minimize2,
  ChevronUp,
  Sparkles,
  Zap,
  Square,
  Brain,
  Paperclip,
  Image as ImageIcon,
  Star,
  Settings2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FilePicker } from "./FilePicker";
import { SlashCommandPicker } from "./SlashCommandPicker";
import { ImagePreview } from "./ImagePreview";
import { type FileEntry, type SlashCommand, api } from "@/lib/api";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { isBase64DataUrl } from "@/lib/imageUtils";
import { validatePromptLength, checkProblematicContent, escapeForCommandLine } from "@/lib/promptValidation";
import { ALL_MODELS, getModelById, isGeminiModel } from "@/lib/models";
import { GeminiApiKeyModal } from "./GeminiApiKeyModal";
import { ModelSelector } from "./ModelSelector";

interface FloatingPromptInputProps {
  /**
   * Callback when prompt is sent
   */
  onSend: (prompt: string, model: string) => void;
  /**
   * Whether the input is loading
   */
  isLoading?: boolean;
  /**
   * Whether the input is disabled
   */
  disabled?: boolean;
  /**
   * Default model to select
   */
  defaultModel?: string;
  /**
   * Project path for file picker
   */
  projectPath?: string;
  /**
   * Optional className for styling
   */
  className?: string;
  /**
   * Callback when cancel is clicked (only during loading)
   */
  onCancel?: () => void;
}

export interface FloatingPromptInputRef {
  addImage: (imagePath: string) => void;
  getInput: () => string;
}

/**
 * Thinking mode type definition
 */
type ThinkingMode = "auto" | "think" | "think_hard" | "think_harder" | "ultrathink";

/**
 * Thinking mode configuration
 */
type ThinkingModeConfig = {
  id: ThinkingMode;
  name: string;
  description: string;
  level: number; // 0-4 for visual indicator
  phrase?: string; // The phrase to append
};

const THINKING_MODES: ThinkingModeConfig[] = [
  {
    id: "auto",
    name: "Auto",
    description: "Let Claude decide",
    level: 0
  },
  {
    id: "think",
    name: "Think",
    description: "Basic reasoning",
    level: 1,
    phrase: "think"
  },
  {
    id: "think_hard",
    name: "Think Hard",
    description: "Deeper analysis",
    level: 2,
    phrase: "think hard"
  },
  {
    id: "think_harder",
    name: "Think Harder",
    description: "Extensive reasoning",
    level: 3,
    phrase: "think harder"
  },
  {
    id: "ultrathink",
    name: "Ultrathink",
    description: "Maximum computation",
    level: 4,
    phrase: "ultrathink"
  }
];

/**
 * ThinkingModeIndicator component - Shows visual indicator bars for thinking level
 */
const ThinkingModeIndicator: React.FC<{ level: number }> = ({ level }) => {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={cn(
            "w-1 h-3 rounded-full transition-colors",
            i <= level ? "bg-blue-500" : "bg-muted"
          )}
        />
      ))}
    </div>
  );
};

// Model icons mapping
const MODEL_ICONS: Record<string, React.ReactNode> = {
  'auto': <Settings2 className="h-4 w-4" />,
  'sonnet': <Zap className="h-4 w-4" />,
  'opus': <Sparkles className="h-4 w-4" />,
  'gemini-2.0-flash-exp': <Star className="h-4 w-4" />,
  'gemini-exp-1206': <Brain className="h-4 w-4" />,
  'gemini-1.5-pro-002': <Sparkles className="h-4 w-4" />,
  'gemini-1.5-flash-002': <Zap className="h-4 w-4" />
};

/**
 * FloatingPromptInput component - Fixed position prompt input with model picker
 * 
 * @example
 * const promptRef = useRef<FloatingPromptInputRef>(null);
 * <FloatingPromptInput
 *   ref={promptRef}
 *   onSend={(prompt, model) => console.log('Send:', prompt, model)}
 *   isLoading={false}
 * />
 */
const FloatingPromptInputInner = (
  {
    onSend,
    isLoading = false,
    disabled = false,
    defaultModel = "sonnet",
    projectPath,
    className,
    onCancel,
  }: FloatingPromptInputProps,
  ref: React.Ref<FloatingPromptInputRef>,
) => {
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>(defaultModel || "sonnet");
  const [showGeminiApiKeyModal, setShowGeminiApiKeyModal] = useState(false);
  const [pendingGeminiModel, setPendingGeminiModel] = useState<string | null>(null);
  const [selectedThinkingMode, setSelectedThinkingMode] = useState<ThinkingMode>("auto");
  const [isExpanded, setIsExpanded] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [thinkingModePickerOpen, setThinkingModePickerOpen] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [filePickerQuery, setFilePickerQuery] = useState("");
  const [showSlashCommandPicker, setShowSlashCommandPicker] = useState(false);
  const [slashCommandQuery, setSlashCommandQuery] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [embeddedImages, setEmbeddedImages] = useState<string[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<{path: string, type: 'image' | 'file'}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isProcessingImages, setIsProcessingImages] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const expandedTextareaRef = useRef<HTMLTextAreaElement>(null);
  const unlistenDragDropRef = useRef<(() => void) | null>(null);

  // Expose methods for external access
  React.useImperativeHandle(
    ref,
    () => ({
      addImage: (imagePath: string) => {
        setPrompt(currentPrompt => {
          const existingPaths = attachedFiles.map(f => f.path);
          if (existingPaths.includes(imagePath)) {
            return currentPrompt; // Image already added
          }

          // Add to attached files instead of prompt text
          setAttachedFiles(prev => [...prev, { path: imagePath, type: 'image' }]);
          const newPrompt = currentPrompt;

          // Focus the textarea
          setTimeout(() => {
            const target = isExpanded ? expandedTextareaRef.current : textareaRef.current;
            target?.focus();
            target?.setSelectionRange(newPrompt.length, newPrompt.length);
          }, 0);

          return newPrompt;
        });
      },
      getInput: () => prompt
    }),
    [isExpanded, prompt]
  );

  // Helper function to check if a file is an image
  const isImageFile = (path: string): boolean => {
    // Check if it's a data URL
    if (path.startsWith('data:image/')) {
      return true;
    }
    // Otherwise check file extension
    const ext = path.split('.').pop()?.toLowerCase();
    return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'].includes(ext || '');
  };

  // Extract image paths from prompt text
  // Extract attached files into prompt format when sending
  const buildFinalPrompt = (text: string, files?: typeof attachedFiles): string => {
    // Handle special characters and tags safely
    let safeText = escapeForCommandLine(text);
    
    // Use provided files or fall back to attachedFiles
    const filesToProcess = files || attachedFiles;
    
    // If no files, just return the escaped text
    if (filesToProcess.length === 0) return safeText;
    
    // Build file references
    const fileReferences: string[] = [];
    
    filesToProcess.forEach(file => {
      const path = file.path;
      // Wrap path in quotes if it contains spaces or special characters
      const needsQuotes = path.includes(' ') || path.includes('(') || path.includes(')');
      const quotedPath = needsQuotes ? `"${path}"` : path;
      fileReferences.push(`@${quotedPath}`);
    });
    
    // Only add file references if we have any
    if (fileReferences.length === 0) return safeText;
    
    // Add file references at the beginning with proper spacing
    const finalPrompt = fileReferences.join(' ') + (safeText.trim() ? ' ' + safeText.trim() : '');
    
    return finalPrompt;
  };

  // Update embedded images from attached files
  useEffect(() => {
    const imagePaths = attachedFiles.filter(f => f.type === 'image').map(f => f.path);
    setEmbeddedImages(imagePaths);
  }, [attachedFiles]);

  // Set up Tauri drag-drop event listener
  useEffect(() => {
    // This effect runs only once on component mount to set up the listener.
    let lastDropTime = 0;

    const setupListener = async () => {
      try {
        // If a listener from a previous mount/render is still around, clean it up.
        if (unlistenDragDropRef.current) {
          unlistenDragDropRef.current();
        }

        const webview = getCurrentWebviewWindow();
        unlistenDragDropRef.current = await webview.onDragDropEvent((event) => {
          if (event.payload.type === 'enter' || event.payload.type === 'over') {
            setDragActive(true);
          } else if (event.payload.type === 'leave') {
            setDragActive(false);
          } else if (event.payload.type === 'drop' && event.payload.paths) {
            setDragActive(false);

            const currentTime = Date.now();
            if (currentTime - lastDropTime < 200) {
              // This debounce is crucial to handle the storm of drop events
              // that Tauri/OS can fire for a single user action.
              return;
            }
            lastDropTime = currentTime;

            const droppedPaths = event.payload.paths as string[];
            
            // Process all dropped files
            setAttachedFiles(prev => {
              const newFiles: {path: string, type: 'image' | 'file'}[] = [];
              
              droppedPaths.forEach(path => {
                const isImage = isImageFile(path);
                const fileType = isImage ? 'image' : 'file';
                
                // Check if already attached in the current state
                const existingPaths = prev.map(f => f.path);
                if (!existingPaths.includes(path)) {
                  newFiles.push({ path, type: fileType });
                }
              });
              
              // Only update if there are new files to add
              return newFiles.length > 0 ? [...prev, ...newFiles] : prev;
            });
            
            // Focus the textarea
            setTimeout(() => {
              const target = isExpanded ? expandedTextareaRef.current : textareaRef.current;
              target?.focus();
            }, 0);
          }
        });
      } catch (error) {
        console.error('Failed to set up Tauri drag-drop listener:', error);
      }
    };

    setupListener();

    return () => {
      // On unmount, ensure we clean up the listener.
      if (unlistenDragDropRef.current) {
        unlistenDragDropRef.current();
        unlistenDragDropRef.current = null;
      }
    };
  }, []); // Empty dependency array ensures this runs only on mount/unmount.

  useEffect(() => {
    // Focus the appropriate textarea when expanded state changes
    if (isExpanded && expandedTextareaRef.current) {
      expandedTextareaRef.current.focus();
    } else if (!isExpanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isExpanded]);

  const handleSend = async () => {
    // Check if we can send
    const canSend = !disabled && (prompt.trim().length > 0 || attachedFiles.length > 0);
    
    if (!canSend) {
      // Provide specific feedback about why sending is disabled
      if (disabled) {
        console.warn("전송이 비활성화된 상태입니다.");
      } else if (!prompt.trim() && attachedFiles.length === 0) {
        console.warn("메시지를 입력하거나 파일을 첨부해주세요.");
      }
      return;
    }

    try {
      // Check for problematic content first
      const contentCheck = checkProblematicContent(prompt);
      if (contentCheck.hasIssues) {
        console.warn('Potential issues detected in prompt:', contentCheck.issues);
      }
      
      // Process attached files and handle base64 images
      const processedFiles: typeof attachedFiles = [];
      const base64Images: typeof attachedFiles = [];
      const regularFiles: typeof attachedFiles = [];
      
      // Separate base64 images from regular files
      attachedFiles.forEach(file => {
        if (isBase64DataUrl(file.path)) {
          base64Images.push(file);
        } else {
          regularFiles.push(file);
          processedFiles.push(file);
        }
      });
      
      // Check if we have base64 images that need to be saved as temporary files
      if (base64Images.length > 0) {
        setIsProcessingImages(true);
        console.log(`Found ${base64Images.length} base64 image(s), saving to temporary files...`);
        
        // Import api here to avoid circular dependencies
        const { api } = await import("@/lib/api");
        
        // Save base64 images as temporary files
        for (const base64Image of base64Images) {
          try {
            const savedImage = await api.saveBase64Image(base64Image.path);
            console.log('Saved base64 image to:', savedImage.path);
            
            // Add the saved file path to processed files
            processedFiles.push({
              ...base64Image,
              path: savedImage.path
            });
          } catch (err) {
            console.error('Failed to save base64 image:', err);
            // If saving fails, notify the user but continue with other images
          }
        }
        
        setIsProcessingImages(false);
        
        // If some images couldn't be saved, notify the user
        const savedCount = processedFiles.length - regularFiles.length;
        if (savedCount < base64Images.length) {
          const failedCount = base64Images.length - savedCount;
          console.warn(`${failedCount} image(s) could not be saved and were omitted.`);
        }
      }
      
      // Build the final prompt with processed files
      let finalPrompt = buildFinalPrompt(prompt.trim(), processedFiles);
      
      // Validate the final prompt length with processed files
      const validation = validatePromptLength(finalPrompt, processedFiles.map(f => f.path));
      if (!validation.isValid) {
        console.error(validation.message);
        alert('The message is too long to send. Try removing some files or shortening your message.');
        return;
      }
      
      // Update attachedFiles to show the processed files in the UI
      setAttachedFiles(processedFiles);
      
      // Append thinking phrase if not auto mode
      const thinkingMode = THINKING_MODES.find(m => m.id === selectedThinkingMode);
      if (thinkingMode && thinkingMode.phrase) {
        finalPrompt = `${finalPrompt}.\n\n${thinkingMode.phrase}.`;
      }
      
      // Handle auto model selection
      let actualModel = selectedModel;
      if (selectedModel === 'auto') {
        try {
          const recommendation = await api.getAutoModelRecommendation(finalPrompt);
          actualModel = recommendation.recommended_model;
          
          // Add selection reasoning to the prompt as a comment
          const reasoningComment = `\n\n<!-- Auto Model Selection: ${recommendation.recommended_model} (${(recommendation.confidence * 100).toFixed(0)}% confidence) - ${recommendation.reasoning} -->`;
          finalPrompt = finalPrompt + reasoningComment;
          
          console.log('Auto model selection:', {
            recommended: recommendation.recommended_model,
            confidence: recommendation.confidence,
            reasoning: recommendation.reasoning,
            alternatives: recommendation.alternative_models
          });
        } catch (error) {
          console.error('Auto model selection failed, falling back to sonnet:', error);
          actualModel = 'sonnet'; // Fallback to default
        }
      }
      
      onSend(finalPrompt, actualModel);
      setPrompt("");
      setAttachedFiles([]);
      setEmbeddedImages([]);
    } catch (error) {
      console.error("메시지 전송 중 오류 발생:", error);
      // Show user-friendly error message
      if (error instanceof Error && error.message.includes('command line is too long')) {
        alert('The message is too long to send. Try removing some images or shortening your message.');
      } else {
        alert('An error occurred while sending the message. Please try again.');
      }
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newCursorPosition = e.target.selectionStart || 0;

    // Check if / was just typed at the beginning of input or after whitespace
    if (newValue.length > prompt.length && newValue[newCursorPosition - 1] === '/') {
      // Check if it's at the start or after whitespace
      const isStartOfCommand = newCursorPosition === 1 || 
        (newCursorPosition > 1 && /\s/.test(newValue[newCursorPosition - 2]));
      
      if (isStartOfCommand) {
        console.log('[FloatingPromptInput] / detected for slash command');
        setShowSlashCommandPicker(true);
        setSlashCommandQuery("");
        setCursorPosition(newCursorPosition);
      }
    }

    // Check if @ was just typed
    if (projectPath?.trim() && newValue.length > prompt.length && newValue[newCursorPosition - 1] === '@') {
      console.log('[FloatingPromptInput] @ detected, projectPath:', projectPath);
      setShowFilePicker(true);
      setFilePickerQuery("");
      setCursorPosition(newCursorPosition);
    }

    // Check if we're typing after / (for slash command search)
    if (showSlashCommandPicker && newCursorPosition >= cursorPosition) {
      // Find the / position before cursor
      let slashPosition = -1;
      for (let i = newCursorPosition - 1; i >= 0; i--) {
        if (newValue[i] === '/') {
          slashPosition = i;
          break;
        }
        // Stop if we hit whitespace (new word)
        if (newValue[i] === ' ' || newValue[i] === '\n') {
          break;
        }
      }

      if (slashPosition !== -1) {
        const query = newValue.substring(slashPosition + 1, newCursorPosition);
        setSlashCommandQuery(query);
      } else {
        // / was removed or cursor moved away
        setShowSlashCommandPicker(false);
        setSlashCommandQuery("");
      }
    }

    // Check if we're typing after @ (for search query)
    if (showFilePicker && newCursorPosition >= cursorPosition) {
      // Find the @ position before cursor
      let atPosition = -1;
      for (let i = newCursorPosition - 1; i >= 0; i--) {
        if (newValue[i] === '@') {
          atPosition = i;
          break;
        }
        // Stop if we hit whitespace (new word)
        if (newValue[i] === ' ' || newValue[i] === '\n') {
          break;
        }
      }

      if (atPosition !== -1) {
        const query = newValue.substring(atPosition + 1, newCursorPosition);
        setFilePickerQuery(query);
      } else {
        // @ was removed or cursor moved away
        setShowFilePicker(false);
        setFilePickerQuery("");
      }
    }

    setPrompt(newValue);
    setCursorPosition(newCursorPosition);
  };

  const handleFileSelect = (entry: FileEntry) => {
    if (textareaRef.current) {
      // Find the @ position before cursor
      let atPosition = -1;
      for (let i = cursorPosition - 1; i >= 0; i--) {
        if (prompt[i] === '@') {
          atPosition = i;
          break;
        }
        // Stop if we hit whitespace (new word)
        if (prompt[i] === ' ' || prompt[i] === '\n') {
          break;
        }
      }

      if (atPosition === -1) {
        // @ not found, this shouldn't happen but handle gracefully
        console.error('[FloatingPromptInput] @ position not found');
        return;
      }

      // Replace the @ and partial query with the selected path (file or directory)
      const textarea = textareaRef.current;
      const beforeAt = prompt.substring(0, atPosition);
      const afterCursor = prompt.substring(cursorPosition);
      const relativePath = entry.path.startsWith(projectPath || '')
        ? entry.path.slice((projectPath || '').length + 1)
        : entry.path;

      const newPrompt = `${beforeAt}@${relativePath} ${afterCursor}`;
      setPrompt(newPrompt);
      setShowFilePicker(false);
      setFilePickerQuery("");

      // Focus back on textarea and set cursor position after the inserted path
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = beforeAt.length + relativePath.length + 2; // +2 for @ and space
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  };

  const handleFilePickerClose = () => {
    setShowFilePicker(false);
    setFilePickerQuery("");
    // Return focus to textarea
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const handleSlashCommandSelect = (command: SlashCommand) => {
    const textarea = isExpanded ? expandedTextareaRef.current : textareaRef.current;
    if (!textarea) return;

    // Find the / position before cursor
    let slashPosition = -1;
    for (let i = cursorPosition - 1; i >= 0; i--) {
      if (prompt[i] === '/') {
        slashPosition = i;
        break;
      }
      // Stop if we hit whitespace (new word)
      if (prompt[i] === ' ' || prompt[i] === '\n') {
        break;
      }
    }

    if (slashPosition === -1) {
      console.error('[FloatingPromptInput] / position not found');
      return;
    }

    // Simply insert the command syntax
    const beforeSlash = prompt.substring(0, slashPosition);
    const afterCursor = prompt.substring(cursorPosition);
    
    if (command.accepts_arguments) {
      // Insert command with placeholder for arguments
      const newPrompt = `${beforeSlash}${command.full_command} `;
      setPrompt(newPrompt);
      setShowSlashCommandPicker(false);
      setSlashCommandQuery("");

      // Focus and position cursor after the command
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = beforeSlash.length + command.full_command.length + 1;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    } else {
      // Insert command and close picker
      const newPrompt = `${beforeSlash}${command.full_command} ${afterCursor}`;
      setPrompt(newPrompt);
      setShowSlashCommandPicker(false);
      setSlashCommandQuery("");

      // Focus and position cursor after the command
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = beforeSlash.length + command.full_command.length + 1;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  };

  const handleSlashCommandPickerClose = () => {
    setShowSlashCommandPicker(false);
    setSlashCommandQuery("");
    // Return focus to textarea
    setTimeout(() => {
      const textarea = isExpanded ? expandedTextareaRef.current : textareaRef.current;
      textarea?.focus();
    }, 0);
  };

  const handleSlashCommandExecute = async (command: SlashCommand, args: string) => {
    if (!projectPath) {
      console.error("Project path is required for command execution");
      return;
    }

    try {
      // Import api here to avoid circular dependencies
      const { api } = await import("@/lib/api");
      await api.executeClaudeSlashCommand(command, args, projectPath);
      
      setShowSlashCommandPicker(false);
      setSlashCommandQuery("");
      
      // Clear the current prompt since we're executing directly
      setPrompt("");
      
      console.log(`Executing command: ${command.full_command} with args: ${args}`);
    } catch (error) {
      console.error("Failed to execute slash command:", error);
      // TODO: Show error toast to user
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showFilePicker && e.key === 'Escape') {
      e.preventDefault();
      setShowFilePicker(false);
      setFilePickerQuery("");
      return;
    }

    if (showSlashCommandPicker && e.key === 'Escape') {
      e.preventDefault();
      setShowSlashCommandPicker(false);
      setSlashCommandQuery("");
      return;
    }

    if (e.key === "Enter" && !e.shiftKey && !isExpanded && !showFilePicker && !showSlashCommandPicker) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        
        // Get the image blob
        const blob = item.getAsFile();
        if (!blob) continue;

        try {
          // Convert blob to base64
          const reader = new FileReader();
          reader.onload = () => {
            const base64Data = reader.result as string;
            
            // Add to attached files instead of prompt
            setAttachedFiles(prev => [...prev, { path: base64Data, type: 'image' }]);
            
            // Focus the textarea
            setTimeout(() => {
              const target = isExpanded ? expandedTextareaRef.current : textareaRef.current;
              target?.focus();
            }, 0);
          };
          
          reader.readAsDataURL(blob);
        } catch (error) {
          console.error('Failed to paste image:', error);
        }
      }
    }
  };

  // Browser drag and drop handlers - just prevent default behavior
  // Actual file handling is done via Tauri's window-level drag-drop events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Visual feedback is handled by Tauri events
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // File processing is handled by Tauri's onDragDropEvent
  };

  const handleRemoveImage = (index: number) => {
    // Remove from attached files
    const imagePath = embeddedImages[index];
    setAttachedFiles(prev => prev.filter(f => f.path !== imagePath));
  };
  
  const handleRemoveFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const path = reader.result as string;
        const isImage = file.type.startsWith('image/');
        
        // Check if already attached
        const existingPaths = attachedFiles.map(f => f.path);
        if (!existingPaths.includes(path)) {
          setAttachedFiles(prev => [...prev, { path, type: isImage ? 'image' : 'file' }]);
        }
      };
      reader.readAsDataURL(file);
    });
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const selectedModelData = getModelById(selectedModel) || ALL_MODELS[0];

  return (
    <>
      {/* Expanded Modal */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
            onClick={() => setIsExpanded(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-background border border-border rounded-lg shadow-lg w-full max-w-2xl p-4 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Compose your prompt</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsExpanded(false)}
                  className="h-8 w-8"
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Image previews in expanded mode */}
              {embeddedImages.length > 0 && (
                <ImagePreview
                  images={embeddedImages}
                  onRemove={handleRemoveImage}
                  className="border-t border-border pt-2"
                />
              )}

              <Textarea
                ref={expandedTextareaRef}
                value={prompt}
                onChange={handleTextChange}
                onPaste={handlePaste}
                placeholder="Type your prompt here..."
                className="min-h-[200px] resize-none"
                disabled={disabled}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Model:</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setModelPickerOpen(!modelPickerOpen)}
                      className="gap-2"
                    >
                      {MODEL_ICONS[selectedModel] || <Sparkles className="h-4 w-4" />}
                      {selectedModelData.name}
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Thinking:</span>
                    <Popover
                      trigger={
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setThinkingModePickerOpen(!thinkingModePickerOpen)}
                                className="gap-2"
                              >
                                <Brain className="h-4 w-4" />
                                <ThinkingModeIndicator 
                                  level={THINKING_MODES.find(m => m.id === selectedThinkingMode)?.level || 0} 
                                />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium">{THINKING_MODES.find(m => m.id === selectedThinkingMode)?.name || "Auto"}</p>
                              <p className="text-xs text-muted-foreground">{THINKING_MODES.find(m => m.id === selectedThinkingMode)?.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      }
                      content={
                        <div className="w-[280px] p-1">
                          {THINKING_MODES.map((mode) => (
                            <button
                              key={mode.id}
                              onClick={() => {
                                setSelectedThinkingMode(mode.id);
                                setThinkingModePickerOpen(false);
                              }}
                              className={cn(
                                "w-full flex items-start gap-3 p-3 rounded-md transition-colors text-left",
                                "hover:bg-accent",
                                selectedThinkingMode === mode.id && "bg-accent"
                              )}
                            >
                              <Brain className="h-4 w-4 mt-0.5" />
                              <div className="flex-1 space-y-1">
                                <div className="font-medium text-sm">
                                  {mode.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {mode.description}
                                </div>
                              </div>
                              <ThinkingModeIndicator level={mode.level} />
                            </button>
                          ))}
                        </div>
                      }
                      open={thinkingModePickerOpen}
                      onOpenChange={setThinkingModePickerOpen}
                      align="start"
                      side="top"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleSend}
                  disabled={disabled || (!prompt.trim() && attachedFiles.length === 0)}
                  size="default"
                  className="min-w-[60px]"
                >
                  {isLoading ? (
                    <div className="rotating-symbol text-primary-foreground" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fixed Position Input Bar */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border",
          dragActive && "ring-2 ring-primary ring-offset-2",
          className
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="max-w-5xl mx-auto">
          {/* Attached files display */}
          {attachedFiles.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border flex-wrap">
              {attachedFiles.map((file, index) => {
                const isBase64 = isBase64DataUrl(file.path);
                
                return (
                  <div 
                    key={index} 
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-md",
                      isBase64 && isProcessingImages ? "bg-blue-500/20 border border-blue-500/50" : "bg-muted/50"
                    )}
                  >
                    {file.type === 'image' ? (
                      <ImageIcon className={cn("h-3 w-3", isBase64 && isProcessingImages ? "text-blue-500" : "text-blue-500")} />
                    ) : (
                      <Paperclip className="h-3 w-3 text-gray-500" />
                    )}
                    <span className="text-xs max-w-[150px] truncate">
                      {file.path.startsWith('data:') ? 'Pasted Image' : file.path.split('/').pop() || file.path.split('\\').pop()}
                    </span>
                    {isBase64 && isProcessingImages && (
                      <div className="rotating-symbol text-blue-500 ml-1" style={{ fontSize: '10px' }} />
                    )}
                    <button
                      onClick={() => handleRemoveFile(index)}
                      className="ml-1 text-muted-foreground hover:text-foreground"
                      disabled={isProcessingImages}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              {attachedFiles.some(f => isBase64DataUrl(f.path)) && (
                <div className="text-xs text-muted-foreground w-full mt-1 flex items-center gap-1">
                  {isProcessingImages ? (
                    <>
                      <span className="inline-block w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span>Processing images...</span>
                    </>
                  ) : (
                    <span>Pasted images will be saved as temporary files.</span>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Image previews for viewing */}
          {embeddedImages.length > 0 && (
            <ImagePreview
              images={embeddedImages}
              onRemove={handleRemoveImage}
              className="border-b border-border"
            />
          )}

          <div className="p-4">
            <div className="flex items-end gap-3">
              {/* File Attachment Button */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileInputChange}
                className="hidden"
                accept="*"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="h-10 w-10"
                title="Attach files"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              
              {/* Model Picker - Using new ModelSelector */}
              <ModelSelector
                value={selectedModel}
                onChange={(modelId) => {
                  setSelectedModel(modelId);
                }}
                disabled={disabled}
                compact={false}
                onGeminiApiKeyNeeded={() => {
                  setShowGeminiApiKeyModal(true);
                }}
              />

              {/* Thinking Mode Picker */}
              <Popover
                trigger={
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="default"
                          disabled={disabled}
                          className="gap-2"
                        >
                          <Brain className="h-4 w-4" />
                          <ThinkingModeIndicator 
                            level={THINKING_MODES.find(m => m.id === selectedThinkingMode)?.level || 0} 
                          />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">{THINKING_MODES.find(m => m.id === selectedThinkingMode)?.name || "Auto"}</p>
                        <p className="text-xs text-muted-foreground">{THINKING_MODES.find(m => m.id === selectedThinkingMode)?.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                }
                content={
                  <div className="w-[280px] p-1">
                    {THINKING_MODES.map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => {
                          setSelectedThinkingMode(mode.id);
                          setThinkingModePickerOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-start gap-3 p-3 rounded-md transition-colors text-left",
                          "hover:bg-accent",
                          selectedThinkingMode === mode.id && "bg-accent"
                        )}
                      >
                        <Brain className="h-4 w-4 mt-0.5" />
                        <div className="flex-1 space-y-1">
                          <div className="font-medium text-sm">
                            {mode.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {mode.description}
                          </div>
                        </div>
                        <ThinkingModeIndicator level={mode.level} />
                      </button>
                    ))}
                  </div>
                }
                open={thinkingModePickerOpen}
                onOpenChange={setThinkingModePickerOpen}
                align="start"
                side="top"
              />

              {/* Prompt Input */}
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={handleTextChange}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder={dragActive ? "Drop images here..." : "Ask Claude anything..."}
                  disabled={disabled}
                  className={cn(
                    "min-h-[44px] max-h-[120px] resize-none pr-10",
                    dragActive && "border-primary"
                  )}
                  rows={1}
                />

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsExpanded(true)}
                  disabled={disabled}
                  className="absolute right-1 bottom-1 h-8 w-8"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>

                {/* File Picker */}
                <AnimatePresence>
                  {showFilePicker && projectPath && projectPath.trim() && (
                    <FilePicker
                      basePath={projectPath.trim()}
                      onSelect={handleFileSelect}
                      onClose={handleFilePickerClose}
                      initialQuery={filePickerQuery}
                    />
                  )}
                </AnimatePresence>

                {/* Slash Command Picker */}
                <AnimatePresence>
                  {showSlashCommandPicker && (
                    <SlashCommandPicker
                      projectPath={projectPath}
                      onSelect={handleSlashCommandSelect}
                      onExecute={handleSlashCommandExecute}
                      onClose={handleSlashCommandPickerClose}
                      initialQuery={slashCommandQuery}
                    />
                  )}
                </AnimatePresence>
              </div>

              {/* Send/Stop Button */}
              <Button
                onClick={isLoading ? onCancel : handleSend}
                disabled={isLoading ? false : (disabled || (!prompt.trim() && attachedFiles.length === 0))}
                variant={isLoading ? "destructive" : "default"}
                size="default"
                className="min-w-[60px]"
              >
                {isLoading ? (
                  <>
                    <Square className="h-4 w-4 mr-1" />
                    Stop
                  </>
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="mt-2 text-xs text-muted-foreground">
              Press Enter to send, Shift+Enter for new line{projectPath?.trim() && ", @ to mention files, / for commands, drag & drop or paste images"}
            </div>
          </div>
        </div>
      </div>
      
      {/* Gemini API Key Modal */}
      <GeminiApiKeyModal
        isOpen={showGeminiApiKeyModal}
        onClose={() => {
          setShowGeminiApiKeyModal(false);
          setPendingGeminiModel(null);
        }}
        onSuccess={() => {
          setShowGeminiApiKeyModal(false);
          if (pendingGeminiModel) {
            setSelectedModel(pendingGeminiModel);
            setPendingGeminiModel(null);
          }
        }}
      />
    </>
  );
};

export const FloatingPromptInput = React.forwardRef<
  FloatingPromptInputRef,
  FloatingPromptInputProps
>(FloatingPromptInputInner);

FloatingPromptInput.displayName = 'FloatingPromptInput';
