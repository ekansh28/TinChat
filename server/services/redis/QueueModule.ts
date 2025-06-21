// server/services/redis/QueueModule.ts
import Redis from 'ioredis';
import { RedisConfig } from './RedisConfig';
import { User } from '../../types/User';
import { logger } from '../../utils/logger';

interface QueuedUser extends User {
  queuedAt: number;
}

export class QueueModule {
  constructor(private redis: Redis) {}

  async addToQueue(chatType: 'text' | 'video', user: User): Promise<boolean> {
    try {
      const key = RedisConfig.buildKey(RedisConfig.PREFIXES.QUEUE, chatType);
      const queuedUser: QueuedUser = {
        ...user,
        queuedAt: Date.now()
      };
      
      await this.redis.rpush(key, JSON.stringify(queuedUser));
      await this.redis.expire(key, RedisConfig.TTL.QUEUE);
      
      logger.debug(`⏳ Added ${user.id} to ${chatType} queue`);
      return true;
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
        const user = JSON.parse(userData) as QueuedUser;
        const { queuedAt, ...cleanUser } = user;
        logger.debug(`⏳ Popped ${user.id} from ${chatType} queue`);
        return cleanUser;
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
      
      for (const item of queueItems) {
        const user = JSON.parse(item) as QueuedUser;
        if (user.id === userId) {
          await this.redis.lrem(key, 1, item);
          logger.debug(`🗑️ Removed ${userId} from ${chatType} queue`);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      logger.error(`❌ Failed to remove ${userId} from ${chatType} queue:`, error);
      return false;
    }
  }

  async removeFromAllQueues(userId: string): Promise<boolean> {
    const results = await Promise.all([
      this.removeFromQueue('text', userId),
      this.removeFromQueue('video', userId)
    ]);
    
    return results.some(success => success);
  }

  async getAllFromQueue(chatType: 'text' | 'video'): Promise<User[]> {
    try {
      const key = RedisConfig.buildKey(RedisConfig.PREFIXES.QUEUE, chatType);
      const items = await this.redis.lrange(key, 0, -1);
      
      return items.map(item => {
        try {
          const queuedUser = JSON.parse(item) as QueuedUser;
          const { queuedAt, ...user } = queuedUser;
          return user;
        } catch {
          return null;
        }
      }).filter((user): user is User => user !== null);
    } catch (error) {
      logger.error(`❌ Failed to get all users from ${chatType} queue:`, error);
      return [];
    }
  }

  async peekAtQueue(chatType: 'text' | 'video', index: number = 0): Promise<User | null> {
    try {
      const key = RedisConfig.buildKey(RedisConfig.PREFIXES.QUEUE, chatType);
      const userData = await this.redis.lindex(key, index);
      
      if (userData) {
        const queuedUser = JSON.parse(userData) as QueuedUser;
        const { queuedAt, ...user } = queuedUser;
        return user;
      }
      
      return null;
    } catch (error) {
      logger.debug(`❌ Failed to peek at queue position ${index}:`, error);
      return null;
    }
  }

  async getQueueStats(): Promise<{
    text: number;
    video: number;
    total: number;
    oldestWaitTimes: { text: number; video: number };
  }> {
    try {
      const [textLength, videoLength] = await Promise.all([
        this.getQueueLength('text'),
        this.getQueueLength('video')
      ]);

      // Get oldest wait times
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
        }
      };
    } catch (error) {
      logger.error('❌ Failed to get queue stats:', error);
      return {
        text: 0,
        video: 0,
        total: 0,
        oldestWaitTimes: { text: 0, video: 0 }
      };
    }
  }

  async clearAllQueues(): Promise<{ cleared: number }> {
    try {
      const [textLength, videoLength] = await Promise.all([
        this.getQueueLength('text'),
        this.getQueueLength('video')
      ]);

      const total = textLength + videoLength;

      await Promise.all([
        this.redis.del(RedisConfig.buildKey(RedisConfig.PREFIXES.QUEUE, 'text')),
        this.redis.del(RedisConfig.buildKey(RedisConfig.PREFIXES.QUEUE, 'video'))
      ]);

      logger.warn(`🧹 Cleared all queues: ${total} users removed`);
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

        for (const item of queueItems) {
          try {
            const user = JSON.parse(item) as QueuedUser;
            if (user.queuedAt < cutoffTime) {
              await this.redis.lrem(key, 1, item);
              totalCleaned++;
              logger.debug(`🧹 Cleaned stale queue entry: ${user.id}`);
            }
          } catch (parseError) {
            // Remove invalid entries
            await this.redis.lrem(key, 1, item);
            totalCleaned++;
            logger.warn(`🧹 Removed invalid queue entry`);
          }
        }
      }

      if (totalCleaned > 0) {
        logger.info(`🧹 Cleaned ${totalCleaned} stale queue entries`);
      }

      return totalCleaned;
    } catch (error) {
      logger.error('❌ Failed to cleanup stale queue entries:', error);
      return 0;
    }
  }
}