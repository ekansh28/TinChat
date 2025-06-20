// src/app/chat/components/MessageRow.tsx
import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useProfilePopup } from '@/components/ProfilePopup/ProfilePopupProvider';
import { getDisplayNameClass, renderMessageWithEmojis, loadEmoteList } from '../utils/ChatHelpers';
import { UserProfile, Badge } from '@/components/ProfileCustomizer/types'; // Import UserProfile and Badge

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
    // Add other profile fields if available on partnerInfo
    bio?: string;
    status?: 'online' | 'idle' | 'dnd' | 'offline';
    profile_card_css?: string;
    badges?: Badge[];
  };
  onUsernameClick: (authId: string, clickPosition: { x: number; y: number }) => void;
  isMobile: boolean;
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
  isMobile
}) => {
  const { showProfile } = useProfilePopup();

  const [emojiFilenames, setEmojiFilenames] = useState<string[]>([]);
  const [emotesLoading, setEmotesLoading] = useState(true);

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

  const handleMouseEnter = useCallback(() => {
    if (message.sender === 'partner' && message.senderAuthId) {
      console.log('Prefetching profile for', message.senderAuthId);
    }
  }, [message.sender, message.senderAuthId]);

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

  const showDivider = useMemo(() => {
    return theme === 'theme-7' &&
      previousMessageSender &&
      ['self', 'partner'].includes(previousMessageSender) &&
      ['self', 'partner'].includes(message.sender) &&
      message.sender !== previousMessageSender;
  }, [theme, previousMessageSender, message.sender]);

  const messageContent = useMemo(() => {
    if (theme === 'theme-98' && !emotesLoading && emojiFilenames.length > 0) {
      return renderMessageWithEmojis(message.content, emojiFilenames, EMOJI_CDN_BASE);
    }
    return [message.content];
  }, [message.content, theme, emojiFilenames, emotesLoading]);

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

  // Helper function to construct UserProfile from available data
  const getUserProfile = useCallback((isSelfUser: boolean): UserProfile => {
    if (isSelfUser) {
      return {
        id: ownInfo.authId || undefined,
        username: ownInfo.username,
        display_name: ownInfo.username, // Assuming username is display_name for self
        display_name_color: ownInfo.displayNameColor,
        display_name_animation: ownInfo.displayNameAnimation,
        rainbow_speed: 3, // Default for self, or get from ownInfo if available
        // Add other relevant fields from ownInfo if they exist in UserProfile
      };
    } else {
      return {
        id: message.senderAuthId || partnerInfo?.authId || undefined,
        username: message.senderUsername || partnerInfo?.username,
        display_name: message.senderUsername || partnerInfo?.displayName || partnerInfo?.username,
        avatar_url: partnerInfo?.avatar,
        display_name_color: message.senderDisplayNameColor || partnerInfo?.displayNameColor,
        display_name_animation: message.senderDisplayNameAnimation || partnerInfo?.displayNameAnimation,
        rainbow_speed: message.senderRainbowSpeed || partnerInfo?.rainbowSpeed,
        bio: partnerInfo?.bio,
        status: partnerInfo?.status,
        profile_card_css: partnerInfo?.profile_card_css,
        badges: partnerInfo?.badges,
      };
    }
  }, [ownInfo, message, partnerInfo]);


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

    const userProfile = getUserProfile(isSelf);
    const badges = userProfile.badges || []; // Ensure badges is an array
    const customCSS = userProfile.profile_card_css || ''; // Get custom CSS

    showProfile(userProfile, badges, customCSS, e);
  }, [isClickable, authId, showProfile, onUsernameClick, isSelf, getUserProfile]);

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
        preventDefault: () => { },
        stopPropagation: () => { }
      };

      const userProfile = getUserProfile(isSelf);
      const badges = userProfile.badges || [];
      const customCSS = userProfile.profile_card_css || '';

      showProfile(userProfile, badges, customCSS, fakeEvent as unknown as React.MouseEvent);
    }
  }, [isClickable, authId, showProfile, onUsernameClick, isSelf, getUserProfile]);

  const getDisplayNameStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {};

    if (displayNameAnimation === 'rainbow') {
      baseStyle.animationDuration = `${rainbowSpeed}s`;
    } else if (displayNameAnimation === 'gradient') {
      baseStyle.animationDuration = `4s`;
    } else {
      baseStyle.color = displayNameColor || (isSelf ? '#0066cc' : '#ff0000');
    }

    return baseStyle;
  };

  const UsernameComponent = ({ children }: { children: React.ReactNode }) => {
    if (isWindows7Theme) {
      return (
        <span
          className={cn(
            "font-bold mr-1 transition-all duration-200",
            displayNameClass,
            isClickable && authId ? "cursor-pointer hover:underline" : ""
          )}
          style={{
            ...getDisplayNameStyle(),
            background: 'none',
            border: 'none',
            padding: '0',
            margin: '0 4px 0 0',
            display: 'inline',
            textDecoration: 'none',
            boxShadow: 'none',
            outline: 'none'
          }}
          onClick={isClickable && authId ? handleUsernameClick : undefined}
          onKeyDown={isClickable && authId ? handleKeyDown : undefined}
          tabIndex={isClickable && authId ? 0 : undefined}
          role={isClickable && authId ? "button" : undefined}
          aria-label={isClickable && authId ? `View ${displayName}'s profile` : undefined}
          data-user-id={authId}
        >
          {children}
        </span>
      );
    } else {
      return (
        <span
          className={cn(
            "font-bold mr-1 cursor-pointer hover:underline transition-all duration-200",
            displayNameClass
          )}
          style={getDisplayNameStyle()}
          onClick={isClickable && authId ? handleUsernameClick : undefined}
          onKeyDown={isClickable && authId ? handleKeyDown : undefined}
          tabIndex={isClickable && authId ? 0 : undefined}
          role={isClickable && authId ? "button" : undefined}
          aria-label={isClickable && authId ? `View ${displayName}'s profile` : undefined}
          data-user-id={authId}
        >
          {children}
        </span>
      );
    }
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