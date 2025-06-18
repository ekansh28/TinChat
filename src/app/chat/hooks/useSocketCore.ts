// ===== FIX 1: CLIENT-SIDE - Prevent Multiple Socket Connections =====
// src/app/chat/hooks/useSocketCore.ts - FIXED VERSION

import { useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketState {
  isConnected: boolean;
  connectionError: string | null;
  isConnecting: boolean;
}

interface UseSocketCoreParams {
  socketServerUrl: string | undefined;
  onConnect: () => void;
  onDisconnect: (reason: string) => void;
  onConnectError: (error: Error) => void;
}

export const useSocketCore = ({ 
  socketServerUrl, 
  onConnect, 
  onDisconnect, 
  onConnectError 
}: UseSocketCoreParams) => {
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<SocketState>({
    isConnected: false,
    connectionError: null,
    isConnecting: false
  });
  
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionAttemptsRef = useRef(0);
  const isInitializedRef = useRef(false);

  const createSocket = useCallback(() => {
    if (!socketServerUrl) {
      setState(prev => ({ ...prev, connectionError: 'Socket server URL not configured' }));
      return null;
    }

    console.log('[SocketCore] Creating socket connection');
    
    // ✅ CRITICAL FIX: Generate unique tab ID to prevent duplicate connections
    const tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const socket = io(socketServerUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true, // ✅ CRITICAL: Force new connection
      upgrade: true,
      rememberUpgrade: false,
      autoConnect: true,
      query: {
        tabId: tabId, // ✅ NEW: Send unique tab ID
        timestamp: Date.now()
      }
    });

    return socket;
  }, [socketServerUrl]);

  const setupSocketEvents = useCallback((socket: Socket) => {
    const handleConnect = () => {
      console.log('[SocketCore] Connected:', socket.id);
      setState({
        isConnected: true,
        isConnecting: false,
        connectionError: null
      });
      connectionAttemptsRef.current = 0;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // ✅ NEW: Identify this tab to prevent duplicate handling
      const tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      socket.emit('identify_tab', { 
        tabId,
        isReconnect: connectionAttemptsRef.current > 0 
      });
      
      onConnect();
    };

    const handleDisconnect = (reason: string) => {
      console.log('[SocketCore] Disconnected:', reason);
      setState(prev => ({
        ...prev,
        isConnected: false,
        isConnecting: false
      }));
      
      onDisconnect(reason);

      // Smart reconnection with backoff
      if (reason === 'io server disconnect') {
        setState(prev => ({ ...prev, connectionError: 'Disconnected by server' }));
      } else if (reason === 'transport close' || reason === 'ping timeout') {
        if (connectionAttemptsRef.current < 3) {
          const delay = Math.min(2000 * Math.pow(2, connectionAttemptsRef.current), 10000);
          console.log(`[SocketCore] Scheduling reconnect in ${delay}ms`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (!socketRef.current?.connected) {
              connectionAttemptsRef.current += 1;
              socket.connect();
            }
          }, delay);
        } else {
          setState(prev => ({ ...prev, connectionError: 'Connection lost - please refresh' }));
        }
      }
    };

    const handleConnectError = (err: Error) => {
      console.error('[SocketCore] Connection error:', err);
      setState({
        isConnected: false,
        isConnecting: false,
        connectionError: err.message
      });
      onConnectError(err);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
    };
  }, [onConnect, onDisconnect, onConnectError]);

  const initializeSocket = useCallback(() => {
    // ✅ CRITICAL FIX: Prevent multiple socket instances
    if (isInitializedRef.current && socketRef.current) {
      console.log('[SocketCore] Socket already initialized, reusing existing connection');
      return;
    }

    // ✅ CRITICAL FIX: Clean up any existing socket first
    if (socketRef.current) {
      console.log('[SocketCore] Cleaning up existing socket before creating new one');
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    isInitializedRef.current = true;
    setState(prev => ({ ...prev, isConnecting: true }));
    connectionAttemptsRef.current += 1;

    const socket = createSocket();
    if (!socket) return;

    socketRef.current = socket;
    const cleanup = setupSocketEvents(socket);

    return cleanup;
  }, [createSocket, setupSocketEvents]);

  const destroySocket = useCallback(() => {
    console.log('[SocketCore] Destroying socket');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    setState({
      isConnected: false,
      isConnecting: false,
      connectionError: null
    });
    
    isInitializedRef.current = false;
    connectionAttemptsRef.current = 0;
  }, []);

  const forceReconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('[SocketCore] Force reconnecting');
      socketRef.current.disconnect();
      setTimeout(() => {
        socketRef.current?.connect();
      }, 1000);
    }
  }, []);

  return {
    socket: socketRef.current,
    ...state,
    initializeSocket,
    destroySocket,
    forceReconnect
  };
};