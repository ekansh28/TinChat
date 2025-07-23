// server/services/FriendsChatService.ts - COMPLETELY FIXED VERSION
import { Server as SocketIOServer, Socket } from 'socket.io';
import { RedisService } from './RedisService';
import { ProfileManager } from '../managers/profile/ProfileManager';
import { logger } from '../utils/logger';

// ============ INTERFACES ============

export interface FriendChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  message: string;
  timestamp: number;
  read: boolean;
  messageType?: 'text' | 'image' | 'file' | 'system';
  metadata?: Record<string, any>;
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
  isActive: boolean;
}

export interface TypingStatus {
  userId: string;
  friendId: string;
  isTyping: boolean;
  timestamp: number;
}

export interface ChatPresence {
  userId: string;
  isOnline: boolean;
  lastSeen: number;
  currentlyTyping: string[]; // friend IDs user is typing to
}

// ============ MAIN SERVICE CLASS ============

export class FriendsChatService {
  private io: SocketIOServer;
  private redisService: RedisService | null;
  private profileManager: ProfileManager;
  
  // In-memory stores (Redis is primary, these are fallback)
  private activeChatRooms = new Map<string, FriendChatRoom>();
  private typingStatuses = new Map<string, TypingStatus>();
  private userPresence = new Map<string, ChatPresence>();
  private connectedUsers = new Map<string, Set<string>>(); // userId -> Set of socket IDs
  
  // Configuration
  private readonly CONFIG = {
    TYPING_TTL: 5, // seconds
    MAX_MESSAGES_PER_CHAT: 1000,
    MESSAGE_CLEANUP_INTERVAL: 60 * 60 * 1000, // 1 hour
    PRESENCE_UPDATE_INTERVAL: 30 * 1000, // 30 seconds
    MAX_MESSAGE_LENGTH: 2000,
    RATE_LIMIT_MESSAGES_PER_MINUTE: 60
  };

  // Cleanup intervals
  private cleanupInterval: NodeJS.Timeout | null = null;
  private presenceInterval: NodeJS.Timeout | null = null;

  // Rate limiting
  private rateLimitStore = new Map<string, { count: number; resetTime: number }>();

  constructor(
    io: SocketIOServer, 
    profileManager: ProfileManager, 
    redisService: RedisService | null = null
  ) {
    this.io = io;
    this.profileManager = profileManager;
    this.redisService = redisService;
    
    this.setupSocketHandlers();
    this.startBackgroundTasks();
    
    logger.info('💬 FriendsChatService initialized with enhanced features');
  }

  // ============ SOCKET SETUP ============

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      logger.debug(`🔌 Socket connected: ${socket.id}`);

      // Store socket user info when they join
      socket.on('friends_chat_join', async (data: { userId: string; authId: string }) => {
        await this.handleUserJoin(socket, data);
      });

      // Message handling
      socket.on('friends_chat_send', async (data: {
        senderId: string;
        receiverId: string;
        message: string;
        authId: string;
        messageType?: string;
      }) => {
        await this.handleSendMessage(socket, data);
      });

      // Message read status
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

      // Chat history
      socket.on('friends_chat_get_history', async (data: {
        userId: string;
        friendId: string;
        limit?: number;
        offset?: number;
        beforeTimestamp?: number;
      }) => {
        await this.handleGetChatHistory(socket, data);
      });

      // Batch operations
      socket.on('friends_chat_get_last_messages', async (data: {
        userId: string;
        friendIds: string[];
      }) => {
        await this.handleGetLastMessages(socket, data);
      });

      socket.on('friends_chat_get_unread_counts', async (data: {
        userId: string;
      }) => {
        await this.handleGetUnreadCounts(socket, data);
      });

      // Presence management
      socket.on('friends_chat_update_presence', async (data: {
        userId: string;
        isOnline: boolean;
        status?: string;
      }) => {
        await this.handleUpdatePresence(socket, data);
      });

      // Disconnect handling
      socket.on('disconnect', (reason) => {
        this.handleUserDisconnect(socket, reason);
      });

      // Error handling
      socket.on('error', (error) => {
        logger.error(`🔌 Socket error for ${socket.id}:`, error);
      });
    });
  }

  // ============ EVENT HANDLERS ============

  private async handleUserJoin(socket: Socket, data: { userId: string; authId: string }): Promise<void> {
    try {
      const { userId, authId } = data;
      
      if (!userId || !authId) {
        socket.emit('friends_chat_error', { message: 'User ID and Auth ID are required' });
        return;
      }

      // Validate user exists
      const userProfile = await this.profileManager.fetchUserProfile(authId);
      if (!userProfile) {
        socket.emit('friends_chat_error', { message: 'User profile not found' });
        return;
      }

      // Join user to their personal room
      const userRoom = `friends_user_${userId}`;
      await socket.join(userRoom);
      
      // Store user mapping
      (socket as any).friendsChatUserId = userId;
      (socket as any).friendsChatAuthId = authId;
      
      // Track connected users
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, new Set());
      }
      this.connectedUsers.get(userId)!.add(socket.id);

      // Update presence
      await this.updateUserPresence(userId, true);
      
      logger.debug(`👤 User ${userId} joined friends chat (socket: ${socket.id})`);
      
      // Send confirmation
      socket.emit('friends_chat_joined', {
        userId,
        userRoom,
        timestamp: Date.now()
      });
      
      // Send initial data
      await this.sendUnreadCounts(socket, userId);
      
    } catch (error) {
      logger.error('❌ Error handling user join:', error);
      socket.emit('friends_chat_error', { message: 'Failed to join chat' });
    }
  }

  private async handleSendMessage(socket: Socket, data: {
    senderId: string;
    receiverId: string;
    message: string;
    authId: string;
    messageType?: string;
  }): Promise<void> {
    try {
      const { senderId, receiverId, message, authId, messageType = 'text' } = data;
      
      // Validation
      if (!senderId || !receiverId || !message?.trim() || !authId) {
        socket.emit('friends_chat_error', { message: 'All fields are required' });
        return;
      }

      if (message.trim().length > this.CONFIG.MAX_MESSAGE_LENGTH) {
        socket.emit('friends_chat_error', { 
          message: `Message too long (max ${this.CONFIG.MAX_MESSAGE_LENGTH} characters)` 
        });
        return;
      }

      // Rate limiting
      if (!this.checkRateLimit(senderId, this.CONFIG.RATE_LIMIT_MESSAGES_PER_MINUTE)) {
        socket.emit('friends_chat_error', { message: 'Rate limit exceeded' });
        return;
      }

      // Check friendship status
      const friendshipStatus = await this.profileManager.getFriendshipStatus(senderId, receiverId);
      if (friendshipStatus.status !== 'friends') {
        socket.emit('friends_chat_error', { message: 'You can only message friends' });
        return;
      }

      // Get sender profile
      const senderProfile = await this.profileManager.fetchUserProfile(authId);
      
      // Create message
      const chatMessage: FriendChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        senderId,
        receiverId,
        message: message.trim(),
        timestamp: Date.now(),
        read: false,
        messageType: messageType as any,
        senderProfile: senderProfile ? {
          username: senderProfile.username || 'Unknown',
          displayName: senderProfile.display_name,
          avatarUrl: senderProfile.avatar_url,
          displayNameColor: senderProfile.display_name_color
        } : undefined
      };

      // Store message
      await this.storeMessage(chatMessage);
      
      // Send to both users
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
      
      // Update last message cache
      await this.updateLastMessage(senderId, receiverId, chatMessage);
      
      // Stop typing indicator for sender
      await this.handleTypingStop(socket, { userId: senderId, friendId: receiverId });
      
      logger.debug(`💬 Message sent: ${senderId} -> ${receiverId}`);
      
    } catch (error) {
      logger.error('❌ Error sending message:', error);
      socket.emit('friends_chat_error', { message: 'Failed to send message' });
    }
  }

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

      // Mark messages as read
      await this.markMessagesAsRead(userId, friendId, messageIds);
      
      // Notify sender that messages were read
      const senderRoom = `friends_user_${friendId}`;
      this.io.to(senderRoom).emit('friends_chat_messages_read', {
        readerId: userId,
        messageIds,
        chatId: this.getChatId(userId, friendId)
      });
      
      // Send updated unread count
      await this.sendUnreadCounts(socket, userId);
      
      logger.debug(`📖 Messages marked as read: ${userId} read ${messageIds.length} messages from ${friendId}`);
      
    } catch (error) {
      logger.error('❌ Error marking messages as read:', error);
      socket.emit('friends_chat_error', { message: 'Failed to mark messages as read' });
    }
  }

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
      
      // Cache in Redis if available
      if (this.redisService) {
        try {
          const redisInstance = this.redisService.getRedisInstance();
          await redisInstance.setex(`typing:${typingKey}`, this.CONFIG.TYPING_TTL, JSON.stringify(typingStatus));
        } catch (error) {
          logger.debug('Failed to cache typing status:', error);
        }
      }
      
      // Notify friend
      const friendRoom = `friends_user_${friendId}`;
      this.io.to(friendRoom).emit('friends_chat_typing_start', {
        userId,
        friendId,
        timestamp: Date.now()
      });
      
      // Auto-stop typing after configured time
      setTimeout(() => {
        this.handleTypingStop(socket, { userId, friendId });
      }, this.CONFIG.TYPING_TTL * 1000);
      
    } catch (error) {
      logger.error('❌ Error handling typing start:', error);
    }
  }

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
      
      // Remove from Redis if available
      if (this.redisService) {
        try {
          const redisInstance = this.redisService.getRedisInstance();
          await redisInstance.del(`typing:${typingKey}`);
        } catch (error) {
          logger.debug('Failed to remove typing status from cache:', error);
        }
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

  private async handleGetChatHistory(socket: Socket, data: {
    userId: string;
    friendId: string;
    limit?: number;
    offset?: number;
    beforeTimestamp?: number;
  }): Promise<void> {
    try {
      const { userId, friendId, limit = 50, offset = 0, beforeTimestamp } = data;
      
      if (!userId || !friendId) {
        socket.emit('friends_chat_error', { message: 'User ID and Friend ID are required' });
        return;
      }

      // Validate limit
      const validLimit = Math.min(Math.max(limit, 1), 100);

      // Check friendship status
      const friendshipStatus = await this.profileManager.getFriendshipStatus(userId, friendId);
      if (friendshipStatus.status !== 'friends') {
        socket.emit('friends_chat_error', { message: 'You can only view chat history with friends' });
        return;
      }

      // Get messages
      const result = await this.getChatHistory(userId, friendId, validLimit, offset, beforeTimestamp);
      
      socket.emit('friends_chat_history', {
        chatId: this.getChatId(userId, friendId),
        messages: result.messages,
        hasMore: result.hasMore,
        offset: offset + result.messages.length,
        totalCount: result.totalCount,
        beforeTimestamp
      });
      
      logger.debug(`📚 Chat history sent: ${userId} <-> ${friendId} (${result.messages.length} messages)`);
      
    } catch (error) {
      logger.error('❌ Error getting chat history:', error);
      socket.emit('friends_chat_error', { message: 'Failed to get chat history' });
    }
  }

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

      if (friendIds.length > 50) {
        socket.emit('friends_chat_error', { message: 'Too many friend IDs (max 50)' });
        return;
      }

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

  private async handleGetUnreadCounts(socket: Socket, data: {
    userId: string;
  }): Promise<void> {
    try {
      const { userId } = data;
      
      if (!userId) {
        socket.emit('friends_chat_error', { message: 'User ID is required' });
        return;
      }

      await this.sendUnreadCounts(socket, userId);
      
    } catch (error) {
      logger.error('❌ Error getting unread counts:', error);
      socket.emit('friends_chat_error', { message: 'Failed to get unread counts' });
    }
  }

  private async handleUpdatePresence(socket: Socket, data: {
    userId: string;
    isOnline: boolean;
    status?: string;
  }): Promise<void> {
    try {
      const { userId, isOnline, status } = data;
      
      if (!userId) {
        return;
      }

      await this.updateUserPresence(userId, isOnline, status);
      
      logger.debug(`👤 Presence updated for ${userId}: ${isOnline ? 'online' : 'offline'}`);
      
    } catch (error) {
      logger.error('❌ Error updating presence:', error);
    }
  }

  private handleUserDisconnect(socket: Socket, reason: string): void {
    const userId = (socket as any).friendsChatUserId;
    
    if (userId) {
      // Remove from connected users
      const userSockets = this.connectedUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          this.connectedUsers.delete(userId);
          // User has no more connections, mark as offline
          this.updateUserPresence(userId, false);
        }
      }

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
      
      logger.debug(`👋 User ${userId} disconnected from friends chat (reason: ${reason})`);
    }
  }

  // ============ MESSAGE STORAGE ============

  private async storeMessage(message: FriendChatMessage): Promise<void> {
    try {
      // Store in Redis if available
      if (this.redisService) {
        const success = await this.storeMessageInRedis(message);
        if (success) {
          logger.debug(`📋 Message stored in Redis: ${message.senderId} -> ${message.receiverId}`);
        } else {
          this.updateMemoryCache(this.getChatId(message.senderId, message.receiverId), message);
        }
      } else {
        // Fallback to memory storage
        this.updateMemoryCache(this.getChatId(message.senderId, message.receiverId), message);
      }
    } catch (error) {
      logger.error('❌ Error storing message:', error);
      // Always fallback to memory
      this.updateMemoryCache(this.getChatId(message.senderId, message.receiverId), message);
    }
  }

  private async storeMessageInRedis(message: FriendChatMessage): Promise<boolean> {
    if (!this.redisService) return false;

    try {
      const redisInstance = this.redisService.getRedisInstance();
      const chatId = this.getChatId(message.senderId, message.receiverId);
      
      // Store message in a sorted set by timestamp
      await redisInstance.zadd(
        `chat_messages:${chatId}`,
        message.timestamp,
        JSON.stringify(message)
      );
      
      // Keep only recent messages (cleanup old ones)
      await redisInstance.zremrangebyrank(
        `chat_messages:${chatId}`,
        0,
        -(this.CONFIG.MAX_MESSAGES_PER_CHAT + 1)
      );
      
      // Set expiry on the chat (30 days)
      await redisInstance.expire(`chat_messages:${chatId}`, 30 * 24 * 60 * 60);
      
      return true;
    } catch (error) {
      logger.error('Failed to store message in Redis:', error);
      return false;
    }
  }

  private updateMemoryCache(chatId: string, message: FriendChatMessage): void {
    let room = this.activeChatRooms.get(chatId);
    
    if (!room) {
      room = {
        id: chatId,
        participants: [message.senderId, message.receiverId],
        lastActivity: Date.now(),
        messages: [],
        unreadCount: {},
        isActive: true
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

  // ============ MESSAGE RETRIEVAL ============

  private async getChatHistory(
    userId: string, 
    friendId: string, 
    limit: number, 
    offset: number,
    beforeTimestamp?: number
  ): Promise<{
    messages: FriendChatMessage[];
    hasMore: boolean;
    totalCount: number;
  }> {
    try {
      // Try Redis first
      if (this.redisService) {
        const result = await this.getChatHistoryFromRedis(userId, friendId, limit, offset, beforeTimestamp);
        if (result.messages.length > 0 || offset === 0) {
          return result;
        }
      }
      
      // Fallback to memory cache
      return this.getChatHistoryFromMemory(userId, friendId, limit, offset, beforeTimestamp);
      
    } catch (error) {
      logger.error('❌ Error getting chat history:', error);
      return {
        messages: [],
        hasMore: false,
        totalCount: 0
      };
    }
  }

  private async getChatHistoryFromRedis(
    userId: string, 
    friendId: string, 
    limit: number, 
    offset: number,
    beforeTimestamp?: number
  ): Promise<{
    messages: FriendChatMessage[];
    hasMore: boolean;
    totalCount: number;
  }> {
    if (!this.redisService) {
      return { messages: [], hasMore: false, totalCount: 0 };
    }

    try {
      const redisInstance = this.redisService.getRedisInstance();
      const chatId = this.getChatId(userId, friendId);
      
      // Get total count
      const totalCount = await redisInstance.zcard(`chat_messages:${chatId}`);
      
      // Build query parameters
      let maxScore = beforeTimestamp || '+inf';
      let minScore = '-inf';
      
      // Get messages in reverse order (newest first)
      const messageStrings = await redisInstance.zrevrangebyscore(
        `chat_messages:${chatId}`,
        maxScore,
        minScore,
        'LIMIT',
        offset,
        limit
      );
      
      const messages = messageStrings
        .map(str => {
          try {
            return JSON.parse(str) as FriendChatMessage;
          } catch {
            return null;
          }
        })
        .filter(Boolean) as FriendChatMessage[];
      
      // Reverse to get chronological order
      messages.reverse();
      
      const hasMore = offset + messages.length < totalCount;
      
      return {
        messages,
        hasMore,
        totalCount
      };
    } catch (error) {
      logger.error('Failed to get chat history from Redis:', error);
      return { messages: [], hasMore: false, totalCount: 0 };
    }
  }

  private getChatHistoryFromMemory(
    userId: string, 
    friendId: string, 
    limit: number, 
    offset: number,
    beforeTimestamp?: number
  ): {
    messages: FriendChatMessage[];
    hasMore: boolean;
    totalCount: number;
  } {
    const chatId = this.getChatId(userId, friendId);
    const room = this.activeChatRooms.get(chatId);
    
    if (!room) {
      return {
        messages: [],
        hasMore: false,
        totalCount: 0
      };
    }

    let filteredMessages = room.messages;
    
    // Filter by timestamp if provided
    if (beforeTimestamp) {
      filteredMessages = room.messages.filter(msg => msg.timestamp < beforeTimestamp);
    }
    
    const totalCount = filteredMessages.length;
    const start = Math.max(0, totalCount - offset - limit);
    const end = totalCount - offset;
    
    const messages = filteredMessages.slice(start, end);
    const hasMore = start > 0;
    
    return {
      messages,
      hasMore,
      totalCount
    };
  }

  // ============ HELPER METHODS ============

  private async markMessagesAsRead(userId: string, friendId: string, messageIds: string[]): Promise<void> {
    try {
      if (this.redisService) {
        await this.markMessagesAsReadInRedis(userId, friendId, messageIds);
      }
      // Also update memory cache
      this.markMessagesAsReadInMemory(userId, friendId, messageIds);
    } catch (error) {
      logger.error('❌ Error marking messages as read:', error);
      // Fallback to memory only
      this.markMessagesAsReadInMemory(userId, friendId, messageIds);
    }
  }

  private async markMessagesAsReadInRedis(userId: string, friendId: string, messageIds: string[]): Promise<void> {
    if (!this.redisService) return;

    try {
      const redisInstance = this.redisService.getRedisInstance();
      const chatId = this.getChatId(userId, friendId);
      
      // Get all messages and update read status
      const messageStrings = await redisInstance.zrange(`chat_messages:${chatId}`, 0, -1);
      
      const pipeline = redisInstance.multi();
      
      for (const msgStr of messageStrings) {
        try {
          const message = JSON.parse(msgStr) as FriendChatMessage;
          if (messageIds.includes(message.id) && message.receiverId === userId) {
            message.read = true;
            pipeline.zadd(`chat_messages:${chatId}`, message.timestamp, JSON.stringify(message));
          }
        } catch (parseError) {
          // Skip invalid messages
        }
      }
      
      await pipeline.exec();
      
    } catch (error) {
      logger.error('Failed to mark messages as read in Redis:', error);
    }
  }

  private markMessagesAsReadInMemory(userId: string, friendId: string, messageIds: string[]): void {
    const chatId = this.getChatId(userId, friendId);
    const room = this.activeChatRooms.get(chatId);
    
    if (room) {
      room.messages.forEach(msg => {
        if (messageIds.includes(msg.id) && msg.receiverId === userId) {
          msg.read = true;
        }
      });
      room.unreadCount[userId] = 0;
    }
  }

  private async getLastMessages(userId: string, friendIds: string[]): Promise<Record<string, FriendChatMessage | null>> {
    const results: Record<string, FriendChatMessage | null> = {};
    
    try {
      if (this.redisService) {
        // Try Redis first
        for (const friendId of friendIds) {
          const chatId = this.getChatId(userId, friendId);
          const redisInstance = this.redisService.getRedisInstance();
          
          try {
            const lastMessageStr = await redisInstance.zrevrange(`chat_messages:${chatId}`, 0, 0);
            if (lastMessageStr.length > 0) {
              results[friendId] = JSON.parse(lastMessageStr[0]);
            } else {
              results[friendId] = null;
            }
          } catch (error) {
            results[friendId] = null;
          }
        }
      } else {
        // Fallback to memory cache
        for (const friendId of friendIds) {
          const chatId = this.getChatId(userId, friendId);
          const room = this.activeChatRooms.get(chatId);
          
          if (room && room.messages.length > 0) {
            results[friendId] = room.messages[room.messages.length - 1];
          } else {
            results[friendId] = null;
          }
        }
      }
    } catch (error) {
      logger.error('❌ Error getting last messages:', error);
      // Return empty results
      for (const friendId of friendIds) {
        results[friendId] = null;
      }
    }
    
    return results;
  }

  private async updateLastMessage(senderId: string, receiverId: string, message: FriendChatMessage): Promise<void> {
    try {
      if (this.redisService) {
        const redisInstance = this.redisService.getRedisInstance();
        const senderKey = `last_message:${senderId}:${receiverId}`;
        const receiverKey = `last_message:${receiverId}:${senderId}`;
        
        await Promise.all([
          redisInstance.setex(senderKey, 24 * 60 * 60, JSON.stringify(message)), // 24 hours
          redisInstance.setex(receiverKey, 24 * 60 * 60, JSON.stringify(message))
        ]);
      }
    } catch (error) {
      logger.error('❌ Error updating last message:', error);
    }
  }

  private async sendUnreadCounts(socket: Socket, userId: string): Promise<void> {
    try {
      let unreadCounts: Record<string, number> = {};
      
      if (this.redisService) {
        // Get from Redis
        const redisInstance = this.redisService.getRedisInstance();
        const keys = await redisInstance.keys(`unread_count:${userId}:*`);
        
        for (const key of keys) {
          const friendId = key.split(':')[2];
          const count = await redisInstance.get(key);
          unreadCounts[friendId] = parseInt(count || '0', 10);
        }
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

  private async updateUserPresence(userId: string, isOnline: boolean, status?: string): Promise<void> {
    try {
      const presence: ChatPresence = {
        userId,
        isOnline,
        lastSeen: Date.now(),
        currentlyTyping: []
      };
      
      this.userPresence.set(userId, presence);
      
      // Update in Redis if available
      if (this.redisService) {
        const redisInstance = this.redisService.getRedisInstance();
        await redisInstance.setex(
          `presence:${userId}`,
          60 * 60, // 1 hour
          JSON.stringify(presence)
        );
      }
      
      // Notify friends of status change
      const friends = await this.profileManager.fetchUserFriends(userId);
      for (const friend of friends) {
        const friendRoom = `friends_user_${friend.id}`;
        this.io.to(friendRoom).emit('friends_chat_presence_update', {
          userId,
          isOnline,
          status,
          timestamp: Date.now()
        });
      }
      
    } catch (error) {
      logger.error('❌ Error updating user presence:', error);
    }
  }

  private getChatId(user1: string, user2: string): string {
    return [user1, user2].sort().join('_');
  }

  private checkRateLimit(userId: string, maxRequests: number): boolean {
    const now = Date.now();
    const record = this.rateLimitStore.get(userId);
    
    if (!record || now - record.resetTime > 60000) {
      this.rateLimitStore.set(userId, { count: 1, resetTime: now });
      return true;
    }
    
    if (record.count >= maxRequests) {
      return false;
    }
    
    record.count++;
    return true;
  }

  // ============ BACKGROUND TASKS ============

  private startBackgroundTasks(): void {
    // Message cleanup
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupOldMessages();
    }, this.CONFIG.MESSAGE_CLEANUP_INTERVAL);

    // Presence updates
    this.presenceInterval = setInterval(async () => {
      await this.updatePresenceHeartbeat();
    }, this.CONFIG.PRESENCE_UPDATE_INTERVAL);
  }

  private async cleanupOldMessages(): Promise<void> {
    try {
      let totalCleaned = 0;
      
      // Clean up Redis messages
      if (this.redisService) {
        const redisInstance = this.redisService.getRedisInstance();
        const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
        
        const chatKeys = await redisInstance.keys('chat_messages:*');
        for (const key of chatKeys) {
          const cleaned = await redisInstance.zremrangebyscore(key, 0, cutoffTime);
          totalCleaned += cleaned;
        }
      }
      
      // Clean up memory cache
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000);
      
      for (const [chatId, room] of this.activeChatRooms.entries()) {
        const oldMessages = room.messages.filter(msg => msg.timestamp < cutoffTime);
        if (oldMessages.length > 0) {
          room.messages = room.messages.filter(msg => msg.timestamp >= cutoffTime);
          totalCleaned += oldMessages.length;
        }
        
        // Remove inactive rooms
        if (Date.now() - room.lastActivity > 60 * 60 * 1000) {
          this.activeChatRooms.delete(chatId);
        }
      }
      
      if (totalCleaned > 0) {
        logger.info(`🧹 Cleaned up ${totalCleaned} old messages`);
      }
      
    } catch (error) {
      logger.error('❌ Error during message cleanup:', error);
    }
  }

  private async updatePresenceHeartbeat(): Promise<void> {
    try {
      // Update presence for all connected users
      for (const userId of this.connectedUsers.keys()) {
        await this.updateUserPresence(userId, true);
      }
    } catch (error) {
      logger.error('❌ Error updating presence heartbeat:', error);
    }
  }

  // ============ PUBLIC API ============

  public getStats(): {
    activeRooms: number;
    connectedUsers: number;
    activeTyping: number;
    cacheSize: number;
    redisEnabled: boolean;
    memoryRooms: number;
  } {
    return {
      activeRooms: this.activeChatRooms.size,
      connectedUsers: this.connectedUsers.size,
      activeTyping: this.typingStatuses.size,
      cacheSize: Array.from(this.activeChatRooms.values())
        .reduce((total, room) => total + room.messages.length, 0),
      redisEnabled: !!this.redisService,
      memoryRooms: this.activeChatRooms.size
    };
  }

  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'down';
    redisEnabled: boolean;
    connectedUsers: number;
    activeRooms: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let status: 'healthy' | 'degraded' | 'down' = 'healthy';

    try {
      // Check Redis health
      if (this.redisService) {
        try {
          const redisInstance = this.redisService.getRedisInstance();
          await redisInstance.ping();
        } catch (error) {
          errors.push('Redis connection failed');
          status = 'degraded';
        }
      }

      // Check Socket.IO health
      if (!this.io) {
        errors.push('Socket.IO server not available');
        status = 'down';
      }

      return {
        status,
        redisEnabled: !!this.redisService,
        connectedUsers: this.connectedUsers.size,
        activeRooms: this.activeChatRooms.size,
        errors
      };
    } catch (error) {
      return {
        status: 'down',
        redisEnabled: false,
        connectedUsers: 0,
        activeRooms: 0,
        errors: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  public async destroy(): Promise<void> {
    logger.info('💬 Shutting down FriendsChatService...');
    
    try {
      // Clear intervals
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }
      
      if (this.presenceInterval) {
        clearInterval(this.presenceInterval);
        this.presenceInterval = null;
      }
      
      // Clear stores
      this.typingStatuses.clear();
      this.activeChatRooms.clear();
      this.userPresence.clear();
      this.connectedUsers.clear();
      this.rateLimitStore.clear();
      
      logger.info('✅ FriendsChatService shutdown complete');
    } catch (error) {
      logger.error('❌ Error during FriendsChatService shutdown:', error);
      throw error;
    }
  }
}