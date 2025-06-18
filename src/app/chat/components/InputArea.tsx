// src/app/chat/components/InputArea.tsx - WITH CDN EMOJI PICKER
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button-themed';
import { Input } from '@/components/ui/input-themed';

interface InputAreaProps {
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

// CDN URLs
const EMOJI_CDN_BASE = "https://cdn.sekansh21.workers.dev/emotes/";
const EMOJI_INDEX_URL = "/emote_index.json";

// Static emoji for the button icon
const STATIC_DISPLAY_EMOJI_FILENAMES = [
  'confused.gif', 'cool.gif','cry.gif','eek.gif','evil.gif'
];
const SMILE_EMOJI_FILENAME = 'biggrin.gif';

interface EmoteData {
  filename: string;
  width: number;
  height: number;
  size_bytes?: number;
}

const InputArea: React.FC<InputAreaProps> = ({ 
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
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const hoverIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [currentEmojiIconUrl, setCurrentEmojiIconUrl] = useState(() => 
    `${EMOJI_CDN_BASE}${SMILE_EMOJI_FILENAME}`
  );
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [emotes, setEmotes] = useState<EmoteData[]>([]);
  const [emotesLoading, setEmotesLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
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

  // Load emotes from CDN
  const loadEmotes = useCallback(async () => {
    if (emotes.length > 0) return; // Already loaded
    
    setEmotesLoading(true);
    try {
      console.log('[InputArea] Loading emotes from CDN:', EMOJI_INDEX_URL);
      const response = await fetch(EMOJI_INDEX_URL);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: EmoteData[] = await response.json();
      console.log('[InputArea] Loaded', data.length, 'emotes from CDN');
      setEmotes(data);
    } catch (error) {
      console.error('[InputArea] Failed to load emotes:', error);
      setEmotes([]);
    } finally {
      setEmotesLoading(false);
    }
  }, [emotes.length]);

  // Filter emotes based on search term
  const filteredEmotes = React.useMemo(() => {
    if (!searchTerm.trim()) return emotes;
    
    const term = searchTerm.toLowerCase();
    return emotes.filter(emote => 
      emote.filename.toLowerCase().includes(term)
    );
  }, [emotes, searchTerm]);

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
      
      console.log('[InputArea] Mobile: Applied visibility styles');
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
          console.log('Keyboard visibility changed:', keyboardNowVisible);
          
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
      
      console.log("InputArea: Added glass active classes to all elements");
    } else {
      const glassElements = document.querySelectorAll('.glass');
      glassElements.forEach(element => {
        element.classList.remove('glass');
        element.classList.remove('active');
      });
      console.log("InputArea: Removed glass active classes from all elements");
    }
  }, [isWindows7Theme]);

  // Handle emoji picker clicks outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const emojiIconTrigger = document.getElementById('emoji-icon-trigger');
      if (emojiPickerRef.current && 
          !emojiPickerRef.current.contains(event.target as Node) && 
          emojiIconTrigger && 
          !emojiIconTrigger.contains(event.target as Node)) {
        setIsEmojiPickerOpen(false);
      }
    };
    if (isEmojiPickerOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEmojiPickerOpen]);

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

  const handleEmojiIconHover = useCallback(() => {
    if (hoverIntervalRef.current) clearInterval(hoverIntervalRef.current);
    if (STATIC_DISPLAY_EMOJI_FILENAMES.length === 0) return;
    hoverIntervalRef.current = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * STATIC_DISPLAY_EMOJI_FILENAMES.length);
      setCurrentEmojiIconUrl(`${EMOJI_CDN_BASE}${STATIC_DISPLAY_EMOJI_FILENAMES[randomIndex]}`);
    }, 300);
  }, []);

  const stopEmojiCycle = useCallback(() => {
    if (hoverIntervalRef.current) clearInterval(hoverIntervalRef.current);
    hoverIntervalRef.current = null;
    setCurrentEmojiIconUrl(`${EMOJI_CDN_BASE}${SMILE_EMOJI_FILENAME}`);
  }, []);

  const toggleEmojiPicker = useCallback(async () => {
    if (!isEmojiPickerOpen) {
      // Load emotes when opening picker
      await loadEmotes();
    }
    setIsEmojiPickerOpen(prev => !prev);
    setSearchTerm(''); // Reset search when opening
  }, [isEmojiPickerOpen, loadEmotes]);

  // Handle emote selection
  const handleEmoteSelect = useCallback((emote: EmoteData) => {
    const shortcode = emote.filename.split('.')[0]; // Remove file extension
    const emoteText = `:${shortcode}: `;
    
    // Insert emote into current message
    onChange(value + emoteText);
    
    // Focus back to input after selection
    if (inputRef.current) {
      inputRef.current.focus();
    }
    
    // Close picker
    setIsEmojiPickerOpen(false);
    
    console.log('[InputArea] Inserted emote:', emoteText);
  }, [value, onChange]);

  return (
    <div 
      ref={containerRef}
      className={cn(
        "flex-shrink-0 w-full input-area",
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
              aria-label="Chat message input"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="sentences"
              // MOBILE: Additional attributes for better experience
              {...(isMobile && {
                inputMode: 'text',
                enterKeyHint: 'send'
              })}
            />
            
            {/* Emoji Picker - Only on desktop theme-98 */}
            {theme === 'theme-98' && !isMobile && (
              <div className="relative flex-shrink-0">
                <img 
                  id="emoji-icon-trigger" 
                  src={currentEmojiIconUrl} 
                  alt="Emoji" 
                  className="w-4 h-4 cursor-pointer hover:scale-110 transition-transform" 
                  onMouseEnter={handleEmojiIconHover} 
                  onMouseLeave={stopEmojiCycle} 
                  onClick={toggleEmojiPicker} 
                  data-ai-hint="emoji icon" 
                  tabIndex={0} 
                  onKeyDown={(e) => e.key === 'Enter' && toggleEmojiPicker()} 
                  role="button" 
                  aria-haspopup="true" 
                  aria-expanded={isEmojiPickerOpen} 
                />
                
                {/* CDN Emoji Picker */}
                {isEmojiPickerOpen && (
                  <div 
                    ref={emojiPickerRef} 
                    className="absolute bottom-full right-0 mb-1 w-64 bg-silver border border-raised z-30 window shadow-lg" 
                    style={{ 
                      boxShadow: 'inset 1px 1px #fff, inset -1px -1px gray, 1px 1px gray',
                      maxHeight: '320px'
                    }} 
                    role="dialog" 
                    aria-label="Emoji picker"
                  >
                    {/* Compact Header */}
                    <div className="flex items-center justify-between px-2 py-1 border-b border-gray-400 bg-navy text-white">
                      <h3 className="text-xs font-medium">Emojis</h3>
                      <button
                        type="button"
                        onClick={() => setIsEmojiPickerOpen(false)}
                        className="text-white hover:text-gray-300 text-sm leading-none w-4 h-4 flex items-center justify-center"
                        aria-label="Close emoji picker"
                      >
                        ×
                      </button>
                    </div>

                    {/* Compact Search */}
                    <div className="p-1">
                      <input
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-400 rounded"
                        autoFocus
                      />
                    </div>

                    {/* Emoji Grid - No horizontal scroll, fixed columns */}
                    <div 
                      className="p-1 overflow-y-auto overflow-x-hidden" 
                      style={{ 
                        maxHeight: '240px',
                        minHeight: '120px'
                      }}
                    >
                      {emotesLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mx-auto mb-1"></div>
                            <p className="text-xs text-gray-600">Loading...</p>
                          </div>
                        </div>
                      ) : filteredEmotes.length === 0 ? (
                        <div className="text-center py-4 text-gray-500">
                          {searchTerm ? (
                            <>
                              <p className="mb-1 text-xs">No results</p>
                              <button 
                                onClick={() => setSearchTerm('')}
                                className="text-blue-600 hover:text-blue-800 underline text-xs"
                                type="button"
                              >
                                Clear
                              </button>
                            </>
                          ) : (
                            <p className="text-xs">No emojis</p>
                          )}
                        </div>
                      ) : (
                        <div 
                          className="grid gap-1" 
                          style={{ 
                            gridTemplateColumns: 'repeat(8, 1fr)',
                            width: '100%'
                          }}
                        >
                          {filteredEmotes.map((emote, index) => {
                            const shortcode = emote.filename.split('.')[0];
                            
                            return (
                              <div 
                                key={`${emote.filename}-${index}`}
                                className="flex items-center justify-center p-1 rounded cursor-pointer transition-all duration-200 hover:bg-gray-200 hover:scale-110 aspect-square"
                                onClick={() => handleEmoteSelect(emote)}
                                title={`:${shortcode}:`}
                                role="button"
                                aria-label={`Insert ${shortcode} emoji`}
                                style={{ 
                                  minWidth: '24px',
                                  maxWidth: '28px',
                                  minHeight: '24px',
                                  maxHeight: '28px'
                                }}
                              >
                                <img
                                  src={`${EMOJI_CDN_BASE}${emote.filename}`}
                                  alt={shortcode}
                                  className="max-w-full max-h-full object-contain"
                                  style={{
                                    width: 'auto',
                                    height: 'auto',
                                    maxWidth: '20px',
                                    maxHeight: '20px'
                                  }}
                                  loading="lazy"
                                  onError={(e) => {
                                    const img = e.target as HTMLImageElement;
                                    img.style.display = 'none';
                                    console.warn('Failed to load emoji:', emote.filename);
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Compact Stats Footer */}
                    <div className="px-2 py-1 text-xs text-gray-600 bg-gray-100 border-t border-gray-400 text-center">
                      {filteredEmotes.length} emoji{filteredEmotes.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                )}
              </div>
            )}
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

export default InputArea;