// server/services/RedisService.ts - MAIN MODULAR SERVICE
import { RedisConnection } from './redis/RedisConnection';
import { RedisCache } from './redis/RedisCache';
import { ProfileCacheModule } from './redis/ProfileCacheModule';
import { QueueModule } from './redis/QueueModule';
import { FriendsCacheModule } from './redis/FriendsCacheModule';
import { OnlineStatusModule } from './redis/OnlineStatusModule';
import { UserProfile } from '../managers/profile/ProfileManager';
import { User } from '../types/User';
import { logger } from '../utils/logger';

export class RedisService {
  private connection: RedisConnection;
  private cache: RedisCache;
  
  // Modular components
  public readonly profiles: ProfileCacheModule;
  public readonly queues: QueueModule;
  public readonly friends: FriendsCacheModule;
  public readonly onlineStatus: OnlineStatusModule;

  constructor(redisUrl: string, redisToken: string) {
    // Initialize connection
    this.connection = new RedisConnection(redisUrl, redisToken);
    
    // Initialize base cache
    this.cache = new RedisCache(this.connection.getRedisInstance());
    
    // Initialize modular components
    this.profiles = new ProfileCacheModule(this.cache);
    this.queues = new QueueModule(this.connection.getRedisInstance());
    this.friends = new FriendsCacheModule(this.cache);
    this.onlineStatus = new OnlineStatusModule(this.cache);

    logger.info('🔧 Modular RedisService initialized');
  }

  // ==================== CONNECTION METHODS ====================
  
  async testConnection(): Promise<boolean> {
    return this.connection.testConnection();
  }

  isRedisConnected(): boolean {
    return this.connection.isRedisConnected();
  }

  getRedisInstance() {
    return this.connection.getRedisInstance();
  }

  async getRedisStats(): Promise<any> {
    return this.connection.getStats();
  }

  async disconnect(): Promise<void> {
    return this.connection.disconnect();
  }

  // ==================== PROFILE METHODS (Delegated) ====================
  
  async cacheUserProfile(authId: string, profile: UserProfile, isFrequentlyUpdated: boolean = false): Promise<boolean> {
    return this.profiles.cacheProfile(authId, profile, isFrequentlyUpdated);
  }

  async getCachedUserProfile(authId: string): Promise<UserProfile | null> {
    return this.profiles.getProfile(authId);
  }

  async invalidateUserProfile(authId: string): Promise<boolean> {
    return this.profiles.invalidateProfile(authId);
  }

  async batchCacheProfiles(profiles: Array<{ authId: string; profile: UserProfile; isFrequentlyUpdated?: boolean }>): Promise<boolean> {
    return this.profiles.batchCacheProfiles(profiles);
  }

  // ==================== FRIENDS METHODS (Delegated) ====================
  
  async cacheFriendsList(authId: string, friends: any[]): Promise<boolean> {
    return this.friends.cacheFriendsList(authId, friends);
  }

  async getCachedFriendsList(authId: string): Promise<any[] | null> {
    return this.friends.getCachedFriendsList(authId);
  }

  async invalidateFriendsList(authId: string): Promise<boolean> {
    return this.friends.invalidateFriendsList(authId);
  }

  // ==================== ONLINE STATUS METHODS (Delegated) ====================
  
  async cacheUserOnlineStatus(authId: string, isOnline: boolean, lastSeen?: Date): Promise<boolean> {
    return this.onlineStatus.setOnlineStatus(authId, isOnline, lastSeen);
  }

  async getCachedOnlineStatus(authId: string): Promise<{ isOnline: boolean; lastSeen: string } | null> {
    return this.onlineStatus.getOnlineStatus(authId);
  }

  async cacheOnlineUsers(userList: string[]): Promise<boolean> {
    return this.onlineStatus.cacheOnlineUsersList(userList);
  }

  async getCachedOnlineUsers(): Promise<string[] | null> {
    return this.onlineStatus.getCachedOnlineUsersList();
  }

  // ==================== QUEUE METHODS (Delegated) ====================
  
  async addToQueue(chatType: 'text' | 'video', user: User): Promise<boolean> {
    return this.queues.addToQueue(chatType, user);
  }

  async removeFromQueue(chatType: 'text' | 'video', userId: string): Promise<boolean> {
    return this.queues.removeFromQueue(chatType, userId);
  }

  async getQueueLength(chatType: 'text' | 'video'): Promise<number> {
    return this.queues.getQueueLength(chatType);
  }

  async popFromQueue(chatType: 'text' | 'video'): Promise<User | null> {
    return this.queues.popFromQueue(chatType);
  }

  async getAllFromQueue(chatType: 'text' | 'video'): Promise<User[]> {
    return this.queues.getAllFromQueue(chatType);
  }

  async clearAllQueues(): Promise<{ cleared: number }> {
    return this.queues.clearAllQueues();
  }

  // ==================== SESSION & SOCKET MAPPING ====================
  
  async setSocketMapping(socketId: string, authId: string): Promise<boolean> {
    return this.cache.set(`socket:${socketId}`, authId, 2 * 60 * 60); // 2 hours
  }

  async getSocketMapping(socketId: string): Promise<string | null> {
    return this.cache.get<string>(`socket:${socketId}`);
  }

  async removeSocketMapping(socketId: string): Promise<boolean> {
    return this.cache.del(`socket:${socketId}`);
  }

  // ==================== RATE LIMITING ====================
  
  async checkRateLimit(identifier: string, maxRequests: number = 100, windowSeconds: number = 60): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    try {
      const key = `rate:${identifier}`;
      const current = await this.cache.increment(key, windowSeconds);
      
      if (current === 1) {
        await this.cache.expire(key, windowSeconds);
      }
      
      const redis = this.connection.getRedisInstance();
      const ttl = await redis.ttl(key);
      const resetTime = Date.now() + (ttl * 1000);
      
      return {
        allowed: current <= maxRequests,
        remaining: Math.max(0, maxRequests - current),
        resetTime
      };
    } catch (error) {
      logger.error(`Rate limit check failed for ${identifier}:`, error);
      // Fail open - allow request if Redis is down
      return {
        allowed: true,
        remaining: 100,
        resetTime: Date.now() + 60000
      };
    }
  }

  // ==================== STATS & ANALYTICS ====================
  
  async cacheServerStats(stats: any): Promise<boolean> {
    return this.cache.set('stats:server', {
      ...stats,
      cached_at: Date.now(),
      timestamp: new Date().toISOString()
    }, 60); // 1 minute TTL
  }

  async getCachedServerStats(): Promise<any | null> {
    return this.cache.get<any>('stats:server');
  }

  // ==================== TYPING INDICATORS ====================
  
  async setTypingIndicator(roomId: string, userId: string, isTyping: boolean): Promise<boolean> {
    const key = `typing:${roomId}:${userId}`;
    
    if (isTyping) {
      return this.cache.set(key, '1', 5); // 5 seconds TTL
    } else {
      return this.cache.del(key);
    }
  }

  async getTypingUsers(roomId: string): Promise<string[]> {
    try {
      const redis = this.connection.getRedisInstance();
      const keys = await redis.keys(`typing:${roomId}:*`);
      
      return keys.map(key => {
        const parts = key.split(':');
        return parts[parts.length - 1]; // Last part is user ID
      });
    } catch (error) {
      logger.error(`Failed to get typing users for room ${roomId}:`, error);
      return [];
    }
  }

  // ==================== BATCH OPERATIONS ====================
  
  async batchOperations(operations: Array<{
    operation: 'set' | 'get' | 'del' | 'setex';
    key: string;
    value?: any;
    ttl?: number;
  }>): Promise<any[]> {
    try {
      const redis = this.connection.getRedisInstance();
      const pipeline = redis.pipeline();
      
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

  // ==================== CLEANUP & MAINTENANCE ====================
  
  async cleanup(): Promise<void> {
    try {
      logger.info('🧹 Starting Redis cleanup...');
      
      // Cleanup expired keys
      await this.cache.cleanupExpired('typing:*');
      await this.cache.cleanupExpired('rate:*');
      await this.cache.cleanupExpired('socket:*');
      
      // Cleanup stale queue entries
      await this.queues.cleanupStaleEntries();
      
      logger.info('✅ Redis cleanup completed');
    } catch (error) {
      logger.error('❌ Redis cleanup failed:', error);
    }
  }

  // ==================== HEALTH & MONITORING ====================
  
  async getHealthStatus(): Promise<{
    connected: boolean;
    modules: Record<string, boolean>;
    stats: any;
  }> {
    const connected = await this.testConnection();
    
    return {
      connected,
      modules: {
        profiles: true,
        queues: true,
        friends: true,
        onlineStatus: true,
        cache: true
      },
      stats: connected ? await this.getRedisStats() : null
    };
  }

  // ==================== CONVENIENCE METHODS ====================
  
  // Generic cache methods for other use cases
  async set(key: string, value: any, ttl: number): Promise<boolean> {
    return this.cache.set(key, value, ttl);
  }

  async get<T>(key: string): Promise<T | null> {
    return this.cache.get<T>(key);
  }

  async del(key: string): Promise<boolean> {
    return this.cache.del(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.cache.exists(key);
  }
}