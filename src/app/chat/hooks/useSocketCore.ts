// src/app/chat/hooks/useSocketCore.ts - MIGRATED TO SHARED SOCKET MANAGER

import { useRef, useState, useCallback, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { useSharedSocket } from '@/hooks/useSharedSocket';

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

export const useSocketCore = (options: UseSocketCoreOptions) => {
  const { onConnect, onDisconnect, onConnectError, debug = false } = options;
  
  const cleanupFunctionsRef = useRef<(() => void)[]>([]);
  const mountedRef = useRef(false);

  const log = useCallback((message: string, ...args: any[]) => {
    if (debug) {
      console.log(`[SocketCore] ${message}`, ...args);
    }
  }, [debug]);

  // Use shared socket manager
  const sharedSocket = useSharedSocket({
    namespace: 'chatCore',
    autoConnect: true,
    onConnect: () => {
      log('Connected to shared socket');
      onConnect?.();
    },
    onDisconnect: () => {
      log('Disconnected from shared socket');
      onDisconnect?.('shared socket disconnect');
    },
    onError: (error) => {
      log('Shared socket error:', error);
      onConnectError?.(new Error(error));
    }
  });

  // Mount effect
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Execute cleanup functions
      cleanupFunctionsRef.current.forEach(cleanup => {
        try {
          cleanup();
        } catch (err) {
          log('Error in cleanup function:', err);
        }
      });
      cleanupFunctionsRef.current = [];
    };
  }, []);

  // Register handler with cleanup tracking
  const registerHandler = useCallback(<T extends any[]>(
    eventName: string,
    handler: (...args: T) => void
  ) => {
    if (!mountedRef.current) {
      log('Cannot register handler - component not mounted:', eventName);
      return;
    }

    const wrappedHandler = (...args: T) => {
      if (mountedRef.current) {
        try {
          handler(...args);
        } catch (err) {
          log('Error in event handler', eventName, ':', err);
        }
      }
    };

    const unregister = sharedSocket.on(eventName, wrappedHandler);
    cleanupFunctionsRef.current.push(unregister);
    log('Registered event handler:', eventName);
  }, [log, sharedSocket]);

  // Initialize socket - simplified
  const initializeSocket = useCallback(() => {
    log('Socket initialization handled by shared socket manager');
    return () => {
      log('Cleanup handled by shared socket manager');
    };
  }, [log]);

  // Force reconnect
  const forceReconnect = useCallback(() => {
    log('Force reconnecting...');
    sharedSocket.forceReconnect();
  }, [log, sharedSocket]);

  // Destroy socket
  const destroySocket = useCallback(() => {
    log('Destroying socket connection');
    cleanupFunctionsRef.current.forEach(cleanup => {
      try {
        cleanup();
      } catch (err) {
        log('Error in cleanup function:', err);
      }
    });
    cleanupFunctionsRef.current = [];
  }, [log]);

  // Emit function
  const emit = useCallback((...args: Parameters<Socket['emit']>) => {
    return sharedSocket.emit(...args);
  }, [sharedSocket]);

  // Disconnect function
  const disconnect = useCallback(() => {
    // For compatibility - shared socket handles connection lifecycle
    log('Disconnect requested - handled by shared socket manager');
  }, [log]);

  // Expose simplified API that matches the original
  return {
    socket: sharedSocket.socket,
    isConnected: sharedSocket.isConnected,
    connectionError: sharedSocket.connectionError,
    isConnecting: sharedSocket.isConnecting,
    isInitialized: sharedSocket.isConnected, // For compatibility
    registerHandler,
    initializeSocket,
    forceReconnect,
    destroySocket,
    emit,
    disconnect
  };
};