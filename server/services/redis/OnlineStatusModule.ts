// server/services/redis/OnlineStatusModule.ts
import { RedisCache } from './RedisCache';
import { RedisConfig } from './RedisConfig';
import { logger } from '../../utils/logger';

interface OnlineStatusData {
  isOnline: boolean;
  lastSeen: string;
  updated_at: number;
}

export class OnlineStatusModule {
  constructor(private cache: RedisCache) {}

  async setOnlineStatus(authId: string, isOnline: boolean, lastSeen?: Date): Promise<boolean> {
    const key = RedisConfig.buildKey(RedisConfig.PREFIXES.ONLINE, authId);
    const statusData: OnlineStatusData = {
      isOnline,
      lastSeen: lastSeen?.toISOString() || new Date().toISOString(),
      updated_at: Date.now()
    };
    
    const success = await this.cache.set(key, statusData, RedisConfig.TTL.ONLINE_STATUS);
    if (success) {
      logger.debug(`📊 Set online status ${authId}: ${isOnline}`);
    }
    return success;
  }

  async getOnlineStatus(authId: string): Promise<{ isOnline: boolean; lastSeen: string } | null> {
    const key = RedisConfig.buildKey(RedisConfig.PREFIXES.ONLINE, authId);
    const cached = await this.cache.get<OnlineStatusData>(key);
    
    if (cached) {
      logger.debug(`📊 Online status cache hit: ${authId} (${cached.isOnline})`);
      return {
        isOnline: cached.isOnline,
        lastSeen: cached.lastSeen
      };
    }
    
    return null;
  }

  async batchSetOnlineStatus(updates: Array<{ authId: string; isOnline: boolean; lastSeen?: Date }>): Promise<boolean> {
    const operations = updates.map(({ authId, isOnline, lastSeen }) => {
      const key = RedisConfig.buildKey(RedisConfig.PREFIXES.ONLINE, authId);
      const statusData: OnlineStatusData = {
        isOnline,
        lastSeen: lastSeen?.toISOString() || new Date().toISOString(),
        updated_at: Date.now()
      };
      
      return { key, value: statusData, ttl: RedisConfig.TTL.ONLINE_STATUS };
    });
    
    const success = await this.cache.batchSet(operations);
    if (success) {
      logger.debug(`📊 Batch updated ${updates.length} online statuses`);
    }
    return success;
  }

  async batchGetOnlineStatus(authIds: string[]): Promise<Array<{ authId: string; isOnline: boolean; lastSeen: string } | null>> {
    const keys = authIds.map(authId => 
      RedisConfig.buildKey(RedisConfig.PREFIXES.ONLINE, authId)
    );
    
    const cached = await this.cache.batchGet<OnlineStatusData>(keys);
    
    return cached.map((item, index) => {
      if (!item) return null;
      
      return {
        authId: authIds[index],
        isOnline: item.isOnline,
        lastSeen: item.lastSeen
      };
    });
  }

  async cacheOnlineUsersList(userList: string[]): Promise<boolean> {
    const key = 'online_users_list';
    const cacheData = {
      users: userList,
      cached_at: Date.now(),
      count: userList.length
    };
    
    const success = await this.cache.set(key, cacheData, 15); // 15 seconds TTL
    if (success) {
      logger.debug(`👥 Cached ${userList.length} online users`);
    }
    return success;
  }

  async getCachedOnlineUsersList(): Promise<string[] | null> {
    const key = 'online_users_list';
    const cached = await this.cache.get<{ users: string[]; count: number }>(key);
    
    if (cached) {
      logger.debug(`👥 Online users cache hit: ${cached.count} users`);
      return cached.users;
    }
    
    return null;
  }

  async setUserActivity(authId: string, activity: string): Promise<boolean> {
    const key = RedisConfig.buildKey('activity', authId);
    const activityData = {
      activity,
      timestamp: Date.now(),
      lastSeen: new Date().toISOString()
    };
    
    const success = await this.cache.set(key, activityData, 300); // 5 minutes TTL
    if (success) {
      logger.debug(`🎯 Set activity for ${authId}: ${activity}`);
    }
    return success;
  }

  async getUserActivity(authId: string): Promise<{ activity: string; timestamp: number } | null> {
    const key = RedisConfig.buildKey('activity', authId);
    const cached = await this.cache.get<{ activity: string; timestamp: number }>(key);
    
    if (cached) {
      logger.debug(`🎯 Activity cache hit: ${authId} (${cached.activity})`);
      return cached;
    }
    
    return null;
  }

  async invalidateUserStatus(authId: string): Promise<boolean> {
    const keys = [
      RedisConfig.buildKey(RedisConfig.PREFIXES.ONLINE, authId),
      RedisConfig.buildKey('activity', authId)
    ];
    
    const success = await this.cache.batchDel(keys);
    if (success) {
      logger.debug(`🗑️ Invalidated status for ${authId}`);
    }
    return success;
  }

  async getOnlineStats(): Promise<{
    totalOnline: number;
    recentlyActive: number;
    cacheHits: number;
  }> {
    // This would require tracking metrics in a real implementation
    return {
      totalOnline: 0, // Would need to count online users
      recentlyActive: 0, // Users active in last 5 minutes
      cacheHits: 0 // Cache hit statistics
    };
  }
}