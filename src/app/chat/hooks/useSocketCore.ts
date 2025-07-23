// src/app/chat/hooks/useSocketCore.ts - FIXED VERSION TO PREVENT DUPLICATES

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
  
  // ✅ CRITICAL FIX: Enhanced initialization tracking to prevent duplicates
  const initializationRef = useRef({ 
    isInitialized: false, 
    isDestroyed: false,
    isCreating: false,  // NEW: Prevent concurrent creation
    lastConnectionId: null as string | null  // NEW: Track connection instances
  });

  const log = useCallback((message: string, ...args: any[]) => {
    if (debug) {
      console.log(`[SocketCore] ${message}`, ...args);
    }
  }, [debug]);

  // Stable event handlers
  const handleConnect = useStableCallback(() => {
    const socketId = socketRef.current?.id;
    log('Connected with socket ID:', socketId);
    
    if (mountedRef.current && !initializationRef.current.isDestroyed) {
      // ✅ CRITICAL FIX: Track this connection instance
      initializationRef.current.lastConnectionId = socketId || null;
      
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
    const socketId = socketRef.current?.id;
    log('Disconnected:', reason, 'Socket ID:', socketId);
    
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
    
    // ✅ CRITICAL FIX: Reset creation flag on error
    initializationRef.current.isCreating = false;
    
    if (mountedRef.current && !initializationRef.current.isDestroyed) {
      setState(prev => ({
        ...prev,
        connectionError: error.message,
        isConnecting: false
      }));
      onConnectError?.(error);
    }
  });

  // ✅ CRITICAL FIX: Enhanced socket creation with duplicate prevention
  const createSocket = useCallback(() => {
    if (!socketServerUrl || initializationRef.current.isDestroyed) {
      return null;
    }

    // ✅ PREVENT DUPLICATE CREATION
    if (initializationRef.current.isCreating) {
      log('Socket creation already in progress, skipping...');
      return null;
    }

    // ✅ CHECK FOR EXISTING CONNECTED SOCKET
    if (socketRef.current?.connected) {
      log('Socket already connected, skipping creation');
      return socketRef.current;
    }

    // ✅ CLEANUP ANY EXISTING DISCONNECTED SOCKET
    if (socketRef.current && !socketRef.current.connected) {
      log('Cleaning up existing disconnected socket');
      try {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
      } catch (err) {
        log('Error cleaning up old socket:', err);
      }
      socketRef.current = null;
    }

    log('Creating new socket connection');
    initializationRef.current.isCreating = true;
    connectionAttemptsRef.current++;

    const connectionId = `${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
    
    try {
      const socket = io(socketServerUrl, {
        withCredentials: true,
        transports: ['websocket', 'polling'],
        reconnection: autoReconnect,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        timeout: 20000,
        forceNew: true, // ✅ CRITICAL: Always create new connection
        query: {
          clientId: generateDeviceFingerprint(),
          timestamp: Date.now(),
          attempt: connectionAttemptsRef.current,
          connectionId // ✅ NEW: Track this specific connection
        }
      });

      // ✅ CRITICAL FIX: Mark creation as complete immediately
      initializationRef.current.isCreating = false;
      
      return socket;
    } catch (error) {
      log('Error creating socket:', error);
      initializationRef.current.isCreating = false;
      throw error;
    }
  }, [socketServerUrl, autoReconnect, log]);

  // ✅ CRITICAL FIX: Enhanced initialize function with better duplicate prevention
  const initializeSocket = useCallback(() => {
    // ✅ PREVENT MULTIPLE INITIALIZATIONS
    if (initializationRef.current.isInitialized || 
        initializationRef.current.isDestroyed ||
        initializationRef.current.isCreating) {
      log('Socket initialization skipped:', {
        isInitialized: initializationRef.current.isInitialized,
        isDestroyed: initializationRef.current.isDestroyed,
        isCreating: initializationRef.current.isCreating
      });
      return;
    }

    log('Initializing socket connection...');

    const socket = createSocket();
    if (!socket) {
      log('Failed to create socket');
      return;
    }

    // ✅ CRITICAL FIX: Set socket and mark as initialized BEFORE setting up listeners
    socketRef.current = socket;
    initializationRef.current.isInitialized = true;

    if (mountedRef.current && !initializationRef.current.isDestroyed) {
      setState(prev => ({ ...prev, isConnecting: true }));
    }

    // ✅ ENHANCED: Add connection tracking listeners
    socket.on('connect', () => {
      log('Socket connected, ID:', socket.id);
      handleConnect();
    });
    
    socket.on('disconnect', (reason) => {
      log('Socket disconnected, reason:', reason);
      handleDisconnect(reason);
    });
    
    socket.on('connect_error', (error) => {
      log('Socket connection error:', error);
      handleError(error);
    });

    // ✅ NEW: Add reconnect tracking
    socket.on('reconnect', (attemptNumber) => {
      log('Socket reconnected after', attemptNumber, 'attempts');
    });

    socket.on('reconnect_error', (error) => {
      log('Socket reconnect error:', error);
    });

    socket.on('reconnect_failed', () => {
      log('Socket reconnect failed - all attempts exhausted');
      initializationRef.current.isInitialized = false;
    });

    return () => {
      log('Cleaning up socket initialization');
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      initializationRef.current.isInitialized = false;
      initializationRef.current.isCreating = false;
    };
  }, [createSocket, handleConnect, handleDisconnect, handleError]);

  // ✅ ENHANCED: Force reconnect with better cleanup
  const forceReconnect = useCallback(() => {
    log('Force reconnecting...');
    
    // ✅ CRITICAL FIX: Prevent concurrent reconnection attempts
    if (initializationRef.current.isCreating) {
      log('Reconnection already in progress, skipping...');
      return;
    }
    
    // Clean up existing connection
    if (socketRef.current) {
      log('Cleaning up existing socket for reconnection');
      try {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
      } catch (err) {
        log('Error during reconnection cleanup:', err);
      }
      socketRef.current = null;
    }

    // ✅ CRITICAL FIX: Reset all flags properly
    initializationRef.current.isInitialized = false;
    initializationRef.current.isCreating = false;
    initializationRef.current.lastConnectionId = null;
    
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

  // ✅ ENHANCED: Destroy socket with comprehensive cleanup
  const destroySocket = useCallback(() => {
    log('Destroying socket connection');
    
    // ✅ CRITICAL FIX: Mark as destroyed first to prevent new operations
    initializationRef.current.isDestroyed = true;
    initializationRef.current.isCreating = false;

    // Execute all registered cleanup functions
    cleanupFunctionsRef.current.forEach(cleanup => {
      try {
        cleanup();
      } catch (err) {
        log('Error in cleanup function:', err);
      }
    });
    cleanupFunctionsRef.current = [];

    // Cleanup socket
    if (socketRef.current) {
      try {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
      } catch (err) {
        log('Error during socket destruction:', err);
      }
      socketRef.current = null;
    }

    initializationRef.current.isInitialized = false;
    initializationRef.current.lastConnectionId = null;

    if (mountedRef.current) {
      setState({
        isConnected: false,
        isConnecting: false,
        connectionError: null,
        currentRoom: null
      });
    }
  }, [log]);

  // ✅ CRITICAL FIX: Enhanced mount effect with better cleanup
  useEffect(() => {
    mountedRef.current = true;
    initializationRef.current.isDestroyed = false;

    // ✅ NEW: Add page visibility handling to prevent background connections
    const handleVisibilityChange = () => {
      if (document.hidden) {
        log('Page hidden - maintaining connection');
      } else {
        log('Page visible - checking connection health');
        // Check if socket is still healthy when page becomes visible
        if (socketRef.current && !socketRef.current.connected) {
          log('Detected stale connection, force reconnecting...');
          forceReconnect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      destroySocket();
    };
  }, [destroySocket, forceReconnect]);

  // ✅ ENHANCED: Register handler with better tracking
  const registerHandler = useCallback(<T extends any[]>(
    eventName: string,
    handler: (...args: T) => void
  ) => {
    if (!socketRef.current || initializationRef.current.isDestroyed) {
      log('Cannot register handler - socket not available:', eventName);
      return;
    }

    const wrappedHandler = (...args: T) => {
      if (mountedRef.current && !initializationRef.current.isDestroyed) {
        try {
          handler(...args);
        } catch (err) {
          log('Error in event handler', eventName, ':', err);
        }
      }
    };

    socketRef.current.on(eventName, wrappedHandler);
    cleanupFunctionsRef.current.push(() => {
      try {
        socketRef.current?.off(eventName, wrappedHandler);
      } catch (err) {
        log('Error removing event handler', eventName, ':', err);
      }
    });

    log('Registered event handler:', eventName);
  }, [log]);

  // Expose a clean API
  return {
    socket: socketRef.current,
    ...state,
    registerHandler,
    isInitialized: initializationRef.current.isInitialized,
    initializeSocket,
    forceReconnect,
    destroySocket,
    
    // ✅ ENHANCED: Better emit function with connection checking
    emit: useCallback((...args: Parameters<Socket['emit']>) => {
      if (!socketRef.current) {
        log('Cannot emit - no socket available:', args[0]);
        return false;
      }
      
      if (!socketRef.current.connected) {
        log('Cannot emit - socket not connected:', args[0]);
        return false;
      }
      
      if (initializationRef.current.isDestroyed) {
        log('Cannot emit - socket is destroyed:', args[0]);
        return false;
      }
      
      try {
        socketRef.current.emit(...args);
        return true;
      } catch (err) {
        log('Error emitting event:', args[0], err);
        return false;
      }
    }, [log]),
    
    disconnect: useCallback(() => {
      if (socketRef.current?.connected) {
        socketRef.current.disconnect();
      }
    }, [])
  };
};