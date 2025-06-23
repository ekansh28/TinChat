// src/app/chat/hooks/useFriendsChat.ts - COMPLETE FRIENDS CHAT INTEGRATION
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// ===== CORE INTERFACES =====

interface Friend {
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

interface ChatMessage {
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

interface TypingStatus {
  userId: string;
  friendId: string;
  isTyping: boolean;
  timestamp?: number;
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
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'reconnecting';
}

// ===== MAIN HOOK =====

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
    error: null,
    connectionStatus: 'disconnected'
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
      
      setState(prev => ({ ...prev, connectionStatus: 'connecting' }));
      
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
        
        setState(prev => ({ 
          ...prev, 
          connectionStatus: 'connected',
          error: null 
        }));
        
        // Join user's personal room for receiving messages
        socket.emit('friends_chat_join', {
          userId,
          authId
        });
      });

      socket.on('disconnect', (reason) => {
        console.log('❌ Disconnected from friends chat:', reason);
        
        setState(prev => ({ 
          ...prev, 
          connectionStatus: 'disconnected'
        }));
        
        if (reason === 'io server disconnect') {
          // Server initiated disconnect, try to reconnect
          scheduleReconnect();
        }
      });

      socket.on('connect_error', (error) => {
        console.error('❌ Friends chat connection error:', error);
        setState(prev => ({ 
          ...prev, 
          error: 'Connection failed',
          connectionStatus: 'disconnected'
        }));
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

      socket.on('friends_chat_history', (data) => {
        handleChatHistory(data);
      });

      socket.on('friends_chat_last_messages', (data) => {
        handleLastMessages(data);
      });

      socket.on('friends_chat_error', (data) => {
        console.error('❌ Friends chat error:', data);
        setState(prev => ({ ...prev, error: data.message }));
      });

      socketRef.current = socket;
    } catch (error) {
      console.error('❌ Failed to create socket connection:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to connect',
        connectionStatus: 'disconnected'
      }));
      scheduleReconnect();
    }
  }, [userId, authId]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    setState(prev => ({ ...prev, connectionStatus: 'reconnecting' }));

    reconnectTimeoutRef.current = setTimeout(() => {
      console.log('🔄 Attempting to reconnect to friends chat...');
      connectSocket();
    }, 3000);
  }, [connectSocket]);

  // ===== LOAD FRIENDS DATA =====

  const loadFriends = useCallback(async () => {
    if (!userId) return;

    try {
      setState(prev => ({ 
        ...prev, 
        loading: { ...prev.loading, friends: true },
        error: null 
      }));

      const response = await fetch(`/api/friends/${userId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch friends: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        const transformedFriends: Friend[] = data.friends.map((friend: any) => ({
          id: friend.id,
          username: friend.username,
          display_name: friend.display_name || friend.username,
          avatar_url: friend.avatar_url,
          status: friend.status || 'offline',
          last_seen: friend.last_seen,
          is_online: friend.is_online || false,
          friends_since: friend.friends_since,
          unreadCount: 0
        }));

        setState(prev => ({
          ...prev,
          friends: transformedFriends,
          loading: { ...prev.loading, friends: false }
        }));

        console.log(`✅ Loaded ${transformedFriends.length} friends`);
      } else {
        throw new Error(data.message || 'Failed to fetch friends');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('❌ Failed to fetch friends:', errorMessage);
      setState(prev => ({
        ...prev,
        error: errorMessage,
        loading: { ...prev.loading, friends: false }
      }));
    }
  }, [userId]);

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
      unreadCounts: {
        ...prev.unreadCounts,
        [friendId]: (prev.unreadCounts[friendId] || 0) + 1
      }
    }));

    // Update friend's last message
    setState(prev => ({
      ...prev,
      friends: prev.friends.map(friend =>
        friend.id === friendId
          ? {
              ...friend,
              lastMessage: {
                text: message.message,
                timestamp: new Date(message.timestamp),
                isFromSelf: false,
                messageId: message.id
              },
              unreadCount: (prev.unreadCounts[friendId] || 0) + 1
            }
          : friend
      )
    }));

    console.log('📨 Received message from friend:', friendId);
  }, []);

  const handleMessageSent = useCallback((data: { message: ChatMessage; chatId: string }) => {
    const { message } = data;
    const friendId = message.receiverId;

    setState(prev => ({
      ...prev,
      messages: {
        ...prev.messages,
        [friendId]: [...(prev.messages[friendId] || []), message]
      }
    }));

    // Update friend's last message
    setState(prev => ({
      ...prev,
      friends: prev.friends.map(friend =>
        friend.id === friendId
          ? {
              ...friend,
              lastMessage: {
                text: message.message,
                timestamp: new Date(message.timestamp),
                isFromSelf: true,
                messageId: message.id
              }
            }
          : friend
      )
    }));

    console.log('📤 Message sent to friend:', friendId);
  }, []);

  const handleMessagesRead = useCallback((data: {
    readerId: string;
    messageIds: string[];
    chatId: string;
  }) => {
    const { readerId, messageIds } = data;

    setState(prev => ({
      ...prev,
      messages: {
        ...prev.messages,
        [readerId]: (prev.messages[readerId] || []).map(msg =>
          messageIds.includes(msg.id) ? { ...msg, read: true } : msg
        )
      },
      unreadCounts: {
        ...prev.unreadCounts,
        [readerId]: 0
      }
    }));

    console.log('📖 Messages marked as read by:', readerId);
  }, []);

  const handleTypingStart = useCallback((data: { userId: string; friendId: string }) => {
    const { userId: typingUserId } = data;

    setState(prev => ({
      ...prev,
      typingUsers: {
        ...prev.typingUsers,
        [typingUserId]: true
      }
    }));

    // Auto-clear typing after 5 seconds
    if (typingTimeoutRef.current[typingUserId]) {
      clearTimeout(typingTimeoutRef.current[typingUserId]);
    }

    typingTimeoutRef.current[typingUserId] = setTimeout(() => {
      setState(prev => ({
        ...prev,
        typingUsers: {
          ...prev.typingUsers,
          [typingUserId]: false
        }
      }));
      delete typingTimeoutRef.current[typingUserId];
    }, 5000);

    console.log('⌨️ Friend started typing:', typingUserId);
  }, []);

  const handleTypingStop = useCallback((data: { userId: string; friendId: string }) => {
    const { userId: typingUserId } = data;

    setState(prev => ({
      ...prev,
      typingUsers: {
        ...prev.typingUsers,
        [typingUserId]: false
      }
    }));

    if (typingTimeoutRef.current[typingUserId]) {
      clearTimeout(typingTimeoutRef.current[typingUserId]);
      delete typingTimeoutRef.current[typingUserId];
    }

    console.log('⌨️ Friend stopped typing:', typingUserId);
  }, []);

  const handleUnreadCounts = useCallback((data: {
    userId: string;
    unreadCounts: Record<string, number>;
  }) => {
    const { unreadCounts } = data;

    setState(prev => ({
      ...prev,
      unreadCounts,
      friends: prev.friends.map(friend => ({
        ...friend,
        unreadCount: unreadCounts[friend.id] || 0
      }))
    }));

    console.log('📊 Updated unread counts:', unreadCounts);
  }, []);

  const handleChatHistory = useCallback((data: {
    chatId: string;
    messages: ChatMessage[];
    hasMore: boolean;
    offset: number;
  }) => {
    const { messages } = data;
    
    if (messages.length > 0) {
      const friendId = messages[0].senderId === userId ? messages[0].receiverId : messages[0].senderId;
      
      setState(prev => ({
        ...prev,
        messages: {
          ...prev.messages,
          [friendId]: messages.sort((a, b) => a.timestamp - b.timestamp)
        },
        loading: {
          ...prev.loading,
          messages: {
            ...prev.loading.messages,
            [friendId]: false
          }
        }
      }));
      
      console.log(`📚 Loaded ${messages.length} messages for friend:`, friendId);
    }
  }, [userId]);

  const handleLastMessages = useCallback((data: {
    userId: string;
    lastMessages: Record<string, ChatMessage | null>;
  }) => {
    const { lastMessages } = data;

    setState(prev => ({
      ...prev,
      friends: prev.friends.map(friend => {
        const lastMessage = lastMessages[friend.id];
        return lastMessage ? {
          ...friend,
          lastMessage: {
            text: lastMessage.message,
            timestamp: new Date(lastMessage.timestamp),
            isFromSelf: lastMessage.senderId === userId,
            messageId: lastMessage.id
          }
        } : friend;
      })
    }));

    console.log('📬 Updated last messages for friends');
  }, [userId]);

  // ===== ACTION FUNCTIONS =====

  const sendMessage = useCallback((friendId: string, message: string): boolean => {
    if (!socketRef.current?.connected || !message.trim()) {
      console.warn('Cannot send message - socket not connected or empty message');
      return false;
    }

    try {
      socketRef.current.emit('friends_chat_send', {
        senderId: userId,
        receiverId: friendId,
        message: message.trim(),
        authId
      });

      console.log('📤 Sending message to:', friendId);
      return true;
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      return false;
    }
  }, [userId, authId]);

  const markMessagesAsRead = useCallback((friendId: string, messageIds: string[]) => {
    if (!socketRef.current?.connected) {
      console.warn('Cannot mark messages as read - socket not connected');
      return;
    }

    try {
      socketRef.current.emit('friends_chat_mark_read', {
        userId,
        friendId,
        messageIds
      });

      console.log('📖 Marking messages as read for:', friendId);
    } catch (error) {
      console.error('❌ Failed to mark messages as read:', error);
    }
  }, [userId]);

  const startTyping = useCallback((friendId: string) => {
    if (!socketRef.current?.connected) {
      return;
    }

    try {
      socketRef.current.emit('friends_chat_typing_start', {
        userId,
        friendId
      });

      console.log('⌨️ Started typing to:', friendId);
    } catch (error) {
      console.error('❌ Failed to start typing:', error);
    }
  }, [userId]);

  const stopTyping = useCallback((friendId: string) => {
    if (!socketRef.current?.connected) {
      return;
    }

    try {
      socketRef.current.emit('friends_chat_typing_stop', {
        userId,
        friendId
      });

      console.log('⌨️ Stopped typing to:', friendId);
    } catch (error) {
      console.error('❌ Failed to stop typing:', error);
    }
  }, [userId]);

  const loadChatHistory = useCallback(async (friendId: string, limit: number = 50, offset: number = 0) => {
    if (!socketRef.current?.connected) {
      console.warn('Cannot load chat history - socket not connected');
      return;
    }

    setState(prev => ({
      ...prev,
      loading: {
        ...prev.loading,
        messages: {
          ...prev.loading.messages,
          [friendId]: true
        }
      }
    }));

    try {
      socketRef.current.emit('friends_chat_get_history', {
        userId,
        friendId,
        limit,
        offset
      });

      console.log('📚 Loading chat history for:', friendId);
    } catch (error) {
      console.error('❌ Failed to load chat history:', error);
      
      setState(prev => ({
        ...prev,
        loading: {
          ...prev.loading,
          messages: {
            ...prev.loading.messages,
            [friendId]: false
          }
        }
      }));
    }
  }, [userId]);

  const updateFriendStatus = useCallback((friendId: string, isOnline: boolean, status?: string) => {
    setState(prev => ({
      ...prev,
      friends: prev.friends.map(friend =>
        friend.id === friendId
          ? {
              ...friend,
              is_online: isOnline,
              status: (status as any) || friend.status,
              last_seen: isOnline ? friend.last_seen : new Date().toISOString()
            }
          : friend
      )
    }));

    console.log(`👤 Updated friend status: ${friendId} - ${isOnline ? 'online' : 'offline'}`);
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
    connectionStatus: state.connectionStatus,
    
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
    getStatusColor,
    getStatusText,
    validateMessage
  };
}

// ===== EXPORT TYPES FOR EXTERNAL USE =====

export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'reconnecting';

export type { Friend, ChatMessage, TypingStatus };

export interface UseFriendsChatReturn {
  // State
  friends: Friend[];
  messages: Record<string, ChatMessage[]>;
  unreadCounts: Record<string, number>;
  typingUsers: Record<string, boolean>;
  loading: FriendsChatState['loading'];
  error: string | null;
  connectionStatus: FriendsChatState['connectionStatus'];
  
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

export interface UseChatMessageUtilsReturn {
  formatMessageTime: (timestamp: Date) => string;
  formatLastSeen: (lastSeenStr: string) => string;
  getStatusColor: (status: string, isOnline: boolean) => string;
  getStatusText: (status: string, isOnline: boolean) => string;
  validateMessage: (text: string) => {
    isValid: boolean;
    error?: string;
    trimmed: string;
  };
}

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

// ===== ERROR HANDLING =====

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

// ===== ADDITIONAL UTILITY HOOKS =====

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