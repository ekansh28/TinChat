'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const DYNAMIC_THEME_STYLE_ID = 'dynamic-win98-theme-style';
const WIN7_CSS_LINK_ID = 'win7-css-link';

interface ThemeStamp {
  name: string;
  imageUrl: string;
  cssFile: string | null;
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
  { name: 'idk', imageUrl: '/theme_stamps/beautiful.png', cssFile: 'beautiful-theme.css', dataAiHint: 'beautiful theme stamp' },
  { name: 'PS3', imageUrl: '/theme_stamps/ps3.png', cssFile: 'ps3-theme.css', dataAiHint: 'ps3 theme stamp' },
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

  // Helper function for title button styles
  const getTitleButtonStyle = useCallback((isWin7: boolean, isClose = false) => {
    const baseStyle = {
      width: '18px',
      height: '18px',
      minWidth: '18px',
      minHeight: '18px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '10px',
      fontWeight: 'bold' as const,
      padding: '0',
      margin: '0',
      cursor: 'pointer',
      transition: 'all 0.1s ease',
      userSelect: 'none' as const,
    };

    if (isWin7) {
      return {
        ...baseStyle,
        backgroundColor: isClose ? '#ff6b6b' : '#f0f0f0',
        border: '1px solid #999',
        borderRadius: '3px',
        '&:hover': {
          backgroundColor: isClose ? '#ff5252' : '#e0e0e0'
        }
      };
    } else {
      return {
        ...baseStyle,
        backgroundColor: '#c0c0c0',
        border: '1px outset #c0c0c0',
        '&:active': {
          borderStyle: 'inset'
        }
      };
    }
  }, []);

  const applySubTheme = useCallback((cssFile: string | null, forceWin7Mode?: boolean) => {
    if (typeof window === 'undefined') return;
    
    const currentWin7Mode = forceWin7Mode !== undefined ? forceWin7Mode : isWin7Mode;
    const htmlElement = document.documentElement;
    const subThemeClassName = cssFile ? `subtheme-${cssFile.replace('.css', '')}` : null;

    [...availableStamps, ...available7Stamps].forEach(stamp => {
      if (stamp.cssFile) {
        const existingSubThemeClass = `subtheme-${stamp.cssFile.replace('.css', '')}`;
        htmlElement.classList.remove(existingSubThemeClass);
      }
    });

    if (subThemeClassName) {
      htmlElement.classList.add(subThemeClassName);
    }
    
    htmlElement.classList.add('theme-transitioning');

    let link = document.getElementById(DYNAMIC_THEME_STYLE_ID) as HTMLLinkElement | null;

    if (cssFile) {
      const folderPrefix = currentWin7Mode ? 'win7themes' : 'win98themes';
      const newHref = `/${folderPrefix}/${cssFile}`;
      
      if (link) {
        if (link.getAttribute('href') !== newHref) {
          link.href = newHref;
        }
      } else {
        link = document.createElement('link');
        link.id = DYNAMIC_THEME_STYLE_ID;
        link.rel = 'stylesheet';
        link.href = newHref;
        document.head.appendChild(link);
      }
      
      if (pathname !== '/') {
        const storageKey = currentWin7Mode ? 'selectedWin7SubTheme' : 'selectedWin98SubTheme';
        localStorage.setItem(storageKey, cssFile);
      }
    } else {
      if (link) {
        link.remove();
      }
      
      if (pathname !== '/') {
        const storageKey = currentWin7Mode ? 'selectedWin7SubTheme' : 'selectedWin98SubTheme';
        localStorage.removeItem(storageKey);
      }
    }
    
    setTimeout(() => {
      htmlElement.classList.remove('theme-transitioning');
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
    }
  }, []);

  const removeWin7CSS = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    const win7Link = document.getElementById(WIN7_CSS_LINK_ID);
    if (win7Link) win7Link.remove();
  }, []);

  const calculateCustomizerPosition = useCallback(() => {
    const fallbackPosition = { top: 60, left: 20 };

    if (!themeIconRef.current) return fallbackPosition;

    try {
      const iconRect = themeIconRef.current.getBoundingClientRect();
      const windowWidth = 300;
      const windowHeight = Math.min(400, window.innerHeight * 0.8); // Ensure it fits viewport
      const margin = 20;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let left = iconRect.left - windowWidth - 10;
      let top = iconRect.top;

      if (left < margin) {
        left = iconRect.right + 10;
        if (left + windowWidth > viewportWidth - margin) {
          left = Math.max(margin, (viewportWidth - windowWidth) / 2);
        }
      }

      if (left + windowWidth > viewportWidth - margin) {
        left = viewportWidth - windowWidth - margin;
      }

      if (left < margin) {
        left = margin;
      }

      top = iconRect.bottom + 10;

      if (top + windowHeight > viewportHeight - margin) {
        top = iconRect.top - windowHeight - 10;
        if (top < margin) {
          top = margin;
        }
      }

      top = Math.max(margin, Math.min(top, viewportHeight - windowHeight - margin));
      left = Math.max(margin, Math.min(left, viewportWidth - windowWidth - margin));

      return { top, left };
    } catch (error) {
      return fallbackPosition;
    }
  }, []);

  const handleMaximize = useCallback(() => {
    if (!isWin7Mode) {
      const wasCustomizerOpen = isCustomizerOpen;
      setIsCustomizerOpen(false);
      setIsWin7Mode(true);
      loadWin7CSS();
      
      if (wasCustomizerOpen) {
        setTimeout(() => {
          setIsCustomizerOpen(true);
          setCustomizerPosition(calculateCustomizerPosition());
        }, 300);
      }
      
      setTimeout(() => {
        const storedWin7SubTheme = localStorage.getItem('selectedWin7SubTheme');
        applySubTheme(storedWin7SubTheme || null, true);
      }, 400);
    }
  }, [isWin7Mode, isCustomizerOpen, loadWin7CSS, applySubTheme, calculateCustomizerPosition]);

  const handleMinimize = useCallback(() => {
    if (isWin7Mode) {
      const wasCustomizerOpen = isCustomizerOpen;
      setIsCustomizerOpen(false);
      setIsWin7Mode(false);
      removeWin7CSS();
      
      if (wasCustomizerOpen) {
        setTimeout(() => {
          setIsCustomizerOpen(true);
          setCustomizerPosition(calculateCustomizerPosition());
        }, 200);
      }
      
      const storedWin98SubTheme = localStorage.getItem('selectedWin98SubTheme');
      applySubTheme(storedWin98SubTheme || null, false);
    }
  }, [isWin7Mode, isCustomizerOpen, removeWin7CSS, applySubTheme, calculateCustomizerPosition]);

  useEffect(() => {
    if (!mounted) return;
    
    if (pathname === '/') {
      setIsWin7Mode(false);
      removeWin7CSS();
      applySubTheme(null, false);
    } else {
      const storedSubTheme = isWin7Mode 
        ? localStorage.getItem('selectedWin7SubTheme')
        : localStorage.getItem('selectedWin98SubTheme');
      
      if (storedSubTheme) {
        applySubTheme(storedSubTheme);
      }
    }
  }, [pathname, applySubTheme, mounted, isWin7Mode, removeWin7CSS]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubThemeSelect = useCallback((cssFile: string | null) => {
    if (pathname === '/') return;
    applySubTheme(cssFile);
    setIsCustomizerOpen(false);
  }, [pathname, applySubTheme]);

  const toggleCustomizer = useCallback(() => {
    if (!themeIconRef.current || pathname === '/') return;

    if (!isCustomizerOpen) {
      void themeIconRef.current.offsetHeight;
      const newPosition = calculateCustomizerPosition();
      setCustomizerPosition(newPosition);
      
      requestAnimationFrame(() => {
        const updatedPosition = calculateCustomizerPosition();
        if (JSON.stringify(updatedPosition) !== JSON.stringify(newPosition)) {
          setCustomizerPosition(updatedPosition);
        }
      });
    }
    
    setIsCustomizerOpen(prev => !prev);
  }, [isCustomizerOpen, pathname, calculateCustomizerPosition]);

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
      setCustomizerPosition(calculateCustomizerPosition());
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleResize);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleResize);
    };
  }, [isCustomizerOpen, calculateCustomizerPosition]);

  // Force visibility updates
  useEffect(() => {
    if (!isCustomizerOpen || !customizerWindowRef.current) return;

    const forceVisibility = () => {
      const el = customizerWindowRef.current;
      if (el) {
        el.style.display = 'block';
        el.style.visibility = 'visible';
        el.style.opacity = '1';
      }
    };

    forceVisibility();
    const interval = setInterval(forceVisibility, 1000);
    return () => clearInterval(interval);
  }, [isCustomizerOpen]);

  if (!mounted) {
    return <div className="flex justify-end items-center p-2 space-x-2" />;
  }

  // Calculate if we need scrolling (more than 5 stamps)
  const needsScrolling = currentStamps.length > 5;
  const maxHeight = needsScrolling ? '300px' : 'auto';

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
            zIndex: 2147483647,
            top: `${customizerPosition.top}px`,
            left: `${customizerPosition.left}px`,
            width: '300px',
            height: 'auto',
            maxHeight: '80vh',
            display: 'block',
            visibility: 'visible',
            opacity: 1,
            transform: 'translateZ(0)',
            overflow: 'hidden',
            ...(isWin7Mode ? {
              background: 'rgba(240, 240, 240, 0.98)',
              border: '1px solid #999',
              borderRadius: '8px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(10px)'
            } : {
              background: '#c0c0c0',
              border: '3px outset'
            })
          }}
        >
          {/* Compact Title Bar */}
          <div 
            className="title-bar"
            style={{
              height: '24px',
              minHeight: '24px',
              display: 'flex',
              alignItems: 'center',
              padding: '0 4px',
              flexShrink: 0, // Prevent title bar from shrinking
              ...(isWin7Mode ? {
                background: 'linear-gradient(to bottom, #f0f0f0, #e0e0e0)',
                borderBottom: '1px solid #ccc',
                borderTopLeftRadius: '6px',
                borderTopRightRadius: '6px'
              } : {})
            }}
          >
            <div className="title-bar-text" style={{ 
              flexGrow: 1,
              fontSize: '12px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              ...(isWin7Mode ? { color: '#333' } : {})
            }}>
              Theme Customizer {needsScrolling && `(${currentStamps.length} themes)`}
            </div>
            
            {/* Title Bar Controls */}
            <div className="title-bar-controls" style={{
              display: 'flex',
              gap: '2px'
            }}>
              <button 
                aria-label="Minimize" 
                onClick={handleMinimize}
                style={getTitleButtonStyle(isWin7Mode)}
              >←</button>
              <button 
                aria-label="Maximize" 
                onClick={handleMaximize}
                style={getTitleButtonStyle(isWin7Mode)}
              >→</button>
              <button 
                aria-label="Close" 
                onClick={() => setIsCustomizerOpen(false)}
                style={{
                  ...getTitleButtonStyle(isWin7Mode, true),
                  ...(isWin7Mode ? {
                    backgroundColor: '#ff6b6b',
                    ':hover': { backgroundColor: '#ff5252' }
                  } : {})
                }}
              >×</button>
            </div>
          </div>

          {/* Window Body */}
          <div 
            className={cn(
              "window-body p-2",
              isWin7Mode && "has-space"
            )} 
            style={{ 
              overflow: 'hidden', // Prevent outer scroll
              display: 'flex',
              flexDirection: 'column',
              maxHeight: 'calc(80vh - 24px)', // Account for title bar
              ...(isWin7Mode ? {
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(5px)',
                color: '#333',
                borderBottomLeftRadius: '6px',
                borderBottomRightRadius: '6px'
              } : {})
            }}
          >
            {/* Header text - fixed at top */}
            <div style={{ flexShrink: 0 }}>
              <p className="text-xs mb-2" style={isWin7Mode ? { color: '#333' } : {}}>
                Select a theme stamp for {isWin7Mode ? 'Windows 7' : 'Windows 98'}:
              </p>
              <p className="text-xs mb-3 text-gray-600" style={isWin7Mode ? { color: '#666' } : {}}>
                Use minimize (←) for Win98 themes, maximize (→) for Win7 themes
              </p>
              {needsScrolling && (
                <p className="text-xs mb-2 font-semibold" style={isWin7Mode ? { color: '#333' } : {}}>
                  📜 Scroll to see all {currentStamps.length} themes
                </p>
              )}
            </div>

            {/* Scrollable theme list */}
            <div
              style={{
                overflowY: needsScrolling ? 'auto' : 'visible',
                maxHeight: needsScrolling ? maxHeight : 'none',
                flexGrow: 1,
                // Custom scrollbar styling
                scrollbarWidth: 'thin',
                scrollbarColor: isWin7Mode ? '#ccc #f0f0f0' : '#808080 #c0c0c0',
              }}
              className="theme-stamps-container"
            >
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
                      className="w-16 h-auto mr-2 border border-gray-400 flex-shrink-0"
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
        </div>
      )}

      {/* Add custom scrollbar styling */}
      <style jsx>{`
        .theme-stamps-container::-webkit-scrollbar {
          width: 12px;
        }
        
        .theme-stamps-container::-webkit-scrollbar-track {
          background: ${isWin7Mode ? '#f0f0f0' : '#c0c0c0'};
          border-radius: ${isWin7Mode ? '6px' : '0px'};
        }
        
        .theme-stamps-container::-webkit-scrollbar-thumb {
          background: ${isWin7Mode ? '#ccc' : '#808080'};
          border-radius: ${isWin7Mode ? '6px' : '0px'};
          border: ${isWin7Mode ? '1px solid #999' : '1px outset #808080'};
        }
        
        .theme-stamps-container::-webkit-scrollbar-thumb:hover {
          background: ${isWin7Mode ? '#bbb' : '#606060'};
        }
        
        .theme-stamps-container::-webkit-scrollbar-corner {
          background: ${isWin7Mode ? '#f0f0f0' : '#c0c0c0'};
        }
      `}</style>
    </div>
  );
}