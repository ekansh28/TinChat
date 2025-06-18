// src/app/video-chat/hooks/useVideoChat.ts - MAIN CONSOLIDATED HOOK
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

interface UseVideoChatReturn {
  // State
  isMounted: boolean;
  isSelfDisconnectedRecently: boolean;
  isPartnerLeftRecently: boolean;
  partnerInterests: string[];
  interests: string[];
  roomId: string | null;
  
  // Computed values
  pinkThemeActive: boolean;
  effectivePageTheme: string;
  isMobile: boolean;
  chatWindowStyle: React.CSSProperties;
  videoWindowStyle: React.CSSProperties;
  chatWindowStyleAdjusted: React.CSSProperties;
  
  // Chat state
  chatState: ReturnType<typeof useChatState>;
  auth: ReturnType<typeof useAuth>;
  
  // WebRTC state
  webrtc: ReturnType<typeof useWebRTC>;
  
  // Socket state  
  socket: {
    isConnected: boolean;
    connectionError: string | null;
    emitFindPartner: (data: any) => boolean;
    emitMessage: (data: any) => boolean;
    emitLeaveChat: () => boolean;
  };
  
  // Actions
  chatActions: ReturnType<typeof useVideoChatActions>;
  handleUsernameClick: (authId: string, clickPosition: { x: number; y: number }) => void;
  
  // Data
  mappedMessages: any[];
  memoizedPartnerInfo: any;
  memoizedOwnInfo: any;
  
  // Loading states
  isLoading: boolean;
  hasConnectionError: boolean;
}

export const useVideoChat = (): UseVideoChatReturn => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  // ✅ FIXED: All hooks called unconditionally in same order every time
  const [isMounted, setIsMounted] = useState(false);
  const [isSelfDisconnectedRecently, setIsSelfDisconnectedRecently] = useState(false);
  const [isPartnerLeftRecently, setIsPartnerLeftRecently] = useState(false);
  const [partnerInterests, setPartnerInterests] = useState<string[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  
  // ✅ FIXED: Initialization tracking
  const initRef = useRef({
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
  
  // ✅ WebRTC hook for video functionality
  const webrtc = useWebRTC();

  // ✅ FIXED: Enhanced socket event handlers with proper WebRTC support
  const socketHandlers = useMemo(() => ({
    onMessage: (data: any) => {
      console.log('[VideoChat] Handling message:', data);
      
      // Update partner info with display settings
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

    onPartnerFound: async (data: any) => {
      console.log('[VideoChat] Partner found:', data);
      
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

      // ✅ ENHANCED: Setup WebRTC connection with better error handling
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
      
      // Clean up WebRTC connections but keep local stream
      webrtc.cleanupConnections(false);
    },

    onWebRTCSignal: async (signalData: any) => {
      console.log('[VideoChat] Received WebRTC signal:', signalData?.type || 'candidate');
      
      // ✅ CRITICAL FIX: Validate signalData before processing
      if (!signalData) {
        console.warn('[VideoChat] Received null/undefined WebRTC signal data');
        return;
      }
      
      // ✅ ENHANCED: Better error handling for WebRTC signals
      try {
        await webrtc.handleWebRTCSignal(signalData);
      } catch (error) {
        console.error('[VideoChat] Failed to handle WebRTC signal:', error);
        // Don't break the chat if WebRTC fails
        chatState.addSystemMessage('Video connection issue. Trying to reconnect...');
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
    },
    onConnectErrorHandler: () => {
      console.log('[VideoChat] Socket connection error');
      chatState.setIsFindingPartner(false);
    }
  }), [chatState, webrtc, isMounted]); // ✅ Minimal stable deps

  // ✅ FIXED: Socket hook called unconditionally
  const socketResult = useVideoChatSocket({
    ...socketHandlers,
    authId: auth.authId,
    roomId
  });

  // ✅ FIXED: Favicon manager hook called unconditionally
  useFaviconManager({
    isPartnerConnected: chatState.isPartnerConnected,
    isFindingPartner: chatState.isFindingPartner,
    connectionError: socketResult.connectionError,
    isSelfDisconnectedRecently,
    isPartnerLeftRecently
  });

  // ✅ FIXED: System messages hook called unconditionally
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

  // ✅ FIXED: Video chat actions hook called unconditionally
  const chatActions = useVideoChatActions({
    // Base chat action props
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
    
    // Video-specific props
    hasCameraPermission: webrtc.hasCameraPermission,
    initializeCamera: webrtc.initializeCamera,
    cleanupConnections: webrtc.cleanupConnections,
    setupPeerConnection: (roomId: string) => webrtc.setupPeerConnection(roomId, true)
  });

  // ✅ ENHANCED: Auto-search with better camera handling
  useEffect(() => {
    console.log('[VideoChat] Auto-search effect triggered:', {
      autoSearchStarted: initRef.current.autoSearchStarted,
      isConnected: socketResult.isConnected,
      authLoading: auth.isLoading,
      isPartnerConnected: chatState.isPartnerConnected,
      isFindingPartner: chatState.isFindingPartner,
      hasCameraPermission: webrtc.hasCameraPermission,
      hasLocalStream: !!webrtc.localStream
    });

    if (initRef.current.autoSearchStarted) {
      console.log('[VideoChat] Auto-search already started, skipping');
      return;
    }

    // ✅ CRITICAL FIX: Better readiness checks
    const isSocketReady = socketResult.isConnected && !socketResult.connectionError;
    const isAuthReady = !auth.isLoading && auth.authId !== undefined;
    const isChatReady = !chatState.isPartnerConnected && !chatState.isFindingPartner;
    const isCameraReady = webrtc.hasCameraPermission !== undefined;

    if (!isSocketReady || !isAuthReady || !isChatReady || !isCameraReady) {
      console.log('[VideoChat] Auto-search conditions not met - waiting...');
      return;
    }

    // ✅ Handle camera permission explicitly
    if (webrtc.hasCameraPermission === false) {
      chatState.addSystemMessage('Camera access required for video chat.');
      return;
    }

    // ✅ CRITICAL FIX: Initialize camera first, then start search
    const startVideoChat = async () => {
      if (!initRef.current.autoSearchStarted) {
        console.log('[VideoChat] ✅ Starting video chat initialization');
        initRef.current.autoSearchStarted = true;
        
        try {
          // Ensure camera is active
          const stream = webrtc.localStream || await webrtc.initializeCamera();
          if (!stream) {
            throw new Error('Failed to access camera');
          }
          
          chatState.setIsFindingPartner(true);
          chatState.addSystemMessage('Searching for a video chat partner...');
          setIsSelfDisconnectedRecently(false);
          setIsPartnerLeftRecently(false);
          
          const success = socketResult.emitFindPartner({
            chatType: 'video',
            interests,
            authId: auth.authId
          });
          
          if (!success) {
            throw new Error('Failed to emit findPartner');
          }
          
          console.log('[VideoChat] ✅ Video chat search started successfully');
        } catch (error) {
          console.error('[VideoChat] Failed to start video chat:', error);
          chatState.setIsFindingPartner(false);
          chatState.addSystemMessage('Failed to start video chat. Please check camera permissions.');
          initRef.current.autoSearchStarted = false;
        }
      }
    };

    // Add small delay to ensure everything is ready
    const delayedStart = setTimeout(startVideoChat, 1000);
    
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

  // ✅ IMPROVED: Reset auto-search flag when conditions change
  useEffect(() => {
    const shouldReset = chatState.isPartnerConnected || 
                       !socketResult.isConnected || 
                       socketResult.connectionError;

    if (shouldReset && initRef.current.autoSearchStarted) {
      console.log('[VideoChat] Resetting auto-search flag due to state change');
      initRef.current.autoSearchStarted = false;
    }
  }, [chatState.isPartnerConnected, socketResult.isConnected, socketResult.connectionError]);
  
  // ✅ FIXED: Navigation cleanup effect
  useEffect(() => {
    if (pathname === '/video-chat') {
      console.log('[VideoChat] Route change cleanup');
      chatState.resetChatState();
      setIsSelfDisconnectedRecently(false);
      setIsPartnerLeftRecently(false);
      setPartnerInterests([]);
      setRoomId(null);
      initRef.current.autoSearchStarted = false;
    }
  }, [pathname, chatState]);

  // ✅ FIXED: Mount effect with camera initialization
  useEffect(() => { 
    console.log('[VideoChat] Component mounted');
    setIsMounted(true);
    
    // Initialize camera on mount if permission is undefined
    if (webrtc.hasCameraPermission === undefined) {
      webrtc.initializeCamera();
    }
    
    return () => {
      console.log('[VideoChat] Component unmounting');
      // Cleanup WebRTC connections on unmount
      webrtc.cleanupConnections(true);
    };
  }, [webrtc]);

  // ✅ FIXED: Username click handler
  const handleUsernameClick = useCallback((authId: string, clickPosition: { x: number; y: number }) => {
    console.log('[VideoChat] Username clicked:', authId, clickPosition);
  }, []);

  // ✅ FIXED: Responsive video layout calculations
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
    hasConnectionError
  };
};