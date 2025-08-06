/**
 * Visual Overlap Detector Utility
 * Provides runtime detection and visualization of overlapping UI elements
 */

export interface OverlapInfo {
  element1: {
    element: Element;
    rect: DOMRect;
    identifier: string;
  };
  element2: {
    element: Element;
    rect: DOMRect;
    identifier: string;
  };
  overlapRect: DOMRect;
  severity: 'low' | 'medium' | 'high';
}

export class VisualOverlapDetector {
  private overlayContainer: HTMLDivElement | null = null;
  private observers: MutationObserver[] = [];
  private resizeObserver: ResizeObserver | null = null;
  private enabled = false;

  constructor(private options: {
    highlightColor?: string;
    checkInterval?: number;
    ignoreSelectors?: string[];
    minimumOverlapArea?: number;
  } = {}) {
    this.options = {
      highlightColor: 'rgba(255, 0, 0, 0.3)',
      checkInterval: 500,
      ignoreSelectors: [],
      minimumOverlapArea: 100, // minimum 100px² to be considered an overlap
      ...options,
    };
  }

  /**
   * Enable overlap detection
   */
  enable(): void {
    if (this.enabled) return;
    this.enabled = true;

    // Create overlay container for visual indicators
    this.overlayContainer = document.createElement('div');
    this.overlayContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 999999;
    `;
    document.body.appendChild(this.overlayContainer);

    // Start monitoring
    this.startMonitoring();

    // Initial check
    this.checkForOverlaps();
  }

  /**
   * Disable overlap detection
   */
  disable(): void {
    if (!this.enabled) return;
    this.enabled = false;

    // Clean up observers
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Remove overlay container
    if (this.overlayContainer) {
      this.overlayContainer.remove();
      this.overlayContainer = null;
    }
  }

  /**
   * Start monitoring for DOM changes
   */
  private startMonitoring(): void {
    // Monitor DOM mutations
    const mutationObserver = new MutationObserver(() => {
      this.debounceCheck();
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    this.observers.push(mutationObserver);

    // Monitor resize events
    this.resizeObserver = new ResizeObserver(() => {
      this.debounceCheck();
    });

    // Observe all potentially overlapping elements
    const elements = this.getMonitoredElements();
    elements.forEach(el => this.resizeObserver?.observe(el));

    // Monitor scroll events
    window.addEventListener('scroll', this.debounceCheck, true);
    window.addEventListener('resize', this.debounceCheck);
  }

  private checkTimeout: NodeJS.Timeout | null = null;

  /**
   * Debounced check for overlaps
   */
  private debounceCheck = (): void => {
    if (this.checkTimeout) {
      clearTimeout(this.checkTimeout);
    }
    this.checkTimeout = setTimeout(() => {
      this.checkForOverlaps();
    }, this.options.checkInterval);
  };

  /**
   * Get elements to monitor for overlaps
   */
  private getMonitoredElements(): Element[] {
    const selectors = [
      '[class*="fixed"]',
      '[class*="absolute"]',
      '[class*="sticky"]',
      '[role="dialog"]',
      '[role="tooltip"]',
      '[role="menu"]',
      '[data-radix-ui-popper-content]',
      '.progress-tracker',
      '.model-selector',
      '.intelligent-chat',
    ];

    const elements: Element[] = [];
    selectors.forEach(selector => {
      if (!this.options.ignoreSelectors?.includes(selector)) {
        elements.push(...Array.from(document.querySelectorAll(selector)));
      }
    });

    return elements;
  }

  /**
   * Check for overlapping elements
   */
  private checkForOverlaps(): void {
    if (!this.overlayContainer) return;

    // Clear previous highlights
    this.overlayContainer.innerHTML = '';

    const elements = this.getMonitoredElements();
    const overlaps = this.detectOverlaps(elements);

    // Visualize overlaps
    overlaps.forEach(overlap => {
      this.visualizeOverlap(overlap);
    });

    // Log to console in development
    if (overlaps.length > 0 && process.env.NODE_ENV === 'development') {
      console.warn(`Detected ${overlaps.length} UI overlaps:`, overlaps);
    }
  }

  /**
   * Detect overlapping elements
   */
  private detectOverlaps(elements: Element[]): OverlapInfo[] {
    const overlaps: OverlapInfo[] = [];
    const visibleElements = elements.filter(el => this.isElementVisible(el));

    for (let i = 0; i < visibleElements.length; i++) {
      for (let j = i + 1; j < visibleElements.length; j++) {
        const overlap = this.checkElementOverlap(
          visibleElements[i],
          visibleElements[j]
        );
        if (overlap) {
          overlaps.push(overlap);
        }
      }
    }

    return overlaps;
  }

  /**
   * Check if an element is visible
   */
  private isElementVisible(element: Element): boolean {
    const style = window.getComputedStyle(element);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0'
    ) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /**
   * Check if two elements overlap
   */
  private checkElementOverlap(el1: Element, el2: Element): OverlapInfo | null {
    const rect1 = el1.getBoundingClientRect();
    const rect2 = el2.getBoundingClientRect();

    // Calculate overlap
    const overlapLeft = Math.max(rect1.left, rect2.left);
    const overlapTop = Math.max(rect1.top, rect2.top);
    const overlapRight = Math.min(rect1.right, rect2.right);
    const overlapBottom = Math.min(rect1.bottom, rect2.bottom);

    if (overlapLeft < overlapRight && overlapTop < overlapBottom) {
      const overlapWidth = overlapRight - overlapLeft;
      const overlapHeight = overlapBottom - overlapTop;
      const overlapArea = overlapWidth * overlapHeight;

      // Check minimum overlap area
      if (overlapArea < this.options.minimumOverlapArea!) {
        return null;
      }

      // Check z-index to see if overlap is intentional
      const style1 = window.getComputedStyle(el1);
      const style2 = window.getComputedStyle(el2);
      const zIndex1 = parseInt(style1.zIndex || '0');
      const zIndex2 = parseInt(style2.zIndex || '0');

      // If elements have different z-indices, they might be intentionally layered
      if (Math.abs(zIndex1 - zIndex2) > 10) {
        return null;
      }

      // Determine severity
      const area1 = rect1.width * rect1.height;
      const area2 = rect2.width * rect2.height;
      const overlapPercentage = Math.max(
        overlapArea / area1,
        overlapArea / area2
      ) * 100;

      let severity: 'low' | 'medium' | 'high' = 'low';
      if (overlapPercentage > 75) severity = 'high';
      else if (overlapPercentage > 25) severity = 'medium';

      return {
        element1: {
          element: el1,
          rect: rect1,
          identifier: this.getElementIdentifier(el1),
        },
        element2: {
          element: el2,
          rect: rect2,
          identifier: this.getElementIdentifier(el2),
        },
        overlapRect: new DOMRect(
          overlapLeft,
          overlapTop,
          overlapWidth,
          overlapHeight
        ),
        severity,
      };
    }

    return null;
  }

  /**
   * Get a human-readable identifier for an element
   */
  private getElementIdentifier(element: Element): string {
    const id = element.id ? `#${element.id}` : '';
    const classes = element.className
      ? `.${element.className.split(' ').filter(c => c).join('.')}`
      : '';
    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute('role') ? `[role="${element.getAttribute('role')}"]` : '';
    const testId = element.getAttribute('data-testid') ? `[data-testid="${element.getAttribute('data-testid')}"]` : '';

    return `${tag}${id}${classes}${role}${testId}`;
  }

  /**
   * Visualize an overlap with a colored overlay
   */
  private visualizeOverlap(overlap: OverlapInfo): void {
    if (!this.overlayContainer) return;

    const overlay = document.createElement('div');
    const rect = overlap.overlapRect;
    
    const color = overlap.severity === 'high' 
      ? 'rgba(255, 0, 0, 0.5)'
      : overlap.severity === 'medium'
      ? 'rgba(255, 165, 0, 0.4)'
      : 'rgba(255, 255, 0, 0.3)';

    overlay.style.cssText = `
      position: absolute;
      left: ${rect.left}px;
      top: ${rect.top}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      background-color: ${color};
      border: 2px solid ${color.replace(/[\d.]+\)$/, '1)')};
      pointer-events: none;
    `;

    // Add label
    const label = document.createElement('div');
    label.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      background-color: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 2px 6px;
      font-size: 11px;
      font-family: monospace;
      white-space: nowrap;
      z-index: 1;
    `;
    label.textContent = `${overlap.element1.identifier} ↔ ${overlap.element2.identifier}`;
    overlay.appendChild(label);

    this.overlayContainer.appendChild(overlay);
  }

  /**
   * Get current overlap report
   */
  getOverlapReport(): {
    overlaps: OverlapInfo[];
    summary: {
      total: number;
      high: number;
      medium: number;
      low: number;
    };
  } {
    const elements = this.getMonitoredElements();
    const overlaps = this.detectOverlaps(elements);

    const summary = {
      total: overlaps.length,
      high: overlaps.filter(o => o.severity === 'high').length,
      medium: overlaps.filter(o => o.severity === 'medium').length,
      low: overlaps.filter(o => o.severity === 'low').length,
    };

    return { overlaps, summary };
  }

  /**
   * Take a screenshot with overlap highlights
   */
  async captureOverlapScreenshot(): Promise<Blob | null> {
    // This would require a library like html2canvas
    // For now, we'll just log the current state
    const report = this.getOverlapReport();
    console.log('Overlap Report:', report);
    return null;
  }
}

// Create singleton instance for development
let detector: VisualOverlapDetector | null = null;

export function enableOverlapDetection(options?: ConstructorParameters<typeof VisualOverlapDetector>[0]): VisualOverlapDetector {
  if (!detector) {
    detector = new VisualOverlapDetector(options);
  }
  detector.enable();
  return detector;
}

export function disableOverlapDetection(): void {
  if (detector) {
    detector.disable();
    detector = null;
  }
}

// Auto-enable in development mode
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    // Enable with a slight delay to ensure all components are rendered
    setTimeout(() => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('debug-overlaps') === 'true') {
        enableOverlapDetection();
        console.log('Visual Overlap Detection enabled. Add ?debug-overlaps=true to URL to enable.');
      }
    }, 1000);
  });
}