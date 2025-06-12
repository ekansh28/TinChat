import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
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
  if (message.sender === 'system') {
    return (
      <div className="mb-2">
        <div className={cn(
          "text-center w-full text-xs italic",
           theme === 'theme-7' ? 'theme-7-text-shadow text-gray-100' : 'text-gray-500 dark:text-gray-400'
        )}>
          {message.content}
        </div>
      </div>
    );
  }

  const showDivider =
    theme === 'theme-7' &&
    previousMessageSender &&
    ['self', 'partner'].includes(previousMessageSender) &&
    ['self', 'partner'].includes(message.sender) &&
    message.sender !== previousMessageSender;

  const messageContent = useMemo(() => (
    theme === 'theme-98'
    ? renderMessageWithEmojis(message.content, pickerEmojiFilenames, EMOJI_BASE_URL_PICKER)
    : [message.content]
  ), [message.content, theme]);

  // IMPROVED: Better display name and styling logic with proper fallbacks
  let displayName: string;
  let displayNameColor: string;
  let displayNameAnimation: string;
  let rainbowSpeed: number;
  let authIdToUse: string | null;

  if (message.sender === 'self') {
    displayName = ownInfo.username;
    displayNameColor = ownInfo.displayNameColor || '#0066cc';
    displayNameAnimation = ownInfo.displayNameAnimation || 'none';
    rainbowSpeed = 3; // Default for own messages
    authIdToUse = ownInfo.authId;
  } else {
    // FIXED: For partner messages, prioritize message data over cached partner info
    // This ensures the most recent styling is always used
    displayName = message.senderUsername || partnerInfo?.displayName || partnerInfo?.username || "Stranger";
    
    // FIXED: Ensure proper color fallback and better default colors
    if (message.senderDisplayNameColor) {
      displayNameColor = message.senderDisplayNameColor;
    } else if (partnerInfo?.displayNameColor) {
      displayNameColor = partnerInfo.displayNameColor;
    } else {
      // Better fallback color that's more visible
      displayNameColor = '#ff6b6b'; // Softer red that's more visible
    }
    
    displayNameAnimation = message.senderDisplayNameAnimation || 
                          partnerInfo?.displayNameAnimation || 
                          'none';
    
    rainbowSpeed = message.senderRainbowSpeed || partnerInfo?.rainbowSpeed || 3;
    authIdToUse = message.senderAuthId || partnerInfo?.authId || null;
  }

  // DEBUGGING: Log color values to help troubleshoot
  if (message.sender === 'partner') {
    console.log('MessageRow Partner Color Debug:', {
      messageColor: message.senderDisplayNameColor,
      partnerInfoColor: partnerInfo?.displayNameColor,
      finalColor: displayNameColor,
      username: displayName
    });
  }

  const isClickable = authIdToUse && authIdToUse !== 'anonymous' && authIdToUse !== null;
  const displayNameClass = getDisplayNameClass(displayNameAnimation);

  // Enhanced styling logic to ensure colors are always visible and properly applied
  const getDisplayNameStyle = () => {
    const baseStyle: React.CSSProperties = {};
    
    // FIXED: Ensure colors are properly applied for all animation types
    if (displayNameAnimation === 'rainbow') {
      baseStyle.animationDuration = `${rainbowSpeed}s`;
      // For rainbow, we don't set color as it's handled by CSS animation
      // But we ensure the animation class is applied
    } else if (displayNameAnimation === 'gradient') {
      baseStyle.animationDuration = `4s`;
      // For gradient, we don't set color as it's handled by CSS animation
    } else {
      // FIXED: For non-animated names, ALWAYS use the specified color
      baseStyle.color = displayNameColor;
      
      // Ensure the color is valid and visible
      if (!displayNameColor || displayNameColor === 'undefined') {
        baseStyle.color = message.sender === 'self' ? '#0066cc' : '#ff6b6b';
      }
    }
    
    return baseStyle;
  };

  const UsernameComponent = ({ children, className }: { children: React.ReactNode, className: string }) => {
    if (isClickable && authIdToUse) {
      return (
        <span
          onClick={(e) => {
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            const clickPosition = {
              x: rect.left + rect.width / 2,
              y: rect.bottom + 5
            };
            onUsernameClick(authIdToUse, clickPosition);
          }}
          className={cn(
            className,
            displayNameClass,
            "cursor-pointer transition-all duration-200 hover:underline hover:scale-105",
            isMobile && "active:underline"
          )}
          style={getDisplayNameStyle()}
          role="link"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              const clickPosition = {
                x: rect.left + rect.width / 2,
                y: rect.bottom + 5
              };
              onUsernameClick(authIdToUse, clickPosition);
            }
          }}
        >
          {children}
        </span>
      );
    }
    return (
      <span 
        className={cn(className, displayNameClass)}
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
          className="h-[2px] mb-1 border border-[#CEDCE5] bg-[#64B2CF]"
          aria-hidden="true"
        ></div>
      )}
      <div className={cn(
        "mb-1 break-words", 
        isMobile && "text-sm leading-relaxed"
      )}>
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <UsernameComponent className="font-bold mr-1">
              {displayName}:
            </UsernameComponent>
            <span className={cn(theme === 'theme-7' && 'theme-7-text-shadow')}>{messageContent}</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default MessageRow;