// src/services/FriendsService.ts - Frontend only, no server imports
'use client';

import { createClient } from '@supabase/supabase-js';
import React from 'react';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export interface Friend {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen?: Date;
  status?: 'online' | 'idle' | 'dnd' | 'offline';
  lastMessage?: {
    text: string;
    timestamp: Date;
    isFromSelf: boolean;
    messageId: string;
  };
}

export interface ChatMessage {
  id: string;
  friendId: string;
  text: string;
  isFromSelf: boolean;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read';
}

interface StoredChat {
  friendId: string;
  messages: ChatMessage[];
  lastUpdated: number;
}

interface CachedFriends {
  friends: Friend[];
  lastUpdated: number;
  cacheExpiry: number;
}

class FriendsService {
  private cache: Map<string, any> = new Map();
  private chatStorage: Map<string, ChatMessage[]> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly CHAT_RETENTION_DAYS = 1; // Keep chats for 1 day
  private readonly STORAGE_PREFIX = 'tinchat_';
  
  constructor() {
    this.loadFromLocalStorage();
    this.startCleanupInterval();
  }

  // ==================== FRIENDS MANAGEMENT ====================

  /**
   * Get friends list with caching
   */
  async getFriends(forceRefresh = false): Promise<Friend[]> {
    const cacheKey = 'friends_list';
    const cached = this.cache.get(cacheKey) as CachedFriends | undefined;
    
    // Return cached data if still valid and not forcing refresh
    if (!forceRefresh && cached && Date.now() < cached.cacheExpiry) {
      console.log('[FriendsService] Returning cached friends list');
      return cached.friends;
    }

    try {
      // Get current user's auth ID from Supabase session
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('[FriendsService] No authenticated user found');
        return [];
      }

      console.log('[FriendsService] Fetching fresh friends list from Supabase');
      
      // Fetch friends from Supabase using the friendships table
      const { data: friendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select(`
          friend_id,
          created_at,
          friend:user_profiles!friendships_friend_id_fkey (
            id,
            username,
            display_name,
            avatar_url,
            status,
            last_seen,
            is_online
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'accepted');

      if (friendshipsError) {
        throw new Error(`Failed to fetch friendships: ${friendshipsError.message}`);
      }

      // Transform the data into Friend objects
      const friends: Friend[] = (friendships || [])
        .filter(friendship => friendship.friend)
        .map(friendship => {
          const friend = friendship.friend as any;
          return {
            id: friend.id,
            username: friend.username,
            displayName: friend.display_name || friend.username,
            avatar: friend.avatar_url,
            isOnline: friend.is_online || false,
            lastSeen: friend.last_seen ? new Date(friend.last_seen) : undefined,
            status: friend.status || 'offline',
          };
        });

      // Update cache
      const cachedData: CachedFriends = {
        friends,
        lastUpdated: Date.now(),
        cacheExpiry: Date.now() + this.CACHE_DURATION,
      };
      
      this.cache.set(cacheKey, cachedData);
      this.saveToLocalStorage();

      console.log(`[FriendsService] Cached ${friends.length} friends`);
      return friends;

    } catch (error) {
      console.error('[FriendsService] Failed to fetch friends:', error);
      
      // Return cached data as fallback, even if expired
      if (cached) {
        console.log('[FriendsService] Returning stale cached data as fallback');
        return cached.friends;
      }
      
      return [];
    }
  }

  /**
   * Update friend's online status in cache
   */
  updateFriendStatus(friendId: string, isOnline: boolean, status?: string): void {
    const cacheKey = 'friends_list';
    const cached = this.cache.get(cacheKey) as CachedFriends | undefined;
    
    if (cached) {
      const friend = cached.friends.find(f => f.id === friendId);
      if (friend) {
        friend.isOnline = isOnline;
        friend.lastSeen = new Date();
        if (status) {
          friend.status = status as any;
        }
        
        this.cache.set(cacheKey, cached);
        this.saveToLocalStorage();
        console.log(`[FriendsService] Updated status for ${friendId}: ${isOnline ? 'online' : 'offline'}`);
      }
    }
  }

  /**
   * Update friend's last message in cache
   */
  updateFriendLastMessage(friendId: string, message: ChatMessage): void {
    const cacheKey = 'friends_list';
    const cached = this.cache.get(cacheKey) as CachedFriends | undefined;
    
    if (cached) {
      const friend = cached.friends.find(f => f.id === friendId);
      if (friend) {
        friend.lastMessage = {
          text: message.text,
          timestamp: message.timestamp,
          isFromSelf: message.isFromSelf,
          messageId: message.id,
        };
        
        this.cache.set(cacheKey, cached);
        this.saveToLocalStorage();
        console.log(`[FriendsService] Updated last message for ${friendId}`);
      }
    }
  }

  // ==================== CHAT MANAGEMENT ====================

  /**
   * Get chat messages for a specific friend
   */
  getChatMessages(friendId: string): ChatMessage[] {
    const messages = this.chatStorage.get(friendId) || [];
    
    // Filter out old messages (older than retention period)
    const cutoff = Date.now() - (this.CHAT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const validMessages = messages.filter(msg => msg.timestamp.getTime() > cutoff);
    
    // Update storage if we filtered out messages
    if (validMessages.length !== messages.length) {
      this.chatStorage.set(friendId, validMessages);
      this.saveToLocalStorage();
    }
    
    console.log(`[FriendsService] Retrieved ${validMessages.length} messages for ${friendId}`);
    return validMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Add a new message to chat
   */
  addChatMessage(friendId: string, message: Omit<ChatMessage, 'id'>): ChatMessage {
    const newMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...message,
    };

    const messages = this.chatStorage.get(friendId) || [];
    messages.push(newMessage);
    
    // Keep only messages within retention period
    const cutoff = Date.now() - (this.CHAT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const validMessages = messages.filter(msg => msg.timestamp.getTime() > cutoff);
    
    this.chatStorage.set(friendId, validMessages);
    this.saveToLocalStorage();
    
    // Update friend's last message in cache
    this.updateFriendLastMessage(friendId, newMessage);

    console.log(`[FriendsService] Added message for ${friendId}, total: ${validMessages.length}`);
    return newMessage;
  }

  /**
   * Mark messages as read
   */
  markMessagesAsRead(friendId: string, messageIds: string[]): void {
    const messages = this.chatStorage.get(friendId) || [];
    let updated = false;

    messages.forEach(msg => {
      if (messageIds.includes(msg.id) && msg.status !== 'read') {
        msg.status = 'read';
        updated = true;
      }
    });

    if (updated) {
      this.chatStorage.set(friendId, messages);
      this.saveToLocalStorage();
      console.log(`[FriendsService] Marked ${messageIds.length} messages as read for ${friendId}`);
    }
  }

  /**
   * Get unread message count for a friend
   */
  getUnreadCount(friendId: string): number {
    const messages = this.chatStorage.get(friendId) || [];
    return messages.filter(msg => !msg.isFromSelf && msg.status !== 'read').length;
  }

  /**
   * Clear chat history for a friend
   */
  clearChatHistory(friendId: string): void {
    this.chatStorage.delete(friendId);
    this.saveToLocalStorage();
    
    // Clear last message from friend cache
    const cacheKey = 'friends_list';
    const cached = this.cache.get(cacheKey) as CachedFriends | undefined;
    if (cached) {
      const friend = cached.friends.find(f => f.id === friendId);
      if (friend) {
        delete friend.lastMessage;
        this.cache.set(cacheKey, cached);
        this.saveToLocalStorage();
      }
    }
    
    console.log(`[FriendsService] Cleared chat history for ${friendId}`);
  }

  // ==================== SEARCH AND FILTERING ====================

  /**
   * Search friends by name or username
   */
  searchFriends(query: string, friends?: Friend[]): Friend[] {
    const friendsList = friends || this.cache.get('friends_list')?.friends || [];
    
    if (!query.trim()) {
      return friendsList;
    }

    const searchTerm = query.toLowerCase().trim();
    return friendsList.filter((friend: Friend) => 
      friend.displayName.toLowerCase().includes(searchTerm) ||
      friend.username.toLowerCase().includes(searchTerm)
    );
  }

  /**
   * Get online friends only
   */
  getOnlineFriends(): Friend[] {
    const cached = this.cache.get('friends_list') as CachedFriends | undefined;
    if (!cached) return [];
    
    return cached.friends.filter(friend => friend.isOnline);
  }

  /**
   * Sort friends by various criteria
   */
  sortFriends(friends: Friend[], sortBy: 'name' | 'status' | 'lastMessage' = 'lastMessage'): Friend[] {
    return [...friends].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.displayName.localeCompare(b.displayName);
        
        case 'status':
          // Online first, then by name
          if (a.isOnline !== b.isOnline) {
            return a.isOnline ? -1 : 1;
          }
          return a.displayName.localeCompare(b.displayName);
        
        case 'lastMessage':
        default:
          // Most recent message first, then by online status, then by name
          const aTime = a.lastMessage?.timestamp?.getTime() || 0;
          const bTime = b.lastMessage?.timestamp?.getTime() || 0;
          
          if (aTime !== bTime) {
            return bTime - aTime; // Most recent first
          }
          
          if (a.isOnline !== b.isOnline) {
            return a.isOnline ? -1 : 1;
          }
          
          return a.displayName.localeCompare(b.displayName);
      }
    });
  }

  // ==================== LOCAL STORAGE MANAGEMENT ====================

  /**
   * Save data to localStorage
   */
  private saveToLocalStorage(): void {
    try {
      // Save friends cache
      const friendsCache = this.cache.get('friends_list');
      if (friendsCache) {
        localStorage.setItem(
          `${this.STORAGE_PREFIX}friends`,
          JSON.stringify(friendsCache, this.dateReplacer)
        );
      }

      // Save chat storage
      const chatData: Record<string, StoredChat> = {};
      for (const [friendId, messages] of this.chatStorage.entries()) {
        chatData[friendId] = {
          friendId,
          messages,
          lastUpdated: Date.now(),
        };
      }
      
      localStorage.setItem(
        `${this.STORAGE_PREFIX}chats`,
        JSON.stringify(chatData, this.dateReplacer)
      );

      console.log('[FriendsService] Saved to localStorage');
    } catch (error) {
      console.error('[FriendsService] Failed to save to localStorage:', error);
    }
  }

  /**
   * Load data from localStorage
   */
  private loadFromLocalStorage(): void {
    try {
      // Load friends cache
      const friendsData = localStorage.getItem(`${this.STORAGE_PREFIX}friends`);
      if (friendsData) {
        const parsed = JSON.parse(friendsData, this.dateReviver) as CachedFriends;
        this.cache.set('friends_list', parsed);
        console.log(`[FriendsService] Loaded ${parsed.friends?.length || 0} friends from localStorage`);
      }

      // Load chat storage
      const chatData = localStorage.getItem(`${this.STORAGE_PREFIX}chats`);
      if (chatData) {
        const parsed = JSON.parse(chatData, this.dateReviver) as Record<string, StoredChat>;
        
        for (const [friendId, storedChat] of Object.entries(parsed)) {
          // Filter out old messages during load
          const cutoff = Date.now() - (this.CHAT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
          const validMessages = storedChat.messages.filter(msg => 
            msg.timestamp.getTime() > cutoff
          );
          
          if (validMessages.length > 0) {
            this.chatStorage.set(friendId, validMessages);
          }
        }
        
        console.log(`[FriendsService] Loaded chats for ${this.chatStorage.size} friends from localStorage`);
      }
    } catch (error) {
      console.error('[FriendsService] Failed to load from localStorage:', error);
      // Clear corrupted data
      this.clearLocalStorage();
    }
  }

  /**
   * Clear all localStorage data
   */
  clearLocalStorage(): void {
    try {
      localStorage.removeItem(`${this.STORAGE_PREFIX}friends`);
      localStorage.removeItem(`${this.STORAGE_PREFIX}chats`);
      console.log('[FriendsService] Cleared localStorage');
    } catch (error) {
      console.error('[FriendsService] Failed to clear localStorage:', error);
    }
  }

  /**
   * Date replacer for JSON.stringify
   */
  private dateReplacer(key: string, value: any): any {
    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() };
    }
    return value;
  }

  /**
   * Date reviver for JSON.parse
   */
  private dateReviver(key: string, value: any): any {
    if (value && typeof value === 'object' && value.__type === 'Date') {
      return new Date(value.value);
    }
    return value;
  }

  // ==================== CLEANUP AND MAINTENANCE ====================

  /**
   * Start automatic cleanup interval
   */
  private startCleanupInterval(): void {
    // Clean up old messages every hour
    setInterval(() => {
      this.cleanupOldMessages();
    }, 60 * 60 * 1000);

    // Initial cleanup
    setTimeout(() => {
      this.cleanupOldMessages();
    }, 5000);
  }

  /**
   * Clean up old messages
   */
  private cleanupOldMessages(): void {
    const cutoff = Date.now() - (this.CHAT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    let totalCleaned = 0;

    for (const [friendId, messages] of this.chatStorage.entries()) {
      const originalLength = messages.length;
      const validMessages = messages.filter(msg => msg.timestamp.getTime() > cutoff);
      
      if (validMessages.length !== originalLength) {
        if (validMessages.length === 0) {
          this.chatStorage.delete(friendId);
        } else {
          this.chatStorage.set(friendId, validMessages);
        }
        totalCleaned += (originalLength - validMessages.length);
      }
    }

    if (totalCleaned > 0) {
      this.saveToLocalStorage();
      console.log(`[FriendsService] Cleaned up ${totalCleaned} old messages`);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    friendsCount: number;
    chatCount: number;
    totalMessages: number;
    cacheAge: number;
    storageSize: string;
  } {
    const cached = this.cache.get('friends_list') as CachedFriends | undefined;
    const friendsCount = cached?.friends?.length || 0;
    const chatCount = this.chatStorage.size;
    const totalMessages = Array.from(this.chatStorage.values())
      .reduce((sum, messages) => sum + messages.length, 0);
    const cacheAge = cached ? Date.now() - cached.lastUpdated : 0;

    // Estimate storage size
    let storageSize = '0B';
    try {
      const friendsData = localStorage.getItem(`${this.STORAGE_PREFIX}friends`);
      const chatData = localStorage.getItem(`${this.STORAGE_PREFIX}chats`);
      const totalBytes = (friendsData?.length || 0) + (chatData?.length || 0);
      
      if (totalBytes > 1024 * 1024) {
        storageSize = `${(totalBytes / (1024 * 1024)).toFixed(2)}MB`;
      } else if (totalBytes > 1024) {
        storageSize = `${(totalBytes / 1024).toFixed(2)}KB`;
      } else {
        storageSize = `${totalBytes}B`;
      }
    } catch (error) {
      // Ignore storage size calculation errors
    }

    return {
      friendsCount,
      chatCount,
      totalMessages,
      cacheAge,
      storageSize,
    };
  }

  /**
   * Force refresh all cached data
   */
  async refreshCache(): Promise<void> {
    console.log('[FriendsService] Force refreshing cache...');
    
    // Clear current cache
    this.cache.clear();
    
    // Fetch fresh data
    await this.getFriends(true);
    
    console.log('[FriendsService] Cache refresh complete');
  }

  /**
   * Cleanup when service is destroyed
   */
  destroy(): void {
    // Save any pending data
    this.saveToLocalStorage();
    
    // Clear memory
    this.cache.clear();
    this.chatStorage.clear();
    
    console.log('[FriendsService] Service destroyed');
  }
}

// Export singleton instance
export const friendsService = new FriendsService();

// ==================== REACT HOOKS ====================

/**
 * React hook for managing friends data
 */
export function useFriends() {
  const [friends, setFriends] = React.useState<Friend[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadFriends = React.useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      const friendsList = await friendsService.getFriends(forceRefresh);
      setFriends(friendsList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load friends');
      console.error('[useFriends] Error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateFriendStatus = React.useCallback((friendId: string, isOnline: boolean, status?: string) => {
    friendsService.updateFriendStatus(friendId, isOnline, status);
    setFriends(prev => prev.map(friend => 
      friend.id === friendId 
        ? { ...friend, isOnline, lastSeen: new Date(), status: status as any || friend.status }
        : friend
    ));
  }, []);

  React.useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  return {
    friends,
    loading,
    error,
    refresh: () => loadFriends(true),
    updateStatus: updateFriendStatus,
  };
}

/**
 * React hook for managing chat messages
 */
export function useChat(friendId: string) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (friendId) {
      setLoading(true);
      const chatMessages = friendsService.getChatMessages(friendId);
      setMessages(chatMessages);
      setLoading(false);
    }
  }, [friendId]);

  const sendMessage = React.useCallback((text: string) => {
    if (!friendId || !text.trim()) return null;

    const message = friendsService.addChatMessage(friendId, {
      friendId,
      text: text.trim(),
      isFromSelf: true,
      timestamp: new Date(),
      status: 'sent',
    });

    setMessages(prev => [...prev, message]);
    return message;
  }, [friendId]);

  const receiveMessage = React.useCallback((text: string, messageId?: string) => {
    if (!friendId || !text.trim()) return null;

    const message = friendsService.addChatMessage(friendId, {
      friendId,
      text: text.trim(),
      isFromSelf: false,
      timestamp: new Date(),
      status: 'delivered',
    });

    if (messageId) {
      message.id = messageId;
    }

    setMessages(prev => [...prev, message]);
    return message;
  }, [friendId]);

  const markAsRead = React.useCallback((messageIds: string[]) => {
    friendsService.markMessagesAsRead(friendId, messageIds);
    setMessages(prev => prev.map(msg => 
      messageIds.includes(msg.id) ? { ...msg, status: 'read' } : msg
    ));
  }, [friendId]);

  const getUnreadCount = React.useCallback(() => {
    return friendsService.getUnreadCount(friendId);
  }, [friendId]);

  return {
    messages,
    loading,
    sendMessage,
    receiveMessage,
    markAsRead,
    getUnreadCount,
    clearHistory: () => {
      friendsService.clearChatHistory(friendId);
      setMessages([]);
    },
  };
}