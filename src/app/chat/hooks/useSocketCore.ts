// src/app/chat/hooks/useSocketCore.ts

import { useRef, useState, useCallback, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { generateDeviceFingerprint } from '@/lib/utils/fingerprint';
import { useStableCallback } from '@/hooks/useStableCallback';

interface SocketState {
  isConnected: boolean;
  connectionError: string | null;
  isConnecting: boolean;
  currentRoom: string | null;
}

interface UseSocketCoreOptions {
  socketServerUrl: string;
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

  const log = useCallback((message: string, ...args: any[]) => {
    if (debug) {
      console.log(`[SocketCore] ${message}`, ...args);
    }
  }, [debug]);

  // Stable event handlers
  const handleConnect = useStableCallback(() => {
    log('Connected');
    setState(prev => ({
      ...prev,
      isConnected: true,
      isConnecting: false,
      connectionError: null
    }));
    connectionAttemptsRef.current = 0;
    onConnect?.();
  });

  const handleDisconnect = useStableCallback((reason: string) => {
    log('Disconnected:', reason);
    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false
    }));
    onDisconnect?.(reason);
  });

  const handleError = useStableCallback((error: Error) => {
    log('Error:', error);
    setState(prev => ({
      ...prev,
      connectionError: error.message,
      isConnecting: false
    }));
    onConnectError?.(error);
  });

  // Socket creation with proper configuration
  const createSocket = useCallback(() => {
    if (!socketServerUrl || socketRef.current) return null;

    log('Creating socket connection');
    connectionAttemptsRef.current++;

    const socket = io(socketServerUrl, {
      withCredentials: true,
      transports: ['websocket'],
      reconnection: autoReconnect,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
      query: {
        clientId: generateDeviceFingerprint(),
        timestamp: Date.now(),
        attempt: connectionAttemptsRef.current
      }
    });

    return socket;
  }, [socketServerUrl, autoReconnect, log]);

  // Initialize socket connection
  useEffect(() => {
    mountedRef.current = true;

    const socket = createSocket();
    if (!socket) return;

    socketRef.current = socket;
    setState(prev => ({ ...prev, isConnecting: true }));

    // Register event handlers
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleError);

    // Cleanup function
    return () => {
      mountedRef.current = false;
      log('Cleaning up socket connection');

      // Execute all registered cleanup functions
      cleanupFunctionsRef.current.forEach(cleanup => cleanup());
      cleanupFunctionsRef.current = [];

      // Cleanup socket
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      setState({
        isConnected: false,
        isConnecting: false,
        connectionError: null,
        currentRoom: null
      });
    };
  }, [createSocket, handleConnect, handleDisconnect, handleError, log]);

  // Helper for registering event handlers with automatic cleanup
  const registerHandler = useCallback(<T extends any[]>(
    eventName: string,
    handler: (...args: T) => void
  ) => {
    if (!socketRef.current) return;

    const wrappedHandler = (...args: T) => {
      if (mountedRef.current) {
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
    isInitialized: Boolean(socketRef.current),
    emit: useCallback((...args: Parameters<Socket['emit']>) => {
      socketRef.current?.emit(...args);
    }, []),
    disconnect: useCallback(() => {
      socketRef.current?.disconnect();
    }, [])
  };
};