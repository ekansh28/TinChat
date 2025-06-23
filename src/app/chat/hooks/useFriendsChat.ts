// src/hooks/useFriendsChat.ts - COMPLETE FRIENDS CHAT INTEGRATION
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface Friend {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  last_seen: string;
  is_online: boolean;
  friends_since?: string;
  lastMessage?: {
    text: string;
    timestamp: Date;
    isFromSelf: boolean;
    messageId: string;
  };
  unreadCount?: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  message: string;
  timestamp: number;
  read: boolean;
  senderProfile?: {
    username: string;
    displayName?: string;
    avatarUrl?: string;
    displayNameColor?: string;
  };
}

export interface TypingStatus {
  userId: string;
  friendId: string;
  isTyping: boolean;
}

interface FriendsChatState {
  friends: Friend[];
  messages: Record<string, ChatMessage[]>; // friendId -> messages
  unreadCounts: Record<string, number>;
  typingUsers: Record<string, boolean>; // friendId -> isTyping
  loading: {
    friends: boolean;
    messages: Record<string, boolean>;
  };
  error: string | null;
}

export function useFriendsChat(userId: string, authId: string) {
  const [state, setState] = useState<FriendsChatState>({
    friends: [],
    messages: {},
    unreadCounts: {},
    typingUsers: {},
    loading: {
      friends: true,
      messages: {}
    },
    error: null
  });

  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  // ===== SOCKET.IO CONNECTION =====
  
  const connectSocket = useCallback(() => {
    if (socketRef.current?.connected) {
      return;
    }

    try {
      console.log('🔌 Connecting to friends chat service...');
      
      const socket = io({
        path: '/socket.io/',
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true,
        timeout: 20000,
        forceNew: false
      });

      // Connection events
      socket.on('connect', () => {
        console.log('✅ Connected to friends chat service');
        
        // Join user's personal room for receiving messages
        socket.emit('friends_chat_join', {
          userId,
          authId
        });

        setState(prev => ({ ...prev, error: null }));
      });

      socket.on('disconnect', (reason) => {
        console.log('❌ Disconnected from friends chat:', reason);
        
        if (reason === 'io server disconnect') {
          // Server initiated disconnect, try to reconnect
          scheduleReconnect();
        }
      });

      socket.on('connect_error', (error) => {
        console.error('❌ Friends chat connection error:', error);
        setState(prev => ({ ...prev, error: 'Connection failed' }));
        scheduleReconnect();
      });

      // Friends chat events
      socket.on('friends_chat_joined', (data) => {
        console.log('✅ Joined friends chat room:', data);
      });

      socket.on('friends_chat_message_received', (data) => {
        handleMessageReceived(data);
      });

      socket.on('friends_chat_message_sent', (data) => {
        handleMessageSent(data);
      });

      socket.on('friends_chat_messages_read', (data) => {
        handleMessagesRead(data);
      });

      socket.on('friends_chat_typing_start', (data) => {
        handleTypingStart(data);
      });

      socket.on('friends_chat_typing_stop', (data) => {
        handleTypingStop(data);
      });

      socket.on('friends_chat_unread_counts', (data) => {
        handleUnreadCounts(data);
      });

      socket.on('friends_chat_error', (data) => {
        console.error('❌ Friends chat error:', data);
        setState(prev => ({ ...prev, error: data.message }));
      });

      socketRef.current = socket;
    } catch (error) {
      console.error('❌ Failed to create socket connection:', error);
      setState(prev => ({ ...prev, error: 'Failed to connect' }));
      scheduleReconnect();
    }
  }, [userId, authId]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      console.log('🔄 Attempting to reconnect to friends chat...');
      connectSocket();
    }, 3000);
  }, [connectSocket]);

  // ===== MESSAGE HANDLERS =====

  const handleMessageReceived = useCallback((data: { message: ChatMessage; chatId: string }) => {
    const { message } = data;
    const friendId = message.senderId;

    setState(prev => ({
      ...prev,
      messages: {
        ...prev.messages,
        [friendId]: [...(prev.messages[friendId] || []), message]
      },
      messages: {
        ...prev.messages,
        [friendId]: (prev.messages[friendId] || []).map(msg =>
          messageIds.includes(msg.id) ? { ...msg, read: true } : msg
        )
      }
    }));
  }, [userId]);

  const startTyping = useCallback((friendId: string) => {
    if (!socketRef.current?.connected || !userId) {
      return;
    }

    socketRef.current.emit('friends_chat_typing_start', {
      userId,
      friendId
    });
  }, [userId]);

  const stopTyping = useCallback((friendId: string) => {
    if (!socketRef.current?.connected || !userId) {
      return;
    }

    socketRef.current.emit('friends_chat_typing_stop', {
      userId,
      friendId
    });
  }, [userId]);

  const updateFriendStatus = useCallback((friendId: string, isOnline: boolean, status?: string) => {
    setState(prev => ({
      ...prev,
      friends: prev.friends.map(friend =>
        friend.id === friendId
          ? {
              ...friend,
              is_online: isOnline,
              status: status as any || friend.status,
              last_seen: isOnline ? friend.last_seen : new Date().toISOString()
            }
          : friend
      )
    }));
  }, []);

  // ===== EFFECTS =====

  // Initialize connection and load friends
  useEffect(() => {
    if (!userId || !authId) return;

    connectSocket();
    loadFriends();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Clear all typing timeouts
      Object.values(typingTimeoutRef.current).forEach(timeout => {
        clearTimeout(timeout);
      });
      typingTimeoutRef.current = {};
    };
  }, [userId, authId, connectSocket, loadFriends]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // ===== COMPUTED VALUES =====

  const sortedFriends = state.friends.sort((a, b) => {
    // 1. Unread messages first
    const aUnread = state.unreadCounts[a.id] || 0;
    const bUnread = state.unreadCounts[b.id] || 0;
    if (aUnread !== bUnread) {
      return bUnread - aUnread;
    }

    // 2. Online friends next
    if (a.is_online !== b.is_online) {
      return a.is_online ? -1 : 1;
    }

    // 3. Most recent message
    const aTime = a.lastMessage?.timestamp?.getTime() || 0;
    const bTime = b.lastMessage?.timestamp?.getTime() || 0;
    if (aTime !== bTime) {
      return bTime - aTime;
    }

    // 4. Alphabetical
    const aName = a.display_name || a.username;
    const bName = b.display_name || b.username;
    return aName.localeCompare(bName);
  });

  const totalUnreadCount = Object.values(state.unreadCounts).reduce((sum, count) => sum + count, 0);
  const onlineFriendsCount = state.friends.filter(f => f.is_online).length;

  return {
    // State
    friends: sortedFriends,
    messages: state.messages,
    unreadCounts: state.unreadCounts,
    typingUsers: state.typingUsers,
    loading: state.loading,
    error: state.error,
    
    // Computed
    totalUnreadCount,
    onlineFriendsCount,
    isConnected: socketRef.current?.connected || false,
    
    // Actions
    sendMessage,
    markMessagesAsRead,
    startTyping,
    stopTyping,
    loadChatHistory,
    updateFriendStatus,
    
    // Utilities
    refresh: loadFriends,
    reconnect: connectSocket
  };
}

// ===== ADDITIONAL HELPER HOOKS =====

/**
 * Hook for managing a single chat conversation
 */
export function useFriendChat(userId: string, friendId: string, chatHook: ReturnType<typeof useFriendsChat>) {
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const messages = chatHook.messages[friendId] || [];
  const unreadCount = chatHook.unreadCounts[friendId] || 0;
  const isTypingStatus = chatHook.typingUsers[friendId] || false;
  const isLoading = chatHook.loading.messages[friendId] || false;
  
  const friend = chatHook.friends.find(f => f.id === friendId);
  
  // Auto-load chat history when friend changes
  useEffect(() => {
    if (friendId && messages.length === 0 && !isLoading) {
      chatHook.loadChatHistory(friendId);
    }
  }, [friendId, messages.length, isLoading, chatHook]);
  
  // Mark messages as read when viewing chat
  useEffect(() => {
    if (messages.length > 0 && unreadCount > 0) {
      const unreadMessageIds = messages
        .filter(msg => !msg.read && msg.senderId === friendId)
        .map(msg => msg.id);
      
      if (unreadMessageIds.length > 0) {
        chatHook.markMessagesAsRead(friendId, unreadMessageIds);
      }
    }
  }, [messages, unreadCount, friendId, chatHook]);
  
  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) return false;
    
    // Stop typing indicator
    if (isTyping) {
      setIsTyping(false);
      chatHook.stopTyping(friendId);
    }
    
    return chatHook.sendMessage(friendId, text);
  }, [friendId, isTyping, chatHook]);
  
  const handleTyping = useCallback((text: string) => {
    const hasText = text.trim().length > 0;
    
    if (hasText && !isTyping) {
      setIsTyping(true);
      chatHook.startTyping(friendId);
    } else if (!hasText && isTyping) {
      setIsTyping(false);
      chatHook.stopTyping(friendId);
    }
    
    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    if (hasText) {
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        chatHook.stopTyping(friendId);
      }, 3000); // Stop typing after 3 seconds of no input
    }
  }, [friendId, isTyping, chatHook]);
  
  // Cleanup
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      if (isTyping) {
        chatHook.stopTyping(friendId);
      }
    };
  }, [friendId, isTyping, chatHook]);
  
  return {
    friend,
    messages,
    unreadCount,
    isTyping: isTypingStatus,
    isLoading,
    sendMessage,
    handleTyping,
    loadMore: (offset: number) => chatHook.loadChatHistory(friendId, 50, offset)
  };
}

/**
 * Hook for managing multiple chat windows
 */
export function useFriendsChatWindows() {
  const [openChats, setOpenChats] = useState<string[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  
  const openChat = useCallback((friendId: string) => {
    setOpenChats(prev => {
      if (prev.includes(friendId)) {
        // Move to front if already open
        return [friendId, ...prev.filter(id => id !== friendId)];
      } else {
        // Add new chat (max 3 open chats)
        const newChats = [friendId, ...prev];
        return newChats.slice(0, 3);
      }
    });
    setActiveChat(friendId);
  }, []);
  
  const closeChat = useCallback((friendId: string) => {
    setOpenChats(prev => prev.filter(id => id !== friendId));
    setActiveChat(prev => prev === friendId ? null : prev);
  }, []);
  
  const closeAllChats = useCallback(() => {
    setOpenChats([]);
    setActiveChat(null);
  }, []);
  
  return {
    openChats,
    activeChat,
    openChat,
    closeChat,
    closeAllChats,
    setActiveChat
  };
}

/**
 * Hook for managing friend search and adding new friends
 */
export function useFriendSearch(currentUserAuthId: string) {
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  const searchUsers = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim() || searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    setSearchError(null);

    try {
      const response = await fetch('/api/friends/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentUserAuthId,
          searchTerm: searchTerm.trim(),
          limit: 20
        })
      });

      const data = await response.json();

      if (data.success) {
        setSearchResults(data.users);
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('❌ Friend search failed:', error);
      setSearchError(error instanceof Error ? error.message : 'Search failed');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [currentUserAuthId]);

  const sendFriendRequest = useCallback(async (receiverAuthId: string, message?: string) => {
    try {
      const response = await fetch('/api/friends/send-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderAuthId: currentUserAuthId,
          receiverAuthId,
          message: message?.trim()
        })
      });

      const data = await response.json();

      if (data.success) {
        // Remove from search results since request was sent
        setSearchResults(prev => prev.filter(user => user.id !== receiverAuthId));
        
        return {
          success: true,
          message: data.message,
          autoAccepted: data.autoAccepted
        };
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('❌ Send friend request failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send request'
      };
    }
  }, [currentUserAuthId]);

  const loadPendingRequests = useCallback(async (type: 'received' | 'sent' = 'received') => {
    setRequestsLoading(true);

    try {
      const response = await fetch(`/api/friends/${currentUserAuthId}/requests?type=${type}`);
      const data = await response.json();

      if (data.success) {
        setPendingRequests(data.requests);
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('❌ Load pending requests failed:', error);
      setPendingRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  }, [currentUserAuthId]);

  const acceptFriendRequest = useCallback(async (requestId: string) => {
    try {
      const response = await fetch('/api/friends/accept-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          acceptingUserId: currentUserAuthId
        })
      });

      const data = await response.json();

      if (data.success) {
        // Remove from pending requests
        setPendingRequests(prev => prev.filter(req => req.id !== requestId));
        
        return { success: true, message: data.message };
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('❌ Accept friend request failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to accept request'
      };
    }
  }, [currentUserAuthId]);

  const declineFriendRequest = useCallback(async (requestId: string) => {
    try {
      const response = await fetch('/api/friends/decline-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          decliningUserId: currentUserAuthId
        })
      });

      const data = await response.json();

      if (data.success) {
        // Remove from pending requests
        setPendingRequests(prev => prev.filter(req => req.id !== requestId));
        
        return { success: true, message: data.message };
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('❌ Decline friend request failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to decline request'
      };
    }
  }, [currentUserAuthId]);

  return {
    // Search state
    searchResults,
    searchLoading,
    searchError,
    
    // Requests state
    pendingRequests,
    requestsLoading,
    
    // Actions
    searchUsers,
    sendFriendRequest,
    loadPendingRequests,
    acceptFriendRequest,
    declineFriendRequest,
    
    // Utilities
    clearSearch: () => setSearchResults([]),
    clearError: () => setSearchError(null)
  };
}

/**
 * Hook for managing friend statistics and insights
 */
export function useFriendStats(authId: string) {
  const [stats, setStats] = useState({
    friendCount: 0,
    onlineFriendsCount: 0,
    pendingSentCount: 0,
    pendingReceivedCount: 0,
    mutualFriendsWithRecent: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    if (!authId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/friends/${authId}/stats`);
      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('❌ Load friend stats failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, [authId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return {
    stats,
    loading,
    error,
    refresh: loadStats
  };
}

/**
 * Hook for managing friendship status between two users
 */
export function useFriendshipStatus(user1AuthId: string, user2AuthId: string) {
  const [status, setStatus] = useState<{
    status: 'none' | 'friends' | 'pending_sent' | 'pending_received' | 'blocked' | 'blocked_by';
    since?: string;
  }>({ status: 'none' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    if (!user1AuthId || !user2AuthId || user1AuthId === user2AuthId) {
      setStatus({ status: 'none' });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/friends/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user1AuthId, user2AuthId })
      });

      const data = await response.json();

      if (data.success) {
        setStatus(data.status);
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('❌ Check friendship status failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to check status');
      setStatus({ status: 'none' });
    } finally {
      setLoading(false);
    }
  }, [user1AuthId, user2AuthId]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const removeFriend = useCallback(async () => {
    if (status.status !== 'friends') return { success: false, message: 'Not friends' };

    try {
      const response = await fetch('/api/friends/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user1AuthId,
          user2AuthId
        })
      });

      const data = await response.json();

      if (data.success) {
        setStatus({ status: 'none' });
        return { success: true, message: data.message };
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('❌ Remove friend failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to remove friend'
      };
    }
  }, [user1AuthId, user2AuthId, status.status]);

  return {
    status,
    loading,
    error,
    refresh: checkStatus,
    removeFriend
  };
}

/**
 * Hook for managing chat message formatting and utilities
 */
export function useChatMessageUtils() {
  const formatMessageTime = useCallback((timestamp: Date): string => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return timestamp.toLocaleDateString();
  }, []);

  const formatLastSeen = useCallback((lastSeenStr: string): string => {
    try {
      const lastSeen = new Date(lastSeenStr);
      const now = new Date();
      const diff = now.getTime() - lastSeen.getTime();
      
      const minutes = Math.floor(diff / (1000 * 60));
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      
      if (minutes < 5) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days < 7) return `${days}d ago`;
      
      return lastSeen.toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  }, []);

  const truncateMessage = useCallback((text: string, maxLength: number = 50): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }, []);

  const getStatusColor = useCallback((status: string, isOnline: boolean): string => {
    if (!isOnline) return '#9E9E9E';
    
    switch (status) {
      case 'online': return '#4CAF50';
      case 'idle': return '#FFC107';
      case 'dnd': return '#F44336';
      default: return '#9E9E9E';
    }
  }, []);

  const getStatusText = useCallback((status: string, isOnline: boolean): string => {
    if (!isOnline) return 'Offline';
    
    switch (status) {
      case 'online': return 'Online';
      case 'idle': return 'Away';
      case 'dnd': return 'Busy';
      default: return 'Offline';
    }
  }, []);

  const parseMessageMentions = useCallback((text: string, userId: string): { 
    text: string; 
    mentions: string[]; 
    hasMention: boolean;
  } => {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }
    
    const hasMention = mentions.length > 0;
    
    return {
      text,
      mentions,
      hasMention
    };
  }, []);

  const validateMessage = useCallback((text: string): { 
    isValid: boolean; 
    error?: string; 
    trimmed: string;
  } => {
    const trimmed = text.trim();
    
    if (!trimmed) {
      return { isValid: false, error: 'Message cannot be empty', trimmed };
    }
    
    if (trimmed.length > 2000) {
      return { isValid: false, error: 'Message too long (max 2000 characters)', trimmed };
    }
    
    return { isValid: true, trimmed };
  }, []);

  return {
    formatMessageTime,
    formatLastSeen,
    truncateMessage,
    getStatusColor,
    getStatusText,
    parseMessageMentions,
    validateMessage
  };
}

/**
 * Hook for managing chat sound notifications
 */
export function useChatNotifications(enabled: boolean = true) {
  const [soundEnabled, setSoundEnabled] = useState(enabled);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      return permission === 'granted';
    }
    return false;
  }, []);

  const playMessageSound = useCallback(() => {
    if (!soundEnabled) return;
    
    try {
      // Create a simple beep sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  }, [soundEnabled]);

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (notificationPermission === 'granted' && 'Notification' in window) {
      try {
        new Notification(title, {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          ...options
        });
      } catch (error) {
        console.warn('Could not show notification:', error);
      }
    }
  }, [notificationPermission]);

  const notifyNewMessage = useCallback((friendName: string, message: string) => {
    playMessageSound();
    
    showNotification(`New message from ${friendName}`, {
      body: message.length > 50 ? message.substring(0, 50) + '...' : message,
      tag: 'new-message',
      requireInteraction: false,
      silent: false
    });
  }, [playMessageSound, showNotification]);

  const notifyFriendOnline = useCallback((friendName: string) => {
    showNotification(`${friendName} is now online`, {
      body: 'Click to start chatting',
      tag: 'friend-online',
      requireInteraction: false,
      silent: true
    });
  }, [showNotification]);

  return {
    soundEnabled,
    setSoundEnabled,
    notificationPermission,
    requestNotificationPermission,
    playMessageSound,
    showNotification,
    notifyNewMessage,
    notifyFriendOnline
  };
}

/**
 * Hook for managing chat performance and analytics
 */
export function useChatPerformance() {
  const [metrics, setMetrics] = useState({
    messagesSent: 0,
    messagesReceived: 0,
    averageResponseTime: 0,
    connectionUptime: 0,
    reconnectCount: 0,
    lastActivity: Date.now()
  });

  const trackMessageSent = useCallback(() => {
    setMetrics(prev => ({
      ...prev,
      messagesSent: prev.messagesSent + 1,
      lastActivity: Date.now()
    }));
  }, []);

  const trackMessageReceived = useCallback((responseTime?: number) => {
    setMetrics(prev => ({
      ...prev,
      messagesReceived: prev.messagesReceived + 1,
      averageResponseTime: responseTime ? 
        (prev.averageResponseTime + responseTime) / 2 : 
        prev.averageResponseTime,
      lastActivity: Date.now()
    }));
  }, []);

  const trackReconnect = useCallback(() => {
    setMetrics(prev => ({
      ...prev,
      reconnectCount: prev.reconnectCount + 1
    }));
  }, []);

  const getPerformanceReport = useCallback(() => {
    const uptime = Date.now() - (metrics.lastActivity - metrics.connectionUptime);
    
    return {
      ...metrics,
      uptimeFormatted: formatUptime(uptime),
      reliability: metrics.reconnectCount > 0 ? 
        (metrics.connectionUptime / (metrics.connectionUptime + metrics.reconnectCount * 5000)) * 100 : 
        100
    };
  }, [metrics]);

  const resetMetrics = useCallback(() => {
    setMetrics({
      messagesSent: 0,
      messagesReceived: 0,
      averageResponseTime: 0,
      connectionUptime: 0,
      reconnectCount: 0,
      lastActivity: Date.now()
    });
  }, []);

  return {
    metrics,
    trackMessageSent,
    trackMessageReceived,
    trackReconnect,
    getPerformanceReport,
    resetMetrics
  };
}

// ===== UTILITY FUNCTIONS =====

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// ===== TYPES EXPORT =====

export interface Friend {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  last_seen: string;
  is_online: boolean;
  friends_since?: string;
  lastMessage?: {
    text: string;
    timestamp: Date;
    isFromSelf: boolean;
    messageId: string;
  };
  unreadCount?: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  message: string;
  timestamp: number;
  read: boolean;
  senderProfile?: {
    username: string;
    displayName?: string;
    avatarUrl?: string;
    displayNameColor?: string;
  };
}

export interface TypingStatus {
  userId: string;
  friendId: string;
  isTyping: boolean;
  timestamp?: number;
}

export interface FriendRequest {
  id: string;
  sender_id?: string;
  receiver_id?: string;
  message?: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  updated_at?: string;
  sender?: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
    is_online?: boolean;
  };
  receiver?: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
    is_online?: boolean;
  };
}

export interface FriendshipStatus {
  status: 'none' | 'friends' | 'pending_sent' | 'pending_received' | 'blocked' | 'blocked_by';
  since?: string;
}

export interface FriendStats {
  friendCount: number;
  onlineFriendsCount: number;
  pendingSentCount: number;
  pendingReceivedCount: number;
  mutualFriendsWithRecent?: number;
}

export interface SearchResult {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  is_online?: boolean;
  status?: string;
  mutual_friends_count?: number;
}

export interface FriendsChatState {
  friends: Friend[];
  messages: Record<string, ChatMessage[]>; // friendId -> messages
  unreadCounts: Record<string, number>;
  typingUsers: Record<string, boolean>; // friendId -> isTyping
  loading: {
    friends: boolean;
    messages: Record<string, boolean>;
  };
  error: string | null;
  lastUpdated?: Date;
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'reconnecting';
}

export interface ChatPerformanceMetrics {
  messagesSent: number;
  messagesReceived: number;
  averageResponseTime: number;
  connectionUptime: number;
  reconnectCount: number;
  lastActivity: number;
  uptimeFormatted?: string;
  reliability?: number;
}

export interface NotificationSettings {
  soundEnabled: boolean;
  browserNotifications: boolean;
  friendOnlineNotifications: boolean;
  messagePreview: boolean;
  quietHours?: {
    enabled: boolean;
    start: string; // HH:MM format
    end: string;   // HH:MM format
  };
}

export interface ChatWindowState {
  friendId: string;
  isOpen: boolean;
  isMinimized: boolean;
  position: number;
  lastActivity: number;
  unreadCount: number;
  isTyping: boolean;
  draft?: string; // Unsent message draft
}

export interface MessageValidation {
  isValid: boolean;
  error?: string;
  trimmed: string;
  wordCount?: number;
  containsMentions?: boolean;
  mentions?: string[];
}

export interface FriendSearchState {
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  query: string;
  hasSearched: boolean;
}

export interface FriendRequestsState {
  received: FriendRequest[];
  sent: FriendRequest[];
  loading: boolean;
  error: string | null;
}

export interface ChatHistoryResponse {
  messages: ChatMessage[];
  hasMore: boolean;
  totalCount: number;
  offset: number;
}

export interface UnreadCounts {
  [friendId: string]: number;
}

export interface LastMessages {
  [friendId: string]: ChatMessage | null;
}

export interface OnlineStatuses {
  [userId: string]: {
    isOnline: boolean;
    lastSeen?: string;
    status?: string;
  };
}

// ===== API RESPONSE TYPES =====

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  timestamp?: string;
  errors?: string[];
}

export interface FriendsApiResponse extends ApiResponse {
  friends: Friend[];
  count: number;
  cached?: boolean;
}

export interface BatchStatusApiResponse extends ApiResponse {
  statuses: OnlineStatuses;
  count: number;
}

export interface LastMessagesApiResponse extends ApiResponse {
  lastMessages: LastMessages;
  unreadCounts: UnreadCounts;
}

export interface SearchApiResponse extends ApiResponse {
  users: SearchResult[];
  searchTerm: string;
  count: number;
}

export interface FriendRequestApiResponse extends ApiResponse {
  requests: FriendRequest[];
  type: 'received' | 'sent';
  count: number;
}

export interface FriendStatsApiResponse extends ApiResponse {
  stats: FriendStats;
}

export interface FriendshipStatusApiResponse extends ApiResponse {
  status: FriendshipStatus;
}

// ===== SOCKET EVENT TYPES =====

export interface SocketEvents {
  // Connection events
  'friends_chat_join': {
    userId: string;
    authId: string;
  };
  'friends_chat_joined': {
    userId: string;
    userRoom: string;
    timestamp: number;
  };
  
  // Message events
  'friends_chat_send': {
    senderId: string;
    receiverId: string;
    message: string;
    authId: string;
  };
  'friends_chat_message_sent': {
    message: ChatMessage;
    chatId: string;
  };
  'friends_chat_message_received': {
    message: ChatMessage;
    chatId: string;
  };
  
  // Read receipts
  'friends_chat_mark_read': {
    userId: string;
    friendId: string;
    messageIds: string[];
  };
  'friends_chat_messages_read': {
    readerId: string;
    messageIds: string[];
    chatId: string;
  };
  
  // Typing indicators
  'friends_chat_typing_start': {
    userId: string;
    friendId: string;
  };
  'friends_chat_typing_stop': {
    userId: string;
    friendId: string;
  };
  
  // Chat history
  'friends_chat_get_history': {
    userId: string;
    friendId: string;
    limit?: number;
    offset?: number;
  };
  'friends_chat_history': {
    chatId: string;
    messages: ChatMessage[];
    hasMore: boolean;
    offset: number;
  };
  
  // Last messages
  'friends_chat_get_last_messages': {
    userId: string;
    friendIds: string[];
  };
  'friends_chat_last_messages': {
    userId: string;
    lastMessages: LastMessages;
  };
  
  // Unread counts
  'friends_chat_unread_counts': {
    userId: string;
    unreadCounts: UnreadCounts;
  };
  
  // Error handling
  'friends_chat_error': {
    message: string;
    code?: string;
    details?: any;
  };
}

// ===== HOOK RETURN TYPES =====

export interface UseFriendsChatReturn {
  // State
  friends: Friend[];
  messages: Record<string, ChatMessage[]>;
  unreadCounts: Record<string, number>;
  typingUsers: Record<string, boolean>;
  loading: FriendsChatState['loading'];
  error: string | null;
  
  // Computed
  totalUnreadCount: number;
  onlineFriendsCount: number;
  isConnected: boolean;
  
  // Actions
  sendMessage: (friendId: string, message: string) => boolean;
  markMessagesAsRead: (friendId: string, messageIds: string[]) => void;
  startTyping: (friendId: string) => void;
  stopTyping: (friendId: string) => void;
  loadChatHistory: (friendId: string, limit?: number, offset?: number) => Promise<void>;
  updateFriendStatus: (friendId: string, isOnline: boolean, status?: string) => void;
  
  // Utilities
  refresh: () => Promise<void>;
  reconnect: () => void;
}

export interface UseFriendChatReturn {
  friend?: Friend;
  messages: ChatMessage[];
  unreadCount: number;
  isTyping: boolean;
  isLoading: boolean;
  sendMessage: (text: string) => boolean;
  handleTyping: (text: string) => void;
  loadMore: (offset: number) => Promise<void>;
}

export interface UseFriendsChatWindowsReturn {
  openChats: string[];
  activeChat: string | null;
  openChat: (friendId: string) => void;
  closeChat: (friendId: string) => void;
  closeAllChats: () => void;
  setActiveChat: (friendId: string | null) => void;
}

export interface UseFriendSearchReturn {
  // Search state
  searchResults: SearchResult[];
  searchLoading: boolean;
  searchError: string | null;
  
  // Requests state
  pendingRequests: FriendRequest[];
  requestsLoading: boolean;
  
  // Actions
  searchUsers: (searchTerm: string) => Promise<void>;
  sendFriendRequest: (receiverAuthId: string, message?: string) => Promise<{
    success: boolean;
    message: string;
    autoAccepted?: boolean;
  }>;
  loadPendingRequests: (type?: 'received' | 'sent') => Promise<void>;
  acceptFriendRequest: (requestId: string) => Promise<{
    success: boolean;
    message: string;
  }>;
  declineFriendRequest: (requestId: string) => Promise<{
    success: boolean;
    message: string;
  }>;
  
  // Utilities
  clearSearch: () => void;
  clearError: () => void;
}

export interface UseFriendStatsReturn {
  stats: FriendStats;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export interface UseFriendshipStatusReturn {
  status: FriendshipStatus;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  removeFriend: () => Promise<{
    success: boolean;
    message: string;
  }>;
}

export interface UseChatMessageUtilsReturn {
  formatMessageTime: (timestamp: Date) => string;
  formatLastSeen: (lastSeenStr: string) => string;
  truncateMessage: (text: string, maxLength?: number) => string;
  getStatusColor: (status: string, isOnline: boolean) => string;
  getStatusText: (status: string, isOnline: boolean) => string;
  parseMessageMentions: (text: string, userId: string) => {
    text: string;
    mentions: string[];
    hasMention: boolean;
  };
  validateMessage: (text: string) => MessageValidation;
}

export interface UseChatNotificationsReturn {
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  notificationPermission: NotificationPermission;
  requestNotificationPermission: () => Promise<boolean>;
  playMessageSound: () => void;
  showNotification: (title: string, options?: NotificationOptions) => void;
  notifyNewMessage: (friendName: string, message: string) => void;
  notifyFriendOnline: (friendName: string) => void;
}

export interface UseChatPerformanceReturn {
  metrics: ChatPerformanceMetrics;
  trackMessageSent: () => void;
  trackMessageReceived: (responseTime?: number) => void;
  trackReconnect: () => void;
  getPerformanceReport: () => ChatPerformanceMetrics & {
    uptimeFormatted: string;
    reliability: number;
  };
  resetMetrics: () => void;
}

// ===== UTILITY TYPES =====

export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';

export type ChatTheme = 'win98' | 'win7' | 'winxp';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'reconnecting' | 'error';

export type NotificationType = 'message' | 'friend_request' | 'friend_online' | 'friend_offline';

export type SortBy = 'name' | 'status' | 'lastMessage' | 'unread' | 'friendsSince';

export type FilterBy = 'all' | 'online' | 'offline' | 'unread' | 'recent';

// ===== CONSTANTS =====

export const CHAT_CONSTANTS = {
  MAX_MESSAGE_LENGTH: 2000,
  MAX_OPEN_CHATS: 3,
  MESSAGE_RETENTION_HOURS: 24,
  TYPING_TIMEOUT_MS: 5000,
  RECONNECT_DELAY_MS: 3000,
  HEARTBEAT_INTERVAL_MS: 30000,
  MAX_SEARCH_RESULTS: 50,
  MAX_CHAT_HISTORY_LOAD: 100,
  NOTIFICATION_DURATION_MS: 5000,
} as const;

export const STATUS_COLORS = {
  online: '#4CAF50',
  idle: '#FFC107',
  dnd: '#F44336',
  offline: '#9E9E9E',
} as const;

export const THEME_COLORS = {
  win98: {
    background: '#c0c0c0',
    border: '#808080',
    text: '#000000',
    accent: '#0000ff',
  },
  win7: {
    background: '#f0f0f0',
    border: '#cccccc',
    text: '#333333',
    accent: '#0078d4',
  },
  winxp: {
    background: '#ece9d8',
    border: '#0054e3',
    text: '#000000',
    accent: '#0054e3',
  },
} as const;

// ===== ERROR TYPES =====

export class FriendsChatError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'FriendsChatError';
  }
}

export class ConnectionError extends FriendsChatError {
  constructor(message: string, details?: any) {
    super(message, 'CONNECTION_ERROR', details);
    this.name = 'ConnectionError';
  }
}

export class ValidationError extends FriendsChatError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class ApiError extends FriendsChatError {
  constructor(
    message: string,
    public statusCode?: number,
    details?: any
  ) {
    super(message, 'API_ERROR', details);
    this.name = 'ApiError';
  }
}

// ===== EVENT EMITTER TYPES =====

export interface ChatEventMap {
  'message:sent': { friendId: string; message: ChatMessage };
  'message:received': { friendId: string; message: ChatMessage };
  'message:read': { friendId: string; messageIds: string[] };
  'typing:start': { friendId: string };
  'typing:stop': { friendId: string };
  'friend:online': { friend: Friend };
  'friend:offline': { friend: Friend };
  'friend:status_change': { friend: Friend; oldStatus: UserStatus };
  'connection:connected': void;
  'connection:disconnected': { reason: string };
  'connection:error': { error: Error };
  'error': { error: FriendsChatError };
}

// ===== CONFIGURATION TYPES =====

export interface FriendsChatConfig {
  socketUrl?: string;
  socketOptions?: any;
  apiBaseUrl?: string;
  enableNotifications?: boolean;
  enableSounds?: boolean;
  messageRetentionHours?: number;
  maxOpenChats?: number;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  heartbeatInterval?: number;
  theme?: ChatTheme;
  debug?: boolean;
}

export interface FriendsChatProviderProps {
  children: React.ReactNode;
  config?: FriendsChatConfig;
  userId: string;
  authId: string;
}

// ===== CONTEXT TYPES =====

export interface FriendsChatContextValue extends UseFriendsChatReturn {
  config: Required<FriendsChatConfig>;
  userId: string;
  authId: string;
}

export default {
  // Re-export all types for convenient importing
  Friend,
  ChatMessage,
  TypingStatus,
  FriendRequest,
  FriendshipStatus,
  FriendStats,
  SearchResult,
  FriendsChatState,
  ChatPerformanceMetrics,
  NotificationSettings,
  ChatWindowState,
  MessageValidation,
  FriendSearchState,
  FriendRequestsState,
  ChatHistoryResponse,
  UnreadCounts,
  LastMessages,
  OnlineStatuses,
  ApiResponse,
  FriendsApiResponse,
  BatchStatusApiResponse,
  LastMessagesApiResponse,
  SearchApiResponse,
  FriendRequestApiResponse,
  FriendStatsApiResponse,
  FriendshipStatusApiResponse,
  SocketEvents,
  UseFriendsChatReturn,
  UseFriendChatReturn,
  UseFriendsChatWindowsReturn,
  UseFriendSearchReturn,
  UseFriendStatsReturn,
  UseFriendshipStatusReturn,
  UseChatMessageUtilsReturn,
  UseChatNotificationsReturn,
  UseChatPerformanceReturn,
  UserStatus,
  ChatTheme,
  MessageStatus,
  ConnectionStatus,
  NotificationType,
  SortBy,
  FilterBy,
  CHAT_CONSTANTS,
  STATUS_COLORS,
  THEME_COLORS,
  FriendsChatError,
  ConnectionError,
  ValidationError,
  ApiError,
  ChatEventMap,
  FriendsChatConfig,
  FriendsChatProviderProps,
  FriendsChatContextValue,
};