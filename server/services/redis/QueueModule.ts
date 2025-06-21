
// server/services/redis/QueueModule.ts - ENHANCED WITH BETTER ERROR HANDLING
import Redis from 'ioredis';
import { RedisConfig } from './RedisConfig';
import { User } from '../../types/User';
import { logger } from '../../utils/logger';

interface QueuedUser extends User {
  queuedAt: number;
  version: number; // For conflict resolution
}

export class QueueModule {
  private redis: Redis;
  private readonly QUEUE_VERSION = 1;
  private readonly MAX_QUEUE_SIZE = 1000;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async addToQueue(chatType: 'text' | 'video', user: User): Promise<boolean> {
    try {
      const key = RedisConfig.buildKey(RedisConfig.PREFIXES.QUEUE, chatType);
      
      // Check queue size first to prevent overflow
      const currentSize = await this.redis.llen(key);
      if (currentSize >= this.MAX_QUEUE_SIZE) {
        logger.warn(`❌ Queue ${chatType} is full (${currentSize}/${this.MAX_QUEUE_SIZE})`);
        return false;
      }
      
      // Remove user from queue first (deduplication)
      await this.removeFromQueue(chatType, user.id);
      
      const queuedUser: QueuedUser = {
        ...user,
        queuedAt: Date.now(),
        version: this.QUEUE_VERSION
      };
      
      // Use atomic operation to add user and set expiration
      const pipeline = this.redis.pipeline();
      pipeline.rpush(key, JSON.stringify(queuedUser));
      pipeline.expire(key, RedisConfig.TTL.QUEUE);
      
      const results = await pipeline.exec();
      const success = results?.every(([err]) => !err);
      
      if (success) {
        logger.debug(`⏳ Added ${user.id} to ${chatType} queue (size: ${currentSize + 1})`);
        return true;
      } else {
        logger.error(`❌ Failed to add ${user.id} to ${chatType} queue:`, results);
        return false;
      }
    } catch (error) {
      logger.error(`❌ Failed to add ${user.id} to ${chatType} queue:`, error);
      return false;
    }
  }

  async popFromQueue(chatType: 'text' | 'video'): Promise<User | null> {
    try {
      const key = RedisConfig.buildKey(RedisConfig.PREFIXES.QUEUE, chatType);
      const userData = await this.redis.lpop(key);
      
      if (userData) {
        try {
          const user = JSON.parse(userData) as QueuedUser;
          const { queuedAt, version, ...cleanUser } = user;
          
          // Validate queue entry version
          if (version !== this.QUEUE_VERSION) {
            logger.warn(`⚠️ Queue entry version mismatch for ${user.id}, discarding`);
            return this.popFromQueue(chatType); // Try next entry
          }
          
          // Check if entry is not too old
          const age = Date.now() - queuedAt;
          if (age > 15 * 60 * 1000) { // 15 minutes
            logger.warn(`⚠️ Queue entry too old for ${user.id} (${age}ms), discarding`);
            return this.popFromQueue(chatType); // Try next entry
          }
          
          logger.debug(`⏳ Popped ${user.id} from ${chatType} queue (waited: ${age}ms)`);
          return cleanUser;
        } catch (parseError) {
          logger.error(`❌ Failed to parse queue entry:`, parseError);
          return this.popFromQueue(chatType); // Try next entry
        }
      }
      
      return null;
    } catch (error) {
      logger.error(`❌ Failed to pop from ${chatType} queue:`, error);
      return null;
    }
  }

  async getQueueLength(chatType: 'text' | 'video'): Promise<number> {
    try {
      const key = RedisConfig.buildKey(RedisConfig.PREFIXES.QUEUE, chatType);
      return await this.redis.llen(key);
    } catch (error) {
      logger.error(`❌ Failed to get ${chatType} queue length:`, error);
      return 0;
    }
  }

  async removeFromQueue(chatType: 'text' | 'video', userId: string): Promise<boolean> {
    try {
      const key = RedisConfig.buildKey(RedisConfig.PREFIXES.QUEUE, chatType);
      const queueItems = await this.redis.lrange(key, 0, -1);
      
      let removedCount = 0;
      
      for (const item of queueItems) {
        try {
          const user = JSON.parse(item) as QueuedUser;
          if (user.id === userId) {
            await this.redis.lrem(key, 1, item);
            removedCount++;
          }
        } catch (parseError) {
          // Remove invalid entries
          await this.redis.lrem(key, 1, item);
          logger.warn(`🧹 Removed invalid queue entry from ${chatType}`);
        }
      }
      
      if (removedCount > 0) {
        logger.debug(`🗑️ Removed ${removedCount} instances of ${userId} from ${chatType} queue`);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error(`❌ Failed to remove ${userId} from ${chatType} queue:`, error);
      return false;
    }
  }

  async removeFromAllQueues(userId: string): Promise<boolean> {
    try {
      const results = await Promise.allSettled([
        this.removeFromQueue('text', userId),
        this.removeFromQueue('video', userId)
      ]);
      
      return results.some(result => 
        result.status === 'fulfilled' && result.value === true
      );
    } catch (error) {
      logger.error(`❌ Failed to remove ${userId} from all queues:`, error);
      return false;
    }
  }

  async getAllFromQueue(chatType: 'text' | 'video'): Promise<User[]> {
    try {
      const key = RedisConfig.buildKey(RedisConfig.PREFIXES.QUEUE, chatType);
      const items = await this.redis.lrange(key, 0, -1);
      
      const validUsers: User[] = [];
      const invalidItems: string[] = [];
      
      for (const item of items) {
        try {
          const queuedUser = JSON.parse(item) as QueuedUser;
          const { queuedAt, version, ...user } = queuedUser;
          
          // Validate version and age
          if (version === this.QUEUE_VERSION) {
            const age = Date.now() - queuedAt;
            if (age <= 15 * 60 * 1000) { // 15 minutes
              validUsers.push(user);
            } else {
              invalidItems.push(item);
            }
          } else {
            invalidItems.push(item);
          }
        } catch (parseError) {
          invalidItems.push(item);
        }
      }
      
      // Clean up invalid items in background
      if (invalidItems.length > 0) {
        this.cleanupInvalidItems(key, invalidItems).catch(err =>
          logger.debug(`Background cleanup failed for ${chatType}:`, err)
        );
      }
      
      return validUsers;
    } catch (error) {
      logger.error(`❌ Failed to get all users from ${chatType} queue:`, error);
      return [];
    }
  }

  private async cleanupInvalidItems(key: string, invalidItems: string[]): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();
      
      for (const item of invalidItems) {
        pipeline.lrem(key, 1, item);
      }
      
      await pipeline.exec();
      logger.debug(`🧹 Cleaned ${invalidItems.length} invalid items from queue`);
    } catch (error) {
      logger.error('Failed to cleanup invalid queue items:', error);
    }
  }

  async peekAtQueue(chatType: 'text' | 'video', index: number = 0): Promise<User | null> {
    try {
      const key = RedisConfig.buildKey(RedisConfig.PREFIXES.QUEUE, chatType);
      const userData = await this.redis.lindex(key, index);
      
      if (userData) {
        try {
          const queuedUser = JSON.parse(userData) as QueuedUser;
          const { queuedAt, version, ...user } = queuedUser;
          
          // Validate entry
          if (version === this.QUEUE_VERSION) {
            const age = Date.now() - queuedAt;
            if (age <= 15 * 60 * 1000) {
              return user;
            }
          }
        } catch (parseError) {
          logger.warn(`Invalid queue entry at index ${index}:`, parseError);
        }
      }
      
      return null;
    } catch (error) {
      logger.error(`❌ Failed to peek at queue position ${index}:`, error);
      return null;
    }
  }

  async getQueueStats(): Promise<{
    text: number;
    video: number;
    total: number;
    oldestWaitTimes: { text: number; video: number };
    health: { text: boolean; video: boolean };
  }> {
    try {
      const [textLength, videoLength] = await Promise.all([
        this.getQueueLength('text'),
        this.getQueueLength('video')
      ]);

      // Get oldest wait times and health status
      const [oldestText, oldestVideo] = await Promise.all([
        this.peekAtQueue('text', 0),
        this.peekAtQueue('video', 0)
      ]);

      const now = Date.now();
      const textWait = oldestText?.connectionStartTime ? now - oldestText.connectionStartTime : 0;
      const videoWait = oldestVideo?.connectionStartTime ? now - oldestVideo.connectionStartTime : 0;

      return {
        text: textLength,
        video: videoLength,
        total: textLength + videoLength,
        oldestWaitTimes: {
          text: Math.round(textWait / 1000),
          video: Math.round(videoWait / 1000)
        },
        health: {
          text: textLength < this.MAX_QUEUE_SIZE * 0.8,
          video: videoLength < this.MAX_QUEUE_SIZE * 0.8
        }
      };
    } catch (error) {
      logger.error('❌ Failed to get queue stats:', error);
      return {
        text: 0,
        video: 0,
        total: 0,
        oldestWaitTimes: { text: 0, video: 0 },
        health: { text: false, video: false }
      };
    }
  }

  async clearAllQueues(): Promise<{ cleared: number }> {
    try {
      const [textLength, videoLength] = await Promise.allSettled([
        this.getQueueLength('text'),
        this.getQueueLength('video')
      ]);

      const textCount = textLength.status === 'fulfilled' ? textLength.value : 0;
      const videoCount = videoLength.status === 'fulfilled' ? videoLength.value : 0;
      const total = textCount + videoCount;

      if (total > 0) {
        await Promise.allSettled([
          this.redis.del(RedisConfig.buildKey(RedisConfig.PREFIXES.QUEUE, 'text')),
          this.redis.del(RedisConfig.buildKey(RedisConfig.PREFIXES.QUEUE, 'video'))
        ]);

        logger.warn(`🧹 Cleared all queues: ${total} users removed`);
      }
      
      return { cleared: total };
    } catch (error) {
      logger.error('❌ Failed to clear queues:', error);
      return { cleared: 0 };
    }
  }

  async cleanupStaleEntries(maxAge: number = 15 * 60 * 1000): Promise<number> {
    try {
      const cutoffTime = Date.now() - maxAge;
      let totalCleaned = 0;

      for (const chatType of ['text', 'video'] as const) {
        const key = RedisConfig.buildKey(RedisConfig.PREFIXES.QUEUE, chatType);
        const queueItems = await this.redis.lrange(key, 0, -1);
        const itemsToRemove: string[] = [];

        for (const item of queueItems) {
          try {
            const user = JSON.parse(item) as QueuedUser;
            
            // Check if entry is stale or has wrong version
            if (user.queuedAt < cutoffTime || user.version !== this.QUEUE_VERSION) {
              itemsToRemove.push(item);
            }
          } catch (parseError) {
            // Remove invalid entries
            itemsToRemove.push(item);
          }
        }

        // Remove stale items in batch
        if (itemsToRemove.length > 0) {
          const pipeline = this.redis.pipeline();
          
          for (const item of itemsToRemove) {
            pipeline.lrem(key, 1, item);
          }
          
          await pipeline.exec();
          totalCleaned += itemsToRemove.length;
          
          logger.debug(`🧹 Cleaned ${itemsToRemove.length} stale entries from ${chatType} queue`);
        }
      }

      if (totalCleaned > 0) {
        logger.info(`🧹 Cleaned ${totalCleaned} total stale queue entries`);
      }

      return totalCleaned;
    } catch (error) {
      logger.error('❌ Failed to cleanup stale queue entries:', error);
      return 0;
    }
  }

  async getQueueHealth(): Promise<{
    healthy: boolean;
    issues: string[];
    stats: any;
  }> {
    const issues: string[] = [];
    
    try {
      const stats = await this.getQueueStats();
      
      // Check for overloaded queues
      if (stats.text > this.MAX_QUEUE_SIZE * 0.8) {
        issues.push(`Text queue near capacity: ${stats.text}/${this.MAX_QUEUE_SIZE}`);
      }
      
      if (stats.video > this.MAX_QUEUE_SIZE * 0.8) {
        issues.push(`Video queue near capacity: ${stats.video}/${this.MAX_QUEUE_SIZE}`);
      }
      
      // Check for users waiting too long
      if (stats.oldestWaitTimes.text > 300) { // 5 minutes
        issues.push(`Users waiting too long in text queue: ${stats.oldestWaitTimes.text}s`);
      }
      
      if (stats.oldestWaitTimes.video > 300) {
        issues.push(`Users waiting too long in video queue: ${stats.oldestWaitTimes.video}s`);
      }
      
      return {
        healthy: issues.length === 0,
        issues,
        stats
      };
    } catch (error) {
      return {
        healthy: false,
        issues: [`Queue health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        stats: null
      };
    }
  }
}

