// src/hooks/useOnlineUsersData.ts
import { useState, useEffect } from 'react';
import { getSocketManager } from '@/lib/socketManager';

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

  useEffect(() => {
    const socketManager = getSocketManager();
    let hasRequested = false;
    let refreshInterval: NodeJS.Timeout | null = null;

    const handleOnlineUsersData = (data: OnlineUsersData) => {
      console.log('📡 Received comprehensive online users data:', data);
      setOnlineUsersData(data);
    };

    const handleOnlineUsersList = (users: string[]) => {
      console.log('📡 Received online users list:', users);
      setOnlineUsersData(prev => ({
        ...prev,
        connectedUsers: users
      }));
    };

    const handleOnlineUserCountUpdate = (count: number) => {
      setOnlineUsersData(prev => ({
        ...prev,
        totalOnline: count
      }));
    };

    const handleQueueStatsUpdate = (stats: { textQueue: number; videoQueue: number }) => {
      setOnlineUsersData(prev => ({
        ...prev,
        queueStats: stats
      }));
    };

    const handleActiveChatUpdate = (count: number) => {
      setOnlineUsersData(prev => ({
        ...prev,
        activeChats: count
      }));
    };

    const requestInitialData = () => {
      if (!hasRequested) {
        console.log('🔌 Connected - requesting online users data');
        socketManager.emit('getOnlineUsersData');
        hasRequested = true;
      }
    };

    // Register event handlers
    const unregisterHandlers = [
      socketManager.registerHandler('useOnlineUsersData', 'onlineUsersData', handleOnlineUsersData),
      socketManager.registerHandler('useOnlineUsersData', 'onlineUsersList', handleOnlineUsersList), 
      socketManager.registerHandler('useOnlineUsersData', 'onlineUserCountUpdate', handleOnlineUserCountUpdate),
      socketManager.registerHandler('useOnlineUsersData', 'queueStatsUpdate', handleQueueStatsUpdate),
      socketManager.registerHandler('useOnlineUsersData', 'activeChatUpdate', handleActiveChatUpdate)
    ];

    // Listen to connection state changes
    const unregisterStateListener = socketManager.onStateChange((state) => {
      if (state.isConnected) {
        requestInitialData();
      } else if (!state.isConnected) {
        console.log('🔌 Disconnected - resetting data');
        hasRequested = false;
        setOnlineUsersData({
          connectedUsers: [],
          queueStats: { textQueue: 0, videoQueue: 0 },
          activeChats: 0,
          totalOnline: 0
        });
      }
    });

    // Try to connect and request initial data
    socketManager.connect().then(() => {
      requestInitialData();
      
      // Set up periodic refresh (every 30 seconds as backup)
      refreshInterval = setInterval(() => {
        if (socketManager.getState().isConnected) {
          socketManager.emit('getOnlineUsersData');
        }
      }, 30000);
    }).catch((error) => {
      console.error('Failed to establish connection for online users data:', error);
    });

    return () => {
      // Clear interval
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      
      // Unregister all handlers
      unregisterHandlers.forEach(unregister => unregister());
      unregisterStateListener();
    };
  }, []);

  return onlineUsersData;
}