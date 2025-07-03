// server/services/FriendsChatService.ts - FIXED VERSION WITH REDIS INTEGRATION
import { Server as SocketIOServer, Socket } from 'socket.io';
import { RedisService } from './RedisService';
import { ProfileManager } from '../managers/profile/ProfileManager';
import { FriendsChatModule } from './redis/FriendsChatModule';
import { logger } from '../utils/logger';

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

export interface FriendChatRoom {
  id: string;
  participants: string[];
  lastActivity: number;
  messages: FriendChatMessage[];
  unreadCount: { [userId: string]: number };
}

export interface TypingStatus {
  userId: string;
  friendId: string;
  isTyping: boolean;
  timestamp: number;
}

export class FriendsChatService {
  private io: SocketIOServer;
  private redisService: RedisService | null;
  private profileManager: ProfileManager;
  private friendsChatModule: FriendsChatModule | null = null;
  
  // In-memory cache for active chat rooms (Redis is primary storage)
  private activeChatRooms = new Map<string, FriendChatRoom>();
  private typingStatuses = new Map<string, TypingStatus>();
  
  // Cache TTL configurations
  private readonly TYPING_TTL = 5; // 5 seconds
  private readonly MAX_MESSAGES_PER_CHAT = 1000; // Limit messages per chat
  private readonly MESSAGE_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

  // Add cleanup interval tracking
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    io: SocketIOServer, 
    profileManager: ProfileManager, 
    redisService: RedisService | null = null
  ) {
    this.io = io;
    this.profileManager = profileManager;
    this.redisService = redisService;
    
    // ✅ FIXED: Initialize Redis chat module if Redis is available
    if (this.redisService) {
      try {
        // Access the Redis cache through the RedisService
        const redisCache = (this.redisService as any).cache;
        if (redisCache) {
          this.friendsChatModule = new FriendsChatModule(redisCache);
          logger.info('✅ FriendsChatService initialized with Redis persistence');
        } else {
          logger.warn('⚠️ Redis cache not available, using memory-only mode');
        }
      } catch (error) {
        logger.error('❌ Failed to initialize FriendsChatModule:', error);
        logger.warn('⚠️ Falling back to memory-only mode');
      }
    } else {
      logger.info('💬 FriendsChatService initialized in memory-only mode');
    }
    
    this.setupSocketHandlers();
    this.startMessageCleanup();
    
    logger.info('💬 FriendsChatService initialized with enhanced Redis integration');
  }

  // Setup socket.io event handlers for friends chat
  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      // Join user to their personal room for receiving messages
      socket.on('friends_chat_join', async (data: { userId: string; authId: string }) => {
        await this.handleUserJoin(socket, data);
      });

      // Send message to friend
      socket.on('friends_chat_send', async (data: {
        senderId: string;
        receiverId: string;
        message: string;
        authId: string;
      }) => {
        await this.handleSendMessage(socket, data);
      });

      // Mark messages as read
      socket.on('friends_chat_mark_read', async (data: {
        userId: string;
        friendId: string;
        messageIds: string[];
      }) => {
        await this.handleMarkMessagesRead(socket, data);
      });

      // Typing indicators
      socket.on('friends_chat_typing_start', async (data: {
        userId: string;
        friendId: string;
      }) => {
        await this.handleTypingStart(socket, data);
      });

      socket.on('friends_chat_typing_stop', async (data: {
        userId: string;
        friendId: string;
      }) => {
        await this.handleTypingStop(socket, data);
      });

      // Get chat history
      socket.on('friends_chat_get_history', async (data: {
        userId: string;
        friendId: string;
        limit?: number;
        offset?: number;
      }) => {
        await this.handleGetChatHistory(socket, data);
      });

      // Get last messages for friends list
      socket.on('friends_chat_get_last_messages', async (data: {
        userId: string;
        friendIds: string[];
      }) => {
        await this.handleGetLastMessages(socket, data);
      });

      // Leave chat room on disconnect
      socket.on('disconnect', () => {
        this.handleUserDisconnect(socket);
      });
    });
  }

  // Handle user joining their personal chat room
  private async handleUserJoin(socket: Socket, data: { userId: string; authId: string }): Promise<void> {
    try {
      const { userId, authId } = data;
      
      if (!userId || !authId) {
        socket.emit('friends_chat_error', { message: 'User ID and Auth ID are required' });
        return;
      }

      // Join user to their personal room for receiving friend messages
      const userRoom = `friends_user_${userId}`;
      socket.join(userRoom);
      
      // Store user mapping for this socket
      (socket as any).friendsChatUserId = userId;
      (socket as any).friendsChatAuthId = authId;
      
      logger.debug(`👤 User ${userId} joined friends chat`);
      
      // Send confirmation
      socket.emit('friends_chat_joined', {
        userId,
        userRoom,
        timestamp: Date.now()
      });
      
      // Send any unread message counts
      await this.sendUnreadCounts(socket, userId);
      
    } catch (error) {
      logger.error('❌ Error handling user join:', error);
      socket.emit('friends_chat_error', { message: 'Failed to join chat' });
    }
  }

  // Handle sending a message to a friend
  private async handleSendMessage(socket: Socket, data: {
    senderId: string;
    receiverId: string;
    message: string;
    authId: string;
  }): Promise<void> {
    try {
      const { senderId, receiverId, message, authId } = data;
      
      // Validate input
      if (!senderId || !receiverId || !message?.trim() || !authId) {
        socket.emit('friends_chat_error', { message: 'All fields are required' });
        return;
      }

      if (message.trim().length > 2000) {
        socket.emit('friends_chat_error', { message: 'Message too long (max 2000 characters)' });
        return;
      }

      // Check if users are friends
      const friendshipStatus = await this.profileManager.getFriendshipStatus(senderId, receiverId);
      if (friendshipStatus.status !== 'friends') {
        socket.emit('friends_chat_error', { message: 'You can only message friends' });
        return;
      }

      // Get sender profile for message display
      const senderProfile = await this.profileManager.fetchUserProfile(authId);
      
      // Create message
      const chatMessage: FriendChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        senderId,
        receiverId,
        message: message.trim(),
        timestamp: Date.now(),
        read: false,
        senderProfile: senderProfile ? {
          username: senderProfile.username || 'Unknown',
          displayName: senderProfile.display_name,
          avatarUrl: senderProfile.avatar_url,
          displayNameColor: senderProfile.display_name_color
        } : undefined
      };

      // ✅ FIXED: Store message using Redis if available, fallback to memory
      await this.storeMessage(chatMessage);
      
      // Send message to both users
      const senderRoom = `friends_user_${senderId}`;
      const receiverRoom = `friends_user_${receiverId}`;
      
      // Send to sender (confirmation)
      this.io.to(senderRoom).emit('friends_chat_message_sent', {
        message: chatMessage,
        chatId: this.getChatId(senderId, receiverId)
      });
      
      // Send to receiver (new message)
      this.io.to(receiverRoom).emit('friends_chat_message_received', {
        message: chatMessage,
        chatId: this.getChatId(senderId, receiverId)
      });
      
      // ✅ FIXED: Update last message cache using Redis if available
      await this.updateLastMessage(senderId, receiverId, chatMessage);
      
      logger.debug(`💬 Message sent: ${senderId} -> ${receiverId}`);
      
    } catch (error) {
      logger.error('❌ Error sending message:', error);
      socket.emit('friends_chat_error', { message: 'Failed to send message' });
    }
  }

  // Handle marking messages as read
  private async handleMarkMessagesRead(socket: Socket, data: {
    userId: string;
    friendId: string;
    messageIds: string[];
  }): Promise<void> {
    try {
      const { userId, friendId, messageIds } = data;
      
      if (!userId || !friendId || !Array.isArray(messageIds)) {
        socket.emit('friends_chat_error', { message: 'Invalid parameters for mark read' });
        return;
      }

      // ✅ FIXED: Mark messages as read using Redis if available
      await this.markMessagesAsRead(userId, friendId, messageIds);
      
      // Notify sender that messages were read
      const senderRoom = `friends_user_${friendId}`;
      this.io.to(senderRoom).emit('friends_chat_messages_read', {
        readerId: userId,
        messageIds,
        chatId: this.getChatId(userId, friendId)
      });
      
      // Send updated unread count to reader
      await this.sendUnreadCounts(socket, userId);
      
      logger.debug(`📖 Messages marked as read: ${userId} read ${messageIds.length} messages from ${friendId}`);
      
    } catch (error) {
      logger.error('❌ Error marking messages as read:', error);
      socket.emit('friends_chat_error', { message: 'Failed to mark messages as read' });
    }
  }

  // Handle typing start
  private async handleTypingStart(socket: Socket, data: {
    userId: string;
    friendId: string;
  }): Promise<void> {
    try {
      const { userId, friendId } = data;
      
      if (!userId || !friendId) {
        return;
      }

      const typingKey = `${userId}_to_${friendId}`;
      const typingStatus: TypingStatus = {
        userId,
        friendId,
        isTyping: true,
        timestamp: Date.now()
      };
      
      this.typingStatuses.set(typingKey, typingStatus);
      
      // ✅ FIXED: Cache in Redis with short TTL if available
      if (this.friendsChatModule) {
        await this.friendsChatModule.setTypingStatus(userId, friendId, true);
      }
      
      // Notify friend
      const friendRoom = `friends_user_${friendId}`;
      this.io.to(friendRoom).emit('friends_chat_typing_start', {
        userId,
        friendId,
        timestamp: Date.now()
      });
      
      // Auto-stop typing after 5 seconds
      setTimeout(() => {
        this.handleTypingStop(socket, { userId, friendId });
      }, 5000);
      
    } catch (error) {
      logger.error('❌ Error handling typing start:', error);
    }
  }

  // Handle typing stop
  private async handleTypingStop(socket: Socket, data: {
    userId: string;
    friendId: string;
  }): Promise<void> {
    try {
      const { userId, friendId } = data;
      
      if (!userId || !friendId) {
        return;
      }

      const typingKey = `${userId}_to_${friendId}`;
      this.typingStatuses.delete(typingKey);
      
      // ✅ FIXED: Remove from Redis if available
      if (this.friendsChatModule) {
        await this.friendsChatModule.setTypingStatus(userId, friendId, false);
      }
      
      // Notify friend
      const friendRoom = `friends_user_${friendId}`;
      this.io.to(friendRoom).emit('friends_chat_typing_stop', {
        userId,
        friendId,
        timestamp: Date.now()
      });
      
    } catch (error) {
      logger.error('❌ Error handling typing stop:', error);
    }
  }

  // Handle getting chat history
  private async handleGetChatHistory(socket: Socket, data: {
    userId: string;
    friendId: string;
    limit?: number;
    offset?: number;
  }): Promise<void> {
    try {
      const { userId, friendId, limit = 50, offset = 0 } = data;
      
      if (!userId || !friendId) {
        socket.emit('friends_chat_error', { message: 'User ID and Friend ID are required' });
        return;
      }

      // Check if users are friends
      const friendshipStatus = await this.profileManager.getFriendshipStatus(userId, friendId);
      if (friendshipStatus.status !== 'friends') {
        socket.emit('friends_chat_error', { message: 'You can only view chat history with friends' });
        return;
      }

      // ✅ FIXED: Get messages from Redis if available, fallback to memory
      const messages = await this.getChatHistory(userId, friendId, limit, offset);
      
      socket.emit('friends_chat_history', {
        chatId: this.getChatId(userId, friendId),
        messages: messages.messages,
        hasMore: messages.hasMore,
        offset: offset + messages.messages.length,
        totalCount: messages.totalCount
      });
      
      logger.debug(`📚 Chat history sent: ${userId} <-> ${friendId} (${messages.messages.length} messages)`);
      
    } catch (error) {
      logger.error('❌ Error getting chat history:', error);
      socket.emit('friends_chat_error', { message: 'Failed to get chat history' });
    }
  }

  // Handle getting last messages for friends list
  private async handleGetLastMessages(socket: Socket, data: {
    userId: string;
    friendIds: string[];
  }): Promise<void> {
    try {
      const { userId, friendIds } = data;
      
      if (!userId || !Array.isArray(friendIds)) {
        socket.emit('friends_chat_error', { message: 'Invalid parameters for last messages' });
        return;
      }

      // ✅ FIXED: Get last messages using Redis if available
      const lastMessages = await this.getLastMessages(userId, friendIds);
      
      socket.emit('friends_chat_last_messages', {
        userId,
        lastMessages
      });
      
      logger.debug(`📬 Last messages sent for ${friendIds.length} friends`);
      
    } catch (error) {
      logger.error('❌ Error getting last messages:', error);
      socket.emit('friends_chat_error', { message: 'Failed to get last messages' });
    }
  }

  // Handle user disconnect
  private handleUserDisconnect(socket: Socket): void {
    const userId = (socket as any).friendsChatUserId;
    
    if (userId) {
      // Clear any typing statuses for this user
      for (const [key, typing] of this.typingStatuses.entries()) {
        if (typing.userId === userId) {
          this.typingStatuses.delete(key);
          
          // Notify friend that typing stopped
          const friendRoom = `friends_user_${typing.friendId}`;
          this.io.to(friendRoom).emit('friends_chat_typing_stop', {
            userId: typing.userId,
            friendId: typing.friendId,
            timestamp: Date.now()
          });
        }
      }
      
      logger.debug(`👋 User ${userId} disconnected from friends chat`);
    }
  }

  // ✅ FIXED: Store message with Redis integration
  private async storeMessage(message: FriendChatMessage): Promise<void> {
    try {
      // Store in Redis if available
      if (this.friendsChatModule) {
        const success = await this.friendsChatModule.storeChatMessage(message);
        if (success) {
          logger.debug(`📋 Message stored in Redis: ${message.senderId} -> ${message.receiverId}`);
        } else {
          logger.warn(`⚠️ Failed to store message in Redis, using memory fallback`);
          this.updateMemoryCache(this.getChatId(message.senderId, message.receiverId), message);
        }
      } else {
        // Fallback to memory storage
        this.updateMemoryCache(this.getChatId(message.senderId, message.receiverId), message);
      }
    } catch (error) {
      logger.error('❌ Error storing message:', error);
      // Fallback to memory storage
      this.updateMemoryCache(this.getChatId(message.senderId, message.receiverId), message);
    }
  }

  // Update memory cache with new message (fallback)
  private updateMemoryCache(chatId: string, message: FriendChatMessage): void {
    let room = this.activeChatRooms.get(chatId);
    
    if (!room) {
      room = {
        id: chatId,
        participants: [message.senderId, message.receiverId],
        lastActivity: Date.now(),
        messages: [],
        unreadCount: {}
      };
      this.activeChatRooms.set(chatId, room);
    }
    
    room.messages.push(message);
    room.lastActivity = Date.now();
    
    // Keep only recent messages in memory
    if (room.messages.length > 100) {
      room.messages = room.messages.slice(-50);
    }
    
    // Update unread count
    room.unreadCount[message.receiverId] = (room.unreadCount[message.receiverId] || 0) + 1;
  }

  // ✅ FIXED: Mark messages as read with Redis integration
  private async markMessagesAsRead(userId: string, friendId: string, messageIds: string[]): Promise<void> {
    try {
      if (this.friendsChatModule) {
        const success = await this.friendsChatModule.markMessagesAsRead(userId, friendId, messageIds);
        if (!success) {
          logger.warn(`⚠️ Failed to mark messages as read in Redis, using memory fallback`);
          this.markMessagesAsReadInMemory(userId, friendId, messageIds);
        }
      } else {
        // Fallback to memory
        this.markMessagesAsReadInMemory(userId, friendId, messageIds);
      }
    } catch (error) {
      logger.error('❌ Error marking messages as read:', error);
      // Fallback to memory
      this.markMessagesAsReadInMemory(userId, friendId, messageIds);
    }
  }

  // Mark messages as read in memory (fallback)
  private markMessagesAsReadInMemory(userId: string, friendId: string, messageIds: string[]): void {
    const chatId = this.getChatId(userId, friendId);
    const room = this.activeChatRooms.get(chatId);
    if (room) {
      room.unreadCount[userId] = 0;
    }
  }

  // ✅ FIXED: Get chat history with Redis integration
  private async getChatHistory(
    userId: string, 
    friendId: string, 
    limit: number, 
    offset: number
  ): Promise<{
    messages: FriendChatMessage[];
    hasMore: boolean;
    totalCount: number;
  }> {
    try {
      if (this.friendsChatModule) {
        const result = await this.friendsChatModule.getChatHistory(userId, friendId, limit, offset);
        if (result.messages.length > 0 || offset === 0) {
          return result;
        }
      }
      
      // Fallback to memory cache
      const chatId = this.getChatId(userId, friendId);
      const room = this.activeChatRooms.get(chatId);
      
      if (room) {
        const start = Math.max(0, room.messages.length - offset - limit);
        const end = room.messages.length - offset;
        const messages = room.messages.slice(start, end);
        
        return {
          messages,
          hasMore: start > 0,
          totalCount: room.messages.length
        };
      }
      
      return {
        messages: [],
        hasMore: false,
        totalCount: 0
      };
    } catch (error) {
      logger.error('❌ Error getting chat history:', error);
      return {
        messages: [],
        hasMore: false,
        totalCount: 0
      };
    }
  }

  // ✅ FIXED: Get last messages with Redis integration
  private async getLastMessages(userId: string, friendIds: string[]): Promise<Record<string, FriendChatMessage | null>> {
    try {
      if (this.friendsChatModule) {
        const result = await this.friendsChatModule.getLastMessages(userId, friendIds);
        if (Object.keys(result).length > 0) {
          return result;
        }
      }
      
      // Fallback to memory cache
      const results: Record<string, FriendChatMessage | null> = {};
      
      for (const friendId of friendIds) {
        const chatId = this.getChatId(userId, friendId);
        const room = this.activeChatRooms.get(chatId);
        
        if (room && room.messages.length > 0) {
          results[friendId] = room.messages[room.messages.length - 1];
        } else {
          results[friendId] = null;
        }
      }
      
      return results;
    } catch (error) {
      logger.error('❌ Error getting last messages:', error);
      return {};
    }
  }

  // ✅ FIXED: Update last message with Redis integration
  private async updateLastMessage(senderId: string, receiverId: string, message: FriendChatMessage): Promise<void> {
    try {
      if (this.friendsChatModule) {
        // This is handled automatically by the Redis module when storing the message
        logger.debug(`📬 Last message cache updated via Redis for ${senderId} <-> ${receiverId}`);
      }
      // Memory cache is updated in updateMemoryCache method
    } catch (error) {
      logger.error('❌ Error updating last message:', error);
    }
  }

  // ✅ FIXED: Send unread counts with Redis integration
  private async sendUnreadCounts(socket: Socket, userId: string): Promise<void> {
    try {
      let unreadCounts: Record<string, number> = {};
      
      if (this.friendsChatModule) {
        unreadCounts = await this.friendsChatModule.getUnreadCounts(userId);
      } else {
        // Fallback to memory cache
        for (const [chatId, room] of this.activeChatRooms.entries()) {
          if (room.participants.includes(userId)) {
            const friendId = room.participants.find(p => p !== userId);
            if (friendId && room.unreadCount[userId]) {
              unreadCounts[friendId] = room.unreadCount[userId];
            }
          }
        }
      }
      
      socket.emit('friends_chat_unread_counts', {
        userId,
        unreadCounts
      });
      
    } catch (error) {
      logger.error('❌ Error sending unread counts:', error);
    }
  }

  // Generate consistent chat ID for two users
  private getChatId(user1: string, user2: string): string {
    return [user1, user2].sort().join('_');
  }

  // Start message cleanup interval
  private startMessageCleanup(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupOldMessages();
    }, this.MESSAGE_CLEANUP_INTERVAL);
  }

  // ✅ FIXED: Clean up messages with Redis integration
  private async cleanupOldMessages(): Promise<void> {
    try {
      let totalCleaned = 0;
      
      // Clean up Redis messages if available
      if (this.friendsChatModule) {
        totalCleaned = await this.friendsChatModule.cleanupOldMessages();
      }
      
      // Clean up memory cache
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
      
      for (const [chatId, room] of this.activeChatRooms.entries()) {
        const oldMessages = room.messages.filter(msg => msg.timestamp < cutoffTime);
        if (oldMessages.length > 0) {
          room.messages = room.messages.filter(msg => msg.timestamp >= cutoffTime);
          totalCleaned += oldMessages.length;
          logger.debug(`🧹 Cleaned ${oldMessages.length} old messages from memory cache for ${chatId}`);
        }
        
        // Remove inactive rooms
        if (Date.now() - room.lastActivity > 60 * 60 * 1000) { // 1 hour inactive
          this.activeChatRooms.delete(chatId);
          logger.debug(`🧹 Removed inactive chat room: ${chatId}`);
        }
      }
      
      if (totalCleaned > 0) {
        logger.info(`🧹 Cleaned up ${totalCleaned} old messages`);
      }
      
    } catch (error) {
      logger.error('❌ Error during message cleanup:', error);
    }
  }

  // Get service statistics
  public getStats(): {
    activeRooms: number;
    activeTyping: number;
    cacheSize: number;
    redisEnabled: boolean;
    memoryRooms: number;
    redisStats?: any;
  } {
    const stats = {
      activeRooms: this.activeChatRooms.size,
      activeTyping: this.typingStatuses.size,
      cacheSize: Array.from(this.activeChatRooms.values())
        .reduce((total, room) => total + room.messages.length, 0),
      redisEnabled: !!this.friendsChatModule,
      memoryRooms: this.activeChatRooms.size
    };

    // Add Redis stats if available
    if (this.friendsChatModule) {
      // Get Redis-specific stats
      this.friendsChatModule.getChatStats().then(redisStats => {
        (stats as any).redisStats = redisStats;
      }).catch(err => {
        logger.debug('Failed to get Redis chat stats:', err);
      });
    }

    return stats;
  }

  // ✅ FIXED: Enhanced destroy method
  public async destroy(): Promise<void> {
    logger.info('💬 Shutting down FriendsChatService...');
    
    try {
      // Clear cleanup interval
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }
      
      // Clear all typing statuses
      this.typingStatuses.clear();
      
      // Clear memory cache
      this.activeChatRooms.clear();
      
      // Note: Redis cleanup is handled by RedisService destroy method
      
      logger.info('✅ FriendsChatService shutdown complete');
    } catch (error) {
      logger.error('❌ Error during FriendsChatService shutdown:', error);
      throw error;
    }
  }

  // ✅ NEW: Get Redis module for advanced operations
  public getFriendsChatModule(): FriendsChatModule | null {
    return this.friendsChatModule;
  }

  // ✅ NEW: Health check method
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'down';
    redisEnabled: boolean;
    activeRooms: number;
    memoryUsage: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let status: 'healthy' | 'degraded' | 'down' = 'healthy';

    try {
      // Check Redis health if enabled
      if (this.redisService) {
        const redisHealth = await this.redisService.testConnection();
        if (!redisHealth) {
          errors.push('Redis connection failed');
          status = 'degraded';
        }
      }

      // Check memory usage
      const memoryUsage = Array.from(this.activeChatRooms.values())
        .reduce((total, room) => total + room.messages.length, 0);

      if (memoryUsage > 10000) { // Arbitrary threshold
        errors.push(`High memory usage: ${memoryUsage} cached messages`);
        if (status === 'healthy') status = 'degraded';
      }

      // Check if service is functional
      if (!this.io) {
        errors.push('Socket.IO server not available');
        status = 'down';
      }

      return {
        status,
        redisEnabled: !!this.friendsChatModule,
        activeRooms: this.activeChatRooms.size,
        memoryUsage,
        errors
      };
    } catch (error) {
      return {
        status: 'down',
        redisEnabled: false,
        activeRooms: 0,
        memoryUsage: 0,
        errors: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }
}