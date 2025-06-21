// server/services/RedisService.ts - FIXED VERSION
import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { UserProfile } from '../managers/ProfileManager';
import { User } from '../types/User';

export class RedisService {
  private redis: Redis;
  
  // TTL Constants (Time To Live in seconds)
  private readonly TTL = {
    USER_PROFILE: 300,        // 5 minutes - profiles don't change often
    ONLINE_USERS: 30,         // 30 seconds - needs to be fresh
    MATCHMAKING_QUEUE: 600,   // 10 minutes - users shouldn't wait this long
    SOCKET_MAPPING: 1800,     // 30 minutes - longer sessions
    ROOM_INFO: 3600,          // 1 hour - active rooms
    USER_SESSION: 7200,       // 2 hours - user session data
    STATS_CACHE: 60,          // 1 minute - statistics
  };

        constructor(redisUrl: string, redisToken: string) {
        this.redis = new Redis(redisUrl, {
            password: redisToken,
            tls: {}, // Upstash requires TLS

            // ✅ These are valid and helpful:
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            connectTimeout: 10000,
        });

        this.setupEventListeners();
    }


  private setupEventListeners(): void {
    this.redis.on('connect', () => {
      logger.info('✅ Redis connected successfully');
    });

    this.redis.on('error', (err) => {
      logger.error('❌ Redis connection error:', err);
    });

    this.redis.on('ready', () => {
      logger.info('🚀 Redis ready for operations');
    });

    this.redis.on('close', () => {
      logger.warn('⚠️ Redis connection closed');
    });

    this.redis.on('reconnecting', () => {
      logger.info('🔄 Redis reconnecting...');
    });
  }

  // ==================== PROFILE CACHING ====================
  
  /**
   * Cache a user profile in Redis
   * Key format: "profile:authId"
   */
  async cacheUserProfile(authId: string, profile: UserProfile): Promise<boolean> {
    try {
      const key = `profile:${authId}`;
      // Store profile as JSON string with TTL
      await this.redis.setex(key, this.TTL.USER_PROFILE, JSON.stringify(profile));
      logger.debug(`📋 Cached profile for user ${authId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to cache profile for ${authId}:`, error);
      return false;
    }
  }

  /**
   * Get a cached user profile from Redis
   * Returns null if not found or expired
   */
  async getCachedUserProfile(authId: string): Promise<UserProfile | null> {
    try {
      const key = `profile:${authId}`;
      const cached = await this.redis.get(key);
      
      if (cached) {
        const profile = JSON.parse(cached) as UserProfile;
        logger.debug(`📋 Cache hit for profile ${authId}`);
        return profile;
      }
      
      logger.debug(`📋 Cache miss for profile ${authId}`);
      return null;
    } catch (error) {
      logger.error(`Failed to get cached profile for ${authId}:`, error);
      return null;
    }
  }

  /**
   * Remove a user profile from cache (when updated)
   */
  async invalidateUserProfile(authId: string): Promise<boolean> {
    try {
      const key = `profile:${authId}`;
      await this.redis.del(key);
      logger.debug(`🗑️ Invalidated profile cache for ${authId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to invalidate profile for ${authId}:`, error);
      return false;
    }
  }

  // ==================== ONLINE USERS CACHING ====================

  /**
   * Cache the list of online users
   * Key: "online_users"
   */
  async cacheOnlineUsers(userList: string[]): Promise<boolean> {
    try {
      const key = 'online_users';
      // Store as JSON array with short TTL (data changes frequently)
      await this.redis.setex(key, this.TTL.ONLINE_USERS, JSON.stringify(userList));
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

  // ==================== SOCKET MAPPING CACHING ====================

  /**
   * Map socket ID to auth ID for quick lookups
   * Key format: "socket:socketId"
   */
  async setSocketMapping(socketId: string, authId: string): Promise<boolean> {
    try {
      const key = `socket:${socketId}`;
      // Store with longer TTL since socket sessions can be long
      await this.redis.setex(key, this.TTL.SOCKET_MAPPING, authId);
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
   * Remove socket mapping when user disconnects
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

  // ==================== MATCHMAKING QUEUE CACHING ====================

  /**
   * Add user to matchmaking queue in Redis
   * Key format: "queue:text" or "queue:video"
   */
  async addToQueue(chatType: 'text' | 'video', user: User): Promise<boolean> {
    try {
      const key = `queue:${chatType}`;
      // Store user data as JSON in a Redis list (FIFO queue)
      const userData = JSON.stringify({
        ...user,
        queuedAt: Date.now() // Add timestamp for queue management
      });
      
      // Add to end of list (FIFO - first in, first out)
      await this.redis.rpush(key, userData);
      // Set TTL on the key (refreshed each time someone joins)
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
      // Remove and return first element (FIFO)
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
   * Remove specific user from queue (when they disconnect or get matched)
   */
  async removeFromQueue(chatType: 'text' | 'video', userId: string): Promise<boolean> {
    try {
      const key = `queue:${chatType}`;
      // Get all queue items
      const queueItems = await this.redis.lrange(key, 0, -1);
      
      // Find and remove the user
      for (const item of queueItems) {
        const user = JSON.parse(item) as User;
        if (user.id === userId) {
          // Remove this specific item from the list
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

  // ==================== ROOM INFORMATION CACHING ====================

  /**
   * Cache active room information
   * Key format: "room:roomId"
   */
  async cacheRoomInfo(roomId: string, roomData: any): Promise<boolean> {
    try {
      const key = `room:${roomId}`;
      // Store room data with longer TTL since rooms can be active for a while
      await this.redis.setex(key, this.TTL.ROOM_INFO, JSON.stringify(roomData));
      logger.debug(`🏠 Cached room info for ${roomId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to cache room info for ${roomId}:`, error);
      return false;
    }
  }

  /**
   * Get cached room information
   */
  async getCachedRoomInfo(roomId: string): Promise<any | null> {
    try {
      const key = `room:${roomId}`;
      const cached = await this.redis.get(key);
      
      if (cached) {
        const roomData = JSON.parse(cached);
        logger.debug(`🏠 Cache hit for room ${roomId}`);
        return roomData;
      }
      
      return null;
    } catch (error) {
      logger.error(`Failed to get cached room info for ${roomId}:`, error);
      return null;
    }
  }

  /**
   * Remove room from cache when it's deleted
   */
  async invalidateRoomInfo(roomId: string): Promise<boolean> {
    try {
      const key = `room:${roomId}`;
      await this.redis.del(key);
      logger.debug(`🗑️ Invalidated room cache for ${roomId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to invalidate room cache for ${roomId}:`, error);
      return false;
    }
  }

  // ==================== STATISTICS CACHING ====================

  /**
   * Cache server statistics to reduce computation
   */
  async cacheStats(statsData: any): Promise<boolean> {
    try {
      const key = 'server_stats';
      // Short TTL since stats change frequently
      await this.redis.setex(key, this.TTL.STATS_CACHE, JSON.stringify(statsData));
      logger.debug(`📊 Cached server statistics`);
      return true;
    } catch (error) {
      logger.error('Failed to cache server stats:', error);
      return false;
    }
  }

  /**
   * Get cached server statistics
   */
  async getCachedStats(): Promise<any | null> {
    try {
      const key = 'server_stats';
      const cached = await this.redis.get(key);
      
      if (cached) {
        const stats = JSON.parse(cached);
        logger.debug(`📊 Cache hit for server stats`);
        return stats;
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to get cached stats:', error);
      return null;
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Test Redis connection health
   */
  async testConnection(): Promise<boolean> {
    try {
      // Simple ping test
      const result = await this.redis.ping();
      const isHealthy = result === 'PONG';
      
      if (isHealthy) {
        logger.info('✅ Redis connection test passed');
      } else {
        logger.error('❌ Redis connection test failed');
      }
      
      return isHealthy;
    } catch (error) {
      logger.error('❌ Redis connection test error:', error);
      return false;
    }
  }

  /**
   * Get Redis memory usage and stats
   */
  async getRedisStats(): Promise<any> {
    try {
      // Get Redis INFO command output
      const info = await this.redis.info('memory');
      const keyCount = await this.redis.dbsize();
      
      return {
        memoryUsage: info,
        totalKeys: keyCount,
        connected: true
      };
    } catch (error) {
      logger.error('Failed to get Redis stats:', error);
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Clean up expired keys and perform maintenance
   */
  async cleanup(): Promise<void> {
    try {
      // Clean up old queue entries (older than 10 minutes)
      const queues = ['queue:text', 'queue:video'];
      const cutoffTime = Date.now() - (10 * 60 * 1000); // 10 minutes ago
      
      for (const queueKey of queues) {
        const queueItems = await this.redis.lrange(queueKey, 0, -1);
        
        for (const item of queueItems) {
          try {
            const user = JSON.parse(item) as User & { queuedAt: number };
            // Remove users who have been queued for too long
            if (user.queuedAt && user.queuedAt < cutoffTime) {
              await this.redis.lrem(queueKey, 1, item);
              logger.debug(`🧹 Cleaned up stale queue entry for user ${user.id}`);
            }
          } catch (parseError) {
            // Remove invalid JSON entries
            await this.redis.lrem(queueKey, 1, item);
            logger.warn(`🧹 Removed invalid queue entry: ${item.substring(0, 50)}...`);
          }
        }
      }
      
      logger.info('✅ Redis cleanup completed');
    } catch (error) {
      logger.error('❌ Redis cleanup failed:', error);
    }
  }

  /**
   * Gracefully close Redis connection
   */
  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
      logger.info('✅ Redis connection closed gracefully');
    } catch (error) {
      logger.error('❌ Error closing Redis connection:', error);
    }
  }

  // ==================== BATCH OPERATIONS ====================

  /**
   * Batch multiple cache operations for better performance
   */
  async batchOperations(operations: Array<{
    operation: 'set' | 'get' | 'del';
    key: string;
    value?: any;
    ttl?: number;
  }>): Promise<any[]> {
    try {
      // Use Redis pipeline for batch operations
      const pipeline = this.redis.pipeline();
      
      // Add all operations to pipeline
      for (const op of operations) {
        switch (op.operation) {
          case 'set':
            if (op.ttl) {
              pipeline.setex(op.key, op.ttl, JSON.stringify(op.value));
            } else {
              pipeline.set(op.key, JSON.stringify(op.value));
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
      
      // Execute all operations at once
      const results = await pipeline.exec();
      logger.debug(`📦 Executed ${operations.length} batch operations`);
      
      return results || [];
    } catch (error) {
      logger.error('Failed to execute batch operations:', error);
      return [];
    }
  }

  // ==================== PEEK OPERATIONS ====================

  /**
   * Peek at queue position without removing (for matchmaking)
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
   * Get Redis instance for advanced operations (use carefully)
   */
  getRedisInstance(): Redis {
    return this.redis;
  }
}