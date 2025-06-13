'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';

// Support both Windows 98 and Windows 7 themes
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
const WIN7_CSS_LINK_ID = 'win7-css-link';

export function ThemeProvider({
  children,
  defaultTheme = 'theme-98',
  storageKey = 'tinchat-theme',
}: ThemeProviderProps) {
  const pathname = usePathname();

  // Start with Windows 98 but allow switching to Windows 7
  const [userSelectedTheme, setUserSelectedTheme] = useState<Theme>('theme-98');

  // Load saved theme from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedTheme = localStorage.getItem(storageKey) as Theme;
        if (savedTheme === 'theme-7' || savedTheme === 'theme-98') {
          setUserSelectedTheme(savedTheme);
        }
      } catch (e) {
        console.error("ThemeProvider: Error loading from localStorage:", e);
      }
    }
  }, [storageKey]);

  const currentAppliedTheme = useMemo(() => {
    return userSelectedTheme;
  }, [userSelectedTheme]);

  // Apply theme classes and CSS
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = window.document.documentElement;
    
    root.classList.add('theme-transitioning');
    
    // Remove any existing theme classes
    root.classList.remove('theme-98', 'theme-7');
    
    // Add current theme class
    root.classList.add(currentAppliedTheme);

    // Handle Windows 7 CSS loading
    let win7Link = document.getElementById(WIN7_CSS_LINK_ID) as HTMLLinkElement | null;
    
    if (currentAppliedTheme === 'theme-7') {
      // Load Windows 7 CSS
      if (!win7Link) {
        win7Link = document.createElement('link');
        win7Link.id = WIN7_CSS_LINK_ID;
        win7Link.rel = 'stylesheet';
        win7Link.href = 'https://unpkg.com/7.css';
        document.head.appendChild(win7Link);
        console.log("ThemeProvider: Loaded Windows 7 CSS");
      }
    } else {
      // Remove Windows 7 CSS if present
      if (win7Link) {
        win7Link.remove();
        console.log("ThemeProvider: Removed Windows 7 CSS");
      }
    }

    // Save preference to localStorage
    try {
      localStorage.setItem(storageKey, currentAppliedTheme);
    } catch (e) {
      console.error("ThemeProvider: Error setting localStorage:", e);
    }

    const timer = setTimeout(() => {
      root.classList.remove('theme-transitioning');
    }, 150); 

    return () => clearTimeout(timer);
  }, [currentAppliedTheme, storageKey]);

  // Force clear sub-themes when on home page
  useEffect(() => {
    if (pathname === '/' && typeof window !== 'undefined') {
      console.log("ThemeProvider: On home page, clearing any sub-themes");
      
      const htmlElement = document.documentElement;
      
      // Remove any existing subtheme classes (both 98 and 7)
      const available98Stamps = [
        { cssFile: 'pink-theme.css' },
        { cssFile: 'starpattern-theme.css' },
        { cssFile: 'dark-theme.css' },
        { cssFile: '666-theme.css' }
      ];
      
      const available7Stamps = [
        { cssFile: 'frutiger1-theme.css' }
      ];
      
      [...available98Stamps, ...available7Stamps].forEach(stamp => {
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
    setUserSelectedTheme(newTheme);
  }, []);

  const value = useMemo(() => ({
    currentTheme: currentAppliedTheme,
    selectedTheme: currentAppliedTheme,
    setTheme: setThemeCallback,
  }), [currentAppliedTheme, setThemeCallback]);

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