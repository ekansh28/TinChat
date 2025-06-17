// src/app/chat/hooks/useChat.ts - CONSOLIDATED HOOK SOLUTION
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { useChatSocket } from './useChatSocket';
import { useChatState } from './useChatState';
import { useAuth } from './useAuth';
import { useThemeDetection } from './useThemeDetection';
import { useViewport } from './useViewport';
import { useFaviconManager } from './useFaviconManager';
import { useSystemMessages } from './useSystemMessages';
import { useChatActions } from './useChatActions';
import { playSound } from '@/lib/utils';

interface UseChatReturn {
  // State
  isMounted: boolean;
  isScrollEnabled: boolean;
  isSelfDisconnectedRecently: boolean;
  isPartnerLeftRecently: boolean;
  partnerInterests: string[];
  interests: string[];
  
  // Computed values
  pinkThemeActive: boolean;
  effectivePageTheme: string;
  isMobile: boolean;
  chatWindowStyle: React.CSSProperties;
  
  // Chat state
  chatState: ReturnType<typeof useChatState>;
  auth: ReturnType<typeof useAuth>;
  socket: ReturnType<typeof useChatSocket>;
  
  // Actions
  chatActions: ReturnType<typeof useChatActions>;
  handleUsernameClick: (authId: string, clickPosition: { x: number; y: number }) => void;
  
  // Data
  mappedMessages: any[];
  memoizedPartnerInfo: any;
  memoizedOwnInfo: any;
  
  // Loading states
  isLoading: boolean;
  hasConnectionError: boolean;
}

export const useChat = (): UseChatReturn => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  // ✅ FIXED: All hooks called unconditionally in same order every time
  const [isMounted, setIsMounted] = useState(false);
  const [isSelfDisconnectedRecently, setIsSelfDisconnectedRecently] = useState(false);
  const [isPartnerLeftRecently, setIsPartnerLeftRecently] = useState(false);
  const [partnerInterests, setPartnerInterests] = useState<string[]>([]);
  const [isScrollEnabled] = useState(true);
  
  // ✅ FIXED: Initialization tracking with single ref
  const initRef = useRef({
    isInitialized: false,
    autoSearchStarted: false,
    socketInitialized: false
  });

  // ✅ FIXED: Stable interests memoization
  const interests = useMemo(() => {
    const interestsParam = searchParams.get('interests');
    if (!interestsParam) return [];
    return interestsParam.split(',').filter(i => i.trim() !== '');
  }, [searchParams]);

  // ✅ FIXED: All modular hooks called unconditionally
  const auth = useAuth();
  const { pinkThemeActive, effectivePageTheme } = useThemeDetection(isMounted);
  const { isMobile, chatWindowStyle } = useViewport();
  const chatState = useChatState();

  // ✅ FIXED: Stable socket handlers with consistent order
  const socketHandlers = useMemo(() => ({
    onMessage: (data: any) => {
      console.log('[Chat] Handling message:', data);
      
      if (data.senderAuthId && (data.senderDisplayNameColor || data.senderDisplayNameAnimation)) {
        chatState.setPartnerInfo(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            displayNameColor: data.senderDisplayNameColor || prev.displayNameColor,
            displayNameAnimation: data.senderDisplayNameAnimation || prev.displayNameAnimation,
            rainbowSpeed: data.senderRainbowSpeed || prev.rainbowSpeed
          };
        });
      }
      
      chatState.addMessage({
        text: data.message,
        sender: 'partner',
        senderUsername: data.senderUsername,
        senderAuthId: data.senderAuthId,
        senderDisplayNameColor: data.senderDisplayNameColor,
        senderDisplayNameAnimation: data.senderDisplayNameAnimation,
        senderRainbowSpeed: data.senderRainbowSpeed
      });
      
      chatState.setIsPartnerTyping(false);
    },

    onPartnerFound: (data: any) => {
      console.log('[Chat] Partner found:', data);
      
      try {
        playSound('Match.wav');
      } catch (error) {
        console.warn('[Chat] Failed to play sound:', error);
      }
      
      chatState.setPartnerInfo({
        id: data.partnerId,
        username: data.partnerUsername || 'Stranger',
        displayName: data.partnerDisplayName,
        avatarUrl: data.partnerAvatarUrl,
        bannerUrl: data.partnerBannerUrl,
        pronouns: data.partnerPronouns,
        status: data.partnerStatus || 'online',
        displayNameColor: data.partnerDisplayNameColor || '#667eea',
        displayNameAnimation: data.partnerDisplayNameAnimation || 'none',
        rainbowSpeed: data.partnerRainbowSpeed || 3,
        authId: data.partnerAuthId,
        badges: data.partnerBadges || []
      });
      
      setPartnerInterests(data.interests || []);
      chatState.setIsFindingPartner(false);
      chatState.setIsPartnerConnected(true);
      setIsSelfDisconnectedRecently(false);
      setIsPartnerLeftRecently(false);
      chatState.setMessages([]);
    },

    onPartnerLeft: () => {
      console.log('[Chat] Partner left');
      chatState.setIsPartnerConnected(false);
      chatState.setIsFindingPartner(false);
      chatState.setPartnerInfo(null);
      chatState.setIsPartnerTyping(false);
      setPartnerInterests([]);
      setIsPartnerLeftRecently(true);
      setIsSelfDisconnectedRecently(false);
    },

    onStatusChange: (status: string) => {
      chatState.setPartnerInfo(prev => 
        prev ? {...prev, status: status as any} : null
      );
    },

    onTypingStart: () => chatState.setIsPartnerTyping(true),
    onTypingStop: () => chatState.setIsPartnerTyping(false),
    onWaiting: () => console.log('[Chat] Waiting for partner'),
    onCooldown: () => {
      console.log('[Chat] Find partner cooldown');
      chatState.setIsFindingPartner(false);
    },
    onDisconnectHandler: () => {
      console.log('[Chat] Socket disconnected');
      chatState.setIsPartnerConnected(false);
      chatState.setIsFindingPartner(false);
      chatState.setIsPartnerTyping(false);
      chatState.setPartnerInfo(null);
    },
    onConnectErrorHandler: () => {
      console.log('[Chat] Socket connection error');
      chatState.setIsFindingPartner(false);
    }
  }), []); // ✅ Empty deps - handlers use current state via closure

  // ✅ FIXED: Socket hook called unconditionally
  const socket = useChatSocket({
    ...socketHandlers,
    authId: auth.authId
  });

  // ✅ FIXED: Favicon manager hook called unconditionally
  useFaviconManager({
    isPartnerConnected: chatState.isPartnerConnected,
    isFindingPartner: chatState.isFindingPartner,
    connectionError: socket.connectionError,
    isSelfDisconnectedRecently,
    isPartnerLeftRecently
  });

  // ✅ FIXED: System messages hook called unconditionally
  useSystemMessages({
    isPartnerConnected: chatState.isPartnerConnected,
    isFindingPartner: chatState.isFindingPartner,
    connectionError: socket.connectionError,
    isSelfDisconnectedRecently,
    isPartnerLeftRecently,
    partnerInterests,
    interests,
    messages: chatState.messages,
    setMessages: chatState.setMessages
  });

  // ✅ FIXED: Chat actions hook called unconditionally
  const chatActions = useChatActions({
    isConnected: socket.isConnected,
    isPartnerConnected: chatState.isPartnerConnected,
    isFindingPartner: chatState.isFindingPartner,
    setIsFindingPartner: chatState.setIsFindingPartner,
    setIsPartnerConnected: chatState.setIsPartnerConnected,
    setPartnerInfo: chatState.setPartnerInfo,
    setIsPartnerTyping: chatState.setIsPartnerTyping,
    setPartnerInterests,
    setIsSelfDisconnectedRecently,
    setIsPartnerLeftRecently,
    addMessage: chatState.addMessage,
    addSystemMessage: chatState.addSystemMessage,
    emitLeaveChat: socket.emitLeaveChat,
    emitFindPartner: socket.emitFindPartner,
    emitMessage: socket.emitMessage,
    emitTypingStart: socket.emitTypingStart,
    emitTypingStop: socket.emitTypingStop,
    setCurrentMessage: chatState.setCurrentMessage,
    interests,
    authId: auth.authId,
    username: auth.username
  });

  // ✅ FIXED: Auto-search effect with stable dependencies
  useEffect(() => {
    if (initRef.current.autoSearchStarted) {
      console.log('[Chat] Auto-search already started, skipping');
      return;
    }

    const shouldStartSearch = 
      socket.isConnected && 
      !auth.isLoading && 
      !chatState.isPartnerConnected && 
      !chatState.isFindingPartner &&
      auth.authId !== undefined &&
      !socket.connectionError &&
      !socket.isConnecting;

    if (!shouldStartSearch) {
      console.log('[Chat] Auto-search conditions not met');
      return;
    }

    console.log('[Chat] Starting auto-search for partner');
    initRef.current.autoSearchStarted = true;
    
    chatState.setIsFindingPartner(true);
    chatState.addSystemMessage('Searching for a partner...');
    setIsSelfDisconnectedRecently(false);
    setIsPartnerLeftRecently(false);
    
    const timeoutId = setTimeout(() => {
      const success = socket.emitFindPartner({
        chatType: 'text',
        interests,
        authId: auth.authId
      });
      
      if (!success) {
        console.error('[Chat] Failed to emit findPartner');
        chatState.setIsFindingPartner(false);
        chatState.addSystemMessage('Failed to start partner search. Please try again.');
        initRef.current.autoSearchStarted = false;
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [
    socket.isConnected,
    socket.connectionError,
    socket.isConnecting,
    auth.isLoading,
    auth.authId,
    chatState.isPartnerConnected,
    chatState.isFindingPartner,
    interests
  ]);

  // ✅ FIXED: Reset auto-search flag effect
  useEffect(() => {
    if (chatState.isPartnerConnected || !socket.isConnected || socket.connectionError) {
      if (initRef.current.autoSearchStarted) {
        console.log('[Chat] Resetting auto-search flag');
        initRef.current.autoSearchStarted = false;
      }
    }
  }, [chatState.isPartnerConnected, socket.isConnected, socket.connectionError]);

  // ✅ FIXED: Navigation cleanup effect
  useEffect(() => {
    if (pathname === '/chat') {
      console.log('[Chat] Route change cleanup');
      chatState.resetChatState();
      setIsSelfDisconnectedRecently(false);
      setIsPartnerLeftRecently(false);
      setPartnerInterests([]);
      initRef.current.autoSearchStarted = false;
    }
  }, [pathname]);

  // ✅ FIXED: Mount effect
  useEffect(() => { 
    console.log('[Chat] Component mounted');
    setIsMounted(true);
    initRef.current.isInitialized = true;
    
    return () => {
      console.log('[Chat] Component unmounting');
      initRef.current.isInitialized = false;
    };
  }, []);

  // ✅ FIXED: Username click handler
  const handleUsernameClick = useCallback((authId: string, clickPosition: { x: number; y: number }) => {
    console.log('[Chat] Username clicked:', authId, clickPosition);
  }, []);

  // ✅ FIXED: Memoized computations (always called, consistent order)
  const mappedMessages = useMemo(() => {
    return chatState.messages.map(msg => ({
      id: msg.id,
      content: msg.text,
      sender: msg.sender === 'me' ? 'self' : msg.sender,
      timestamp: msg.timestamp?.getTime(),
      senderUsername: msg.senderUsername,
      senderAuthId: msg.senderAuthId,
      senderDisplayNameColor: msg.senderDisplayNameColor,
      senderDisplayNameAnimation: msg.senderDisplayNameAnimation,
      senderRainbowSpeed: msg.senderRainbowSpeed
    }));
  }, [chatState.messages]);

  const memoizedPartnerInfo = useMemo(() => {
    if (!chatState.partnerInfo) return undefined;
    
    return {
      username: chatState.partnerInfo.username,
      displayName: chatState.partnerInfo.displayName,
      avatar: chatState.partnerInfo.avatarUrl || '/default-avatar.png',
      displayNameColor: chatState.partnerInfo.displayNameColor,
      displayNameAnimation: chatState.partnerInfo.displayNameAnimation,
      rainbowSpeed: chatState.partnerInfo.rainbowSpeed,
      authId: chatState.partnerInfo.authId
    };
  }, [chatState.partnerInfo]);

  const memoizedOwnInfo = useMemo(() => ({
    username: auth.username || "You",
    authId: auth.authId,
    displayNameColor: auth.displayNameColor,
    displayNameAnimation: auth.displayNameAnimation
  }), [auth.username, auth.authId, auth.displayNameColor, auth.displayNameAnimation]);

  // ✅ FIXED: Loading and error states
  const isLoading = !isMounted || auth.isLoading;
  const hasConnectionError = !!socket.connectionError && !socket.isConnected && !socket.isConnecting;

  return {
    // State
    isMounted,
    isScrollEnabled,
    isSelfDisconnectedRecently,
    isPartnerLeftRecently,
    partnerInterests,
    interests,
    
    // Computed values
    pinkThemeActive,
    effectivePageTheme,
    isMobile,
    chatWindowStyle,
    
    // Chat state
    chatState,
    auth,
    socket,
    
    // Actions
    chatActions,
    handleUsernameClick,
    
    // Data
    mappedMessages,
    memoizedPartnerInfo,
    memoizedOwnInfo,
    
    // Loading states
    isLoading,
    hasConnectionError
  };
};