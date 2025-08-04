// For now, we'll just return the data URL as is
// In a real implementation, you'd need to install @tauri-apps/plugin-fs
// or handle file writing through the Rust backend

/**
 * Converts a base64 data URL to a temporary file and returns the file path
 * @param base64DataUrl - The base64 encoded image data URL
 * @returns Promise resolving to the temporary file path
 */
export async function saveBase64AsTemporaryFile(base64DataUrl: string): Promise<string> {
  // For now, we'll return the data URL as is
  // In a production environment, you would:
  // 1. Send the base64 data to the Rust backend
  // 2. Save it as a temporary file
  // 3. Return the file path
  
  console.warn('Base64 to file conversion not implemented. Returning data URL as is.');
  return base64DataUrl;
}

/**
 * Checks if a string is a base64 data URL
 * @param str - The string to check
 * @returns boolean indicating if it's a base64 data URL
 */
export function isBase64DataUrl(str: string): boolean {
  return str.startsWith('data:') && str.includes('base64,');
}

/**
 * Gets the estimated size of a base64 string in bytes
 * @param base64String - The base64 string (with or without data URL prefix)
 * @returns The estimated size in bytes
 */
export function getBase64Size(base64String: string): number {
  let base64Part = base64String;
  
  // If it's a data URL, extract just the base64 part
  if (base64String.startsWith('data:')) {
    const parts = base64String.split(',');
    if (parts.length === 2) {
      base64Part = parts[1];
    }
  }
  
  // Base64 encoding increases size by ~33%, so we reverse that
  // Also account for padding characters
  const padding = (base64Part.match(/=/g) || []).length;
  return Math.floor((base64Part.length * 3) / 4) - padding;
}

/**
 * Maximum safe size for command line arguments (conservative estimate)
 * Windows has a limit of 8191 characters for command line
 * We'll use a more conservative limit to account for other arguments
 */
export const MAX_COMMAND_LINE_SIZE = 6000;

/**
 * Checks if the total size of base64 images would exceed command line limits
 * @param base64Images - Array of base64 data URLs
 * @returns boolean indicating if size exceeds safe limits
 */
export function exceedsCommandLineLimit(base64Images: string[]): boolean {
  const totalSize = base64Images.reduce((sum, img) => sum + img.length, 0);
  return totalSize > MAX_COMMAND_LINE_SIZE;
}