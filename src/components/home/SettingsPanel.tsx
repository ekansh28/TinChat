// src/components/Home/SettingsPanel.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button-themed';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { listCursors } from '@/ai/flows/list-cursors-flow';

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

  // Load cursors when panel opens
  useEffect(() => {
    if (isOpen && cursorImages.length === 0 && !cursorsLoading) {
      setSettingsError(null);
      setCursorsLoading(true);
      
      listCursors()
        .then((fetchedCursors) => {
          setCursorImages(fetchedCursors || []);
        })
        .catch((error: any) => {
          console.error("Error fetching cursors:", error);
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

  const handleCursorSelect = useCallback((cursorUrl: string) => {
    if (typeof window === 'undefined') return;

    // Stop any existing cursor effects
    window.stopOriginalOneko?.();
    window.stopAnimatedGifCursor?.();
    document.body.style.cursor = 'auto';

    // Clear localStorage
    localStorage.removeItem('nekoActive');
    localStorage.removeItem('animatedCursorUrl');
    localStorage.removeItem('selectedCursorUrl');

    if (cursorUrl.toLowerCase().includes('neko.gif')) {
      // Neko cat cursor
      window.startOriginalOneko?.();
      document.body.style.cursor = 'auto';
      localStorage.setItem('nekoActive', 'true');
    } else if (cursorUrl.toLowerCase().endsWith('.gif')) {
      // Animated GIF cursor
      window.startAnimatedGifCursor?.(cursorUrl);
      document.body.style.cursor = 'none';
      localStorage.setItem('animatedCursorUrl', cursorUrl);
    } else {
      // Static cursor
      document.body.style.cursor = `url(${cursorUrl}), auto`;
      localStorage.setItem('selectedCursorUrl', cursorUrl);
    }
  }, []);

  const handleDefaultCursor = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    window.stopOriginalOneko?.();
    window.stopAnimatedGifCursor?.();
    localStorage.removeItem('nekoActive');
    localStorage.removeItem('animatedCursorUrl');
    localStorage.removeItem('selectedCursorUrl');
    document.body.style.cursor = 'auto';
  }, []);

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
            
            {cursorsLoading ? (
              <p className="text-center text-xs">Loading cursors...</p>
            ) : settingsError ? (
              <p className="text-red-600 text-center text-xs">Error: {settingsError}</p>
            ) : cursorImages.length > 0 ? (
              <div className={cn(
                "overflow-y-auto grid gap-2 p-1",
                isMobile 
                  ? "h-32 grid-cols-3" 
                  : "h-48 grid-cols-4"
              )}>
                {cursorImages.map((url) => (
                  <div key={url} className="flex items-center justify-center p-1 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                    <img
                      src={url}
                      alt="cursor preview"
                      className={cn(
                        "object-contain cursor-pointer",
                        isMobile ? "w-6 h-6" : "w-[30px] h-[30px]"
                      )}
                      data-ai-hint="custom cursor preview"
                      onClick={() => handleCursorSelect(url)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-xs">No cursors found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}