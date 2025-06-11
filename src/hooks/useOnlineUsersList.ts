// src/hooks/useOnlineUsersList.ts
import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

export function useOnlineUsersList() {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Initialize socket connection
    const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', {
      transports: ['websocket', 'polling'],
      timeout: 20000,
    });

    setSocket(socketInstance);

    // Listen for online users updates
    socketInstance.on('onlineUsersList', (users: string[]) => {
      setOnlineUsers(users);
    });

    // Request initial online users list
    socketInstance.emit('getOnlineUsersList');

    // Set up periodic refresh (every 30 seconds)
    const interval = setInterval(() => {
      socketInstance.emit('getOnlineUsersList');
    }, 30000);

    return () => {
      clearInterval(interval);
      socketInstance.disconnect();
    };
  }, []);

  return onlineUsers;
}

// Alternative version using mock data for testing
export function useOnlineUsersListMock() {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  useEffect(() => {
    // Mock data for testing
    const mockUsers = [
      'alice123', 'bob_gamer', 'charlie', 'diana_x', 'eve_coder', 
      'frank_dev', 'grace_ui', 'henry_js', 'iris_react', 'jack_node',
      'kate_web', 'liam_css', 'mia_html', 'noah_ts', 'olivia_vue'
    ];

    // Simulate changing online users
    const updateUsers = () => {
      const randomCount = Math.floor(Math.random() * 12) + 3; // 3-15 users
      const shuffled = [...mockUsers].sort(() => 0.5 - Math.random());
      setOnlineUsers(shuffled.slice(0, randomCount));
    };

    updateUsers();
    const interval = setInterval(updateUsers, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  return onlineUsers;
}