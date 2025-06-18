// src/app/video-chat/hooks/useVideoChatSocket.ts - ENHANCED VERSION
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { showChatToast } from '../../chat/utils/ChatHelpers';

interface UseVideoChatSocketParams {
  onMessage: (msg: any) => void;
  onPartnerFound: (partner: any) => void;
  onPartnerLeft: () => void;
  onStatusChange: (status: string) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  onWebRTCSignal: (signalData: any) => void;
  onWaiting: () => void;
  onCooldown: () => void;
  onDisconnectHandler: (reason: string) => void;
  onConnectErrorHandler: (err: Error) => void;
  authId?: string | null;
  roomId?: string | null;
}

export function useVideoChatSocket(params: UseVideoChatSocketParams) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const roomIdRef = useRef<string | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const tabIdRef = useRef<string | null>(null);
  const maxReconnectAttempts = 3; // Reduced to prevent infinite loops

  // Update room ID ref when it changes
  useEffect(() => {
    roomIdRef.current = params.roomId || null;
  }, [params.roomId]);

  // ✅ CRITICAL: Enhanced socket connection with better conflict prevention
  useEffect(() => {
    const socketServerUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL;
    
    if (!socketServerUrl) {
      const error = 'Socket server URL not configured';
      console.error('[VideoChatSocket]', error);
      setConnectionError(error);
      return;
    }

    console.log('[VideoChatSocket] Connecting to server:', socketServerUrl);
    setIsConnecting(true);
    
    // ✅ CRITICAL: Generate truly unique tab ID to prevent conflicts
    const tabId = `video-tab-${Date.now()}-${Math.random().toString(36).substr(2, 12)}-${performance.now().toString(36)}`;
    tabIdRef.current = tabId;
    
    const socket = io(socketServerUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 2000, // Increased delay
      reconnectionDelayMax: 8000, // Increased max delay
      timeout: 20000,
      forceNew: true,
      upgrade: true,
      rememberUpgrade: false,
      query: {
        tabId: tabId,
        timestamp: Date.now(),
        chatType: 'video',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 100) : 'unknown',
        // ✅ Add additional unique identifiers
        sessionId: `${Date.now()}-${Math.random()}`,
        clientId: `video-client-${Date.now()}`
      }
    });
    
    socketRef.current = socket;

    // ✅ CRITICAL: Enhanced WebRTC signal emission with validation
    if (typeof window !== 'undefined') {
      window.videoChatEmitWebRTCSignal = (data) => {
        // ✅ Comprehensive validation
        if (!data || !data.signalData) {
          console.error('[VideoChatSocket] Invalid WebRTC signal data:', data);
          return false;
        }
        
        if (!socket.connected || !roomIdRef.current) {
          console.warn('[VideoChatSocket] Cannot emit WebRTC signal - not connected or no room');
          return false;
        }
        
        console.log('[VideoChatSocket] Emitting WebRTC signal:', data.signalData.type || 'candidate');
        try {
          socket.emit('webrtcSignal', {
            roomId: roomIdRef.current,
            signalData: data.signalData,
            fromTabId: tabIdRef.current, // ✅ Include tab ID for tracking
            timestamp: Date.now()
          });
          return true;
        } catch (error) {
          console.error('[VideoChatSocket] Error emitting WebRTC signal:', error);
          return false;
        }
      };
    }

    // ✅ ENHANCED: Connection event handlers with better conflict handling
    const handleConnect = () => {
      console.log('[VideoChatSocket] Connected:', socket.id);
      setIsConnected(true);
      setIsConnecting(false);
      setConnectionError(null);
      reconnectAttemptsRef.current = 0;
      
      // ✅ CRITICAL: Immediately identify tab to prevent conflicts
      socket.emit('identify_tab', { 
        tabId,
        chatType: 'video',
        authId: params.authId,
        isReconnect: reconnectAttemptsRef.current > 0,
        timestamp: Date.now(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 50) : 'unknown'
      });
    };

    const handleDisconnect = (reason: string) => {
      console.log('[VideoChatSocket] Disconnected:', reason);
      setIsConnected(false);
      setIsConnecting(false);
      roomIdRef.current = null;
      params.onDisconnectHandler(reason);
      
      // ✅ Enhanced disconnect reason handling
      if (reason === 'io server disconnect') {
        setConnectionError('Disconnected by server');
      } else if (reason === 'transport close' || reason === 'ping timeout') {
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          setConnectionError('Connection lost - reconnecting...');
          reconnectAttemptsRef.current++;
        } else {
          setConnectionError('Connection lost - please refresh page');
        }
      } else if (reason === 'io client disconnect') {
        // Normal disconnect, don't show error
        setConnectionError(null);
      }
    };

    const handleConnectError = (err: Error) => {
      console.error('[VideoChatSocket] Connection error:', err);
      setIsConnected(false);
      setIsConnecting(false);
      reconnectAttemptsRef.current++;
      
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        setConnectionError('Failed to connect - please refresh page');
      } else {
        setConnectionError(`Connection error - retrying... (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
      }
      
      params.onConnectErrorHandler(err);
    };

    // ✅ ENHANCED: Handle duplicate tab detection
    const handleDuplicateTab = (data: any) => {
      console.warn('[VideoChatSocket] Duplicate tab detected:', data);
      setConnectionError('This chat was opened in another tab');
      
      // Disconnect immediately to prevent conflicts
      socket.disconnect();
      
      // Show user-friendly message
      showChatToast.error('Video chat opened in another tab. Please use only one tab.');
    };

    const handleAuthConflict = (data: any) => {
      console.warn('[VideoChatSocket] Auth conflict detected:', data);
      setConnectionError('Another video chat session detected');
      
      socket.disconnect();
      showChatToast.error('You have another video chat session open. Please close other tabs.');
    };

    // ✅ CRITICAL: Enhanced partner found handling with validation
    const handlePartnerFound = (data: any) => {
      console.log('[VideoChatSocket] Partner found:', data?.partnerId);
      
      // ✅ CRITICAL: Validate partner data and prevent self-matching
      if (!data || !data.partnerId || !data.roomId) {
        console.error('[VideoChatSocket] Invalid partner found data:', data);
        return;
      }
      
      // ✅ CRITICAL: Check for self-matching
      if (data.partnerId === socket.id) {
        console.error('[VideoChatSocket] CRITICAL: Self-match detected!', data);
        socket.emit('leaveChat', { roomId: data.roomId });
        showChatToast.error('Matching error occurred. Please try again.');
        return;
      }
      
      // ✅ Check for auth ID self-matching
      if (data.partnerAuthId && params.authId && data.partnerAuthId === params.authId) {
        console.error('[VideoChatSocket] CRITICAL: Same auth ID match detected!', data);
        socket.emit('leaveChat', { roomId: data.roomId });
        showChatToast.error('Cannot match with yourself. Please try again.');
        return;
      }
      
      roomIdRef.current = data.roomId;
      params.onPartnerFound({
        partnerId: data.partnerId,
        roomId: data.roomId,
        interests: data.interests || [],
        partnerUsername: data.partnerUsername || 'Stranger',
        partnerDisplayName: data.partnerDisplayName,
        partnerAvatarUrl: data.partnerAvatarUrl,
        partnerBannerUrl: data.partnerBannerUrl,
        partnerPronouns: data.partnerPronouns,
        partnerStatus: data.partnerStatus || 'online',
        partnerDisplayNameColor: data.partnerDisplayNameColor,
        partnerDisplayNameAnimation: data.partnerDisplayNameAnimation,
        partnerRainbowSpeed: data.partnerRainbowSpeed,
        partnerAuthId: data.partnerAuthId,
        partnerBadges: data.partnerBadges || []
      });
    };

    const handleReceiveMessage = (data: any) => {
      console.log('[VideoChatSocket] Message received from:', data?.senderId);
      
      // ✅ Validate message data and check for self-messages
      if (!data || !data.message) {
        console.warn('[VideoChatSocket] Invalid message data:', data);
        return;
      }
      
      // ✅ CRITICAL: Prevent receiving messages from self
      if (data.senderId === socket.id) {
        console.warn('[VideoChatSocket] Ignoring message from self:', data.senderId);
        return;
      }
      
      params.onMessage({
        senderId: data.senderId,
        message: data.message,
        senderUsername: data.senderUsername,
        senderAuthId: data.senderAuthId,
        senderDisplayNameColor: data.senderDisplayNameColor,
        senderDisplayNameAnimation: data.senderDisplayNameAnimation,
        senderRainbowSpeed: data.senderRainbowSpeed
      });
    };

    const handlePartnerLeft = () => {
      console.log('[VideoChatSocket] Partner left');
      roomIdRef.current = null;
      params.onPartnerLeft();
    };

    // ✅ CRITICAL: Enhanced WebRTC signal handling with self-prevention
    const handleWebRTCSignal = (data: any) => {
      console.log('[VideoChatSocket] WebRTC signal received:', data?.signalData?.type || 'unknown');
      
      // ✅ CRITICAL: Comprehensive validation
      if (!data) {
        console.error('[VideoChatSocket] Received null WebRTC signal data');
        return;
      }
      
      if (!data.signalData) {
        console.error('[VideoChatSocket] WebRTC signal missing signalData:', data);
        return;
      }
      
      // ✅ CRITICAL: Prevent processing signals from self
      if (data.fromUser === socket.id) {
        console.warn('[VideoChatSocket] Ignoring WebRTC signal from self:', data.fromUser);
        return;
      }
      
      // ✅ Validate signal data structure
      if (typeof data.signalData !== 'object') {
        console.error('[VideoChatSocket] Invalid signalData type:', typeof data.signalData);
        return;
      }
      
      try {
        params.onWebRTCSignal(data.signalData);
      } catch (error) {
        console.error('[VideoChatSocket] Error in WebRTC signal handler:', error);
      }
    };

    const handlePartnerStatusChanged = (data: any) => {
      console.log('[VideoChatSocket] Partner status changed:', data?.status);
      if (data?.status) {
        params.onStatusChange(data.status);
      }
    };

    // ✅ Enhanced heartbeat handling
    const handleHeartbeat = (data: any) => {
      if (data?.timestamp) {
        socket.emit('heartbeat_response', {
          clientTime: Date.now(),
          received: data.timestamp,
          chatType: 'video',
          tabId: tabIdRef.current
        });
      }
    };

    const handleConnectionWarning = (data: any) => {
      console.warn('[VideoChatSocket] Connection warning:', data);
      if (data?.type === 'stale_connection') {
        socket.emit('connection_health', {
          latency: Date.now() - (data.timestamp || Date.now()),
          clientTime: Date.now(),
          chatType: 'video',
          tabId: tabIdRef.current
        });
      }
    };

    // ✅ Enhanced batched message handling
    const handleBatchedMessages = (messages: Array<{ event: string; data: any }>) => {
      if (!Array.isArray(messages)) {
        console.warn('[VideoChatSocket] Invalid batched messages format');
        return;
      }
      
      messages.forEach(({ event, data }) => {
        try {
          // ✅ CRITICAL: Check for self-messages in batched messages
          if ((event === 'receiveMessage' || event === 'webrtcSignal') && 
              data?.senderId === socket.id || data?.fromUser === socket.id) {
            console.warn(`[VideoChatSocket] Ignoring batched ${event} from self`);
            return;
          }
          
          switch (event) {
            case 'receiveMessage':
              handleReceiveMessage(data);
              break;
            case 'partnerStatusChanged':
              handlePartnerStatusChanged(data);
              break;
            case 'partner_typing_start':
              params.onTypingStart();
              break;
            case 'partner_typing_stop':
              params.onTypingStop();
              break;
            case 'webrtcSignal':
              handleWebRTCSignal(data);
              break;
            default:
              console.log('[VideoChatSocket] Unknown batched event:', event);
          }
        } catch (error) {
          console.error('[VideoChatSocket] Error processing batched message:', error);
        }
      });
    };

    // ✅ Tab identification confirmation
    const handleTabIdentified = (data: any) => {
      console.log('[VideoChatSocket] Tab identified:', data);
      if (data?.tabId === tabIdRef.current) {
        console.log('[VideoChatSocket] ✅ Tab identity confirmed');
      } else {
        console.warn('[VideoChatSocket] ⚠️ Tab identity mismatch:', data?.tabId, 'vs', tabIdRef.current);
      }
    };

    // ✅ Attach all event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('duplicate_tab_detected', handleDuplicateTab);
    socket.on('auth_conflict_detected', handleAuthConflict);
    socket.on('tab_identified', handleTabIdentified);
    socket.on('partnerFound', handlePartnerFound);
    socket.on('receiveMessage', handleReceiveMessage);
    socket.on('partnerLeft', handlePartnerLeft);
    socket.on('partnerStatusChanged', handlePartnerStatusChanged);
    socket.on('webrtcSignal', handleWebRTCSignal);
    socket.on('partner_typing_start', params.onTypingStart);
    socket.on('partner_typing_stop', params.onTypingStop);
    socket.on('waitingForPartner', params.onWaiting);
    socket.on('findPartnerCooldown', params.onCooldown);
    socket.on('batchedMessages', handleBatchedMessages);
    socket.on('heartbeat', handleHeartbeat);
    socket.on('connection_warning', handleConnectionWarning);

    // ✅ Enhanced cleanup
    return () => {
      console.log('[VideoChatSocket] Cleaning up connection');
      
      // Leave room if connected
      if (roomIdRef.current && socket.connected) {
        try {
          socket.emit('leaveChat', { 
            roomId: roomIdRef.current,
            tabId: tabIdRef.current,
            reason: 'component_cleanup'
          });
        } catch (error) {
          console.warn('[VideoChatSocket] Error leaving chat:', error);
        }
      }
      
      // Remove global function
      if (typeof window !== 'undefined') {
        delete window.videoChatEmitWebRTCSignal;
      }
      
      // Clean up socket
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      roomIdRef.current = null;
      tabIdRef.current = null;
    };
  }, [
    params.onMessage,
    params.onPartnerFound,
    params.onPartnerLeft,
    params.onStatusChange,
    params.onTypingStart,
    params.onTypingStop,
    params.onWebRTCSignal,
    params.onWaiting,
    params.onCooldown,
    params.onDisconnectHandler,
    params.onConnectErrorHandler,
    params.authId // ✅ Include authId to detect changes
  ]);

  // ✅ ENHANCED: Emit functions with better validation and error handling
  const emitFindPartner = useCallback((payload: {
    chatType: 'text' | 'video';
    interests: string[];
    authId?: string | null;
    tabId?: string;
  }) => {
    if (!socketRef.current?.connected) {
      showChatToast.connectionError('Not connected to video chat server');
      return false;
    }
    
    // ✅ Validate payload
    if (!payload || payload.chatType !== 'video') {
      console.error('[VideoChatSocket] Invalid findPartner payload:', payload);
      return false;
    }
    
    // ✅ CRITICAL: Include unique identifiers to prevent self-matching
    const enhancedPayload = {
      ...payload,
      tabId: tabIdRef.current,
      socketId: socketRef.current.id,
      timestamp: Date.now(),
      clientIdentifier: `${tabIdRef.current}-${Date.now()}`
    };
    
    console.log('[VideoChatSocket] Finding video chat partner:', enhancedPayload);
    try {
      socketRef.current.emit('findPartner', enhancedPayload);
      return true;
    } catch (error) {
      console.error('[VideoChatSocket] Error emitting findPartner:', error);
      return false;
    }
  }, []);

  const emitMessage = useCallback((payload: {
    roomId: string;
    message: string;
    username?: string | null;
    authId?: string | null;
  }) => {
    if (!socketRef.current?.connected) {
      showChatToast.connectionError('Not connected to video chat server');
      return false;
    }
    
    if (!roomIdRef.current) {
      showChatToast.messageError('Not in a video chat room');
      return false;
    }
    
    // ✅ Validate message
    if (!payload?.message?.trim()) {
      console.warn('[VideoChatSocket] Empty message not sent');
      return false;
    }
    
    console.log('[VideoChatSocket] Sending message');
    try {
      socketRef.current.emit('sendMessage', {
        ...payload,
        roomId: roomIdRef.current,
        tabId: tabIdRef.current,
        socketId: socketRef.current.id
      });
      return true;
    } catch (error) {
      console.error('[VideoChatSocket] Error sending message:', error);
      return false;
    }
  }, []);

  const emitTypingStart = useCallback(() => {
    if (socketRef.current?.connected && roomIdRef.current) {
      try {
        socketRef.current.emit('typing_start', { 
          roomId: roomIdRef.current,
          tabId: tabIdRef.current
        });
        return true;
      } catch (error) {
        console.error('[VideoChatSocket] Error starting typing:', error);
      }
    }
    return false;
  }, []);

  const emitTypingStop = useCallback(() => {
    if (socketRef.current?.connected && roomIdRef.current) {
      try {
        socketRef.current.emit('typing_stop', { 
          roomId: roomIdRef.current,
          tabId: tabIdRef.current
        });
        return true;
      } catch (error) {
        console.error('[VideoChatSocket] Error stopping typing:', error);
      }
    }
    return false;
  }, []);

  const emitLeaveChat = useCallback(() => {
    if (socketRef.current?.connected && roomIdRef.current) {
      console.log('[VideoChatSocket] Leaving chat room:', roomIdRef.current);
      try {
        socketRef.current.emit('leaveChat', { 
          roomId: roomIdRef.current,
          tabId: tabIdRef.current,
          reason: 'user_requested'
        });
        roomIdRef.current = null;
        return true;
      } catch (error) {
        console.error('[VideoChatSocket] Error leaving chat:', error);
      }
    }
    return false;
  }, []);

  const emitWebRTCSignal = useCallback((payload: {
    roomId: string;
    signalData: any;
  }) => {
    if (!socketRef.current?.connected || !roomIdRef.current) {
      console.warn('[VideoChatSocket] Cannot emit WebRTC signal - not connected');
      return false;
    }
    
    // ✅ Validate signal payload
    if (!payload?.signalData) {
      console.error('[VideoChatSocket] Invalid WebRTC signal payload:', payload);
      return false;
    }
    
    console.log('[VideoChatSocket] Emitting WebRTC signal:', payload.signalData.type || 'candidate');
    try {
      socketRef.current.emit('webrtcSignal', {
        roomId: roomIdRef.current,
        signalData: payload.signalData,
        fromTabId: tabIdRef.current,
        fromSocketId: socketRef.current.id,
        timestamp: Date.now()
      });
      return true;
    } catch (error) {
      console.error('[VideoChatSocket] Error emitting WebRTC signal:', error);
      return false;
    }
  }, []);

  const emitUpdateStatus = useCallback((status: 'online' | 'idle' | 'dnd' | 'offline') => {
    if (socketRef.current?.connected && params.authId) {
      console.log('[VideoChatSocket] Updating status:', status);
      try {
        socketRef.current.emit('updateStatus', { 
          status,
          tabId: tabIdRef.current
        });
        return true;
      } catch (error) {
        console.error('[VideoChatSocket] Error updating status:', error);
      }
    }
    return false;
  }, [params.authId]);

  // ✅ Enhanced connection health check
  const getConnectionHealth = useCallback(() => {
    return {
      isConnected,
      connectionError,
      isConnecting,
      socketId: socketRef.current?.id || null,
      tabId: tabIdRef.current,
      roomId: roomIdRef.current,
      reconnectAttempts: reconnectAttemptsRef.current,
      transport: socketRef.current?.io?.engine?.transport?.name || null,
      authId: params.authId
    };
  }, [isConnected, connectionError, isConnecting, params.authId]);

  return {
    // State
    socket: socketRef.current,
    isConnected,
    connectionError,
    isConnecting,
    roomId: roomIdRef.current,
    tabId: tabIdRef.current,
    
    // Emit functions
    emitFindPartner,
    emitMessage,
    emitTypingStart,
    emitTypingStop,
    emitLeaveChat,
    emitWebRTCSignal,
    emitUpdateStatus,
    
    // Utilities
    getConnectionHealth
  };
}