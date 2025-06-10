'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';

// Only Windows 98 theme now
type Theme = 'theme-98';

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
  defaultTheme = 'theme-98', // Always default to Windows 98
  storageKey = 'tinchat-theme',
}: ThemeProviderProps) {
  const pathname = usePathname();

  // Always use Windows 98 theme
  const [userSelectedTheme, setUserSelectedTheme] = useState<Theme>('theme-98');

  // Always apply Windows 98 theme
  const currentAppliedTheme = useMemo(() => {
    return 'theme-98'; // Force Windows 98 everywhere
  }, []);

  // Apply theme classes (Windows 98 only)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = window.document.documentElement;
    
    root.classList.add('theme-transitioning');
    
    // Remove any existing theme classes
    root.classList.remove('theme-98', 'theme-7');
    
    // Always add Windows 98 theme
    root.classList.add('theme-98');

    // Save preference to localStorage (always Windows 98)
    try {
      localStorage.setItem(storageKey, 'theme-98');
    } catch (e) {
      console.error("ThemeProvider: Error setting localStorage:", e);
    }

    const timer = setTimeout(() => {
      root.classList.remove('theme-transitioning');
    }, 150); 

    return () => clearTimeout(timer);
  }, [storageKey]);

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
    // Only allow Windows 98 theme
    if (newTheme === 'theme-98') {
      setUserSelectedTheme(newTheme);
    }
  }, []);

  const value = useMemo(() => ({
    currentTheme: 'theme-98' as Theme, // Always Windows 98
    selectedTheme: 'theme-98' as Theme, // Always Windows 98
    setTheme: setThemeCallback,
  }), [setThemeCallback]);

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