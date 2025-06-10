'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';

type Theme = 'theme-98' | 'theme-7';

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  attribute?: string; 
  enableSystem?: boolean; 
}

interface ThemeProviderContextState {
  currentTheme: Theme; 
  selectedTheme: Theme; 
  setTheme: (theme: Theme) => void;
}

const ThemeProviderContext = createContext<ThemeProviderContextState | undefined>(undefined);

const DYNAMIC_THEME_STYLE_ID = 'dynamic-win98-theme-style';

export function ThemeProvider({
  children,
  defaultTheme = 'theme-98',
  storageKey = 'tinchat-theme',
}: ThemeProviderProps) {
  const pathname = usePathname();

  const [userSelectedTheme, setUserSelectedTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
        try {
          const storedTheme = window.localStorage.getItem(storageKey) as Theme | null;
          if (storedTheme && (storedTheme === 'theme-98' || storedTheme === 'theme-7')) {
            return storedTheme;
          }
        } catch (e) {
          console.error("ThemeProvider: Error reading localStorage:", e);
        }
    }
    return defaultTheme;
  });

  const currentAppliedTheme = useMemo(() => {
    return pathname === '/' ? 'theme-98' : userSelectedTheme;
  }, [pathname, userSelectedTheme]);

  // Apply theme classes (CSS is loaded from CDN via layout.tsx)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = window.document.documentElement;
    
    root.classList.add('theme-transitioning');
    
    // Remove existing theme classes
    root.classList.remove('theme-98', 'theme-7');
    
    // Add current theme class
    root.classList.add(currentAppliedTheme);

    // Save user preference to localStorage
    try {
      localStorage.setItem(storageKey, userSelectedTheme);
    } catch (e) {
      console.error("ThemeProvider: Error setting localStorage:", e);
    }

    const timer = setTimeout(() => {
      root.classList.remove('theme-transitioning');
    }, 150); 

    return () => clearTimeout(timer);
  }, [currentAppliedTheme, userSelectedTheme, storageKey]);

  // Force clear sub-themes when on home page
  useEffect(() => {
    if (pathname === '/' && typeof window !== 'undefined') {
      console.log("ThemeProvider: On home page, clearing any sub-themes");
      
      const htmlElement = document.documentElement;
      
      // Remove any existing subtheme classes
      const availableStamps = [
        { cssFile: 'pink-theme.css' },
        { cssFile: 'starpattern-theme.css' },
        { cssFile: 'dark-theme.css' }
      ];
      
      availableStamps.forEach(stamp => {
        if (stamp.cssFile) {
          const existingSubThemeClass = `subtheme-${stamp.cssFile.replace('.css', '')}`;
          if (htmlElement.classList.contains(existingSubThemeClass)) {
            htmlElement.classList.remove(existingSubThemeClass);
            console.log("ThemeProvider: Removed sub-theme class:", existingSubThemeClass);
          }
        }
      });
      
      // Remove sub-theme CSS link
      const link = document.getElementById(DYNAMIC_THEME_STYLE_ID);
      if (link) {
        link.remove();
        console.log("ThemeProvider: Removed sub-theme CSS link");
      }
    }
  }, [pathname]);

  const setThemeCallback = useCallback((newTheme: Theme) => {
    if (newTheme === 'theme-98' || newTheme === 'theme-7') {
      setUserSelectedTheme(newTheme);
    }
  }, []);

  const value = useMemo(() => ({
    currentTheme: currentAppliedTheme,
    selectedTheme: userSelectedTheme,
    setTheme: setThemeCallback,
  }), [currentAppliedTheme, userSelectedTheme, setThemeCallback]);

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = (): ThemeProviderContextState => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};

export type { Theme };