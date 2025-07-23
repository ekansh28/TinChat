// src/hooks/useOnlineUsers.ts
import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

export function useOnlineUsers() {
  const [usersOnline, setUsersOnline] = useState<number | null>(null);

  useEffect(() => {
    const socketServerUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL;
    if (!socketServerUrl) {
      console.error("useOnlineUsers: Socket server URL is not defined.");
      setUsersOnline(0);
      return;
    }

    let tempSocket: Socket | null = null;

    try {
      tempSocket = io(socketServerUrl, {
        withCredentials: true,
        transports: ['websocket', 'polling']
      });

      tempSocket.on('connect', () => {
        console.log("useOnlineUsers: Connected to socket server for user count.");
        tempSocket?.emit('getOnlineUserCount');
      });

      tempSocket.on('onlineUserCount', (count: number) => {
        setUsersOnline(count);
        tempSocket?.disconnect();
      });

      tempSocket.on('connect_error', (err) => {
        console.error("useOnlineUsers: Socket connection error for user count. Full error:", err);
        setUsersOnline(0); 
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

    return () => {
      if (tempSocket?.connected) {
        console.log("useOnlineUsers: Disconnecting socket for user count on unmount.");
        tempSocket?.disconnect();
      } else if (tempSocket) {
        console.log("useOnlineUsers: Cleaning up non-connected socket for user count on unmount.");
        tempSocket.removeAllListeners();
        tempSocket.disconnect();
      }
    };
  }, []);

  return usersOnline;
}

