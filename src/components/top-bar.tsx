// src/components/top-bar.tsx - Updated with dynamic theme icons and theme browser fixes
'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import ThemeStampUploader, { loadCustomStamps, type StampData } from './ThemeStampUploader';

const DYNAMIC_THEME_STYLE_ID = 'dynamic-win98-theme-style';
const WIN7_CSS_LINK_ID = 'win7-css-link';
const WINXP_CSS_LINK_ID = 'winxp-css-link';

interface ThemeStamp {
  name: string;
  imageUrl: string;
  cssFile: string | null;
  dataAiHint: string;
  isCustom?: boolean;
  isThemeBrowser?: boolean;
  isDefault?: boolean;
}

const availableStamps: ThemeStamp[] = [
  { name: 'Water Color', imageUrl: '/theme_stamps/watercolor.png', cssFile: 'watercolor-theme.css', dataAiHint: 'watercolor theme stamp' },
  { name: 'Pink Windows', imageUrl: '/theme_stamps/coquette.png', cssFile: 'pink-theme.css', dataAiHint: 'pink theme stamp' },
  { name: 'Star Pattern', imageUrl: '/theme_stamps/starpattern.png', cssFile: 'starpattern-theme.css', dataAiHint: 'star pattern theme stamp' },
  { name: 'Dark Theme', imageUrl: '/theme_stamps/darktheme.png', cssFile: 'dark-theme.css', dataAiHint: 'dark theme stamp' },
  { name: '666', imageUrl: '/theme_stamps/666.png', cssFile: '666-theme.css', dataAiHint: '666 theme stamp' },
  { name: 'Default 98', imageUrl: 'https://placehold.co/100x75/c0c0c0/000000.png?text=Default', cssFile: null, dataAiHint: 'default theme stamp', isDefault: true },
  { name: 'Theme Browser', imageUrl: 'https://cdn.tinchat.online/icons/browser.png', cssFile: 'THEME_BROWSER_PLACEHOLDER', dataAiHint: 'theme browser stamp', isThemeBrowser: true },
];

const available7Stamps: ThemeStamp[] = [
  { name: 'Frutiger Aero', imageUrl: '/theme_stamps/frutiger.png', cssFile: 'frutiger1-theme.css', dataAiHint: 'frutiger theme stamp' },
  { name: 'Frutiger Aero 2', imageUrl: '/theme_stamps/frutiger2.png', cssFile: 'frutiger2-theme.css', dataAiHint: 'frutiger2 theme stamp' },
  { name: 'PS3', imageUrl: '/theme_stamps/ps3.png', cssFile: 'ps3-theme.css', dataAiHint: 'ps3 theme stamp' },
  { name: 'leaf', imageUrl: '/theme_stamps/ps3.png', cssFile: 'leaf-theme.css', dataAiHint: 'leaf theme stamp' },
  { name: 'Default', imageUrl: 'https://placehold.co/100x75/0078d4/ffffff.png?text=Default', cssFile: null, dataAiHint: 'default win7 theme stamp', isDefault: true },
  { name: 'Theme Browser', imageUrl: 'https://cdn.tinchat.online/icons/browser.png', cssFile: 'THEME_BROWSER_PLACEHOLDER', dataAiHint: 'theme browser stamp', isThemeBrowser: true },
];

const availableXPStamps: ThemeStamp[] = [
  { name: 'Bliss Theme', imageUrl: '/theme_stamps/bliss.png', cssFile: 'bliss-theme.css', dataAiHint: 'bliss xp theme stamp' },
  { name: 'Default XP', imageUrl: 'https://placehold.co/100x75/0066CC/ffffff.png?text=Default', cssFile: null, dataAiHint: 'default winxp theme stamp', isDefault: true },
  { name: 'Theme Browser', imageUrl: 'https://cdn.tinchat.online/icons/browser.png', cssFile: 'THEME_BROWSER_PLACEHOLDER', dataAiHint: 'theme browser stamp', isThemeBrowser: true },
];

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [customizerPosition, setCustomizerPosition] = useState({ top: 0, left: 0 });
  const [isWin7Mode, setIsWin7Mode] = useState(false);
  const [isWinXPMode, setIsWinXPMode] = useState(false);
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);
  const [uploadCssFileName, setUploadCssFileName] = useState('');
  const [isLoadingStamps, setIsLoadingStamps] = useState(false);
  const [isApplyingTheme, setIsApplyingTheme] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Force re-render trigger
  const [customStamps, setCustomStamps] = useState<{
    win98: StampData[];
    win7: StampData[];
    winxp: StampData[];
  }>({
    win98: [],
    win7: [],
    winxp: []
  });

  const themeIconRef = useRef<HTMLImageElement>(null);
  const customizerWindowRef = useRef<HTMLDivElement>(null);

  // Get current mode
  const currentMode = isWinXPMode ? 'winxp' : (isWin7Mode ? 'win7' : 'win98');

  // Get appropriate theme icon based on current mode
  const getThemeIcon = useCallback(() => {
    if (isWinXPMode) {
      return '/icons/themeXP.png';
    } else if (isWin7Mode) {
      return '/icons/Theme7.ico';
    } else {
      return '/icons/theme98.png';
    }
  }, [isWinXPMode, isWin7Mode]);

  // Load custom stamps from localStorage with loading state
  const loadAllCustomStamps = useCallback(async () => {
    setIsLoadingStamps(true);
    console.log('[TopBar] Loading custom stamps...');
    
    try {
      // Add a small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const win98Stamps = loadCustomStamps('win98');
      const win7Stamps = loadCustomStamps('win7');
      const winxpStamps = loadCustomStamps('winxp');
      
      console.log('[TopBar] Loaded stamps:', {
        win98: win98Stamps.length,
        win7: win7Stamps.length,
        winxp: winxpStamps.length
      });
      
      setCustomStamps({
        win98: win98Stamps,
        win7: win7Stamps,
        winxp: winxpStamps
      });
      
      // Force refresh of the theme list
      setRefreshTrigger(prev => prev + 1);
      
    } catch (error) {
      console.error('[TopBar] Error loading custom stamps:', error);
    } finally {
      setIsLoadingStamps(false);
    }
  }, []);

  // Combine built-in and custom stamps
  const currentStamps = React.useMemo(() => {
    let builtInStamps: ThemeStamp[] = [];
    let customStampsForMode: StampData[] = [];

    if (isWinXPMode) {
      builtInStamps = availableXPStamps;
      customStampsForMode = customStamps.winxp;
    } else if (isWin7Mode) {
      builtInStamps = available7Stamps;
      customStampsForMode = customStamps.win7;
    } else {
      builtInStamps = availableStamps;
      customStampsForMode = customStamps.win98;
    }

    // Add custom stamps with proper typing
    const customThemeStamps: ThemeStamp[] = customStampsForMode.map(stamp => ({
      name: stamp.name,
      imageUrl: stamp.imageUrl,
      cssFile: stamp.cssFile,
      dataAiHint: stamp.dataAiHint,
      isCustom: true
    }));

    // Add the "Add Theme" stamp
    const addThemeStamp: ThemeStamp = {
      name: 'Add Theme',
      imageUrl: `/theme_stamps/${currentMode === 'win98' ? 'add98.png' : currentMode === 'win7' ? 'add7.png' : 'addxp.png'}`,
      cssFile: 'ADD_THEME_PLACEHOLDER',
      dataAiHint: 'add custom theme stamp',
      isCustom: false
    };

    const allStamps = [...builtInStamps, ...customThemeStamps, addThemeStamp];
    console.log('[TopBar] Current stamps for', currentMode, ':', allStamps.length);
    
    return allStamps;
  }, [isWinXPMode, isWin7Mode, customStamps, currentMode, refreshTrigger]);

  // Load custom stamps on mount and when mode changes
  useEffect(() => {
    if (mounted) {
      console.log('[TopBar] Mode changed, reloading stamps for:', currentMode);
      loadAllCustomStamps();
    }
  }, [mounted, loadAllCustomStamps, isWin7Mode, isWinXPMode]);

  // Load stamps when uploader closes
  useEffect(() => {
    if (!isUploaderOpen && mounted) {
      console.log('[TopBar] Uploader closed, reloading stamps');
      loadAllCustomStamps();
    }
  }, [isUploaderOpen, loadAllCustomStamps, mounted]);

  // Initial mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Helper function for title button styles
  const getTitleButtonStyle = useCallback((currentMode: 'win98' | 'win7' | 'winxp', isClose = false) => {
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

    if (currentMode === 'win7') {
      return {
        ...baseStyle,
        backgroundColor: isClose ? '#ff6b6b' : '#f0f0f0',
        border: '1px solid #999',
        borderRadius: '3px',
        '&:hover': {
          backgroundColor: isClose ? '#ff5252' : '#e0e0e0'
        }
      };
    } else if (currentMode === 'winxp') {
      return {
        ...baseStyle,
        backgroundColor: isClose ? '#ff6b6b' : '#ece9d8',
        border: '1px solid #0054e3',
        borderRadius: '2px',
        color: '#000',
        '&:hover': {
          backgroundColor: isClose ? '#ff5252' : '#ddd9c3'
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

  // Handle theme stamp upload prompt
  const handleAddThemeClick = useCallback(() => {
    const cssFileName = prompt('Enter CSS filename (e.g., "mytheme.css"):');
    if (cssFileName && cssFileName.trim()) {
      let fileName = cssFileName.trim();
      if (!fileName.endsWith('.css')) {
        fileName += '.css';
      }
      setUploadCssFileName(fileName);
      setIsUploaderOpen(true);
    }
  }, []);

  const applySubTheme = useCallback(async (cssFile: string | null, forceMode?: 'win98' | 'win7' | 'winxp') => {
    if (typeof window === 'undefined') return;
    
    setIsApplyingTheme(true);
    console.log('[TopBar] Applying theme:', cssFile, 'for mode:', forceMode || currentMode);
    
    try {
      const currentMode = forceMode || (isWinXPMode ? 'winxp' : (isWin7Mode ? 'win7' : 'win98'));
      const htmlElement = document.documentElement;
      const subThemeClassName = cssFile ? `subtheme-${cssFile.replace('.css', '')}` : null;

      // Remove all existing sub-theme classes
      [...availableStamps, ...available7Stamps, ...availableXPStamps, ...customStamps.win98, ...customStamps.win7, ...customStamps.winxp].forEach(stamp => {
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
        let folderPrefix = 'win98themes';
        if (currentMode === 'win7') folderPrefix = 'win7themes';
        else if (currentMode === 'winxp') folderPrefix = 'winxpthemes';
        
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
          const storageKey = `selected${currentMode.charAt(0).toUpperCase() + currentMode.slice(1)}SubTheme`;
          localStorage.setItem(storageKey, cssFile);
        }
      } else {
        if (link) {
          link.remove();
        }
        
        if (pathname !== '/') {
          const storageKey = `selected${currentMode.charAt(0).toUpperCase() + currentMode.slice(1)}SubTheme`;
          localStorage.removeItem(storageKey);
        }
      }
      
      // Add a small delay to show the loading state
      await new Promise(resolve => setTimeout(resolve, 150));
      
      htmlElement.classList.remove('theme-transitioning');
    } catch (error) {
      console.error('[TopBar] Error applying theme:', error);
    } finally {
      setIsApplyingTheme(false);
    }
  }, [pathname, isWin7Mode, isWinXPMode, customStamps, currentMode]);

  // Handle stamp created with better integration
  const handleStampCreated = useCallback(async (stampData: StampData) => {
    console.log('[TopBar] Theme stamp created:', stampData);
    
    setIsLoadingStamps(true);
    
    try {
      // Reload custom stamps to show the new one immediately
      await loadAllCustomStamps();
      
      // Apply the new theme immediately if we're not on home page
      if (pathname !== '/') {
        await applySubTheme(stampData.cssFile, currentMode);
      }
      
      console.log('[TopBar] Successfully integrated new theme:', stampData.name);
      
    } catch (error) {
      console.error('[TopBar] Error integrating new theme:', error);
    } finally {
      setIsLoadingStamps(false);
      
      // Close and reopen customizer to refresh the view
      setIsCustomizerOpen(false);
      setTimeout(() => {
        if (pathname !== '/') {
          setIsCustomizerOpen(true);
          setCustomizerPosition(calculateCustomizerPosition());
        }
      }, 100);
    }
  }, [loadAllCustomStamps, currentMode, applySubTheme, pathname]);

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

  const loadWinXPCSS = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    let winxpLink = document.getElementById(WINXP_CSS_LINK_ID) as HTMLLinkElement | null;
    
    if (!winxpLink) {
      winxpLink = document.createElement('link');
      winxpLink.id = WINXP_CSS_LINK_ID;
      winxpLink.rel = 'stylesheet';
      winxpLink.href = 'https://unpkg.com/xp.css';
      document.head.appendChild(winxpLink);
    }
  }, []);

  const removeWin7CSS = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    const win7Link = document.getElementById(WIN7_CSS_LINK_ID);
    if (win7Link) win7Link.remove();
  }, []);

  const removeWinXPCSS = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    const winxpLink = document.getElementById(WINXP_CSS_LINK_ID);
    if (winxpLink) winxpLink.remove();
  }, []);

  const calculateCustomizerPosition = useCallback(() => {
    const fallbackPosition = { top: 60, left: 20 };

    if (!themeIconRef.current) return fallbackPosition;

    try {
      const iconRect = themeIconRef.current.getBoundingClientRect();
      const windowWidth = 300;
      const windowHeight = Math.min(500, window.innerHeight * 0.8);
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

  // Handle minimize (Windows 98)
  const handleMinimize = useCallback(async () => {
    const wasCustomizerOpen = isCustomizerOpen;
    setIsCustomizerOpen(false);
    setIsWin7Mode(false);
    setIsWinXPMode(false);
    removeWin7CSS();
    removeWinXPCSS();
    
    if (wasCustomizerOpen) {
      setTimeout(() => {
        setIsCustomizerOpen(true);
        setCustomizerPosition(calculateCustomizerPosition());
      }, 200);
    }
    
    const storedWin98SubTheme = localStorage.getItem('selectedWin98SubTheme');
    await applySubTheme(storedWin98SubTheme || null, 'win98');
  }, [isCustomizerOpen, removeWin7CSS, removeWinXPCSS, applySubTheme, calculateCustomizerPosition]);

  // Handle maximize (Windows 7)
  const handleMaximize = useCallback(async () => {
    const wasCustomizerOpen = isCustomizerOpen;
    setIsCustomizerOpen(false);
    setIsWin7Mode(true);
    setIsWinXPMode(false);
    removeWinXPCSS();
    loadWin7CSS();
    
    if (wasCustomizerOpen) {
      setTimeout(() => {
        setIsCustomizerOpen(true);
        setCustomizerPosition(calculateCustomizerPosition());
      }, 300);
    }
    
    setTimeout(async () => {
      const storedWin7SubTheme = localStorage.getItem('selectedWin7SubTheme');
      await applySubTheme(storedWin7SubTheme || null, 'win7');
    }, 400);
  }, [isCustomizerOpen, loadWin7CSS, removeWinXPCSS, applySubTheme, calculateCustomizerPosition]);

  // Handle close (Windows XP)
  const handleClose = useCallback(async () => {
    const wasCustomizerOpen = isCustomizerOpen;
    setIsCustomizerOpen(false);
    setIsWin7Mode(false);
    setIsWinXPMode(true);
    removeWin7CSS();
    loadWinXPCSS();
    
    if (wasCustomizerOpen) {
      setTimeout(() => {
        setIsCustomizerOpen(true);
        setCustomizerPosition(calculateCustomizerPosition());
      }, 300);
    }
    
    setTimeout(async () => {
      const storedWinXPSubTheme = localStorage.getItem('selectedWinxpSubTheme');
      await applySubTheme(storedWinXPSubTheme || null, 'winxp');
    }, 400);
  }, [isCustomizerOpen, loadWinXPCSS, removeWin7CSS, applySubTheme, calculateCustomizerPosition]);

  useEffect(() => {
    if (!mounted) return;
    
    if (pathname === '/') {
      setIsWin7Mode(false);
      setIsWinXPMode(false);
      removeWin7CSS();
      removeWinXPCSS();
      applySubTheme(null, 'win98');
    } else {
      let storedSubTheme;
      if (isWinXPMode) {
        storedSubTheme = localStorage.getItem('selectedWinxpSubTheme');
      } else if (isWin7Mode) {
        storedSubTheme = localStorage.getItem('selectedWin7SubTheme');
      } else {
        storedSubTheme = localStorage.getItem('selectedWin98SubTheme');
      }
      
      if (storedSubTheme) {
        applySubTheme(storedSubTheme);
      }
    }
  }, [pathname, applySubTheme, mounted, isWin7Mode, isWinXPMode, removeWin7CSS, removeWinXPCSS]);

  // Handle delete custom stamp
  const handleDeleteCustomStamp = useCallback(async (cssFile: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (confirm(`Are you sure you want to delete the custom theme "${cssFile}"?`)) {
      setIsLoadingStamps(true);
      
      try {
        // Remove from localStorage
        const storageKey = `customThemeStamps_${currentMode}`;
        const existingStamps = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const filteredStamps = existingStamps.filter((stamp: StampData) => stamp.cssFile !== cssFile);
        localStorage.setItem(storageKey, JSON.stringify(filteredStamps));
        
        // Also remove CSS content if stored
        const cssStorageKey = `cssContent_${currentMode}_${cssFile}`;
        localStorage.removeItem(cssStorageKey);
        
        // Reload stamps to update UI
        await loadAllCustomStamps();
        
        console.log(`[TopBar] Deleted custom theme: ${cssFile}`);
      } catch (error) {
        console.error('[TopBar] Error deleting custom theme:', error);
      } finally {
        setIsLoadingStamps(false);
      }
    }
  }, [currentMode, loadAllCustomStamps]);

  // Handle sub-theme selection with Theme Browser redirect
  const handleSubThemeSelect = useCallback(async (cssFile: string | null) => {
    if (pathname === '/') return;
    
    // Handle Theme Browser click - redirect to /css-browser
    if (cssFile === 'THEME_BROWSER_PLACEHOLDER') {
      setIsCustomizerOpen(false);
      router.push('/css-browser');
      return;
    }
    
    // Handle Add Theme click - open modal directly
    if (cssFile === 'ADD_THEME_PLACEHOLDER') {
      setIsUploaderOpen(true);
      return;
    }
    
    await applySubTheme(cssFile);
    setIsCustomizerOpen(false);
  }, [pathname, applySubTheme, router]);

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
  const maxHeight = needsScrolling ? '400px' : 'auto';

  return (
    <>
      <div className="flex justify-end items-center p-2 space-x-2">
        <span className="mr-2 text-sm"></span>

        {/* Loading indicator in top bar */}
        {(isLoadingStamps || isApplyingTheme) && (
          <div className="flex items-center mr-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            <span className="ml-1 text-xs text-gray-600">
              {isApplyingTheme ? 'Applying...' : 'Loading...'}
            </span>
          </div>
        )}

        {pathname !== '/' && (
          <img
            ref={themeIconRef}
            src={getThemeIcon()}
            alt="Customize Theme"
            className={cn(
              "w-5 h-5 cursor-pointer transition-opacity",
              (isLoadingStamps || isApplyingTheme) && "opacity-50"
            )}
            onClick={toggleCustomizer}
            data-ai-hint="theme settings icon"
          />
        )}

        {isCustomizerOpen && pathname !== '/' && (
          <div
            ref={customizerWindowRef}
            className={cn(
              "window fixed",
              isWin7Mode && "glass active",
              isWinXPMode && "xp-window"
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
              ...(isWinXPMode ? {
                background: '#ece9d8',
                border: '1px solid #0054e3',
                borderRadius: '8px 8px 0 0',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
              } : isWin7Mode ? {
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
                flexShrink: 0,
                ...(isWinXPMode ? {
                  background: 'linear-gradient(to bottom, #0054e3, #0040b3)',
                  color: '#fff',
                  borderTopLeftRadius: '6px',
                  borderTopRightRadius: '6px'
                } : isWin7Mode ? {
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
                ...(isWinXPMode ? { color: '#fff' } : isWin7Mode ? { color: '#333' } : {})
              }}>
                Theme Customizer {needsScrolling && `(${currentStamps.length} themes)`}
                {isLoadingStamps && ' - Loading...'}
              </div>
              
              {/* Title Bar Controls */}
              <div className="title-bar-controls" style={{
                display: 'flex',
                gap: '2px'
              }}>
                <button 
                  aria-label="Minimize" 
                  onClick={handleMinimize}
                  style={getTitleButtonStyle(currentMode)}
                ></button>
                <button 
                  aria-label="Maximize" 
                  onClick={handleMaximize}
                  style={getTitleButtonStyle(currentMode)}
                ></button>
                <button 
                  aria-label="Close" 
                  onClick={handleClose}
                  style={{
                    ...getTitleButtonStyle(currentMode, true),
                    ...(isWinXPMode ? {
                      backgroundColor: '#ff6b6b',
                      ':hover': { backgroundColor: '#ff5252' }
                    } : isWin7Mode ? {
                      backgroundColor: '#ff6b6b',
                      ':hover': { backgroundColor: '#ff5252' }
                    } : {})
                  }}
                ></button>
              </div>
            </div>

            {/* Window Body */}
            <div 
              className={cn(
                "window-body p-2",
                isWin7Mode && "has-space",
                isWinXPMode && "xp-body"
              )} 
              style={{ 
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: 'calc(80vh - 24px)',
                ...(isWinXPMode ? {
                  background: '#ece9d8',
                  color: '#000'
                } : isWin7Mode ? {
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
                <p className="text-xs mb-2" style={isWinXPMode ? { color: '#000' } : isWin7Mode ? { color: '#333' } : {}}>
                  Select a theme stamp for {isWinXPMode ? 'Windows XP' : isWin7Mode ? 'Windows 7' : 'Windows 98'}:
                </p>
                <p className="text-xs mb-3 text-gray-600" style={isWinXPMode ? { color: '#333' } : isWin7Mode ? { color: '#666' } : {}}>
                  Use minimize (_) for Win98, maximize ([]) for Win7, close (×) for WinXP themes
                </p>
                {needsScrolling && (
                  <p className="text-xs mb-2 font-semibold" style={isWinXPMode ? { color: '#000' } : isWin7Mode ? { color: '#333' } : {}}>
                     Scroll to see all themes
                  </p>
                )}
                
                {/* Loading indicator inside customizer */}
                {isLoadingStamps && (
                  <div className="flex items-center justify-center mb-3 p-2" style={{
                    background: isWinXPMode ? '#f0f0f0' : isWin7Mode ? 'rgba(255, 255, 255, 0.9)' : '#e0e0e0',
                    borderRadius: '4px',
                    border: isWinXPMode ? '1px solid #ccc' : isWin7Mode ? '1px solid #ddd' : '1px inset'
                  }}>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                    <span className="text-xs" style={isWinXPMode ? { color: '#000' } : isWin7Mode ? { color: '#333' } : {}}>
                      Loading custom themes...
                    </span>
                  </div>
                )}
              </div>

              {/* Scrollable theme list */}
              <div
                style={{
                  overflowY: needsScrolling ? 'auto' : 'visible',
                  maxHeight: needsScrolling ? maxHeight : 'none',
                  flexGrow: 1,
                  scrollbarWidth: 'thin',
                  scrollbarColor: isWinXPMode ? '#0054e3 #ece9d8' : isWin7Mode ? '#ccc #f0f0f0' : '#808080 #c0c0c0',
                  opacity: isLoadingStamps ? 0.6 : 1,
                  transition: 'opacity 0.3s ease'
                }}
                className="theme-stamps-container"
              >
                <ul className="list-none p-0 m-0">
                  {currentStamps.map((stamp, index) => (
                    <li 
                      key={`${stamp.name}-${index}-${refreshTrigger}`}
                      className={cn(
                        "mb-2 p-1 cursor-pointer flex items-center transition-colors relative group",
                        isWinXPMode
                          ? "hover:bg-blue-100 rounded"
                          : isWin7Mode 
                            ? "hover:bg-white hover:bg-opacity-60 rounded" 
                            : "hover:bg-gray-300",
                        stamp.cssFile === 'ADD_THEME_PLACEHOLDER' && "border-2 border-dashed border-gray-400",
                        (isLoadingStamps || isApplyingTheme) && "pointer-events-none"
                      )}
                      onClick={() => !isLoadingStamps && !isApplyingTheme && handleSubThemeSelect(stamp.cssFile)}
                    >
                      <img 
                        src={stamp.imageUrl}
                        alt={stamp.name}
                        className={cn(
                          "mr-2 flex-shrink-0",
                          // Only add border to default stamps
                          stamp.isDefault && "border border-gray-400"
                        )}
                        style={{ 
                          imageRendering: 'pixelated',
                          width: '66px',
                          height: '37px',
                          // Fix Theme Browser stretching by using object-fit
                          ...(stamp.isThemeBrowser && {
                            objectFit: 'contain' as const,
                   
                            padding: '2px'
                          })
                        }}
                        data-ai-hint={stamp.dataAiHint}
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (stamp.cssFile === 'ADD_THEME_PLACEHOLDER') {
                            img.src = 'data:image/svg+xml;base64,' + btoa(`
                              <svg width="66" height="37" xmlns="http://www.w3.org/2000/svg">
                                <rect width="66" height="37" fill="#e0e0e0" stroke="#999" stroke-width="1"/>
                                <text x="33" y="20" text-anchor="middle" font-family="sans-serif" font-size="8" fill="#666">+ Add</text>
                              </svg>
                            `);
                          } else {
                            img.style.display = 'none';
                          }
                        }}
                      />
                      <div className="flex-1">
                        <span 
                          className="text-sm font-medium" 
                          style={isWinXPMode ? { color: '#000' } : isWin7Mode ? { color: '#333' } : {}}
                        >
                          {stamp.name}
                        </span>
                        {stamp.isCustom && (
                          <div className="text-xs text-gray-500 mt-1">
                            Custom Theme
                          </div>
                        )}
                        {stamp.cssFile === 'ADD_THEME_PLACEHOLDER' && (
                          <div className="text-xs text-blue-600 mt-1">
                            Click to add custom theme
                          </div>
                        )}
                        {stamp.isThemeBrowser && (
                          <div className="text-xs text-green-600 mt-1">
                            Browse themes online
                          </div>
                        )}
                      </div>
                      
                      {/* Delete button for custom themes */}
                      {stamp.isCustom && stamp.cssFile !== 'ADD_THEME_PLACEHOLDER' && !isLoadingStamps && (
                        <button
                          onClick={(e) => handleDeleteCustomStamp(stamp.cssFile!, e)}
                          className={cn(
                            "ml-2 w-5 h-5 flex items-center justify-center text-xs font-bold transition-all",
                            "opacity-0 group-hover:opacity-100",
                            isWinXPMode
                              ? "bg-red-500 hover:bg-red-600 text-white rounded border border-red-600"
                              : isWin7Mode
                                ? "bg-red-500 hover:bg-red-600 text-white rounded-sm border border-red-600"
                                : "bg-red-500 hover:bg-red-600 text-white border border-red-600"
                          )}
                          title={`Delete theme: ${stamp.name}`}
                          style={{ 
                            flexShrink: 0,
                            zIndex: 10
                          }}
                        >
                          ×
                        </button>
                      )}
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
            background: ${isWinXPMode ? '#ece9d8' : isWin7Mode ? '#f0f0f0' : '#c0c0c0'};
            border-radius: ${isWinXPMode ? '3px' : isWin7Mode ? '6px' : '0px'};
          }
          
          .theme-stamps-container::-webkit-scrollbar-thumb {
            background: ${isWinXPMode ? '#0054e3' : isWin7Mode ? '#ccc' : '#808080'};
            border-radius: ${isWinXPMode ? '3px' : isWin7Mode ? '6px' : '0px'};
            border: ${isWinXPMode ? '1px solid #0040b3' : isWin7Mode ? '1px solid #999' : '1px outset #808080'};
          }
          
          .theme-stamps-container::-webkit-scrollbar-thumb:hover {
            background: ${isWinXPMode ? '#0040b3' : isWin7Mode ? '#bbb' : '#606060'};
          }
          
          .theme-stamps-container::-webkit-scrollbar-corner {
            background: ${isWinXPMode ? '#ece9d8' : isWin7Mode ? '#f0f0f0' : '#c0c0c0'};
          }
        `}</style>
      </div>

      {/* Theme Stamp Uploader Modal */}
      <ThemeStampUploader
        isOpen={isUploaderOpen}
        onClose={() => setIsUploaderOpen(false)}
        mode={currentMode}
        onStampCreated={handleStampCreated}
        cssFileName={uploadCssFileName}
      />
    </>
  );
}