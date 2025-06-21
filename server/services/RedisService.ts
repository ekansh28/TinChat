// server/services/RedisService.ts - COMPLETE ENHANCED VERSION
import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { UserProfile } from '../managers/ProfileManager';
import { User } from '../types/User';

export class RedisService {
  private redis: Redis;
  private isConnected: boolean = false;
  private connectionRetries: number = 0;
  private readonly MAX_RETRIES = 5;
  
  // ==================== ENHANCED TTL CONFIGURATION ====================
  private readonly TTL = {
    // User-related data
    USER_PROFILE: 7 * 24 * 60 * 60,    // 7 days - profiles change infrequently
    USER_PROFILE_SHORT: 5 * 60,        // 5 minutes - for frequently updated profiles
    USER_FRIENDS_LIST: 60,              // 1 minute - friends data changes often
    USER_ONLINE_STATUS: 30,             // 30 seconds - real-time status updates
    USER_SETTINGS: 24 * 60 * 60,        // 24 hours - settings rarely change
    USER_BADGES: 12 * 60 * 60,          // 12 hours - badges updated occasionally
    
    // Chat and messaging
    CHAT_HISTORY: 30 * 60,              // 30 minutes - recent chat messages
    TYPING_INDICATORS: 5,               // 5 seconds - very short for typing
    ROOM_METADATA: 60 * 60,             // 1 hour - room info while active
    
    // Matchmaking and queues
    MATCHMAKING_QUEUE: 10 * 60,         // 10 minutes - prevent stale queue entries
    MATCH_PREFERENCES: 2 * 60 * 60,     // 2 hours - user preferences
    
    // Analytics and stats
    ONLINE_USERS_COUNT: 15,             // 15 seconds - frequently updated count
    SERVER_STATS: 60,                   // 1 minute - server statistics
    DAILY_STATS: 24 * 60 * 60,          // 24 hours - daily aggregated stats
    
    // Security and rate limiting
    RATE_LIMIT: 60,                     // 1 minute - rate limiting windows
    LOGIN_ATTEMPTS: 15 * 60,            // 15 minutes - failed login tracking
    SESSION_DATA: 2 * 60 * 60,          // 2 hours - active session information
    
    // Feature flags and config
    FEATURE_FLAGS: 5 * 60,              // 5 minutes - feature toggles
    APP_CONFIG: 10 * 60,                // 10 minutes - application configuration
  };

  // Key prefixes for organized namespace
  private readonly KEY_PREFIXES = {
    PROFILE: 'profile',
    FRIENDS: 'friends',
    ONLINE: 'online',
    CHAT: 'chat',
    ROOM: 'room',
    QUEUE: 'queue',
    STATS: 'stats',
    RATE_LIMIT: 'rate',
    SESSION: 'session',
    CONFIG: 'config'
  };

  constructor(redisUrl: string, redisToken: string) {
    this.redis = new Redis(redisUrl, {
      password: redisToken,
      tls: {}, // Required for Upstash's TLS/HTTPS connection

      // Valid ioredis options
      maxRetriesPerRequest: 3,      // Retry a few times before failing
      lazyConnect: true,            // Don't connect until first command
      connectTimeout: 10000,        // 10s to connect before giving up
      keepAlive: 30000              // Keep TCP connection alive
    });

    this.setupEventListeners();
    this.setupHealthMonitoring();
  }

  private setupEventListeners(): void {
    this.redis.on('connect', () => {
      this.isConnected = true;
      this.connectionRetries = 0;
      logger.info('✅ Redis connected successfully to Upstash');
    });

    this.redis.on('error', (err) => {
      this.isConnected = false;
      this.connectionRetries++;
      logger.error('❌ Redis connection error:', err);
      
      if (this.connectionRetries >= this.MAX_RETRIES) {
        logger.error(`🚨 Redis failed after ${this.MAX_RETRIES} retries - operating in degraded mode`);
      }
    });

    this.redis.on('ready', () => {
      this.isConnected = true;
      logger.info('🚀 Redis ready for operations');
    });

    this.redis.on('close', () => {
      this.isConnected = false;
      logger.warn('⚠️ Redis connection closed');
    });

    this.redis.on('reconnecting', (delay: number) => {
      logger.info(`🔄 Redis reconnecting in ${delay}ms...`);
    });
  }

  private setupHealthMonitoring(): void {
    // Periodic health check every 30 seconds
    setInterval(async () => {
      if (this.isConnected) {
        try {
          await this.redis.ping();
        } catch (error) {
          this.isConnected = false;
          logger.warn('🏥 Redis health check failed');
        }
      }
    }, 30000);
  }

  // ==================== ENHANCED USER PROFILE CACHING ====================
  
  /**
   * Smart profile caching with different TTLs based on update frequency
   */
  async cacheUserProfile(authId: string, profile: UserProfile, isFrequentlyUpdated: boolean = false): Promise<boolean> {
    try {
      const key = this.buildKey(this.KEY_PREFIXES.PROFILE, authId);
      const ttl = isFrequentlyUpdated ? this.TTL.USER_PROFILE_SHORT : this.TTL.USER_PROFILE;
      
      // Add metadata for cache management
      const cacheData = {
        ...profile,
        _cached_at: Date.now(),
        _ttl: ttl,
        _frequently_updated: isFrequentlyUpdated
      };
      
      await this.redis.setex(key, ttl, JSON.stringify(cacheData));
      logger.debug(`📋 Cached profile for user ${authId} (TTL: ${ttl}s)`);
      return true;
    } catch (error) {
      logger.error(`Failed to cache profile for ${authId}:`, error);
      return false;
    }
  }

  /**
   * Get cached profile with automatic TTL refresh for active users
   */
  async getCachedUserProfile(authId: string): Promise<UserProfile | null> {
    try {
      const key = this.buildKey(this.KEY_PREFIXES.PROFILE, authId);
      const cached = await this.redis.get(key);
      
      if (cached) {
        const data = JSON.parse(cached);
        const profile = { ...data };
        
        // Remove metadata before returning
        delete profile._cached_at;
        delete profile._ttl;
        delete profile._frequently_updated;
        
        logger.debug(`📋 Cache hit for profile ${authId}`);
        
        // Auto-refresh TTL for frequently accessed profiles
        const cacheAge = Date.now() - data._cached_at;
        if (cacheAge > (data._ttl * 1000 * 0.8)) { // Refresh at 80% of TTL
          this.refreshProfileTTL(authId, data._ttl).catch(err => 
            logger.debug('Background TTL refresh failed:', err)
          );
        }
        
        return profile;
      }
      
      logger.debug(`📋 Cache miss for profile ${authId}`);
      return null;
    } catch (error) {
      logger.error(`Failed to get cached profile for ${authId}:`, error);
      return null;
    }
  }

  private async cleanupExpiredKeys(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) return 0;
      
      const expiredKeys: string[] = [];
      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl === -2) { // Key doesn't exist (expired)
          expiredKeys.push(key);
        }
      }
      
      if (expiredKeys.length > 0) {
        await this.redis.del(...expiredKeys);
        logger.debug(`🧹 Cleaned up ${expiredKeys.length} expired keys matching ${pattern}`);
      }
      
      return expiredKeys.length;
    } catch (error) {
      logger.error(`Failed to cleanup keys matching ${pattern}:`, error);
      return 0;
    }
  }

  private async cleanupStaleQueueEntries(): Promise<void> {
    try {
      const queues = ['queue:text', 'queue:video'];
      const cutoffTime = Date.now() - (15 * 60 * 1000); // 15 minutes
      
      for (const queueKey of queues) {
        const queueItems = await this.redis.lrange(queueKey, 0, -1);
        
        for (const item of queueItems) {
          try {
            const user = JSON.parse(item) as User & { queuedAt: number };
            if (user.queuedAt && user.queuedAt < cutoffTime) {
              await this.redis.lrem(queueKey, 1, item);
              logger.debug(`🧹 Cleaned up stale queue entry for user ${user.id}`);
            }
          } catch (parseError) {
            await this.redis.lrem(queueKey, 1, item);
            logger.warn(`🧹 Removed invalid queue entry`);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup stale queue entries:', error);
    }
  }

  /**
   * Batch operations with enhanced error handling
   */
  async batchOperations(operations: Array<{
    operation: 'set' | 'get' | 'del' | 'setex';
    key: string;
    value?: any;
    ttl?: number;
  }>): Promise<any[]> {
    try {
      const pipeline = this.redis.pipeline();
      
      for (const op of operations) {
        switch (op.operation) {
          case 'set':
            pipeline.set(op.key, JSON.stringify(op.value));
            break;
          case 'setex':
            if (op.ttl) {
              pipeline.setex(op.key, op.ttl, JSON.stringify(op.value));
            }
            break;
          case 'get':
            pipeline.get(op.key);
            break;
          case 'del':
            pipeline.del(op.key);
            break;
        }
      }
      
      const results = await pipeline.exec();
      logger.debug(`📦 Executed ${operations.length} batch operations`);
      
      return results || [];
    } catch (error) {
      logger.error('Failed to execute batch operations:', error);
      return [];
    }
  }

  /**
   * Smart cache invalidation for related data
   */
  async invalidateUserProfile(authId: string): Promise<boolean> {
    try {
      const keysToInvalidate = [
        this.buildKey(this.KEY_PREFIXES.PROFILE, authId),
        this.buildKey(this.KEY_PREFIXES.ONLINE, authId),
      ];
      
      await this.redis.del(...keysToInvalidate);
      logger.debug(`🗑️ Invalidated profile-related cache for ${authId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to invalidate profile cache for ${authId}:`, error);
      return false;
    }
  }

  /**
   * Connection status check
   */
  isRedisConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Graceful shutdown
   */
  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
      this.isConnected = false;
      logger.info('✅ Redis connection closed gracefully');
    } catch (error) {
      logger.error('❌ Error closing Redis connection:', error);
    }
  }

  /**
   * Get Redis instance for advanced operations
   */
  getRedisInstance(): Redis {
    return this.redis;
  }
} refreshProfileTTL(authId: string, ttl: number): Promise<void> {
    const key = this.buildKey(this.KEY_PREFIXES.PROFILE, authId);
    await this.redis.expire(key, ttl);
    logger.debug(`🔄 Refreshed TTL for profile ${authId}`);
  }

  // ==================== FRIENDS LIST CACHING ====================
  
  /**
   * Cache user's friends list with short TTL (changes frequently)
   */
  async cacheFriendsList(authId: string, friends: any[]): Promise<boolean> {
    try {
      const key = this.buildKey(this.KEY_PREFIXES.FRIENDS, authId);
      const cacheData = {
        friends,
        cached_at: Date.now(),
        count: friends.length
      };
      
      await this.redis.setex(key, this.TTL.USER_FRIENDS_LIST, JSON.stringify(cacheData));
      logger.debug(`👥 Cached ${friends.length} friends for user ${authId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to cache friends list for ${authId}:`, error);
      return false;
    }
  }

  async getCachedFriendsList(authId: string): Promise<any[] | null> {
    try {
      const key = this.buildKey(this.KEY_PREFIXES.FRIENDS, authId);
      const cached = await this.redis.get(key);
      
      if (cached) {
        const data = JSON.parse(cached);
        logger.debug(`👥 Cache hit for friends list ${authId} (${data.count} friends)`);
        return data.friends;
      }
      
      return null;
    } catch (error) {
      logger.error(`Failed to get cached friends list for ${authId}:`, error);
      return null;
    }
  }

  async invalidateFriendsList(authId: string): Promise<void> {
    try {
      const key = this.buildKey(this.KEY_PREFIXES.FRIENDS, authId);
      await this.redis.del(key);
      logger.debug(`🗑️ Invalidated friends list for ${authId}`);
    } catch (error) {
      logger.error(`Failed to invalidate friends list for ${authId}:`, error);
    }
  }

  // ==================== ONLINE STATUS CACHING ====================
  
  /**
   * Cache online user status with very short TTL
   */
  async cacheUserOnlineStatus(authId: string, isOnline: boolean, lastSeen?: Date): Promise<boolean> {
    try {
      const key = this.buildKey(this.KEY_PREFIXES.ONLINE, authId);
      const statusData = {
        isOnline,
        lastSeen: lastSeen?.toISOString() || new Date().toISOString(),
        updated_at: Date.now()
      };
      
      await this.redis.setex(key, this.TTL.USER_ONLINE_STATUS, JSON.stringify(statusData));
      logger.debug(`📊 Cached online status for ${authId}: ${isOnline}`);
      return true;
    } catch (error) {
      logger.error(`Failed to cache online status for ${authId}:`, error);
      return false;
    }
  }

  async getCachedOnlineStatus(authId: string): Promise<{ isOnline: boolean; lastSeen: string } | null> {
    try {
      const key = this.buildKey(this.KEY_PREFIXES.ONLINE, authId);
      const cached = await this.redis.get(key);
      
      if (cached) {
        const data = JSON.parse(cached);
        return {
          isOnline: data.isOnline,
          lastSeen: data.lastSeen
        };
      }
      
      return null;
    } catch (error) {
      logger.error(`Failed to get cached online status for ${authId}:`, error);
      return null;
    }
  }

  // ==================== ONLINE USERS CACHING ====================

  /**
   * Cache the list of online users
   */
  async cacheOnlineUsers(userList: string[]): Promise<boolean> {
    try {
      const key = 'online_users';
      await this.redis.setex(key, this.TTL.ONLINE_USERS_COUNT, JSON.stringify(userList));
      logger.debug(`👥 Cached ${userList.length} online users`);
      return true;
    } catch (error) {
      logger.error('Failed to cache online users:', error);
      return false;
    }
  }

  /**
   * Get cached online users list
   */
  async getCachedOnlineUsers(): Promise<string[] | null> {
    try {
      const key = 'online_users';
      const cached = await this.redis.get(key);
      
      if (cached) {
        const userList = JSON.parse(cached) as string[];
        logger.debug(`👥 Cache hit for online users: ${userList.length} users`);
        return userList;
      }
      
      logger.debug(`👥 Cache miss for online users`);
      return null;
    } catch (error) {
      logger.error('Failed to get cached online users:', error);
      return null;
    }
  }

  // ==================== CHAT HISTORY CACHING ====================
  
  /**
   * Cache recent chat messages for quick loading
   */
  async cacheRecentMessages(roomId: string, messages: any[], limit: number = 50): Promise<boolean> {
    try {
      const key = this.buildKey(this.KEY_PREFIXES.CHAT, roomId);
      
      // Keep only the most recent messages
      const recentMessages = messages.slice(-limit);
      const cacheData = {
        messages: recentMessages,
        cached_at: Date.now(),
        room_id: roomId,
        count: recentMessages.length
      };
      
      await this.redis.setex(key, this.TTL.CHAT_HISTORY, JSON.stringify(cacheData));
      logger.debug(`💬 Cached ${recentMessages.length} messages for room ${roomId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to cache messages for room ${roomId}:`, error);
      return false;
    }
  }

  async getCachedRecentMessages(roomId: string): Promise<any[] | null> {
    try {
      const key = this.buildKey(this.KEY_PREFIXES.CHAT, roomId);
      const cached = await this.redis.get(key);
      
      if (cached) {
        const data = JSON.parse(cached);
        logger.debug(`💬 Cache hit for room ${roomId} (${data.count} messages)`);
        return data.messages;
      }
      
      return null;
    } catch (error) {
      logger.error(`Failed to get cached messages for room ${roomId}:`, error);
      return null;
    }
  }

  async invalidateRoomMessages(roomId: string): Promise<void> {
    try {
      const key = this.buildKey(this.KEY_PREFIXES.CHAT, roomId);
      await this.redis.del(key);
      logger.debug(`🗑️ Invalidated message cache for room ${roomId}`);
    } catch (error) {
      logger.error(`Failed to invalidate message cache for room ${roomId}:`, error);
    }
  }

  // ==================== TYPING INDICATORS ====================
  
  /**
   * Cache typing status with very short TTL
   */
  async setTypingIndicator(roomId: string, userId: string, isTyping: boolean): Promise<boolean> {
    try {
      const key = this.buildKey('typing', roomId, userId);
      
      if (isTyping) {
        await this.redis.setex(key, this.TTL.TYPING_INDICATORS, '1');
      } else {
        await this.redis.del(key);
      }
      
      logger.debug(`⌨️ Set typing indicator for ${userId} in room ${roomId}: ${isTyping}`);
      return true;
    } catch (error) {
      logger.error(`Failed to set typing indicator:`, error);
      return false;
    }
  }

  async getTypingUsers(roomId: string): Promise<string[]> {
    try {
      const pattern = this.buildKey('typing', roomId, '*');
      const keys = await this.redis.keys(pattern);
      
      // Extract user IDs from keys
      const typingUsers = keys.map(key => {
        const parts = key.split(':');
        return parts[parts.length - 1]; // Last part is the user ID
      });
      
      return typingUsers;
    } catch (error) {
      logger.error(`Failed to get typing users for room ${roomId}:`, error);
      return [];
    }
  }

  // ==================== RATE LIMITING ====================
  
  /**
   * Implement rate limiting using Redis
   */
  async checkRateLimit(identifier: string, maxRequests: number = 100, windowSeconds: number = 60): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    try {
      const key = this.buildKey(this.KEY_PREFIXES.RATE_LIMIT, identifier);
      const current = await this.redis.incr(key);
      
      if (current === 1) {
        // First request in window - set expiry
        await this.redis.expire(key, windowSeconds);
      }
      
      const ttl = await this.redis.ttl(key);
      const resetTime = Date.now() + (ttl * 1000);
      
      return {
        allowed: current <= maxRequests,
        remaining: Math.max(0, maxRequests - current),
        resetTime
      };
    } catch (error) {
      logger.error(`Rate limit check failed for ${identifier}:`, error);
      // Fail open - allow the request if Redis is down
      return {
        allowed: true,
        remaining: 100,
        resetTime: Date.now() + 60000
      };
    }
  }

  // ==================== ANALYTICS & STATS CACHING ====================
  
  /**
   * Cache server statistics with appropriate TTL
   */
  async cacheServerStats(stats: any): Promise<boolean> {
    try {
      const key = this.buildKey(this.KEY_PREFIXES.STATS, 'server');
      const statsData = {
        ...stats,
        cached_at: Date.now(),
        timestamp: new Date().toISOString()
      };
      
      await this.redis.setex(key, this.TTL.SERVER_STATS, JSON.stringify(statsData));
      logger.debug(`📊 Cached server statistics`);
      return true;
    } catch (error) {
      logger.error('Failed to cache server stats:', error);
      return false;
    }
  }

  async getCachedServerStats(): Promise<any | null> {
    try {
      const key = this.buildKey(this.KEY_PREFIXES.STATS, 'server');
      const cached = await this.redis.get(key);
      
      if (cached) {
        const data = JSON.parse(cached);
        logger.debug(`📊 Cache hit for server stats`);
        return data;
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to get cached server stats:', error);
      return null;
    }
  }

  /**
   * Cache statistics (generic method)
   */
  async cacheStats(stats: any): Promise<boolean> {
    return this.cacheServerStats(stats);
  }

  /**
   * Get cached statistics (generic method)
   */
  async getCachedStats(): Promise<any | null> {
    return this.getCachedServerStats();
  }

  /**
   * Cache daily aggregated statistics
   */
  async cacheDailyStats(date: string, stats: any): Promise<boolean> {
    try {
      const key = this.buildKey(this.KEY_PREFIXES.STATS, 'daily', date);
      await this.redis.setex(key, this.TTL.DAILY_STATS, JSON.stringify(stats));
      logger.debug(`📊 Cached daily stats for ${date}`);
      return true;
    } catch (error) {
      logger.error(`Failed to cache daily stats for ${date}:`, error);
      return false;
    }
  }

  // ==================== FEATURE FLAGS & CONFIGURATION ====================
  
  /**
   * Cache feature flags for quick access
   */
  async cacheFeatureFlags(flags: Record<string, boolean>): Promise<boolean> {
    try {
      const key = this.buildKey(this.KEY_PREFIXES.CONFIG, 'features');
      await this.redis.setex(key, this.TTL.FEATURE_FLAGS, JSON.stringify(flags));
      logger.debug(`🚩 Cached feature flags`);
      return true;
    } catch (error) {
      logger.error('Failed to cache feature flags:', error);
      return false;
    }
  }

  async getCachedFeatureFlag(flagName: string): Promise<boolean | null> {
    try {
      const key = this.buildKey(this.KEY_PREFIXES.CONFIG, 'features');
      const cached = await this.redis.get(key);
      
      if (cached) {
        const flags = JSON.parse(cached);
        return flags[flagName] !== undefined ? flags[flagName] : null;
      }
      
      return null;
    } catch (error) {
      logger.error(`Failed to get feature flag ${flagName}:`, error);
      return null;
    }
  }

  // ==================== MATCHMAKING QUEUE METHODS ====================
  
  /**
   * Add user to matchmaking queue in Redis
   */
  async addToQueue(chatType: 'text' | 'video', user: User): Promise<boolean> {
    try {
      const key = `queue:${chatType}`;
      const userData = JSON.stringify({
        ...user,
        queuedAt: Date.now()
      });
      
      await this.redis.rpush(key, userData);
      await this.redis.expire(key, this.TTL.MATCHMAKING_QUEUE);
      
      logger.debug(`⏳ Added user ${user.id} to ${chatType} queue`);
      return true;
    } catch (error) {
      logger.error(`Failed to add user ${user.id} to ${chatType} queue:`, error);
      return false;
    }
  }

  /**
   * Get and remove the next user from queue (FIFO)
   */
  async popFromQueue(chatType: 'text' | 'video'): Promise<User | null> {
    try {
      const key = `queue:${chatType}`;
      const userData = await this.redis.lpop(key);
      
      if (userData) {
        const user = JSON.parse(userData) as User;
        logger.debug(`⏳ Popped user ${user.id} from ${chatType} queue`);
        return user;
      }
      
      return null;
    } catch (error) {
      logger.error(`Failed to pop from ${chatType} queue:`, error);
      return null;
    }
  }

  /**
   * Get queue length without removing items
   */
  async getQueueLength(chatType: 'text' | 'video'): Promise<number> {
    try {
      const key = `queue:${chatType}`;
      const length = await this.redis.llen(key);
      return length;
    } catch (error) {
      logger.error(`Failed to get ${chatType} queue length:`, error);
      return 0;
    }
  }

  /**
   * Remove specific user from queue
   */
  async removeFromQueue(chatType: 'text' | 'video', userId: string): Promise<boolean> {
    try {
      const key = `queue:${chatType}`;
      const queueItems = await this.redis.lrange(key, 0, -1);
      
      for (const item of queueItems) {
        const user = JSON.parse(item) as User;
        if (user.id === userId) {
          await this.redis.lrem(key, 1, item);
          logger.debug(`🗑️ Removed user ${userId} from ${chatType} queue`);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      logger.error(`Failed to remove user ${userId} from ${chatType} queue:`, error);
      return false;
    }
  }

  /**
   * Peek at queue position without removing
   */
  async peekAtQueue(chatType: 'text' | 'video', index: number): Promise<User | null> {
    try {
      const key = `queue:${chatType}`;
      const userData = await this.redis.lindex(key, index);
      
      if (userData) {
        return JSON.parse(userData) as User;
      }
      
      return null;
    } catch (error) {
      logger.debug(`Failed to peek at queue position ${index}:`, error);
      return null;
    }
  }

  /**
   * Get all users from a queue
   */
  async getAllFromQueue(chatType: 'text' | 'video'): Promise<User[]> {
    try {
      const key = `queue:${chatType}`;
      const items = await this.redis.lrange(key, 0, -1);
      
      return items.map(item => {
        try {
          return JSON.parse(item) as User;
        } catch {
          return null;
        }
      }).filter((user): user is User => user !== null);
    } catch (error) {
      logger.error(`Failed to get all users from ${chatType} queue:`, error);
      return [];
    }
  }

  // ==================== SOCKET MAPPING METHODS ====================
  
  /**
   * Map socket ID to auth ID
   */
  async setSocketMapping(socketId: string, authId: string): Promise<boolean> {
    try {
      const key = `socket:${socketId}`;
      await this.redis.setex(key, this.TTL.SESSION_DATA, authId);
      logger.debug(`🔗 Mapped socket ${socketId} to auth ${authId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to set socket mapping for ${socketId}:`, error);
      return false;
    }
  }

  /**
   * Get auth ID from socket ID
   */
  async getSocketMapping(socketId: string): Promise<string | null> {
    try {
      const key = `socket:${socketId}`;
      const authId = await this.redis.get(key);
      
      if (authId) {
        logger.debug(`🔗 Found mapping: socket ${socketId} -> auth ${authId}`);
        return authId;
      }
      
      return null;
    } catch (error) {
      logger.error(`Failed to get socket mapping for ${socketId}:`, error);
      return null;
    }
  }

  /**
   * Remove socket mapping
   */
  async removeSocketMapping(socketId: string): Promise<boolean> {
    try {
      const key = `socket:${socketId}`;
      await this.redis.del(key);
      logger.debug(`🗑️ Removed socket mapping for ${socketId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to remove socket mapping for ${socketId}:`, error);
      return false;
    }
  }

  // ==================== UTILITY METHODS ====================
  
  /**
   * Build consistent cache keys with prefixes
   */
  private buildKey(...parts: string[]): string {
    return parts.filter(Boolean).join(':');
  }

  /**
   * Enhanced connection test with detailed health info
   */
  async testConnection(): Promise<boolean> {
    try {
      const startTime = Date.now();
      const result = await this.redis.ping();
      const latency = Date.now() - startTime;
      
      const isHealthy = result === 'PONG' && latency < 1000;
      
      if (isHealthy) {
        logger.info(`✅ Redis connection test passed (${latency}ms)`);
      } else {
        logger.error(`❌ Redis connection test failed or slow (${latency}ms)`);
      }
      
      return isHealthy;
    } catch (error) {
      logger.error('❌ Redis connection test error:', error);
      return false;
    }
  }

  /**
   * Get comprehensive Redis stats
   */
  async getRedisStats(): Promise<any> {
    try {
      const [info, keyCount, memory] = await Promise.all([
        this.redis.info(),
        this.redis.dbsize(),
        this.redis.info('memory')
      ]);
      
      return {
        connected: this.isConnected,
        totalKeys: keyCount,
        memory: this.parseMemoryInfo(memory),
        server: this.parseServerInfo(info),
        performance: await this.getPerformanceStats()
      };
    } catch (error) {
      logger.error('Failed to get Redis stats:', error);
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private parseMemoryInfo(memoryInfo: string): any {
    const lines = memoryInfo.split('\r\n');
    const memory: any = {};
    
    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (key.includes('memory') || key.includes('Memory')) {
          memory[key] = value;
        }
      }
    });
    
    return memory;
  }

  private parseServerInfo(serverInfo: string): any {
    const lines = serverInfo.split('\r\n');
    const server: any = {};
    
    lines.forEach(line => {
      if (line.includes(':') && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        server[key] = isNaN(Number(value)) ? value : Number(value);
      }
    });
    
    return server;
  }

  private async getPerformanceStats(): Promise<any> {
    try {
      const startTime = Date.now();
      await this.redis.ping();
      const pingLatency = Date.now() - startTime;
      
      return {
        pingLatency,
        connectionRetries: this.connectionRetries,
        isConnected: this.isConnected
      };
    } catch (error) {
      return {
        pingLatency: -1,
        connectionRetries: this.connectionRetries,
        isConnected: false
      };
    }
  }

  /**
   * Enhanced cleanup with pattern-based key management
   */
  async cleanup(): Promise<void> {
    try {
      logger.info('🧹 Starting enhanced Redis cleanup...');
      
      await this.cleanupExpiredKeys('typing:*');
      await this.cleanupExpiredKeys(`${this.KEY_PREFIXES.RATE_LIMIT}:*`);
      await this.cleanupStaleQueueEntries();
      await this.cleanupExpiredKeys(`${this.KEY_PREFIXES.SESSION}:*`);
      
      logger.info('✅ Enhanced Redis cleanup completed');
    } catch (error) {
      logger.error('❌ Enhanced Redis cleanup failed:', error);
    }
  }

}