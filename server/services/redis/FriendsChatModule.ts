// server/services/redis/FriendsChatModule.ts - FRIENDS CHAT REDIS CACHING
import { RedisCache } from './RedisCache';
import { RedisConfig } from './RedisConfig';
import { logger } from '../../utils/logger';

export interface FriendChatMessage {
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

export interface ChatHistoryResponse {
  messages: FriendChatMessage[];
  hasMore: boolean;
  totalCount: number;
}

export interface UnreadCounts {
  [friendId: string]: number;
}

export class FriendsChatModule {
  private cache: RedisCache;
  private readonly CHAT_TTL = 24 * 60 * 60; // 24 hours
  private readonly LAST_MESSAGE_TTL = 7 * 24 * 60 * 60; // 7 days
  private readonly TYPING_TTL = 5; // 5 seconds
  private readonly MAX_MESSAGES_PER_CHAT = 1000;

  constructor(cache: RedisCache) {
    this.cache = cache;
  }

  /**
   * Store a chat message with 24h TTL
   */
  async storeChatMessage(message: FriendChatMessage): Promise<boolean> {
    try {
      const chatId = this.getChatId(message.senderId, message.receiverId);
      const messagesKey = RedisConfig.buildKey('friends_chat', chatId, 'messages');
      
      // Store message in sorted set ordered by timestamp
      const success = await this.cache.set(
        `${messagesKey}:${message.id}`,
        message,
        this.CHAT_TTL
      );

      if (success) {
        // Also add to chat timeline
        await this.addToTimeline(chatId, message);
        
        // Update last message cache
        await this.updateLastMessage(chatId, message);
        
        // Update unread count for receiver
        await this.incrementUnreadCount(message.receiverId, message.senderId);
        
        logger.debug(`💬 Stored chat message: ${message.senderId} -> ${message.receiverId}`);
      }

      return success;
    } catch (error) {
      logger.error('❌ Failed to store chat message:', error);
      return false;
    }
  }

  /**
   * Get chat history between two users
   */
  async getChatHistory(
    userId: string,
    friendId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ChatHistoryResponse> {
    try {
      const chatId = this.getChatId(userId, friendId);
      const timelineKey = RedisConfig.buildKey('friends_chat', chatId, 'timeline');
      
      // Get message IDs from timeline (sorted by timestamp)
      const messageIds = await this.getFromTimeline(timelineKey, limit, offset);
      
      if (messageIds.length === 0) {
        return {
          messages: [],
          hasMore: false,
          totalCount: 0
        };
      }

      // Fetch message details
      const messages: FriendChatMessage[] = [];
      for (const messageId of messageIds) {
        const messageKey = RedisConfig.buildKey('friends_chat', chatId, 'messages', messageId);
        const message = await this.cache.get<FriendChatMessage>(messageKey);
        if (message) {
          messages.push(message);
        }
      }

      // Get total count for pagination
      const totalCount = await this.getTimelineCount(timelineKey);
      const hasMore = offset + messages.length < totalCount;

      logger.debug(`📚 Retrieved ${messages.length} messages for chat ${chatId}`);

      return {
        messages: messages.sort((a, b) => a.timestamp - b.timestamp), // Chronological order
        hasMore,
        totalCount
      };
    } catch (error) {
      logger.error('❌ Failed to get chat history:', error);
      return {
        messages: [],
        hasMore: false,
        totalCount: 0
      };
    }
  }

  /**
   * Get the last message between two users
   */
  async getLastMessage(userId: string, friendId: string): Promise<FriendChatMessage | null> {
    try {
      const chatId = this.getChatId(userId, friendId);
      const lastMessageKey = RedisConfig.buildKey('friends_chat', 'last', chatId);
      
      const message = await this.cache.get<FriendChatMessage>(lastMessageKey);
      
      if (message) {
        logger.debug(`📬 Last message retrieved for chat ${chatId}`);
        return message;
      }
      
      return null;
    } catch (error) {
      logger.error('❌ Failed to get last message:', error);
      return null;
    }
  }

  /**
   * Get last messages for multiple friends (for friends list)
   */
  async getLastMessages(userId: string, friendIds: string[]): Promise<Record<string, FriendChatMessage | null>> {
    try {
      const results: Record<string, FriendChatMessage | null> = {};
      
      // Batch get last messages
      const keys = friendIds.map(friendId => {
        const chatId = this.getChatId(userId, friendId);
        return RedisConfig.buildKey('friends_chat', 'last', chatId);
      });
      
      const messages = await this.cache.batchGet<FriendChatMessage>(keys);
      
      friendIds.forEach((friendId, index) => {
        results[friendId] = messages[index];
      });
      
      logger.debug(`📬 Retrieved last messages for ${friendIds.length} friends`);
      return results;
    } catch (error) {
      logger.error('❌ Failed to get last messages:', error);
      return {};
    }
  }

  /**
   * Mark messages as read and clear unread count
   */
  async markMessagesAsRead(userId: string, friendId: string, messageIds: string[]): Promise<boolean> {
    try {
      // Clear unread count
      const unreadKey = RedisConfig.buildKey('friends_chat', 'unread', userId, friendId);
      await this.cache.del(unreadKey);
      
      // Mark individual messages as read (for detailed tracking)
      const readOperations = messageIds.map(messageId => ({
        key: RedisConfig.buildKey('friends_chat', 'read', messageId, userId),
        value: { readAt: Date.now(), userId },
        ttl: this.CHAT_TTL
      }));
      
      const success = await this.cache.batchSet(readOperations);
      
      if (success) {
        logger.debug(`📖 Marked ${messageIds.length} messages as read for ${userId}`);
      }
      
      return success;
    } catch (error) {
      logger.error('❌ Failed to mark messages as read:', error);
      return false;
    }
  }

  /**
   * Get unread message counts for a user
   */
  async getUnreadCounts(userId: string): Promise<UnreadCounts> {
    try {
      const pattern = RedisConfig.buildKey('friends_chat', 'unread', userId, '*');
      
      // Note: In a real Redis implementation, you'd use SCAN to find keys
      // For now, we'll maintain a separate index of friends with unread messages
      const unreadIndexKey = RedisConfig.buildKey('friends_chat', 'unread_index', userId);
      const friendIds = await this.cache.get<string[]>(unreadIndexKey) || [];
      
      const unreadCounts: UnreadCounts = {};
      
      for (const friendId of friendIds) {
        const unreadKey = RedisConfig.buildKey('friends_chat', 'unread', userId, friendId);
        const count = await this.cache.get<number>(unreadKey);
        if (count && count > 0) {
          unreadCounts[friendId] = count;
        }
      }
      
      logger.debug(`📊 Retrieved unread counts for ${Object.keys(unreadCounts).length} friends`);
      return unreadCounts;
    } catch (error) {
      logger.error('❌ Failed to get unread counts:', error);
      return {};
    }
  }

  /**
   * Set typing status
   */
  async setTypingStatus(userId: string, friendId: string, isTyping: boolean): Promise<boolean> {
    try {
      const typingKey = RedisConfig.buildKey('friends_chat', 'typing', userId, friendId);
      
      if (isTyping) {
        const typingData = {
          userId,
          friendId,
          isTyping: true,
          timestamp: Date.now()
        };
        
        return await this.cache.set(typingKey, typingData, this.TYPING_TTL);
      } else {
        return await this.cache.del(typingKey);
      }
    } catch (error) {
      logger.error('❌ Failed to set typing status:', error);
      return false;
    }
  }

  /**
   * Get typing status
   */
  async getTypingStatus(userId: string, friendId: string): Promise<boolean> {
    try {
      const typingKey = RedisConfig.buildKey('friends_chat', 'typing', friendId, userId);
      const typingData = await this.cache.get(typingKey);
      
      return !!typingData;
    } catch (error) {
      logger.error('❌ Failed to get typing status:', error);
      return false;
    }
  }

  /**
   * Clean up old messages (older than 24h)
   */
  async cleanupOldMessages(): Promise<number> {
    try {
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
      let totalCleaned = 0;
      
      // Note: In a real implementation, you'd maintain an index of chat IDs
      // For this example, we'll assume you have a way to iterate through active chats
      
      logger.debug(`🧹 Starting chat message cleanup (cutoff: ${new Date(cutoffTime).toISOString()})`);
      
      // This is a placeholder - you'd need to implement chat discovery
      // based on your specific Redis key patterns
      
      return totalCleaned;
    } catch (error) {
      logger.error('❌ Failed to cleanup old messages:', error);
      return 0;
    }
  }

  /**
   * Get chat statistics
   */
  async getChatStats(): Promise<{
    totalChats: number;
    totalMessages: number;
    activeChatsLast24h: number;
    totalUnreadMessages: number;
  }> {
    try {
      // Placeholder implementation - you'd need to maintain these statistics
      // as you store messages and update chats
      
      return {
        totalChats: 0,
        totalMessages: 0,
        activeChatsLast24h: 0,
        totalUnreadMessages: 0
      };
    } catch (error) {
      logger.error('❌ Failed to get chat stats:', error);
      return {
        totalChats: 0,
        totalMessages: 0,
        activeChatsLast24h: 0,
        totalUnreadMessages: 0
      };
    }
  }

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Generate consistent chat ID for two users
   */
  private getChatId(user1: string, user2: string): string {
    return [user1, user2].sort().join('_');
  }

  /**
   * Add message to chat timeline (sorted by timestamp)
   */
  private async addToTimeline(chatId: string, message: FriendChatMessage): Promise<void> {
    try {
      const timelineKey = RedisConfig.buildKey('friends_chat', chatId, 'timeline');
      
      // Store message ID with timestamp as score for sorting
      // In a real Redis implementation, you'd use ZADD
      const timelineEntry = {
        messageId: message.id,
        timestamp: message.timestamp,
        senderId: message.senderId
      };
      
      // For now, we'll store as a simple array and sort later
      const existingTimeline = await this.cache.get<any[]>(timelineKey) || [];
      existingTimeline.push(timelineEntry);
      
      // Keep only recent messages
      if (existingTimeline.length > this.MAX_MESSAGES_PER_CHAT) {
        existingTimeline.sort((a, b) => b.timestamp - a.timestamp);
        existingTimeline.splice(this.MAX_MESSAGES_PER_CHAT);
      }
      
      await this.cache.set(timelineKey, existingTimeline, this.CHAT_TTL);
    } catch (error) {
      logger.error('❌ Failed to add to timeline:', error);
    }
  }

  /**
   * Get messages from timeline with pagination
   */
  private async getFromTimeline(timelineKey: string, limit: number, offset: number): Promise<string[]> {
    try {
      const timeline = await this.cache.get<any[]>(timelineKey) || [];
      
      // Sort by timestamp (newest first for offset/limit, then reverse for chronological)
      timeline.sort((a, b) => b.timestamp - a.timestamp);
      
      const slice = timeline.slice(offset, offset + limit);
      return slice.map(entry => entry.messageId);
    } catch (error) {
      logger.error('❌ Failed to get from timeline:', error);
      return [];
    }
  }

  /**
   * Get total message count from timeline
   */
  private async getTimelineCount(timelineKey: string): Promise<number> {
    try {
      const timeline = await this.cache.get<any[]>(timelineKey) || [];
      return timeline.length;
    } catch (error) {
      logger.error('❌ Failed to get timeline count:', error);
      return 0;
    }
  }

  /**
   * Update last message cache
   */
  private async updateLastMessage(chatId: string, message: FriendChatMessage): Promise<void> {
    try {
      const lastMessageKey = RedisConfig.buildKey('friends_chat', 'last', chatId);
      await this.cache.set(lastMessageKey, message, this.LAST_MESSAGE_TTL);
    } catch (error) {
      logger.error('❌ Failed to update last message:', error);
    }
  }

  /**
   * Increment unread count for a user
   */
  private async incrementUnreadCount(userId: string, senderId: string): Promise<void> {
    try {
      const unreadKey = RedisConfig.buildKey('friends_chat', 'unread', userId, senderId);
      
      // Get current count and increment
      const currentCount = await this.cache.get<number>(unreadKey) || 0;
      await this.cache.set(unreadKey, currentCount + 1, this.CHAT_TTL);
      
      // Update unread index
      const unreadIndexKey = RedisConfig.buildKey('friends_chat', 'unread_index', userId);
      const friendIds = await this.cache.get<string[]>(unreadIndexKey) || [];
      
      if (!friendIds.includes(senderId)) {
        friendIds.push(senderId);
        await this.cache.set(unreadIndexKey, friendIds, this.CHAT_TTL);
      }
    } catch (error) {
      logger.error('❌ Failed to increment unread count:', error);
    }
  }
}