// src/app/chat/hooks/useChat.ts - FIXED VERSION WITH MODULAR STRUCTURE
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { useChatState } from './useChatState';
import { useAuth } from './useAuth';
import { useThemeDetection } from './useThemeDetection';
import { useViewport } from './useViewport';
import { useFaviconManager } from './useFaviconManager';
import { useSystemMessages } from './useSystemMessages';
import { useChatSocket } from './useChatSocket';
import { useChatActions } from './useChatActions';
import { useAutoSearch } from './useAutoSearch';
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
  
  // ✅ FIXED: All hooks called unconditionally in consistent order
  const [isMounted, setIsMounted] = useState(false);
  const [isSelfDisconnectedRecently, setIsSelfDisconnectedRecently] = useState(false);
  const [isPartnerLeftRecently, setIsPartnerLeftRecently] = useState(false);
  const [partnerInterests, setPartnerInterests] = useState<string[]>([]);
  const [isScrollEnabled] = useState(true);
  
  // ✅ FIXED: Initialization tracking with single ref
  const initRef = useRef({
    isInitialized: false,
    autoSearchStarted: false,
    sessionId: `session-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`
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

  // ✅ FIXED: Stable socket handlers with memoization
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
  }), [chatState]); // ✅ Only depend on stable chatState

  // ✅ FIXED: Socket hook with stable handlers
  const socket = useChatSocket({
    ...socketHandlers,
    authId: auth.authId
  });

  // ✅ FIXED: Favicon manager hook
  useFaviconManager({
    isPartnerConnected: chatState.isPartnerConnected,
    isFindingPartner: chatState.isFindingPartner,
    connectionError: socket.connectionError,
    isSelfDisconnectedRecently,
    isPartnerLeftRecently
  });

  // ✅ FIXED: System messages hook
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

  // ✅ FIXED: Chat actions hook
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

  // ✅ FIXED: Auto-search hook (extracted to separate module)
  useAutoSearch({
    socket,
    auth,
    chatState,
    interests,
    initRef,
    setIsSelfDisconnectedRecently,
    setIsPartnerLeftRecently
  });
  
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
  }, [pathname, chatState.resetChatState]);

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

  // ✅ FIXED: Memoized computations
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