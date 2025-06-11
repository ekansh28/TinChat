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

// Emoji constants
const EMOJI_BASE_URL_DISPLAY = "./display/";
const STATIC_DISPLAY_EMOJI_FILENAMES = [
  'confused.gif', 'cool.gif','cry.gif','eek.gif','evil.gif'
];
const SMILE_EMOJI_FILENAME = 'biggrin.gif';
const EMOJI_BASE_URL_PICKER = "/emotes/";

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
  
  const [currentEmojiIconUrl, setCurrentEmojiIconUrl] = useState(() => 
    `${EMOJI_BASE_URL_DISPLAY}${SMILE_EMOJI_FILENAME}`
  );
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [pickerEmojiFilenames, setPickerEmojiFilenames] = useState<string[]>([]);
  const [emojisLoading, setEmojisLoading] = useState(true);

  // Load emojis for theme-98
  useEffect(() => {
    if (theme === 'theme-98') {
      setEmojisLoading(true);
      fetch('/emote_index.json')
        .then(res => { 
          if (!res.ok) throw new Error(`HTTP ${res.status}`); 
          return res.json(); 
        })
        .then((data: any[]) => setPickerEmojiFilenames(data.map(e => e.filename)))
        .catch(err => {
          console.error('Error fetching emote_index.json:', err);
          setPickerEmojiFilenames([]);
        })
        .finally(() => setEmojisLoading(false));
    } else {
      setEmojisLoading(false);
      setPickerEmojiFilenames([]);
    }
  }, [theme]);

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
      // Force scroll to bottom after sending message
      setTimeout(() => onScrollToBottom(), 50);
    }
  }, [value, disabled, onSend, onChange, onScrollToBottom]);

  // Handle input focus on mobile to prevent viewport issues
  const handleInputFocus = useCallback(() => {
    if (isMobile && inputRef.current) {
      // Scroll to bottom when input is focused on mobile
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

  const toggleEmojiPicker = useCallback(() => setIsEmojiPickerOpen(prev => !prev), []);

  return (
    <div className={cn(
      "flex-shrink-0 w-full",
      theme === 'theme-7' ? 'input-area border-t dark:border-gray-600' : 'input-area status-bar',
      isMobile ? "p-2" : "p-2"
    )} 
    style={{ 
      height: `${isMobile ? 70 : 60}px`,
      paddingBottom: isMobile ? 'env(safe-area-inset-bottom)' : undefined
    }}>
      <form onSubmit={handleSubmit} className="w-full h-full">
        <div className="flex items-center w-full h-full gap-1">
          {/* Find/Stop/Skip Button - Fixed width */}
          <Button 
            onClick={onFindOrDisconnect} 
            disabled={findOrDisconnectDisabled} 
            className={cn(
              theme === 'theme-7' ? 'glass-button-styled' : '',
              isMobile 
                ? 'text-xs px-2 py-1 min-w-[50px] flex-shrink-0' 
                : 'text-sm px-3 py-1 min-w-[60px] flex-shrink-0'
            )} 
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
              placeholder={isMobile ? "Type message..." : "Type a message..."} 
              className={cn(
                "w-full h-full",
                isMobile ? "text-base px-2" : "text-sm px-3" // Prevent zoom on iOS
              )} 
              disabled={disabled} 
              aria-label="Chat message input"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="sentences"
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
                {isEmojiPickerOpen && (
                  <div 
                    ref={emojiPickerRef} 
                    className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-silver border border-raised z-30 window shadow-lg" 
                    style={{ boxShadow: 'inset 1px 1px #fff, inset -1px -1px gray, 1px 1px gray' }} 
                    role="dialog" 
                    aria-label="Emoji picker"
                  >
                    {emojisLoading ? (
                      <p className="text-center w-full text-xs">Loading emojis...</p>
                    ) : pickerEmojiFilenames.length > 0 ? (
                      <div className="h-32 overflow-y-auto grid grid-cols-4 gap-1" role="grid">
                        {pickerEmojiFilenames.map((filename) => {
                          const shortcode = filename.split('.')[0];
                          return (
                            <img 
                              key={filename} 
                              src={`${EMOJI_BASE_URL_PICKER}${filename}`} 
                              alt={shortcode} 
                              className="max-w-6 max-h-6 object-contain cursor-pointer hover:bg-navy hover:p-0.5 rounded" 
                              onClick={() => { 
                                onChange(`${value} :${shortcode}: `); 
                                setIsEmojiPickerOpen(false); 
                              }} 
                              data-ai-hint="emoji symbol" 
                              role="gridcell" 
                              tabIndex={0} 
                              onKeyDown={(e) => e.key === 'Enter' && (() => { 
                                onChange(`${value} :${shortcode}: `); 
                                setIsEmojiPickerOpen(false); 
                              })()} 
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-center w-full text-xs">No emojis found.</p>
                    )}
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
              theme === 'theme-7' ? 'glass-button-styled' : '',
              isMobile 
                ? 'text-xs px-2 py-1 min-w-[45px] flex-shrink-0' 
                : 'text-sm px-3 py-1 min-w-[60px] flex-shrink-0'
            )} 
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