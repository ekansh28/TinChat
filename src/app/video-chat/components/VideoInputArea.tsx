// src/app/video-chat/components/VideoInputArea.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button-themed';
import { Input } from '@/components/ui/input-themed';
import EmoteGallery from '@/components/EmoteGallery';

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

// Emoji constants
const EMOJI_BASE_URL_DISPLAY = "./display/";
const STATIC_DISPLAY_EMOJI_FILENAMES = [
  'confused.gif', 'cool.gif','cry.gif','eek.gif','evil.gif'
];
const SMILE_EMOJI_FILENAME = 'biggrin.gif';

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
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const hoverIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [currentEmojiIconUrl, setCurrentEmojiIconUrl] = useState(() => 
    `${EMOJI_BASE_URL_DISPLAY}${SMILE_EMOJI_FILENAME}`
  );
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [showEmoteGallery, setShowEmoteGallery] = useState(false);
  const [activeTab, setActiveTab] = useState<'quick' | 'gallery'>('quick');
  
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

  // Handle emoji picker clicks outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const emojiIconTrigger = document.getElementById('emoji-icon-trigger-video');
      if (emojiPickerRef.current && 
          !emojiPickerRef.current.contains(event.target as Node) && 
          emojiIconTrigger && 
          !emojiIconTrigger.contains(event.target as Node)) {
        setIsEmojiPickerOpen(false);
        setShowEmoteGallery(false);
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
      setTimeout(() => onScrollToBottom(), 50);
    }
  }, [value, disabled, onSend, onChange, onScrollToBottom]);

  const handleInputFocus = useCallback(() => {
    if (isMobile && inputRef.current) {
      inputRef.current.style.fontSize = '16px';
      setTimeout(() => onScrollToBottom(), 300);
    }
  }, [isMobile, onScrollToBottom]);

  const handleEmojiIconHover = useCallback(() => {
    if (hoverIntervalRef.current) clearInterval(hoverIntervalRef.current);
    if (STATIC_DISPLAY_EMOJI_FILENAMES.length === 0) return;
    hoverIntervalRef.current = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * STATIC_DISPLAY_EMOJI_FILENAMES.length);
      setCurrentEmojiIconUrl(`${EMOJI_BASE_URL_DISPLAY}${STATIC_DISPLAY_EMOJI_FILENAMES[randomIndex]}`);
    }, 300);
  }, []);

  const stopEmojiCycle = useCallback(() => {
    if (hoverIntervalRef.current) clearInterval(hoverIntervalRef.current);
    hoverIntervalRef.current = null;
    setCurrentEmojiIconUrl(`${EMOJI_BASE_URL_DISPLAY}${SMILE_EMOJI_FILENAME}`);
  }, []);

  const toggleEmojiPicker = useCallback(() => {
    setIsEmojiPickerOpen(prev => !prev);
    if (!isEmojiPickerOpen) {
      setShowEmoteGallery(false);
      setActiveTab('quick');
    }
  }, [isEmojiPickerOpen]);

  const handleEmoteSelect = useCallback((shortcode: string) => {
    const emoteText = `:${shortcode}: `;
    onChange(value + emoteText);
    
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [value, onChange]);

  return (
    <div className={cn(
      "flex-shrink-0 w-full",
      isWindows7Theme ? 'input-area border-t dark:border-gray-600 glass-input-area' : 'input-area status-bar',
      isMobile ? "p-2 mobile-input-area" : "p-2"
    )} 
    style={{ 
      height: `${isMobile ? 70 : 60}px`,
      minHeight: `${isMobile ? 70 : 60}px`,
      maxHeight: `${isMobile ? 70 : 60}px`,
      ...(isWindows7Theme && {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.2)'
      })
    }}>
      <form onSubmit={handleSubmit} className="w-full h-full">
        <div className="flex items-center w-full h-full gap-1">
          {/* Find/Stop/Skip Button */}
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
          
          {/* Message Input */}
          <div className="flex-1 flex items-center gap-1">
            <Input 
              ref={inputRef}
              type="text" 
              value={value} 
              onChange={(e) => onChange(e.target.value)}
              onFocus={handleInputFocus}
              placeholder={isMobile ? "Type message..." : "Type a message..."} 
              className={cn(
                "w-full h-full",
                isMobile ? "text-base px-2" : "text-sm px-3",
                isWindows7Theme && "glass-input"
              )} 
              style={{
                fontSize: isMobile ? '16px' : undefined,
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
              {...(isMobile && {
                inputMode: 'text',
                enterKeyHint: 'send'
              })}
            />
            
            {/* Emoji/Emote Picker - Only on desktop theme-98 */}
            {theme === 'theme-98' && !isMobile && (
              <div className="relative flex-shrink-0">
                <img 
                  id="emoji-icon-trigger-video" 
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
                
                {/* Emoji/Emote Picker with tabs */}
                {isEmojiPickerOpen && (
                  <div 
                    ref={emojiPickerRef} 
                    className="absolute bottom-full right-0 mb-2 w-80 bg-silver border border-raised z-30 window shadow-lg" 
                    style={{ 
                      boxShadow: 'inset 1px 1px #fff, inset -1px -1px gray, 1px 1px gray',
                      maxHeight: '400px'
                    }} 
                    role="dialog" 
                    aria-label="Emoji and emote picker"
                  >
                    {/* Tab Headers */}
                    <div className="flex border-b border-gray-400">
                      <button
                        type="button"
                        onClick={() => setActiveTab('quick')}
                        className={cn(
                          "flex-1 px-3 py-2 text-xs font-medium transition-colors",
                          activeTab === 'quick' 
                            ? "bg-navy text-white" 
                            : "bg-silver hover:bg-gray-300"
                        )}
                      >
                        🙂 Quick
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('gallery');
                          setShowEmoteGallery(true);
                        }}
                        className={cn(
                          "flex-1 px-3 py-2 text-xs font-medium transition-colors",
                          activeTab === 'gallery' 
                            ? "bg-navy text-white" 
                            : "bg-silver hover:bg-gray-300"
                        )}
                      >
                        🎭 Gallery
                      </button>
                    </div>

                    {/* Tab Content */}
                    <div className="p-2" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      {activeTab === 'quick' && (
                        <div>
                          <p className="text-center w-full text-xs mb-2">Quick emojis loading...</p>
                          <div className="text-center text-xs text-gray-600">
                            Switch to Gallery tab for full emote collection
                          </div>
                        </div>
                      )}
                      
                      {activeTab === 'gallery' && showEmoteGallery && (
                        <EmoteGallery 
                          onEmoteSelect={handleEmoteSelect}
                          isModal={true}
                          maxHeight="250px"
                          searchable={true}
                          className="emote-picker-gallery"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Send Button */}
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