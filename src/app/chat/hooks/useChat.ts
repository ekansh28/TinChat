// src/app/chat/hooks/useChat.ts - CRITICAL FIX FOR INFINITE LOOPS
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
import { playSound } from '@/lib/utils';

// ✅ CRITICAL FIX: Stable socket handlers to prevent dependency loops
const useStableSocketHandlers = (chatState: any, auth: any) => {
  return useMemo(() => ({
    onMessage: (data: any) => {
      console.log('[Chat] Handling message:', data);
      
      // Prevent processing messages from self
      if (data.senderAuthId && auth.authId && data.senderAuthId === auth.authId) {
        console.warn('[Chat] Ignoring message from self:', data.senderAuthId);
        return;
      }
      
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
      
      chatState.setIsFindingPartner(false);
      chatState.setIsPartnerConnected(true);
      chatState.setMessages([]);
    },

    onPartnerLeft: () => {
      console.log('[Chat] Partner left');
      chatState.setIsPartnerConnected(false);
      chatState.setIsFindingPartner(false);
      chatState.setPartnerInfo(null);
      chatState.setIsPartnerTyping(false);
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
  }), [chatState, auth.authId]); // ✅ Only stable dependencies
};

// ✅ CRITICAL FIX: Lifecycle management with React Strict Mode protection
const useLifecycleManager = () => {
  const lifecycleRef = useRef({
    isInitialized: false,
    isDestroyed: false,
    mountCount: 0,
    lastMountTime: 0,
    sessionId: `session-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
    autoSearchStarted: false,
    searchAttemptCount: 0,
    lastSearchTime: 0,
    stabilityTimer: null as NodeJS.Timeout | null
  });

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const now = Date.now();
    lifecycleRef.current.mountCount++;
    
    console.log(`[Chat] Mount #${lifecycleRef.current.mountCount} at ${now}`);
    
    // ✅ CRITICAL: Detect rapid remounting (React Strict Mode)
    if (now - lifecycleRef.current.lastMountTime < 500) {
      console.warn(`[Chat] Rapid remount detected - applying stability delay`);
      
      if (lifecycleRef.current.stabilityTimer) {
        clearTimeout(lifecycleRef.current.stabilityTimer);
      }
      
      lifecycleRef.current.stabilityTimer = setTimeout(() => {
        if (!lifecycleRef.current.isDestroyed) {
          console.log(`[Chat] Stability achieved, mounting component`);
          setIsMounted(true);
        }
      }, 1000);
      
      lifecycleRef.current.lastMountTime = now;
      return;
    }
    
    lifecycleRef.current.lastMountTime = now;
    lifecycleRef.current.isDestroyed = false;
    setIsMounted(true);
    
    return () => {
      console.log('[Chat] Component unmounting');
      lifecycleRef.current.isDestroyed = true;
      
      if (lifecycleRef.current.stabilityTimer) {
        clearTimeout(lifecycleRef.current.stabilityTimer);
        lifecycleRef.current.stabilityTimer = null;
      }
    };
  }, []); // ✅ CRITICAL: Empty dependency array

  return { lifecycleRef, isMounted };
};

// ✅ CRITICAL FIX: Controlled auto-search with proper state management
const useControlledAutoSearch = ({
  lifecycleRef,
  socket,
  auth,
  chatState,
  interests,
  setIsSelfDisconnectedRecently,
  setIsPartnerLeftRecently
}: any) => {
  const autoSearchInitialized = useRef(false);

  useEffect(() => {
    // Skip if already initialized or component is being destroyed
    if (autoSearchInitialized.current || lifecycleRef.current.isDestroyed) {
      return;
    }

    // Skip during stability period
    if (lifecycleRef.current.stabilityTimer) {
      console.log('[Chat] Skipping auto-search - waiting for stability');
      return;
    }

    console.log('[Chat] Auto-search effect triggered:', {
      isConnected: socket.isConnected,
      authLoading: auth.isLoading,
      authId: auth.authId,
      isPartnerConnected: chatState.isPartnerConnected,
      isFindingPartner: chatState.isFindingPartner,
      connectionError: socket.connectionError
    });

    // Enhanced readiness checks
    const isSocketReady = socket.isConnected && !socket.connectionError && !socket.isConnecting;
    const isAuthReady = !auth.isLoading && auth.authId !== undefined;
    const isChatReady = !chatState.isPartnerConnected && !chatState.isFindingPartner;

    if (!isSocketReady || !isAuthReady || !isChatReady) {
      console.log('[Chat] Auto-search conditions not met');
      return;
    }

    // Rate limiting
    const now = Date.now();
    if (now - lifecycleRef.current.lastSearchTime < 15000) {
      console.log('[Chat] Auto-search rate limited');
      return;
    }

    // Limit search attempts
    if (lifecycleRef.current.searchAttemptCount >= 2) {
      console.log('[Chat] Max search attempts reached');
      chatState.addSystemMessage('Please click "Find" to start chatting.');
      return;
    }

    // ✅ Start controlled auto-search with delay
    const searchTimeout = setTimeout(() => {
      if (!lifecycleRef.current.isDestroyed && !autoSearchInitialized.current) {
        autoSearchInitialized.current = true;
        lifecycleRef.current.lastSearchTime = now;
        lifecycleRef.current.searchAttemptCount++;

        console.log('[Chat] ✅ Starting auto-search for partner');
        
        chatState.setIsFindingPartner(true);
        chatState.addSystemMessage('Searching for a partner...');
        setIsSelfDisconnectedRecently(false);
        setIsPartnerLeftRecently(false);
        
        const success = socket.emitFindPartner({
          chatType: 'text',
          interests,
          authId: auth.authId,
          sessionId: lifecycleRef.current.sessionId,
          timestamp: now
        });
        
        if (!success) {
          console.error('[Chat] Failed to emit findPartner');
          chatState.setIsFindingPartner(false);
          chatState.addSystemMessage('Failed to start partner search. Please try again.');
          autoSearchInitialized.current = false;
        }
      }
    }, 1000); // ✅ 1 second delay prevents race conditions

    return () => clearTimeout(searchTimeout);
  }, [
    // ✅ CRITICAL: Only primitive dependencies
    socket.isConnected,
    socket.connectionError,
    socket.isConnecting,
    auth.isLoading,
    auth.authId,
    chatState.isPartnerConnected,
    chatState.isFindingPartner
  ]);

  // Reset auto-search when conditions change
  useEffect(() => {
    const shouldReset = chatState.isPartnerConnected || 
                       !socket.isConnected || 
                       socket.connectionError ||
                       socket.isConnecting;

    if (shouldReset && autoSearchInitialized.current) {
      console.log('[Chat] Resetting auto-search state');
      autoSearchInitialized.current = false;
    }

    if (chatState.isPartnerConnected) {
      lifecycleRef.current.searchAttemptCount = 0;
    }
  }, [
    chatState.isPartnerConnected, 
    socket.isConnected, 
    socket.connectionError, 
    socket.isConnecting
  ]);
};

export const useChat = () => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  // ✅ CRITICAL: Lifecycle management first
  const { lifecycleRef, isMounted } = useLifecycleManager();
  
  // State management
  const [isSelfDisconnectedRecently, setIsSelfDisconnectedRecently] = useState(false);
  const [isPartnerLeftRecently, setIsPartnerLeftRecently] = useState(false);
  const [partnerInterests, setPartnerInterests] = useState<string[]>([]);
  const [isScrollEnabled] = useState(true);

  // ✅ FIXED: Stable interests memoization
  const interests = useMemo(() => {
    const interestsParam = searchParams.get('interests');
    if (!interestsParam) return [];
    return interestsParam.split(',').filter(i => i.trim() !== '');
  }, [searchParams]);

  // Core hooks - called unconditionally
  const auth = useAuth();
  const { pinkThemeActive, effectivePageTheme } = useThemeDetection(isMounted);
  const { isMobile, chatWindowStyle } = useViewport();
  const chatState = useChatState();

  // ✅ CRITICAL: Stable socket handlers
  const stableHandlers = useStableSocketHandlers(chatState, auth);
  
  const socket = useChatSocket({
    ...stableHandlers,
    authId: auth.authId
  });

  // Other hooks
  useFaviconManager({
    isPartnerConnected: chatState.isPartnerConnected,
    isFindingPartner: chatState.isFindingPartner,
    connectionError: socket.connectionError,
    isSelfDisconnectedRecently,
    isPartnerLeftRecently
  });

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

  // ✅ CRITICAL: Controlled auto-search
  useControlledAutoSearch({
    lifecycleRef,
    socket,
    auth,
    chatState,
    interests,
    setIsSelfDisconnectedRecently,
    setIsPartnerLeftRecently
  });
  
  // Navigation cleanup
  useEffect(() => {
    if (pathname === '/chat') {
      console.log('[Chat] Route change cleanup');
      chatState.resetChatState();
      setIsSelfDisconnectedRecently(false);
      setIsPartnerLeftRecently(false);
      setPartnerInterests([]);
    }
  }, [pathname]);

  const handleUsernameClick = useCallback((authId: string, clickPosition: { x: number; y: number }) => {
    console.log('[Chat] Username clicked:', authId, clickPosition);
  }, []);

  // ✅ Memoized computations
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

  // Loading and error states
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