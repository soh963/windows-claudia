/**
 * Validation utilities for prompts and command line arguments
 */

/**
 * Maximum length for command line on different platforms
 * Windows: 8191 characters
 * Linux/Mac: Much higher, but we'll use a conservative limit
 */
const MAX_COMMAND_LINE_LENGTH = 6000; // Conservative limit for safety

/**
 * Escapes special characters in text to make it safe for command line
 * @param text - The text to escape
 * @returns The escaped text
 */
export function escapeForCommandLine(text: string): string {
  // First, handle emojis and non-ASCII characters
  // Replace emojis with descriptive text to avoid encoding issues
  text = text
    .replace(/🔍/g, '[SEARCH]')
    .replace(/🗑️/g, '[DELETE]')
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '[EMOJI]'); // Replace other emojis
  
  // Remove or escape problematic HTML attributes
  text = text.replace(/bis_skin_checked="[^"]*"/g, '');
  
  // Detect platform using navigator.platform for browser environment
  const isWindows = typeof window !== 'undefined' && 
    window.navigator && 
    window.navigator.platform && 
    window.navigator.platform.toLowerCase().includes('win');
  
  if (isWindows) {
    // For Windows, we need to escape certain characters
    // Escape double quotes
    text = text.replace(/"/g, '\\"');
    // Escape special characters that might break command parsing
    text = text.replace(/[&|<>^]/g, '^$&');
    // Remove or escape newlines
    text = text.replace(/\r?\n/g, ' ');
  } else {
    // For Unix-like systems, escape single quotes
    text = text.replace(/'/g, "'\\''");
  }
  
  return text;
}

/**
 * Validates if a prompt with attachments would fit within command line limits
 * @param prompt - The text prompt
 * @param attachments - Array of file paths to attach
 * @returns Object with validation result and details
 */
export function validatePromptLength(
  prompt: string,
  attachments: string[]
): { isValid: boolean; totalLength: number; message?: string } {
  // Calculate total length including command structure
  // Base command: claude code --model=xxx --prompt="..."
  const baseCommandLength = 50; // Approximate length of base command
  
  // Calculate attachments length
  const attachmentsLength = attachments
    .map(path => `@"${path}" `.length) // Each attachment with @ prefix and quotes
    .reduce((sum, len) => sum + len, 0);
  
  // Total length
  const totalLength = baseCommandLength + prompt.length + attachmentsLength;
  
  if (totalLength > MAX_COMMAND_LINE_LENGTH) {
    return {
      isValid: false,
      totalLength,
      message: `Command line would be too long (${totalLength} characters, max ${MAX_COMMAND_LINE_LENGTH})`
    };
  }
  
  return {
    isValid: true,
    totalLength
  };
}

/**
 * Sanitizes HTML content to prevent injection issues
 * @param html - The HTML content to sanitize
 * @returns The sanitized content
 */
export function sanitizeHtmlContent(html: string): string {
  // For now, we'll just escape the most problematic characters
  // In a production app, you'd want to use a proper HTML sanitization library
  return html
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Checks if text contains potentially problematic content
 * @param text - The text to check
 * @returns Object with check results
 */
export function checkProblematicContent(text: string): {
  hasIssues: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  // Check for command line flags that might be misinterpreted
  if (/^--?\w+/.test(text.trim())) {
    issues.push('Text starts with command line flags which might be misinterpreted');
  }
  
  // Check for excessive special characters that might break parsing
  const specialCharCount = (text.match(/[<>&|"'`$\\]/g) || []).length;
  if (specialCharCount > 50) {
    issues.push('Text contains many special characters that might cause parsing issues');
  }
  
  // Check for null bytes or other control characters
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(text)) {
    issues.push('Text contains control characters that might cause issues');
  }
  
  // Check for emojis that might cause encoding issues
  if (/[\u{1F300}-\u{1F9FF}]/u.test(text)) {
    issues.push('Text contains emojis that might cause encoding issues on some systems');
  }
  
  // Check for potentially problematic HTML patterns
  if (/<[^>]+bis_skin_checked/i.test(text)) {
    issues.push('Text contains browser extension artifacts that should be cleaned');
  }
  
  // Check for very long inline styles that might cause issues
  const inlineStyleMatch = text.match(/style="[^"]{500,}"/g);
  if (inlineStyleMatch && inlineStyleMatch.length > 0) {
    issues.push('Text contains very long inline styles that might exceed limits');
  }
  
  return {
    hasIssues: issues.length > 0,
    issues
  };
}