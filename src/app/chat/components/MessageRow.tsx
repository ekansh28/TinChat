// src/app/chat/components/MessageRow.tsx - Enhanced with mobile bubbles
import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useProfilePopup } from '@/components/ProfilePopup/ProfilePopupProvider';
import { getDisplayNameClass, renderMessageWithEmojis } from '../utils/ChatHelpers';

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
  isMobile: boolean;
}

// Emote system constants
const EMOJI_BASE_URL_PICKER = "/emotes/";

const MessageRow: React.FC<MessageRowProps> = ({ 
  message, 
  theme, 
  previousMessageSender, 
  ownInfo,
  partnerInfo,
  onUsernameClick,
  isMobile
}) => {
  const { showProfile } = useProfilePopup();
  
  // Load emote filenames for proper rendering
  const [pickerEmojiFilenames, setPickerEmojiFilenames] = useState<string[]>([]);
  const [emotesLoading, setEmotesLoading] = useState(true);

  // Load emojis for theme-98 (same as InputArea)
  useEffect(() => {
    if (theme === 'theme-98') {
      setEmotesLoading(true);
      fetch('/emote_index.json')
        .then(res => { 
          if (!res.ok) throw new Error(`HTTP ${res.status}`); 
          return res.json(); 
        })
        .then((data: any[]) => {
          const filenames = data.map(e => e.filename);
          setPickerEmojiFilenames(filenames);
        })
        .catch(err => {
          console.error('Error fetching emote_index.json in MessageRow:', err);
          setPickerEmojiFilenames([]);
        })
        .finally(() => setEmotesLoading(false));
    } else {
      setEmotesLoading(false);
      setPickerEmojiFilenames([]);
    }
  }, [theme]);

  // Prefetch profile data on hover
  const handleMouseEnter = useCallback(() => {
    if (message.sender === 'partner' && message.senderAuthId) {
      console.log('Prefetching profile for', message.senderAuthId);
    }
  }, [message.sender, message.senderAuthId]);

  // ✅ SYSTEM MESSAGES: Always centered
  if (message.sender === 'system') {
    return (
      <div className={cn(
        "message-row system-message",
        isMobile ? "mobile-message-system mb-2 mx-4" : "mb-2"
      )}>
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

  // Divider logic for desktop
  const showDivider = useMemo(() => {
    return !isMobile && // ✅ Only show dividers on desktop
      theme === 'theme-7' &&
      previousMessageSender &&
      ['self', 'partner'].includes(previousMessageSender) &&
      ['self', 'partner'].includes(message.sender) &&
      message.sender !== previousMessageSender;
  }, [theme, previousMessageSender, message.sender, isMobile]);

  // Enhanced message content with emojis
  const messageContent = useMemo(() => {
    if (theme === 'theme-98' && !emotesLoading) {
      return renderMessageWithEmojis(message.content, pickerEmojiFilenames, EMOJI_BASE_URL_PICKER);
    }
    return [message.content];
  }, [message.content, theme, pickerEmojiFilenames, emotesLoading]);

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
      baseStyle.color = displayNameColor || (isSelf ? '#0066cc' : '#ff6b6b');
    }
    
    return baseStyle;
  };

  // Username component
  const UsernameComponent = ({ children }: { children: React.ReactNode }) => {
    if (isClickable) {
      return (
        <button
          onClick={handleUsernameClick}
          onKeyDown={handleKeyDown}
          onMouseEnter={handleMouseEnter}
          className={cn(
            "font-bold",
            displayNameClass,
            "cursor-pointer transition-all duration-200 hover:underline hover:scale-105",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded",
            isMobile && "active:underline active:scale-105 touch-manipulation",
            // ✅ MOBILE: Remove margin for bubble layout
            isMobile ? "" : "mr-1"
          )}
          style={getDisplayNameStyle()}
          aria-label={`View ${displayName}'s profile`}
          data-user-id={authId}
          type="button"
          tabIndex={0}
        >
          {children}
        </button>
      );
    }
    
    return (
      <span 
        className={cn(
          "font-bold",
          displayNameClass,
          // ✅ MOBILE: Remove margin for bubble layout
          isMobile ? "" : "mr-1"
        )}
        style={getDisplayNameStyle()}
      >
        {children}
      </span>
    );
  };

  // ✅ MOBILE vs DESKTOP: Different layouts
  if (isMobile) {
    // ✅ MOBILE: Bubble layout (WhatsApp/iMessage style)
    return (
      <>
        {showDivider && (
          <div
            className="h-[2px] border border-[#CEDCE5] bg-[#64B2CF] mb-1"
            aria-hidden="true"
          />
        )}
        <div className={cn(
          "message-row message-appear w-full flex",
          isSelf ? "justify-end" : "justify-start",
          "mb-1"
        )}>
          <div className={cn(
            "message-bubble max-w-[80%] px-3 py-2 rounded-2xl break-words",
            isSelf 
              ? "message-bubble-self bg-blue-500 text-white ml-[20%] rounded-br-md" 
              : "message-bubble-partner bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 mr-[20%] rounded-bl-md",
            // Theme-specific styles
            theme === 'theme-98' && isSelf && "bg-navy border border-gray-600",
            theme === 'theme-98' && !isSelf && "bg-silver border border-gray-600 text-black",
            theme === 'theme-7' && "backdrop-blur-sm"
          )}>
            {/* Username for partner messages or if different from previous */}
            {(!isSelf || (previousMessageSender !== message.sender)) && (
              <div className={cn(
                "text-xs opacity-75 mb-1",
                isSelf ? "text-blue-100" : "text-gray-600 dark:text-gray-400"
              )}>
                <UsernameComponent>
                  {displayName}
                </UsernameComponent>
              </div>
            )}
            
            {/* Message content */}
            <div className={cn(
              "text-sm leading-relaxed",
              emotesLoading && "opacity-75"
            )}>
              {emotesLoading ? (
                <span>Loading emotes...</span>
              ) : (
                messageContent
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  // ✅ DESKTOP: Traditional layout
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
              {emotesLoading ? (
                <span className="opacity-75">Loading emotes...</span>
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