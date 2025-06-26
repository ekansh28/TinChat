// src/app/chat/hooks/useChatSocket.ts - COMPLETE IMPLEMENTATION

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
  
  // Emit functions with proper signatures
  emitFindPartner: (data: {
    chatType?: 'text' | 'video';
    interests?: string[];
    authId?: string | null;
    username?: string | null;
    autoSearch?: boolean;
    manualSearch?: boolean;
    sessionId?: string;
  }) => void;
  emitStopSearching: () => void;
  emitSkipPartner: (data: {
    chatType?: 'text' | 'video';
    interests?: string[];
    authId?: string | null;
    reason?: string;
  }) => void;
  emitLeaveChat: () => void;
  emitMessage: (data: {
    message: string;
    authId?: string | null;
    username?: string | null;
  }) => void;
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
      const newSocket = io(process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:3001', {
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

      // ✅ Handle connection health events
      newSocket.on('ping', () => {
        newSocket.emit('pong');
      });

      newSocket.on('reconnect', (attemptNumber: number) => {
        console.log('[ChatSocket] 🔄 Reconnected after', attemptNumber, 'attempts');
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;
      });

      newSocket.on('reconnect_attempt', (attemptNumber: number) => {
        console.log('[ChatSocket] 🔄 Reconnect attempt', attemptNumber);
        setIsConnecting(true);
      });

      newSocket.on('reconnect_error', (error: any) => {
        console.error('[ChatSocket] ❌ Reconnect error:', error);
        setConnectionError('Reconnection failed: ' + error.message);
      });

      newSocket.on('reconnect_failed', () => {
        console.error('[ChatSocket] ❌ Reconnection failed after all attempts');
        setIsConnecting(false);
        setConnectionError('Unable to reconnect after multiple attempts');
      });

      // ✅ Handle server-side errors
      newSocket.on('error', (error: any) => {
        console.error('[ChatSocket] ❌ Server error:', error);
        setConnectionError('Server error: ' + (error.message || 'Unknown error'));
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

  // ✅ CRITICAL: Enhanced emit functions with proper parameters

  const emitFindPartner = useCallback((data: {
    chatType?: 'text' | 'video';
    interests?: string[];
    authId?: string | null;
    username?: string | null;
    autoSearch?: boolean;
    manualSearch?: boolean;
    sessionId?: string;
  }) => {
    if (!socket?.connected) {
      console.error('[ChatSocket] ❌ Cannot find partner - not connected');
      return;
    }

    console.log('[ChatSocket] 🔍 Emitting findPartner:', data);
    socket.emit('findPartner', {
      chatType: data.chatType || 'text', // ✅ Default to 'text'
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

  // ✅ CRITICAL: Fixed emitSkipPartner with proper parameters
  const emitSkipPartner = useCallback((data: {
    chatType?: 'text' | 'video';
    interests?: string[];
    authId?: string | null;
    reason?: string;
  }) => {
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
      chatType: data.chatType || 'text', // ✅ Include chatType
      interests: data.interests || [],
      authId: data.authId,
      reason: data.reason || 'skip',
      autoSearchForSkipper: true, // ✅ Only auto-search for the person who skipped
      skipperAuthId: data.authId, // ✅ Identify who initiated the skip
      timestamp: Date.now()
    });
    
    // Clear room ID since we're leaving
    roomIdRef.current = null;
    setRoomId(null);
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

  const emitMessage = useCallback((data: {
    message: string;
    authId?: string | null;
    username?: string | null;
  }) => {
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

  // ✅ Additional emit functions for advanced features
  const emitUpdateProfile = useCallback((profileData: any) => {
    if (!socket?.connected) return;
    
    socket.emit('updateProfile', {
      ...profileData,
      timestamp: Date.now()
    });
  }, [socket]);

  const emitHeartbeat = useCallback(() => {
    if (!socket?.connected) return;
    
    socket.emit('heartbeat', {
      timestamp: Date.now(),
      clientId: socket.id
    });
  }, [socket]);

  const emitReportUser = useCallback((data: {
    reportedAuthId: string;
    reason: string;
    description?: string;
  }) => {
    if (!socket?.connected) return;
    
    socket.emit('reportUser', {
      ...data,
      roomId: roomIdRef.current,
      reporterAuthId: handlers.authId,
      timestamp: Date.now()
    });
  }, [socket, handlers.authId]);

  // ✅ Manual reconnect function
  const reconnect = useCallback(() => {
    console.log('[ChatSocket] 🔄 Manual reconnect triggered');
    
    isManualDisconnectRef.current = false;
    reconnectAttemptsRef.current = 0;
    
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

  // ✅ Check connection health periodically
  useEffect(() => {
    if (!socket?.connected) return;

    const healthCheckInterval = setInterval(() => {
      if (socket?.connected) {
        emitHeartbeat();
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(healthCheckInterval);
  }, [socket?.connected, emitHeartbeat]);

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

  // ✅ Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('[ChatSocket] Page hidden - maintaining connection');
      } else {
        console.log('[ChatSocket] Page visible - checking connection health');
        if (socket && !socket.connected && !isManualDisconnectRef.current) {
          console.log('[ChatSocket] Detected stale connection, reconnecting...');
          reconnect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [socket, reconnect]);

  // ✅ Handle network status changes
  useEffect(() => {
    const handleOnline = () => {
      console.log('[ChatSocket] Network back online');
      if (!socket?.connected && !isManualDisconnectRef.current) {
        reconnect();
      }
    };

    const handleOffline = () => {
      console.log('[ChatSocket] Network went offline');
      setConnectionError('Network connection lost');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [socket, reconnect]);

  return {
    socket,
    isConnected,
    isConnecting,
    connectionError,
    roomId,
    
    // Emit functions with proper parameters
    emitFindPartner,
    emitStopSearching,
    emitSkipPartner, // ✅ Now accepts parameters
    emitLeaveChat,
    emitMessage,
    emitTypingStart,
    emitTypingStop,
    
    // Connection management
    reconnect,
    disconnect
  };
};