// src/app/chat/hooks/useChatSocket.ts - FIXED VERSION WITH STABLE DEPENDENCIES
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { showChatToast, PartnerInfo, Message } from '../utils/ChatHelpers';

interface UseChatSocketParams {
  onMessage: (msg: any) => void;
  onPartnerFound: (partner: any) => void;
  onPartnerLeft: () => void;
  onStatusChange: (status: string) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  onWaiting: () => void;
  onCooldown: () => void;
  onDisconnectHandler: (reason: string) => void;
  onConnectErrorHandler: (err: Error) => void;
  authId?: string | null;
  roomId?: string | null;
  onWebRTCSignal?: (signalData: any) => void;
}

export function useChatSocket({
  onMessage,
  onPartnerFound,
  onPartnerLeft,
  onStatusChange,
  onTypingStart,
  onTypingStop,
  onWaiting,
  onCooldown,
  onDisconnectHandler,
  onConnectErrorHandler,
  authId,
  roomId,
  onWebRTCSignal
}: UseChatSocketParams) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const roomIdRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionAttemptsRef = useRef(0);
  const isInitializedRef = useRef(false);

  // ✅ CRITICAL FIX: Store callbacks in stable refs to prevent recreation
  const stableCallbacks = useRef({
    onMessage,
    onPartnerFound,
    onPartnerLeft,
    onStatusChange,
    onTypingStart,
    onTypingStop,
    onWebRTCSignal,
    onWaiting,
    onCooldown,
    onDisconnectHandler,
    onConnectErrorHandler
  });

  // ✅ Update refs when callbacks change without triggering socket recreation
  useEffect(() => {
    stableCallbacks.current = {
      onMessage,
      onPartnerFound,
      onPartnerLeft,
      onStatusChange,
      onTypingStart,
      onTypingStop,
      onWebRTCSignal,
      onWaiting,
      onCooldown,
      onDisconnectHandler,
      onConnectErrorHandler
    };
  }); // No dependency array - runs every render but doesn't trigger socket recreation

  // Update room ID ref when it changes
  useEffect(() => {
    roomIdRef.current = roomId || null;
  }, [roomId]);

  // ✅ CRITICAL FIX: Socket connection with stable dependencies
  useEffect(() => {
    // Prevent multiple simultaneous connections
    if (isInitializedRef.current || isConnecting || socketRef.current?.connected) {
      console.log('[ChatSocket Debug] Connection already initialized or in progress, skipping...');
      return;
    }

    const socketServerUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL;
    
    if (!socketServerUrl) {
      const error = 'Socket server URL not configured';
      console.error('[ChatSocket Debug] Error:', error);
      setConnectionError(error);
      return;
    }

    isInitializedRef.current = true;
    setIsConnecting(true);
    connectionAttemptsRef.current += 1;

    console.log(`[ChatSocket Debug] Initializing socket connection...`, {
      socketServerUrl,
      authId,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    });
    
    const socket = io(socketServerUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
      forceNew: true,
      upgrade: true,
      rememberUpgrade: false
    });
    
    socketRef.current = socket;

    console.log(`[ChatSocket Debug] Creating socket connection to:`, socketServerUrl);

    // Set up WebRTC signal emission function for video chat
    if (stableCallbacks.current.onWebRTCSignal) {
      (window as any).videoChatEmitWebRTCSignal = (data: any) => {
        if (socket.connected && roomIdRef.current) {
          socket.emit('webrtcSignal', {
            roomId: roomIdRef.current,
            signalData: data.signalData
          });
        }
      };
    }

    // ✅ Connection events with proper error handling
    socket.on('connect', () => {
      console.log('[ChatSocket Debug] ✅ Socket connected:', socket.id);
      setIsConnected(true);
      setIsConnecting(false);
      setConnectionError(null);
      connectionAttemptsRef.current = 0;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[ChatSocket Debug] ❌ Socket disconnected:', reason);
      setIsConnected(false);
      setIsConnecting(false);
      roomIdRef.current = null;
      
      stableCallbacks.current.onDisconnectHandler(reason);

      if (reason === 'io server disconnect') {
        console.log('[ChatSocket Debug] Server disconnected us, not attempting reconnect');
      } else if (connectionAttemptsRef.current < 5) {
        const delay = Math.min(1000 * Math.pow(2, connectionAttemptsRef.current), 30000);
        console.log(`[ChatSocket Debug] Scheduling reconnect in ${delay}ms...`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!socketRef.current?.connected) {
            console.log('[ChatSocket Debug] Attempting manual reconnect...');
            socket.connect();
          }
        }, delay);
      }
    });

    socket.on('connect_error', (err) => {
      console.error('[ChatSocket Debug] 🚫 Socket connection error:', err);
      setIsConnected(false);
      setIsConnecting(false);
      setConnectionError(err.message);
      
      stableCallbacks.current.onConnectErrorHandler(err);
    });

    // ✅ Chat events using stable callback references
    socket.on('partnerFound', (data) => {
      console.log('[ChatSocket Debug] 🎯 Partner found:', { partnerId: data.partnerId, roomId: data.roomId });
      roomIdRef.current = data.roomId;
      stableCallbacks.current.onPartnerFound(data);
    });

    socket.on('receiveMessage', (data) => {
      console.log('[ChatSocket Debug] 💬 Message received:', { senderId: data.senderId, message: data.message });
      stableCallbacks.current.onMessage(data);
    });

    socket.on('partnerLeft', () => {
      console.log('[ChatSocket Debug] 👋 Partner left');
      roomIdRef.current = null;
      stableCallbacks.current.onPartnerLeft();
    });

    socket.on('partnerStatusChanged', (data) => {
      console.log('[ChatSocket Debug] 📊 Partner status changed:', data.status);
      stableCallbacks.current.onStatusChange(data.status);
    });

    // WebRTC signaling (only for video chat)
    if (stableCallbacks.current.onWebRTCSignal) {
      socket.on('webrtcSignal', (data) => {
        console.log('[ChatSocket Debug] 📹 WebRTC signal received:', data.signalData?.type || 'candidate');
        stableCallbacks.current.onWebRTCSignal!(data.signalData);
      });
    }

    socket.on('partner_typing_start', () => stableCallbacks.current.onTypingStart());
    socket.on('partner_typing_stop', () => stableCallbacks.current.onTypingStop());
    socket.on('waitingForPartner', () => stableCallbacks.current.onWaiting());
    socket.on('findPartnerCooldown', () => stableCallbacks.current.onCooldown());

    socket.on('onlineUserCountUpdate', (count) => {
      console.log('[ChatSocket Debug] 👥 Online users:', count);
    });

    socket.on('error', (error) => {
      console.error('[ChatSocket Debug] 🚨 Socket error:', error);
      setConnectionError(error.message || 'Socket error occurred');
    });

    // Cleanup function
    return () => {
      console.log('[ChatSocket Debug] 🧹 Cleaning up socket connection', {
        socketId: socket.id,
        wasConnected: socket.connected,
        timestamp: new Date().toISOString()
      });
      
      isInitializedRef.current = false;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (roomIdRef.current && socket.connected) {
        socket.emit('leaveChat', { roomId: roomIdRef.current });
      }
      
      if (stableCallbacks.current.onWebRTCSignal) {
        delete (window as any).videoChatEmitWebRTCSignal;
      }
      
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setIsConnecting(false);
    };
  }, []); // ✅ EMPTY DEPENDENCY ARRAY - This is the critical fix!

  // ✅ Stable emit functions with better error handling
  const emitFindPartner = useCallback((payload: {
    chatType: 'text' | 'video';
    interests: string[];
    authId?: string | null;
  }) => {
    if (!socketRef.current?.connected) {
      showChatToast.connectionError('Not connected to server');
      return false;
    }
    
    console.log('[ChatSocket Debug] 🔍 Finding partner with payload:', payload);
    socketRef.current.emit('findPartner', payload);
    return true;
  }, []);

  const emitMessage = useCallback((payload: {
    roomId: string;
    message: string;
    username?: string | null;
    authId?: string | null;
  }) => {
    if (!socketRef.current?.connected) {
      showChatToast.connectionError('Not connected to server');
      return false;
    }
    
    if (!roomIdRef.current) {
      showChatToast.messageError('Not in a chat room');
      return false;
    }
    
    console.log('[ChatSocket Debug] 📤 Sending message:', payload);
    socketRef.current.emit('sendMessage', {
      ...payload,
      roomId: roomIdRef.current
    });
    return true;
  }, []);

  const emitTypingStart = useCallback(() => {
    if (socketRef.current?.connected && roomIdRef.current) {
      socketRef.current.emit('typing_start', { roomId: roomIdRef.current });
    }
  }, []);

  const emitTypingStop = useCallback(() => {
    if (socketRef.current?.connected && roomIdRef.current) {
      socketRef.current.emit('typing_stop', { roomId: roomIdRef.current });
    }
  }, []);

  const emitLeaveChat = useCallback(() => {
    if (socketRef.current?.connected && roomIdRef.current) {
      console.log('[ChatSocket Debug] 🚪 Leaving chat room:', roomIdRef.current);
      socketRef.current.emit('leaveChat', { roomId: roomIdRef.current });
      roomIdRef.current = null;
      return true;
    }
    return false;
  }, []);

  const emitWebRTCSignal = useCallback((payload: {
    roomId: string;
    signalData: any;
  }) => {
    if (socketRef.current?.connected && roomIdRef.current) {
      console.log('[ChatSocket Debug] 📹 Emitting WebRTC signal:', payload.signalData.type || 'candidate');
      socketRef.current.emit('webrtcSignal', {
        roomId: roomIdRef.current,
        signalData: payload.signalData
      });
      return true;
    }
    return false;
  }, []);

  const emitUpdateStatus = useCallback((status: 'online' | 'idle' | 'dnd' | 'offline') => {
    if (socketRef.current?.connected && authId) {
      console.log('[ChatSocket Debug] 📊 Updating status:', status);
      socketRef.current.emit('updateStatus', { status });
      return true;
    }
    return false;
  }, [authId]);

  const getOnlineUserCount = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('getOnlineUserCount');
    }
  }, []);

  const forceReconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('[ChatSocket Debug] 🔄 Force reconnecting...');
      socketRef.current.disconnect();
      setTimeout(() => {
        socketRef.current?.connect();
      }, 1000);
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    connectionError,
    isConnecting,
    roomId: roomIdRef.current,
    emitFindPartner,
    emitMessage,
    emitTypingStart,
    emitTypingStop,
    emitLeaveChat,
    emitWebRTCSignal: stableCallbacks.current.onWebRTCSignal ? emitWebRTCSignal : undefined,
    emitUpdateStatus,
    getOnlineUserCount,
    forceReconnect
  };
}