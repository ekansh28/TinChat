'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const DYNAMIC_THEME_STYLE_ID = 'dynamic-win98-theme-style';
const WIN7_CSS_LINK_ID = 'win7-css-link';

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
  { name: '666', imageUrl: '/theme_stamps/666.png', cssFile: '666-theme.css', dataAiHint: '666 theme stamp' },
  { name: 'Default 98', imageUrl: 'https://placehold.co/100x75/c0c0c0/000000.png?text=Default', cssFile: null, dataAiHint: 'default theme stamp' },
];

const available7Stamps: ThemeStamp[] = [
  { name: 'Frutiger Aero', imageUrl: '/theme_stamps/frutiger.png', cssFile: 'frutiger1-theme.css', dataAiHint: 'frutiger theme stamp' },
  { name: 'Frutiger Aero 2', imageUrl: '/theme_stamps/frutiger2.png', cssFile: 'frutiger2-theme.css', dataAiHint: 'frutiger2 theme stamp' },
  { name: 'Frutiger Aero 3', imageUrl: '/theme_stamps/frutiger3.png', cssFile: 'frutiger3-theme.css', dataAiHint: 'frutiger3 theme stamp' },
  { name: 'Vector Bloom', imageUrl: '/theme_stamps/vectorbloom.png', cssFile: 'vectorbloom-theme.css', dataAiHint: 'vectorbloom theme stamp' },
  { name: 'Vector Bloom 2', imageUrl: '/theme_stamps/vectorbloom2.png', cssFile: 'vectorbloom2-theme.css', dataAiHint: 'vectorbloom2 theme stamp' },
  { name: 'Vector Bloom 3', imageUrl: '/theme_stamps/vectorbloom3.png', cssFile: 'vectorbloom3-theme.css', dataAiHint: 'vectorbloom3 theme stamp' },
  { name: 'Vector Bloom 4', imageUrl: '/theme_stamps/modern.png', cssFile: 'modern-theme.css', dataAiHint: 'modern theme stamp' },
  { name: 'Default 7', imageUrl: 'https://placehold.co/100x75/0078d4/ffffff.png?text=Default', cssFile: null, dataAiHint: 'default win7 theme stamp' },
];

export function TopBar() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [customizerPosition, setCustomizerPosition] = useState({ top: 0, left: 0 });
  const [isWin7Mode, setIsWin7Mode] = useState(false);

  const themeIconRef = useRef<HTMLImageElement>(null);
  const customizerWindowRef = useRef<HTMLDivElement>(null);

  const currentStamps = isWin7Mode ? available7Stamps : availableStamps;

  const applySubTheme = useCallback((cssFile: string | null, forceWin7Mode?: boolean) => {
    if (typeof window === 'undefined') return;
    
    // Use the forced mode if provided, otherwise use current state
    const currentWin7Mode = forceWin7Mode !== undefined ? forceWin7Mode : isWin7Mode;
    console.log("TopBar: Applying sub-theme:", cssFile, "Win7 mode:", currentWin7Mode); 

    const htmlElement = document.documentElement;
    const subThemeClassName = cssFile ? `subtheme-${cssFile.replace('.css', '')}` : null;

    // Remove any existing subtheme classes from both 98 and 7
    [...availableStamps, ...available7Stamps].forEach(stamp => {
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
      const folderPrefix = currentWin7Mode ? 'win7themes' : 'win98themes';
      const newHref = `/${folderPrefix}/${cssFile}`;
      
      console.log("TopBar: Building CSS path:", { cssFile, currentWin7Mode, folderPrefix, newHref });
      
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
        const storageKey = currentWin7Mode ? 'selectedWin7SubTheme' : 'selectedWin98SubTheme';
        localStorage.setItem(storageKey, cssFile);
        console.log("TopBar: Stored sub-theme in localStorage:", storageKey, cssFile);
      }
    } else {
      if (link) {
        link.remove();
        console.log("TopBar: Removed sub-theme CSS link.");
      }
      
      // Only remove from localStorage if NOT on home page
      if (pathname !== '/') {
        const storageKey = currentWin7Mode ? 'selectedWin7SubTheme' : 'selectedWin98SubTheme';
        localStorage.removeItem(storageKey);
        console.log("TopBar: Cleared sub-theme from localStorage:", storageKey);
      }
    }
    
    setTimeout(() => {
      htmlElement.classList.remove('theme-transitioning');
      console.log("TopBar: Removed theme-transitioning class for sub-theme.");
    }, 150);
  }, [pathname, isWin7Mode]);

  const loadWin7CSS = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    let win7Link = document.getElementById(WIN7_CSS_LINK_ID) as HTMLLinkElement | null;
    
    if (!win7Link) {
      win7Link = document.createElement('link');
      win7Link.id = WIN7_CSS_LINK_ID;
      win7Link.rel = 'stylesheet';
      win7Link.href = 'https://unpkg.com/7.css';
      document.head.appendChild(win7Link);
      console.log("TopBar: Loading Windows 7 CSS");
    }
  }, []);

  const removeWin7CSS = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    const win7Link = document.getElementById(WIN7_CSS_LINK_ID);
    if (win7Link) {
      win7Link.remove();
      console.log("TopBar: Removed Windows 7 CSS");
    }
  }, []);

  // Calculate position for customizer with enhanced viewport detection
  const calculateCustomizerPosition = useCallback(() => {
    if (!themeIconRef.current) return { top: 0, left: 0 };

    const iconRect = themeIconRef.current.getBoundingClientRect();
    const windowWidth = 300;
    const windowHeight = 400;
    const margin = 20;
    
    // Get current viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    console.log("TopBar: Calculating position with viewport:", { viewportWidth, viewportHeight });

    let left = iconRect.left + window.scrollX;
    let top = iconRect.bottom + window.scrollY + 10;

    // Adjust if window would go off right side
    if (left + windowWidth > viewportWidth - margin) {
      left = viewportWidth - windowWidth - margin;
    }

    // Adjust if window would go off left side
    if (left < margin) {
      left = margin;
    }

    // Adjust if window would go off bottom - be more aggressive for small viewports
    const availableHeight = viewportHeight - (iconRect.bottom - window.scrollY) - margin;
    
    if (windowHeight > availableHeight) {
      // Not enough space below, try above the icon
      const spaceAbove = iconRect.top + window.scrollY - window.scrollY - margin;
      
      if (windowHeight <= spaceAbove) {
        // Fit above the icon
        top = iconRect.top + window.scrollY - windowHeight - 10;
      } else {
        // Can't fit above either, position at top of viewport with reduced height
        top = window.scrollY + margin;
      }
    }

    // Final bounds checking
    if (top < window.scrollY + margin) {
      top = window.scrollY + margin;
    }
    
    if (top + windowHeight > window.scrollY + viewportHeight - margin) {
      top = window.scrollY + viewportHeight - windowHeight - margin;
    }

    console.log("TopBar: Calculated position:", { top, left, iconRect, viewportHeight, windowHeight });

    return { top, left };
  }, []);

  const handleMaximize = useCallback(() => {
    if (!isWin7Mode) {
      console.log("TopBar: Switching to Windows 7 mode");
      
      // Close customizer temporarily
      const wasCustomizerOpen = isCustomizerOpen;
      setIsCustomizerOpen(false);
      
      // Switch to Windows 7 mode and load CSS
      setIsWin7Mode(true);
      loadWin7CSS();
      
      // Reopen customizer after CSS loads
      if (wasCustomizerOpen) {
        setTimeout(() => {
          setIsCustomizerOpen(true);
          setCustomizerPosition(calculateCustomizerPosition());
        }, 300);
      }
      
      // Apply stored Win7 sub-theme with explicit Win7 mode
      setTimeout(() => {
        const storedWin7SubTheme = localStorage.getItem('selectedWin7SubTheme');
        if (storedWin7SubTheme) {
          applySubTheme(storedWin7SubTheme, true); // Force Win7 mode
        } else {
          applySubTheme(null, true); // Force Win7 mode
        }
      }, 400);
    }
  }, [isWin7Mode, isCustomizerOpen, loadWin7CSS, applySubTheme, calculateCustomizerPosition]);

  const handleMinimize = useCallback(() => {
    if (isWin7Mode) {
      console.log("TopBar: Switching to Windows 98 mode");
      
      // Close customizer temporarily
      const wasCustomizerOpen = isCustomizerOpen;
      setIsCustomizerOpen(false);
      
      // Switch to Windows 98 mode and remove CSS
      setIsWin7Mode(false);
      removeWin7CSS();
      
      // Reopen customizer after CSS is removed
      if (wasCustomizerOpen) {
        setTimeout(() => {
          setIsCustomizerOpen(true);
          setCustomizerPosition(calculateCustomizerPosition());
        }, 200);
      }
      
      // Apply stored Win98 sub-theme with explicit Win98 mode
      const storedWin98SubTheme = localStorage.getItem('selectedWin98SubTheme');
      if (storedWin98SubTheme) {
        applySubTheme(storedWin98SubTheme, false); // Force Win98 mode
      } else {
        applySubTheme(null, false); // Force Win98 mode
      }
    }
  }, [isWin7Mode, isCustomizerOpen, removeWin7CSS, applySubTheme, calculateCustomizerPosition]);

  // Effect to handle home page sub-theme reset
  useEffect(() => {
    if (!mounted) return;
    
    if (pathname === '/') {
      console.log("TopBar: On home page, clearing any sub-themes and resetting to Win98");
      setIsWin7Mode(false);
      removeWin7CSS();
      applySubTheme(null, false);
    } else {
      const storedSubTheme = isWin7Mode 
        ? localStorage.getItem('selectedWin7SubTheme')
        : localStorage.getItem('selectedWin98SubTheme');
      
      if (storedSubTheme) {
        console.log("TopBar: Not on home page, applying stored sub-theme:", storedSubTheme);
        applySubTheme(storedSubTheme);
      }
    }
  }, [pathname, applySubTheme, mounted, isWin7Mode, removeWin7CSS]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubThemeSelect = useCallback((cssFile: string | null) => {
    if (pathname === '/') {
      console.log("TopBar: On home page, sub-theme selection ignored");
      return;
    }
    
    applySubTheme(cssFile);
    setIsCustomizerOpen(false);
  }, [pathname, applySubTheme]);

  const toggleCustomizer = useCallback(() => {
    if (!themeIconRef.current || pathname === '/') {
      console.log("TopBar: Customizer disabled on home page");
      return;
    }

    if (!isCustomizerOpen) {
      setCustomizerPosition(calculateCustomizerPosition());
    }
    setIsCustomizerOpen(prev => !prev);
  }, [isCustomizerOpen, pathname, calculateCustomizerPosition]);

  // Handle clicks outside customizer and viewport changes
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

    const handleResize = () => {
      console.log("TopBar: Viewport changed, repositioning customizer");
      // Recalculate position when viewport changes (dev tools open/close, window resize)
      setCustomizerPosition(calculateCustomizerPosition());
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isCustomizerOpen) {
        // Reposition when tab becomes visible again
        setTimeout(() => {
          setCustomizerPosition(calculateCustomizerPosition());
        }, 100);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also listen for dev tools specific events
    const mediaQuery = window.matchMedia('(max-height: 600px)');
    const handleMediaChange = () => {
      console.log("TopBar: Media query changed, repositioning customizer");
      setCustomizerPosition(calculateCustomizerPosition());
    };
    
    mediaQuery.addListener(handleMediaChange);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      mediaQuery.removeListener(handleMediaChange);
    };
  }, [isCustomizerOpen, calculateCustomizerPosition]);

  if (!mounted) {
    return (
      <div className="flex justify-end items-center p-2 space-x-2">
        <span className="mr-2 text-sm"></span>
      </div>
    );
  }

  return (
    <div className="flex justify-end items-center p-2 space-x-2">
      <span className="mr-2 text-sm"></span>

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

      {isCustomizerOpen && pathname !== '/' && (
        <div
          ref={customizerWindowRef}
          className={cn(
            "window fixed",
            isWin7Mode && "glass active"
          )}
          style={{
            position: 'fixed',
            zIndex: 999999,
            top: `${customizerPosition.top}px`,
            left: `${customizerPosition.left}px`,
            width: '300px',
            maxWidth: 'calc(100vw - 40px)', // Ensure it never exceeds viewport width
            height: '400px',
            maxHeight: 'calc(100vh - 40px)', // Ensure it never exceeds viewport height
            // Consistent styling without !important
            display: 'block',
            visibility: 'visible',
            opacity: 1,
            // Prevent the window from being clipped
            overflow: 'visible',
            // Windows 7 specific styling
            ...(isWin7Mode && {
              background: 'rgba(240, 240, 240, 0.95)',
              border: '1px solid #999',
              borderRadius: '8px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(10px)'
            })
          }}
        >
          <div 
            className="title-bar"
            style={{
              ...(isWin7Mode && {
                background: 'linear-gradient(to bottom, rgba(255,255,255,0.9), rgba(230,230,230,0.9))',
                borderBottom: '1px solid #ccc',
                borderTopLeftRadius: '7px',
                borderTopRightRadius: '7px'
              })
            }}
          >
            <div className="title-bar-text" style={isWin7Mode ? { color: '#333' } : {}}>
              Customize Theme - {isWin7Mode ? 'Windows 7' : 'Windows 98'}
            </div>
            <div className="title-bar-controls">
              <button 
                aria-label="Switch to Windows 98" 
                onClick={handleMinimize}
                title="Switch to Windows 98 theme"
              ></button>
              <button 
                aria-label="Switch to Windows 7" 
                onClick={handleMaximize}
                title="Switch to Windows 7 theme"
              ></button>
              <button 
                aria-label="Close" 
                onClick={() => setIsCustomizerOpen(false)}
              ></button>
            </div>
          </div>
          <div 
            className={cn(
              "window-body p-2",
              isWin7Mode && "has-space"
            )} 
            style={{ 
              overflowY: 'auto', 
              height: 'calc(100% - 32px)',
              // Ensure scrollable content doesn't break out of bounds
              maxHeight: 'calc(100vh - 72px)', // Account for title bar + margins
              // Windows 7 specific body styling
              ...(isWin7Mode && {
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(5px)',
                color: '#333',
                borderBottomLeftRadius: '7px',
                borderBottomRightRadius: '7px'
              })
            }}
          >
            <p className="text-xs mb-2" style={isWin7Mode ? { color: '#333' } : {}}>
              Select a theme stamp for {isWin7Mode ? 'Windows 7' : 'Windows 98'}:
            </p>
            <p className="text-xs mb-3 text-gray-600" style={isWin7Mode ? { color: '#666' } : {}}>
              Use minimize (←) for Win98 themes, maximize (→) for Win7 themes
            </p>
            <ul className="list-none p-0 m-0">
              {currentStamps.map((stamp) => (
                <li 
                  key={stamp.name} 
                  className={cn(
                    "mb-2 p-1 cursor-pointer flex items-center transition-colors",
                    isWin7Mode 
                      ? "hover:bg-white hover:bg-opacity-60 rounded" 
                      : "hover:bg-gray-300"
                  )}
                  onClick={() => handleSubThemeSelect(stamp.cssFile)}
                >
                  <img 
                    src={stamp.imageUrl}
                    alt={stamp.name}
                    className="w-16 h-auto mr-2 border border-gray-400"
                    style={{ imageRendering: 'pixelated' }}
                    data-ai-hint={stamp.dataAiHint}
                  />
                  <span className="text-sm" style={isWin7Mode ? { color: '#333' } : {}}>
                    {stamp.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}