// src/app/chat/hooks/useSocketCore.ts - FIXED VERSION

import { useRef, useState, useCallback, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { generateDeviceFingerprint } from '@/lib/fingerprint';
import { useStableCallback } from '@/hooks/useStableCallback';

interface SocketState {
  isConnected: boolean;
  connectionError: string | null;
  isConnecting: boolean;
  currentRoom: string | null;
}

interface UseSocketCoreOptions {
  socketServerUrl?: string;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onConnectError?: (error: Error) => void;
  autoReconnect?: boolean;
  debug?: boolean;
}

export const useSocketCore = ({
  socketServerUrl,
  onConnect,
  onDisconnect,
  onConnectError,
  autoReconnect = true,
  debug = false
}: UseSocketCoreOptions) => {
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<SocketState>({
    isConnected: false,
    connectionError: null,
    isConnecting: false,
    currentRoom: null
  });

  const connectionAttemptsRef = useRef(0);
  const mountedRef = useRef(false);
  const cleanupFunctionsRef = useRef<(() => void)[]>([]);
  const initializationRef = useRef({ isInitialized: false, isDestroyed: false });

  const log = useCallback((message: string, ...args: any[]) => {
    if (debug) {
      console.log(`[SocketCore] ${message}`, ...args);
    }
  }, [debug]);

  // Stable event handlers
  const handleConnect = useStableCallback(() => {
    log('Connected');
    if (mountedRef.current && !initializationRef.current.isDestroyed) {
      setState(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        connectionError: null
      }));
      connectionAttemptsRef.current = 0;
      onConnect?.();
    }
  });

  const handleDisconnect = useStableCallback((reason: string) => {
    log('Disconnected:', reason);
    if (mountedRef.current && !initializationRef.current.isDestroyed) {
      setState(prev => ({
        ...prev,
        isConnected: false,
        isConnecting: false
      }));
      onDisconnect?.(reason);
    }
  });

  const handleError = useStableCallback((error: Error) => {
    log('Error:', error);
    if (mountedRef.current && !initializationRef.current.isDestroyed) {
      setState(prev => ({
        ...prev,
        connectionError: error.message,
        isConnecting: false
      }));
      onConnectError?.(error);
    }
  });

  // Socket creation with proper configuration
  const createSocket = useCallback(() => {
    if (!socketServerUrl || socketRef.current || initializationRef.current.isDestroyed) {
      return null;
    }

    log('Creating socket connection');
    connectionAttemptsRef.current++;

    const socket = io(socketServerUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: autoReconnect,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
      forceNew: true,
      query: {
        clientId: generateDeviceFingerprint(),
        timestamp: Date.now(),
        attempt: connectionAttemptsRef.current
      }
    });

    return socket;
  }, [socketServerUrl, autoReconnect, log]);

  // Initialize socket function
  const initializeSocket = useCallback(() => {
    if (initializationRef.current.isInitialized || initializationRef.current.isDestroyed) {
      return;
    }

    const socket = createSocket();
    if (!socket) return;

    socketRef.current = socket;
    initializationRef.current.isInitialized = true;

    if (mountedRef.current && !initializationRef.current.isDestroyed) {
      setState(prev => ({ ...prev, isConnecting: true }));
    }

    // Register event handlers
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleError);

    return () => {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      initializationRef.current.isInitialized = false;
    };
  }, [createSocket, handleConnect, handleDisconnect, handleError]);

  // Force reconnect function
  const forceReconnect = useCallback(() => {
    log('Force reconnecting...');
    
    // Clean up existing connection
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    initializationRef.current.isInitialized = false;
    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      connectionError: null
    }));

    // Reinitialize after a delay
    setTimeout(() => {
      if (mountedRef.current && !initializationRef.current.isDestroyed) {
        initializeSocket();
      }
    }, 1000);
  }, [initializeSocket, log]);

  // Destroy socket function
  const destroySocket = useCallback(() => {
    log('Destroying socket connection');
    initializationRef.current.isDestroyed = true;

    // Execute all registered cleanup functions
    cleanupFunctionsRef.current.forEach(cleanup => cleanup());
    cleanupFunctionsRef.current = [];

    // Cleanup socket
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    initializationRef.current.isInitialized = false;

    if (mountedRef.current) {
      setState({
        isConnected: false,
        isConnecting: false,
        connectionError: null,
        currentRoom: null
      });
    }
  }, [log]);

  // Initialize on mount
  useEffect(() => {
    mountedRef.current = true;
    initializationRef.current.isDestroyed = false;

    return () => {
      mountedRef.current = false;
      destroySocket();
    };
  }, [destroySocket]);

  // Helper for registering event handlers with automatic cleanup
  const registerHandler = useCallback(<T extends any[]>(
    eventName: string,
    handler: (...args: T) => void
  ) => {
    if (!socketRef.current || initializationRef.current.isDestroyed) return;

    const wrappedHandler = (...args: T) => {
      if (mountedRef.current && !initializationRef.current.isDestroyed) {
        handler(...args);
      }
    };

    socketRef.current.on(eventName, wrappedHandler);
    cleanupFunctionsRef.current.push(() => {
      socketRef.current?.off(eventName, wrappedHandler);
    });
  }, []);

  // Expose a clean API
  return {
    socket: socketRef.current,
    ...state,
    registerHandler,
    isInitialized: initializationRef.current.isInitialized,
    initializeSocket,
    forceReconnect,
    destroySocket,
    emit: useCallback((...args: Parameters<Socket['emit']>) => {
      if (socketRef.current?.connected && !initializationRef.current.isDestroyed) {
        socketRef.current.emit(...args);
      }
    }, []),
    disconnect: useCallback(() => {
      socketRef.current?.disconnect();
    }, [])
  };
};