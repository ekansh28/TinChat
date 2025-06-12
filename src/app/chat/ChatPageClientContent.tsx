// src/app/chat/ChatPageClientContent.tsx - Updated theme integration
'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/components/theme-provider';
import { cn, playSound } from '@/lib/utils';
import { ConditionalGoldfishImage } from '@/components/ConditionalGoldfishImage';
import HomeButton from '@/components/HomeButton';
import { TopBar } from '@/components/top-bar';
import { supabase } from '@/lib/supabase';
import { ProfileCard } from '@/components/ProfileCard';

// Import modular components
import ChatWindow from './components/ChatWindow';
import PartnerProfile from './components/PartnerProfile';
import MatchStatus from './components/MatchStatus';

// Import hooks and utilities
import { useChatSocket, useChatState } from './hooks/useChatSocket';
import { PartnerInfo, Message, changeFavicon } from './utils/ChatHelpers';

// Constants
const FAVICON_IDLE = '/Idle.ico';
const FAVICON_SEARCHING = '/Searching.ico';
const FAVICON_SUCCESS = '/Success.ico';
const FAVICON_SKIPPED = '/Skipped.ico';
const FAVICON_DEFAULT = '/favicon.ico';

const SYS_MSG_SEARCHING_PARTNER = 'Searching for a partner...';
const SYS_MSG_STOPPED_SEARCHING = 'Stopped searching for a partner.';
const SYS_MSG_CONNECTED_PARTNER = 'Connected with a partner. You can start chatting!';
const SYS_MSG_YOU_DISCONNECTED = 'You have disconnected.';
const SYS_MSG_PARTNER_DISCONNECTED = 'Your partner has disconnected.';
const SYS_MSG_COMMON_INTERESTS_PREFIX = 'You both like ';

const LOG_PREFIX = "ChatPageClientContent";

const ChatPageClientContent: React.FC = () => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { toast } = useToast();
  const { currentTheme } = useTheme(); // Get theme from provider
  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);
  
  // Pink theme detection state
  const [pinkThemeActive, setPinkThemeActive] = useState(false);
  
  // Auth state
  const [authId, setAuthId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [ownDisplayNameColor, setOwnDisplayNameColor] = useState('#0066cc');
  const [ownDisplayNameAnimation, setOwnDisplayNameAnimation] = useState('none');

  // Profile card state
  const [isProfileCardOpen, setIsProfileCardOpen] = useState(false);
  const [profileCardUserId, setProfileCardUserId] = useState<string | null>(null);
  const [profileCardPosition, setProfileCardPosition] = useState<{ x: number; y: number } | null>(null);
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);

  // Connection tracking refs
  const autoSearchDoneRef = useRef(false);
  const isProcessingFindOrDisconnect = useRef(false);
  const successTransitionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const successTransitionEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const skippedFaviconTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Previous state tracking for favicon logic
  const prevIsFindingPartnerRef = useRef(false);
  const prevIsPartnerConnectedRef = useRef(false);
  const prevIsSelfDisconnectedRecentlyRef = useRef(false);
  const prevIsPartnerLeftRecentlyRef = useRef(false);

  // Additional state for advanced logic
  const [isSelfDisconnectedRecently, setIsSelfDisconnectedRecently] = useState(false);
  const [isPartnerLeftRecently, setIsPartnerLeftRecently] = useState(false);
  const [partnerInterests, setPartnerInterests] = useState<string[]>([]);

  // Use the chat state hook
  const {
    messages,
    setMessages,
    isPartnerConnected,
    setIsPartnerConnected,
    isFindingPartner,
    setIsFindingPartner,
    partnerInfo,
    setPartnerInfo,
    isPartnerTyping,
    setIsPartnerTyping,
    currentMessage,
    setCurrentMessage,
    addMessage,
    addSystemMessage,
    resetChatState
  } = useChatState();

  const interests = useMemo(() => 
    searchParams.get('interests')?.split(',').filter(i => i.trim() !== '') || [], 
    [searchParams]
  );

  // Use theme from provider, but ensure compatibility
  const effectivePageTheme = useMemo(() => {
    // Always use theme-98 since that's what the ThemeProvider forces
    // But respect any sub-themes applied via TopBar
    return isMounted ? currentTheme : 'theme-98';
  }, [isMounted, currentTheme]);

  const ownDisplayUsername = useMemo(() => {
    return username || "You";
  }, [username]);

  // Chat window style
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

  // CSS for display name animations - always included since we support these features
  const displayNameAnimationCSS = `
    .display-name-rainbow {
      background: linear-gradient(45deg, #ff0000, #ff8000, #ffff00, #80ff00, #00ff00, #00ff80, #00ffff, #0080ff, #0000ff, #8000ff, #ff00ff, #ff0080);
      background-size: 400% 400%;
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: rainbow 3s ease-in-out infinite;
    }

    @keyframes rainbow {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }

    .display-name-gradient {
      background: linear-gradient(45deg, #667eea, #764ba2, #f093fb, #f5576c);
      background-size: 300% 300%;
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: gradientShift 4s ease-in-out infinite;
    }

    @keyframes gradientShift {
      0%, 100% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
    }

    .display-name-pulse {
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.8; transform: scale(1.05); }
    }

    .display-name-glow {
      text-shadow: 0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor;
      animation: glow 2s ease-in-out infinite alternate;
    }

    @keyframes glow {
      from { text-shadow: 0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor; }
      to { text-shadow: 0 0 20px currentColor, 0 0 30px currentColor, 0 0 40px currentColor; }
    }
  `;

  // Navigation cleanup effect
  useEffect(() => {
    if (pathname === '/chat') {
      console.log(`${LOG_PREFIX}: Navigation to chat page detected, resetting states`);
      setIsFindingPartner(false);
      setIsPartnerConnected(false);
      setMessages([]);
      setPartnerInfo(null);
      setIsSelfDisconnectedRecently(false);
      setIsPartnerLeftRecently(false);
      autoSearchDoneRef.current = false;
    }
  }, [pathname, setIsFindingPartner, setIsPartnerConnected, setMessages, setPartnerInfo]);

  // Pink theme detection effect
  useEffect(() => {
    const checkPinkTheme = () => {
      if (typeof window === 'undefined') return false;
      const themeLink = document.getElementById('dynamic-win98-theme-style') as HTMLLinkElement;
      const isActive = themeLink && themeLink.href.includes('pink-theme.css');
      setPinkThemeActive(isActive);
      console.log(`${LOG_PREFIX}: Pink theme active:`, isActive);
      return isActive;
    };

    // Check immediately
    checkPinkTheme();

    // Set up a MutationObserver to watch for theme changes
    const observer = new MutationObserver(() => {
      checkPinkTheme();
    });

    // Watch for changes to the head element (where theme links are added/removed)
    if (document.head) {
      observer.observe(document.head, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['href']
      });
    }

    return () => observer.disconnect();
  }, []);

  // Handle mobile detection and viewport changes
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      if (mobile) {
        const height = window.visualViewport?.height || window.innerHeight;
        setViewportHeight(height);
      } else {
        setViewportHeight(window.innerHeight);
      }
    };

    const handleResize = () => checkMobile();

    const handleVisualViewportChange = () => {
      if (isMobile && window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
      }
    };

    checkMobile();
    window.addEventListener('resize', handleResize);
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportChange);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportChange);
      }
    };
  }, [isMobile]);

  // Socket event handlers
  const handleMessage = useCallback((data: any) => {
    console.log(`${LOG_PREFIX}: Message received:`, data);
    
    // Update partner info if we have new styling information
    if (data.senderAuthId && (data.senderDisplayNameColor || data.senderDisplayNameAnimation)) {
      setPartnerInfo(prev => prev ? {
        ...prev,
        displayNameColor: data.senderDisplayNameColor || prev.displayNameColor,
        displayNameAnimation: data.senderDisplayNameAnimation || prev.displayNameAnimation,
        rainbowSpeed: data.senderRainbowSpeed || prev.rainbowSpeed
      } : null);
    }
    
    addMessage({
      text: data.message,
      sender: 'partner',
      senderUsername: data.senderUsername,
      senderAuthId: data.senderAuthId,
      senderDisplayNameColor: data.senderDisplayNameColor,
      senderDisplayNameAnimation: data.senderDisplayNameAnimation,
      senderRainbowSpeed: data.senderRainbowSpeed
    });
    setIsPartnerTyping(false);
  }, [addMessage, setIsPartnerTyping, setPartnerInfo]);

  const handlePartnerFound = useCallback((data: any) => {
    console.log(`${LOG_PREFIX}: Partner found:`, data);
    playSound('Match.wav');
    
    setPartnerInfo({
      id: data.partnerId,
      username: data.partnerUsername || 'Stranger',
      displayName: data.partnerDisplayName,
      avatarUrl: data.partnerAvatarUrl,
      bannerUrl: data.partnerBannerUrl,
      pronouns: data.partnerPronouns,
      status: data.partnerStatus || 'online',
      displayNameColor: data.partnerDisplayNameColor || '#ff0000',
      displayNameAnimation: data.partnerDisplayNameAnimation || 'none',
      rainbowSpeed: data.partnerRainbowSpeed || 3,
      authId: data.partnerAuthId,
      badges: data.partnerBadges || []
    });
    
    setPartnerInterests(data.interests || []);
    setIsFindingPartner(false);
    setIsPartnerConnected(true);
    setIsSelfDisconnectedRecently(false);
    setIsPartnerLeftRecently(false);
    setMessages([]); // Clear messages for new chat
    
  }, [setPartnerInfo, setPartnerInterests, setIsFindingPartner, setIsPartnerConnected, setMessages]);

  const handlePartnerLeft = useCallback(() => {
    console.log(`${LOG_PREFIX}: Partner left`);
    setIsPartnerConnected(false);
    setIsFindingPartner(false);
    setPartnerInfo(null);
    setIsPartnerTyping(false);
    setPartnerInterests([]);
    setIsPartnerLeftRecently(true);
    setIsSelfDisconnectedRecently(false);
  }, [setIsPartnerConnected, setIsFindingPartner, setPartnerInfo, setIsPartnerTyping, setPartnerInterests]);

  const handleStatusChange = useCallback((status: string) => {
    const validStatuses: Array<'online' | 'idle' | 'dnd' | 'offline'> = ['online', 'idle', 'dnd', 'offline'];
    const validStatus = validStatuses.includes(status as any) ? status as 'online' | 'idle' | 'dnd' | 'offline' : 'offline';
    
    setPartnerInfo(prev => {
      if (!prev) return null;
      return { ...prev, status: validStatus };
    });
  }, [setPartnerInfo]);

  const handleTypingStart = useCallback(() => {
    setIsPartnerTyping(true);
  }, [setIsPartnerTyping]);

  const handleTypingStop = useCallback(() => {
    setIsPartnerTyping(false);
  }, [setIsPartnerTyping]);

  const handleWaiting = useCallback(() => {
    console.log(`${LOG_PREFIX}: Waiting for partner...`);
  }, []);

  const handleCooldown = useCallback(() => {
    setIsFindingPartner(false);
    toast({ 
      title: "Slow down!", 
      description: "Please wait before finding a new partner.", 
      variant: "default" 
    });
  }, [setIsFindingPartner, toast]);

  const handleDisconnect = useCallback((reason: string) => {
    console.log(`${LOG_PREFIX}: Disconnected:`, reason);
    setIsPartnerConnected(false);
    setIsFindingPartner(false);
    setIsPartnerTyping(false);
    setPartnerInfo(null);
    autoSearchDoneRef.current = false;
  }, [setIsPartnerConnected, setIsFindingPartner, setIsPartnerTyping, setPartnerInfo]);

  const handleConnectError = useCallback((err: Error) => {
    console.error(`${LOG_PREFIX}: Connection error:`, err);
    setIsFindingPartner(false);
    toast({ 
      title: "Connection Error", 
      description: `Could not connect to chat: ${String(err)}`, 
      variant: "destructive" 
    });
  }, [setIsFindingPartner, toast]);

  // Initialize socket
  const {
    isConnected,
    connectionError,
    emitFindPartner,
    emitMessage,
    emitTypingStart,
    emitTypingStop,
    emitLeaveChat
  } = useChatSocket({
    onMessage: handleMessage,
    onPartnerFound: handlePartnerFound,
    onPartnerLeft: handlePartnerLeft,
    onStatusChange: handleStatusChange,
    onTypingStart: handleTypingStart,
    onTypingStop: handleTypingStop,
    onWaiting: handleWaiting,
    onCooldown: handleCooldown,
    onDisconnectHandler: handleDisconnect,
    onConnectErrorHandler: handleConnectError,
    authId
  });

  // Initialize auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        console.log(`${LOG_PREFIX}: Starting auth check...`);
        const { data: { user } } = await supabase.auth.getUser();
        setAuthId(user?.id || null);
        console.log(`${LOG_PREFIX}: Auth check complete. User ID: ${user?.id || 'anonymous'}`);
        
        if (user) {
          console.log(`${LOG_PREFIX}: Fetching profile for authenticated user: ${user.id}`);
          const { data: profile, error } = await supabase
            .from('user_profiles')
            .select('username, display_name, display_name_color, display_name_animation')
            .eq('id', user.id)
            .single();
            
          if (error && error.code !== 'PGRST116') {
            console.error(`${LOG_PREFIX}: Error fetching profile:`, error);
            setUsername(null);
            setOwnDisplayNameColor('#0066cc');
            setOwnDisplayNameAnimation('none');
          } else if (profile) {
            console.log(`${LOG_PREFIX}: Fetched profile:`, profile);
            const displayUsername = profile.display_name || profile.username;
            setUsername(displayUsername);
            setOwnDisplayNameColor(profile.display_name_color || '#0066cc');
            setOwnDisplayNameAnimation(profile.display_name_animation || 'none');
            console.log(`${LOG_PREFIX}: Set own display username to: ${displayUsername} with color: ${profile.display_name_color} and animation: ${profile.display_name_animation}`);
          } else {
            console.log(`${LOG_PREFIX}: No profile found for user`);
            setUsername(null);
            setOwnDisplayNameColor('#0066cc');
            setOwnDisplayNameAnimation('none');
          }
        } else {
          console.log(`${LOG_PREFIX}: No authenticated user found - proceeding as anonymous`);
          setUsername(null);
          setOwnDisplayNameColor('#0066cc');
          setOwnDisplayNameAnimation('none');
        }
      } catch (error) {
        console.error(`${LOG_PREFIX}: Auth initialization error:`, error);
        setAuthId(null);
        setUsername(null);
        setOwnDisplayNameColor('#0066cc');
        setOwnDisplayNameAnimation('none');
      } finally {
        console.log(`${LOG_PREFIX}: Auth loading complete`);
        setIsAuthLoading(false);
      }
    };
    
    if (isMounted) {
      initAuth();
    }
  }, [isMounted]);

  // Auto-search for partner when connected
  useEffect(() => {
    if (isConnected && !isAuthLoading && !isPartnerConnected && !isFindingPartner && !autoSearchDoneRef.current) {
      console.log(`${LOG_PREFIX}: Auto-searching for partner with interests:`, interests);
      setIsFindingPartner(true);
      addSystemMessage(SYS_MSG_SEARCHING_PARTNER);
      setIsSelfDisconnectedRecently(false);
      setIsPartnerLeftRecently(false);
      
      emitFindPartner({
        chatType: 'text',
        interests,
        authId
      });
      autoSearchDoneRef.current = true;
    }
  }, [isConnected, isAuthLoading, isPartnerConnected, isFindingPartner, interests, authId, emitFindPartner, setIsFindingPartner, addSystemMessage]);

  // Advanced favicon and system message effects
  useEffect(() => {
    if (successTransitionIntervalRef.current) clearInterval(successTransitionIntervalRef.current);
    if (successTransitionEndTimeoutRef.current) clearTimeout(successTransitionEndTimeoutRef.current);
    if (skippedFaviconTimeoutRef.current) clearTimeout(skippedFaviconTimeoutRef.current);

    let updatedMessages = [...messages];
    
    const filterSystemMessagesFrom = (msgs: Message[], textPattern: string): Message[] => 
      msgs.filter(msg => !(msg.sender === 'system' && msg.text.toLowerCase().includes(textPattern.toLowerCase())));
    
    const addSystemMessageIfNotPresentIn = (msgs: Message[], text: string, idSuffix: string): Message[] => {
      const lowerText = text.toLowerCase();
      if (!msgs.some(msg => msg.sender === 'system' && msg.text.toLowerCase().includes(lowerText))) {
        return [...msgs, { 
          id: `${Date.now()}-${idSuffix}`, 
          text, 
          sender: 'system', 
          timestamp: new Date() 
        }];
      }
      return msgs;
    };

    if (connectionError) {
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
        let count = 0; 
        changeFavicon(FAVICON_SUCCESS);
        successTransitionIntervalRef.current = setInterval(() => { 
          changeFavicon(count % 2 === 0 ? FAVICON_IDLE : FAVICON_SUCCESS); 
          count++; 
        }, 750);
        successTransitionEndTimeoutRef.current = setTimeout(() => { 
          if (successTransitionIntervalRef.current) clearInterval(successTransitionIntervalRef.current); 
          if (isPartnerConnected) changeFavicon(FAVICON_SUCCESS); 
        }, 3000);
        updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_SEARCHING_PARTNER.toLowerCase());
        updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_PARTNER_DISCONNECTED.toLowerCase());
        updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_STOPPED_SEARCHING.toLowerCase());
        updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_YOU_DISCONNECTED.toLowerCase());
        updatedMessages = addSystemMessageIfNotPresentIn(updatedMessages, SYS_MSG_CONNECTED_PARTNER, 'connect');
        if (interests.length > 0 && partnerInterests.length > 0) {
          const common = interests.filter(i => partnerInterests.includes(i));
          if (common.length > 0) {
            updatedMessages = addSystemMessageIfNotPresentIn(updatedMessages, `${SYS_MSG_COMMON_INTERESTS_PREFIX}${common.join(', ')}.`, 'common');
          }
        }
      } else if (!successTransitionIntervalRef.current && !successTransitionEndTimeoutRef.current) {
        changeFavicon(FAVICON_SUCCESS);
      }
    } else { 
      changeFavicon(FAVICON_IDLE);
      if (prevIsFindingPartnerRef.current && !isFindingPartner && !isPartnerConnected && !connectionError && !isPartnerLeftRecently && !isSelfDisconnectedRecently) {
        if (updatedMessages.some(msg => msg.sender === 'system' && msg.text.toLowerCase().includes(SYS_MSG_SEARCHING_PARTNER.toLowerCase()))) {
          updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_SEARCHING_PARTNER.toLowerCase());
          updatedMessages = addSystemMessageIfNotPresentIn(updatedMessages, SYS_MSG_STOPPED_SEARCHING, 'stopsearch');
        }
      }
    }

    if (updatedMessages.length !== messages.length || !updatedMessages.every((v, i) => v.id === messages[i]?.id && v.text === messages[i]?.text)) {
      setMessages(updatedMessages);
    }

    prevIsFindingPartnerRef.current = isFindingPartner;
    prevIsPartnerConnectedRef.current = isPartnerConnected;
    prevIsSelfDisconnectedRecentlyRef.current = isSelfDisconnectedRecently;
    prevIsPartnerLeftRecentlyRef.current = isPartnerLeftRecently;
  }, [isPartnerConnected, isFindingPartner, connectionError, isSelfDisconnectedRecently, isPartnerLeftRecently, partnerInterests, interests, messages, setMessages]);

  // Handle find/disconnect partner
  const handleFindOrDisconnect = useCallback(() => {
    if (isProcessingFindOrDisconnect.current) {
      console.log(`${LOG_PREFIX}: Find/disconnect action already in progress.`);
      return;
    }

    if (!isConnected) {
      toast({ 
        title: "Not Connected", 
        description: "Chat server connection not yet established.", 
        variant: "destructive" 
      });
      return;
    }

    isProcessingFindOrDisconnect.current = true;

    if (isPartnerConnected) {
      // Disconnect from current partner
      console.log(`${LOG_PREFIX}: User is skipping partner`);
      addSystemMessage(SYS_MSG_YOU_DISCONNECTED);
      
      setIsPartnerConnected(false);
      setPartnerInfo(null);
      setIsPartnerTyping(false);
      setPartnerInterests([]);

      emitLeaveChat();

      // Start searching again
      console.log(`${LOG_PREFIX}: Re-emitting findPartner after skip`);
      setIsFindingPartner(true);
      setIsSelfDisconnectedRecently(true);
      setIsPartnerLeftRecently(false);

      emitFindPartner({
        chatType: 'text',
        interests,
        authId
      });
    } else if (isFindingPartner) {
      // Stop searching
      console.log(`${LOG_PREFIX}: User stopping partner search`);
      setIsFindingPartner(false);
      setIsSelfDisconnectedRecently(false);
      setIsPartnerLeftRecently(false);
    } else {
      // Start searching
      console.log(`${LOG_PREFIX}: User starting partner search via button`);
      setIsFindingPartner(true);
      setIsSelfDisconnectedRecently(false);
      setIsPartnerLeftRecently(false);
      addSystemMessage(SYS_MSG_SEARCHING_PARTNER);
      
      emitFindPartner({
        chatType: 'text',
        interests,
        authId
      });
    }
    
    setTimeout(() => {
      isProcessingFindOrDisconnect.current = false;
    }, 200);
  }, [isPartnerConnected, isFindingPartner, isConnected, emitLeaveChat, emitFindPartner, addSystemMessage, interests, authId, toast, setIsPartnerConnected, setPartnerInfo, setIsPartnerTyping, setPartnerInterests, setIsFindingPartner]);

  // Handle send message
  const handleSendMessage = useCallback((message: string) => {
    if (!isPartnerConnected) return;

    console.log(`${LOG_PREFIX}: Sending message:`, message);
    
    // Add to local messages immediately
    addMessage({
      text: message,
      sender: 'me'
    });

    // Send to server
    emitMessage({
      roomId: '', // Server will use the current room
      message: message,
      username,
      authId
    });

    emitTypingStop();
  }, [isPartnerConnected, addMessage, emitMessage, username, authId, emitTypingStop]);

  // Handle input change with typing indicators
  const handleInputChange = useCallback((value: string) => {
    setCurrentMessage(value);
    
    if (value.trim() && isPartnerConnected) {
      emitTypingStart();
    } else {
      emitTypingStop();
    }
  }, [setCurrentMessage, isPartnerConnected, emitTypingStart, emitTypingStop]);

  // Handle profile card functionality
  const handleUsernameClick = useCallback((authId: string, clickPosition: { x: number; y: number }) => {
    if (authId && authId !== 'anonymous') {
      setProfileCardUserId(authId);
      setProfileCardPosition(clickPosition);
      setIsProfileCardOpen(true);
      setIsScrollEnabled(false);
    }
  }, []);

  const handleProfileCardClose = useCallback(() => {
    setIsProfileCardOpen(false);
    setProfileCardUserId(null);
    setProfileCardPosition(null);
    setIsScrollEnabled(true);
  }, []);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (successTransitionIntervalRef.current) clearInterval(successTransitionIntervalRef.current);
      if (successTransitionEndTimeoutRef.current) clearTimeout(successTransitionEndTimeoutRef.current);
      if (skippedFaviconTimeoutRef.current) clearTimeout(skippedFaviconTimeoutRef.current);
      changeFavicon(FAVICON_DEFAULT, true);
    };
  }, []);

  useEffect(() => { setIsMounted(true); }, []);

  if (!isMounted || isAuthLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading chat...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Inject display name animation CSS */}
      <style dangerouslySetInnerHTML={{ __html: displayNameAnimationCSS }} />
      
      {/* TopBar in page header - top right corner */}
      <div className="fixed top-0 right-0 z-50">
        <TopBar />
      </div>
      
      {/* Hide HomeButton on mobile to save space */}
      {!isMobile && <HomeButton />}
      
      <div className={cn(
        "flex flex-col items-center justify-center",
        isMobile ? "h-screen w-screen p-0" : "h-full p-4"
      )}>
        <div className={cn(
          'window flex flex-col relative',
          // Add biscuit frame when pink theme is active
          pinkThemeActive && 'biscuit-frame',
          // Windows 98 theme - no special glass effects since we're not using theme-7
          isMobile ? 'h-full w-full' : ''
        )} style={chatWindowStyle}>
          
          {/* No goldfish image since we're always theme-98 */}
          
          {/* Header - Windows 98 styling with TopBar */}
          <div className={cn(
            "title-bar",
            isMobile && "text-sm h-8 min-h-8"
          )}>
            <div className="flex items-center justify-between w-full">
              <div className="title-bar-text">
                {isMobile ? 'TinChat' : 'Text Chat'}
              </div>
              
              <div className="flex items-center space-x-2">
                {/* TopBar for theme customization - hide on mobile to save space */}
                {!isMobile && (
                  <div className="scale-75 origin-right">
                 
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chat Window */}
          <div className="flex-1 flex flex-col">
            <ChatWindow
              messages={messages.map(msg => ({
                id: msg.id,
                content: msg.text,
                sender: msg.sender === 'me' ? 'self' : msg.sender,
                timestamp: msg.timestamp?.getTime(),
                senderUsername: msg.senderUsername,
                senderAuthId: msg.senderAuthId,
                senderDisplayNameColor: msg.senderDisplayNameColor,
                senderDisplayNameAnimation: msg.senderDisplayNameAnimation,
                senderRainbowSpeed: msg.senderRainbowSpeed
              }))}
              onSendMessage={handleSendMessage}
              inputValue={currentMessage}
              onInputChange={handleInputChange}
              isPartnerTyping={isPartnerTyping}
              partnerStatus={partnerInfo?.status || 'offline'}
              partnerInfo={partnerInfo ? {
                username: partnerInfo.username,
                displayName: partnerInfo.displayName,
                avatar: partnerInfo.avatarUrl || '/default-avatar.png',
                displayNameColor: partnerInfo.displayNameColor,
                displayNameAnimation: partnerInfo.displayNameAnimation,
                rainbowSpeed: partnerInfo.rainbowSpeed,
                authId: partnerInfo.authId
              } : undefined}
              ownInfo={{
                username: ownDisplayUsername,
                authId: authId,
                displayNameColor: ownDisplayNameColor,
                displayNameAnimation: ownDisplayNameAnimation
              }}
              isConnected={isConnected}
              isPartnerConnected={isPartnerConnected}
              theme={effectivePageTheme}
              onUsernameClick={handleUsernameClick}
              isMobile={isMobile}
              isScrollEnabled={isScrollEnabled}
              onFindOrDisconnect={handleFindOrDisconnect}
              findOrDisconnectDisabled={!isConnected || !!connectionError}
              findOrDisconnectText={
                isPartnerConnected 
                  ? (isMobile ? 'Skip' : 'Skip') 
                  : isFindingPartner 
                    ? (isMobile ? 'Stop' : 'Stop') 
                    : (isMobile ? 'Find' : 'Find')
              }
            />
          </div>

          {/* Connection status */}
          {connectionError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 text-sm">
              Connection Error: {connectionError}
            </div>
          )}
        </div>
      </div>

      {/* Profile Card Modal */}
      {profileCardUserId && (
        <ProfileCard
          userId={profileCardUserId}
          isOpen={isProfileCardOpen}
          onClose={handleProfileCardClose}
          onScrollToggle={setIsScrollEnabled}
          clickPosition={profileCardPosition}
        />
      )}
    </>
  );
};

export default ChatPageClientContent;