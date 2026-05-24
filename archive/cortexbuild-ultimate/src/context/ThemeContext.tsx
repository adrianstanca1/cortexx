/**
 * CortexBuild Ultimate — Theme Context
 * Supports all DaisyUI themes with localStorage persistence
 */
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

type Theme = 'dark' | 'light' | 'system' | 'cortexbuild' | 'cortex-light' | 'corporate' | 'synthwave' | 'cyberpunk' | 'dracula' | 'nord' | 'sunset' | 'ocean';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: string; // This will be the actual theme name applied to data-theme
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'cortexbuild-theme';

// Define which themes are considered "dark" for the isDark flag
const DARK_THEMES = new Set([
  'dark',
  'cortexbuild',
  'corporate',
  'synthwave',
  'cyberpunk',
  'dracula',
  'nord',
  'ocean'
]);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? (saved as Theme) : 'cortexbuild'; // Default to our custom theme
    }
    return 'cortexbuild';
  });
  
  const [resolvedTheme, setResolvedTheme] = useState<string>('cortexbuild');

  const resolveTheme = useCallback((t: Theme): string => {
    if (t === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return t; // For all other themes, return the theme name directly
  }, []);

  const applyTheme = useCallback((themeName: string) => {
    const root = document.documentElement;
    // Remove all theme attributes first
    root.removeAttribute('data-theme');
    // Apply the selected theme
    root.setAttribute('data-theme', themeName);
    setResolvedTheme(themeName);
  }, []);

  useEffect(() => {
    const resolved = resolveTheme(theme);
    // Use Promise.resolve().then() to defer state update and avoid synchronous setState in effect
    Promise.resolve().then(() => {
      applyTheme(resolved);
    });

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        const newResolved = resolveTheme('system');
        // Also defer this update
        Promise.resolve().then(() => {
          applyTheme(newResolved);
        });
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, resolveTheme, applyTheme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
  }, []);

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      setTheme, 
      resolvedTheme, 
      isDark: DARK_THEMES.has(resolvedTheme as Theme)
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
