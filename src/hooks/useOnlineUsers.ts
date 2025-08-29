// src/hooks/useOnlineUsers.ts
import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

export function useOnlineUsers() {
  const [usersOnline, setUsersOnline] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isCircuitOpen, setIsCircuitOpen] = useState(false);

  useEffect(() => {
    const socketServerUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL;
    if (!socketServerUrl) {
      console.error("useOnlineUsers: Socket server URL is not defined.");
      setUsersOnline(0);
      return;
    }

    let tempSocket: Socket | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;
    let circuitTimeout: NodeJS.Timeout | null = null;

    const connectWithRetry = () => {
      if (isCircuitOpen) {
        console.log("useOnlineUsers: Circuit breaker is open. Skipping connection attempt.");
        return;
      }

      if (retryCount >= 5) {
        console.warn("useOnlineUsers: Max retry attempts reached. Opening circuit breaker.");
        setUsersOnline(0);
        setIsCircuitOpen(true);
        
        // Reset circuit breaker after 2 minutes
        circuitTimeout = setTimeout(() => {
          console.log("useOnlineUsers: Resetting circuit breaker.");
          setIsCircuitOpen(false);
          setRetryCount(0);
        }, 120000);
        return;
      }

      try {
        tempSocket = io(socketServerUrl, {
          withCredentials: true,
          transports: ['polling', 'websocket'], // Try polling first
          timeout: 10000,
          forceNew: true, // Ensure fresh connection
        });

        tempSocket.on('connect', () => {
          console.log("useOnlineUsers: Connected to socket server for user count.");
          setRetryCount(0); // Reset retry count on successful connection
          tempSocket?.emit('getOnlineUserCount');
        });

        tempSocket.on('onlineUserCount', (count: number) => {
          setUsersOnline(count);
          // Delay disconnect to avoid rapid reconnections
          setTimeout(() => {
            tempSocket?.disconnect();
          }, 1000);
        });

        tempSocket.on('connect_error', (err) => {
          console.error("useOnlineUsers: Socket connection error for user count. Full error:", err);
          
          // Safely check error messages
          const errorMessage = err?.message || '';
          const errorDescription = (err as any)?.description || '';
          const errorString = String(err);
          
          // Check if it's a rate limit or forbidden error
          const isRateLimited = errorMessage.includes('Too many connections') || 
                               errorDescription.includes('Too many connections');
          const isForbidden = errorMessage.includes('403') || 
                             errorString.includes('403') ||
                             errorMessage.includes('Forbidden');
          
          if (isRateLimited || isForbidden) {
            console.log("useOnlineUsers: Server rejected connection (rate limited or forbidden). Will retry with exponential backoff.");
            const delay = Math.min(1000 * Math.pow(2, retryCount), 30000); // Exponential backoff, max 30s
            
            retryTimeout = setTimeout(() => {
              setRetryCount(prev => prev + 1);
              connectWithRetry();
            }, delay);
          } else {
            setUsersOnline(0);
          }
          
          if (tempSocket?.connected) tempSocket.disconnect();
        });

        tempSocket.on('error', (err) => { 
          console.error("useOnlineUsers: General socket error for user count:", err);
          setUsersOnline(0);
          if (tempSocket?.connected) tempSocket.disconnect();
        });

      } catch (error) {
        console.error("useOnlineUsers: Failed to initialize socket for user count:", error);
        setUsersOnline(0);
      }
    };

    // Initial connection attempt
    connectWithRetry();

    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      if (circuitTimeout) {
        clearTimeout(circuitTimeout);
      }
      if (tempSocket?.connected) {
        console.log("useOnlineUsers: Disconnecting socket for user count on unmount.");
        tempSocket?.disconnect();
      } else if (tempSocket) {
        console.log("useOnlineUsers: Cleaning up non-connected socket for user count on unmount.");
        tempSocket.removeAllListeners();
        tempSocket.disconnect();
      }
    };
  }, [retryCount, isCircuitOpen]);

  return usersOnline;
}

