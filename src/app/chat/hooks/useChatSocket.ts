// src/app/chat/hooks/useChatSocket.ts - COMPLETELY FIXED SOCKET CONNECTION

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSocketEvents } from './useSocketEvents';

interface SocketHandlers {
  onMessage: (data: any) => void;
  onPartnerFound: (data: any) => void;
  onPartnerLeft: () => void;
  onPartnerSkipped: (data: any) => void;
  onSkipConfirmed: (data: any) => void;
  onSearchStarted: (data: any) => void;
  onSearchStopped: (data: any) => void;
  onStatusChange: (status: string) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  onWaiting: (data: any) => void;
  onCooldown: (data: any) => void;
  onAlreadySearching: (data: any) => void;
  onSearchError: (data: any) => void;
  onDisconnectHandler?: () => void;
  onConnectErrorHandler?: () => void;
  authId: string | null;
}

interface UseChatSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  roomId: string | null;
  
  // Emit functions
  emitFindPartner: (data: any) => void;
  emitStopSearching: () => void;
  emitSkipPartner: () => void;
  emitLeaveChat: () => void;
  emitMessage: (data: any) => void;
  emitTypingStart: () => void;
  emitTypingStop: () => void;
  
  // Connection management
  reconnect: () => void;
  disconnect: () => void;
}

export const useChatSocket = (handlers: SocketHandlers): UseChatSocketReturn => {
  // Socket state
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);

  // Refs for state management
  const roomIdRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const isManualDisconnectRef = useRef(false);

  // Socket events handler
  const { setupEvents, cleanupEvents } = useSocketEvents(handlers);

  // ✅ CRITICAL: Enhanced socket connection with proper error handling
  const connectSocket = useCallback(() => {
    if (socket?.connected) {
      console.log('[ChatSocket] Already connected');
      return;
    }

    console.log('[ChatSocket] 🔌 Connecting to chat server...');
    setIsConnecting(true);
    setConnectionError(null);

    try {
      const newSocket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        retries: 3,
        auth: {
          authId: handlers.authId
        },
        query: {
          clientType: 'web',
          version: '1.0.0'
        }
      });

      // ✅ CRITICAL: Connection event handlers
      newSocket.on('connect', () => {
        console.log('[ChatSocket] ✅ Connected to server:', newSocket.id);
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;

        // Authenticate if we have authId
        if (handlers.authId) {
          newSocket.emit('authenticate', {
            authId: handlers.authId,
            clientInfo: {
              userAgent: navigator.userAgent,
              timestamp: Date.now()
            }
          });
        }
      });

      newSocket.on('disconnect', (reason: string) => {
        console.log('[ChatSocket] 🔌 Disconnected:', reason);
        setIsConnected(false);
        setIsConnecting(false);
        roomIdRef.current = null;
        setRoomId(null);
        
        if (handlers.onDisconnectHandler) {
          handlers.onDisconnectHandler();
        }

        // Auto-reconnect for non-manual disconnections
        if (!isManualDisconnectRef.current && reason !== 'io client disconnect') {
          handleReconnect();
        }
      });

      newSocket.on('connect_error', (error: any) => {
        console.error('[ChatSocket] ❌ Connection error:', error);
        setIsConnecting(false);
        setConnectionError(error.message || 'Connection failed');
        
        if (handlers.onConnectErrorHandler) {
          handlers.onConnectErrorHandler();
        }

        // Auto-reconnect on connection error
        if (!isManualDisconnectRef.current) {
          handleReconnect();
        }
      });

      // ✅ Setup all chat event handlers
      setupEvents(newSocket, roomIdRef);

      // ✅ Handle room state changes
      newSocket.on('roomJoined', (data: any) => {
        if (data?.roomId) {
          roomIdRef.current = data.roomId;
          setRoomId(data.roomId);
          console.log('[ChatSocket] 🏠 Joined room:', data.roomId);
        }
      });

      newSocket.on('roomLeft', (data: any) => {
        roomIdRef.current = null;
        setRoomId(null);
        console.log('[ChatSocket] 🏠 Left room:', data?.roomId);
      });

      // ✅ Handle authentication responses
      newSocket.on('authSuccess', (data: any) => {
        console.log('[ChatSocket] 🔐 Authentication successful:', data);
      });

      newSocket.on('authError', (data: any) => {
        console.error('[ChatSocket] ❌ Authentication failed:', data);
        setConnectionError('Authentication failed');
      });

      setSocket(newSocket);

    } catch (error) {
      console.error('[ChatSocket] ❌ Socket creation failed:', error);
      setIsConnecting(false);
      setConnectionError('Failed to create socket connection');
    }
  }, [socket, handlers.authId, setupEvents, handlers.onDisconnectHandler, handlers.onConnectErrorHandler]);

  // ✅ Reconnection logic with exponential backoff
  const handleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.log('[ChatSocket] 🚫 Max reconnection attempts reached');
      setConnectionError('Unable to connect after multiple attempts');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
    reconnectAttemptsRef.current++;

    console.log(`[ChatSocket] 🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      if (!isManualDisconnectRef.current) {
        connectSocket();
      }
    }, delay);
  }, [connectSocket]);

  // ✅ CRITICAL: Emit functions with proper error handling and validation
  const emitFindPartner = useCallback((data: any) => {
    if (!socket?.connected) {
      console.error('[ChatSocket] ❌ Cannot find partner - not connected');
      return;
    }

    console.log('[ChatSocket] 🔍 Emitting findPartner:', data);
    socket.emit('findPartner', {
      interests: data.interests || [],
      authId: data.authId,
      username: data.username,
      autoSearch: data.autoSearch || false,
      manualSearch: data.manualSearch || false,
      sessionId: data.sessionId,
      timestamp: Date.now()
    });
  }, [socket]);

  const emitStopSearching = useCallback(() => {
    if (!socket?.connected) {
      console.error('[ChatSocket] ❌ Cannot stop searching - not connected');
      return;
    }

    console.log('[ChatSocket] 🛑 Emitting stopSearching');
    socket.emit('stopSearching', {
      timestamp: Date.now()
    });
  }, [socket]);

  const emitSkipPartner = useCallback(() => {
    if (!socket?.connected) {
      console.error('[ChatSocket] ❌ Cannot skip partner - not connected');
      return;
    }

    if (!roomIdRef.current) {
      console.error('[ChatSocket] ❌ Cannot skip partner - not in room');
      return;
    }

    console.log('[ChatSocket] ⏭️ Emitting skipPartner for room:', roomIdRef.current);
    socket.emit('skipPartner', {
      roomId: roomIdRef.current,
      timestamp: Date.now()
    });
  }, [socket]);

  const emitLeaveChat = useCallback(() => {
    if (!socket?.connected) {
      console.error('[ChatSocket] ❌ Cannot leave chat - not connected');
      return;
    }

    console.log('[ChatSocket] 👋 Emitting leaveChat');
    socket.emit('leaveChat', {
      roomId: roomIdRef.current,
      timestamp: Date.now()
    });
    
    // Clear room immediately
    roomIdRef.current = null;
    setRoomId(null);
  }, [socket]);

  const emitMessage = useCallback((data: any) => {
    if (!socket?.connected) {
      console.error('[ChatSocket] ❌ Cannot send message - not connected');
      return;
    }

    if (!roomIdRef.current) {
      console.error('[ChatSocket] ❌ Cannot send message - not in room');
      return;
    }

    console.log('[ChatSocket] 📤 Emitting message to room:', roomIdRef.current);
    socket.emit('sendMessage', {
      message: data.message,
      roomId: roomIdRef.current,
      authId: data.authId,
      username: data.username,
      timestamp: Date.now()
    });
  }, [socket]);

  const emitTypingStart = useCallback(() => {
    if (!socket?.connected || !roomIdRef.current) return;
    
    socket.emit('typing_start', {
      roomId: roomIdRef.current,
      timestamp: Date.now()
    });
  }, [socket]);

  const emitTypingStop = useCallback(() => {
    if (!socket?.connected || !roomIdRef.current) return;
    
    socket.emit('typing_stop', {
      roomId: roomIdRef.current,
      timestamp: Date.now()
    });
  }, [socket]);

  // ✅ Manual reconnect function
  const reconnect = useCallback(() => {
    console.log('[ChatSocket] 🔄 Manual reconnect triggered');
    
    isManualDisconnectRef.current = false;
    reconnectAttemptsRef.current = 0;
    
    if (socket) {
      cleanupEvents(socket);
      socket.disconnect();
    }
    
    setSocket(null);
    setIsConnected(false);
    setConnectionError(null);
    
    setTimeout(connectSocket, 100);
  }, [socket, cleanupEvents, connectSocket]);

  // ✅ Manual disconnect function
  const disconnect = useCallback(() => {
    console.log('[ChatSocket] 🔌 Manual disconnect');
    
    isManualDisconnectRef.current = true;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (socket) {
      cleanupEvents(socket);
      socket.disconnect();
    }
    
    setSocket(null);
    setIsConnected(false);
    setIsConnecting(false);
    roomIdRef.current = null;
    setRoomId(null);
  }, [socket, cleanupEvents]);

  // ✅ Initialize socket connection
  useEffect(() => {
    connectSocket();
    
    return () => {
      isManualDisconnectRef.current = true;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (socket) {
        cleanupEvents(socket);
        socket.disconnect();
      }
    };
  }, []);

  // ✅ Update room state
  useEffect(() => {
    setRoomId(roomIdRef.current);
  }, []);

  return {
    socket,
    isConnected,
    isConnecting,
    connectionError,
    roomId,
    
    // Emit functions
    emitFindPartner,
    emitStopSearching,
    emitSkipPartner,
    emitLeaveChat,
    emitMessage,
    emitTypingStart,
    emitTypingStop,
    
    // Connection management
    reconnect,
    disconnect
  };
};