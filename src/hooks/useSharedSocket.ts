// src/hooks/useSharedSocket.ts - Hook to use shared socket manager
import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocketManager, type ConnectionState } from '@/lib/socketManager';

interface UseSharedSocketOptions {
  namespace: string; // Unique namespace for this hook's event handlers
  autoConnect?: boolean; // Whether to auto-connect on mount
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
}

interface UseSharedSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  socket: any; // Socket instance for compatibility
  emit: (event: string, data?: any) => boolean;
  on: (event: string, handler: (...args: any[]) => void) => () => void;
  connect: () => Promise<any>;
  forceReconnect: () => void;
  getState: () => ConnectionState;
}

export function useSharedSocket(options: UseSharedSocketOptions): UseSharedSocketReturn {
  const { namespace, autoConnect = true, onConnect, onDisconnect, onError } = options;
  
  const [state, setState] = useState<ConnectionState>({
    isConnected: false,
    isConnecting: false,
    connectionError: null,
    retryCount: 0,
    isCircuitOpen: false,
    lastConnectionAttempt: 0
  });

  // ✅ FIXED: Use refs to store callbacks to prevent useEffect re-runs
  const callbacksRef = useRef({ onConnect, onDisconnect, onError });
  callbacksRef.current = { onConnect, onDisconnect, onError };

  const socketManager = getSocketManager();
  const eventHandlers = new Map<string, (...args: any[]) => void>();

  // Register event handler with the socket manager
  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    // Store handler for cleanup
    eventHandlers.set(event, handler);
    
    // Register with socket manager
    return socketManager.registerHandler(namespace, event, handler);
  }, [socketManager, namespace]);

  // Emit event through socket manager
  const emit = useCallback((event: string, data?: any) => {
    return socketManager.emit(event, data);
  }, [socketManager]);

  // Connect to socket
  const connect = useCallback(async () => {
    try {
      const socket = await socketManager.connect();
      return socket;
    } catch (error) {
      console.error(`[useSharedSocket:${namespace}] Connection failed:`, error);
      throw error;
    }
  }, [socketManager, namespace]);

  // Force reconnect
  const forceReconnect = useCallback(() => {
    socketManager.forceReconnect();
  }, [socketManager]);

  // Get current state
  const getState = useCallback(() => {
    return socketManager.getState();
  }, [socketManager]);

  useEffect(() => {
    // Listen to socket manager state changes
    const unregisterStateListener = socketManager.onStateChange((newState) => {
      const prevState = state;
      setState(newState);

      // Trigger callbacks on state changes
      if (!prevState.isConnected && newState.isConnected) {
        console.log(`[useSharedSocket:${namespace}] Connected`);
        callbacksRef.current.onConnect?.();
      } else if (prevState.isConnected && !newState.isConnected) {
        console.log(`[useSharedSocket:${namespace}] Disconnected`);
        callbacksRef.current.onDisconnect?.();
      }

      if (newState.connectionError && newState.connectionError !== prevState.connectionError) {
        console.error(`[useSharedSocket:${namespace}] Error:`, newState.connectionError);
        callbacksRef.current.onError?.(newState.connectionError);
      }
    });

    // Auto-connect if requested
    if (autoConnect) {
      connect().catch((error) => {
        console.error(`[useSharedSocket:${namespace}] Auto-connect failed:`, error);
      });
    }

    // Cleanup
    return () => {
      console.log(`[useSharedSocket:${namespace}] Cleaning up`);
      
      // Unregister state listener
      unregisterStateListener();
      
      // Clean up any registered event handlers
      eventHandlers.clear();
    };
  }, [namespace, autoConnect, connect]); // ✅ FIXED: Remove callback dependencies to prevent constant reconnections

  return {
    isConnected: state.isConnected,
    isConnecting: state.isConnecting,
    connectionError: state.connectionError,
    socket: socketManager.getSocket(), // For compatibility with existing code
    emit,
    on,
    connect,
    forceReconnect,
    getState
  };
}

// Convenience hook for simple event listening
export function useSocketEvent(namespace: string, event: string, handler: (...args: any[]) => void, deps: any[] = []) {
  const { on } = useSharedSocket({ namespace, autoConnect: true });

  useEffect(() => {
    const unregister = on(event, handler);
    return unregister;
  }, [on, event, ...deps]);
}

// Convenience hook for emitting events
export function useSocketEmit(namespace: string) {
  const { emit, isConnected } = useSharedSocket({ namespace, autoConnect: true });
  
  return useCallback((event: string, data?: any) => {
    if (!isConnected) {
      console.warn(`[useSocketEmit:${namespace}] Cannot emit ${event} - not connected`);
      return false;
    }
    return emit(event, data);
  }, [emit, isConnected, namespace]);
}