# UI Overlap Prevention Documentation

## Overview

The Claudia application implements a comprehensive UI overlap prevention system to ensure all components integrate properly without visual conflicts across different devices and screen sizes.

## Key Components

### 1. Progress Tracker
- **Location**: `src/components/ProgressTracker.tsx`
- **Positioning**: Fixed left sidebar with z-index 40
- **Responsive Behavior**: 
  - Desktop: Full width (320px)
  - Tablet: Reduced width (280px)
  - Mobile: Collapsible with reduced height

### 2. Model Selector
- **Location**: `src/components/ModelSelector.tsx`
- **Positioning**: Relative with dropdown z-index 10
- **Features**:
  - Compact mode for narrow spaces
  - Smart dropdown positioning
  - Viewport edge detection

### 3. Intelligent Chat
- **Location**: `src/components/IntelligentChat.tsx`
- **Positioning**: Relative within chat container
- **Integration**: Works seamlessly with other components

## CSS Architecture

### Z-Index Scale
```css
--z-base: 0;          /* Base content */
--z-dropdown: 10;     /* Dropdowns and selects */
--z-sticky: 20;       /* Sticky headers */
--z-fixed: 30;        /* Fixed buttons */
--z-overlay: 40;      /* Progress tracker, sidebars */
--z-modal: 50;        /* Modal dialogs */
--z-notification: 60; /* Toast notifications */
--z-tooltip: 70;      /* Tooltips */
```

### Responsive Breakpoints
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

## Testing Strategy

### Automated Tests
Located in `src/tests/integration/UIOverlapPrevention.test.tsx`

1. **Component Layout Analysis**
   - Checks for element overlaps
   - Validates z-index hierarchy
   - Tests responsive behavior

2. **Cross-Component Testing**
   - Multiple components interaction
   - Modal overlay conflicts
   - Keyboard navigation

3. **Device-Specific Tests**
   - Mobile portrait/landscape
   - Tablet portrait/landscape
   - Desktop and ultra-wide

### Visual Testing
The `UIOverlapTestReport` component provides:
- Real-time overlap detection
- Device simulation
- Screenshot capabilities
- Performance metrics

### Manual Testing Checklist

#### Desktop (1920x1080)
- [ ] Progress Tracker doesn't overlap chat
- [ ] Model Selector dropdown stays in viewport
- [ ] Multiple modals stack correctly
- [ ] Tooltips appear above all content

#### Tablet (768x1024)
- [ ] Progress Tracker width adjusts
- [ ] Model Selector uses compact mode
- [ ] Touch targets are adequate size
- [ ] Scrolling doesn't cause overlaps

#### Mobile (375x812)
- [ ] Progress Tracker is collapsible
- [ ] Model Selector fits narrow space
- [ ] Keyboard doesn't cover input
- [ ] Safe areas respected

## Best Practices

### 1. Component Development
```tsx
// Use consistent z-index variables
className="z-overlay" // Instead of z-40

// Include safe area insets
padding: env(safe-area-inset-top, 0);

// Test at multiple breakpoints
@media (max-width: 768px) { /* Mobile styles */ }
```

### 2. Positioning Guidelines
- Prefer CSS Grid/Flexbox over absolute positioning
- Use `position: fixed` sparingly
- Always consider viewport boundaries
- Implement collision detection for floating elements

### 3. Accessibility
- Maintain proper focus order
- Ensure keyboard navigation works
- Provide escape hatches (ESC key)
- Test with screen readers

## Troubleshooting

### Common Issues

1. **Elements Overlapping**
   - Check z-index hierarchy
   - Verify positioning context
   - Test at different screen sizes

2. **Dropdown Cut Off**
   - Use portal rendering
   - Calculate available space
   - Implement flip behavior

3. **Mobile Layout Issues**
   - Check safe area insets
   - Test with keyboard open
   - Verify touch target sizes

### Debug Tools

1. **Visual Overlap Detector**
   ```ts
   import { enableOverlapDetection } from '@/utils/visualOverlapDetector';
   
   // Enable in development
   enableOverlapDetection();
   ```

2. **Browser DevTools**
   - Use device emulation
   - Check computed styles
   - Inspect z-index stacking

3. **Test Report**
   - Run comprehensive tests
   - View live monitoring
   - Export test results

## Performance Considerations

1. **Minimize Reflows**
   - Use CSS transforms
   - Batch DOM updates
   - Avoid layout thrashing

2. **Optimize Animations**
   - Use GPU acceleration
   - Reduce paint areas
   - Debounce resize events

3. **Memory Management**
   - Clean up observers
   - Remove event listeners
   - Limit DOM queries

## Future Improvements

1. **Enhanced Collision Detection**
   - Predictive positioning
   - Smart anchor points
   - Dynamic space allocation

2. **Advanced Testing**
   - Visual regression tests
   - Cross-browser automation
   - Performance benchmarks

3. **Adaptive UI**
   - Context-aware layouts
   - Intelligent component sizing
   - Progressive enhancement

## Resources

- [CSS Z-Index Guide](https://developer.mozilla.org/en-US/docs/Web/CSS/z-index)
- [Responsive Design Patterns](https://web.dev/responsive-web-design-basics/)
- [Accessibility Best Practices](https://www.w3.org/WAI/WCAG21/quickref/)
- [Performance Optimization](https://web.dev/fast/)