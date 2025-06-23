// server/services/FriendsChatService.ts - FIXED VERSION WITH PROPER TYPING AND METHODS
import { Server as SocketIOServer, Socket } from 'socket.io';
import { RedisService } from './RedisService';
import { ProfileManager } from '../managers/profile/ProfileManager';
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
  
  // In-memory cache for active chat rooms (Redis is primary storage)
  private activeChatRooms = new Map<string, FriendChatRoom>();
  private typingStatuses = new Map<string, TypingStatus>();
  
  // Cache TTL configurations
  private readonly CHAT_CACHE_TTL = 24 * 60 * 60; // 24 hours in seconds
  private readonly TYPING_TTL = 5; // 5 seconds
  private readonly LAST_MESSAGE_TTL = 7 * 24 * 60 * 60; // 7 days for last message cache
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
    
    this.setupSocketHandlers();
    this.startMessageCleanup();
    
    logger.info('💬 FriendsChatService initialized with 24h message caching');
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

      // Store message in cache/Redis
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
      
      // Update last message cache for friends list
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

      // Mark messages as read in storage
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
      
      // Cache in Redis with short TTL
      if (this.redisService) {
        await this.redisService.set(`typing:${typingKey}`, typingStatus, this.TYPING_TTL);
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
      
      // Remove from Redis
      if (this.redisService) {
        await this.redisService.del(`typing:${typingKey}`);
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

      // Get messages from cache/Redis
      const messages = await this.getChatHistory(userId, friendId, limit, offset);
      
      socket.emit('friends_chat_history', {
        chatId: this.getChatId(userId, friendId),
        messages,
        hasMore: messages.length === limit,
        offset: offset + messages.length
      });
      
      logger.debug(`📚 Chat history sent: ${userId} <-> ${friendId} (${messages.length} messages)`);
      
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

      const lastMessages: Record<string, FriendChatMessage | null> = {};
      
      // Get last message for each friend
      for (const friendId of friendIds) {
        try {
          const lastMessage = await this.getLastMessage(userId, friendId);
          lastMessages[friendId] = lastMessage;
        } catch (error) {
          logger.warn(`Failed to get last message for ${userId} <-> ${friendId}:`, error);
          lastMessages[friendId] = null;
        }
      }
      
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

  // Store message in Redis and memory cache
  private async storeMessage(message: FriendChatMessage): Promise<void> {
    const chatId = this.getChatId(message.senderId, message.receiverId);
    
    try {
      if (this.redisService) {
        // Store in Redis with 24h TTL
        const messagesKey = `friends_chat:${chatId}:messages`;
        const redisInstance = this.redisService.getRedisInstance();
        
        // Add message to sorted set (sorted by timestamp)
        await redisInstance.zadd(messagesKey, message.timestamp, JSON.stringify(message));
        
        // Set TTL for the key
        await redisInstance.expire(messagesKey, this.CHAT_CACHE_TTL);
        
        // Remove old messages (keep only last 1000)
        const messageCount = await redisInstance.zcard(messagesKey);
        if (messageCount > this.MAX_MESSAGES_PER_CHAT) {
          const removeCount = messageCount - this.MAX_MESSAGES_PER_CHAT;
          await redisInstance.zremrangebyrank(messagesKey, 0, removeCount - 1);
        }
        
        // Update unread count for receiver
        const unreadKey = `friends_chat:${message.receiverId}:unread:${message.senderId}`;
        await redisInstance.incr(unreadKey);
        await redisInstance.expire(unreadKey, this.CHAT_CACHE_TTL);
      }
      
      // Also store in memory cache for active chats
      this.updateMemoryCache(chatId, message);
      
    } catch (error) {
      logger.error('❌ Error storing message:', error);
      throw error;
    }
  }

  // Update memory cache with new message
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

  // Mark messages as read
  private async markMessagesAsRead(userId: string, friendId: string, messageIds: string[]): Promise<void> {
    try {
      if (this.redisService) {
        // Reset unread count
        const unreadKey = `friends_chat:${userId}:unread:${friendId}`;
        await this.redisService.del(unreadKey);
        
        // Mark individual messages as read (if needed for detailed tracking)
        for (const messageId of messageIds) {
          const readKey = `friends_chat:read:${messageId}:${userId}`;
          await this.redisService.set(readKey, '1', this.CHAT_CACHE_TTL);
        }
      }
      
      // Update memory cache
      const chatId = this.getChatId(userId, friendId);
      const room = this.activeChatRooms.get(chatId);
      if (room) {
        room.unreadCount[userId] = 0;
      }
      
    } catch (error) {
      logger.error('❌ Error marking messages as read:', error);
      throw error;
    }
  }

  // Get chat history from Redis
  private async getChatHistory(userId: string, friendId: string, limit: number, offset: number): Promise<FriendChatMessage[]> {
    const chatId = this.getChatId(userId, friendId);
    
    try {
      if (this.redisService) {
        const messagesKey = `friends_chat:${chatId}:messages`;
        const redisInstance = this.redisService.getRedisInstance();
        
        // Get messages in reverse chronological order
        const messageStrings = await redisInstance.zrevrange(
          messagesKey, 
          offset, 
          offset + limit - 1
        );
        
        const messages: FriendChatMessage[] = [];
        for (const msgStr of messageStrings) {
          try {
            const message = JSON.parse(msgStr) as FriendChatMessage;
            messages.push(message);
          } catch (error) {
            logger.warn('❌ Failed to parse message:', error);
          }
        }
        
        return messages.reverse(); // Return in chronological order
      }
      
      // Fallback to memory cache
      const room = this.activeChatRooms.get(chatId);
      if (room) {
        const start = Math.max(0, room.messages.length - offset - limit);
        const end = room.messages.length - offset;
        return room.messages.slice(start, end);
      }
      
      return [];
      
    } catch (error) {
      logger.error('❌ Error getting chat history:', error);
      return [];
    }
  }

  // Get last message between two users
  private async getLastMessage(userId: string, friendId: string): Promise<FriendChatMessage | null> {
    try {
      if (this.redisService) {
        const lastMessageKey = `friends_chat:last:${this.getChatId(userId, friendId)}`;
        const cached = await this.redisService.get<FriendChatMessage>(lastMessageKey);
        if (cached) {
          return cached;
        }
      }
      
      // Get most recent message from chat history
      const messages = await this.getChatHistory(userId, friendId, 1, 0);
      return messages.length > 0 ? messages[0] : null;
      
    } catch (error) {
      logger.error('❌ Error getting last message:', error);
      return null;
    }
  }

  // Update last message cache for friends list
  private async updateLastMessage(senderId: string, receiverId: string, message: FriendChatMessage): Promise<void> {
    try {
      if (this.redisService) {
        const chatId = this.getChatId(senderId, receiverId);
        const lastMessageKey = `friends_chat:last:${chatId}`;
        await this.redisService.set(lastMessageKey, message, this.LAST_MESSAGE_TTL);
      }
    } catch (error) {
      logger.error('❌ Error updating last message cache:', error);
    }
  }

  // Send unread counts to user
  private async sendUnreadCounts(socket: Socket, userId: string): Promise<void> {
    try {
      const unreadCounts: Record<string, number> = {};
      
      if (this.redisService) {
        // Get all unread counts for this user
        const redisInstance = this.redisService.getRedisInstance();
        const unreadKeys = await redisInstance.keys(`friends_chat:${userId}:unread:*`);
        
        for (const key of unreadKeys) {
          const friendId = key.split(':').pop();
          if (friendId) {
            const count = await redisInstance.get(key);
            unreadCounts[friendId] = parseInt(count || '0', 10);
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

  // Clean up messages older than 24 hours
  private async cleanupOldMessages(): Promise<void> {
    try {
      if (!this.redisService) return;
      
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
      const redisInstance = this.redisService.getRedisInstance();
      
      // Find all chat message keys
      const messageKeys = await redisInstance.keys('friends_chat:*:messages');
      let totalCleaned = 0;
      
      for (const key of messageKeys) {
        try {
          // Remove messages older than cutoff time
          const removed = await redisInstance.zremrangebyscore(key, '-inf', cutoffTime);
          totalCleaned += removed;
        } catch (error) {
          logger.warn(`Failed to cleanup messages for key ${key}:`, error);
        }
      }
      
      if (totalCleaned > 0) {
        logger.info(`🧹 Cleaned up ${totalCleaned} old messages`);
      }
      
      // Clean up memory cache
      for (const [chatId, room] of this.activeChatRooms.entries()) {
        const oldMessages = room.messages.filter(msg => msg.timestamp < cutoffTime);
        if (oldMessages.length > 0) {
          room.messages = room.messages.filter(msg => msg.timestamp >= cutoffTime);
          logger.debug(`🧹 Cleaned ${oldMessages.length} old messages from memory cache for ${chatId}`);
        }
        
        // Remove inactive rooms
        if (Date.now() - room.lastActivity > 60 * 60 * 1000) { // 1 hour inactive
          this.activeChatRooms.delete(chatId);
          logger.debug(`🧹 Removed inactive chat room: ${chatId}`);
        }
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
  } {
    return {
      activeRooms: this.activeChatRooms.size,
      activeTyping: this.typingStatuses.size,
      cacheSize: Array.from(this.activeChatRooms.values())
        .reduce((total, room) => total + room.messages.length, 0),
      redisEnabled: !!this.redisService
    };
  }

  // ✅ FIXED: Added missing destroy method
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
      
      logger.info('✅ FriendsChatService shutdown complete');
    } catch (error) {
      logger.error('❌ Error during FriendsChatService shutdown:', error);
      throw error;
    }
  }
}