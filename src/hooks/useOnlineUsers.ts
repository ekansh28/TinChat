// src/hooks/useOnlineUsers.ts
import { useState, useEffect } from 'react';
import { getSocketManager } from '@/lib/socketManager';

export function useOnlineUsers() {
  const [usersOnline, setUsersOnline] = useState<number | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    const socketManager = getSocketManager();
    let hasRequested = false;

    const handleUserCount = (count: number) => {
      setUsersOnline(count);
      setConnectionError(null);
    };

    const handleConnectionError = (error: string) => {
      console.error("useOnlineUsers: Connection error:", error);
      setConnectionError(error);
      setUsersOnline(0);
    };

    // Register event handler
    const unregisterHandler = socketManager.registerHandler(
      'useOnlineUsers',
      'onlineUserCount',
      handleUserCount
    );

    // Listen to connection state changes
    const unregisterStateListener = socketManager.onStateChange((state) => {
      if (state.isConnected && !hasRequested) {
        console.log("useOnlineUsers: Connected, requesting user count");
        socketManager.emit('getOnlineUserCount');
        hasRequested = true;
        setConnectionError(null);
      } else if (state.connectionError) {
        handleConnectionError(state.connectionError);
        hasRequested = false;
      } else if (!state.isConnected) {
        hasRequested = false;
      }
    });

    // Try to connect if not already connected
    socketManager.connect().catch((error) => {
      console.error("useOnlineUsers: Failed to establish connection:", error);
      handleConnectionError(error.message || String(error));
    });

    return () => {
      unregisterHandler();
      unregisterStateListener();
    };
  }, []);

  return { usersOnline, connectionError };
}

