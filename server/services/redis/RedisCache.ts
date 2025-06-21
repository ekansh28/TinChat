// server/services/redis/RedisCache.ts
import Redis from 'ioredis';
import { logger } from '../../utils/logger';

export class RedisCache {
  constructor(private redis: Redis) {}

  async set(key: string, value: any, ttl: number): Promise<boolean> {
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      await this.redis.setex(key, ttl, serialized);
      logger.debug(`📋 Cached: ${key} (TTL: ${ttl}s)`);
      return true;
    } catch (error) {
      logger.error(`❌ Cache set failed for ${key}:`, error);
      return false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      if (!cached) return null;
      
      try {
        return JSON.parse(cached);
      } catch {
        // Return as string if JSON parse fails
        return cached as unknown as T;
      }
    } catch (error) {
      logger.error(`❌ Cache get failed for ${key}:`, error);
      return null;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await this.redis.del(key);
      logger.debug(`🗑️ Deleted cache: ${key}`);
      return true;
    } catch (error) {
      logger.error(`❌ Cache delete failed for ${key}:`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      return false;
    }
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      await this.redis.expire(key, ttl);
      return true;
    } catch (error) {
      logger.error(`❌ Cache expire failed for ${key}:`, error);
      return false;
    }
  }

  async increment(key: string, ttl?: number): Promise<number> {
    try {
      const result = await this.redis.incr(key);
      if (ttl && result === 1) {
        await this.redis.expire(key, ttl);
      }
      return result;
    } catch (error) {
      logger.error(`❌ Cache increment failed for ${key}:`, error);
      return 0;
    }
  }

  async batchGet<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const results = await this.redis.mget(...keys);
      return results.map(result => {
        if (!result) return null;
        try {
          return JSON.parse(result);
        } catch {
          return result as unknown as T;
        }
      });
    } catch (error) {
      logger.error('❌ Batch get failed:', error);
      return keys.map(() => null);
    }
  }

  async batchSet(operations: Array<{ key: string; value: any; ttl: number }>): Promise<boolean> {
    try {
      const pipeline = this.redis.pipeline();
      
      operations.forEach(({ key, value, ttl }) => {
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);
        pipeline.setex(key, ttl, serialized);
      });
      
      await pipeline.exec();
      logger.debug(`📦 Batch cached ${operations.length} items`);
      return true;
    } catch (error) {
      logger.error('❌ Batch set failed:', error);
      return false;
    }
  }

  async batchDel(keys: string[]): Promise<boolean> {
    try {
      if (keys.length === 0) return true;
      await this.redis.del(...keys);
      logger.debug(`🗑️ Batch deleted ${keys.length} keys`);
      return true;
    } catch (error) {
      logger.error('❌ Batch delete failed:', error);
      return false;
    }
  }

  async cleanupExpired(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) return 0;
      
      const expiredKeys: string[] = [];
      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl === -2) { // Key expired
          expiredKeys.push(key);
        }
      }
      
      if (expiredKeys.length > 0) {
        await this.redis.del(...expiredKeys);
        logger.debug(`🧹 Cleaned ${expiredKeys.length} expired keys`);
      }
      
      return expiredKeys.length;
    } catch (error) {
      logger.error(`❌ Cleanup failed for pattern ${pattern}:`, error);
      return 0;
    }
  }
}