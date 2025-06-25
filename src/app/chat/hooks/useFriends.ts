// src/hooks/useFriends.ts - Complete Friends System Hook

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export interface Friend {
  id: string;
  authId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen?: Date;
  isBlocked?: boolean;
  isFavorite?: boolean;
  badges?: string[];
  mutualFriends?: number;
  lastMessage?: {
    text: string;
    timestamp: Date;
    isFromSelf: boolean;
  };
  unreadCount?: number;
}

export interface FriendRequest {
  id: string;
  from: Friend;
  to: Friend;
  message?: string;
  timestamp: Date;
  type: 'incoming' | 'outgoing';
  status: 'pending' | 'accepted' | 'declined';
}

export interface ChatMessage {
  id: string;
  friendId: string;
  senderId: string;
  receiverId: string;
  message: string;
  timestamp: Date;
  read: boolean;
  isFromSelf?: boolean;
}

interface FriendsState {
  friends: Friend[];
  blockedUsers: Friend[];
  pendingRequests: FriendRequest[];
  chatMessages: Record<string, ChatMessage[]>; // friendId -> messages
  openChats: string[]; // Array of friend IDs with open chat windows
  typingUsers: Set<string>; // Set of friend IDs who are typing
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
}

interface UseFriendsOptions {
  authId: string;
  username: string;
  socketUrl?: string;
  autoConnect?: boolean;
}

export const useFriends = ({ 
  authId, 
  username, 
  socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001',
  autoConnect = true 
}: UseFriendsOptions) => {
  const [state, setState] = useState<FriendsState>({
    friends: [],
    blockedUsers: [],
    pendingRequests: [],
    chatMessages: {},
    openChats: [],
    typingUsers: new Set(),
    isLoading: true,
    error: null,
    isConnected: false
  });

  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  // ===== SOCKET CONNECTION =====
  
  const connectSocket = useCallback(() => {
    if (socketRef.current?.connected) {
      return;
    }

    console.log('[Friends] Connecting to friends service...');
    
    try {
      const socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        auth: { authId, username },
        query: { service: 'friends' }
      });

      // Connection events
      socket.on('connect', () => {
        console.log('[Friends] Connected to friends service');
        setState(prev => ({ ...prev, isConnected: true, error: null }));
        
        // Join friends room
        socket.emit('friends:join', { authId });
        
        // Load initial data
        loadFriendsData();
        loadPendingRequests();
      });

      socket.on('disconnect', (reason) => {
        console.log('[Friends] Disconnected:', reason);
        setState(prev => ({ ...prev, isConnected: false }));
        
        if (reason === 'io server disconnect') {
          scheduleReconnect();
        }
      });

      socket.on('connect_error', (error) => {
        console.error('[Friends] Connection error:', error);
        setState(prev => ({ 
          ...prev, 
          error: 'Connection failed',
          isConnected: false,
          isLoading: false
        }));
        scheduleReconnect();
      });

      // Friends events
      socket.on('friends:list', handleFriendsList);
      socket.on('friends:request_received', handleFriendRequestReceived);
      socket.on('friends:request_accepted', handleFriendRequestAccepted);
      socket.on('friends:request_declined', handleFriendRequestDeclined);
      socket.on('friends:removed', handleFriendRemoved);
      socket.on('friends:status_changed', handleFriendStatusChanged);
      socket.on('friends:blocked', handleUserBlocked);
      socket.on('friends:unblocked', handleUserUnblocked);
      
      // Chat events
      socket.on('friends:message', handleChatMessage);
      socket.on('friends:typing_start', handleTypingStart);
      socket.on('friends:typing_stop', handleTypingStop);
      socket.on('friends:messages_read', handleMessagesRead);

      socketRef.current = socket;
    } catch (error) {
      console.error('[Friends] Failed to create socket:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to connect',
        isConnected: false,
        isLoading: false
      }));
      scheduleReconnect();
    }
  }, [authId, username, socketUrl]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      console.log('[Friends] Attempting to reconnect...');
      connectSocket();
    }, 3000);
  }, [connectSocket]);

  // ===== EVENT HANDLERS =====

  const handleFriendsList = useCallback((data: { friends: Friend[] }) => {
    setState(prev => ({
      ...prev,
      friends: data.friends,
      isLoading: false
    }));
  }, []);

  const handleFriendRequestReceived = useCallback((data: { request: FriendRequest }) => {
    setState(prev => ({
      ...prev,
      pendingRequests: [...prev.pendingRequests, data.request]
    }));
  }, []);

  const handleFriendRequestAccepted = useCallback((data: { request: FriendRequest, friend: Friend }) => {
    setState(prev => ({
      ...prev,
      friends: [...prev.friends, data.friend],
      pendingRequests: prev.pendingRequests.filter(req => req.id !== data.request.id)
    }));
  }, []);

  const handleFriendRequestDeclined = useCallback((data: { requestId: string }) => {
    setState(prev => ({
      ...prev,
      pendingRequests: prev.pendingRequests.filter(req => req.id !== data.requestId)
    }));
  }, []);

  const handleFriendRemoved = useCallback((data: { friendId: string }) => {
    setState(prev => {
      // Create a new chatMessages object without the removed friend
      const { [data.friendId]: removed, ...remainingChatMessages } = prev.chatMessages;
      
      return {
        ...prev,
        friends: prev.friends.filter(friend => friend.id !== data.friendId),
        chatMessages: remainingChatMessages,
        openChats: prev.openChats.filter(id => id !== data.friendId)
      };
    });
  }, []);

  const handleFriendStatusChanged = useCallback((data: { friendId: string, status: string }) => {
    setState(prev => ({
      ...prev,
      friends: prev.friends.map(friend =>
        friend.id === data.friendId
          ? { ...friend, status: data.status as any }
          : friend
      )
    }));
  }, []);

  const handleUserBlocked = useCallback((data: { user: Friend }) => {
    setState(prev => {
      // Create a new chatMessages object without the blocked user
      const { [data.user.id]: removed, ...remainingChatMessages } = prev.chatMessages;
      
      return {
        ...prev,
        blockedUsers: [...prev.blockedUsers, data.user],
        friends: prev.friends.filter(friend => friend.id !== data.user.id),
        chatMessages: remainingChatMessages,
        openChats: prev.openChats.filter(id => id !== data.user.id)
      };
    });
  }, []);

  const handleUserUnblocked = useCallback((data: { userId: string }) => {
    setState(prev => ({
      ...prev,
      blockedUsers: prev.blockedUsers.filter(user => user.id !== data.userId)
    }));
  }, []);

  const handleChatMessage = useCallback((data: { message: ChatMessage }) => {
    const { message } = data;
    const friendId = message.senderId === authId ? message.receiverId : message.senderId;
    
    setState(prev => ({
      ...prev,
      chatMessages: {
        ...prev.chatMessages,
        [friendId]: [...(prev.chatMessages[friendId] || []), message]
      },
      friends: prev.friends.map(friend =>
        friend.id === friendId
          ? {
              ...friend,
              lastMessage: {
                text: message.message,
                timestamp: message.timestamp,
                isFromSelf: message.senderId === authId
              },
              unreadCount: message.senderId === authId ? 0 : (friend.unreadCount || 0) + 1
            }
          : friend
      )
    }));
  }, [authId]);

  const handleTypingStart = useCallback((data: { friendId: string }) => {
    setState(prev => ({
      ...prev,
      typingUsers: new Set([...prev.typingUsers, data.friendId])
    }));

    // Auto-clear typing after 5 seconds
    if (typingTimeoutRef.current[data.friendId]) {
      clearTimeout(typingTimeoutRef.current[data.friendId]);
    }

    typingTimeoutRef.current[data.friendId] = setTimeout(() => {
      setState(prev => {
        const newTypingUsers = new Set(prev.typingUsers);
        newTypingUsers.delete(data.friendId);
        return { ...prev, typingUsers: newTypingUsers };
      });
      delete typingTimeoutRef.current[data.friendId];
    }, 5000);
  }, []);

  const handleTypingStop = useCallback((data: { friendId: string }) => {
    setState(prev => {
      const newTypingUsers = new Set(prev.typingUsers);
      newTypingUsers.delete(data.friendId);
      return { ...prev, typingUsers: newTypingUsers };
    });

    if (typingTimeoutRef.current[data.friendId]) {
      clearTimeout(typingTimeoutRef.current[data.friendId]);
      delete typingTimeoutRef.current[data.friendId];
    }
  }, []);

  const handleMessagesRead = useCallback((data: { friendId: string, messageIds: string[] }) => {
    setState(prev => ({
      ...prev,
      chatMessages: {
        ...prev.chatMessages,
        [data.friendId]: (prev.chatMessages[data.friendId] || []).map(msg =>
          data.messageIds.includes(msg.id) ? { ...msg, read: true } : msg
        )
      },
      friends: prev.friends.map(friend =>
        friend.id === data.friendId ? { ...friend, unreadCount: 0 } : friend
      )
    }));
  }, []);

  // ===== API FUNCTIONS =====

  const loadFriendsData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch(`/api/friends?authId=${authId}`);
      const data = await response.json();

      if (data.success) {
        setState(prev => ({
          ...prev,
          friends: data.friends,
          isLoading: false
        }));
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('[Friends] Failed to load friends:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load friends',
        isLoading: false
      }));
    }
  }, [authId]);

  const loadPendingRequests = useCallback(async () => {
    try {
      const response = await fetch(`/api/friends/requests?authId=${authId}`);
      const data = await response.json();

      if (data.success) {
        setState(prev => ({
          ...prev,
          pendingRequests: data.requests
        }));
      }
    } catch (error) {
      console.error('[Friends] Failed to load requests:', error);
    }
  }, [authId]);

  // ===== FRIEND ACTIONS =====

  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim()) return [];

    try {
      const response = await fetch('/api/friends/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, currentUserId: authId })
      });

      const data = await response.json();
      return data.success ? data.users : [];
    } catch (error) {
      console.error('[Friends] Search failed:', error);
      return [];
    }
  }, [authId]);

  const sendFriendRequest = useCallback(async (targetUserId: string, message?: string) => {
    if (!socketRef.current?.connected) return false;

    try {
      socketRef.current.emit('friends:send_request', {
        targetUserId,
        message: message?.trim(),
        fromUserId: authId
      });
      return true;
    } catch (error) {
      console.error('[Friends] Failed to send friend request:', error);
      return false;
    }
  }, [authId]);

  const acceptFriendRequest = useCallback(async (requestId: string) => {
    if (!socketRef.current?.connected) return false;

    try {
      socketRef.current.emit('friends:accept_request', { requestId });
      return true;
    } catch (error) {
      console.error('[Friends] Failed to accept request:', error);
      return false;
    }
  }, []);

  const declineFriendRequest = useCallback(async (requestId: string) => {
    if (!socketRef.current?.connected) return false;

    try {
      socketRef.current.emit('friends:decline_request', { requestId });
      return true;
    } catch (error) {
      console.error('[Friends] Failed to decline request:', error);
      return false;
    }
  }, []);

  const removeFriend = useCallback(async (friendId: string) => {
    if (!socketRef.current?.connected) return false;

    try {
      socketRef.current.emit('friends:remove', { friendId });
      return true;
    } catch (error) {
      console.error('[Friends] Failed to remove friend:', error);
      return false;
    }
  }, []);

  const blockUser = useCallback(async (userId: string) => {
    if (!socketRef.current?.connected) return false;

    try {
      socketRef.current.emit('friends:block', { userId });
      return true;
    } catch (error) {
      console.error('[Friends] Failed to block user:', error);
      return false;
    }
  }, []);

  const unblockUser = useCallback(async (userId: string) => {
    if (!socketRef.current?.connected) return false;

    try {
      socketRef.current.emit('friends:unblock', { userId });
      return true;
    } catch (error) {
      console.error('[Friends] Failed to unblock user:', error);
      return false;
    }
  }, []);

  // ===== CHAT ACTIONS =====

  const sendMessage = useCallback((friendId: string, message: string) => {
    if (!socketRef.current?.connected || !message.trim()) return false;

    try {
      const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
      const chatMessage: ChatMessage = {
        id: messageId,
        friendId,
        senderId: authId,
        receiverId: friendId,
        message: message.trim(),
        timestamp: new Date(),
        read: false,
        isFromSelf: true
      };

      socketRef.current.emit('friends:send_message', chatMessage);
      
      // Add to local state immediately for better UX
      setState(prev => ({
        ...prev,
        chatMessages: {
          ...prev.chatMessages,
          [friendId]: [...(prev.chatMessages[friendId] || []), chatMessage]
        },
        friends: prev.friends.map(friend =>
          friend.id === friendId
            ? {
                ...friend,
                lastMessage: {
                  text: message.trim(),
                  timestamp: new Date(),
                  isFromSelf: true
                }
              }
            : friend
        )
      }));

      return true;
    } catch (error) {
      console.error('[Friends] Failed to send message:', error);
      return false;
    }
  }, [authId]);

  const startTyping = useCallback((friendId: string) => {
    if (!socketRef.current?.connected) return;

    socketRef.current.emit('friends:typing_start', { friendId });
  }, []);

  const stopTyping = useCallback((friendId: string) => {
    if (!socketRef.current?.connected) return;

    socketRef.current.emit('friends:typing_stop', { friendId });
  }, []);

  const markMessagesAsRead = useCallback((friendId: string) => {
    if (!socketRef.current?.connected) return;

    const unreadMessages = state.chatMessages[friendId]?.filter(msg => !msg.read && msg.senderId !== authId) || [];
    const messageIds = unreadMessages.map(msg => msg.id);

    if (messageIds.length > 0) {
      socketRef.current.emit('friends:mark_read', { friendId, messageIds });
    }
  }, [authId, state.chatMessages]);

  // ===== CHAT WINDOW MANAGEMENT =====

  const openChat = useCallback((friendId: string) => {
    setState(prev => ({
      ...prev,
      openChats: prev.openChats.includes(friendId) 
        ? prev.openChats 
        : [...prev.openChats, friendId].slice(-3) // Max 3 open chats
    }));

    // Mark messages as read when opening chat
    markMessagesAsRead(friendId);
  }, [markMessagesAsRead]);

  const closeChat = useCallback((friendId: string) => {
    setState(prev => ({
      ...prev,
      openChats: prev.openChats.filter(id => id !== friendId)
    }));
  }, []);

  const closeAllChats = useCallback(() => {
    setState(prev => ({ ...prev, openChats: [] }));
  }, []);

  // ===== LIFECYCLE =====

  useEffect(() => {
    if (autoConnect && authId) {
      connectSocket();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      Object.values(typingTimeoutRef.current).forEach(timeout => {
        clearTimeout(timeout);
      });
    };
  }, [authId, autoConnect, connectSocket]);

  // ===== COMPUTED VALUES =====

  const onlineFriends = state.friends.filter(friend => friend.status === 'online');
  const totalUnreadCount = state.friends.reduce((total, friend) => total + (friend.unreadCount || 0), 0);

  return {
    // State
    ...state,
    onlineFriends,
    totalUnreadCount,

    // Friend actions
    searchUsers,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    blockUser,
    unblockUser,

    // Chat actions
    sendMessage,
    startTyping,
    stopTyping,
    markMessagesAsRead,

    // Chat window management
    openChat,
    closeChat,
    closeAllChats,

    // Utilities
    refresh: loadFriendsData,
    reconnect: connectSocket
  };
};