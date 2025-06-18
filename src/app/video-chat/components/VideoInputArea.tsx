// ===== ENHANCED VideoInputArea.tsx =====
// src/app/video-chat/components/VideoInputArea.tsx - ENHANCED VERSION
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button-themed';
import { Input } from '@/components/ui/input-themed';

interface VideoInputAreaProps {
  value: string;
  onChange: (val: string) => void;
  onSend: (message: string) => void;
  disabled?: boolean;
  theme: string;
  isMobile: boolean;
  onScrollToBottom: () => void;
  onFindOrDisconnect: () => void;
  findOrDisconnectDisabled: boolean;
  findOrDisconnectText: string;
}

const VideoInputArea: React.FC<VideoInputAreaProps> = ({ 
  value, 
  onChange, 
  onSend, 
  disabled = false,
  theme,
  isMobile,
  onScrollToBottom,
  onFindOrDisconnect,
  findOrDisconnectDisabled,
  findOrDisconnectText
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // MOBILE: Track keyboard state
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [initialViewportHeight, setInitialViewportHeight] = useState(0);
  
  // Check if Windows 7 theme is active
  const [isWindows7Theme, setIsWindows7Theme] = useState(false);
  
  const checkWindows7Theme = useCallback(() => {
    if (typeof window === 'undefined') return false;
    
    const win7Link = document.getElementById('win7-css-link') as HTMLLinkElement;
    const hasWin7CSS = win7Link && win7Link.href.includes('7.css');
    
    const win7SubThemeLink = document.querySelector('link[href*="/win7themes/"]') as HTMLLinkElement;
    const hasWin7SubTheme = win7SubThemeLink !== null;
    
    return hasWin7CSS || hasWin7SubTheme;
  }, []);
  
  // Update Windows 7 theme state
  useEffect(() => {
    const updateThemeState = () => {
      const newWin7State = checkWindows7Theme();
      setIsWindows7Theme(newWin7State);
    };
    
    updateThemeState();
    
    const headObserver = new MutationObserver((mutations) => {
      const linkMutation = mutations.some(mutation => 
        Array.from(mutation.addedNodes).some(node => 
          node.nodeName === 'LINK' || (node as Element)?.id === 'win7-css-link'
        ) ||
        Array.from(mutation.removedNodes).some(node => 
          node.nodeName === 'LINK' || (node as Element)?.id === 'win7-css-link'
        )
      );
      
      if (linkMutation) {
        updateThemeState();
      }
    });
    
    headObserver.observe(document.head, {
      childList: true,
      subtree: true
    });
    
    return () => {
      headObserver.disconnect();
    };
  }, [checkWindows7Theme]);

  // ✅ MOBILE: Force visibility on mount and theme changes
  useEffect(() => {
    if (isMobile && containerRef.current) {
      const container = containerRef.current;
      
      // Force visibility styles
      container.style.display = 'block';
      container.style.visibility = 'visible';
      container.style.opacity = '1';
      container.style.position = 'relative';
      container.style.zIndex = '10';
      container.style.flexShrink = '0';
      container.style.width = '100%';
      container.style.minHeight = '70px';
      container.style.maxHeight = '70px';
      
      console.log('[VideoInputArea] Mobile: Applied visibility styles');
    }
  }, [isMobile, isWindows7Theme]);

  // MOBILE: Track keyboard visibility
  useEffect(() => {
    if (!isMobile) return;
    
    // Store initial viewport height
    if (window.visualViewport) {
      setInitialViewportHeight(window.visualViewport.height);
    } else {
      setInitialViewportHeight(window.innerHeight);
    }
    
    const handleViewportChange = () => {
      if (window.visualViewport) {
        const currentHeight = window.visualViewport.height;
        const heightDifference = initialViewportHeight - currentHeight;
        
        // Keyboard is visible if viewport shrunk significantly (more than 150px)
        const keyboardNowVisible = heightDifference > 150;
        
        if (keyboardNowVisible !== keyboardVisible) {
          setKeyboardVisible(keyboardNowVisible);
          console.log('[VideoInputArea] Keyboard visibility changed:', keyboardNowVisible);
          
          // Scroll to bottom when keyboard opens/closes
          setTimeout(() => {
            onScrollToBottom();
          }, 100);
        }
      }
    };
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      return () => {
        window.visualViewport?.removeEventListener('resize', handleViewportChange);
      };
    }
  }, [isMobile, initialViewportHeight, keyboardVisible, onScrollToBottom]);

  // Function to add glass active classes to parent window
  useEffect(() => {
    if (isWindows7Theme) {
      const windowElements = document.querySelectorAll('.window, .window-body, .title-bar, .input-area, form, .themed-input');
      windowElements.forEach(element => {
        if (!element.classList.contains('glass')) {
          element.classList.add('glass');
        }
        if (!element.classList.contains('active')) {
          element.classList.add('active');
        }
      });
      
      console.log("[VideoInputArea] Added glass active classes to all elements");
    } else {
      const glassElements = document.querySelectorAll('.glass');
      glassElements.forEach(element => {
        element.classList.remove('glass');
        element.classList.remove('active');
      });
      console.log("[VideoInputArea] Removed glass active classes from all elements");
    }
  }, [isWindows7Theme]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed.length > 0 && !disabled) {
      onSend(trimmed);
      onChange('');
      // MOBILE: Force scroll to bottom after sending message
      setTimeout(() => onScrollToBottom(), 50);
    }
  }, [value, disabled, onSend, onChange, onScrollToBottom]);

  // IMPROVED: Handle input focus on mobile with better keyboard support
  const handleInputFocus = useCallback(() => {
    if (isMobile && inputRef.current) {
      // Prevent zoom on iOS by ensuring font-size is 16px
      inputRef.current.style.fontSize = '16px';
      
      // Scroll to bottom when input is focused on mobile
      setTimeout(() => onScrollToBottom(), 300);
      
      if (keyboardVisible) {
        setTimeout(() => onScrollToBottom(), 100);
      }
    }
  }, [isMobile, onScrollToBottom, keyboardVisible]);

  // MOBILE: Handle input blur
  const handleInputBlur = useCallback(() => {
    if (isMobile) {
      // Small delay to allow keyboard to close
      setTimeout(() => {
        if (window.visualViewport) {
          // Reset viewport
          window.scrollTo(0, 0);
        }
      }, 150);
    }
  }, [isMobile]);

  return (
    <div 
      ref={containerRef}
      className={cn(
        "flex-shrink-0 w-full input-area video-input-area",
        isWindows7Theme ? 'border-t dark:border-gray-600 glass-input-area' : 'status-bar',
        isMobile ? "p-2 mobile-input-area" : "p-2",
        // MOBILE: Add extra padding for keyboard visibility
        isMobile && keyboardVisible && "pb-4"
      )} 
      style={{ 
        height: `${isMobile ? 70 : 60}px`,
        minHeight: `${isMobile ? 70 : 60}px`,
        maxHeight: `${isMobile ? 70 : 60}px`,
        position: 'relative',
        zIndex: 10,
        display: 'block',
        visibility: 'visible',
        opacity: 1,
        flexShrink: 0,
        // MOBILE: Handle safe area and keyboard
        paddingBottom: isMobile ? (keyboardVisible ? '1rem' : 'env(safe-area-inset-bottom)') : undefined,
        // Force transparency for Windows 7 glass theme
        ...(isWindows7Theme && {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.2)'
        }),
        // ✅ MOBILE: Additional visibility enforcement
        ...(isMobile && {
          borderTop: '1px solid rgba(0,0,0,0.1)',
          backgroundColor: 'inherit'
        })
      }}
    >
      <form onSubmit={handleSubmit} className="w-full h-full">
        <div className="flex items-center w-full h-full gap-1">
          {/* Find/Stop/Skip Button - Fixed width */}
          <Button 
            onClick={onFindOrDisconnect} 
            disabled={findOrDisconnectDisabled} 
            className={cn(
              isWindows7Theme ? 'glass-button-styled glass-button' : '',
              isMobile 
                ? 'text-xs px-2 py-1 min-w-[50px] flex-shrink-0 touch-manipulation' 
                : 'text-sm px-3 py-1 min-w-[60px] flex-shrink-0'
            )} 
            style={{
              // Force transparency for Windows 7 glass theme
              ...(isWindows7Theme && {
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                color: '#000'
              })
            }}
            aria-label={findOrDisconnectText}
            type="button"
          >
            {findOrDisconnectText}
          </Button>
          
          {/* Message Input - Takes up remaining space */}
          <div className="flex-1 flex items-center gap-1">
            <Input 
              ref={inputRef}
              type="text" 
              value={value} 
              onChange={(e) => onChange(e.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              placeholder={isMobile ? "Type message..." : "Type a message..."} 
              className={cn(
                "w-full h-full",
                isMobile ? "text-base px-2" : "text-sm px-3",
                isWindows7Theme && "glass-input" // Add glass input class
              )} 
              style={{
                // MOBILE: Prevent zoom on iOS
                fontSize: isMobile ? '16px' : undefined,
                // Force transparency for Windows 7 glass theme
                ...(isWindows7Theme && {
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(5px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: '#000'
                })
              }}
              disabled={disabled} 
              aria-label="Video chat message input"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="sentences"
              maxLength={2000}
              // MOBILE: Additional attributes for better experience
              {...(isMobile && {
                inputMode: 'text',
                enterKeyHint: 'send'
              })}
            />
          </div>
          
          {/* Send Button - Fixed width */}
          <Button 
            type="submit"
            disabled={disabled || !value.trim()} 
            className={cn(
              isWindows7Theme ? 'glass-button-styled glass-button' : '',
              isMobile 
                ? 'text-xs px-2 py-1 min-w-[45px] flex-shrink-0 touch-manipulation' 
                : 'text-sm px-3 py-1 min-w-[60px] flex-shrink-0'
            )} 
            style={{
              // Force transparency for Windows 7 glass theme
              ...(isWindows7Theme && {
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                color: '#000'
              })
            }}
            aria-label="Send message"
          >
            {isMobile ? '→' : 'Send'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default VideoInputArea;