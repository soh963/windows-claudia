/**
 * Shared UI Utility Functions
 * Centralizes common UI operations to eliminate duplication
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names with Tailwind CSS conflict resolution
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Standard spacing scale for consistent UI
 */
export const spacing = {
  xs: "p-1",
  sm: "p-2",
  md: "p-4",
  lg: "p-6",
  xl: "p-8",
} as const;

/**
 * Typography scale for consistent text hierarchy
 */
export const typography = {
  h1: "text-3xl font-bold tracking-tight",
  h2: "text-2xl font-semibold tracking-tight",
  h3: "text-xl font-semibold",
  h4: "text-lg font-medium",
  body: "text-base",
  small: "text-sm",
  muted: "text-sm text-muted-foreground",
  tiny: "text-xs text-muted-foreground",
} as const;

/**
 * Common button variants
 */
export const buttonVariants = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
} as const;

/**
 * Common animation variants for Framer Motion
 */
export const animations = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slideIn: {
    initial: { x: -20, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: 20, opacity: 0 },
  },
  scaleIn: {
    initial: { scale: 0.95, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.95, opacity: 0 },
  },
  panel: {
    initial: { width: 0, opacity: 0 },
    animate: { width: "auto", opacity: 1 },
    exit: { width: 0, opacity: 0 },
  },
} as const;

/**
 * Common transition configurations
 */
export const transitions = {
  fast: { duration: 0.15, ease: "easeInOut" },
  normal: { duration: 0.3, ease: "easeInOut" },
  slow: { duration: 0.5, ease: "easeInOut" },
  spring: { type: "spring", stiffness: 300, damping: 30 },
} as const;

/**
 * Panel width configurations
 */
export const panelWidths = {
  narrow: 280,
  normal: 320,
  wide: 380,
  extraWide: 480,
} as const;

/**
 * Z-index scale for consistent layering
 */
export const zIndex = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  overlay: 300,
  modal: 400,
  popover: 500,
  tooltip: 600,
  notification: 700,
} as const;

/**
 * Common event handler factory for toggle operations
 */
export function createToggleHandler(
  setter: React.Dispatch<React.SetStateAction<boolean>>,
  callback?: (newState: boolean) => void
) {
  return () => {
    setter((prev) => {
      const newState = !prev;
      callback?.(newState);
      return newState;
    });
  };
}

/**
 * Common event handler factory for async operations
 */
export function createAsyncHandler<T extends any[]>(
  handler: (...args: T) => Promise<void>,
  options?: {
    onStart?: () => void;
    onError?: (error: Error) => void;
    onComplete?: () => void;
  }
) {
  return async (...args: T) => {
    try {
      options?.onStart?.();
      await handler(...args);
    } catch (error) {
      console.error("Async handler error:", error);
      options?.onError?.(error as Error);
    } finally {
      options?.onComplete?.();
    }
  };
}

/**
 * Debounce utility for input handlers
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle utility for scroll/resize handlers
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Format duration for display
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Get relative time string
 */
export function getRelativeTime(date: Date | number): string {
  const now = Date.now();
  const then = typeof date === "number" ? date : date.getTime();
  const diff = now - then;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

/**
 * Keyboard event utilities
 */
export const keyboard = {
  isEnter: (e: React.KeyboardEvent) => e.key === "Enter",
  isEscape: (e: React.KeyboardEvent) => e.key === "Escape",
  isSpace: (e: React.KeyboardEvent) => e.key === " ",
  isArrowUp: (e: React.KeyboardEvent) => e.key === "ArrowUp",
  isArrowDown: (e: React.KeyboardEvent) => e.key === "ArrowDown",
  isModKey: (e: React.KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    return isMac ? e.metaKey : e.ctrlKey;
  },
} as const;

/**
 * Focus management utilities
 */
export const focus = {
  trap: (container: HTMLElement) => {
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };
    
    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  },
  
  restore: (element?: HTMLElement | null) => {
    if (element) {
      element.focus();
    }
  },
} as const;

/**
 * Accessibility utilities
 */
export const a11y = {
  announceToScreenReader: (message: string) => {
    const announcement = document.createElement("div");
    announcement.setAttribute("role", "status");
    announcement.setAttribute("aria-live", "polite");
    announcement.className = "sr-only";
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  },
  
  hideFromScreenReader: (element: HTMLElement) => {
    element.setAttribute("aria-hidden", "true");
  },
  
  showToScreenReader: (element: HTMLElement) => {
    element.removeAttribute("aria-hidden");
  },
} as const;