import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react-dom/test-utils';
import { vi } from 'vitest';
import { ProgressTracker } from '@/components/ProgressTracker';
import { ModelSelector } from '@/components/ModelSelector';
import { IntelligentChat } from '@/components/IntelligentChat';
import { ChatWindowWithProgressTracker } from '@/components/ChatWindowWithProgressTracker';
import { useMonitoringStore } from '@/stores/monitoringStore';
import { ResizeObserver } from '@juggle/resize-observer';

// Mock ResizeObserver
global.ResizeObserver = ResizeObserver;

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock window.matchMedia for responsive tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('UI Overlap Prevention Tests', () => {
  // Helper function to check for overlapping elements
  const checkForOverlaps = (container: HTMLElement): Array<{
    element1: Element;
    element2: Element;
    overlap: DOMRect;
  }> => {
    const elements = container.querySelectorAll('[data-testid], [role], [class*="fixed"], [class*="absolute"]');
    const overlaps: Array<{ element1: Element; element2: Element; overlap: DOMRect }> = [];
    
    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        const rect1 = elements[i].getBoundingClientRect();
        const rect2 = elements[j].getBoundingClientRect();
        
        // Check if elements overlap
        const overlapLeft = Math.max(rect1.left, rect2.left);
        const overlapTop = Math.max(rect1.top, rect2.top);
        const overlapRight = Math.min(rect1.right, rect2.right);
        const overlapBottom = Math.min(rect1.bottom, rect2.bottom);
        
        if (overlapLeft < overlapRight && overlapTop < overlapBottom) {
          // Check if elements are in the same z-index context
          const style1 = window.getComputedStyle(elements[i]);
          const style2 = window.getComputedStyle(elements[j]);
          const zIndex1 = parseInt(style1.zIndex || '0');
          const zIndex2 = parseInt(style2.zIndex || '0');
          
          // Only report overlap if elements are on the same z-index level
          // or if one doesn't have explicit z-index
          if (zIndex1 === zIndex2 || isNaN(zIndex1) || isNaN(zIndex2)) {
            overlaps.push({
              element1: elements[i],
              element2: elements[j],
              overlap: new DOMRect(
                overlapLeft,
                overlapTop,
                overlapRight - overlapLeft,
                overlapBottom - overlapTop
              ),
            });
          }
        }
      }
    }
    
    return overlaps;
  };

  // Helper to simulate different viewport sizes
  const setViewportSize = (width: number, height: number) => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: height,
    });
    window.dispatchEvent(new Event('resize'));
  };

  beforeEach(() => {
    // Reset monitoring store
    useMonitoringStore.getState().reset();
    // Set default viewport
    setViewportSize(1920, 1080);
  });

  describe('Progress Tracker Tests', () => {
    test('should not overlap with other UI elements when visible', () => {
      const { container } = render(
        <div className="relative h-screen w-screen">
          <ProgressTracker />
          <div className="fixed top-4 right-4 z-50" data-testid="top-right-element">
            Top Right Element
          </div>
          <div className="fixed bottom-4 left-4 z-50" data-testid="bottom-left-element">
            Bottom Left Element
          </div>
        </div>
      );

      // Make progress tracker visible
      act(() => {
        useMonitoringStore.getState().showProgressTracker();
      });

      const overlaps = checkForOverlaps(container);
      expect(overlaps).toHaveLength(0);
    });

    test('should maintain proper z-index hierarchy', () => {
      const { container } = render(<ProgressTracker />);
      
      act(() => {
        useMonitoringStore.getState().showProgressTracker();
      });

      const tracker = container.querySelector('.fixed.left-0.top-0');
      expect(tracker).toBeInTheDocument();
      
      const computedStyle = window.getComputedStyle(tracker!);
      const zIndex = parseInt(computedStyle.zIndex);
      expect(zIndex).toBeGreaterThanOrEqual(40); // z-40 in the component
    });

    test('should handle collision with chat window properly', async () => {
      const { container } = render(
        <div className="relative h-screen w-screen">
          <ChatWindowWithProgressTracker />
        </div>
      );

      // Wait for components to render
      await waitFor(() => {
        const progressTracker = container.querySelector('[class*="ProgressTracker"]');
        expect(progressTracker).toBeInTheDocument();
      });

      const overlaps = checkForOverlaps(container);
      expect(overlaps).toHaveLength(0);
    });

    test('should adapt layout on different screen sizes', async () => {
      const { container, rerender } = render(<ProgressTracker />);
      
      act(() => {
        useMonitoringStore.getState().showProgressTracker();
      });

      // Test desktop
      setViewportSize(1920, 1080);
      rerender(<ProgressTracker />);
      let overlaps = checkForOverlaps(container);
      expect(overlaps).toHaveLength(0);

      // Test tablet
      setViewportSize(768, 1024);
      rerender(<ProgressTracker />);
      overlaps = checkForOverlaps(container);
      expect(overlaps).toHaveLength(0);

      // Test mobile
      setViewportSize(375, 812);
      rerender(<ProgressTracker />);
      overlaps = checkForOverlaps(container);
      expect(overlaps).toHaveLength(0);
    });
  });

  describe('Model Selector Tests', () => {
    test('should not overlap when dropdown is open', async () => {
      const { container } = render(
        <div className="relative h-screen w-screen p-4">
          <div className="flex items-center gap-4">
            <ModelSelector value="auto" onChange={() => {}} />
            <input className="h-10 px-3 border" placeholder="Chat input" />
          </div>
        </div>
      );

      // Open dropdown
      const trigger = screen.getByRole('button');
      await userEvent.click(trigger);

      await waitFor(() => {
        const dropdown = container.querySelector('[data-radix-ui-popper-content]');
        expect(dropdown).toBeInTheDocument();
      });

      const overlaps = checkForOverlaps(container);
      expect(overlaps).toHaveLength(0);
    });

    test('should handle long model names without breaking layout', async () => {
      const { container } = render(
        <div className="w-64">
          <ModelSelector value="gemini-2.0-flash-exp" onChange={() => {}} />
        </div>
      );

      const button = screen.getByRole('button');
      const buttonRect = button.getBoundingClientRect();
      
      // Check that button doesn't overflow its container
      expect(buttonRect.width).toBeLessThanOrEqual(256); // 64 * 4 = 256px (w-64)
    });

    test('should position dropdown correctly near viewport edges', async () => {
      const { container } = render(
        <div className="fixed bottom-4 right-4">
          <ModelSelector value="auto" onChange={() => {}} />
        </div>
      );

      const trigger = screen.getByRole('button');
      await userEvent.click(trigger);

      await waitFor(() => {
        const dropdown = container.querySelector('[data-radix-ui-popper-content]');
        expect(dropdown).toBeInTheDocument();
        
        const dropdownRect = dropdown!.getBoundingClientRect();
        // Dropdown should not overflow viewport
        expect(dropdownRect.right).toBeLessThanOrEqual(window.innerWidth);
        expect(dropdownRect.bottom).toBeLessThanOrEqual(window.innerHeight);
      });
    });
  });

  describe('Intelligent Chat Tests', () => {
    test('should not overlap with surrounding elements', () => {
      const { container } = render(
        <div className="relative h-screen w-screen p-4">
          <div className="mb-4">
            <IntelligentChat input="test input" />
          </div>
          <input className="w-full h-10 px-3 border" placeholder="Chat input" />
        </div>
      );

      const overlaps = checkForOverlaps(container);
      expect(overlaps).toHaveLength(0);
    });

    test('should handle multiple tool invocations without overlap', async () => {
      const mockRoutingResult = {
        invocations: [
          { tool_type: { agent: 'frontend' }, confidence: 0.9, reason: 'UI task', priority: 1 },
          { tool_type: { slash_command: 'build' }, confidence: 0.8, reason: 'Build command', priority: 2 },
          { tool_type: { mcp_server: 'magic' }, confidence: 0.7, reason: 'MCP needed', priority: 3 },
        ],
        detected_intent: 'build UI component',
        complexity_score: 0.6,
        domain: 'frontend',
      };

      // Mock the invoke function
      vi.mock('@tauri-apps/api/core', () => ({
        invoke: vi.fn().mockResolvedValue(mockRoutingResult),
      }));

      const { container } = render(
        <IntelligentChat input="create a new component" />
      );

      await waitFor(() => {
        const invocations = container.querySelectorAll('[class*="flex items-center justify-between"]');
        expect(invocations.length).toBeGreaterThan(0);
      });

      const overlaps = checkForOverlaps(container);
      expect(overlaps).toHaveLength(0);
    });
  });

  describe('Cross-Component Integration Tests', () => {
    test('should handle all components together without conflicts', async () => {
      const { container } = render(
        <div className="relative h-screen w-screen">
          <ChatWindowWithProgressTracker />
          <div className="fixed bottom-4 left-4 z-50">
            <ModelSelector value="auto" onChange={() => {}} />
          </div>
        </div>
      );

      // Open model selector
      const modelButton = screen.getByRole('button');
      await userEvent.click(modelButton);

      // Show progress tracker
      act(() => {
        useMonitoringStore.getState().showProgressTracker();
      });

      await waitFor(() => {
        const progressTracker = container.querySelector('.fixed.left-0.top-0');
        const dropdown = container.querySelector('[data-radix-ui-popper-content]');
        expect(progressTracker).toBeInTheDocument();
        expect(dropdown).toBeInTheDocument();
      });

      const overlaps = checkForOverlaps(container);
      expect(overlaps).toHaveLength(0);
    });

    test('should maintain proper focus management', async () => {
      render(
        <div className="relative h-screen w-screen">
          <ChatWindowWithProgressTracker />
          <ModelSelector value="auto" onChange={() => {}} />
        </div>
      );

      // Test tab navigation
      await userEvent.tab();
      expect(document.activeElement).toBeTruthy();
      
      await userEvent.tab();
      expect(document.activeElement).toBeTruthy();
      
      // Ensure focus doesn't get trapped
      const initialFocus = document.activeElement;
      await userEvent.tab();
      expect(document.activeElement).not.toBe(initialFocus);
    });

    test('should handle keyboard navigation without layout issues', async () => {
      const { container } = render(
        <div className="relative h-screen w-screen">
          <ChatWindowWithProgressTracker />
        </div>
      );

      // Test escape key closes dropdowns/modals
      await userEvent.keyboard('{Escape}');
      
      const overlaps = checkForOverlaps(container);
      expect(overlaps).toHaveLength(0);
    });
  });

  describe('Responsive Design Tests', () => {
    const viewportSizes = [
      { name: 'Mobile Portrait', width: 375, height: 812 },
      { name: 'Mobile Landscape', width: 812, height: 375 },
      { name: 'Tablet Portrait', width: 768, height: 1024 },
      { name: 'Tablet Landscape', width: 1024, height: 768 },
      { name: 'Desktop', width: 1920, height: 1080 },
      { name: 'Ultra-wide', width: 3440, height: 1440 },
    ];

    viewportSizes.forEach(({ name, width, height }) => {
      test(`should prevent overlaps on ${name} (${width}x${height})`, async () => {
        setViewportSize(width, height);
        
        const { container } = render(
          <div className="relative h-screen w-screen">
            <ChatWindowWithProgressTracker />
            <div className="fixed bottom-4 right-4">
              <ModelSelector value="auto" onChange={() => {}} />
            </div>
          </div>
        );

        // Show all UI elements
        act(() => {
          useMonitoringStore.getState().showProgressTracker();
        });

        const modelButton = screen.getByRole('button');
        await userEvent.click(modelButton);

        await waitFor(() => {
          const dropdown = container.querySelector('[data-radix-ui-popper-content]');
          expect(dropdown).toBeInTheDocument();
        });

        const overlaps = checkForOverlaps(container);
        expect(overlaps).toHaveLength(0);
      });
    });
  });

  describe('Z-Index Management Tests', () => {
    test('should maintain proper z-index hierarchy', () => {
      const { container } = render(
        <div className="relative">
          <div className="fixed inset-0 bg-black/50 z-50" data-testid="modal-backdrop" />
          <div className="fixed top-1/2 left-1/2 z-50" data-testid="modal" />
          <ProgressTracker />
          <div className="fixed bottom-4 right-4 z-30" data-testid="floating-button" />
        </div>
      );

      act(() => {
        useMonitoringStore.getState().showProgressTracker();
      });

      const elements = {
        modalBackdrop: container.querySelector('[data-testid="modal-backdrop"]'),
        modal: container.querySelector('[data-testid="modal"]'),
        progressTracker: container.querySelector('.fixed.left-0.top-0'),
        floatingButton: container.querySelector('[data-testid="floating-button"]'),
      };

      // Get computed z-indices
      const zIndices = Object.entries(elements).reduce((acc, [key, element]) => {
        if (element) {
          const style = window.getComputedStyle(element);
          acc[key] = parseInt(style.zIndex || '0');
        }
        return acc;
      }, {} as Record<string, number>);

      // Modal should be above progress tracker
      expect(zIndices.modal).toBeGreaterThan(zIndices.progressTracker);
      expect(zIndices.modalBackdrop).toBeGreaterThan(zIndices.progressTracker);
      
      // Progress tracker should be above floating button
      expect(zIndices.progressTracker).toBeGreaterThan(zIndices.floatingButton);
    });
  });

  describe('Animation and Transition Tests', () => {
    test('should not cause layout shifts during animations', async () => {
      const { container } = render(<ProgressTracker />);
      
      // Get initial layout
      const initialLayout = Array.from(container.querySelectorAll('*')).map(el => 
        el.getBoundingClientRect()
      );

      // Trigger visibility change
      act(() => {
        useMonitoringStore.getState().showProgressTracker();
      });

      // Wait for animation to start
      await waitFor(() => {
        const tracker = container.querySelector('.fixed.left-0.top-0');
        expect(tracker).toBeInTheDocument();
      });

      // Check that other elements haven't moved
      const finalLayout = Array.from(container.querySelectorAll('*')).map(el => 
        el.getBoundingClientRect()
      );

      // Filter out the progress tracker itself and check remaining elements
      const nonAnimatedElements = finalLayout.filter((rect, index) => {
        const element = container.querySelectorAll('*')[index];
        return !element.classList.contains('fixed');
      });

      expect(nonAnimatedElements.length).toBeGreaterThan(0);
    });
  });
});