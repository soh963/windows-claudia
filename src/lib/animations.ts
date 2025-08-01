/**
 * Animation utilities and variants for consistent UI animations
 * Using Framer Motion for performant and accessible animations
 */

import { Variants, Transition } from 'framer-motion';

// Core animation durations
export const DURATIONS = {
  fast: 0.15,
  normal: 0.3,
  slow: 0.5,
  verySlow: 1.0,
} as const;

// Easing functions
export const EASINGS = {
  // Standard Material Design curves
  standard: [0.4, 0.0, 0.2, 1],
  decelerate: [0.0, 0.0, 0.2, 1],
  accelerate: [0.4, 0.0, 1, 1],
  sharp: [0.4, 0.0, 0.6, 1],
  
  // Custom curves for UI
  bounce: [0.68, -0.55, 0.265, 1.55],
  elastic: [0.25, 0.46, 0.45, 0.94],
  smooth: [0.25, 0.1, 0.25, 1],
} as const;

// Base transition configurations
export const transitions = {
  fast: { duration: DURATIONS.fast, ease: EASINGS.standard },
  normal: { duration: DURATIONS.normal, ease: EASINGS.standard },
  slow: { duration: DURATIONS.slow, ease: EASINGS.standard },
  spring: { type: "spring", stiffness: 300, damping: 30 },
  bounce: { duration: DURATIONS.slow, ease: EASINGS.bounce },
  smooth: { duration: DURATIONS.normal, ease: EASINGS.smooth },
} as const;

// Page transition variants
export const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 20,
    scale: 0.98,
  },
  in: {
    opacity: 1,
    y: 0,
    scale: 1,
  },
  out: {
    opacity: 0,
    y: -20,
    scale: 1.02,
  },
};

export const pageTransition: Transition = {
  type: "tween",
  ease: EASINGS.smooth,
  duration: DURATIONS.normal,
};

// Slide transitions for tab switching
export const slideVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 300 : -300,
    opacity: 0,
  }),
};

// Card hover animations
export const cardVariants: Variants = {
  rest: {
    scale: 1,
    boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
  },
  hover: {
    scale: 1.02,
    boxShadow: "0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
    transition: transitions.fast,
  },
  tap: {
    scale: 0.98,
    transition: transitions.fast,
  },
};

// Button interactions
export const buttonVariants: Variants = {
  rest: {
    scale: 1,
  },
  hover: {
    scale: 1.05,
    transition: transitions.fast,
  },
  tap: {
    scale: 0.95,
    transition: transitions.fast,
  },
};

// Loading animations
export const loadingVariants: Variants = {
  start: {
    rotate: 0,
  },
  end: {
    rotate: 360,
    transition: {
      duration: 1,
      ease: "linear",
      repeat: Infinity,
    },
  },
};

// Skeleton loader animations
export const skeletonVariants: Variants = {
  start: {
    opacity: 0.5,
  },
  end: {
    opacity: 1,
    transition: {
      duration: 1,
      ease: "easeInOut",
      repeat: Infinity,
      repeatType: "reverse",
    },
  },
};

// Stagger animations for lists
export const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: transitions.normal,
  },
};

// Modal animations
export const modalVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: 10,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: transitions.spring,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: transitions.fast,
  },
};

// Backdrop variants
export const backdropVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: transitions.fast,
  },
  exit: {
    opacity: 0,
    transition: transitions.fast,
  },
};

// Toast animations
export const toastVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -100,
    scale: 0.3,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: transitions.bounce,
  },
  exit: {
    opacity: 0,
    scale: 0.5,
    transition: transitions.fast,
  },
};

// Tab indicator animations
export const tabIndicatorVariants: Variants = {
  inactive: {
    scaleX: 0,
    opacity: 0,
  },
  active: {
    scaleX: 1,
    opacity: 1,
    transition: transitions.spring,
  },
};

// Progress bar animations
export const progressVariants: Variants = {
  hidden: {
    scaleX: 0,
    transformOrigin: "left",
  },
  visible: (progress: number) => ({
    scaleX: progress / 100,
    transition: transitions.smooth,
  }),
};

// Utility functions for animation
export const reduceMotion = () => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

export const getTransition = (
  duration: keyof typeof DURATIONS = 'normal',
  easing: keyof typeof EASINGS = 'standard'
): Transition => ({
  duration: DURATIONS[duration],
  ease: EASINGS[easing],
});

// Animation presets for common UI patterns
export const animations = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: transitions.normal,
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: transitions.normal,
  },
  slideDown: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
    transition: transitions.normal,
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
    transition: transitions.spring,
  },
  slideLeft: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
    transition: transitions.normal,
  },
  slideRight: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
    transition: transitions.normal,
  },
} as const;

// Custom hooks for animations
export const useAnimationConfig = () => {
  const shouldReduceMotion = reduceMotion();
  
  return {
    shouldReduceMotion,
    transition: shouldReduceMotion ? { duration: 0 } : transitions.normal,
    pageTransition: shouldReduceMotion ? { duration: 0 } : pageTransition,
  };
};

// Animation variants for dashboard components
export const dashboardVariants = {
  container: {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  },
  item: {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: transitions.spring,
    },
  },
  card: {
    rest: {
      scale: 1,
      boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
    },
    hover: {
      scale: 1.02,
      boxShadow: "0 8px 25px -8px rgba(0, 0, 0, 0.15)",
      transition: transitions.fast,
    },
  },
} as const;