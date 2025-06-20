// src/app/chat/components/MessageRow.tsx
import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useProfilePopup } from '@/components/ProfilePopup/ProfilePopupProvider';
import { getDisplayNameClass, renderMessageWithEmojis, loadEmoteList } from '../utils/ChatHelpers';
import { UserProfile, Badge } from '@/components/ProfileCustomizer/types';

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
    bio?: string;
    status?: 'online' | 'idle' | 'dnd' | 'offline';
    profile_card_css?: string;
    badges?: Badge[];
  };
  onUsernameClick: (authId: string, clickPosition: { x: number; y: number }) => void;
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

  // Profile data construction
  const getUserProfile = useCallback((isSelfUser: boolean): UserProfile => ({
    id: isSelfUser ? ownInfo.authId || undefined : message.senderAuthId || partnerInfo?.authId,
    username: isSelfUser ? ownInfo.username : message.senderUsername || partnerInfo?.username,
    display_name: isSelfUser ? ownInfo.username : message.senderUsername || partnerInfo?.displayName,
    avatar_url: isSelfUser ? undefined : partnerInfo?.avatar,
    display_name_color: isSelfUser ? ownInfo.displayNameColor : message.senderDisplayNameColor || partnerInfo?.displayNameColor,
    display_name_animation: isSelfUser ? ownInfo.displayNameAnimation : message.senderDisplayNameAnimation || partnerInfo?.displayNameAnimation,
    rainbow_speed: isSelfUser ? 3 : message.senderRainbowSpeed || partnerInfo?.rainbowSpeed,
    bio: isSelfUser ? undefined : partnerInfo?.bio,
    status: isSelfUser ? 'online' : partnerInfo?.status,
    profile_card_css: isSelfUser ? undefined : partnerInfo?.profile_card_css,
    badges: isSelfUser ? undefined : partnerInfo?.badges,
  }), [ownInfo, message, partnerInfo]);

  // Click handler
  const handleUsernameClick = useCallback((e: React.MouseEvent) => {
    if (!message.senderAuthId) return;
    
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const clickPosition = { x: rect.left + rect.width / 2, y: rect.bottom + 5 };

    const userProfile = getUserProfile(message.sender === 'self');
    const badges = partnerInfo?.badges || [];
    const customCSS = partnerInfo?.profile_card_css || '';

    showProfile(userProfile, badges, customCSS, e);
    onUsernameClick(message.senderAuthId, clickPosition);
  }, [message, partnerInfo, showProfile, onUsernameClick, getUserProfile]);

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

  // Username component
  const UsernameComponent = ({ children }: { children: React.ReactNode }) => (
    <span
      className={cn(
        "font-bold mr-1",
        isWindows7Theme ? "" : "cursor-pointer hover:underline",
        getDisplayNameClass(
          message.sender === 'self' 
            ? ownInfo.displayNameAnimation 
            : message.senderDisplayNameAnimation
        )
      )}
      style={{
        color: message.sender === 'self' 
          ? ownInfo.displayNameColor 
          : message.senderDisplayNameColor,
        animationDuration: `${message.senderRainbowSpeed || 3}s`
      }}
      onClick={message.senderAuthId ? handleUsernameClick : undefined}
      onKeyDown={message.senderAuthId ? handleKeyDown : undefined}
      tabIndex={message.senderAuthId ? 0 : undefined}
      role={message.senderAuthId ? "button" : undefined}
    >
      {children}
    </span>
  );

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
              {message.sender === 'self' ? ownInfo.username : message.senderUsername || partnerInfo?.username}:
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