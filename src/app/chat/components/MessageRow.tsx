// src/app/chat/components/MessageRow.tsx - UPDATED WITH ALL FIXES
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
  // ✅ NEW: Add mounting state tracking to prevent React state update errors
  const [isMounted, setIsMounted] = useState(false);

  // ✅ NEW: Track mounting state
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
    if (!isMounted) return; // ✅ NEW: Mounting check
    const updateThemeState = () => setIsWindows7Theme(checkWindows7Theme());
    updateThemeState();

    const headObserver = new MutationObserver(() => updateThemeState());
    headObserver.observe(document.head, { childList: true, subtree: true });
    return () => headObserver.disconnect();
  }, [isMounted, checkWindows7Theme]); // ✅ NEW: Added isMounted dependency

  // Emoji loading
  useEffect(() => {
    if (!isMounted) return; // ✅ NEW: Mounting check
    
    const loadEmojis = async () => {
      if (theme === 'theme-98') {
        setEmotesLoading(true);
        try {
          const filenames = await loadEmoteList();
          if (isMounted) { // ✅ NEW: Check before state update
            setEmojiFilenames(filenames);
          }
        } catch (error) {
          console.error('Error loading emojis:', error);
          if (isMounted) { // ✅ NEW: Check before state update
            setEmojiFilenames([]);
          }
        } finally {
          if (isMounted) { // ✅ NEW: Check before state update
            setEmotesLoading(false);
          }
        }
      }
    };
    loadEmojis();
  }, [isMounted, theme]); // ✅ NEW: Added isMounted dependency

  // ✅ ENHANCED: Better username resolution - handles 'Stranger' properly
  const getDisplayedUsername = useCallback((isSelfUser: boolean): string => {
    if (isSelfUser) {
      return ownInfo.displayName || ownInfo.username;
    } else {
      // ✅ ENHANCED: Handle 'Stranger' case better
      const messageUsername = message.senderUsername;
      const partnerUsername = partnerInfo?.displayName || partnerInfo?.username;
      
      // If message has 'Stranger' but we have partner info with real username, use partner info
      if (messageUsername === 'Stranger' && partnerUsername && partnerUsername !== 'Stranger') {
        return partnerUsername;
      }
      
      // Otherwise use message username if it's not 'Stranger', else fallback to partner info
      if (messageUsername && messageUsername !== 'Stranger') {
        return messageUsername;
      }
      
      return partnerUsername || 'Unknown User';
    }
  }, [ownInfo, message.senderUsername, partnerInfo]);

  // ✅ ENHANCED: Profile data construction with better data handling
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
      // ✅ ENHANCED: Use resolved username instead of potentially 'Stranger' data
      const resolvedUsername = getDisplayedUsername(false);
      
      return {
        id: message.senderAuthId || partnerInfo?.authId,
        username: resolvedUsername,
        display_name: resolvedUsername,
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
  }, [ownInfo, message, partnerInfo, getDisplayedUsername]);

  // ✅ ENHANCED: Click handler with mounting checks and self profile support
  const handleUsernameClick = useCallback(async (e: React.MouseEvent) => {
    if (!isMounted) {
      console.warn('[MessageRow] Component not mounted, skipping click');
      return;
    }

    const isSelfUser = message.sender === 'self';
    const authId = isSelfUser ? ownInfo.authId : message.senderAuthId;
    
    // ✅ ENHANCED: Allow self profile clicks even without authId in some cases
    if (!authId && !isSelfUser) {
      console.warn('[MessageRow] No auth ID available for partner profile popup');
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();

    console.log('[MessageRow] Username clicked:', {
      isSelfUser,
      authId,
      username: getDisplayedUsername(isSelfUser),
      hasPartnerInfo: !!partnerInfo
    });

    try {
      if (isMounted) { // ✅ NEW: Check before state update
        setProfileLoading(true);
      }
      
      // Get basic profile data immediately
      let userProfile = getUserProfile(isSelfUser);
      let badges: Badge[] = [];
      let customCSS = '';

      if (isSelfUser) {
        // ✅ ENHANCED: For self user, use available data from ownInfo
        badges = ownInfo.badges || [];
        customCSS = ownInfo.customCSS || '';
        
        console.log(`[MessageRow] Using self profile data:`, {
          username: userProfile.username,
          badgeCount: badges.length,
          hasCSS: !!customCSS,
          authId: ownInfo.authId
        });
        
        // Show profile popup immediately for self
        if (isMounted) {
          showProfile(userProfile, badges, customCSS, e);
        }
      } else if (authId) {
        // For non-self users, try to fetch complete profile data
        try {
          console.log(`[MessageRow] Fetching complete profile for user: ${authId}`);
          const fullProfile = await fastProfileFetcher.fetchFullProfile(authId);
          
          if (fullProfile && isMounted) { // ✅ NEW: Check before state update
            console.log(`[MessageRow] Got complete profile:`, fullProfile);
            
            // Parse badges if available
            if (fullProfile.badges) {
              try {
                badges = Array.isArray(fullProfile.badges) ? fullProfile.badges : [];
                badges = badges.filter(badge => badge && badge.id && badge.url);
                console.log(`[MessageRow] Parsed ${badges.length} badges`);
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

            console.log(`[MessageRow] Final profile data:`, {
              username: userProfile.username,
              display_name: userProfile.display_name,
              badgeCount: badges.length,
              hasCSS: !!customCSS
            });
          }
        } catch (error) {
          console.warn(`[MessageRow] Failed to fetch complete profile for ${authId}:`, error);
          // Continue with basic profile data
        }
        
        // Show profile popup for partner
        if (isMounted) {
          showProfile(userProfile, badges, customCSS, e);
        }
      }

      // Optional: Call the original handler if provided
      if (onUsernameClick && authId) {
        const clickPosition = { x: e.clientX, y: e.clientY };
        onUsernameClick(authId, clickPosition);
      }
      
    } catch (error) {
      console.error('[MessageRow] Error showing profile popup:', error);
    } finally {
      if (isMounted) { // ✅ NEW: Check before state update
        setProfileLoading(false);
      }
    }
  }, [isMounted, message, partnerInfo, ownInfo, showProfile, onUsernameClick, getUserProfile, getDisplayedUsername]);

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

  // ✅ ENHANCED: Username component with loading state and proper username display
  const UsernameComponent = ({ children }: { children: React.ReactNode }) => {
    const isSelfUser = message.sender === 'self';
    const hasAuthId = isSelfUser ? ownInfo.authId : message.senderAuthId;
    
    // ✅ ENHANCED: Always allow self profile clicks, even without authId
    const isClickable = isSelfUser || hasAuthId;
    
    return (
      <span
        className={cn(
          "font-bold mr-1 relative",
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

  // ✅ ENHANCED: Use the proper username resolution function
  const displayedUsername = getDisplayedUsername(message.sender === 'self');

  // ✅ ENHANCED: Only log this when there are actual issues, not on every render
  if (displayedUsername === 'Stranger' || displayedUsername === 'Unknown User') {
    console.log('[MessageRow] Username resolution issue:', {
      sender: message.sender,
      displayedUsername,
      senderUsername: message.senderUsername,
      partnerUsername: partnerInfo?.username,
      partnerDisplayName: partnerInfo?.displayName,
      ownUsername: ownInfo.username
    });
  }

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