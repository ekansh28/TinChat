// src/app/chat/components/MessageRow.tsx - WITH CDN EMOJI SUPPORT
import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useProfilePopup } from '@/components/ProfilePopup/ProfilePopupProvider';
import { getDisplayNameClass, renderMessageWithEmojis, loadEmoteList } from '../utils/ChatHelpers';

interface MessageRowProps {
  message: {
    id?: string;
    content: string;
    sender: 'self' | 'partner' | 'system';
    timestamp?: number;
    senderUsername?: string;
    senderAuthId?: string;
    senderDisplayNameColor?: string;
    senderDisplayNameAnimation?: string;
    senderRainbowSpeed?: number;
  };
  theme: string;
  previousMessageSender?: 'self' | 'partner' | 'system';
  ownInfo: {
    username: string;
    authId: string | null;
    displayNameColor: string;
    displayNameAnimation: string;
  };
  partnerInfo?: {
    username: string;
    displayName?: string;
    avatar: string;
    displayNameColor?: string;
    displayNameAnimation?: string;
    rainbowSpeed?: number;
    authId?: string;
  };
  onUsernameClick: (authId: string, clickPosition: { x: number; y: number }) => void;
  isMobile: boolean; // Keep the prop but don't use it for different layouts
}

// CDN Configuration
const EMOJI_CDN_BASE = "https://cdn.sekansh21.workers.dev/emotes/";

const MessageRow: React.FC<MessageRowProps> = ({ 
  message, 
  theme, 
  previousMessageSender, 
  ownInfo,
  partnerInfo,
  onUsernameClick,
  isMobile // Ignored for layout purposes
}) => {
  const { showProfile } = useProfilePopup();
  
  // Load emote filenames from CDN
  const [emojiFilenames, setEmojiFilenames] = useState<string[]>([]);
  const [emotesLoading, setEmotesLoading] = useState(true);

  // Load emojis from CDN
  useEffect(() => {
    const loadEmojis = async () => {
      if (theme === 'theme-98') {
        setEmotesLoading(true);
        try {
          console.log('[MessageRow] Loading emojis from CDN');
          const filenames = await loadEmoteList();
          setEmojiFilenames(filenames);
          console.log('[MessageRow] Loaded', filenames.length, 'emojis from CDN');
        } catch (error) {
          console.error('[MessageRow] Error loading emojis:', error);
          setEmojiFilenames([]);
        } finally {
          setEmotesLoading(false);
        }
      } else {
        setEmotesLoading(false);
        setEmojiFilenames([]);
      }
    };

    loadEmojis();
  }, [theme]);

  // Prefetch profile data on hover
  const handleMouseEnter = useCallback(() => {
    if (message.sender === 'partner' && message.senderAuthId) {
      console.log('Prefetching profile for', message.senderAuthId);
    }
  }, [message.sender, message.senderAuthId]);

  // ✅ SYSTEM MESSAGES: Always centered (same for mobile and desktop)
  if (message.sender === 'system') {
    return (
      <div className="message-row system-message mb-2">
        <div className={cn(
          "text-center w-full text-xs italic",
          theme === 'theme-7' ? 'theme-7-text-shadow text-gray-100' : 'text-gray-500 dark:text-gray-400',
          isMobile && "py-2 px-3 bg-black bg-opacity-10 rounded-lg"
        )}>
          {message.content}
        </div>
      </div>
    );
  }

  // Divider logic - only for desktop theme-7
  const showDivider = useMemo(() => {
    return theme === 'theme-7' &&
      previousMessageSender &&
      ['self', 'partner'].includes(previousMessageSender) &&
      ['self', 'partner'].includes(message.sender) &&
      message.sender !== previousMessageSender;
  }, [theme, previousMessageSender, message.sender]);

  // Enhanced message content with CDN emojis
  const messageContent = useMemo(() => {
    if (theme === 'theme-98' && !emotesLoading && emojiFilenames.length > 0) {
      return renderMessageWithEmojis(message.content, emojiFilenames, EMOJI_CDN_BASE);
    }
    return [message.content];
  }, [message.content, theme, emojiFilenames, emotesLoading]);

  // Display name and styling logic
  const isSelf = message.sender === 'self';
  const displayName = isSelf 
    ? ownInfo.username 
    : message.senderUsername || partnerInfo?.displayName || partnerInfo?.username || "Stranger";
  
  const displayNameColor = isSelf
    ? ownInfo.displayNameColor
    : message.senderDisplayNameColor || partnerInfo?.displayNameColor || '#ff6b6b';
  
  const displayNameAnimation = isSelf
    ? ownInfo.displayNameAnimation
    : message.senderDisplayNameAnimation || partnerInfo?.displayNameAnimation || 'none';
  
  const rainbowSpeed = isSelf
    ? 3
    : message.senderRainbowSpeed || partnerInfo?.rainbowSpeed || 3;

  const authId = isSelf 
    ? ownInfo.authId 
    : message.senderAuthId || partnerInfo?.authId || null;

  const isClickable = !!authId && authId !== 'anonymous';
  const displayNameClass = getDisplayNameClass(displayNameAnimation);

  // Handle username click
  const handleUsernameClick = useCallback((e: React.MouseEvent) => {
    if (!isClickable || !authId) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickPosition = {
      x: rect.left + rect.width / 2,
      y: rect.bottom + 5
    };
    
    onUsernameClick(authId, clickPosition);
    showProfile(authId, e);
  }, [isClickable, authId, showProfile, onUsernameClick]);

  // Handle keyboard interaction
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isClickable || !authId) return;
    
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      
      const rect = e.currentTarget.getBoundingClientRect();
      const clickPosition = {
        x: rect.left + rect.width / 2,
        y: rect.bottom + 5
      };
      
      onUsernameClick(authId, clickPosition);
      
      const fakeEvent = {
        target: e.currentTarget,
        currentTarget: e.currentTarget,
        preventDefault: () => {},
        stopPropagation: () => {}
      };
      
      showProfile(authId, fakeEvent as unknown as React.MouseEvent);
    }
  }, [isClickable, authId, showProfile, onUsernameClick]);

  // Display name style
  const getDisplayNameStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {};
    
    if (displayNameAnimation === 'rainbow') {
      baseStyle.animationDuration = `${rainbowSpeed}s`;
    } else if (displayNameAnimation === 'gradient') {
      baseStyle.animationDuration = `4s`;
    } else {
      baseStyle.color = displayNameColor || (isSelf ? '#0066cc' : '#ff0000'); // changed from white to red
    }
    
    return baseStyle;
  };

  // Username component
  const UsernameComponent = ({ children }: { children: React.ReactNode }) => {
    return (
      <span
        className={cn(
          "font-bold mr-1 cursor-pointer hover:underline transition-all duration-200",
          displayNameClass
        )}
        style={getDisplayNameStyle()}
        onClick={isClickable && authId ? (e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const clickPosition = {
            x: rect.left + rect.width / 2,
            y: rect.bottom + 5
          };
          onUsernameClick(authId, clickPosition);
          showProfile(authId, e);
        } : undefined}
        tabIndex={0}
        role="button"
        aria-label={`View ${displayName}'s profile`}
        data-user-id={authId}
      >
        {children}
      </span>
    );
  };

  // ✅ UNIFIED LAYOUT: Always use desktop-style layout (no mobile bubbles)
  return (
    <>
      {showDivider && (
        <div
          className="h-[2px] border border-[#CEDCE5] bg-[#64B2CF] mb-1"
          aria-hidden="true"
        />
      )}
      <div className={cn(
        "break-words message-row", 
        "mb-1",
        message.sender === 'self' && "ml-2",
        message.sender === 'partner' && "mr-2"
      )}>
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <UsernameComponent>
              {displayName}:
            </UsernameComponent>
            <span className={cn(
              theme === 'theme-7' && 'theme-7-text-shadow',
              "break-words hyphens-auto"
            )}>
              {emotesLoading && theme === 'theme-98' ? (
                <span className="opacity-75">Loading emojis...</span>
              ) : (
                messageContent
              )}
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default MessageRow;