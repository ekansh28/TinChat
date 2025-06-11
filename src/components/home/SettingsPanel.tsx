// src/components/home/SettingsPanel.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button-themed';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  position: { top: number; left: number };
  setPanelPosition: React.Dispatch<React.SetStateAction<{ top: number; left: number }>>;
  cardWrapperRef: React.RefObject<HTMLDivElement>;
  currentTheme: string;
  isNavigating: boolean;
  isMobile: boolean;
}

// Declare global functions (removed non-existent oneko functions)
declare global {
  interface Window {
    startAnimatedGifCursor?: (url: string) => boolean;
    stopAnimatedGifCursor?: () => boolean;
    hideAnimatedGifCursor?: () => boolean;
    showAnimatedGifCursor?: () => boolean;
    startStaticCursor?: (url: string, hotspotX?: number, hotspotY?: number) => boolean;
    startCursor?: (url: string, options?: { hotspotX?: number; hotspotY?: number; forceStatic?: boolean }) => boolean;
    resetCursor?: () => boolean;
    getCurrentCursor?: () => { type: string | null; url: string | null; isActive: boolean; isHidden: boolean };
  }
}

export default function SettingsPanel({
  isOpen,
  onClose,
  position,
  setPanelPosition,
  cardWrapperRef,
  currentTheme,
  isNavigating,
  isMobile
}: SettingsPanelProps) {
  const [cursorImages, setCursorImages] = useState<string[]>([]);
  const [cursorsLoading, setCursorsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Function to load oneko.js dynamically
  const loadOnekoScript = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      // Check if oneko script already exists
      const existingScript = document.getElementById('oneko-script');
      if (existingScript) {
        resolve();
        return;
      }

      console.log('🐱 Loading original oneko.js script...');
      const script = document.createElement('script');
      script.id = 'oneko-script';
      script.src = '/oneko.js';
      script.onload = () => {
        console.log('✨ Oneko script loaded and started automatically');
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load oneko.js'));
      document.head.appendChild(script);
    });
  }, []);

  // Function to safely remove oneko script and stop oneko
  const removeOnekoScript = useCallback(() => {
    console.log('🧹 Removing oneko script and elements...');
    
    // Remove oneko element if it exists (this stops the animation)
    const onekoElement = document.getElementById('oneko');
    if (onekoElement && onekoElement.parentNode) {
      onekoElement.parentNode.removeChild(onekoElement);
      console.log('🐱 Oneko cat element removed');
    }
    
    // Safely remove the script element
    const script = document.getElementById('oneko-script');
    if (script && script.parentNode) {
      script.parentNode.removeChild(script);
      console.log('📜 Oneko script removed');
    }
  }, []);

  // Check if animated cursor functions are available and load script if needed
  useEffect(() => {
    const loadAndCheckScript = async () => {
      // Check if functions are already available
      if (window.startCursor && window.resetCursor) {
        console.log('✅ Ultimate cursor system already available');
        setScriptLoaded(true);
        return;
      }

      console.log('📦 Loading ultimate cursor system...');
      
      try {
        // Check if script element exists
        let script = document.getElementById('animated-cursor-script') as HTMLScriptElement;
        
        if (!script) {
          // Create and load the script
          script = document.createElement('script');
          script.id = 'animated-cursor-script';
          script.src = '/animatedcursor.js';
          script.async = true;
          
          // Promise-based script loading
          const scriptPromise = new Promise<void>((resolve, reject) => {
            script.onload = () => {
              console.log('📜 Ultimate cursor script loaded successfully');
              resolve();
            };
            script.onerror = () => {
              console.error('❌ Failed to load ultimate cursor script');
              reject(new Error('Script load failed'));
            };
          });
          
          document.head.appendChild(script);
          await scriptPromise;
        }

        // Wait for functions to be available (with timeout)
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds with 100ms intervals
        
        while (attempts < maxAttempts) {
          if (window.startCursor && window.resetCursor) {
            console.log('🎉 Ultimate cursor system is now available!');
            setScriptLoaded(true);
            return;
          }
          
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        throw new Error('Ultimate cursor functions not available after timeout');
        
      } catch (error) {
        console.warn('💥 Failed to load ultimate cursor system:', error);
        setSettingsError('Advanced cursor features unavailable. Using fallback mode.');
      }
    };

    loadAndCheckScript();
  }, []);

  // Load cursors from public/cursors directory
  useEffect(() => {
    if (isOpen && cursorImages.length === 0 && !cursorsLoading) {
      setSettingsError(null);
      setCursorsLoading(true);
      
      // List of cursor files in public/cursors
      const cursorFiles = [
        '3dgarrocur.png',
        'bananaani.gif',
        'Bankotsu-ani.gif',
        'barberani.gif',
        'butterflycursor.gif',
        'c035a.gif',
        'catfish.gif',
        'coinani.gif',
        'cupcakecursor2.gif',
        'cursor-1.gif',
        'cursor1.gif',
        'cursor2-1.gif',
        'cursor2.gif',
        'Cursor5.gif',
        'cursor8 (1).gif',
        'cursor8.gif',
        'CursorStarSparkle.gif',
        'dinosau2ani.gif',
        'dinosaurani.gif',
        'doomskullcursor.gif',
        'dosojos.gif',
        'DragonflyCMcursor.gif',
        'fillitupani.gif',
        'flyingheart.gif',
        'gears-0.png',
        'handnoani.gif',
        'hkanicursor.gif',
        'kitty1.gif',
        'neko.gif',
        'partygirl.gif',
        'pianoani.gif',
        'pointer3.gif',
        'skull1.gif',
        'snoopy04b.gif',
        'wagtailani.gif'
      ];
      
      // Create full paths to cursor files
      const cursorPaths = cursorFiles.map(file => `/cursors/${file}`);
      
      // Validate that cursor files exist by attempting to load them
      const validateCursors = async () => {
        const validCursors: string[] = [];
        
        for (const cursorPath of cursorPaths) {
          try {
            const response = await fetch(cursorPath, { method: 'HEAD' });
            if (response.ok) {
              validCursors.push(cursorPath);
            }
          } catch (error) {
            // Cursor file doesn't exist, skip it
            console.warn(`Cursor file not found: ${cursorPath}`);
          }
        }
        
        return validCursors;
      };
      
      validateCursors()
        .then((validCursors) => {
          setCursorImages(validCursors);
          if (validCursors.length === 0) {
            setSettingsError("No cursor files found in /cursors directory");
          }
        })
        .catch((error: any) => {
          console.error("Error loading cursors:", error);
          setSettingsError(error.message || "Failed to load cursors.");
          setCursorImages([]);
        })
        .finally(() => {
          setCursorsLoading(false);
        });
    }
  }, [isOpen, cursorImages.length, cursorsLoading]);

  // Update position when window resizes
  useEffect(() => {
    const updatePosition = () => {
      if (isOpen && cardWrapperRef.current) {
        const cardRect = cardWrapperRef.current.getBoundingClientRect();
        
        if (isMobile) {
          setPanelPosition({
            top: cardRect.bottom + window.scrollY + 8,
            left: Math.max(8, (window.innerWidth - 250) / 2)
          });
        } else {
          setPanelPosition({
            top: cardRect.top + window.scrollY,
            left: cardRect.right + window.scrollX + 16
          });
        }
      }
    };

    if (isOpen) {
      window.addEventListener('resize', updatePosition);
      updatePosition();
    }
    return () => window.removeEventListener('resize', updatePosition);
  }, [isOpen, isMobile, cardWrapperRef, setPanelPosition]);

  const handleCursorSelect = useCallback(async (cursorUrl: string) => {
    if (typeof window === 'undefined') return;

    console.log('🎯 Selecting cursor:', cursorUrl);

    // Always stop any existing cursor effects first
    try {
      window.resetCursor?.();
      removeOnekoScript();
    } catch (error) {
      console.warn('⚠️ Error stopping existing cursors:', error);
    }

    // Clear localStorage
    localStorage.removeItem('nekoActive');
    localStorage.removeItem('animatedCursorUrl');
    localStorage.removeItem('selectedCursorUrl');

    try {
      if (cursorUrl.toLowerCase().includes('neko.gif')) {
        // Special handling for oneko.gif and neko.gif - load oneko.js
        console.log('🐱 Loading oneko cursor script...');
        await loadOnekoScript();
        
        // oneko.js is self-executing, so no need to call any function
        // Just set the localStorage flag to indicate oneko is active
        localStorage.setItem('nekoActive', 'true');
        console.log('✨ Oneko cursor started successfully');
        
      } else if (scriptLoaded && window.startCursor) {
        // Use the ultimate cursor system for all other cursors
        console.log('🚀 Using ultimate cursor system...');
        const success = window.startCursor(cursorUrl, { hotspotX: 0, hotspotY: 0 });
        
        if (success) {
          const cursorInfo = window.getCurrentCursor?.();
          if (cursorInfo?.type === 'animated') {
            localStorage.setItem('animatedCursorUrl', cursorUrl);
          } else {
            localStorage.setItem('selectedCursorUrl', cursorUrl);
          }
          console.log('✨ Cursor started successfully:', cursorInfo);
        } else {
          throw new Error('Ultimate cursor system failed to start cursor');
        }
      } else {
        // Fallback to basic CSS cursor
        console.log('🔄 Using fallback CSS cursor...');
        const isGif = cursorUrl.toLowerCase().endsWith('.gif');
        
        if (isGif) {
          setSettingsError('Note: GIF animations not supported in fallback mode. Showing as static image.');
        }
        
        // Use top-left corner alignment (0, 0) for better pointing accuracy
        const cursorStyle = `url(${cursorUrl}) 0 0, auto`;
        document.body.style.cursor = cursorStyle;
        
        // Test if cursor was applied
        setTimeout(() => {
          const currentCursor = getComputedStyle(document.body).cursor;
          console.log('📋 Applied cursor style:', currentCursor);
          if (currentCursor === 'auto' || !currentCursor.includes(cursorUrl)) {
            console.warn('⚠️ Static cursor may not have loaded properly');
            // Try with small offset if 0,0 doesn't work
            document.body.style.cursor = `url(${cursorUrl}) 1 1, auto`;
          }
        }, 100);
        
        localStorage.setItem('selectedCursorUrl', cursorUrl);
      }
      
      // Clear any previous errors related to this action
      if (settingsError && settingsError.includes('Failed to load cursor:')) {
        setSettingsError(null);
      }
      
    } catch (error) {
      console.error('💥 Failed to set cursor:', error);
      setSettingsError(`Failed to load cursor: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Fallback to default cursor
      if (window.resetCursor) {
        window.resetCursor();
      } else {
        document.body.style.cursor = 'auto';
      }
    }
  }, [loadOnekoScript, removeOnekoScript, scriptLoaded, settingsError]);

  const handleDefaultCursor = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    console.log('🔄 Resetting to default cursor...');
    
    // Stop all cursor effects
    try {
      window.resetCursor?.();
      removeOnekoScript(); // This removes oneko cat and script
    } catch (error) {
      console.warn('⚠️ Error stopping cursors:', error);
    }
    
    // Clear localStorage
    localStorage.removeItem('nekoActive');
    localStorage.removeItem('animatedCursorUrl');
    localStorage.removeItem('selectedCursorUrl');
    
    // Ensure cursor is reset
    document.body.style.cursor = 'auto';
    
    // Clear any errors
    setSettingsError(null);
    
    console.log('✅ Default cursor restored');
  }, [removeOnekoScript]);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'fixed p-2 shadow-lg z-[9999]',
        currentTheme === 'theme-7'
          ? 'bg-neutral-100 bg-opacity-70 backdrop-filter backdrop-blur-md border border-neutral-300 rounded-lg'
          : 'bg-silver border border-gray-400 rounded',
        isMobile && 'mx-2'
      )}
      style={{
        width: isMobile ? 'calc(100vw - 16px)' : '250px',
        maxWidth: isMobile ? '300px' : '250px',
        top: `${position.top}px`,
        left: `${position.left}px`,
        maxHeight: `calc(100vh - ${position.top}px - 16px)`,
        overflowY: 'auto'
      }}
    >
      <div className={cn(currentTheme === 'theme-98' ? 'p-1' : 'p-1')}>
        {/* Close button for mobile */}
        {isMobile && (
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-medium text-sm">Settings</h4>
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
              className="w-6 h-6 p-0"
            >
              <X size={12} />
            </Button>
          </div>
        )}
        
        <menu role="tablist" className={cn(currentTheme === 'theme-98' ? 'mb-0.5' : 'mb-2 border-b border-gray-300 dark:border-gray-600')}>
          <li role="tab" aria-selected="true"
              className={cn(
                'inline-block py-1 px-2 cursor-default',
                currentTheme === 'theme-98' ? 'button raised' : 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400',
                currentTheme === 'theme-98' && '[aria-selected=true]:font-bold'
              )}
          >
            <a>Cursors</a>
          </li>
        </menu>
        
        <div
          className={cn(
            currentTheme === 'theme-98' ? 'sunken-panel' : '',
            currentTheme === 'theme-7' ? 'bg-white bg-opacity-50 dark:bg-gray-700 dark:bg-opacity-50 border border-gray-300 dark:border-gray-600 rounded' : ''
          )}
          role="tabpanel"
          style={{ marginTop: currentTheme === 'theme-98' ? '1px' : '' }}
        >
          <div className={cn(currentTheme === 'theme-7' ? 'p-2' : 'p-1')}>
            <Button 
              onClick={handleDefaultCursor} 
              className={cn(
                "w-full mb-2",
                isMobile ? "text-xs h-8" : "text-xs"
              )} 
              disabled={isNavigating}
            >
              Default Cursor
            </Button>

            {/* Manual script loading button */}
            {!scriptLoaded && (
              <Button 
                onClick={async () => {
                  setSettingsError(null);
                  try {
                    // Force reload the script
                    const existingScript = document.getElementById('animated-cursor-script');
                    if (existingScript) {
                      existingScript.remove();
                    }
                    
                    console.log('🔄 Manually loading ultimate cursor system...');
                    const script = document.createElement('script');
                    script.id = 'animated-cursor-script';
                    script.src = '/animatedcursor.js?t=' + Date.now(); // Cache busting
                    script.async = true;
                    
                    const scriptPromise = new Promise<void>((resolve, reject) => {
                      script.onload = () => {
                        console.log('📜 Manual script load successful');
                        setTimeout(() => {
                          if (window.startCursor && window.resetCursor) {
                            setScriptLoaded(true);
                            resolve();
                          } else {
                            reject(new Error('Ultimate cursor functions not available after manual load'));
                          }
                        }, 100);
                      };
                      script.onerror = () => reject(new Error('Manual script load failed'));
                    });
                    
                    document.head.appendChild(script);
                    await scriptPromise;
                    
                  } catch (error) {
                    console.error('💥 Manual script load failed:', error);
                    setSettingsError('Failed to load cursor system. Check if /animatedcursor.js exists and is accessible.');
                  }
                }}
                className={cn(
                  "w-full mb-2",
                  isMobile ? "text-xs h-8" : "text-xs"
                )}
                variant="outline"
                disabled={isNavigating}
              >
                Load Animation Support
              </Button>
            )}
            
            {/* Script loading status */}
            <div className={cn(
              "mb-2 p-2 rounded text-xs",
              scriptLoaded 
                ? "bg-green-100 border border-green-300 text-green-700" 
                : "bg-yellow-100 border border-yellow-300 text-yellow-700"
            )}>
              Animated cursors: {scriptLoaded ? '✓ Ready' : '⏳ Loading...'}
              {!scriptLoaded && (
                <div className="mt-1 text-xs opacity-75">
                  Click "Load Animation Support" if GIFs don't animate
                </div>
              )}
            </div>
            
            {/* Show error if any */}
            {settingsError && (
              <div className="mb-2 p-2 bg-yellow-100 border border-yellow-300 rounded text-xs text-yellow-700">
                {settingsError}
                <button 
                  onClick={() => setSettingsError(null)}
                  className="ml-2 text-yellow-900 hover:text-yellow-700"
                >
                  ✕
                </button>
              </div>
            )}
            
            {cursorsLoading ? (
              <p className="text-center text-xs">Loading cursors...</p>
            ) : cursorImages.length > 0 ? (
              <div className={cn(
                "overflow-y-auto grid gap-2 p-1",
                isMobile 
                  ? "h-32 grid-cols-3" 
                  : "h-48 grid-cols-4"
              )}>
                {cursorImages.map((url) => {
                  const isGif = url.toLowerCase().endsWith('.gif');
                  const isOneko = url.toLowerCase().includes('oneko.gif');
                  
                  return (
                    <div 
                      key={url} 
                      className={cn(
                        "flex items-center justify-center p-1 border border-gray-300 dark:border-gray-600 rounded transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer"
                      )}
                      onClick={() => handleCursorSelect(url)}
                      title={`${url.split('/').pop()}${isGif && !isOneko && !scriptLoaded ? ' (static mode)' : ''}`}
                    >
                      <img
                        src={url}
                        alt={`cursor preview - ${url.split('/').pop()}`}
                        className={cn(
                          "object-contain pointer-events-none transition-transform hover:scale-110",
                          isMobile ? "w-6 h-6" : "w-[30px] h-[30px]"
                        )}
                        onError={(e) => {
                          console.warn(`Failed to load cursor image: ${url}`);
                          // Hide broken images
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-xs space-y-2">
                <p>No cursor files found</p>
                <p className="text-gray-500">
                  Place cursor files in <code>/public/cursors/</code>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}