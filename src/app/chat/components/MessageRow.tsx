// src/app/chat/components/MessageRow.tsx - FIXED SHOWPROFILE SIGNATURE
'use client';

import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useProfilePopup } from '@/components/ProfilePopup/ProfilePopupProvider';
import { getDisplayNameClass, renderMessageWithEmojis, loadEmoteList } from '../utils/ChatHelpers';
import { UserProfile, Badge } from '@/components/ProfileCustomizer/types';
import { fastProfileFetcher } from '@/lib/fastProfileFetcher';

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
    displayName?: string;
    avatar?: string;
    bio?: string;
    status?: 'online' | 'idle' | 'dnd' | 'offline';
    badges?: Badge[];
    customCSS?: string;
  };
  partnerInfo?: {
    username: string;
    displayName?: string;
    avatar: string;
    displayNameColor?: string;
    displayNameAnimation?: string;
    rainbowSpeed?: number;
    authId?: string;
    bio?: string;
    status?: 'online' | 'idle' | 'dnd' | 'offline';
    profile_card_css?: string;
    badges?: Badge[];
  };
  onUsernameClick?: (authId: string, clickPosition: { x: number; y: number }) => void;
  isMobile: boolean;
}

const EMOJI_CDN_BASE = "https://cdn.sekansh21.workers.dev/emotes/";

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
  const [emojiFilenames, setEmojiFilenames] = useState<string[]>([]);
  const [emotesLoading, setEmotesLoading] = useState(true);
  const [isWindows7Theme, setIsWindows7Theme] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Track mounting state properly
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Theme detection
  const checkWindows7Theme = useCallback(() => {
    if (typeof window === 'undefined') return false;
    const win7Link = document.getElementById('win7-css-link') as HTMLLinkElement;
    const hasWin7CSS = win7Link && win7Link.href.includes('7.css');
    const win7SubThemeLink = document.querySelector('link[href*="/win7themes/"]') as HTMLLinkElement;
    return hasWin7CSS || win7SubThemeLink !== null;
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    const updateThemeState = () => {
      if (isMounted) {
        setIsWindows7Theme(checkWindows7Theme());
      }
    };
    updateThemeState();

    const headObserver = new MutationObserver(() => {
      if (isMounted) {
        updateThemeState();
      }
    });
    headObserver.observe(document.head, { childList: true, subtree: true });
    return () => headObserver.disconnect();
  }, [isMounted, checkWindows7Theme]);

  // Emoji loading with mount checks
  useEffect(() => {
    if (!isMounted) return;
    
    const loadEmojis = async () => {
      if (theme === 'theme-98') {
        if (isMounted) setEmotesLoading(true);
        try {
          const filenames = await loadEmoteList();
          if (isMounted) {
            setEmojiFilenames(filenames);
          }
        } catch (error) {
          console.error('Error loading emojis:', error);
          if (isMounted) {
            setEmojiFilenames([]);
          }
        } finally {
          if (isMounted) {
            setEmotesLoading(false);
          }
        }
      }
    };
    loadEmojis();
  }, [isMounted, theme]);

  // Better username resolution - no "Stranger" logging
  const getDisplayedUsername = useCallback((isSelfUser: boolean): string => {
    if (isSelfUser) {
      return ownInfo.displayName || ownInfo.username;
    } else {
      const messageUsername = message.senderUsername;
      const partnerUsername = partnerInfo?.displayName || partnerInfo?.username;
      
      // Priority: partner info > message username > fallback
      if (partnerUsername && partnerUsername !== 'Stranger') {
        return partnerUsername;
      }
      
      if (messageUsername && messageUsername !== 'Stranger') {
        return messageUsername;
      }
      
      return 'Stranger';
    }
  }, [ownInfo, message.senderUsername, partnerInfo]);



  // ✅ FIXED: Enhanced click handler with correct ProfilePopup signature
  const handleUsernameClick = useCallback(async (e: React.MouseEvent) => {
    if (!isMounted) {
      console.warn('[MessageRow] Component not mounted, skipping click');
      return;
    }

    const isSelfUser = message.sender === 'self';
    const authId = isSelfUser ? ownInfo.authId : message.senderAuthId;
    
    e.preventDefault();
    e.stopPropagation();

    console.log('[MessageRow] Username clicked for:', isSelfUser ? 'self' : 'partner');

    try {
      if (isMounted) {
        setProfileLoading(true);
      }
      
      // Determine the user ID to pass to ProfilePopup
      let userId: string;
      
      if (isSelfUser && ownInfo.authId) {
        userId = ownInfo.authId;
      } else if (!isSelfUser && authId) {
        userId = authId;
      } else {
        // Fallback to message sender authId or generate a temporary ID
        userId = message.senderAuthId || `temp-${Date.now()}`;
      }

      console.log(`[MessageRow] Showing profile popup for userId: ${userId}`);
      
      // ✅ FIXED: Use new ProfilePopup signature - just userId and click event
      if (isMounted) {
        showProfile(userId, e);
      }

      // Optional: Call the original handler if provided
      if (onUsernameClick && authId) {
        const clickPosition = { x: e.clientX, y: e.clientY };
        onUsernameClick(authId, clickPosition);
      }
      
    } catch (error) {
      console.error('[MessageRow] Error showing profile popup:', error);
    } finally {
      if (isMounted) {
        setProfileLoading(false);
      }
    }
  }, [isMounted, message, partnerInfo, ownInfo, showProfile, onUsernameClick]);

  // Keyboard handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleUsernameClick(e as unknown as React.MouseEvent);
    }
  }, [handleUsernameClick]);

  // System message render
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

  // Message content processing
  const messageContent = useMemo(() => {
    if (theme === 'theme-98' && !emotesLoading && emojiFilenames.length > 0) {
      return renderMessageWithEmojis(message.content, emojiFilenames, EMOJI_CDN_BASE);
    }
    return [message.content];
  }, [message.content, theme, emojiFilenames, emotesLoading]);

  // Username component - always clickable
  const UsernameComponent = ({ children }: { children: React.ReactNode }) => {
    const isSelfUser = message.sender === 'self';
    const isClickable = true; // Always allow clicks
    
    return (
      <span
        className={cn(
          "font-bold mr-1 relative username-click", // Added class for popup detection
          isClickable && !isWindows7Theme && "cursor-pointer hover:underline",
          getDisplayNameClass(
            isSelfUser 
              ? ownInfo.displayNameAnimation 
              : message.senderDisplayNameAnimation
          ),
          profileLoading && "opacity-70"
        )}
        style={{
          color: isSelfUser 
            ? ownInfo.displayNameColor 
            : message.senderDisplayNameColor,
          animationDuration: `${message.senderRainbowSpeed || 3}s`
        }}
        onClick={isClickable ? handleUsernameClick : undefined}
        onKeyDown={isClickable ? handleKeyDown : undefined}
        tabIndex={isClickable ? 0 : undefined}
        role={isClickable ? "button" : undefined}
        title={isClickable ? "Click to view profile" : undefined}
        data-username={getDisplayedUsername(isSelfUser)}
      >
        {children}
        {/* Loading indicator for profile fetch */}
        {profileLoading && (
          <span className="absolute -top-1 -right-1 w-3 h-3">
            <div className="w-full h-full border border-gray-400 border-t-blue-500 rounded-full animate-spin" 
                 style={{ borderWidth: '1px' }} />
          </span>
        )}
      </span>
    );
  };

  const displayedUsername = getDisplayedUsername(message.sender === 'self');

  return (
    <>
      {theme === 'theme-7' && previousMessageSender && message.sender !== previousMessageSender && (
        <div className="h-[2px] border border-[#CEDCE5] bg-[#64B2CF] mb-1" />
      )}
      <div className={cn(
        "break-words message-row mb-1",
        message.sender === 'self' ? "ml-2" : "mr-2"
      )}>
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <UsernameComponent>
              {displayedUsername}:
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