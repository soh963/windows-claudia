/**
 * Formats a Unix timestamp to a human-readable date string
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted date string
 * 
 * @example
 * formatUnixTimestamp(1735555200) // "Dec 30, 2024"
 */
export function formatUnixTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  
  // If it's today, show time
  if (isToday(date)) {
    return formatTime(date);
  }
  
  // If it's yesterday
  if (isYesterday(date)) {
    return `Yesterday, ${formatTime(date)}`;
  }
  
  // If it's within the last week, show day of week
  if (isWithinWeek(date)) {
    return `${getDayName(date)}, ${formatTime(date)}`;
  }
  
  // If it's this year, don't show year
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  }
  
  // Otherwise show full date
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Formats an ISO timestamp string to a human-readable date
 * @param isoString - ISO timestamp string
 * @returns Formatted date string
 * 
 * @example
 * formatISOTimestamp("2025-01-04T10:13:29.000Z") // "Jan 4, 2025"
 */
export function formatISOTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return formatUnixTimestamp(Math.floor(date.getTime() / 1000));
}

/**
 * Truncates text to a specified length with ellipsis, handling image content
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength: number): string {
  // If the text already contains image indicators from getFirstLine, don't double-process
  if (text.startsWith('📷')) {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  }
  
  // Handle raw text that might contain image data
  if (text.includes('data:image/')) {
    // Use getFirstLine to get the processed version first
    const processedText = getFirstLine(text);
    if (processedText.length <= maxLength) return processedText;
    return processedText.slice(0, maxLength - 3) + '...';
  }
  
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Gets the first line of text, handling image content appropriately
 * @param text - Text to process
 * @returns First line of text or image indicator
 */
export function getFirstLine(text: string): string {
  // Check if the text contains base64 image data
  if (text.includes('data:image/')) {
    // More precise regex for base64 data URLs
    const imageMatches = text.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g);
    const imageCount = imageMatches ? imageMatches.length : 0;
    
    // Extract any text content that's not image data
    let textWithoutImages = text;
    if (imageMatches) {
      imageMatches.forEach(match => {
        textWithoutImages = textWithoutImages.replace(match, '');
      });
    }
    
    // Clean up JSON formatting and extra whitespace
    textWithoutImages = textWithoutImages
      .replace(/[{}"[\],]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (textWithoutImages && textWithoutImages.length > 0) {
      const firstTextLine = textWithoutImages.split('\n')[0].trim();
      if (firstTextLine) {
        return imageCount === 1 
          ? `📷 ${firstTextLine}`
          : `📷 ${imageCount} images + ${firstTextLine}`;
      }
    }
    
    // If no text content, just show image indicator
    return imageCount === 1 ? '📷 Image' : `📷 ${imageCount} images`;
  }
  
  const lines = text.split('\n');
  return lines[0] || '';
}

// Helper functions
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
}

function isToday(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function isYesterday(date: Date): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date.toDateString() === yesterday.toDateString();
}

function isWithinWeek(date: Date): boolean {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return date > weekAgo;
}

function getDayName(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

/**
 * Formats a timestamp to a relative time string (e.g., "2 hours ago", "3 days ago")
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Relative time string
 * 
 * @example
 * formatTimeAgo(Date.now() - 3600000) // "1 hour ago"
 * formatTimeAgo(Date.now() - 86400000) // "1 day ago"
 */
export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  
  if (years > 0) {
    return years === 1 ? '1 year ago' : `${years} years ago`;
  }
  if (months > 0) {
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }
  if (weeks > 0) {
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }
  if (days > 0) {
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }
  if (hours > 0) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  if (minutes > 0) {
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  }
  if (seconds > 0) {
    return seconds === 1 ? '1 second ago' : `${seconds} seconds ago`;
  }
  
  return 'just now';
} 
