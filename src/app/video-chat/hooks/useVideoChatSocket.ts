// src/app/video-chat/hooks/useVideoChatSocket.ts - FIXED VERSION WITH NULL SAFETY
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
  const maxReconnectAttempts = 5;

  // Update room ID ref when it changes
  useEffect(() => {
    roomIdRef.current = params.roomId || null;
  }, [params.roomId]);

  // ✅ ENHANCED: Socket connection with better error handling
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
    
    // ✅ CRITICAL FIX: Generate unique tab ID to prevent conflicts
    const tabId = `video-tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const socket = io(socketServerUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true, // ✅ Force new connection to prevent conflicts
      upgrade: true,
      rememberUpgrade: false,
      query: {
        tabId: tabId,
        timestamp: Date.now(),
        chatType: 'video' // ✅ Identify as video chat
      }
    });
    
    socketRef.current = socket;

    // ✅ ENHANCED: Set up WebRTC signal emission function with null safety
    if (typeof window !== 'undefined') {
      window.videoChatEmitWebRTCSignal = (data) => {
        // ✅ CRITICAL FIX: Validate data before emitting
        if (!data || !data.signalData) {
          console.error('[VideoChatSocket] Invalid WebRTC signal data:', data);
          return;
        }
        
        if (socket.connected && roomIdRef.current) {
          console.log('[VideoChatSocket] Emitting WebRTC signal:', data.signalData.type || 'candidate');
          try {
            socket.emit('webrtcSignal', {
              roomId: roomIdRef.current,
              signalData: data.signalData
            });
          } catch (error) {
            console.error('[VideoChatSocket] Error emitting WebRTC signal:', error);
          }
        } else {
          console.warn('[VideoChatSocket] Cannot emit WebRTC signal - not connected or no room');
        }
      };
    }

    // ✅ ENHANCED: Connection event handlers
    const handleConnect = () => {
      console.log('[VideoChatSocket] Connected:', socket.id);
      setIsConnected(true);
      setIsConnecting(false);
      setConnectionError(null);
      reconnectAttemptsRef.current = 0;
      
      // ✅ Identify this tab to prevent duplicate handling
      socket.emit('identify_tab', { 
        tabId,
        chatType: 'video',
        isReconnect: reconnectAttemptsRef.current > 0 
      });
    };

    const handleDisconnect = (reason: string) => {
      console.log('[VideoChatSocket] Disconnected:', reason);
      setIsConnected(false);
      setIsConnecting(false);
      roomIdRef.current = null;
      params.onDisconnectHandler(reason);
      
      // ✅ Handle different disconnect reasons
      if (reason === 'io server disconnect') {
        setConnectionError('Disconnected by server');
      } else if (reason === 'transport close' || reason === 'ping timeout') {
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          setConnectionError('Connection lost - reconnecting...');
          reconnectAttemptsRef.current++;
        } else {
          setConnectionError('Connection lost - please refresh');
        }
      }
    };

    const handleConnectError = (err: Error) => {
      console.error('[VideoChatSocket] Connection error:', err);
      setIsConnected(false);
      setIsConnecting(false);
      setConnectionError(err.message);
      params.onConnectErrorHandler(err);
    };

    // ✅ ENHANCED: Video chat event handlers with null safety
    const handlePartnerFound = (data: any) => {
      console.log('[VideoChatSocket] Partner found:', data?.partnerId);
      
      // ✅ Validate partner data
      if (!data || !data.partnerId || !data.roomId) {
        console.error('[VideoChatSocket] Invalid partner found data:', data);
        return;
      }
      
      roomIdRef.current = data.roomId;
      params.onPartnerFound({
        partnerId: data.partnerId,
        roomId: data.roomId,
        interests: data.interests || [],
        partnerUsername: data.partnerUsername,
        partnerDisplayName: data.partnerDisplayName,
        partnerAvatarUrl: data.partnerAvatarUrl,
        partnerBannerUrl: data.partnerBannerUrl,
        partnerPronouns: data.partnerPronouns,
        partnerStatus: data.partnerStatus,
        partnerDisplayNameColor: data.partnerDisplayNameColor,
        partnerDisplayNameAnimation: data.partnerDisplayNameAnimation,
        partnerRainbowSpeed: data.partnerRainbowSpeed,
        partnerAuthId: data.partnerAuthId,
        partnerBadges: data.partnerBadges || []
      });
    };

    const handleReceiveMessage = (data: any) => {
      console.log('[VideoChatSocket] Message received from:', data?.senderId);
      
      // ✅ Validate message data
      if (!data || !data.message) {
        console.warn('[VideoChatSocket] Invalid message data:', data);
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

    const handlePartnerStatusChanged = (data: any) => {
      console.log('[VideoChatSocket] Partner status changed:', data?.status);
      if (data?.status) {
        params.onStatusChange(data.status);
      }
    };

    // ✅ CRITICAL FIX: Enhanced WebRTC signal handling with comprehensive validation
    const handleWebRTCSignal = (data: any) => {
      console.log('[VideoChatSocket] WebRTC signal received:', data?.signalData?.type || 'unknown');
      
      // ✅ CRITICAL: Comprehensive validation of signal data
      if (!data) {
        console.error('[VideoChatSocket] Received null WebRTC signal data');
        return;
      }
      
      if (!data.signalData) {
        console.error('[VideoChatSocket] WebRTC signal missing signalData:', data);
        return;
      }
      
      // ✅ Validate signal data structure
      const signalData = data.signalData;
      if (typeof signalData !== 'object') {
        console.error('[VideoChatSocket] Invalid signalData type:', typeof signalData);
        return;
      }
      
      // ✅ Log signal type for debugging
      if (signalData.type) {
        console.log('[VideoChatSocket] Processing WebRTC signal type:', signalData.type);
      } else if (signalData.candidate) {
        console.log('[VideoChatSocket] Processing ICE candidate');
      } else {
        console.warn('[VideoChatSocket] Unknown WebRTC signal structure:', signalData);
      }
      
      try {
        params.onWebRTCSignal(signalData);
      } catch (error) {
        console.error('[VideoChatSocket] Error in WebRTC signal handler:', error);
      }
    };

    // ✅ Enhanced heartbeat handling
    const handleHeartbeat = (data: any) => {
      if (data?.timestamp) {
        socket.emit('heartbeat_response', {
          clientTime: Date.now(),
          received: data.timestamp,
          chatType: 'video'
        });
      }
    };

    const handleConnectionWarning = (data: any) => {
      console.warn('[VideoChatSocket] Connection warning:', data);
      if (data?.type === 'stale_connection') {
        socket.emit('connection_health', {
          latency: Date.now() - (data.timestamp || Date.now()),
          clientTime: Date.now(),
          chatType: 'video'
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

    // ✅ Attach event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
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
          socket.emit('leaveChat', { roomId: roomIdRef.current });
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
    params.onConnectErrorHandler
  ]);

  // ✅ ENHANCED: Emit functions with better validation and error handling
  const emitFindPartner = useCallback((payload: {
    chatType: 'text' | 'video';
    interests: string[];
    authId?: string | null;
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
    
    console.log('[VideoChatSocket] Finding video chat partner:', payload);
    try {
      socketRef.current.emit('findPartner', payload);
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
        roomId: roomIdRef.current
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
        socketRef.current.emit('typing_start', { roomId: roomIdRef.current });
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
        socketRef.current.emit('typing_stop', { roomId: roomIdRef.current });
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
        socketRef.current.emit('leaveChat', { roomId: roomIdRef.current });
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
        signalData: payload.signalData
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
        socketRef.current.emit('updateStatus', { status });
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
      roomId: roomIdRef.current,
      reconnectAttempts: reconnectAttemptsRef.current,
      transport: socketRef.current?.io?.engine?.transport?.name || null
    };
  }, [isConnected, connectionError, isConnecting]);

  return {
    // State
    socket: socketRef.current,
    isConnected,
    connectionError,
    isConnecting,
    roomId: roomIdRef.current,
    
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