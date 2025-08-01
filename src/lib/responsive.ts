/**
 * Responsive design utilities and breakpoint management
 */

import { useEffect, useState } from 'react';

// Standard breakpoints following Tailwind CSS conventions
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof breakpoints;

// Media query utilities
export const mediaQueries = {
  sm: `(min-width: ${breakpoints.sm}px)`,
  md: `(min-width: ${breakpoints.md}px)`,
  lg: `(min-width: ${breakpoints.lg}px)`,
  xl: `(min-width: ${breakpoints.xl}px)`,
  '2xl': `(min-width: ${breakpoints['2xl']}px)`,
  mobile: `(max-width: ${breakpoints.md - 1}px)`,
  tablet: `(min-width: ${breakpoints.md}px) and (max-width: ${breakpoints.lg - 1}px)`,
  desktop: `(min-width: ${breakpoints.lg}px)`,
} as const;

// Hook to get current screen size
export const useScreenSize = () => {
  const [screenSize, setScreenSize] = useState<{
    width: number;
    height: number;
    breakpoint: Breakpoint | 'xs';
  }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
    breakpoint: 'xs',
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      let breakpoint: Breakpoint | 'xs' = 'xs';
      if (width >= breakpoints['2xl']) breakpoint = '2xl';
      else if (width >= breakpoints.xl) breakpoint = 'xl';
      else if (width >= breakpoints.lg) breakpoint = 'lg';
      else if (width >= breakpoints.md) breakpoint = 'md';
      else if (width >= breakpoints.sm) breakpoint = 'sm';

      setScreenSize({ width, height, breakpoint });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return screenSize;
};

// Hook to check if screen matches a media query
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
};

// Convenience hooks for common breakpoints
export const useIsMobile = () => useMediaQuery(mediaQueries.mobile);
export const useIsTablet = () => useMediaQuery(mediaQueries.tablet);
export const useIsDesktop = () => useMediaQuery(mediaQueries.desktop);

// Responsive animation variants
export const getResponsiveVariants = (isMobile: boolean) => ({
  // Reduce motion on mobile for better performance
  transition: {
    duration: isMobile ? 0.2 : 0.3,
    ease: 'easeOut',
  },
  // Smaller scale changes on mobile
  hover: {
    scale: isMobile ? 1.01 : 1.02,
  },
  tap: {
    scale: isMobile ? 0.99 : 0.98,
  },
});

// Responsive spacing utilities
export const getResponsiveSpacing = (breakpoint: Breakpoint | 'xs') => ({
  padding: {
    xs: 'p-3',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
    xl: 'p-10',
    '2xl': 'p-12',
  }[breakpoint],
  margin: {
    xs: 'm-3',
    sm: 'm-4',
    md: 'm-6',
    lg: 'm-8',
    xl: 'm-10',
    '2xl': 'm-12',
  }[breakpoint],
  gap: {
    xs: 'gap-3',
    sm: 'gap-4',
    md: 'gap-6',
    lg: 'gap-8',
    xl: 'gap-10',
    '2xl': 'gap-12',
  }[breakpoint],
});

// Responsive grid configurations
export const getResponsiveGrid = (breakpoint: Breakpoint | 'xs') => ({
  dashboard: {
    xs: 'grid-cols-1',
    sm: 'grid-cols-1',
    md: 'grid-cols-2',
    lg: 'grid-cols-2',
    xl: 'grid-cols-3',
    '2xl': 'grid-cols-3',
  }[breakpoint],
  cards: {
    xs: 'grid-cols-1',
    sm: 'grid-cols-2',
    md: 'grid-cols-2',
    lg: 'grid-cols-3',
    xl: 'grid-cols-4',
    '2xl': 'grid-cols-4',
  }[breakpoint],
  list: {
    xs: 'grid-cols-1',
    sm: 'grid-cols-1',
    md: 'grid-cols-1',
    lg: 'grid-cols-2',
    xl: 'grid-cols-2',
    '2xl': 'grid-cols-3',
  }[breakpoint],
});

// Touch-friendly sizing for mobile
export const getTouchFriendlySize = (isMobile: boolean) => ({
  button: isMobile ? 'h-12 px-6' : 'h-10 px-4',
  input: isMobile ? 'h-12' : 'h-10',
  icon: isMobile ? 'h-6 w-6' : 'h-5 w-5',
  clickable: isMobile ? 'min-h-12 min-w-12' : 'min-h-10 min-w-10',
});

// Responsive text sizes
export const getResponsiveText = (breakpoint: Breakpoint | 'xs') => ({
  heading: {
    xs: 'text-2xl',
    sm: 'text-3xl',
    md: 'text-4xl',
    lg: 'text-5xl',
    xl: 'text-6xl',
    '2xl': 'text-7xl',
  }[breakpoint],
  subheading: {
    xs: 'text-lg',
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
    '2xl': 'text-5xl',
  }[breakpoint],
  body: {
    xs: 'text-sm',
    sm: 'text-base',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-lg',
    '2xl': 'text-xl',
  }[breakpoint],
});

// Mobile-first responsive classes builder
export const buildResponsiveClasses = (
  classes: Partial<Record<Breakpoint | 'base', string>>
): string => {
  const result: string[] = [];
  
  if (classes.base) result.push(classes.base);
  if (classes.sm) result.push(`sm:${classes.sm}`);
  if (classes.md) result.push(`md:${classes.md}`);
  if (classes.lg) result.push(`lg:${classes.lg}`);
  if (classes.xl) result.push(`xl:${classes.xl}`);
  if (classes['2xl']) result.push(`2xl:${classes['2xl']}`);
  
  return result.join(' ');
};

// Container max-widths for different breakpoints
export const getContainerMaxWidth = (breakpoint: Breakpoint | 'xs') => ({
  xs: 'max-w-full',
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  '2xl': 'max-w-screen-2xl',
}[breakpoint]);

// Optimized animations for different devices
export const getOptimizedAnimations = (isMobile: boolean, reduceMotion: boolean) => {
  if (reduceMotion) {
    return {
      transition: { duration: 0 },
      variants: {
        initial: {},
        animate: {},
        exit: {},
      },
    };
  }

  return {
    transition: {
      duration: isMobile ? 0.2 : 0.3,
      ease: 'easeOut',
    },
    variants: {
      initial: { opacity: 0, y: isMobile ? 10 : 20 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: isMobile ? -10 : -20 },
    },
  };
};

// Safe area insets for mobile devices (iOS notch, etc.)
export const getSafeAreaInsets = () => ({
  top: 'pt-safe-top',
  bottom: 'pb-safe-bottom',
  left: 'pl-safe-left',
  right: 'pr-safe-right',
  all: 'p-safe',
});

// Responsive dashboard layout configurations
export const getDashboardLayout = (breakpoint: Breakpoint | 'xs', isMobile: boolean) => ({
  sidebar: {
    width: isMobile ? 'w-full' : breakpoint === 'xs' ? 'w-64' : 'w-72',
    position: isMobile ? 'fixed' : 'relative',
    height: isMobile ? 'h-full' : 'h-screen',
  },
  content: {
    padding: isMobile ? 'p-4' : 'p-6',
    margin: isMobile ? 'ml-0' : breakpoint === 'xs' ? 'ml-64' : 'ml-72',
  },
  header: {
    height: isMobile ? 'h-14' : 'h-16',
    padding: isMobile ? 'px-4' : 'px-6',
  },
});