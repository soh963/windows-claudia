/**
 * UI Overlap Prevention Utilities
 * 
 * This module provides utilities to prevent UI elements from overlapping
 * and ensure consistent layout across the application.
 */

export interface UIElement {
  id: string;
  element: HTMLElement;
  priority: number; // Higher number = higher priority
  type: 'modal' | 'dropdown' | 'tooltip' | 'progress-tracker' | 'model-selector' | 'chat-input';
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface OverlapDetectionResult {
  hasOverlap: boolean;
  overlappingElements: UIElement[];
  recommendations: string[];
}

/**
 * Z-index management system
 */
export const Z_INDEX_MAP = {
  BASE: 1,
  CHAT_INPUT: 10,
  MODEL_SELECTOR: 20,
  PROGRESS_TRACKER: 30,
  DROPDOWN: 40,
  TOOLTIP: 50,
  MODAL: 60,
  CRITICAL: 100,
} as const;

/**
 * Get element position and dimensions
 */
export function getElementBounds(element: HTMLElement): UIElement['position'] {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Check if two elements overlap
 */
export function checkOverlap(element1: UIElement, element2: UIElement): boolean {
  const { position: pos1 } = element1;
  const { position: pos2 } = element2;

  return !(
    pos1.x + pos1.width <= pos2.x ||
    pos2.x + pos2.width <= pos1.x ||
    pos1.y + pos1.height <= pos2.y ||
    pos2.y + pos2.height <= pos1.y
  );
}

/**
 * Detect all overlapping elements on the page
 */
export function detectOverlaps(elements: UIElement[]): OverlapDetectionResult {
  const overlappingElements: UIElement[] = [];
  const recommendations: string[] = [];

  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      const element1 = elements[i];
      const element2 = elements[j];

      if (checkOverlap(element1, element2)) {
        if (!overlappingElements.find(e => e.id === element1.id)) {
          overlappingElements.push(element1);
        }
        if (!overlappingElements.find(e => e.id === element2.id)) {
          overlappingElements.push(element2);
        }

        // Generate recommendations
        recommendations.push(
          `Elements "${element1.id}" and "${element2.id}" are overlapping. Consider adjusting positioning or z-index.`
        );

        if (element1.priority === element2.priority) {
          recommendations.push(
            `Elements "${element1.id}" and "${element2.id}" have the same priority. Consider adjusting priorities.`
          );
        }
      }
    }
  }

  return {
    hasOverlap: overlappingElements.length > 0,
    overlappingElements,
    recommendations,
  };
}

/**
 * Suggest optimal positioning for an element
 */
export function suggestOptimalPosition(
  newElement: Omit<UIElement, 'position'> & { preferredPosition: UIElement['position'] },
  existingElements: UIElement[]
): UIElement['position'] {
  const { preferredPosition } = newElement;
  let optimalPosition = { ...preferredPosition };

  // Check for overlaps with existing elements
  for (const existingElement of existingElements) {
    const testElement: UIElement = {
      ...newElement,
      position: optimalPosition,
    };

    if (checkOverlap(testElement, existingElement)) {
      // Try moving to different positions
      const alternatives = [
        // Move right
        { ...optimalPosition, x: existingElement.position.x + existingElement.position.width + 10 },
        // Move left
        { ...optimalPosition, x: existingElement.position.x - optimalPosition.width - 10 },
        // Move down
        { ...optimalPosition, y: existingElement.position.y + existingElement.position.height + 10 },
        // Move up
        { ...optimalPosition, y: existingElement.position.y - optimalPosition.height - 10 },
      ];

      // Filter out positions that would be off-screen
      const validAlternatives = alternatives.filter(pos => 
        pos.x >= 0 && 
        pos.y >= 0 && 
        pos.x + pos.width <= window.innerWidth && 
        pos.y + pos.height <= window.innerHeight
      );

      if (validAlternatives.length > 0) {
        optimalPosition = validAlternatives[0];
      }
    }
  }

  return optimalPosition;
}

/**
 * Apply z-index based on element type
 */
export function applyZIndex(element: HTMLElement, type: keyof typeof Z_INDEX_MAP | UIElement['type']): void {
  let zIndex: number;

  if (type in Z_INDEX_MAP) {
    zIndex = Z_INDEX_MAP[type as keyof typeof Z_INDEX_MAP];
  } else {
    // Map UI element types to z-index
    const typeMap: Record<UIElement['type'], number> = {
      'chat-input': Z_INDEX_MAP.CHAT_INPUT,
      'model-selector': Z_INDEX_MAP.MODEL_SELECTOR,
      'progress-tracker': Z_INDEX_MAP.PROGRESS_TRACKER,
      'dropdown': Z_INDEX_MAP.DROPDOWN,
      'tooltip': Z_INDEX_MAP.TOOLTIP,
      'modal': Z_INDEX_MAP.MODAL,
    };
    zIndex = typeMap[type as UIElement['type']] || Z_INDEX_MAP.BASE;
  }

  element.style.zIndex = zIndex.toString();
}

/**
 * Scan page for UI elements and their positions
 */
export function scanPageElements(): UIElement[] {
  const elements: UIElement[] = [];

  // Common selectors for UI elements
  const selectors = {
    'modal': '[data-radix-dialog-content], [role="dialog"]',
    'dropdown': '[data-radix-dropdown-content], [data-radix-popover-content]',
    'tooltip': '[data-radix-tooltip-content]',
    'progress-tracker': '[data-testid="progress-tracker"]',
    'model-selector': '[data-testid="model-selector"]',
    'chat-input': '[data-testid="chat-input"]',
  };

  Object.entries(selectors).forEach(([type, selector]) => {
    const foundElements = document.querySelectorAll(selector);
    foundElements.forEach((element, index) => {
      if (element instanceof HTMLElement) {
        const bounds = getElementBounds(element);
        elements.push({
          id: `${type}-${index}`,
          element,
          priority: Z_INDEX_MAP[type.toUpperCase() as keyof typeof Z_INDEX_MAP] || Z_INDEX_MAP.BASE,
          type: type as UIElement['type'],
          position: bounds,
        });
      }
    });
  });

  return elements;
}

/**
 * Create a visual overlay to highlight overlapping elements
 */
export function createOverlapHighlight(element: UIElement): HTMLDivElement {
  const highlight = document.createElement('div');
  highlight.style.position = 'fixed';
  highlight.style.left = `${element.position.x}px`;
  highlight.style.top = `${element.position.y}px`;
  highlight.style.width = `${element.position.width}px`;
  highlight.style.height = `${element.position.height}px`;
  highlight.style.border = '2px solid red';
  highlight.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
  highlight.style.pointerEvents = 'none';
  highlight.style.zIndex = '9999';
  highlight.dataset.overlapHighlight = 'true';
  highlight.dataset.elementId = element.id;

  return highlight;
}

/**
 * Remove all overlap highlights
 */
export function clearOverlapHighlights(): void {
  const highlights = document.querySelectorAll('[data-overlap-highlight="true"]');
  highlights.forEach(highlight => highlight.remove());
}

/**
 * Auto-detect and fix common overlap issues
 */
export function autoFixOverlaps(): OverlapDetectionResult {
  const elements = scanPageElements();
  const result = detectOverlaps(elements);

  if (result.hasOverlap) {
    result.overlappingElements.forEach(element => {
      // Apply appropriate z-index
      applyZIndex(element.element, element.type);

      // For progress trackers, ensure they don't cover input areas
      if (element.type === 'progress-tracker') {
        const chatInputs = elements.filter(e => e.type === 'chat-input');
        if (chatInputs.length > 0) {
          // Move progress tracker to avoid chat input
          const chatInput = chatInputs[0];
          element.element.style.position = 'fixed';
          element.element.style.top = '10px';
          element.element.style.right = '10px';
          element.element.style.left = 'auto';
          element.element.style.bottom = 'auto';
        }
      }

      // For model selectors, ensure compact sizing
      if (element.type === 'model-selector') {
        element.element.style.maxWidth = '120px';
        element.element.style.minWidth = '80px';
      }
    });
  }

  return result;
}

/**
 * Monitor page for overlap changes
 */
export class OverlapMonitor {
  private observer: MutationObserver;
  private checkInterval: number;
  private onOverlapDetected?: (result: OverlapDetectionResult) => void;

  constructor(callback?: (result: OverlapDetectionResult) => void) {
    this.onOverlapDetected = callback;
    this.checkInterval = 0;

    this.observer = new MutationObserver(() => {
      this.checkOverlaps();
    });
  }

  start(): void {
    // Monitor DOM changes
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    // Periodic checks
    this.checkInterval = window.setInterval(() => {
      this.checkOverlaps();
    }, 2000);

    // Initial check
    this.checkOverlaps();
  }

  stop(): void {
    this.observer.disconnect();
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  private checkOverlaps(): void {
    const result = autoFixOverlaps();
    if (result.hasOverlap && this.onOverlapDetected) {
      this.onOverlapDetected(result);
    }
  }
}

/**
 * Responsive breakpoints for optimal positioning
 */
export const RESPONSIVE_BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  desktop: 1440,
} as const;

/**
 * Get optimal positioning based on screen size
 */
export function getResponsivePosition(
  basePosition: UIElement['position'],
  screenWidth: number
): UIElement['position'] {
  if (screenWidth < RESPONSIVE_BREAKPOINTS.mobile) {
    // Mobile: stack elements vertically
    return {
      ...basePosition,
      x: Math.min(basePosition.x, screenWidth - basePosition.width - 10),
      width: Math.min(basePosition.width, screenWidth - 20),
    };
  } else if (screenWidth < RESPONSIVE_BREAKPOINTS.tablet) {
    // Tablet: compact positioning
    return {
      ...basePosition,
      x: Math.min(basePosition.x, screenWidth - basePosition.width - 10),
      width: Math.min(basePosition.width, screenWidth * 0.4),
    };
  } else {
    // Desktop: full positioning
    return basePosition;
  }
}

export default {
  checkOverlap,
  detectOverlaps,
  suggestOptimalPosition,
  applyZIndex,
  scanPageElements,
  autoFixOverlaps,
  OverlapMonitor,
  getResponsivePosition,
  Z_INDEX_MAP,
};