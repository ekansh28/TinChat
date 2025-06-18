// src/app/video-chat/hooks/useVideoChat.ts - IMMEDIATE FIX FOR DEV MODE
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { useChatState } from '../../chat/hooks/useChatState';
import { useAuth } from '../../chat/hooks/useAuth';
import { useThemeDetection } from '../../chat/hooks/useThemeDetection';
import { useViewport } from '../../chat/hooks/useViewport';
import { useFaviconManager } from '../../chat/hooks/useFaviconManager';
import { useSystemMessages } from '../../chat/hooks/useSystemMessages';
import { useWebRTC } from './useWebRTC';
import { useVideoChatSocket } from './useVideoChatSocket';
import { useVideoChatActions } from './useVideoChatActions';
import { playSound } from '@/lib/utils';

export const useVideoChat = () => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  // ✅ CRITICAL FIX: Stable state initialization to prevent React.StrictMode issues
  const [isMounted, setIsMounted] = useState(false);
  const [isSelfDisconnectedRecently, setIsSelfDisconnectedRecently] = useState(false);
  const [isPartnerLeftRecently, setIsPartnerLeftRecently] = useState(false);
  const [partnerInterests, setPartnerInterests] = useState<string[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  
  // ✅ CRITICAL: Development mode protection - prevent multiple initializations
  const devModeRef = useRef({
    isInitialized: false,
    mountCount: 0,
    lastMountTime: 0,
    sessionId: `dev-session-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
    autoSearchStarted: false,
    searchAttemptCount: 0,
    lastSearchTime: 0,
    stabilityTimer: null as NodeJS.Timeout | null
  });

  // ✅ CRITICAL: Stable interests memoization to prevent dependency loops
  const interests = useMemo(() => {
    const interestsParam = searchParams.get('interests');
    if (!interestsParam) return [];
    return interestsParam.split(',').filter(i => i.trim() !== '');
  }, [searchParams]);

  // ✅ All hooks called unconditionally but with stability protection
  const auth = useAuth();
  const { pinkThemeActive, effectivePageTheme } = useThemeDetection(isMounted);
  const { isMobile, chatWindowStyle } = useViewport();
  const chatState = useChatState();
  const webrtc = useWebRTC();

  // ✅ CRITICAL: Development mode stability check
  useEffect(() => {
    const now = Date.now();
    devModeRef.current.mountCount++;
    
    // Detect rapid remounting (development mode issue)
    if (now - devModeRef.current.lastMountTime < 1000) {
      console.warn(`[VideoChat] RAPID REMOUNT DETECTED: ${devModeRef.current.mountCount} mounts in development mode`);
      
      // Clear any existing stability timer
      if (devModeRef.current.stabilityTimer) {
        clearTimeout(devModeRef.current.stabilityTimer);
      }
      
      // Set a stability timer to prevent actions until remounting stops
      devModeRef.current.stabilityTimer = setTimeout(() => {
        console.log(`[VideoChat] Stability period ended, allowing normal operation`);
        devModeRef.current.isInitialized = false; // Allow re-initialization
      }, 2000);
      
      devModeRef.current.lastMountTime = now;
      return;
    }
    
    devModeRef.current.lastMountTime = now;
    setIsMounted(true);
    
    return () => {
      // Clear stability timer on unmount
      if (devModeRef.current.stabilityTimer) {
        clearTimeout(devModeRef.current.stabilityTimer);
        devModeRef.current.stabilityTimer = null;
      }
    };
  }, []);

  // ✅ ENHANCED: Socket event handlers with development mode protection
  const socketHandlers = useMemo(() => ({
    onMessage: (data: any) => {
      console.log('[VideoChat] Handling message:', data);
      
      // Prevent processing messages from self
      if (data.senderAuthId && auth.authId && data.senderAuthId === auth.authId) {
        console.warn('[VideoChat] Ignoring message from self:', data.senderAuthId);
        return;
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

    onPartnerFound: async (data: any) => {
      console.log('[VideoChat] Partner found:', data);
      
      // ✅ CRITICAL: Enhanced self-match detection
      if (!data || !data.partnerId || !data.roomId) {
        console.error('[VideoChat] Invalid partner data:', data);
        return;
      }
      
      // Multiple layers of self-match prevention
      const socketId = socketResult?.socket?.id;
      
      if (data.partnerId === socketId) {
        console.error('[VideoChat] CRITICAL: Self-match detected by socket ID!');
        chatState.addSystemMessage('Matching error detected. Please refresh the page.');
        return;
      }
      
      if (data.partnerAuthId && auth.authId && data.partnerAuthId === auth.authId) {
        console.error('[VideoChat] CRITICAL: Self-match detected by auth ID!');
        chatState.addSystemMessage('Cannot match with yourself. Please refresh the page.');
        return;
      }
      
      try {
        playSound('Match.wav');
      } catch (error) {
        console.warn('[VideoChat] Failed to play sound:', error);
      }
      
      // Set partner info
      chatState.setPartnerInfo({
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
      setRoomId(data.roomId);
      chatState.setIsFindingPartner(false);
      chatState.setIsPartnerConnected(true);
      setIsSelfDisconnectedRecently(false);
      setIsPartnerLeftRecently(false);
      chatState.setMessages([]);

      // Setup WebRTC connection
      if (webrtc.localStream && isMounted && data.roomId) {
        console.log('[VideoChat] Setting up WebRTC for room:', data.roomId);
        try {
          await webrtc.setupPeerConnection(data.roomId, true);
        } catch (error) {
          console.error('[VideoChat] Failed to setup WebRTC:', error);
          chatState.addSystemMessage('Video connection failed. Audio chat still available.');
        }
      }
    },

    onPartnerLeft: () => {
      console.log('[VideoChat] Partner left');
      chatState.setIsPartnerConnected(false);
      chatState.setIsFindingPartner(false);
      chatState.setPartnerInfo(null);
      chatState.setIsPartnerTyping(false);
      setPartnerInterests([]);
      setIsPartnerLeftRecently(true);
      setIsSelfDisconnectedRecently(false);
      setRoomId(null);
      webrtc.cleanupConnections(false);
    },

    onWebRTCSignal: async (signalData: any) => {
      if (!signalData) return;
      try {
        await webrtc.handleWebRTCSignal(signalData);
      } catch (error) {
        console.error('[VideoChat] Failed to handle WebRTC signal:', error);
      }
    },

    onStatusChange: (status: string) => {
      chatState.setPartnerInfo(prev => 
        prev ? {...prev, status: status as any} : null
      );
    },

    onTypingStart: () => chatState.setIsPartnerTyping(true),
    onTypingStop: () => chatState.setIsPartnerTyping(false),
    onWaiting: () => console.log('[VideoChat] Waiting for partner'),
    onCooldown: () => {
      console.log('[VideoChat] Find partner cooldown');
      chatState.setIsFindingPartner(false);
    },
    onDisconnectHandler: () => {
      console.log('[VideoChat] Socket disconnected');
      chatState.setIsPartnerConnected(false);
      chatState.setIsFindingPartner(false);
      chatState.setIsPartnerTyping(false);
      chatState.setPartnerInfo(null);
      setRoomId(null);
      webrtc.cleanupConnections(false);
      
      // Reset initialization flags on disconnect
      devModeRef.current.autoSearchStarted = false;
      devModeRef.current.isInitialized = false;
    },
    onConnectErrorHandler: () => {
      console.log('[VideoChat] Socket connection error');
      chatState.setIsFindingPartner(false);
      devModeRef.current.autoSearchStarted = false;
    }
  }), [chatState, webrtc, isMounted, auth.authId]);

  // ✅ Socket hook
  const socketResult = useVideoChatSocket({
    ...socketHandlers,
    authId: auth.authId,
    roomId
  });

  // ✅ Other hooks
  useFaviconManager({
    isPartnerConnected: chatState.isPartnerConnected,
    isFindingPartner: chatState.isFindingPartner,
    connectionError: socketResult.connectionError,
    isSelfDisconnectedRecently,
    isPartnerLeftRecently
  });

  useSystemMessages({
    isPartnerConnected: chatState.isPartnerConnected,
    isFindingPartner: chatState.isFindingPartner,
    connectionError: socketResult.connectionError,
    isSelfDisconnectedRecently,
    isPartnerLeftRecently,
    partnerInterests,
    interests,
    messages: chatState.messages,
    setMessages: chatState.setMessages
  });

  const chatActions = useVideoChatActions({
    isConnected: socketResult.isConnected,
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
    emitLeaveChat: socketResult.emitLeaveChat,
    emitFindPartner: socketResult.emitFindPartner,
    emitMessage: socketResult.emitMessage,
    emitTypingStart: socketResult.emitTypingStart,
    emitTypingStop: socketResult.emitTypingStop,
    setCurrentMessage: chatState.setCurrentMessage,
    interests,
    authId: auth.authId,
    username: auth.username,
    hasCameraPermission: webrtc.hasCameraPermission,
    initializeCamera: webrtc.initializeCamera,
    cleanupConnections: webrtc.cleanupConnections,
    setupPeerConnection: (roomId: string) => webrtc.setupPeerConnection(roomId, true)
  });

  // ✅ CRITICAL: Development-mode-safe auto-search with stability protection
  useEffect(() => {
    // ✅ CRITICAL: Skip auto-search during development mode instability
    if (devModeRef.current.stabilityTimer) {
      console.log('[VideoChat] Skipping auto-search during stability period');
      return;
    }

    console.log('[VideoChat] Auto-search effect triggered:', {
      autoSearchStarted: devModeRef.current.autoSearchStarted,
      searchAttemptCount: devModeRef.current.searchAttemptCount,
      isInitialized: devModeRef.current.isInitialized,
      mountCount: devModeRef.current.mountCount,
      isConnected: socketResult.isConnected,
      authLoading: auth.isLoading,
      authId: auth.authId,
      isPartnerConnected: chatState.isPartnerConnected,
      isFindingPartner: chatState.isFindingPartner,
      hasCameraPermission: webrtc.hasCameraPermission,
      hasLocalStream: !!webrtc.localStream
    });

    // Prevent multiple initialization in development mode
    if (devModeRef.current.isInitialized) {
      console.log('[VideoChat] Already initialized, skipping auto-search');
      return;
    }

    // Prevent auto-search if already started
    if (devModeRef.current.autoSearchStarted) {
      console.log('[VideoChat] Auto-search already started, skipping');
      return;
    }

    // Rate limiting to prevent rapid searches
    const now = Date.now();
    if (now - devModeRef.current.lastSearchTime < 10000) { // 10 second cooldown
      console.log('[VideoChat] Auto-search rate limited');
      return;
    }

    // Prevent too many search attempts
    if (devModeRef.current.searchAttemptCount >= 2) {
      console.log('[VideoChat] Max search attempts reached, manual action required');
      chatState.addSystemMessage('Please click "Find" to start video chat.');
      return;
    }

    // Enhanced readiness checks
    const isSocketReady = socketResult.isConnected && !socketResult.connectionError;
    const isAuthReady = !auth.isLoading && auth.authId !== undefined;
    const isChatReady = !chatState.isPartnerConnected && !chatState.isFindingPartner;
    const isCameraReady = webrtc.hasCameraPermission === true && !!webrtc.localStream;

    if (!isSocketReady || !isAuthReady || !isChatReady || !isCameraReady) {
      console.log('[VideoChat] Auto-search conditions not met - waiting...', {
        isSocketReady,
        isAuthReady,
        isChatReady,
        isCameraReady
      });
      return;
    }

    // ✅ CRITICAL: Mark as initialized before starting to prevent re-entry
    devModeRef.current.isInitialized = true;
    devModeRef.current.autoSearchStarted = true;
    devModeRef.current.lastSearchTime = now;
    devModeRef.current.searchAttemptCount++;

    console.log('[VideoChat] ✅ Starting video chat initialization');

    const startVideoChat = async () => {
      try {
        chatState.setIsFindingPartner(true);
        chatState.addSystemMessage('Searching for a video chat partner...');
        setIsSelfDisconnectedRecently(false);
        setIsPartnerLeftRecently(false);
        
        const success = socketResult.emitFindPartner({
          chatType: 'video',
          interests,
          authId: auth.authId,
          sessionId: devModeRef.current.sessionId,
          timestamp: now
        });
        
        if (!success) {
          throw new Error('Failed to emit findPartner');
        }
        
        console.log('[VideoChat] ✅ Video chat search started successfully');
        
      } catch (error) {
        console.error('[VideoChat] Failed to start video chat:', error);
        chatState.setIsFindingPartner(false);
        chatState.addSystemMessage('Failed to start video chat. Please try again.');
        
        // Reset flags on error
        devModeRef.current.autoSearchStarted = false;
        devModeRef.current.isInitialized = false;
        devModeRef.current.searchAttemptCount = Math.max(0, devModeRef.current.searchAttemptCount - 1);
      }
    };

    // Small delay to ensure everything is stable
    const delayedStart = setTimeout(startVideoChat, 3000);
    
    return () => {
      clearTimeout(delayedStart);
    };
  }, [
    socketResult.isConnected,
    socketResult.connectionError,
    auth.isLoading,
    auth.authId,
    chatState.isPartnerConnected,
    chatState.isFindingPartner,
    webrtc.hasCameraPermission,
    webrtc.localStream,
    interests
  ]);

  // ✅ Reset initialization state when conditions change
  useEffect(() => {
    const shouldReset = chatState.isPartnerConnected || 
                       !socketResult.isConnected || 
                       socketResult.connectionError ||
                       webrtc.hasCameraPermission === false;

    if (shouldReset && devModeRef.current.autoSearchStarted) {
      console.log('[VideoChat] Resetting auto-search state due to condition change');
      devModeRef.current.autoSearchStarted = false;
      devModeRef.current.isInitialized = false;
    }

    // Reset search attempt count on successful connection
    if (chatState.isPartnerConnected) {
      devModeRef.current.searchAttemptCount = 0;
    }
  }, [chatState.isPartnerConnected, socketResult.isConnected, socketResult.connectionError, webrtc.hasCameraPermission]);
  
  // ✅ Navigation cleanup effect
  useEffect(() => {
    if (pathname === '/video-chat') {
      console.log('[VideoChat] Route change cleanup');
      chatState.resetChatState();
      setIsSelfDisconnectedRecently(false);
      setIsPartnerLeftRecently(false);
      setPartnerInterests([]);
      setRoomId(null);
      
      // Reset all development mode flags
      devModeRef.current.autoSearchStarted = false;
      devModeRef.current.isInitialized = false;
      devModeRef.current.searchAttemptCount = 0;
      devModeRef.current.lastSearchTime = 0;
      devModeRef.current.sessionId = `dev-session-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
    }
  }, [pathname, chatState]);

  // ✅ WebRTC cleanup effect
  useEffect(() => {
    return () => {
      console.log('[VideoChat] Component unmounting');
      webrtc.cleanupConnections(true);
      
      // Clear all timers and reset flags
      if (devModeRef.current.stabilityTimer) {
        clearTimeout(devModeRef.current.stabilityTimer);
        devModeRef.current.stabilityTimer = null;
      }
      devModeRef.current.autoSearchStarted = false;
      devModeRef.current.isInitialized = false;
    };
  }, [webrtc]);

  const handleUsernameClick = useCallback((authId: string, clickPosition: { x: number; y: number }) => {
    console.log('[VideoChat] Username clicked:', authId, clickPosition);
  }, []);

  // ✅ Responsive video layout calculations
  const { videoWindowStyle, chatWindowStyleAdjusted } = useMemo(() => {
    const videoStyle = isMobile ? {
      width: '100vw',
      height: '200px',
      maxWidth: '100vw',
      maxHeight: '200px'
    } : {
      width: '640px',
      height: '240px',
      minHeight: '240px',
      maxHeight: '240px'
    };

    const chatStyle = isMobile ? {
      width: '100vw',
      height: 'calc(100vh - 300px)',
      maxWidth: '100vw'
    } : {
      width: '640px',
      height: '300px',
      minHeight: '300px',
      maxHeight: '300px'
    };

    return {
      videoWindowStyle: videoStyle,
      chatWindowStyleAdjusted: chatStyle
    };
  }, [isMobile]);

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

  // ✅ Loading and error states
  const isLoading = !isMounted || auth.isLoading || webrtc.hasCameraPermission === undefined;
  const hasConnectionError = !!socketResult.connectionError && !socketResult.isConnected;

  return {
    // State
    isMounted,
    isSelfDisconnectedRecently,
    isPartnerLeftRecently,
    partnerInterests,
    interests,
    roomId,
    
    // Computed values
    pinkThemeActive,
    effectivePageTheme,
    isMobile,
    chatWindowStyle,
    videoWindowStyle,
    chatWindowStyleAdjusted,
    
    // Chat state
    chatState,
    auth,
    
    // WebRTC state
    webrtc,
    
    // Socket state
    socket: {
      isConnected: socketResult.isConnected,
      connectionError: socketResult.connectionError,
      emitFindPartner: socketResult.emitFindPartner,
      emitMessage: socketResult.emitMessage,
      emitLeaveChat: socketResult.emitLeaveChat
    },
    
    // Actions
    chatActions,
    handleUsernameClick,
    
    // Data
    mappedMessages,
    memoizedPartnerInfo,
    memoizedOwnInfo,
    
    // Loading states
    isLoading,
    hasConnectionError,
    
    // Debug info for development
    debugInfo: {
      sessionId: devModeRef.current.sessionId,
      searchAttempts: devModeRef.current.searchAttemptCount,
      autoSearchStarted: devModeRef.current.autoSearchStarted,
      isInitialized: devModeRef.current.isInitialized,
      mountCount: devModeRef.current.mountCount,
      hasStabilityTimer: !!devModeRef.current.stabilityTimer
    }
  };
};