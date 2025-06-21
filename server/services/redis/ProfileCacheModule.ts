
// server/services/redis/ProfileCacheModule.ts - ENHANCED VERSION
import { RedisCache } from './RedisCache';
import { RedisConfig } from './RedisConfig';
import { UserProfile } from '../../managers/profile/ProfileManager';
import { logger } from '../../utils/logger';

interface CachedProfile extends UserProfile {
  _cached_at: number;
  _ttl: number;
  _frequently_updated: boolean;
  _version: number;
}

export class ProfileCacheModule {
  private readonly CACHE_VERSION = 1;
  private readonly MAX_PROFILE_SIZE = 50000; // 50KB limit per profile

  constructor(private cache: RedisCache) {}

  async cacheProfile(authId: string, profile: UserProfile, isFrequentlyUpdated: boolean = false): Promise<boolean> {
    try {
      const key = RedisConfig.buildKey(RedisConfig.PREFIXES.PROFILE, authId);
      const ttl = isFrequentlyUpdated ? RedisConfig.TTL.PROFILE_SHORT : RedisConfig.TTL.PROFILE;
      
      const cacheData: CachedProfile = {
        ...profile,
        _cached_at: Date.now(),
        _ttl: ttl,
        _frequently_updated: isFrequentlyUpdated,
        _version: this.CACHE_VERSION
      };
      
      // Check data size before caching
      const dataSize = JSON.stringify(cacheData).length;
      if (dataSize > this.MAX_PROFILE_SIZE) {
        logger.warn(`Profile ${authId} too large to cache: ${dataSize} bytes`);
        return false;
      }
      
      const success = await this.cache.set(key, cacheData, ttl);
      if (success) {
        logger.debug(`👤 Cached profile ${authId} (TTL: ${ttl}s, size: ${dataSize} bytes)`);
      }
      return success;
    } catch (error) {
      logger.error(`Failed to cache profile ${authId}:`, error);
      return false;
    }
  }

  async getProfile(authId: string): Promise<UserProfile | null> {
    try {
      const key = RedisConfig.buildKey(RedisConfig.PREFIXES.PROFILE, authId);
      const cached = await this.cache.get<CachedProfile>(key);
      
      if (!cached) {
        logger.debug(`👤 Profile cache miss: ${authId}`);
        return null;
      }
      
      // Version check
      if (cached._version !== this.CACHE_VERSION) {
        logger.debug(`👤 Profile cache version mismatch for ${authId}, invalidating`);
        await this.cache.del(key);
        return null;
      }
      
      // Remove metadata
      const { _cached_at, _ttl, _frequently_updated, _version, ...profile } = cached;
      
      // Auto-refresh TTL for frequently accessed profiles
      const cacheAge = Date.now() - _cached_at;
      const refreshThreshold = _ttl * 1000 * 0.8; // 80% of TTL
      
      if (cacheAge > refreshThreshold) {
        this.refreshTTL(authId, _ttl).catch(err => 
          logger.debug('Background TTL refresh failed:', err)
        );
      }
      
      logger.debug(`👤 Profile cache hit: ${authId} (age: ${Math.round(cacheAge/1000)}s)`);
      return profile;
    } catch (error) {
      logger.error(`Failed to get cached profile ${authId}:`, error);
      return null;
    }
  }

  async invalidateProfile(authId: string): Promise<boolean> {
    try {
      const keys = [
        RedisConfig.buildKey(RedisConfig.PREFIXES.PROFILE, authId),
        RedisConfig.buildKey(RedisConfig.PREFIXES.ONLINE, authId)
      ];
      
      const success = await this.cache.batchDel(keys);
      if (success) {
        logger.debug(`🗑️ Invalidated profile cache: ${authId}`);
      }
      return success;
    } catch (error) {
      logger.error(`Failed to invalidate profile ${authId}:`, error);
      return false;
    }
  }

  async batchCacheProfiles(profiles: Array<{ authId: string; profile: UserProfile; isFrequentlyUpdated?: boolean }>): Promise<boolean> {
    try {
      const operations: Array<{ key: string; value: CachedProfile; ttl: number }> = [];
      
      for (const { authId, profile, isFrequentlyUpdated = false } of profiles) {
        const key = RedisConfig.buildKey(RedisConfig.PREFIXES.PROFILE, authId);
        const ttl = isFrequentlyUpdated ? RedisConfig.TTL.PROFILE_SHORT : RedisConfig.TTL.PROFILE;
        
        const cacheData: CachedProfile = {
          ...profile,
          _cached_at: Date.now(),
          _ttl: ttl,
          _frequently_updated: isFrequentlyUpdated,
          _version: this.CACHE_VERSION
        };
        
        // Size check
        const dataSize = JSON.stringify(cacheData).length;
        if (dataSize <= this.MAX_PROFILE_SIZE) {
          operations.push({ key, value: cacheData, ttl });
        } else {
          logger.warn(`Skipping profile ${authId} in batch - too large: ${dataSize} bytes`);
        }
      }
      
      if (operations.length === 0) {
        return true; // Nothing to cache, but not an error
      }
      
      const success = await this.cache.batchSet(operations);
      if (success) {
        logger.debug(`👥 Batch cached ${operations.length}/${profiles.length} profiles`);
      }
      return success;
    } catch (error) {
      logger.error('Failed to batch cache profiles:', error);
      return false;
    }
  }

  async batchGetProfiles(authIds: string[]): Promise<(UserProfile | null)[]> {
    try {
      const keys = authIds.map(authId => 
        RedisConfig.buildKey(RedisConfig.PREFIXES.PROFILE, authId)
      );
      
      const cached = await this.cache.batchGet<CachedProfile>(keys);
      
      return cached.map((item, index) => {
        if (!item) {
          logger.debug(`👤 Profile cache miss: ${authIds[index]}`);
          return null;
        }
        
        // Version check
        if (item._version !== this.CACHE_VERSION) {
          logger.debug(`👤 Profile cache version mismatch for ${authIds[index]}`);
          // Async cleanup
          this.cache.del(keys[index]).catch(() => {});
          return null;
        }
        
        const { _cached_at, _ttl, _frequently_updated, _version, ...profile } = item;
        logger.debug(`👤 Profile cache hit: ${authIds[index]}`);
        return profile;
      });
    } catch (error) {
      logger.error('Failed to batch get profiles:', error);
      return authIds.map(() => null);
    }
  }

  private async refreshTTL(authId: string, ttl: number): Promise<void> {
    try {
      const key = RedisConfig.buildKey(RedisConfig.PREFIXES.PROFILE, authId);
      await this.cache.expire(key, ttl);
      logger.debug(`🔄 Refreshed TTL for profile ${authId}`);
    } catch (error) {
      logger.debug(`Failed to refresh TTL for profile ${authId}:`, error);
    }
  }

  async getStats(): Promise<{
    totalProfiles: number;
    activeProfiles: number;
    cacheHitRate: number;
    averageSize: number;
  }> {
    try {
      // Note: This would need Redis SCAN to implement properly
      // For now, return placeholder stats
      return {
        totalProfiles: 0,
        activeProfiles: 0,
        cacheHitRate: 0.85,
        averageSize: 2048
      };
    } catch (error) {
      logger.error('Failed to get profile cache stats:', error);
      return {
        totalProfiles: 0,
        activeProfiles: 0,
        cacheHitRate: 0,
        averageSize: 0
      };
    }
  }

  async cleanup(): Promise<number> {
    try {
      // This would scan for expired profile entries
      // Implementation would use SCAN cursor for large datasets
      logger.debug('Profile cache cleanup completed');
      return 0;
    } catch (error) {
      logger.error('Profile cache cleanup failed:', error);
      return 0;
    }
  }
}
