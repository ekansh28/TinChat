// src/app/chat/components/MessageRow.tsx - ENHANCED WITH PROFILE POPUP
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

  // Theme detection
  const checkWindows7Theme = useCallback(() => {
    if (typeof window === 'undefined') return false;
    const win7Link = document.getElementById('win7-css-link') as HTMLLinkElement;
    const hasWin7CSS = win7Link && win7Link.href.includes('7.css');
    const win7SubThemeLink = document.querySelector('link[href*="/win7themes/"]') as HTMLLinkElement;
    return hasWin7CSS || win7SubThemeLink !== null;
  }, []);

  useEffect(() => {
    const updateThemeState = () => setIsWindows7Theme(checkWindows7Theme());
    updateThemeState();

    const headObserver = new MutationObserver(() => updateThemeState());
    headObserver.observe(document.head, { childList: true, subtree: true });
    return () => headObserver.disconnect();
  }, [checkWindows7Theme]);

  // Emoji loading
  useEffect(() => {
    const loadEmojis = async () => {
      if (theme === 'theme-98') {
        setEmotesLoading(true);
        try {
          const filenames = await loadEmoteList();
          setEmojiFilenames(filenames);
        } catch (error) {
          console.error('Error loading emojis:', error);
          setEmojiFilenames([]);
        } finally {
          setEmotesLoading(false);
        }
      }
    };
    loadEmojis();
  }, [theme]);

  // ✅ NEW: Enhanced profile data construction with fallbacks
  const getUserProfile = useCallback((isSelfUser: boolean): UserProfile => {
    if (isSelfUser) {
      return {
        id: ownInfo.authId || undefined,
        username: ownInfo.username,
        display_name: ownInfo.displayName || ownInfo.username,
        avatar_url: ownInfo.avatar || undefined,
        display_name_color: ownInfo.displayNameColor || '#000000',
        display_name_animation: ownInfo.displayNameAnimation || 'none',
        rainbow_speed: 3,
        bio: ownInfo.bio || undefined,
        status: ownInfo.status || 'online',
        profile_card_css: ownInfo.customCSS || undefined,
        badges: ownInfo.badges || []
      };
    } else {
      return {
        id: message.senderAuthId || partnerInfo?.authId,
        username: message.senderUsername || partnerInfo?.username || 'Unknown User',
        display_name: message.senderUsername || partnerInfo?.displayName || partnerInfo?.username || 'Unknown User',
        avatar_url: partnerInfo?.avatar,
        display_name_color: message.senderDisplayNameColor || partnerInfo?.displayNameColor || '#000000',
        display_name_animation: message.senderDisplayNameAnimation || partnerInfo?.displayNameAnimation || 'none',
        rainbow_speed: message.senderRainbowSpeed || partnerInfo?.rainbowSpeed || 3,
        bio: partnerInfo?.bio,
        status: partnerInfo?.status || 'online',
        profile_card_css: partnerInfo?.profile_card_css,
        badges: partnerInfo?.badges || []
      };
    }
  }, [ownInfo, message, partnerInfo]);

  // ✅ NEW: Enhanced click handler with profile fetching
  const handleUsernameClick = useCallback(async (e: React.MouseEvent) => {
    const isSelfUser = message.sender === 'self';
    const authId = isSelfUser ? ownInfo.authId : message.senderAuthId;
    
    if (!authId) {
      console.warn('No auth ID available for profile popup');
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();

    try {
      setProfileLoading(true);
      
      // Get basic profile data immediately
      let userProfile = getUserProfile(isSelfUser);
      let badges: Badge[] = [];
      let customCSS = '';

      // For non-self users, try to fetch complete profile data
      if (!isSelfUser && authId) {
        try {
          console.log(`[MessageRow] Fetching complete profile for user: ${authId}`);
          const fullProfile = await fastProfileFetcher.fetchFullProfile(authId);
          
          if (fullProfile) {
            console.log(`[MessageRow] Got complete profile:`, fullProfile);
            
            // Parse badges if available
            if (fullProfile.badges) {
              try {
                badges = Array.isArray(fullProfile.badges) ? fullProfile.badges : [];
                badges = badges.filter(badge => badge && badge.id && badge.url);
              } catch (e) {
                console.warn('Failed to parse badges:', e);
                badges = [];
              }
            }
            
            customCSS = fullProfile.profile_card_css || '';
            
            // Update user profile with complete data
            userProfile = {
              ...userProfile,
              ...fullProfile,
              badges: undefined // Remove badges from profile object
            };
          }
        } catch (error) {
          console.warn(`[MessageRow] Failed to fetch complete profile for ${authId}:`, error);
          // Continue with basic profile data
        }
      } else if (isSelfUser) {
        // For self user, use available data
        badges = ownInfo.badges || [];
        customCSS = ownInfo.customCSS || '';
      }

      // Show profile popup at click position
      showProfile(userProfile, badges, customCSS, e);
      
      // Optional: Call the original handler if provided
      if (onUsernameClick) {
        const rect = e.currentTarget.getBoundingClientRect();
        const clickPosition = { x: rect.left + rect.width / 2, y: rect.bottom + 5 };
        onUsernameClick(authId, clickPosition);
      }
      
    } catch (error) {
      console.error('[MessageRow] Error showing profile popup:', error);
    } finally {
      setProfileLoading(false);
    }
  }, [message, partnerInfo, ownInfo, showProfile, onUsernameClick, getUserProfile]);

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

  // ✅ ENHANCED: Username component with loading state
  const UsernameComponent = ({ children }: { children: React.ReactNode }) => {
    const hasAuthId = message.sender === 'self' ? ownInfo.authId : message.senderAuthId;
    
    return (
      <span
        className={cn(
          "font-bold mr-1 relative",
          hasAuthId && !isWindows7Theme && "cursor-pointer hover:underline",
          getDisplayNameClass(
            message.sender === 'self' 
              ? ownInfo.displayNameAnimation 
              : message.senderDisplayNameAnimation
          ),
          profileLoading && "opacity-70"
        )}
        style={{
          color: message.sender === 'self' 
            ? ownInfo.displayNameColor 
            : message.senderDisplayNameColor,
          animationDuration: `${message.senderRainbowSpeed || 3}s`
        }}
        onClick={hasAuthId ? handleUsernameClick : undefined}
        onKeyDown={hasAuthId ? handleKeyDown : undefined}
        tabIndex={hasAuthId ? 0 : undefined}
        role={hasAuthId ? "button" : undefined}
        title={hasAuthId ? "Click to view profile" : undefined}
      >
        {children}
        {/* ✅ NEW: Loading indicator for profile fetch */}
        {profileLoading && (
          <span className="absolute -top-1 -right-1 w-3 h-3">
            <div className="w-full h-full border border-gray-400 border-t-blue-500 rounded-full animate-spin" 
                 style={{ borderWidth: '1px' }} />
          </span>
        )}
      </span>
    );
  };

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
              {message.sender === 'self' 
                ? ownInfo.username 
                : message.senderUsername || partnerInfo?.username || 'Unknown User'}:
            </UsernameComponent>
            <span className={cn(
              theme === 'theme-7' && 'theme-7-text-shadow',
              "break-words hyphens-auto"
            )}>
              {emotesLoading && theme === 'theme-98' ? (
                <span>Loading emojis...</span>
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