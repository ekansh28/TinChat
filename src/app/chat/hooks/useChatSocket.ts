// src/app/chat/hooks/useChatSocket.ts - COMPLETELY FIXED VERSION
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { showChatToast } from '../utils/ChatHelpers';

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
  // ✅ CRITICAL FIX: Single socket reference with proper lifecycle management
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // ✅ CRITICAL FIX: Stable state tracking
  const roomIdRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionAttemptsRef = useRef(0);
  const initializationStateRef = useRef({
    isInitialized: false,
    isDestroying: false,
    socketId: null as string | null
  });

  // ✅ CRITICAL FIX: Stable handler references
  const handlersRef = useRef({
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

  // ✅ Update handlers without triggering socket recreation
  useEffect(() => {
    handlersRef.current = {
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
  });

  // ✅ Update room ID reference
  useEffect(() => {
    roomIdRef.current = roomId || null;
  }, [roomId]);

  // ✅ CRITICAL FIX: Complete socket initialization with proper error handling
  const initializeSocket = useCallback(() => {
    // Prevent multiple initializations
    if (initializationStateRef.current.isInitialized || 
        initializationStateRef.current.isDestroying) {
      console.log('[ChatSocket] Initialization blocked - already initialized or destroying');
      return;
    }

    const socketServerUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL;
    
    if (!socketServerUrl) {
      const error = 'Socket server URL not configured';
      console.error('[ChatSocket] Error:', error);
      setConnectionError(error);
      return;
    }

    console.log('[ChatSocket] Initializing connection to:', socketServerUrl);
    
    initializationStateRef.current.isInitialized = true;
    setIsConnecting(true);
    connectionAttemptsRef.current += 1;

    // ✅ Enhanced socket configuration
    const socket = io(socketServerUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true,
      upgrade: true,
      rememberUpgrade: false,
      autoConnect: true
    });
    
    socketRef.current = socket;
    initializationStateRef.current.socketId = socket.id;

    // ✅ Set up WebRTC signal emission function for video chat integration
    if (handlersRef.current.onWebRTCSignal) {
      (window as any).videoChatEmitWebRTCSignal = (data: any) => {
        if (socket.connected && roomIdRef.current) {
          socket.emit('webrtcSignal', {
            roomId: roomIdRef.current,
            signalData: data.signalData
          });
        }
      };
    }

    // ✅ CONNECTION EVENT HANDLERS
    const handleConnect = () => {
      console.log('[ChatSocket] ✅ Connected:', socket.id);
      setIsConnected(true);
      setIsConnecting(false);
      setConnectionError(null);
      connectionAttemptsRef.current = 0;
      initializationStateRef.current.socketId = socket.id;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    const handleDisconnect = (reason: string) => {
      console.log('[ChatSocket] ❌ Disconnected:', reason);
      setIsConnected(false);
      setIsConnecting(false);
      roomIdRef.current = null;
      
      handlersRef.current.onDisconnectHandler(reason);

      // ✅ Smart reconnection logic
      if (reason === 'io server disconnect') {
        console.log('[ChatSocket] Server disconnected us, not attempting reconnect');
        setConnectionError('Disconnected by server');
      } else if (reason === 'transport close' || reason === 'ping timeout') {
        if (connectionAttemptsRef.current < 3 && !initializationStateRef.current.isDestroying) {
          const delay = Math.min(2000 * Math.pow(2, connectionAttemptsRef.current), 10000);
          console.log(`[ChatSocket] Scheduling reconnect in ${delay}ms...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (!socketRef.current?.connected && !initializationStateRef.current.isDestroying) {
              console.log('[ChatSocket] Attempting manual reconnect...');
              connectionAttemptsRef.current += 1;
              socket.connect();
            }
          }, delay);
        } else {
          setConnectionError('Connection lost - please refresh');
        }
      }
    };

    const handleConnectError = (err: Error) => {
      console.error('[ChatSocket] 🚫 Connection error:', err);
      setIsConnected(false);
      setIsConnecting(false);
      setConnectionError(err.message);
      
      handlersRef.current.onConnectErrorHandler(err);
    };

    // ✅ CHAT EVENT HANDLERS using stable handler references
    const handlePartnerFound = (data: any) => {
      console.log('[ChatSocket] 🎯 Partner found:', { partnerId: data.partnerId, roomId: data.roomId });
      roomIdRef.current = data.roomId;
      handlersRef.current.onPartnerFound(data);
    };

    const handleReceiveMessage = (data: any) => {
      console.log('[ChatSocket] 💬 Message received:', { senderId: data.senderId });
      handlersRef.current.onMessage(data);
    };

    const handlePartnerLeft = () => {
      console.log('[ChatSocket] 👋 Partner left');
      roomIdRef.current = null;
      handlersRef.current.onPartnerLeft();
    };

    const handlePartnerStatusChanged = (data: any) => {
      console.log('[ChatSocket] 📊 Partner status changed:', data.status);
      handlersRef.current.onStatusChange(data.status);
    };

    const handleWebRTCSignal = (data: any) => {
      console.log('[ChatSocket] 📹 WebRTC signal received:', data.signalData?.type || 'candidate');
      handlersRef.current.onWebRTCSignal?.(data.signalData);
    };

    const handleTypingStart = () => handlersRef.current.onTypingStart();
    const handleTypingStop = () => handlersRef.current.onTypingStop();
    const handleWaitingForPartner = () => handlersRef.current.onWaiting();
    const handleFindPartnerCooldown = () => handlersRef.current.onCooldown();

    const handleOnlineUserCountUpdate = (count: number) => {
      console.log('[ChatSocket] 👥 Online users:', count);
    };

    const handleError = (error: any) => {
      console.error('[ChatSocket] 🚨 Socket error:', error);
      setConnectionError(error.message || 'Socket error occurred');
    };

    // ✅ BATCH MESSAGE HANDLING for improved performance
    const handleBatchedMessages = (messages: Array<{ event: string; data: any }>) => {
      messages.forEach(({ event, data }) => {
        switch (event) {
          case 'receiveMessage':
            handleReceiveMessage(data);
            break;
          case 'partnerStatusChanged':
            handlePartnerStatusChanged(data);
            break;
          case 'partner_typing_start':
            handleTypingStart();
            break;
          case 'partner_typing_stop':
            handleTypingStop();
            break;
          default:
            console.log('[ChatSocket] Unknown batched event:', event);
        }
      });
    };

    // ✅ Attach all event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('partnerFound', handlePartnerFound);
    socket.on('receiveMessage', handleReceiveMessage);
    socket.on('partnerLeft', handlePartnerLeft);
    socket.on('partnerStatusChanged', handlePartnerStatusChanged);
    socket.on('partner_typing_start', handleTypingStart);
    socket.on('partner_typing_stop', handleTypingStop);
    socket.on('waitingForPartner', handleWaitingForPartner);
    socket.on('findPartnerCooldown', handleFindPartnerCooldown);
    socket.on('onlineUserCountUpdate', handleOnlineUserCountUpdate);
    socket.on('error', handleError);
    socket.on('batchedMessages', handleBatchedMessages);

    // ✅ WebRTC signal handling if available
    if (handlersRef.current.onWebRTCSignal) {
      socket.on('webrtcSignal', handleWebRTCSignal);
    }

    // ✅ Enhanced heartbeat handling
    socket.on('heartbeat', (data) => {
      console.log('[ChatSocket] 💓 Heartbeat received:', data.onlineCount);
      socket.emit('heartbeat_response', {
        clientTime: Date.now(),
        received: data.timestamp
      });
    });

    // ✅ Connection health monitoring
    socket.on('connection_warning', (data) => {
      console.warn('[ChatSocket] ⚠️ Connection warning:', data);
      if (data.type === 'stale_connection') {
        // Emit health report
        socket.emit('connection_health', {
          latency: Date.now() - data.timestamp,
          clientTime: Date.now()
        });
      }
    });

    return socket;
  }, []);

  // ✅ CRITICAL FIX: Clean socket destruction
  const destroySocket = useCallback(() => {
    if (initializationStateRef.current.isDestroying) {
      console.log('[ChatSocket] Already destroying, skipping');
      return;
    }

    console.log('[ChatSocket] 🧹 Destroying socket connection');
    initializationStateRef.current.isDestroying = true;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (socketRef.current) {
      // Leave current room before disconnecting
      if (roomIdRef.current) {
        socketRef.current.emit('leaveChat', { roomId: roomIdRef.current });
        roomIdRef.current = null;
      }
      
      // Clean up global functions
      delete (window as any).videoChatEmitWebRTCSignal;
      
      // Remove all listeners and disconnect
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    // Reset state
    setIsConnected(false);
    setIsConnecting(false);
    setConnectionError(null);
    
    // Reset refs
    initializationStateRef.current = {
      isInitialized: false,
      isDestroying: false,
      socketId: null
    };
    connectionAttemptsRef.current = 0;
    
    console.log('[ChatSocket] ✅ Socket destruction complete');
  }, []);

  // ✅ CRITICAL FIX: Single initialization effect
  useEffect(() => {
    console.log('[ChatSocket] Initialization effect triggered');
    
    // Initialize socket
    const socket = initializeSocket();
    
    // Return cleanup function
    return () => {
      destroySocket();
    };
  }, []); // ✅ Empty dependency array - initialize only once

  // ✅ STABLE EMIT FUNCTIONS with comprehensive error handling
  const emitFindPartner = useCallback((payload: {
    chatType: 'text' | 'video';
    interests: string[];
    authId?: string | null;
  }) => {
    if (!socketRef.current?.connected) {
      showChatToast.connectionError('Not connected to server');
      return false;
    }
    
    console.log('[ChatSocket] 🔍 Finding partner with payload:', payload);
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
    
    console.log('[ChatSocket] 📤 Sending message:', payload.message.substring(0, 50));
    socketRef.current.emit('sendMessage', {
      ...payload,
      roomId: roomIdRef.current
    });
    return true;
  }, []);

  const emitTypingStart = useCallback(() => {
    if (socketRef.current?.connected && roomIdRef.current) {
      socketRef.current.emit('typing_start', { roomId: roomIdRef.current });
      return true;
    }
    return false;
  }, []);

  const emitTypingStop = useCallback(() => {
    if (socketRef.current?.connected && roomIdRef.current) {
      socketRef.current.emit('typing_stop', { roomId: roomIdRef.current });
      return true;
    }
    return false;
  }, []);

  const emitLeaveChat = useCallback(() => {
    if (socketRef.current?.connected && roomIdRef.current) {
      console.log('[ChatSocket] 🚪 Leaving chat room:', roomIdRef.current);
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
      console.log('[ChatSocket] 📹 Emitting WebRTC signal:', payload.signalData.type || 'candidate');
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
      console.log('[ChatSocket] 📊 Updating status:', status);
      socketRef.current.emit('updateStatus', { status });
      return true;
    }
    return false;
  }, [authId]);

  const getOnlineUserCount = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('getOnlineUserCount');
      return true;
    }
    return false;
  }, []);

  const forceReconnect = useCallback(() => {
    if (socketRef.current && !initializationStateRef.current.isDestroying) {
      console.log('[ChatSocket] 🔄 Force reconnecting...');
      socketRef.current.disconnect();
      setTimeout(() => {
        if (!initializationStateRef.current.isDestroying) {
          socketRef.current?.connect();
        }
      }, 1000);
      return true;
    }
    return false;
  }, []);

  // ✅ Debug and monitoring functions
  const getConnectionInfo = useCallback(() => {
    return {
      isConnected,
      isConnecting,
      connectionError,
      socketId: socketRef.current?.id || null,
      roomId: roomIdRef.current,
      transport: socketRef.current?.io.engine.transport.name || null,
      connectionAttempts: connectionAttemptsRef.current,
      isInitialized: initializationStateRef.current.isInitialized,
      isDestroying: initializationStateRef.current.isDestroying
    };
  }, [isConnected, isConnecting, connectionError]);

  const emitDebugRequest = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('getDebugInfo');
      return true;
    }
    return false;
  }, []);

  // ✅ Enhanced connection health check
  const checkConnectionHealth = useCallback(() => {
    if (!socketRef.current?.connected) {
      return { healthy: false, reason: 'not_connected' };
    }

    const lastPong = (socketRef.current as any).conn?.lastPong;
    const now = Date.now();
    const timeSinceLastPong = lastPong ? now - lastPong : 0;

    if (timeSinceLastPong > 90000) { // 90 seconds
      return { healthy: false, reason: 'stale_connection', timeSinceLastPong };
    }

    return { healthy: true, timeSinceLastPong };
  }, []);

  return {
    // Connection state
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
    emitWebRTCSignal: handlersRef.current.onWebRTCSignal ? emitWebRTCSignal : undefined,
    emitUpdateStatus,
    getOnlineUserCount,
    
    // Utility functions
    forceReconnect,
    destroySocket,
    getConnectionInfo,
    emitDebugRequest,
    checkConnectionHealth
  };
}