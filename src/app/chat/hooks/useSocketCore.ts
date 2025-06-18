// src/app/chat/hooks/useSocketCore.ts - CRITICAL FIX FOR SOCKET CONNECTIONS
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
  const stabilityTracker = useRef({
    lastConnectionTime: 0,
    connectionCount: 0,
    stabilityTimer: null as NodeJS.Timeout | null
  });

  const createSocket = useCallback(() => {
    if (!socketServerUrl) {
      setState(prev => ({ ...prev, connectionError: 'Socket server URL not configured' }));
      return null;
    }

    console.log('[SocketCore] Creating socket connection');
    
    // ✅ CRITICAL FIX: Enhanced unique tab ID generation
    const tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 12)}-${performance.now()}`;
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 100) : 'unknown';
    
    const socket = io(socketServerUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,        // ✅ Increased from 1000ms
      reconnectionDelayMax: 8000,     // ✅ Increased from 5000ms
      timeout: 20000,
      forceNew: true,
      upgrade: true,
      rememberUpgrade: false,
      autoConnect: true,
      query: {
        tabId: tabId,
        timestamp: Date.now(),
        userAgent: userAgent,
        sessionId: `${Date.now()}-${Math.random()}`,
        clientId: `client-${Date.now()}`,
        connectionAttempt: connectionAttemptsRef.current
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
      
      // ✅ ENHANCED: Tab identification to prevent duplicate handling
      const tabId = socket.handshake.query.tabId as string;
      socket.emit('identify_tab', { 
        tabId,
        isReconnect: connectionAttemptsRef.current > 0,
        timestamp: Date.now(),
        userAgent: socket.handshake.query.userAgent
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

      // ✅ ENHANCED: Smart reconnection with exponential backoff
      if (reason === 'io server disconnect') {
        setState(prev => ({ ...prev, connectionError: 'Disconnected by server' }));
      } else if (reason === 'transport close' || reason === 'ping timeout') {
        if (connectionAttemptsRef.current < 3) {
          const delay = Math.min(2000 * Math.pow(2, connectionAttemptsRef.current), 10000);
          console.log(`[SocketCore] Scheduling reconnect in ${delay}ms (attempt ${connectionAttemptsRef.current + 1})`);
          
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

    // ✅ ENHANCED: Duplicate tab detection handler
    const handleDuplicateTab = (data: any) => {
      console.warn('[SocketCore] Duplicate tab detected:', data);
      setState(prev => ({ ...prev, connectionError: 'Chat opened in another tab' }));
      socket.disconnect();
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('duplicate_tab_detected', handleDuplicateTab);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('duplicate_tab_detected', handleDuplicateTab);
    };
  }, [onConnect, onDisconnect, onConnectError]);

  const initializeSocket = useCallback(() => {
    // ✅ CRITICAL FIX: Enhanced stability checking for React Strict Mode
    const now = Date.now();
    stabilityTracker.current.connectionCount++;
    
    // Detect rapid re-initialization (React Strict Mode)
    if (now - stabilityTracker.current.lastConnectionTime < 1000) {
      console.warn(`[SocketCore] Rapid re-initialization detected (${stabilityTracker.current.connectionCount})`);
      
      // Clear existing stability timer
      if (stabilityTracker.current.stabilityTimer) {
        clearTimeout(stabilityTracker.current.stabilityTimer);
      }
      
      // Wait for stability before creating socket
      stabilityTracker.current.stabilityTimer = setTimeout(() => {
        if (!isInitializedRef.current) {
          console.log('[SocketCore] Stability achieved, creating socket');
          createSocketConnection();
        }
      }, 1500);
      
      stabilityTracker.current.lastConnectionTime = now;
      return;
    }
    
    stabilityTracker.current.lastConnectionTime = now;
    createSocketConnection();

    function createSocketConnection() {
      // Prevent multiple socket instances
      if (isInitializedRef.current && socketRef.current) {
        console.log('[SocketCore] Socket already initialized');
        return;
      }

      // Clean up any existing socket first
      if (socketRef.current) {
        console.log('[SocketCore] Cleaning up existing socket');
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
    }
  }, [createSocket, setupSocketEvents]);

  const destroySocket = useCallback(() => {
    console.log('[SocketCore] Destroying socket');
    
    // Clear all timers
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (stabilityTracker.current.stabilityTimer) {
      clearTimeout(stabilityTracker.current.stabilityTimer);
      stabilityTracker.current.stabilityTimer = null;
    }
    
    // Cleanup socket
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
    stabilityTracker.current = {
      lastConnectionTime: 0,
      connectionCount: 0,
      stabilityTimer: null
    };
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

  // ✅ ENHANCED: Connection health check
  const getConnectionHealth = useCallback(() => {
    if (!socketRef.current) {
      return { healthy: false, reason: 'no_socket' };
    }

    if (!socketRef.current.connected) {
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
    socket: socketRef.current,
    ...state,
    initializeSocket,
    destroySocket,
    forceReconnect,
    getConnectionHealth
  };
};