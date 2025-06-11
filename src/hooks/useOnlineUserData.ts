// src/hooks/useOnlineUsersData.ts
import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

export interface OnlineUsersData {
  connectedUsers: string[]; // All authenticated users
  queueStats: {
    textQueue: number;
    videoQueue: number;
  };
  activeChats: number; // Number of people currently in chat rooms
  totalOnline: number; // Total connected (including anonymous)
}

export function useOnlineUsersData() {
  const [onlineUsersData, setOnlineUsersData] = useState<OnlineUsersData>({
    connectedUsers: [],
    queueStats: { textQueue: 0, videoQueue: 0 },
    activeChats: 0,
    totalOnline: 0
  });
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Initialize socket connection
    const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', {
      transports: ['websocket', 'polling'],
      timeout: 20000,
    });

    setSocket(socketInstance);

    // Listen for comprehensive online users data
    socketInstance.on('onlineUsersData', (data: OnlineUsersData) => {
      console.log('📡 Received comprehensive online users data:', data);
      setOnlineUsersData(data);
    });

    // Also listen for individual updates (backward compatibility)
    socketInstance.on('onlineUsersList', (users: string[]) => {
      console.log('📡 Received online users list:', users);
      setOnlineUsersData(prev => ({
        ...prev,
        connectedUsers: users
      }));
    });

    socketInstance.on('onlineUserCountUpdate', (count: number) => {
      setOnlineUsersData(prev => ({
        ...prev,
        totalOnline: count
      }));
    });

    socketInstance.on('queueStatsUpdate', (stats: { textQueue: number; videoQueue: number }) => {
      setOnlineUsersData(prev => ({
        ...prev,
        queueStats: stats
      }));
    });

    socketInstance.on('activeChatUpdate', (count: number) => {
      setOnlineUsersData(prev => ({
        ...prev,
        activeChats: count
      }));
    });

    // Connection event handlers
    socketInstance.on('connect', () => {
      console.log('🔌 Connected to server for online users data');
      // Request initial data
      socketInstance.emit('getOnlineUsersData');
    });

    socketInstance.on('disconnect', () => {
      console.log('🔌 Disconnected from server');
      setOnlineUsersData({
        connectedUsers: [],
        queueStats: { textQueue: 0, videoQueue: 0 },
        activeChats: 0,
        totalOnline: 0
      });
    });

    // Request initial data if already connected
    if (socketInstance.connected) {
      socketInstance.emit('getOnlineUsersData');
    }

    // Set up periodic refresh (every 30 seconds as backup)
    const interval = setInterval(() => {
      if (socketInstance.connected) {
        socketInstance.emit('getOnlineUsersData');
      }
    }, 30000);

    return () => {
      clearInterval(interval);
      socketInstance.off('onlineUsersData');
      socketInstance.off('onlineUsersList');
      socketInstance.off('onlineUserCountUpdate');
      socketInstance.off('queueStatsUpdate');
      socketInstance.off('activeChatUpdate');
      socketInstance.off('connect');
      socketInstance.off('disconnect');
      socketInstance.disconnect();
    };
  }, []);

  return onlineUsersData;
}