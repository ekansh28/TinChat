// src/app/chat/hooks/useChatSocket.ts - COMPLETELY FIXED VERSION
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
  const cleanupFunctionsRef = useRef<Array<() => void>>([]);

  // ✅ CRITICAL FIX: Store all handlers in a single stable ref
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

  // ✅ Update handlers ref when they change (without triggering socket recreation)
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

  // ✅ Update room ID ref
  useEffect(() => {
    roomIdRef.current = roomId || null;
  }, [roomId]);

  // ✅ CRITICAL FIX: Completely rewritten socket initialization
  useEffect(() => {
    // Prevent multiple initializations
    if (isInitializedRef.current) {
      console.log('[ChatSocket] Already initialized, skipping');
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
    
    isInitializedRef.current = true;
    setIsConnecting(true);
    connectionAttemptsRef.current += 1;

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

    // ✅ Set up WebRTC signal emission function
    if (handlersRef.current.onWebRTCSignal) {
      (window as any).videoChatEmitWebRTCSignal = (data: any) => {
        if (socket.connected && roomIdRef.current) {
          socket.emit('webrtcSignal', {
            roomId: roomIdRef.current,
            signalData: data.signalData
          });
        }
      };
      
      cleanupFunctionsRef.current.push(() => {
        delete (window as any).videoChatEmitWebRTCSignal;
      });
    }

    // ✅ Connection events with proper error handling
    const handleConnect = () => {
      console.log('[ChatSocket] ✅ Connected:', socket.id);
      setIsConnected(true);
      setIsConnecting(false);
      setConnectionError(null);
      connectionAttemptsRef.current = 0;
      
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

      if (reason === 'io server disconnect') {
        console.log('[ChatSocket] Server disconnected us, not attempting reconnect');
      } else if (connectionAttemptsRef.current < 5) {
        const delay = Math.min(1000 * Math.pow(2, connectionAttemptsRef.current), 30000);
        console.log(`[ChatSocket] Scheduling reconnect in ${delay}ms...`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!socketRef.current?.connected) {
            console.log('[ChatSocket] Attempting manual reconnect...');
            socket.connect();
          }
        }, delay);
      }
    };

    const handleConnectError = (err: Error) => {
      console.error('[ChatSocket] 🚫 Connection error:', err);
      setIsConnected(false);
      setIsConnecting(false);
      setConnectionError(err.message);
      
      handlersRef.current.onConnectErrorHandler(err);
    };

    // ✅ Chat events using handler refs
    const handlePartnerFound = (data: any) => {
      console.log('[ChatSocket] 🎯 Partner found:', { partnerId: data.partnerId, roomId: data.roomId });
      roomIdRef.current = data.roomId;
      handlersRef.current.onPartnerFound(data);
    };

    const handleReceiveMessage = (data: any) => {
      console.log('[ChatSocket] 💬 Message received:', { senderId: data.senderId, message: data.message });
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

    if (handlersRef.current.onWebRTCSignal) {
      socket.on('webrtcSignal', handleWebRTCSignal);
    }

    // ✅ Store cleanup function
    const cleanup = () => {
      console.log('[ChatSocket] 🧹 Cleaning up socket connection', {
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
      
      // Run all cleanup functions
      cleanupFunctionsRef.current.forEach(cleanupFn => {
        try {
          cleanupFn();
        } catch (error) {
          console.error('[ChatSocket] Cleanup function error:', error);
        }
      });
      cleanupFunctionsRef.current = [];
      
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setIsConnecting(false);
    };

    cleanupFunctionsRef.current.push(cleanup);

    // Return cleanup function
    return cleanup;
  }, []); // ✅ CRITICAL: Empty dependency array - only initialize once

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
    
    console.log('[ChatSocket] 📤 Sending message:', payload);
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
    }
  }, []);

  const forceReconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('[ChatSocket] 🔄 Force reconnecting...');
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
    emitWebRTCSignal: handlersRef.current.onWebRTCSignal ? emitWebRTCSignal : undefined,
    emitUpdateStatus,
    getOnlineUserCount,
    forceReconnect
  };
}