// server/services/redis/ProfileCacheModule.ts
import { RedisCache } from './RedisCache';
import { RedisConfig } from './RedisConfig';
import { UserProfile } from '../../managers/profile/ProfileManager';
import { logger } from '../../utils/logger';

interface CachedProfile extends UserProfile {
  _cached_at: number;
  _ttl: number;
  _frequently_updated: boolean;
}

export class ProfileCacheModule {
  constructor(private cache: RedisCache) {}

  async cacheProfile(authId: string, profile: UserProfile, isFrequentlyUpdated: boolean = false): Promise<boolean> {
    const key = RedisConfig.buildKey(RedisConfig.PREFIXES.PROFILE, authId);
    const ttl = isFrequentlyUpdated ? RedisConfig.TTL.PROFILE_SHORT : RedisConfig.TTL.PROFILE;
    
    const cacheData: CachedProfile = {
      ...profile,
      _cached_at: Date.now(),
      _ttl: ttl,
      _frequently_updated: isFrequentlyUpdated
    };
    
    const success = await this.cache.set(key, cacheData, ttl);
    if (success) {
      logger.debug(`👤 Cached profile ${authId} (TTL: ${ttl}s)`);
    }
    return success;
  }

  async getProfile(authId: string): Promise<UserProfile | null> {
    const key = RedisConfig.buildKey(RedisConfig.PREFIXES.PROFILE, authId);
    const cached = await this.cache.get<CachedProfile>(key);
    
    if (!cached) {
      logger.debug(`👤 Profile cache miss: ${authId}`);
      return null;
    }
    
    // Remove metadata
    const { _cached_at, _ttl, _frequently_updated, ...profile } = cached;
    
    // Auto-refresh TTL for frequently accessed profiles
    const cacheAge = Date.now() - _cached_at;
    if (cacheAge > (_ttl * 1000 * 0.8)) { // Refresh at 80% of TTL
      this.refreshTTL(authId, _ttl).catch(err => 
        logger.debug('Background TTL refresh failed:', err)
      );
    }
    
    logger.debug(`👤 Profile cache hit: ${authId}`);
    return profile;
  }

  async invalidateProfile(authId: string): Promise<boolean> {
    const keys = [
      RedisConfig.buildKey(RedisConfig.PREFIXES.PROFILE, authId),
      RedisConfig.buildKey(RedisConfig.PREFIXES.ONLINE, authId)
    ];
    
    const success = await this.cache.batchDel(keys);
    if (success) {
      logger.debug(`🗑️ Invalidated profile cache: ${authId}`);
    }
    return success;
  }

  async batchCacheProfiles(profiles: Array<{ authId: string; profile: UserProfile; isFrequentlyUpdated?: boolean }>): Promise<boolean> {
    const operations = profiles.map(({ authId, profile, isFrequentlyUpdated = false }) => {
      const key = RedisConfig.buildKey(RedisConfig.PREFIXES.PROFILE, authId);
      const ttl = isFrequentlyUpdated ? RedisConfig.TTL.PROFILE_SHORT : RedisConfig.TTL.PROFILE;
      
      const cacheData: CachedProfile = {
        ...profile,
        _cached_at: Date.now(),
        _ttl: ttl,
        _frequently_updated: isFrequentlyUpdated
      };
      
      return { key, value: cacheData, ttl };
    });
    
    const success = await this.cache.batchSet(operations);
    if (success) {
      logger.debug(`👥 Batch cached ${profiles.length} profiles`);
    }
    return success;
  }

  async batchGetProfiles(authIds: string[]): Promise<(UserProfile | null)[]> {
    const keys = authIds.map(authId => 
      RedisConfig.buildKey(RedisConfig.PREFIXES.PROFILE, authId)
    );
    
    const cached = await this.cache.batchGet<CachedProfile>(keys);
    
    return cached.map((item, index) => {
      if (!item) {
        logger.debug(`👤 Profile cache miss: ${authIds[index]}`);
        return null;
      }
      
      const { _cached_at, _ttl, _frequently_updated, ...profile } = item;
      logger.debug(`👤 Profile cache hit: ${authIds[index]}`);
      return profile;
    });
  }

  private async refreshTTL(authId: string, ttl: number): Promise<void> {
    const key = RedisConfig.buildKey(RedisConfig.PREFIXES.PROFILE, authId);
    await this.cache.expire(key, ttl);
    logger.debug(`🔄 Refreshed TTL for profile ${authId}`);
  }

  async getStats(): Promise<{
    totalProfiles: number;
    activeProfiles: number;
    cacheHitRate: number;
  }> {
    // This would require tracking hit/miss ratios in a real implementation
    return {
      totalProfiles: 0, // Would need to implement counting
      activeProfiles: 0,
      cacheHitRate: 0.85 // Placeholder
    };
  }
}