import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { api } from '../lib/api';

// Ensure React is properly loaded
if (!React || typeof React !== 'object') {
  throw new Error('React is not properly imported in ThemeContext');
}

// Ensure React hooks are available
if (!useState || !useContext || !useCallback || !useEffect) {
  throw new Error('React hooks are not available in ThemeContext');
}

export type ThemeMode = 'dark' | 'gray' | 'light' | 'custom';

export interface CustomThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
}

interface ThemeContextType {
  theme: ThemeMode;
  customColors: CustomThemeColors;
  setTheme: (theme: ThemeMode) => Promise<void>;
  setCustomColors: (colors: Partial<CustomThemeColors>) => Promise<void>;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'theme_preference';
const CUSTOM_COLORS_STORAGE_KEY = 'theme_custom_colors';

// Default custom theme colors (based on current dark theme)
const DEFAULT_CUSTOM_COLORS: CustomThemeColors = {
  background: 'oklch(0.12 0.01 240)',
  foreground: 'oklch(0.98 0.01 240)',
  card: 'oklch(0.14 0.01 240)',
  cardForeground: 'oklch(0.98 0.01 240)',
  primary: 'oklch(0.98 0.01 240)',
  primaryForeground: 'oklch(0.12 0.01 240)',
  secondary: 'oklch(0.16 0.01 240)',
  secondaryForeground: 'oklch(0.98 0.01 240)',
  muted: 'oklch(0.16 0.01 240)',
  mutedForeground: 'oklch(0.65 0.01 240)',
  accent: 'oklch(0.16 0.01 240)',
  accentForeground: 'oklch(0.98 0.01 240)',
  destructive: 'oklch(0.6 0.2 25)',
  destructiveForeground: 'oklch(0.98 0.01 240)',
  border: 'oklch(0.16 0.01 240)',
  input: 'oklch(0.16 0.01 240)',
  ring: 'oklch(0.98 0.01 240)',
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Extra defensive checks for React hooks availability
  if (!React) {
    console.error('ThemeProvider: React is null or undefined');
    return <div data-error="react-null">{children}</div>;
  }
  
  if (typeof React.useState !== 'function') {
    console.error('ThemeProvider: React.useState is not available');
    return <div data-error="react-hooks-unavailable">{children}</div>;
  }

  const [theme, setThemeState] = React.useState<ThemeMode>('dark');
  const [customColors, setCustomColorsState] = React.useState<CustomThemeColors>(DEFAULT_CUSTOM_COLORS);
  const [isLoading, setIsLoading] = React.useState(true);

  // Load theme preference and custom colors from storage
  React.useEffect(() => {
    const loadTheme = async () => {
      try {
        // Load theme preference
        const savedTheme = await api.getSetting(THEME_STORAGE_KEY);
        
        if (savedTheme) {
          const themeMode = savedTheme as ThemeMode;
          setThemeState(themeMode);
          
          // Load custom colors first before applying theme
          const savedColors = await api.getSetting(CUSTOM_COLORS_STORAGE_KEY);
          let colors = customColors;
          
          if (savedColors) {
            try {
              colors = JSON.parse(savedColors) as CustomThemeColors;
              setCustomColorsState(colors);
            } catch (error) {
              console.error('Failed to parse saved theme colors:', error);
              // Use default colors if parsing fails
              colors = DEFAULT_CUSTOM_COLORS;
            }
          }
          
          // Apply theme with correct colors
          applyTheme(themeMode, colors);
        } else {
          // Load custom colors even if no theme is saved
          const savedColors = await api.getSetting(CUSTOM_COLORS_STORAGE_KEY);
          
          if (savedColors) {
            try {
              const colors = JSON.parse(savedColors) as CustomThemeColors;
              setCustomColorsState(colors);
            } catch (error) {
              console.error('Failed to parse saved theme colors:', error);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load theme settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTheme();
  }, []);

  // Apply theme to document
  const applyTheme = React.useCallback((themeMode: ThemeMode, colors: CustomThemeColors) => {
    const root = document.documentElement;
    
    // Remove all theme classes
    root.classList.remove('theme-dark', 'theme-gray', 'theme-light', 'theme-custom');
    
    // Add new theme class
    root.classList.add(`theme-${themeMode}`);
    
    // If custom theme, apply custom colors as CSS variables
    if (themeMode === 'custom') {
      Object.entries(colors).forEach(([key, value]) => {
        const cssVarName = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        root.style.setProperty(cssVarName, value);
      });
    } else {
      // Clear custom CSS variables when not using custom theme
      Object.keys(colors).forEach((key) => {
        const cssVarName = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        root.style.removeProperty(cssVarName);
      });
    }
  }, []);

  const setTheme = React.useCallback(async (newTheme: ThemeMode) => {
    try {
      setIsLoading(true);
      
      // Apply theme immediately
      setThemeState(newTheme);
      applyTheme(newTheme, customColors);
      
      // Save to storage
      await api.saveSetting(THEME_STORAGE_KEY, newTheme);
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    } finally {
      setIsLoading(false);
    }
  }, [customColors, applyTheme]);

  const setCustomColors = React.useCallback(async (colors: Partial<CustomThemeColors>) => {
    try {
      setIsLoading(true);
      
      const newColors = { ...customColors, ...colors };
      setCustomColorsState(newColors);
      
      // Apply immediately if custom theme is active
      if (theme === 'custom') {
        applyTheme('custom', newColors);
      }
      
      // Save to storage
      await api.saveSetting(CUSTOM_COLORS_STORAGE_KEY, JSON.stringify(newColors));
    } catch (error) {
      console.error('Failed to save custom colors:', error);
    } finally {
      setIsLoading(false);
    }
  }, [theme, customColors, applyTheme]);

  const value: ThemeContextType = {
    theme,
    customColors,
    setTheme,
    setCustomColors,
    isLoading,
  };

  // Wrap with error boundary protection
  try {
    return (
      <ThemeContext.Provider value={value}>
        {children}
      </ThemeContext.Provider>
    );
  } catch (error) {
    console.error('Error in ThemeProvider render:', error);
    // Return children without theme context if there's an error
    return <div data-error="theme-provider-error">{children}</div>;
  }
};

export const useThemeContext = () => {
  // Ensure React hooks are available
  if (!React || typeof React.useContext !== 'function') {
    console.error('useThemeContext: React.useContext is not available. React may not be properly initialized.');
    // Return emergency fallback
    return {
      theme: 'dark' as ThemeMode,
      customColors: DEFAULT_CUSTOM_COLORS,
      setTheme: async (theme: ThemeMode) => {
        console.warn(`[Theme Emergency Fallback] setTheme called with: ${theme}`);
      },
      setCustomColors: async (_colors: Partial<CustomThemeColors>) => {
        console.warn('[Theme Emergency Fallback] setCustomColors called');
      },
      isLoading: false,
    } as ThemeContextType;
  }

  const context = React.useContext(ThemeContext);
  if (!context) {
    // Provide fallback to prevent React Error #130 in production
    console.warn('useThemeContext called outside ThemeProvider, providing fallback');
    return {
      theme: 'dark' as ThemeMode,
      customColors: DEFAULT_CUSTOM_COLORS,
      setTheme: async (theme: ThemeMode) => {
        console.warn(`[Theme Fallback] setTheme called with: ${theme}`);
      },
      setCustomColors: async (_colors: Partial<CustomThemeColors>) => {
        console.warn('[Theme Fallback] setCustomColors called');
      },
      isLoading: false,
    } as ThemeContextType;
  }
  return context;
};