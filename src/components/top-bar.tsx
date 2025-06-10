'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const DYNAMIC_THEME_STYLE_ID = 'dynamic-win98-theme-style';

interface ThemeStamp {
  name: string;
  imageUrl: string;
  cssFile: string | null; // null for reset/default
  dataAiHint: string;
}

const availableStamps: ThemeStamp[] = [
  { name: 'Pink Windows', imageUrl: '/theme_stamps/coquette.png', cssFile: 'pink-theme.css', dataAiHint: 'pink theme stamp' },
  { name: 'Star Pattern', imageUrl: '/theme_stamps/starpattern.png', cssFile: 'starpattern-theme.css', dataAiHint: 'star pattern theme stamp' },
  { name: 'Dark Theme', imageUrl: '/theme_stamps/darktheme.png', cssFile: 'dark-theme.css', dataAiHint: 'dark theme stamp' },
  { name: 'Default 98', imageUrl: 'https://placehold.co/100x75/c0c0c0/000000.png?text=Default', cssFile: null, dataAiHint: 'default theme stamp' },
];

export function TopBar() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [customizerPosition, setCustomizerPosition] = useState({ top: 0, left: 0 });

  const themeIconRef = useRef<HTMLImageElement>(null);
  const customizerWindowRef = useRef<HTMLDivElement>(null);

  const applyWin98SubTheme = useCallback((cssFile: string | null) => {
    if (typeof window === 'undefined') return;
    console.log("TopBar: Applying Win98 sub-theme:", cssFile); 

    const htmlElement = document.documentElement;
    const subThemeClassName = cssFile ? `subtheme-${cssFile.replace('.css', '')}` : null;

    // Remove any existing subtheme classes
    availableStamps.forEach(stamp => {
      if (stamp.cssFile) {
        const existingSubThemeClass = `subtheme-${stamp.cssFile.replace('.css', '')}`;
        if (htmlElement.classList.contains(existingSubThemeClass)) {
          htmlElement.classList.remove(existingSubThemeClass);
          console.log("TopBar: Removed existing sub-theme class:", existingSubThemeClass);
        }
      }
    });

    // Add new subtheme class if applicable
    if (subThemeClassName) {
      htmlElement.classList.add(subThemeClassName);
      console.log("TopBar: Added new sub-theme class:", subThemeClassName);
    }
    
    htmlElement.classList.add('theme-transitioning');
    console.log("TopBar: Added theme-transitioning class for sub-theme.");

    let link = document.getElementById(DYNAMIC_THEME_STYLE_ID) as HTMLLinkElement | null;

    if (cssFile) {
      const newHref = `/win98themes/${cssFile}`;
      if (link) {
        if (link.getAttribute('href') !== newHref) {
            link.href = newHref;
            console.log("TopBar: Updated existing sub-theme CSS link to:", newHref);
        } else {
            console.log("TopBar: Sub-theme CSS link already set to:", newHref);
        }
      } else {
        link = document.createElement('link');
        link.id = DYNAMIC_THEME_STYLE_ID;
        link.rel = 'stylesheet';
        link.href = newHref;
        document.head.appendChild(link);
        console.log("TopBar: Created new sub-theme CSS link:", newHref);
      }
      
      // Only save to localStorage if NOT on home page
      if (pathname !== '/') {
        localStorage.setItem('selectedWin98SubTheme', cssFile);
        console.log("TopBar: Stored sub-theme in localStorage:", cssFile);
      }
    } else {
      if (link) {
        link.remove();
        console.log("TopBar: Removed sub-theme CSS link.");
      }
      
      // Only remove from localStorage if NOT on home page
      if (pathname !== '/') {
        localStorage.removeItem('selectedWin98SubTheme');
        console.log("TopBar: Cleared sub-theme from localStorage.");
      }
    }
    
    setTimeout(() => {
      htmlElement.classList.remove('theme-transitioning');
      console.log("TopBar: Removed theme-transitioning class for sub-theme.");
    }, 150);

  }, [pathname]);

  // Effect to handle home page sub-theme reset
  useEffect(() => {
    if (!mounted) return;
    
    // If we're on the home page, always clear any sub-themes
    if (pathname === '/') {
      console.log("TopBar: On home page, clearing any sub-themes");
      applyWin98SubTheme(null);
    }
    // If we're NOT on home page, apply stored subtheme
    else if (pathname !== '/') {
      const storedSubTheme = localStorage.getItem('selectedWin98SubTheme');
      if (storedSubTheme) {
        console.log("TopBar: Not on home page, applying stored sub-theme:", storedSubTheme);
        applyWin98SubTheme(storedSubTheme);
      }
    }
  }, [pathname, applyWin98SubTheme, mounted]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubThemeSelect = useCallback((cssFile: string | null) => {
    // If on home page, don't allow sub-theme selection (or reset immediately)
    if (pathname === '/') {
      console.log("TopBar: On home page, sub-theme selection ignored");
      return;
    }
    
    applyWin98SubTheme(cssFile);
    setIsCustomizerOpen(false);
  }, [pathname, applyWin98SubTheme]);

  const toggleCustomizer = useCallback(() => {
    if (!themeIconRef.current) return;

    // Don't show customizer on home page
    if (pathname === '/') {
      console.log("TopBar: Customizer disabled on home page");
      return;
    }

    if (!isCustomizerOpen) {
      const iconRect = themeIconRef.current.getBoundingClientRect();
      const windowWidth = 300;
      let leftPosition = iconRect.left + window.scrollX;
      
      if (leftPosition + windowWidth > window.innerWidth) {
        leftPosition = window.innerWidth - windowWidth - 10; 
      }
      if (leftPosition < 10) {
        leftPosition = 10;
      }

      setCustomizerPosition({
        top: iconRect.bottom + window.scrollY + 5,
        left: leftPosition,
      });
    }
    setIsCustomizerOpen(prev => !prev);
  }, [isCustomizerOpen, pathname]);

  useEffect(() => {
    if (!isCustomizerOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        customizerWindowRef.current &&
        !customizerWindowRef.current.contains(event.target as Node) &&
        themeIconRef.current &&
        !themeIconRef.current.contains(event.target as Node)
      ) {
        setIsCustomizerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCustomizerOpen]);

  if (!mounted) {
    return (
      <div className="flex justify-end items-center p-2 space-x-2">
        <span className="mr-2 text-sm">Theme: Windows 98</span>
        {/* Don't show customize icon during loading */}
      </div>
    );
  }

  return (
    <div className="flex justify-end items-center p-2 space-x-2">
      <span className="mr-2 text-sm">Theme: Windows 98</span>

      {/* Only show customize icon if NOT on home page */}
      {pathname !== '/' && (
        <img
          ref={themeIconRef}
          src="/icons/theme.png"
          alt="Customize Theme"
          className="w-5 h-5 cursor-pointer"
          onClick={toggleCustomizer}
          data-ai-hint="theme settings icon"
        />
      )}

      {/* Only show customizer if NOT on home page */}
      {isCustomizerOpen && pathname !== '/' && (
        <div
          ref={customizerWindowRef}
          className="window fixed z-50"
          style={{
            width: '300px',
            maxWidth: '90vw',
            top: `${customizerPosition.top}px`,
            left: `${customizerPosition.left}px`,
            maxHeight: `calc(100vh - ${customizerPosition.top}px - 20px)`,
          }}
        >
          <div className="title-bar">
            <div className="title-bar-text">Customize Theme</div>
            <div className="title-bar-controls">
              <button aria-label="Minimize" disabled></button>
              <button aria-label="Maximize" disabled></button>
              <button aria-label="Close" onClick={() => setIsCustomizerOpen(false)}></button>
            </div>
          </div>
          <div className="window-body p-2" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 80px)' }}>
            <p className="text-xs mb-2">Select a theme stamp:</p>
            <ul className="list-none p-0 m-0">
              {availableStamps.map((stamp) => (
                <li 
                  key={stamp.name} 
                  className="mb-2 p-1 hover:bg-gray-300 cursor-pointer flex items-center" 
                  onClick={() => handleSubThemeSelect(stamp.cssFile)}
                >
                  <img 
                    src={stamp.imageUrl}
                    alt={stamp.name}
                    className="w-16 h-auto mr-2 border border-gray-400"
                    style={{ imageRendering: 'pixelated' }}
                    data-ai-hint={stamp.dataAiHint}
                  />
                  <span className="text-sm">{stamp.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}