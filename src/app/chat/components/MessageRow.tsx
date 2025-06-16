// src/app/chat/components/MessageRow.tsx - Fixed version
import React, { useMemo, useCallback } from 'react';
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

// For theme-98 emoji support
const EMOJI_BASE_URL_PICKER = "/emotes/";
const pickerEmojiFilenames: string[] = []; // This would be loaded from your emoji system

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

  // Prefetch profile data on hover
  const handleMouseEnter = useCallback(() => {
    if (message.sender === 'partner' && message.senderAuthId) {
      // Implement your prefetch logic here
      console.log('Prefetching profile for', message.senderAuthId);
    }
  }, [message.sender, message.senderAuthId]);

  if (message.sender === 'system') {
    return (
      <div className={cn(
        "mb-2 message-row",
        isMobile && "mb-1"
      )}>
        <div className={cn(
          "text-center w-full text-xs italic",
          theme === 'theme-7' ? 'theme-7-text-shadow text-gray-100' : 'text-gray-500 dark:text-gray-400',
          isMobile && "py-1 px-2 bg-black bg-opacity-10 rounded"
        )}>
          {message.content}
        </div>
      </div>
    );
  }

  // Divider logic for chronological order
  const showDivider = useMemo(() => {
    return theme === 'theme-7' &&
      previousMessageSender &&
      ['self', 'partner'].includes(previousMessageSender) &&
      ['self', 'partner'].includes(message.sender) &&
      message.sender !== previousMessageSender;
  }, [theme, previousMessageSender, message.sender]);

  const messageContent = useMemo(() => (
    theme === 'theme-98'
    ? renderMessageWithEmojis(message.content, pickerEmojiFilenames, EMOJI_BASE_URL_PICKER)
    : [message.content]
  ), [message.content, theme]);

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
    ? 3 // Default for own messages
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
    
    // Call the original onUsernameClick handler for backwards compatibility
    onUsernameClick(authId, clickPosition);
    
    // Show the profile popup using the new system (only 2 parameters)
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
      
      // For keyboard events, we'll simulate a click at the calculated position
      // Create a more targeted approach - just trigger the popup with position data
      const fakeEvent = {
        target: e.currentTarget,
        currentTarget: e.currentTarget,
        preventDefault: () => {},
        stopPropagation: () => {}
      };
      
      // Cast to unknown first, then to the expected type to avoid TypeScript errors
      showProfile(authId, fakeEvent as unknown as React.MouseEvent);
    }
  }, [isClickable, authId, showProfile, onUsernameClick]);

  // Display name style with proper fallbacks
  const getDisplayNameStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {};
    
    if (displayNameAnimation === 'rainbow') {
      baseStyle.animationDuration = `${rainbowSpeed}s`;
      // For rainbow, we don't set color as it's handled by CSS animation
    } else if (displayNameAnimation === 'gradient') {
      baseStyle.animationDuration = `4s`;
      // For gradient, we don't set color as it's handled by CSS animation
    } else {
      baseStyle.color = displayNameColor || (isSelf ? '#0066cc' : '#ff6b6b');
    }
    
    return baseStyle;
  };

  // Username component that handles clickable vs non-clickable states
  const UsernameComponent = ({ children }: { children: React.ReactNode }) => {
    if (isClickable) {
      return (
        <button
          onClick={handleUsernameClick}
          onKeyDown={handleKeyDown}
          onMouseEnter={handleMouseEnter}
          className={cn(
            "font-bold mr-1",
            displayNameClass,
            "cursor-pointer transition-all duration-200 hover:underline hover:scale-105",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded",
            isMobile && "active:underline active:scale-105 touch-manipulation"
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
        className={cn("font-bold mr-1", displayNameClass)}
        style={getDisplayNameStyle()}
      >
        {children}
      </span>
    );
  };

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
        isMobile ? "mb-1 text-sm leading-relaxed py-0.5" : "mb-1",
        isMobile && message.sender === 'self' && "ml-2",
        isMobile && message.sender === 'partner' && "mr-2"
      )}>
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <UsernameComponent>
              {displayName}:
            </UsernameComponent>
            <span className={cn(
              theme === 'theme-7' && 'theme-7-text-shadow',
              isMobile && "break-words hyphens-auto"
            )}>
              {messageContent}
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default MessageRow;