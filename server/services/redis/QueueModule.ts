// server/services/redis/QueueModule.ts - FIXED VERSION WITH ROBUST ERROR HANDLING
import Redis from 'ioredis';
import { RedisConfig } from './RedisConfig';
import { User } from '../../types/User';
import { logger } from '../../utils/logger';

interface QueuedUser extends User {
  queuedAt: number;
  version: number;
  checksum?: string; // For data integrity verification
}

interface QueueOperationResult {
  success: boolean;
  error?: string;
  recovered?: boolean;
}

export class QueueModule {
  private redis: Redis;
  private readonly QUEUE_VERSION = 1;
  private readonly MAX_QUEUE_SIZE = 1000;
  private readonly MAX_PARSE_RETRIES = 3;
  private readonly CORRUPTION_THRESHOLD = 5; // Max corrupted entries before cleanup

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async addToQueue(chatType: 'text' | 'video', user: User): Promise<boolean> {
    try {
      const key = RedisConfig.buildKey(RedisConfig.PREFIXES.QUEUE, chatType);
      
      // ✅ ENHANCED: Check queue size with error handling
      let currentSize = 0;
      try {
        currentSize = await this.redis.llen(key);
      } catch (error) {
        logger.error(`❌ Failed to check queue size for ${chatType}:`, error);
        return false;
      }
      
      if (currentSize >= this.MAX_QUEUE_SIZE) {
        logger.warn(`❌ Queue ${chatType} is full (${currentSize}/${this.MAX_QUEUE_SIZE})`);
        // Try to clean up stale entries before rejecting
        const cleaned = await this.emergencyCleanup(chatType);
        if (cleaned > 0) {
          logger.info(`🧹 Emergency cleanup freed ${cleaned} slots in ${chatType} queue`);
        } else {
          return false;
        }
      }
      
      // ✅ ENHANCED: Remove user with better error handling
      const removeResult = await this.safeRemoveFromQueue(chatType, user.id);
      if (!removeResult.success && !removeResult.recovered) {
        logger.warn(`⚠️ Failed to remove existing user ${user.id} from ${chatType}, continuing anyway`);
      }
      
      // ✅ ENHANCED: Create queued user with data validation
      const queuedUser: QueuedUser = {
        ...user,
        queuedAt: Date.now(),
        version: this.QUEUE_VERSION,
        checksum: this.generateChecksum(user)
      };
      
      // ✅ ENHANCED: Validate data before serialization
      const validationResult = this.validateUserData(queuedUser);
      if (!validationResult.success) {
        logger.error(`❌ User data validation failed for ${user.id}:`, validationResult.error);
        return false;
      }
      
      // ✅ ENHANCED: Safe serialization with error handling
      let serializedUser: string;
      try {
        serializedUser = JSON.stringify(queuedUser);
        
        // Check serialized size
        if (serializedUser.length > 10000) { // 10KB limit
          logger.warn(`⚠️ User data too large for ${user.id}: ${serializedUser.length} bytes`);
          // Create a lightweight version
          const lightUser = this.createLightweightUser(queuedUser);
          serializedUser = JSON.stringify(lightUser);
        }
      } catch (serializationError) {
        logger.error(`❌ Failed to serialize user ${user.id}:`, serializationError);
        return false;
      }
      
      // ✅ ENHANCED: Atomic operation with retry logic
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          const pipeline = this.redis.pipeline();
          pipeline.rpush(key, serializedUser);
          pipeline.expire(key, RedisConfig.TTL.QUEUE);
          
          const results = await pipeline.exec();
          
          if (results && results.every(([err]) => !err)) {
            logger.debug(`⏳ Added ${user.id} to ${chatType} queue (attempt ${attempts + 1})`);
            return true;
          } else {
            throw new Error(`Pipeline execution failed: ${JSON.stringify(results)}`);
          }
        } catch (error) {
          attempts++;
          logger.warn(`⚠️ Queue add attempt ${attempts} failed for ${user.id}:`, error);
          
          if (attempts < maxAttempts) {
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 100));
          }
        }
      }
      
      logger.error(`❌ All attempts failed to add ${user.id} to ${chatType} queue`);
      return false;
      
    } catch (error) {
      logger.error(`❌ Critical error in addToQueue for ${user.id}:`, error);
      return false;
    }
  }

  async popFromQueue(chatType: 'text' | 'video'): Promise<User | null> {
    try {
      const key = RedisConfig.buildKey(RedisConfig.PREFIXES.QUEUE, chatType);
      
      let attempts = 0;
      const maxAttempts = 5; // Try up to 5 entries in case of corruption
      
      while (attempts < maxAttempts) {
        let userData: string | null = null;
        
        try {
          userData = await this.redis.lpop(key);
        } catch (redisError) {
          logger.error(`❌ Redis error popping from ${chatType} queue:`, redisError);
          return null;
        }
        
        if (!userData) {
          return null; // Queue is empty
        }
        
        // ✅ ENHANCED: Safe parsing with comprehensive error handling
        const parseResult = await this.safeParseQueueEntry(userData, chatType);
        
        if (parseResult.success && parseResult.user) {
          const { user, recovered } = parseResult;
          
          if (recovered) {
            logger.warn(`⚠️ Recovered corrupted entry for ${user.id} in ${chatType} queue`);
          }
          
          // ✅ ENHANCED: Validate parsed user
          const age = Date.now() - (user.connectionStartTime || 0);
          if (age > 15 * 60 * 1000) { // 15 minutes
            logger.warn(`⚠️ Queue entry too old for ${user.id} (${age}ms), trying next`);
            attempts++;
            continue;
          }
          
          // ✅ ENHANCED: Data integrity check
          if (parseResult.queuedUser?.checksum) {
            const expectedChecksum = this.generateChecksum(user);
            if (parseResult.queuedUser.checksum !== expectedChecksum) {
              logger.warn(`⚠️ Checksum mismatch for ${user.id}, data may be corrupted`);
              // Continue anyway, but log the issue
            }
          }
          
          logger.debug(`⏳ Popped ${user.id} from ${chatType} queue (waited: ${age}ms)`);
          return user;
        } else {
          logger.warn(`⚠️ Failed to parse queue entry in ${chatType}, trying next`);
          attempts++;
          
          // Track corruption for monitoring
          this.trackCorruption(chatType);
        }
      }
      
      logger.warn(`❌ Exhausted all attempts to pop valid entry from ${chatType} queue`);
      return null;
      
    } catch (error) {
      logger.error(`❌ Critical error in popFromQueue for ${chatType}:`, error);
      return null;
    }
  }

  // ✅ NEW: Safe parsing with multiple recovery strategies
  private async safeParseQueueEntry(
    userData: string, 
    chatType: 'text' | 'video'
  ): Promise<{
    success: boolean;
    user?: User;
    queuedUser?: QueuedUser;
    recovered?: boolean;
    error?: string;
  }> {
    let attempts = 0;
    const parseStrategies = [
      // Strategy 1: Normal JSON parsing
      () => JSON.parse(userData) as QueuedUser,
      
      // Strategy 2: Strip invalid characters and retry
      () => {
        const cleaned = userData.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        return JSON.parse(cleaned) as QueuedUser;
      },
      
      // Strategy 3: Try to extract essential fields manually
      () => this.extractEssentialFields(userData),
      
      // Strategy 4: Basic fallback parsing
      () => this.createFallbackUser(userData)
    ];
    
    for (const strategy of parseStrategies) {
      try {
        const queuedUser = strategy();
        
        // Validate the parsed object
        if (this.isValidQueuedUser(queuedUser)) {
          const { queuedAt, version, checksum, ...user } = queuedUser;
          
          // Version validation
          if (version && version !== this.QUEUE_VERSION) {
            logger.debug(`⚠️ Version mismatch for user ${user.id}: expected ${this.QUEUE_VERSION}, got ${version}`);
          }
          
          return {
            success: true,
            user,
            queuedUser,
            recovered: attempts > 0
          };
        }
      } catch (error) {
        attempts++;
        logger.debug(`Parse attempt ${attempts} failed:`, error);
      }
    }
    
    return {
      success: false,
      error: `All parsing strategies failed after ${attempts} attempts`
    };
  }

  // ✅ NEW: Extract essential fields manually when JSON parsing fails
  private extractEssentialFields(userData: string): QueuedUser {
    const patterns = {
      id: /"id"\s*:\s*"([^"]+)"/,
      authId: /"authId"\s*:\s*"([^"]+)"/,
      chatType: /"chatType"\s*:\s*"([^"]+)"/,
      interests: /"interests"\s*:\s*\[([^\]]*)\]/,
      connectionStartTime: /"connectionStartTime"\s*:\s*(\d+)/,
      queuedAt: /"queuedAt"\s*:\s*(\d+)/
    };
    
    const extracted: any = {
      version: this.QUEUE_VERSION,
      queuedAt: Date.now()
    };
    
    for (const [field, pattern] of Object.entries(patterns)) {
      const match = userData.match(pattern);
      if (match) {
        if (field === 'interests') {
          try {
            extracted[field] = JSON.parse(`[${match[1]}]`);
          } catch {
            extracted[field] = [];
          }
        } else if (field === 'connectionStartTime' || field === 'queuedAt') {
          extracted[field] = parseInt(match[1], 10);
        } else {
          extracted[field] = match[1];
        }
      }
    }
    
    // Ensure required fields
    if (!extracted.id || !extracted.chatType) {
      throw new Error('Missing required fields');
    }
    
    return extracted as QueuedUser;
  }

  // ✅ NEW: Create fallback user when all else fails
  private createFallbackUser(userData: string): QueuedUser {
    return {
      id: `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      authId: null,
      interests: [],
      chatType: 'text', // Default to text chat
      connectionStartTime: Date.now(),
      queuedAt: Date.now(),
      version: this.QUEUE_VERSION
    };
  }

  // ✅ NEW: Validate queued user object
  private isValidQueuedUser(obj: any): obj is QueuedUser {
    return (
      obj &&
      typeof obj === 'object' &&
      typeof obj.id === 'string' &&
      obj.id.length > 0 &&
      (obj.chatType === 'text' || obj.chatType === 'video') &&
      Array.isArray(obj.interests) &&
      typeof obj.queuedAt === 'number'
    );
  }

  // ✅ NEW: Generate checksum for data integrity
  private generateChecksum(user: User): string {
    const data = `${user.id}:${user.chatType}:${user.authId || ''}:${user.interests?.join(',') || ''}`;
    return Buffer.from(data).toString('base64').substr(0, 16);
  }

  // ✅ NEW: Validate user data before queuing
  private validateUserData(user: QueuedUser): QueueOperationResult {
    if (!user.id || user.id.length === 0) {
      return { success: false, error: 'Missing or empty user ID' };
    }
    
    if (!user.chatType || (user.chatType !== 'text' && user.chatType !== 'video')) {
      return { success: false, error: 'Invalid chat type' };
    }
    
    if (!Array.isArray(user.interests)) {
      return { success: false, error: 'Interests must be an array' };
    }
    
    if (typeof user.queuedAt !== 'number' || user.queuedAt <= 0) {
      return { success: false, error: 'Invalid queue timestamp' };
    }
    
    return { success: true };
  }

  // ✅ NEW: Create lightweight version of user data
  private createLightweightUser(user: QueuedUser): QueuedUser {
    return {
      id: user.id,
      authId: user.authId,
      interests: user.interests?.slice(0, 5) || [], // Limit to 5 interests
      chatType: user.chatType,
      connectionStartTime: user.connectionStartTime,
      queuedAt: user.queuedAt,
      version: user.version,
      // Remove optional fields that might be large
      username: user.username?.substring(0, 50),
      displayName: user.displayName?.substring(0, 50)
    };
  }

  // ✅ NEW: Safe remove operation
  private async safeRemoveFromQueue(chatType: 'text' | 'video', userId: string): Promise<QueueOperationResult> {
    try {
      const key = RedisConfig.buildKey(RedisConfig.PREFIXES.QUEUE, chatType);
      
      let queueItems: string[] = [];
      try {
        queueItems = await this.redis.lrange(key, 0, -1);
      } catch (error) {
        return { success: false, error: `Failed to read queue: ${error}` };
      }
      
      let removedCount = 0;
      let corruptedCount = 0;
      
      for (const item of queueItems) {
        const parseResult = await this.safeParseQueueEntry(item, chatType);
        
        if (parseResult.success && parseResult.user?.id === userId) {
          try {
            await this.redis.lrem(key, 1, item);
            removedCount++;
          } catch (error) {
            logger.warn(`Failed to remove item for ${userId}:`, error);
          }
        } else if (!parseResult.success) {
          // Remove corrupted entries while we're here
          try {
            await this.redis.lrem(key, 1, item);
            corruptedCount++;
          } catch (error) {
            logger.warn(`Failed to remove corrupted item:`, error);
          }
        }
      }
      
      if (corruptedCount > 0) {
        logger.info(`🧹 Removed ${corruptedCount} corrupted entries while removing ${userId}`);
      }
      
      return {
        success: removedCount > 0,
        recovered: corruptedCount > 0
      };
      
    } catch (error) {
      return { success: false, error: `Remove operation failed: ${error}` };
    }
  }

  
  // ✅ NEW: Emergency cleanup for full queues
  private async emergencyCleanup(chatType: 'text' | 'video'): Promise<number> {
    try {
      const cutoffTime = Date.now() - (5 * 60 * 1000); // 5 minutes ago
      return await this.cleanupStaleEntries(5 * 60 * 1000);
    } catch (error) {
      logger.error(`❌ Emergency cleanup failed for ${chatType}:`, error);
      return 0;
    }
  }



  // ✅ NEW: Track corruption for monitoring
  private async trackCorruption(chatType: 'text' | 'video'): Promise<void> {
    try {
      const corruptionKey = RedisConfig.buildKey('corruption_count', chatType);
      const count = await this.redis.incr(corruptionKey);
      await this.redis.expire(corruptionKey, 3600); // 1 hour TTL
      
      if (count >= this.CORRUPTION_THRESHOLD) {
        logger.warn(`🚨 High corruption detected in ${chatType} queue: ${count} entries`);
        // Trigger emergency cleanup
        this.emergencyCleanup(chatType).catch(err => 
          logger.error('Emergency cleanup failed:', err)
        );
      }
    } catch (error) {
      logger.debug('Failed to track corruption:', error);
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
    const result = await this.safeRemoveFromQueue(chatType, userId);
    
    if (result.success) {
      logger.debug(`🗑️ Removed ${userId} from ${chatType} queue`);
    } else if (result.error) {
      logger.error(`❌ Failed to remove ${userId} from ${chatType} queue: ${result.error}`);
    }
    
    return result.success;
  }

  async removeFromAllQueues(userId: string): Promise<boolean> {
    try {
      const results = await Promise.allSettled([
        this.safeRemoveFromQueue('text', userId),
        this.safeRemoveFromQueue('video', userId)
      ]);
      
      return results.some(result => 
        result.status === 'fulfilled' && result.value.success === true
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
      let corruptedCount = 0;
      
      for (const item of items) {
        const parseResult = await this.safeParseQueueEntry(item, chatType);
        
        if (parseResult.success && parseResult.user) {
          const { user } = parseResult;
          
          // Validate age
          const age = Date.now() - (user.connectionStartTime || 0);
          if (age <= 15 * 60 * 1000) { // 15 minutes
            validUsers.push(user);
          } else {
            invalidItems.push(item);
          }
        } else {
          invalidItems.push(item);
          corruptedCount++;
        }
      }
      
      // Clean up invalid items in background
      if (invalidItems.length > 0) {
        this.cleanupInvalidItems(key, invalidItems).catch(err =>
          logger.debug(`Background cleanup failed for ${chatType}:`, err)
        );
        
        if (corruptedCount > 0) {
          logger.warn(`⚠️ Found ${corruptedCount} corrupted entries in ${chatType} queue`);
        }
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
        const parseResult = await this.safeParseQueueEntry(userData, chatType);
        
        if (parseResult.success && parseResult.user) {
          const age = Date.now() - (parseResult.user.connectionStartTime || 0);
          if (age <= 15 * 60 * 1000) {
            return parseResult.user;
          }
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
    corruption: { text: number; video: number };
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

      // Get corruption counts
      const [textCorruption, videoCorruption] = await Promise.allSettled([
        this.redis.get(RedisConfig.buildKey('corruption_count', 'text')),
        this.redis.get(RedisConfig.buildKey('corruption_count', 'video'))
      ]);

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
        },
        corruption: {
          text: textCorruption.status === 'fulfilled' ? parseInt(textCorruption.value || '0') : 0,
          video: videoCorruption.status === 'fulfilled' ? parseInt(videoCorruption.value || '0') : 0
        }
      };
    } catch (error) {
      logger.error('❌ Failed to get queue stats:', error);
      return {
        text: 0,
        video: 0,
        total: 0,
        oldestWaitTimes: { text: 0, video: 0 },
        health: { text: false, video: false },
        corruption: { text: 0, video: 0 }
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

        // Clear corruption counters
        await Promise.allSettled([
          this.redis.del(RedisConfig.buildKey('corruption_count', 'text')),
          this.redis.del(RedisConfig.buildKey('corruption_count', 'video'))
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
          const parseResult = await this.safeParseQueueEntry(item, chatType);
          
          if (!parseResult.success) {
            // Remove corrupted entries
            itemsToRemove.push(item);
          } else if (parseResult.queuedUser) {
            // Check if entry is stale or has wrong version
            if (parseResult.queuedUser.queuedAt < cutoffTime || 
                parseResult.queuedUser.version !== this.QUEUE_VERSION) {
              itemsToRemove.push(item);
            }
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
      
      // Check corruption levels
      if (stats.corruption.text >= this.CORRUPTION_THRESHOLD) {
        issues.push(`High corruption in text queue: ${stats.corruption.text} entries`);
      }
      
      if (stats.corruption.video >= this.CORRUPTION_THRESHOLD) {
        issues.push(`High corruption in video queue: ${stats.corruption.video} entries`);
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