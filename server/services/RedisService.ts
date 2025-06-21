
// server/services/RedisService.ts - ENHANCED VERSION WITH PROPER ERROR HANDLING
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
  private isInitialized = false;
  private connectionAttempts = 0;
  private readonly MAX_CONNECTION_ATTEMPTS = 3;
  
  // Modular components
  public readonly profiles: ProfileCacheModule;
  public readonly queues: QueueModule;
  public readonly friends: FriendsCacheModule;
  public readonly onlineStatus: OnlineStatusModule;

  constructor(redisUrl: string, redisToken: string) {
    try {
      // Initialize connection with proper error handling
      this.connection = new RedisConnection(redisUrl, redisToken);
      
      // Initialize base cache
      this.cache = new RedisCache(this.connection.getRedisInstance());
      
      // Initialize modular components
      this.profiles = new ProfileCacheModule(this.cache);
      this.queues = new QueueModule(this.connection.getRedisInstance());
      this.friends = new FriendsCacheModule(this.cache);
      this.onlineStatus = new OnlineStatusModule(this.cache);

      // Attempt initial connection
      this.initializeConnection();
      
      logger.info('🔧 Enhanced RedisService initialized');
    } catch (error) {
      logger.error('❌ RedisService initialization failed:', error);
      throw error;
    }
  }

  private async initializeConnection(): Promise<void> {
    try {
      this.connectionAttempts++;
      const connected = await this.connection.testConnection();
      
      if (connected) {
        this.isInitialized = true;
        this.connectionAttempts = 0;
        logger.info('✅ Redis connection established successfully');
        
        // Perform initial setup tasks
        await this.performInitialSetup();
      } else {
        throw new Error('Connection test failed');
      }
    } catch (error) {
      logger.error(`❌ Redis connection attempt ${this.connectionAttempts} failed:`, error);
      
      if (this.connectionAttempts < this.MAX_CONNECTION_ATTEMPTS) {
        const retryDelay = Math.pow(2, this.connectionAttempts) * 1000; // Exponential backoff
        logger.info(`🔄 Retrying Redis connection in ${retryDelay}ms...`);
        
        setTimeout(() => {
          this.initializeConnection();
        }, retryDelay);
      } else {
        logger.error('🚨 Max Redis connection attempts reached. Running without Redis.');
        this.isInitialized = false;
      }
    }
  }

  private async performInitialSetup(): Promise<void> {
    try {
      // Clean up any stale data from previous sessions
      await this.cleanupStaleData();
      
      // Warm up cache with frequently accessed data
      await this.warmUpCache();
      
      logger.info('✅ Redis initial setup completed');
    } catch (error) {
      logger.error('❌ Redis initial setup failed:', error);
    }
  }

  private async cleanupStaleData(): Promise<void> {
    try {
      const redis = this.connection.getRedisInstance();
      
      // Clean up expired typing indicators
      const typingKeys = await redis.keys('typing:*');
      if (typingKeys.length > 0) {
        await redis.del(...typingKeys);
        logger.debug(`🧹 Cleaned ${typingKeys.length} stale typing indicators`);
      }
      
      // Clean up old socket mappings
      const socketKeys = await redis.keys('socket:*');
      const staleSocketKeys: string[] = [];
      
      for (const key of socketKeys) {
        const ttl = await redis.ttl(key);
        if (ttl <= 0) {
          staleSocketKeys.push(key);
        }
      }
      
      if (staleSocketKeys.length > 0) {
        await redis.del(...staleSocketKeys);
        logger.debug(`🧹 Cleaned ${staleSocketKeys.length} stale socket mappings`);
      }
      
      // Clean up stale queue entries
      await this.queues.cleanupStaleEntries();
      
    } catch (error) {
      logger.error('Failed to cleanup stale data:', error);
    }
  }

  private async warmUpCache(): Promise<void> {
    try {
      // This would typically load frequently accessed profiles
      // For now, we'll just log that warm-up is complete
      logger.debug('🔥 Cache warm-up completed');
    } catch (error) {
      logger.error('Cache warm-up failed:', error);
    }
  }

  // ==================== CONNECTION METHODS ====================
  
  async testConnection(): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }
    return this.connection.testConnection();
  }

  isRedisConnected(): boolean {
    return this.isInitialized && this.connection.isRedisConnected();
  }

  getRedisInstance() {
    if (!this.isInitialized) {
      throw new Error('Redis not initialized. Use fallback mechanisms.');
    }
    return this.connection.getRedisInstance();
  }

  async getRedisStats(): Promise<any> {
    if (!this.isInitialized) {
      return { connected: false, error: 'Redis not initialized' };
    }
    return this.connection.getStats();
  }

  async disconnect(): Promise<void> {
    this.isInitialized = false;
    return this.connection.disconnect();
  }

  // ==================== SAFE PROFILE METHODS ====================
  
  async cacheUserProfile(authId: string, profile: UserProfile, isFrequentlyUpdated: boolean = false): Promise<boolean> {
    if (!this.isInitialized) {
      logger.debug(`Redis not available for profile caching: ${authId}`);
      return false;
    }
    
    try {
      return await this.profiles.cacheProfile(authId, profile, isFrequentlyUpdated);
    } catch (error) {
      logger.error(`Profile caching failed for ${authId}:`, error);
      return false;
    }
  }

  async getCachedUserProfile(authId: string): Promise<UserProfile | null> {
    if (!this.isInitialized) {
      return null;
    }
    
    try {
      return await this.profiles.getProfile(authId);
    } catch (error) {
      logger.error(`Profile retrieval failed for ${authId}:`, error);
      return null;
    }
  }

  async invalidateUserProfile(authId: string): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }
    
    try {
      return await this.profiles.invalidateProfile(authId);
    } catch (error) {
      logger.error(`Profile invalidation failed for ${authId}:`, error);
      return false;
    }
  }

  async batchCacheProfiles(profiles: Array<{ authId: string; profile: UserProfile; isFrequentlyUpdated?: boolean }>): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }
    
    try {
      return await this.profiles.batchCacheProfiles(profiles);
    } catch (error) {
      logger.error('Batch profile caching failed:', error);
      return false;
    }
  }

  // ==================== SAFE FRIENDS METHODS ====================
  
  async cacheFriendsList(authId: string, friends: any[]): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }
    
    try {
      return await this.friends.cacheFriendsList(authId, friends);
    } catch (error) {
      logger.error(`Friends list caching failed for ${authId}:`, error);
      return false;
    }
  }

  async getCachedFriendsList(authId: string): Promise<any[] | null> {
    if (!this.isInitialized) {
      return null;
    }
    
    try {
      return await this.friends.getCachedFriendsList(authId);
    } catch (error) {
      logger.error(`Friends list retrieval failed for ${authId}:`, error);
      return null;
    }
  }

  async invalidateFriendsList(authId: string): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }
    
    try {
      return await this.friends.invalidateFriendsList(authId);
    } catch (error) {
      logger.error(`Friends list invalidation failed for ${authId}:`, error);
      return false;
    }
  }

  // ==================== SAFE ONLINE STATUS METHODS ====================
  
  async cacheUserOnlineStatus(authId: string, isOnline: boolean, lastSeen?: Date): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }
    
    try {
      return await this.onlineStatus.setOnlineStatus(authId, isOnline, lastSeen);
    } catch (error) {
      logger.error(`Online status caching failed for ${authId}:`, error);
      return false;
    }
  }

  async getCachedOnlineStatus(authId: string): Promise<{ isOnline: boolean; lastSeen: string } | null> {
    if (!this.isInitialized) {
      return null;
    }
    
    try {
      return await this.onlineStatus.getOnlineStatus(authId);
    } catch (error) {
      logger.error(`Online status retrieval failed for ${authId}:`, error);
      return null;
    }
  }

  async cacheOnlineUsers(userList: string[]): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }
    
    try {
      return await this.onlineStatus.cacheOnlineUsersList(userList);
    } catch (error) {
      logger.error('Online users caching failed:', error);
      return false;
    }
  }

  async getCachedOnlineUsers(): Promise<string[] | null> {
    if (!this.isInitialized) {
      return null;
    }
    
    try {
      return await this.onlineStatus.getCachedOnlineUsersList();
    } catch (error) {
      logger.error('Online users retrieval failed:', error);
      return null;
    }
  }

  async batchGetOnlineStatus(authIds: string[]): Promise<Array<{ authId: string; isOnline: boolean; lastSeen: string } | null>> {
    if (!this.isInitialized) {
      return authIds.map(() => null);
    }
    
    try {
      return await this.onlineStatus.batchGetOnlineStatus(authIds);
    } catch (error) {
      logger.error('Batch online status retrieval failed:', error);
      return authIds.map(() => null);
    }
  }

  async batchSetOnlineStatus(updates: Array<{ authId: string; isOnline: boolean; lastSeen?: Date }>): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }
    
    try {
      return await this.onlineStatus.batchSetOnlineStatus(updates);
    } catch (error) {
      logger.error('Batch online status update failed:', error);
      return false;
    }
  }

  // ==================== SAFE QUEUE METHODS ====================
  
  async addToQueue(chatType: 'text' | 'video', user: User): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }
    
    try {
      return await this.queues.addToQueue(chatType, user);
    } catch (error) {
      logger.error(`Queue addition failed for ${user.id}:`, error);
      return false;
    }
  }

  async removeFromQueue(chatType: 'text' | 'video', userId: string): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }
    
    try {
      return await this.queues.removeFromQueue(chatType, userId);
    } catch (error) {
      logger.error(`Queue removal failed for ${userId}:`, error);
      return false;
    }
  }

  async getQueueLength(chatType: 'text' | 'video'): Promise<number> {
    if (!this.isInitialized) {
      return 0;
    }
    
    try {
      return await this.queues.getQueueLength(chatType);
    } catch (error) {
      logger.error(`Queue length retrieval failed for ${chatType}:`, error);
      return 0;
    }
  }

  async popFromQueue(chatType: 'text' | 'video'): Promise<User | null> {
    if (!this.isInitialized) {
      return null;
    }
    
    try {
      return await this.queues.popFromQueue(chatType);
    } catch (error) {
      logger.error(`Queue pop failed for ${chatType}:`, error);
      return null;
    }
  }

  async getAllFromQueue(chatType: 'text' | 'video'): Promise<User[]> {
    if (!this.isInitialized) {
      return [];
    }
    
    try {
      return await this.queues.getAllFromQueue(chatType);
    } catch (error) {
      logger.error(`Queue retrieval failed for ${chatType}:`, error);
      return [];
    }
  }

  async clearAllQueues(): Promise<{ cleared: number }> {
    if (!this.isInitialized) {
      return { cleared: 0 };
    }
    
    try {
      return await this.queues.clearAllQueues();
    } catch (error) {
      logger.error('Queue clearing failed:', error);
      return { cleared: 0 };
    }
  }

  // ==================== ENHANCED SESSION MANAGEMENT ====================
  
  async setSocketMapping(socketId: string, authId: string): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }
    
    try {
      return await this.cache.set(`socket:${socketId}`, authId, 2 * 60 * 60);
    } catch (error) {
      logger.error(`Socket mapping failed for ${socketId}:`, error);
      return false;
    }
  }

  async getSocketMapping(socketId: string): Promise<string | null> {
    if (!this.isInitialized) {
      return null;
    }
    
    try {
      return await this.cache.get<string>(`socket:${socketId}`);
    } catch (error) {
      logger.error(`Socket mapping retrieval failed for ${socketId}:`, error);
      return null;
    }
  }

  async removeSocketMapping(socketId: string): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }
    
    try {
      return await this.cache.del(`socket:${socketId}`);
    } catch (error) {
      logger.error(`Socket mapping removal failed for ${socketId}:`, error);
      return false;
    }
  }

  // ==================== ENHANCED CLEANUP & MAINTENANCE ====================
  
  async cleanup(): Promise<void> {
    if (!this.isInitialized) {
      logger.debug('Redis not initialized, skipping cleanup');
      return;
    }
    
    try {
      logger.info('🧹 Starting comprehensive Redis cleanup...');
      
      // Cleanup expired keys with different patterns
      const cleanupPatterns = [
        'typing:*',
        'rate:*', 
        'socket:*',
        'temp:*'
      ];
      
      for (const pattern of cleanupPatterns) {
        try {
          await this.cache.cleanupExpired(pattern);
        } catch (error) {
          logger.warn(`Cleanup failed for pattern ${pattern}:`, error);
        }
      }
      
      // Cleanup stale queue entries
      try {
        await this.queues.cleanupStaleEntries();
      } catch (error) {
        logger.warn('Queue cleanup failed:', error);
      }
      
      // Force garbage collection on Redis
      try {
        const redis = this.connection.getRedisInstance();
        await redis.memory('purge');
      } catch (error) {
        logger.debug('Redis memory purge failed (may not be supported):', error);
      }
      
      logger.info('✅ Redis cleanup completed successfully');
    } catch (error) {
      logger.error('❌ Redis cleanup failed:', error);
    }
  }

  // ==================== ENHANCED HEALTH & MONITORING ====================
  
  async getHealthStatus(): Promise<{
    connected: boolean;
    modules: Record<string, boolean>;
    stats: any;
    errors: string[];
  }> {
    const errors: string[] = [];
    let connected = false;
    
    try {
      connected = await this.testConnection();
    } catch (error) {
      errors.push(`Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Test each module
    const moduleTests = {
      profiles: async () => {
        try {
          await this.profiles.getProfile('health-check-test');
          return true;
        } catch {
          return false;
        }
      },
      queues: async () => {
        try {
          await this.queues.getQueueLength('text');
          return true;
        } catch {
          return false;
        }
      },
      friends: async () => {
        try {
          await this.friends.getCachedFriendsList('health-check-test');
          return true;
        } catch {
          return false;
        }
      },
      onlineStatus: async () => {
        try {
          await this.onlineStatus.getOnlineStatus('health-check-test');
          return true;
        } catch {
          return false;
        }
      },
      cache: async () => {
        try {
          await this.cache.get('health-check-test');
          return true;
        } catch {
          return false;
        }
      }
    };
    
    const modules: Record<string, boolean> = {};
    
    if (connected) {
      for (const [name, test] of Object.entries(moduleTests)) {
        try {
          modules[name] = await test();
        } catch (error) {
          modules[name] = false;
          errors.push(`Module ${name} test failed`);
        }
      }
    } else {
      Object.keys(moduleTests).forEach(name => {
        modules[name] = false;
      });
    }
    
    return {
      connected,
      modules,
      stats: connected ? await this.getRedisStats() : null,
      errors
    };
  }

  // ==================== ENHANCED CONVENIENCE METHODS ====================
  
  async set(key: string, value: any, ttl: number): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }
    
    try {
      return await this.cache.set(key, value, ttl);
    } catch (error) {
      logger.error(`Cache set failed for key ${key}:`, error);
      return false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isInitialized) {
      return null;
    }
    
    try {
      return await this.cache.get<T>(key);
    } catch (error) {
      logger.error(`Cache get failed for key ${key}:`, error);
      return null;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }
    
    try {
      return await this.cache.del(key);
    } catch (error) {
      logger.error(`Cache delete failed for key ${key}:`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }
    
    try {
      return await this.cache.exists(key);
    } catch (error) {
      logger.error(`Cache exists check failed for key ${key}:`, error);
      return false;
    }
  }

  // ==================== UTILITY METHODS ====================
  
  async flushAll(): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }
    
    try {
      const redis = this.connection.getRedisInstance();
      await redis.flushall();
      logger.warn('🗑️ Redis database flushed completely');
      return true;
    } catch (error) {
      logger.error('Redis flush failed:', error);
      return false;
    }
  }
  
  async getKeyCount(): Promise<number> {
    if (!this.isInitialized) {
      return 0;
    }
    
    try {
      const redis = this.connection.getRedisInstance();
      return await redis.dbsize();
    } catch (error) {
      logger.error('Key count retrieval failed:', error);
      return 0;
    }
  }

  async getMemoryUsage(): Promise<{ used: string; peak: string; total: string } | null> {
    if (!this.isInitialized) {
      return null;
    }
    
    try {
      const redis = this.connection.getRedisInstance();
      const info = await redis.info('memory');
      const lines = info.split('\r\n');
      
      const memoryData: any = {};
      lines.forEach(line => {
        if (line.includes(':') && !line.startsWith('#')) {
          const [key, value] = line.split(':');
          memoryData[key] = value;
        }
      });
      
      return {
        used: memoryData.used_memory_human || '0B',
        peak: memoryData.used_memory_peak_human || '0B',
        total: memoryData.total_system_memory_human || '0B'
      };
    } catch (error) {
      logger.error('Memory usage retrieval failed:', error);
      return null;
    }
  }
}
