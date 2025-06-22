// server/services/redis/FriendsCacheModule.ts
import { RedisCache } from './RedisCache';
import { RedisConfig } from './RedisConfig';
import { logger } from '../../utils/logger';

export interface FriendData {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  status: string;
  last_seen: string;
  is_online: boolean;
  friends_since?: string;
}

interface CachedFriendsList {
  friends: FriendData[];
  cached_at: number;
  count: number;
}

export class FriendsCacheModule {
  constructor(private cache: RedisCache) {}

  async cacheFriendsList(authId: string, friends: FriendData[]): Promise<boolean> {
    const key = RedisConfig.buildKey(RedisConfig.PREFIXES.FRIENDS, authId);
    const cacheData: CachedFriendsList = {
      friends,
      cached_at: Date.now(),
      count: friends.length
    };
    
    const success = await this.cache.set(key, cacheData, RedisConfig.TTL.FRIENDS);
    if (success) {
      logger.debug(`👥 Cached ${friends.length} friends for ${authId}`);
    }
    return success;
  }

  async getCachedFriendsList(authId: string): Promise<FriendData[] | null> {
    const key = RedisConfig.buildKey(RedisConfig.PREFIXES.FRIENDS, authId);
    const cached = await this.cache.get<CachedFriendsList>(key);
    
    if (cached) {
      logger.debug(`👥 Friends cache hit ${authId} (${cached.count} friends)`);
      return cached.friends;
    }
    
    logger.debug(`👥 Friends cache miss: ${authId}`);
    return null;
  }

  async invalidateFriendsList(authId: string): Promise<boolean> {
    const key = RedisConfig.buildKey(RedisConfig.PREFIXES.FRIENDS, authId);
    const success = await this.cache.del(key);
    if (success) {
      logger.debug(`🗑️ Invalidated friends list: ${authId}`);
    }
    return success;
  }

  async batchInvalidateFriendsList(authIds: string[]): Promise<boolean> {
    const keys = authIds.map(authId => 
      RedisConfig.buildKey(RedisConfig.PREFIXES.FRIENDS, authId)
    );
    
    const success = await this.cache.batchDel(keys);
    if (success) {
      logger.debug(`🗑️ Batch invalidated ${authIds.length} friends lists`);
    }
    return success;
  }

  async cacheOnlineFriendsCount(authId: string, count: number): Promise<boolean> {
    const key = RedisConfig.buildKey('online_friends_count', authId);
    const success = await this.cache.set(key, count, 30); // 30 seconds TTL
    
    if (success) {
      logger.debug(`👥 Cached online friends count for ${authId}: ${count}`);
    }
    return success;
  }

  async getCachedOnlineFriendsCount(authId: string): Promise<number | null> {
    const key = RedisConfig.buildKey('online_friends_count', authId);
    const cached = await this.cache.get<number>(key);
    
    if (cached !== null) {
      logger.debug(`👥 Online friends count cache hit: ${authId} (${cached})`);
      return cached;
    }
    
    return null;
  }

  async cacheMutualFriends(user1AuthId: string, user2AuthId: string, mutualFriends: FriendData[]): Promise<boolean> {
    const key = RedisConfig.buildKey('mutual_friends', user1AuthId, user2AuthId);
    const cacheData = {
      mutual_friends: mutualFriends,
      cached_at: Date.now(),
      count: mutualFriends.length
    };
    
    const success = await this.cache.set(key, cacheData, RedisConfig.TTL.FRIENDS);
    if (success) {
      logger.debug(`👥 Cached ${mutualFriends.length} mutual friends between ${user1AuthId} and ${user2AuthId}`);
    }
    return success;
  }

  async getCachedMutualFriends(user1AuthId: string, user2AuthId: string): Promise<FriendData[] | null> {
    const key = RedisConfig.buildKey('mutual_friends', user1AuthId, user2AuthId);
    const cached = await this.cache.get<{ mutual_friends: FriendData[] }>(key);
    
    if (cached) {
      logger.debug(`👥 Mutual friends cache hit: ${user1AuthId} and ${user2AuthId}`);
      return cached.mutual_friends;
    }
    
    return null;
  }

  async cacheFriendshipStatus(user1AuthId: string, user2AuthId: string, status: string): Promise<boolean> {
    const key = RedisConfig.buildKey('friendship_status', user1AuthId, user2AuthId);
    const success = await this.cache.set(key, status, RedisConfig.TTL.FRIENDS);
    
    if (success) {
      logger.debug(`👥 Cached friendship status between ${user1AuthId} and ${user2AuthId}: ${status}`);
    }
    return success;
  }

  async getCachedFriendshipStatus(user1AuthId: string, user2AuthId: string): Promise<string | null> {
    const key = RedisConfig.buildKey('friendship_status', user1AuthId, user2AuthId);
    const cached = await this.cache.get<string>(key);
    
    if (cached) {
      logger.debug(`👥 Friendship status cache hit: ${user1AuthId} and ${user2AuthId}`);
      return cached;
    }
    
    return null;
  }

  async getFriendsCacheStats(): Promise<{
    totalCachedUsers: number;
    averageFriendsPerUser: number;
    cacheHitRate: number;
  }> {
    // Note: In a real implementation, you'd need to track these metrics separately
    // as Redis doesn't provide this information directly
    return {
      totalCachedUsers: 0,
      averageFriendsPerUser: 0,
      cacheHitRate: 0.85 // Placeholder value
    };
  }

  async refreshFriendsListTTL(authId: string): Promise<boolean> {
    const key = RedisConfig.buildKey(RedisConfig.PREFIXES.FRIENDS, authId);
    const success = await this.cache.expire(key, RedisConfig.TTL.FRIENDS);
    
    if (success) {
      logger.debug(`🔄 Refreshed TTL for friends list: ${authId}`);
    }
    return success;
  }

  async batchCacheFriendsLists(friendsData: Array<{ authId: string; friends: FriendData[] }>): Promise<boolean> {
    const operations = friendsData.map(({ authId, friends }) => {
      const key = RedisConfig.buildKey(RedisConfig.PREFIXES.FRIENDS, authId);
      const cacheData: CachedFriendsList = {
        friends,
        cached_at: Date.now(),
        count: friends.length
      };
      return { key, value: cacheData, ttl: RedisConfig.TTL.FRIENDS };
    });

    const success = await this.cache.batchSet(operations);
    if (success) {
      logger.debug(`👥 Batch cached ${friendsData.length} friends lists`);
    }
    return success;
  }

  async batchGetFriendsLists(authIds: string[]): Promise<Map<string, FriendData[]>> {
    const keys = authIds.map(authId => 
      RedisConfig.buildKey(RedisConfig.PREFIXES.FRIENDS, authId)
    );
    
    const cached = await this.cache.batchGet<CachedFriendsList>(keys);
    const result = new Map<string, FriendData[]>();
    
    cached.forEach((item, index) => {
      if (item) {
        result.set(authIds[index], item.friends);
        logger.debug(`👥 Batch friends cache hit: ${authIds[index]}`);
      }
    });
    
    return result;
  }
}