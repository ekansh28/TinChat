'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button-themed';
import { Input } from '@/components/ui/input-themed';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/components/theme-provider';
import { cn, playSound } from '@/lib/utils';
import { ConditionalGoldfishImage } from '@/components/ConditionalGoldfishImage';
import HomeButton from '@/components/HomeButton';
import { io, type Socket } from 'socket.io-client';
import { supabase } from '@/lib/supabase';

import { ProfileCard } from '@/components/ProfileCard';

// --- Constants ---
const EMOJI_BASE_URL_DISPLAY = "https://storage.googleapis.com/chat_emoticons/display_98/";
const STATIC_DISPLAY_EMOJI_FILENAMES = [
  'angel.png', 'bigsmile.png', 'burp.png', 'cool.png', 'crossedlips.png',
  'cry.png', 'embarrassed.png', 'kiss.png', 'moneymouth.png', 'sad.png',
  'scream.png', 'smile.png', 'think.png', 'tongue.png', 'wink.png', 'yell.png'
];
const SMILE_EMOJI_FILENAME = 'smile.png';
const EMOJI_BASE_URL_PICKER = "/emotes/";

const INPUT_AREA_HEIGHT = 60; // px
const INPUT_AREA_HEIGHT_MOBILE = 70; // px
const LOG_PREFIX = "ChatPageClientContent";

// Favicon Constants
const FAVICON_IDLE = '/Idle.ico';
const FAVICON_SEARCHING = '/Searching.ico';
const FAVICON_SUCCESS = '/Success.ico';
const FAVICON_SKIPPED = '/Skipped.ico';
const FAVICON_DEFAULT = '/favicon.ico';

// System Message Text Constants
const SYS_MSG_SEARCHING_PARTNER = 'Searching for a partner...';
const SYS_MSG_STOPPED_SEARCHING = 'Stopped searching for a partner.';
const SYS_MSG_CONNECTED_PARTNER = 'Connected with a partner. You can start chatting!';
const SYS_MSG_YOU_DISCONNECTED = 'You have disconnected.';
const SYS_MSG_PARTNER_DISCONNECTED = 'Your partner has disconnected.';
const SYS_MSG_COMMON_INTERESTS_PREFIX = 'You both like ';

// --- Types ---
interface Message {
  id: string;
  text: string;
  sender: 'me' | 'partner' | 'system';
  timestamp: Date;
  senderUsername?: string;
  senderAuthId?: string;
}

interface EmoteData {
  filename: string;
  width?: number;
  height?: number;
}

// --- Helper Functions ---
const renderMessageWithEmojis = (text: string, emojiFilenames: string[], baseUrl: string): (string | JSX.Element)[] => {
  if (!emojiFilenames || emojiFilenames.length === 0) {
    return [text];
  }

  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  const regex = /:([a-zA-Z0-9_.-]+?):/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const shortcodeName = match[1];
    const matchedFilename = emojiFilenames.find(
      (filename) => filename.split('.')[0].toLowerCase() === shortcodeName.toLowerCase()
    );

    if (matchedFilename) {
      parts.push(
        <img
          key={`${match.index}-${shortcodeName}`}
          src={`${baseUrl}${matchedFilename}`}
          alt={shortcodeName}
          className="inline max-h-5 w-auto mx-0.5 align-middle"
          data-ai-hint="chat emoji"
        />
      );
    } else {
      parts.push(match[0]);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
};

// --- Components ---
interface RowProps {
  message: Message;
  theme: string;
  previousMessageSender?: Message['sender'];
  pickerEmojiFilenames: string[];
  ownDisplayName: string;
  ownAuthId: string | null;
  onUsernameClick: (authId: string) => void;
  isMobile: boolean;
}

const Row = React.memo(({ 
  message, 
  theme, 
  previousMessageSender, 
  pickerEmojiFilenames, 
  ownDisplayName,
  ownAuthId,
  onUsernameClick,
  isMobile
}: RowProps) => {
  if (message.sender === 'system') {
    return (
      <div className="mb-2">
        <div className={cn(
          "text-center w-full text-xs italic",
           theme === 'theme-7' ? 'theme-7-text-shadow text-gray-100' : 'text-gray-500 dark:text-gray-400'
        )}>
          {message.text}
        </div>
      </div>
    );
  }

  const showDivider =
    theme === 'theme-7' &&
    previousMessageSender &&
    ['me', 'partner'].includes(previousMessageSender) &&
    ['me', 'partner'].includes(message.sender) &&
    message.sender !== previousMessageSender;

  const messageContent = useMemo(() => (
    theme === 'theme-98'
    ? renderMessageWithEmojis(message.text, pickerEmojiFilenames, EMOJI_BASE_URL_PICKER)
    : [message.text]
  ), [message.text, theme, pickerEmojiFilenames]);

  const displayName = message.sender === 'me' ? ownDisplayName : (message.senderUsername || "Stranger");
  const authIdToUse = message.sender === 'me' ? ownAuthId : message.senderAuthId;
  const isClickable = authIdToUse && authIdToUse !== 'anonymous' && authIdToUse !== null;

  const UsernameComponent = ({ children, className }: { children: React.ReactNode, className: string }) => {
    if (isClickable && authIdToUse) {
      return (
        <span
          onClick={(e) => {
            e.preventDefault();
            onUsernameClick(authIdToUse);
          }}
          className={cn(
            className,
            "cursor-pointer transition-colors duration-200 hover:underline",
            isMobile && "active:underline" // Touch feedback for mobile
          )}
          role="link"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onUsernameClick(authIdToUse);
            }
          }}
        >
          {children}
        </span>
      );
    }
    return <span className={className}>{children}</span>;
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
        {message.sender === 'me' && (
          <>
            <UsernameComponent className="text-blue-600 font-bold mr-1">
              {displayName}:
            </UsernameComponent>
            <span className={cn(theme === 'theme-7' && 'theme-7-text-shadow')}>{messageContent}</span>
          </>
        )}
        {message.sender === 'partner' && (
          <>
            <UsernameComponent className="text-red-600 font-bold mr-1">
              {displayName}:
            </UsernameComponent>
            <span className={cn(theme === 'theme-7' && 'theme-7-text-shadow')}>{messageContent}</span>
          </>
        )}
      </div>
    </>
  );
});
Row.displayName = 'Row';

const ChatPageClientContent: React.FC = () => {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { currentTheme } = useTheme();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const autoSearchDoneRef = useRef(false);
  const prevIsFindingPartnerRef = useRef(false);
  const prevIsPartnerConnectedRef = useRef(false);
  const prevIsSelfDisconnectedRecentlyRef = useRef(false);
  const prevIsPartnerLeftRecentlyRef = useRef(false);
  const hoverIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const localTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLocalTypingRef = useRef(false);
  const isProcessingFindOrDisconnect = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const successTransitionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const successTransitionEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const skippedFaviconTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');

  const [roomId, setRoomId] = useState<string | null>(null);
  const [isPartnerConnected, setIsPartnerConnected] = useState(false);
  const [isFindingPartner, setIsFindingPartner] = useState(false);
  const [partnerInterests, setPartnerInterests] = useState<string[]>([]);
  const [socketError, setSocketError] = useState(false);

  const [isSelfDisconnectedRecently, setIsSelfDisconnectedRecently] = useState(false);
  const [isPartnerLeftRecently, setIsPartnerLeftRecently] = useState(false);

  const [currentEmojiIconUrl, setCurrentEmojiIconUrl] = useState(() => `${EMOJI_BASE_URL_DISPLAY}${SMILE_EMOJI_FILENAME}`);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [pickerEmojiFilenames, setPickerEmojiFilenames] = useState<string[]>([]);
  const [emojisLoading, setEmojisLoading] = useState(true);

  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [typingDots, setTypingDots] = useState('.');

  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  const [isProfileCardOpen, setIsProfileCardOpen] = useState(false);
  const [profileCardUserId, setProfileCardUserId] = useState<string | null>(null);
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);

  const [ownProfileUsername, setOwnProfileUsername] = useState<string | null>(null);
  const [partnerAuthId, setPartnerAuthId] = useState<string | null>(null);

  const interests = useMemo(() => searchParams.get('interests')?.split(',').filter(i => i.trim() !== '') || [], [searchParams]);
  const effectivePageTheme = useMemo(() => (isMounted ? currentTheme : 'theme-98'), [isMounted, currentTheme]);
  
  // Responsive chat window style
  const chatWindowStyle = useMemo(() => {
    if (isMobile) {
      return { 
        width: '100vw', 
        height: '100vh',
        maxWidth: '100vw',
        maxHeight: '100vh'
      };
    }
    return { width: '600px', height: '600px' };
  }, [isMobile]);

  const currentInputAreaHeight = isMobile ? INPUT_AREA_HEIGHT_MOBILE : INPUT_AREA_HEIGHT;
  const messagesContainerComputedHeight = useMemo(() => 
    `calc(100% - ${currentInputAreaHeight}px)`, 
    [currentInputAreaHeight]
  );

  const ownDisplayUsername = useMemo(() => {
    return ownProfileUsername || "You";
  }, [ownProfileUsername]);

  // Improved scroll to bottom function
  const scrollToBottom = useCallback((force = false) => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
      
      if (force || isAtBottom) {
        // Use requestAnimationFrame to ensure DOM has updated
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
    }
  }, []);

  // Handle mobile detection and viewport changes
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768; // md breakpoint
      setIsMobile(mobile);
      
      if (mobile) {
        // Use visual viewport if available (better for mobile keyboards)
        const height = window.visualViewport?.height || window.innerHeight;
        setViewportHeight(height);
      } else {
        setViewportHeight(window.innerHeight);
      }
    };

    const handleResize = () => {
      checkMobile();
    };

    const handleVisualViewportChange = () => {
      if (isMobile && window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
        // Maintain scroll position when keyboard opens/closes
        setTimeout(() => scrollToBottom(true), 150);
      }
    };

    checkMobile();
    window.addEventListener('resize', handleResize);
    
    // Listen for visual viewport changes (keyboard open/close)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportChange);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportChange);
      }
    };
  }, [isMobile, scrollToBottom]);

  // Handle profile card functionality
  const handleUsernameClick = useCallback((authId: string) => {
    if (authId && authId !== 'anonymous') {
      setProfileCardUserId(authId);
      setIsProfileCardOpen(true);
    }
  }, []);

  const handleProfileCardClose = useCallback(() => {
    setIsProfileCardOpen(false);
    setProfileCardUserId(null);
  }, []);

  // Modified addMessageToList to include senderAuthId
  const addMessageToList = useCallback((text: string, sender: Message['sender'], senderUsername?: string, senderAuthId?: string, idSuffix?: string) => {
    setMessages((prevMessages) => {
      const newMessageItem: Message = {
        id: `${Date.now()}-${idSuffix || Math.random().toString(36).substring(2, 7)}`,
        text,
        sender,
        timestamp: new Date(),
        senderUsername: sender === 'partner' ? senderUsername : undefined,
        senderAuthId: sender === 'partner' ? senderAuthId : undefined,
      };
      return [...prevMessages, newMessageItem];
    });
  }, []);

  useEffect(() => {
    console.log(`${LOG_PREFIX}: isPartnerConnected state changed to: ${isPartnerConnected}`);
  }, [isPartnerConnected]);

  useEffect(() => {
    console.log(`${LOG_PREFIX}: roomId state changed to: ${roomId}, updating roomIdRef.`);
    roomIdRef.current = roomId;
  }, [roomId]);

  const changeFavicon = useCallback((newFaviconHref: string, removeOld: boolean = false) => {
    if (typeof window === 'undefined' || !document.head) {
        console.warn(`${LOG_PREFIX}: Cannot change favicon, window or document.head not available.`);
        return;
    }
    let existingLink: HTMLLinkElement | null = document.head.querySelector("link[rel*='icon']");
    if (removeOld && existingLink && existingLink.parentNode) {
      existingLink.parentNode.removeChild(existingLink);
      existingLink = null;
    }
    if (!existingLink) {
        existingLink = document.createElement('link');
        existingLink.type = 'image/x-icon';
        existingLink.rel = 'shortcut icon';
        document.head.appendChild(existingLink);
    }
    existingLink.href = newFaviconHref;
  }, []);

  const attemptAutoSearch = useCallback(() => {
    const currentSocket = socketRef.current;
    const currentInterests = searchParams.get('interests')?.split(',').filter(i => i.trim() !== '') || [];
    console.log(`${LOG_PREFIX}: attemptAutoSearch called. Socket connected: ${!!currentSocket?.connected}, Auth loading: ${isAuthLoading}, Auto search done: ${autoSearchDoneRef.current}, Partner connected: ${isPartnerConnected}, Finding partner: ${isFindingPartner}, Room ID: ${roomIdRef.current}`);
    
    if (currentSocket?.connected && !autoSearchDoneRef.current && !isPartnerConnected && !isFindingPartner && !roomIdRef.current) {
      console.log(`${LOG_PREFIX}: Conditions met for auto search. Emitting 'findPartner'. Payload:`, { 
        chatType: 'text', 
        interests: currentInterests, 
        authId: userIdRef.current 
      });
      setIsFindingPartner(true);
      setIsSelfDisconnectedRecently(false);
      setIsPartnerLeftRecently(false);
      currentSocket.emit('findPartner', { chatType: 'text', interests: currentInterests, authId: userIdRef.current });
      autoSearchDoneRef.current = true;
    } else {
      let reason = "";
      if (!currentSocket?.connected) reason += "Socket not connected. ";
      if (autoSearchDoneRef.current) reason += "Auto search already done. ";
      if (isPartnerConnected) reason += "Already partner connected. ";
      if (isFindingPartner) reason += "Already finding partner. ";
      if (roomIdRef.current) reason += "Already in a room. ";
      if (reason) console.log(`${LOG_PREFIX}: Auto-search conditions not met: ${reason}`);
    }
  }, [isPartnerConnected, isFindingPartner, searchParams]);

  useEffect(() => {
    if (!isMounted) return;
    
    const fetchOwnProfile = async () => {
      try {
        console.log(`${LOG_PREFIX}: Starting auth check...`);
        const { data: { user } } = await supabase.auth.getUser();
        userIdRef.current = user?.id || null;
        console.log(`${LOG_PREFIX}: Auth check complete. User ID: ${userIdRef.current || 'anonymous'}`);
        
        if (user) {
          console.log(`${LOG_PREFIX}: Fetching profile for authenticated user: ${user.id}`);
          const { data: profile, error } = await supabase
            .from('user_profiles')
            .select('username, display_name')
            .eq('id', user.id)
            .single();
            
          if (error && error.code !== 'PGRST116') {
            console.error(`${LOG_PREFIX}: Error fetching own profile:`, error);
            setOwnProfileUsername(null);
          } else if (profile) {
            console.log(`${LOG_PREFIX}: Fetched own profile:`, profile);
            const displayUsername = profile.display_name || profile.username;
            setOwnProfileUsername(displayUsername);
            console.log(`${LOG_PREFIX}: Set own display username to: ${displayUsername}`);
          } else {
            console.log(`${LOG_PREFIX}: No profile found for user ${user.id} or username is null.`);
            setOwnProfileUsername(null);
          }
        } else {
          console.log(`${LOG_PREFIX}: No authenticated user found - proceeding as anonymous.`);
          setOwnProfileUsername(null);
        }
      } catch (e) {
        console.error(`${LOG_PREFIX}: Exception fetching own profile:`, e);
        userIdRef.current = null;
        setOwnProfileUsername(null);
      }
      
      console.log(`${LOG_PREFIX}: Auth loading complete. Setting isAuthLoading to false.`);
      setIsAuthLoading(false);
    };
    
    fetchOwnProfile();
  }, [isMounted]);

  // Favicon and system message effects (keeping same logic)
  useEffect(() => {
    if (successTransitionIntervalRef.current) clearInterval(successTransitionIntervalRef.current);
    if (successTransitionEndTimeoutRef.current) clearTimeout(successTransitionEndTimeoutRef.current);
    if (skippedFaviconTimeoutRef.current) clearTimeout(skippedFaviconTimeoutRef.current);

    let updatedMessages = [...messages];
    const filterSystemMessagesFrom = (msgs: Message[], textPattern: string): Message[] => msgs.filter(msg => !(msg.sender === 'system' && msg.text.toLowerCase().includes(textPattern.toLowerCase())));
    const addSystemMessageIfNotPresentIn = (msgs: Message[], text: string, idSuffix: string): Message[] => {
      const lowerText = text.toLowerCase();
      if (!msgs.some(msg => msg.sender === 'system' && msg.text.toLowerCase().includes(lowerText))) {
        return [...msgs, { id: `${Date.now()}-${idSuffix}`, text, sender: 'system', timestamp: new Date() }];
      }
      return msgs;
    };

    if (socketError) {
      changeFavicon(FAVICON_SKIPPED);
    } else if (isSelfDisconnectedRecently) { 
      changeFavicon(FAVICON_SKIPPED);
      skippedFaviconTimeoutRef.current = setTimeout(() => {
          if (isFindingPartner) changeFavicon(FAVICON_SEARCHING); 
      }, 500);
       if (isFindingPartner) { 
           updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_PARTNER_DISCONNECTED.toLowerCase());
           updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_STOPPED_SEARCHING.toLowerCase());
           updatedMessages = addSystemMessageIfNotPresentIn(updatedMessages, SYS_MSG_SEARCHING_PARTNER, 'search-after-skip');
       }
    } else if (isPartnerLeftRecently) { 
      changeFavicon(FAVICON_SKIPPED);
      skippedFaviconTimeoutRef.current = setTimeout(() => {
          if (!isFindingPartner && !isPartnerConnected) changeFavicon(FAVICON_IDLE); 
      }, 1000);
      updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_SEARCHING_PARTNER.toLowerCase());
      updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_STOPPED_SEARCHING.toLowerCase());
      updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_YOU_DISCONNECTED.toLowerCase());
      updatedMessages = addSystemMessageIfNotPresentIn(updatedMessages, SYS_MSG_PARTNER_DISCONNECTED, 'partner-left');
    } else if (isFindingPartner) { 
      changeFavicon(FAVICON_SEARCHING);
      if (!prevIsFindingPartnerRef.current || prevIsSelfDisconnectedRecentlyRef.current || prevIsPartnerLeftRecentlyRef.current) {
        updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_PARTNER_DISCONNECTED.toLowerCase());
        updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_STOPPED_SEARCHING.toLowerCase());
        updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_YOU_DISCONNECTED.toLowerCase());
        updatedMessages = addSystemMessageIfNotPresentIn(updatedMessages, SYS_MSG_SEARCHING_PARTNER, 'search');
      }
    } else if (isPartnerConnected) { 
      if (!prevIsPartnerConnectedRef.current) { 
        let count = 0; changeFavicon(FAVICON_SUCCESS);
        successTransitionIntervalRef.current = setInterval(() => { changeFavicon(count % 2 === 0 ? FAVICON_IDLE : FAVICON_SUCCESS); count++; }, 750);
        successTransitionEndTimeoutRef.current = setTimeout(() => { if (successTransitionIntervalRef.current) clearInterval(successTransitionIntervalRef.current); if (isPartnerConnected) changeFavicon(FAVICON_SUCCESS); }, 3000);
        updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_SEARCHING_PARTNER.toLowerCase());
        updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_PARTNER_DISCONNECTED.toLowerCase());
        updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_STOPPED_SEARCHING.toLowerCase());
        updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_YOU_DISCONNECTED.toLowerCase());
        updatedMessages = addSystemMessageIfNotPresentIn(updatedMessages, SYS_MSG_CONNECTED_PARTNER, 'connect');
        if (interests.length > 0 && partnerInterests.length > 0) {
          const common = interests.filter(i => partnerInterests.includes(i));
          if (common.length > 0) updatedMessages = addSystemMessageIfNotPresentIn(updatedMessages, `${SYS_MSG_COMMON_INTERESTS_PREFIX}${common.join(', ')}.`, 'common');
        }
      } else if (!successTransitionIntervalRef.current && !successTransitionEndTimeoutRef.current) changeFavicon(FAVICON_SUCCESS);
    } else { 
      changeFavicon(FAVICON_IDLE);
      if (prevIsFindingPartnerRef.current && !isFindingPartner && !isPartnerConnected && !roomIdRef.current && !socketError && !isPartnerLeftRecently && !isSelfDisconnectedRecently) {
        if (updatedMessages.some(msg => msg.sender === 'system' && msg.text.toLowerCase().includes(SYS_MSG_SEARCHING_PARTNER.toLowerCase()))) {
          updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_SEARCHING_PARTNER.toLowerCase());
          updatedMessages = addSystemMessageIfNotPresentIn(updatedMessages, SYS_MSG_STOPPED_SEARCHING, 'stopsearch');
        }
      }
    }
    if (updatedMessages.length !== messages.length || !updatedMessages.every((v, i) => v.id === messages[i]?.id && v.text === messages[i]?.text)) setMessages(updatedMessages);
    prevIsFindingPartnerRef.current = isFindingPartner;
    prevIsPartnerConnectedRef.current = isPartnerConnected;
    prevIsSelfDisconnectedRecentlyRef.current = isSelfDisconnectedRecently;
    prevIsPartnerLeftRecentlyRef.current = isPartnerLeftRecently;
  }, [isPartnerConnected, isFindingPartner, socketError, isSelfDisconnectedRecently, isPartnerLeftRecently, partnerInterests, interests, changeFavicon, messages]);

  const handleFindOrDisconnectPartner = useCallback(() => {
    const currentInterests = searchParams.get('interests')?.split(',').filter(i => i.trim() !== '') || [];
    console.log(`${LOG_PREFIX}: handleFindOrDisconnectPartner called. isPartnerConnected=${isPartnerConnected}, roomIdRef.current=${roomIdRef.current}, isFindingPartner=${isFindingPartner}`);
    if (isProcessingFindOrDisconnect.current) {
      console.log(`${LOG_PREFIX}: Find/disconnect action already in progress.`);
      return;
    }
    
    const currentSocket = socketRef.current;

    if (!currentSocket) {
      toast({ title: "Not Connected", description: "Chat server connection not yet established.", variant: "destructive" });
      return;
    }

    isProcessingFindOrDisconnect.current = true; 
    const currentRoomId = roomIdRef.current;

    if (isPartnerConnected && currentRoomId) { 
      console.log(`${LOG_PREFIX}: User ${currentSocket.id} is skipping partner in room ${currentRoomId}.`);
      addMessageToList(SYS_MSG_YOU_DISCONNECTED, 'system', undefined, undefined, 'self-disconnect-skip');
      
      setIsPartnerConnected(false);
      setRoomId(null); 
      setIsPartnerTyping(false);
      setPartnerInterests([]);
      setPartnerAuthId(null);

      if (currentSocket.connected) {
        currentSocket.emit('leaveChat', { roomId: currentRoomId });
      }

      console.log(`${LOG_PREFIX}: Re-emitting 'findPartner' after skip for ${currentSocket.id}. AuthID: ${userIdRef.current}`);
      setIsFindingPartner(true); 
      setIsSelfDisconnectedRecently(true); 
      setIsPartnerLeftRecently(false);

      if (currentSocket.connected) {
        currentSocket.emit('findPartner', { chatType: 'text', interests: currentInterests, authId: userIdRef.current });
      } else {
        toast({ title: "Connection Issue", description: "Cannot find new partner, connection lost.", variant: "destructive" });
        setSocketError(true);
        setIsFindingPartner(false); 
      }
    } else if (isFindingPartner) { 
      console.log(`${LOG_PREFIX}: User ${currentSocket.id} stopping partner search.`);
      setIsFindingPartner(false);
      setIsSelfDisconnectedRecently(false); 
      setIsPartnerLeftRecently(false);
    } else { 
      if (!currentSocket.connected) {
        toast({ title: "Connecting...", description: "Attempting to connect to chat server.", variant: "default" });
        isProcessingFindOrDisconnect.current = false; 
        return;
      }
      console.log(`${LOG_PREFIX}: User ${currentSocket.id} starting partner search via button. AuthID: ${userIdRef.current}`);
      setIsFindingPartner(true);
      setIsSelfDisconnectedRecently(false);
      setIsPartnerLeftRecently(false);
      currentSocket.emit('findPartner', { chatType: 'text', interests: currentInterests, authId: userIdRef.current });
    }
    
    setTimeout(() => {
      isProcessingFindOrDisconnect.current = false;
    }, 200);
  }, [isPartnerConnected, isFindingPartner, searchParams, toast, addMessageToList]);

  // Socket connection management
  useEffect(() => {
    const socketServerUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL;
    if (!socketServerUrl) {
      console.error(`${LOG_PREFIX}: Socket server URL is not defined. Cannot connect.`);
      toast({ title: "Config Error", description: "Chat server URL missing.", variant: "destructive" });
      setSocketError(true);
      return;
    }

    if (socketRef.current) {
      console.log(`${LOG_PREFIX}: Socket already exists, skipping creation.`);
      return;
    }

    console.log(`${LOG_PREFIX}: Socket useEffect (setup/teardown) runs. Attempting to connect to: ${socketServerUrl}`);
    const newSocket = io(socketServerUrl, { 
      withCredentials: true, 
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000
    });
    socketRef.current = newSocket;
    const socketToClean = newSocket;

    const onConnect = () => {
      console.log(`%cSOCKET CONNECTED: ${socketToClean.id}`, 'color: orange; font-weight: bold;');
      setSocketError(false);
      setIsSocketConnected(true);
      autoSearchDoneRef.current = false;
      setTimeout(() => {
        if (socketToClean.connected && !autoSearchDoneRef.current) {
          console.log(`${LOG_PREFIX}: Socket connected and stable. Attempting auto search.`);
          const currentSocket = socketRef.current;
          const currentInterests = searchParams.get('interests')?.split(',').filter(i => i.trim() !== '') || [];
          if (currentSocket?.connected && !autoSearchDoneRef.current && !isPartnerConnected && !isFindingPartner && !roomIdRef.current) {
            console.log(`${LOG_PREFIX}: Conditions met for auto search. Emitting 'findPartner'. Payload:`, { 
              chatType: 'text', 
              interests: currentInterests, 
              authId: userIdRef.current 
            });
            setIsFindingPartner(true);
            setIsSelfDisconnectedRecently(false);
            setIsPartnerLeftRecently(false);
            currentSocket.emit('findPartner', { chatType: 'text', interests: currentInterests, authId: userIdRef.current });
            autoSearchDoneRef.current = true;
          }
        }
      }, 100);
    };

    const onPartnerFound = ({ partnerId: pId, roomId: rId, interests: pInterests, partnerUsername, partnerDisplayName, partnerAvatarUrl, partnerAuthId }: { partnerId: string, roomId: string, interests: string[], partnerUsername?: string, partnerDisplayName?: string, partnerAvatarUrl?: string, partnerAuthId?: string }) => {
      console.log(`${LOG_PREFIX}: %cSOCKET EVENT: partnerFound`, 'color: green; font-weight: bold;', { partnerIdFromServer: pId, rId, partnerUsername, pInterests, partnerDisplayName, partnerAvatarUrl, partnerAuthId });
      playSound("Match.wav");
      setMessages([]);
      setRoomId(rId); 
      setPartnerInterests(pInterests || []);
      setPartnerAuthId(partnerAuthId || null);
      setIsFindingPartner(false);
      setIsPartnerConnected(true); 
      setIsSelfDisconnectedRecently(false); 
      setIsPartnerLeftRecently(false);
    };

    const onWaitingForPartner = () => {
      if (socketToClean.connected) console.log(`${LOG_PREFIX}: Client %cSOCKET EVENT: waitingForPartner`, 'color: blue; font-weight: bold;', `for ${socketToClean.id}`);
    };

    const onFindPartnerCooldown = () => {
      if (socketToClean.connected) {
        console.log(`${LOG_PREFIX}: Cooldown for ${socketToClean.id}`);
        toast({ title: "Slow down!", description: "Please wait before finding a new partner.", variant: "default" });
        setIsFindingPartner(false);
      }
    };

    const onReceiveMessage = ({ senderId, message: receivedMessage, senderUsername, senderAuthId }: { senderId: string, message: string, senderUsername?: string, senderAuthId?: string }) => {
      console.log(`${LOG_PREFIX}: %c[[CLIENT RECEIVE MESSAGE]]`, 'color: purple; font-size: 1.2em; font-weight: bold;',
        `RAW_PAYLOAD:`, { senderId, message: receivedMessage, senderUsername, senderAuthId },
        `CURRENT_ROOM_ID_REF: ${roomIdRef.current}`
      );
      
      if (senderAuthId) {
        setPartnerAuthId(senderAuthId);
      }
      
      addMessageToList(receivedMessage, 'partner', senderUsername, senderAuthId, `partner-${Math.random().toString(36).substring(2,7)}`);
      setIsPartnerTyping(false);
    };

    const onPartnerLeft = () => {
      if (socketToClean.connected) {
        console.log(`${LOG_PREFIX}: %cSOCKET EVENT: partnerLeft`, 'color: red; font-weight: bold;', `Room: ${roomIdRef.current}, Socket: ${socketToClean.id}`);
        setIsPartnerConnected(false);
        setIsFindingPartner(false);
        setIsPartnerTyping(false);
        setRoomId(null); 
        setPartnerInterests([]);
        setPartnerAuthId(null);
        setIsPartnerLeftRecently(true);
        setIsSelfDisconnectedRecently(false);
      }
    };

    const onDisconnectHandler = (reason: string) => {
      console.warn(`${LOG_PREFIX}: Socket ${socketToClean.id} disconnected. Reason: ${reason}`);
      setIsSocketConnected(false);
      if (reason !== 'io client disconnect') {
        setSocketError(true);
      }
      setIsPartnerConnected(false); 
      setIsFindingPartner(false); 
      setIsPartnerTyping(false); 
      setRoomId(null);
      setPartnerAuthId(null);
      autoSearchDoneRef.current = false;
    };

    const onConnectError = (err: Error) => {
        console.error(`${LOG_PREFIX}: Socket ${socketToClean.id} connection error: ${String(err)}`, err);
        setSocketError(true);
        setIsSocketConnected(false);
        toast({ title: "Connection Error", description: `Could not connect to chat: ${String(err)}`, variant: "destructive" });
        setIsFindingPartner(false); 
        setIsPartnerTyping(false);
    };

    const onPartnerTypingStart = () => setIsPartnerTyping(true);
    const onPartnerTypingStop = () => setIsPartnerTyping(false);

    // Attach event listeners
    if (socketToClean.connected) onConnect(); else socketToClean.on('connect', onConnect);
    socketToClean.on('partnerFound', onPartnerFound);
    socketToClean.on('waitingForPartner', onWaitingForPartner);
    socketToClean.on('findPartnerCooldown', onFindPartnerCooldown);
    socketToClean.on('receiveMessage', onReceiveMessage);
    socketToClean.on('partnerLeft', onPartnerLeft);
    socketToClean.on('disconnect', onDisconnectHandler);
    socketToClean.on('connect_error', onConnectError);
    socketToClean.on('partner_typing_start', onPartnerTypingStart);
    socketToClean.on('partner_typing_stop', onPartnerTypingStop);

    return () => {
      console.log(`${LOG_PREFIX}: Cleanup for socket effect. Socket to clean ID: ${socketToClean?.id}. Current socketRef ID: ${socketRef.current?.id}`);
      
      socketToClean.removeAllListeners();
      socketToClean.disconnect();
      console.log(`${LOG_PREFIX}: Disconnected socket ${socketToClean.id} in cleanup.`);

      if (socketRef.current === socketToClean) { 
        socketRef.current = null;
        console.log(`${LOG_PREFIX}: Set socketRef.current to null because it matched the socket being cleaned.`);
      }

      if (successTransitionIntervalRef.current) clearInterval(successTransitionIntervalRef.current);
      if (successTransitionEndTimeoutRef.current) clearTimeout(successTransitionEndTimeoutRef.current);
      if (skippedFaviconTimeoutRef.current) clearTimeout(skippedFaviconTimeoutRef.current);
      if (hoverIntervalRef.current) clearInterval(hoverIntervalRef.current);
      if (localTypingTimeoutRef.current) clearTimeout(localTypingTimeoutRef.current);
      changeFavicon(FAVICON_DEFAULT, true);
    };
  }, []);

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    if (effectivePageTheme === 'theme-98') {
      setEmojisLoading(true);
      fetch('/emote_index.json')
        .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
        .then((data: EmoteData[]) => setPickerEmojiFilenames(data.map(e => e.filename)))
        .catch(err => {
          console.error(`${LOG_PREFIX}: Error fetching emote_index.json:`, err);
          toast({ title: "Emoji Error", description: `Could not load emojis: ${err.message}`, variant: "destructive" });
          setPickerEmojiFilenames([]);
        })
        .finally(() => setEmojisLoading(false));
    } else {
      setEmojisLoading(false);
      setPickerEmojiFilenames([]);
    }
  }, [effectivePageTheme, toast]);

  // Auto-scroll effect for new messages
  useEffect(() => { 
    scrollToBottom();
  }, [messages, isPartnerTyping, scrollToBottom]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const emojiIconTrigger = document.getElementById('emoji-icon-trigger');
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node) && emojiIconTrigger && !emojiIconTrigger.contains(event.target as Node)) {
        setIsEmojiPickerOpen(false);
      }
    };
    if (isEmojiPickerOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEmojiPickerOpen]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPartnerTyping) {
      interval = setInterval(() => setTypingDots(prev => prev.length >= 3 ? '.' : prev + '.'), 500);
    } else {
      setTypingDots('.');
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isPartnerTyping]);

  const stopLocalTyping = useCallback(() => {
    if (localTypingTimeoutRef.current) clearTimeout(localTypingTimeoutRef.current);
    localTypingTimeoutRef.current = null;
    if (isLocalTypingRef.current && socketRef.current?.connected && roomIdRef.current) {
      socketRef.current.emit('typing_stop', { roomId: roomIdRef.current });
      isLocalTypingRef.current = false;
    }
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    const currentSocket = socketRef.current;
    const currentRoomId = roomIdRef.current;
    if (currentSocket?.connected && currentRoomId && isPartnerConnected) {
      if (value.trim() !== '' && !isLocalTypingRef.current) {
        currentSocket.emit('typing_start', { roomId: currentRoomId });
        isLocalTypingRef.current = true;
      }
      if (localTypingTimeoutRef.current) clearTimeout(localTypingTimeoutRef.current);
      if (value.trim() !== '') {
        localTypingTimeoutRef.current = setTimeout(() => {
           if (socketRef.current?.connected && roomIdRef.current) {
              socketRef.current.emit('typing_stop', { roomId: roomIdRef.current });
              isLocalTypingRef.current = false;
           }
        }, 2000);
      } else if (isLocalTypingRef.current) {
        stopLocalTyping();
      }
    }
  }, [isPartnerConnected, stopLocalTyping]);

  const handleSendMessage = useCallback(() => {
    const trimmedMessage = newMessage.trim();
    const currentSocket = socketRef.current;
    const currentRoomId = roomIdRef.current;

    const usernameToSend = userIdRef.current ? ownProfileUsername : null;

    console.log(`${LOG_PREFIX}: Attempting send. Msg: "${trimmedMessage}", Socket Connected: ${!!currentSocket?.connected}, RoomId: ${currentRoomId}, Partner Connected State: ${isPartnerConnected}, Username to send: ${usernameToSend}, User Auth ID: ${userIdRef.current || 'anonymous'}`);

    if (!trimmedMessage || !currentSocket?.connected || !currentRoomId || !isPartnerConnected) {
      let warning = "Send message aborted. Conditions not met.";
      if (!trimmedMessage) warning += " Message is empty.";
      if (!currentSocket?.connected) warning += " Socket not connected.";
      if (!currentRoomId) warning += " Room ID is null.";
      if (!isPartnerConnected) warning += " Partner not connected.";
      console.warn(`${LOG_PREFIX}: ${warning}`);

      if (!currentSocket?.connected) toast({ title: "Not Connected", description: "Cannot send message, not connected to server.", variant: "destructive" });
      else if (!isPartnerConnected) toast({ title: "No Partner", description: "Cannot send message, no partner connected.", variant: "destructive" });
      else if (!currentRoomId) toast({ title: "No Room", description: "Cannot send message, not in a room.", variant: "destructive" });
      return;
    }

    currentSocket.emit('sendMessage', {
      roomId: currentRoomId,
      message: trimmedMessage,
      username: usernameToSend,
      authId: userIdRef.current,
    });

    addMessageToList(trimmedMessage, 'me'); 
    setNewMessage('');
    stopLocalTyping();
    
    // Force scroll to bottom after sending message
    setTimeout(() => scrollToBottom(true), 50);
  }, [newMessage, isPartnerConnected, addMessageToList, stopLocalTyping, ownProfileUsername, toast, scrollToBottom]);

  // Handle input focus on mobile to prevent viewport issues
  const handleInputFocus = useCallback(() => {
    if (isMobile && inputRef.current) {
      // Scroll to bottom when input is focused on mobile
      setTimeout(() => scrollToBottom(true), 300);
    }
  }, [isMobile, scrollToBottom]);

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

  const findOrDisconnectText = useMemo(() => {
    if (isPartnerConnected) return isMobile ? 'Skip' : 'Disconnect';
    if (isFindingPartner) return isMobile ? 'Stop' : 'Stop Searching';
    return isMobile ? 'Find' : 'Find Partner';
  }, [isPartnerConnected, isFindingPartner, isMobile]);

  const mainButtonDisabled = useMemo(() => !isSocketConnected || socketError || isProcessingFindOrDisconnect.current, [isSocketConnected, socketError]);
  const inputAndSendDisabled = useMemo(() => !isSocketConnected || !isPartnerConnected || isFindingPartner || socketError, [isSocketConnected, isPartnerConnected, isFindingPartner, socketError]);

  if (!isMounted) return <div className="flex flex-1 items-center justify-center p-4"><p>Loading chat...</p></div>;

  return (
    <>
      {/* Hide HomeButton on mobile to save space */}
      {!isMobile && <HomeButton />}
      
      <div className={cn(
        "flex flex-col items-center justify-center",
        isMobile ? "h-screen w-screen p-0" : "h-full p-4"
      )}>
        <div className={cn(
          'window flex flex-col relative',
          effectivePageTheme === 'theme-7' ? 'glass' : '',
          isMobile ? 'h-full w-full' : ''
        )} style={chatWindowStyle}>
          {effectivePageTheme === 'theme-7' && !isMobile && <ConditionalGoldfishImage />}
          
          <div className={cn(
            "title-bar",
            effectivePageTheme === 'theme-7' ? 'text-black' : '',
            isMobile && "text-sm h-8 min-h-8"
          )}>
            <div className="flex items-center flex-grow">
              <div className="title-bar-text">
                {isMobile ? 'TinChat' : 'Text Chat'}
              </div>
            </div>
            {/* Add online status or connection indicator on mobile */}
            {isMobile && (
              <div className="flex items-center text-xs mr-2">
                <div className={cn(
                  "w-2 h-2 rounded-full mr-1",
                  isSocketConnected ? "bg-green-500" : "bg-red-500"
                )} />
                {isPartnerConnected ? 'Connected' : isFindingPartner ? 'Searching...' : 'Offline'}
              </div>
            )}
          </div>
          
          <div className={cn(
            'window-body window-body-content flex-grow flex flex-col',
            effectivePageTheme === 'theme-7' ? 'glass-body-padding' : 'p-0.5',
            isMobile && 'p-1'
          )}>
            <div 
              ref={messagesContainerRef}
              className={cn(
                "flex-grow overflow-y-auto overscroll-contain",
                effectivePageTheme === 'theme-7' 
                  ? 'border p-2 bg-white bg-opacity-20 dark:bg-gray-700 dark:bg-opacity-20' 
                  : 'sunken-panel tree-view p-1',
                isMobile && 'p-2'
              )} 
              style={{ 
                height: messagesContainerComputedHeight, 
                overflowY: isScrollEnabled ? 'auto' : 'hidden',
                WebkitOverflowScrolling: 'touch' // Smooth scrolling on iOS
              }}>
              <div>
                {isAuthLoading && messages.length === 0 && (
                  <div className="text-center text-xs italic p-2 text-gray-500 dark:text-gray-400">
                    Initializing authentication...
                  </div>
                )}
                {messages.map((msg, index) => (
                  <Row 
                    key={msg.id} 
                    message={msg} 
                    theme={effectivePageTheme} 
                    previousMessageSender={index > 0 ? messages[index-1]?.sender : undefined} 
                    pickerEmojiFilenames={pickerEmojiFilenames} 
                    ownDisplayName={ownDisplayUsername}
                    ownAuthId={userIdRef.current}
                    onUsernameClick={handleUsernameClick}
                    isMobile={isMobile}
                  />
                ))}
                {isPartnerTyping && (
                  <div className={cn(
                    "text-xs italic text-left pl-1 py-0.5",
                    effectivePageTheme === 'theme-7' ? 'theme-7-text-shadow text-gray-100' : 'text-gray-500 dark:text-gray-400'
                  )}>
                    {messages.find(m => m.sender === 'partner')?.senderUsername || 'Stranger'} is typing{typingDots}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
            
            <div className={cn(
              "flex-shrink-0",
              effectivePageTheme === 'theme-7' ? 'input-area border-t dark:border-gray-600' : 'input-area status-bar',
              isMobile ? "p-2" : "p-2"
            )} 
            style={{ 
              height: `${currentInputAreaHeight}px`,
              paddingBottom: isMobile ? 'env(safe-area-inset-bottom)' : undefined
            }}>
              <div className="flex items-center w-full gap-1">
                <Button 
                  onClick={handleFindOrDisconnectPartner} 
                  disabled={mainButtonDisabled} 
                  className={cn(
                    effectivePageTheme === 'theme-7' ? 'glass-button-styled' : 'px-1 py-1',
                    isMobile ? 'text-xs px-2 py-1 min-w-0' : 'mr-1'
                  )} 
                  aria-label={findOrDisconnectText}
                >
                  {findOrDisconnectText}
                </Button>
                
                <Input 
                  ref={inputRef}
                  type="text" 
                  value={newMessage} 
                  onChange={handleInputChange} 
                  onFocus={handleInputFocus}
                  onKeyPress={(e) => e.key === 'Enter' && !inputAndSendDisabled && handleSendMessage()} 
                  placeholder={isMobile ? "Type message..." : "Type a message..."} 
                  className={cn(
                    "flex-1 w-full",
                    isMobile ? "text-base px-2 py-1" : "px-1 py-1" // Prevent zoom on iOS
                  )} 
                  disabled={inputAndSendDisabled} 
                  aria-label="Chat message input"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="sentences"
                />
                
                {effectivePageTheme === 'theme-98' && !isMobile && (
                  <div className="relative flex-shrink-0">
                    <img 
                      id="emoji-icon-trigger" 
                      src={currentEmojiIconUrl} 
                      alt="Emoji" 
                      className="w-4 h-4 cursor-pointer inline-block ml-1" 
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
                        className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-silver border border-raised z-30 window" 
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
                                  className="max-w-6 max-h-6 object-contain cursor-pointer hover:bg-navy hover:p-0.5" 
                                  onClick={() => { 
                                    setNewMessage(prev => `${prev} :${shortcode}: `); 
                                    setIsEmojiPickerOpen(false); 
                                  }} 
                                  data-ai-hint="emoji symbol" 
                                  role="gridcell" 
                                  tabIndex={0} 
                                  onKeyDown={(e) => e.key === 'Enter' && (() => { 
                                    setNewMessage(prev => `${prev} :${shortcode}: `); 
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
                
                <Button 
                  onClick={handleSendMessage} 
                  disabled={inputAndSendDisabled || !newMessage.trim()} 
                  className={cn(
                    effectivePageTheme === 'theme-7' ? 'glass-button-styled' : 'px-1 py-1',
                    isMobile ? 'text-xs px-2 py-1 min-w-0' : 'ml-1'
                  )} 
                  aria-label="Send message"
                >
                  {isMobile ? '→' : 'Send'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Card Modal */}
      {profileCardUserId && (
        <ProfileCard
          userId={profileCardUserId}
          isOpen={isProfileCardOpen}
          onClose={handleProfileCardClose}
          onScrollToggle={setIsScrollEnabled}
        />
      )}
    </>
  );
};

export default ChatPageClientContent;