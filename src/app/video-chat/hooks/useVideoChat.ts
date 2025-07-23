// src/app/video-chat/hooks/useVideoChat.ts - CRITICAL FIX FOR INFINITE LOOPS
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

// ✅ CRITICAL FIX: Extract stable handlers to prevent dependency loops
interface ChatState {
  addMessage: (message: any) => void;
  setIsPartnerTyping: (isTyping: boolean) => void;
  addSystemMessage: (message: string) => void;
  setPartnerInfo: (info: any) => void;
  setIsFindingPartner: (finding: boolean) => void;
  setIsPartnerConnected: (connected: boolean) => void;
  setMessages: (messages: any[]) => void;
}

interface SocketState {
  socket?: {
    id: string;
  };
}

const useStableSocketHandlers = (
  chatState: ChatState, 
  auth: { authId?: string }, 
  webrtc: any,
  socketState: SocketState
) => {
  return useMemo(() => ({
    onMessage: (data: any) => {
      console.log('[VideoChat] Handling message:', data);
      
      if (data.senderAuthId === auth.authId) {
        console.warn('[VideoChat] Ignoring message from self');
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
      
      if (!data?.partnerId || !data?.roomId) {
        console.error('[VideoChat] Invalid partner data:', data);
        return;
      }
      
      // Enhanced self-match detection
      if (data.partnerId === socketState?.socket?.id ||
          (data.partnerAuthId && auth.authId && data.partnerAuthId === auth.authId)) {
        console.error('[VideoChat] Self-match detected!');
        chatState.addSystemMessage('Matching error. Please try again.');
        return;
      }
      
      try {
        playSound('Match.wav');
      } catch (error) {
        console.warn('[VideoChat] Failed to play sound:', error);
      }
      
      chatState.setPartnerInfo({
        id: data.partnerId,
        username: data.partnerUsername || 'Stranger',
        displayName: data.partnerDisplayName,
        avatar_url: data.partnerAvatarUrl,
        status: data.partnerStatus || 'online',
        displayNameColor: data.partnerDisplayNameColor || '#ff0000',
        displayNameAnimation: data.partnerDisplayNameAnimation || 'none',
        rainbowSpeed: data.partnerRainbowSpeed || 3,
        authId: data.partnerAuthId,
        badges: data.partnerBadges || []
      });
      
      chatState.setIsFindingPartner(false);
      chatState.setIsPartnerConnected(true);
      chatState.setMessages([]);

      // Setup WebRTC after state updates
      if (webrtc.localStream && data.roomId) {
        console.log('[VideoChat] Setting up WebRTC for room:', data.roomId);
        try {
          await webrtc.setupPeerConnection(data.roomId, true);
        } catch (error) {
          console.error('[VideoChat] WebRTC setup failed:', error);
          chatState.addSystemMessage('Video connection failed. Audio chat available.');
        }
      }
    },

    onPartnerLeft: () => {
      console.log('[VideoChat] Partner left');
      chatState.setIsPartnerConnected(false);
      chatState.setIsFindingPartner(false);
      chatState.setPartnerInfo(null);
      chatState.setIsPartnerTyping(false);
      webrtc.cleanupConnections(false);
    },

    onWebRTCSignal: async (signalData: any) => {
      if (!signalData) return;
      try {
        await webrtc.handleWebRTCSignal(signalData);
      } catch (error) {
        console.error('[VideoChat] WebRTC signal error:', error);
      }
    },    onStatusChange: (status: string) => {
      chatState.setPartnerInfo((prev: { status: string } | null) => 
        prev ? {...prev, status} : null
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
      webrtc.cleanupConnections(false);
    },
    onConnectErrorHandler: () => {
      console.log('[VideoChat] Connection error');
      chatState.setIsFindingPartner(false);
    }
  }), [chatState, auth.authId, webrtc]); // ✅ Stable dependencies only
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
    
    console.log(`[VideoChat] Mount #${lifecycleRef.current.mountCount} at ${now}`);
    
    // ✅ CRITICAL: Detect rapid remounting (React Strict Mode)
    if (now - lifecycleRef.current.lastMountTime < 500) {
      console.warn(`[VideoChat] Rapid remount detected - applying stability delay`);
      
      if (lifecycleRef.current.stabilityTimer) {
        clearTimeout(lifecycleRef.current.stabilityTimer);
      }
      
      lifecycleRef.current.stabilityTimer = setTimeout(() => {
        if (!lifecycleRef.current.isDestroyed) {
          console.log(`[VideoChat] Stability achieved, mounting component`);
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
      console.log('[VideoChat] Component unmounting');
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
  socketResult,
  auth,
  chatState,
  webrtc,
  interests
}: any) => {
  const autoSearchInitialized = useRef(false);

  useEffect(() => {
    // Skip if already initialized or component is being destroyed
    if (autoSearchInitialized.current || lifecycleRef.current.isDestroyed) {
      return;
    }

    // Skip during stability period
    if (lifecycleRef.current.stabilityTimer) {
      console.log('[VideoChat] Skipping auto-search - waiting for stability');
      return;
    }

    console.log('[VideoChat] Auto-search effect triggered:', {
      isConnected: socketResult.isConnected,
      authLoading: auth.isLoading,
      authId: auth.authId,
      isPartnerConnected: chatState.isPartnerConnected,
      isFindingPartner: chatState.isFindingPartner,
      hasCameraPermission: webrtc.hasCameraPermission,
      hasLocalStream: !!webrtc.localStream
    });

    // Enhanced readiness checks
    const isSocketReady = socketResult.isConnected && !socketResult.connectionError;
    const isAuthReady = !auth.isLoading && auth.authId !== undefined;
    const isChatReady = !chatState.isPartnerConnected && !chatState.isFindingPartner;
    const isCameraReady = webrtc.hasCameraPermission === true && !!webrtc.localStream;

    if (!isSocketReady || !isAuthReady || !isChatReady || !isCameraReady) {
      console.log('[VideoChat] Auto-search conditions not met');
      return;
    }

    // Rate limiting
    const now = Date.now();
    if (now - lifecycleRef.current.lastSearchTime < 15000) {
      console.log('[VideoChat] Auto-search rate limited');
      return;
    }

    // Limit search attempts
    if (lifecycleRef.current.searchAttemptCount >= 2) {
      console.log('[VideoChat] Max search attempts reached');
      chatState.addSystemMessage('Please click "Find" to start video chat.');
      return;
    }

    // ✅ Start controlled auto-search with delay
    const searchTimeout = setTimeout(() => {
      if (!lifecycleRef.current.isDestroyed && !autoSearchInitialized.current) {
        autoSearchInitialized.current = true;
        lifecycleRef.current.lastSearchTime = now;
        lifecycleRef.current.searchAttemptCount++;

        console.log('[VideoChat] ✅ Starting auto-search for partner');
        
        chatState.setIsFindingPartner(true);
        chatState.addSystemMessage('Searching for a video chat partner...');
        
        const success = socketResult.emitFindPartner({
          chatType: 'video',
          interests,
          authId: auth.authId,
          sessionId: lifecycleRef.current.sessionId,
          timestamp: now
        });
        
        if (!success) {
          console.error('[VideoChat] Failed to emit findPartner');
          chatState.setIsFindingPartner(false);
          chatState.addSystemMessage('Failed to start video chat. Please try again.');
          autoSearchInitialized.current = false;
        }
      }
    }, 1000); // ✅ 1 second delay prevents race conditions

    return () => clearTimeout(searchTimeout);
  }, [
    // ✅ CRITICAL: Only primitive dependencies
    socketResult.isConnected,
    socketResult.connectionError,
    auth.isLoading,
    auth.authId,
    chatState.isPartnerConnected,
    chatState.isFindingPartner,
    webrtc.hasCameraPermission,
    !!webrtc.localStream // Convert to boolean
  ]);

  // Reset auto-search when conditions change
  useEffect(() => {
    const shouldReset = chatState.isPartnerConnected || 
                       !socketResult.isConnected || 
                       socketResult.connectionError ||
                       webrtc.hasCameraPermission === false;

    if (shouldReset && autoSearchInitialized.current) {
      console.log('[VideoChat] Resetting auto-search state');
      autoSearchInitialized.current = false;
    }

    if (chatState.isPartnerConnected) {
      lifecycleRef.current.searchAttemptCount = 0;
    }
  }, [
    chatState.isPartnerConnected, 
    socketResult.isConnected, 
    socketResult.connectionError, 
    webrtc.hasCameraPermission
  ]);
};

export const useVideoChat = () => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  // ✅ CRITICAL: Lifecycle management first
  const { lifecycleRef, isMounted } = useLifecycleManager();
  
  // State management
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isSelfDisconnectedRecently, setIsSelfDisconnectedRecently] = useState(false);
  const [isPartnerLeftRecently, setIsPartnerLeftRecently] = useState(false);
  const [partnerInterests, setPartnerInterests] = useState<string[]>([]);

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
  const webrtc = useWebRTC();  const socketResult = useVideoChatSocket({
    onMessage: (data: any) => {
      console.log('[VideoChat] Handling message:', data);
      
      if (data.senderAuthId === auth.authId) {
        console.warn('[VideoChat] Ignoring message from self');
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
      if (!data?.partnerId || !data?.roomId) {
        console.error('[VideoChat] Invalid partner data:', data);
        return;
      }
      
      if (data.partnerAuthId && auth.authId && data.partnerAuthId === auth.authId) {
        console.error('[VideoChat] Self-match detected!');
        chatState.addSystemMessage('Matching error. Please try again.');
        return;
      }
      
      try {
        playSound('Match.wav');
      } catch (error) {
        console.warn('[VideoChat] Failed to play sound:', error);
      }
      
      chatState.setPartnerInfo({
        id: data.partnerId,
        username: data.partnerUsername || 'Stranger',
        displayName: data.partnerDisplayName,
        avatar_url: data.partnerAvatarUrl,
        status: data.partnerStatus || 'online',
        displayNameColor: data.partnerDisplayNameColor || '#ff0000',
        displayNameAnimation: data.partnerDisplayNameAnimation || 'none',
        rainbowSpeed: data.partnerRainbowSpeed || 3,
        authId: data.partnerAuthId,
        badges: data.partnerBadges || []
      });
      
      chatState.setIsFindingPartner(false);
      chatState.setIsPartnerConnected(true);
      chatState.setMessages([]);

      if (webrtc.localStream && data.roomId) {
        console.log('[VideoChat] Setting up WebRTC for room:', data.roomId);
        try {
          await webrtc.setupPeerConnection(data.roomId, true);
        } catch (error) {
          console.error('[VideoChat] WebRTC setup failed:', error);
          chatState.addSystemMessage('Video connection failed. Audio chat available.');
        }
      }
    },
    onPartnerLeft: () => {
      console.log('[VideoChat] Partner left');
      chatState.setIsPartnerConnected(false);
      chatState.setIsFindingPartner(false);
      chatState.setPartnerInfo(null);
      chatState.setIsPartnerTyping(false);
      webrtc.cleanupConnections(false);
    },    onWebRTCSignal: async (signalData: any) => {
      if (!signalData) return;
      try {
        await webrtc.handleWebRTCSignal(signalData);
      } catch (error) {
        console.error('[VideoChat] WebRTC signal error:', error);
      }
    },
    onStatusChange: (status: string) => {
      chatState.setPartnerInfo((prev: any) => 
        prev ? { ...prev, status } : null
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
      webrtc.cleanupConnections(false);
    },
    onConnectErrorHandler: () => {
      console.log('[VideoChat] Connection error');
      chatState.setIsFindingPartner(false);
    },
    authId: auth.authId ?? undefined,
    roomId
  });

  // Other hooks
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
      setMessages: chatState.setMessages,
      wasSkippedByPartner: false, // Add default value
      didSkipPartner: false       // Add default value
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

  // ✅ CRITICAL: Controlled auto-search
  useControlledAutoSearch({
    lifecycleRef,
    socketResult,
    auth,
    chatState,
    webrtc,
    interests
  });
  
  // Navigation cleanup
  useEffect(() => {
    if (pathname === '/video-chat') {
      chatState.resetChatState();
      setIsSelfDisconnectedRecently(false);
      setIsPartnerLeftRecently(false);
      setPartnerInterests([]);
      setRoomId(null);
    }
  }, [pathname]);

  // WebRTC cleanup
  useEffect(() => {
    return () => {
      webrtc.cleanupConnections(true);
    };
  }, []);

  const handleUsernameClick = useCallback((authId: string, clickPosition: { x: number; y: number }) => {
    console.log('[VideoChat] Username clicked:', authId, clickPosition);
  }, []);

  // ✅ Responsive layout calculations
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
      avatar: chatState.partnerInfo.avatar_url || '/default-avatar.png',
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
    
    // Debug info
    debugInfo: {
      sessionId: lifecycleRef.current.sessionId,
      searchAttempts: lifecycleRef.current.searchAttemptCount,
      autoSearchStarted: lifecycleRef.current.autoSearchStarted,
      isInitialized: lifecycleRef.current.isInitialized,
      mountCount: lifecycleRef.current.mountCount,
      hasStabilityTimer: !!lifecycleRef.current.stabilityTimer
    }
  };
};