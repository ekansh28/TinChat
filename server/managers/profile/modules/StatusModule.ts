// server/managers/profile/modules/StatusModule.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { RedisService } from '../../../services/RedisService';
import { logger } from '../../../utils/logger';

export class StatusModule {
  private supabase: SupabaseClient | null;
  private redisService: RedisService | null;

  constructor(supabase: SupabaseClient | null, redisService: RedisService | null) {
    this.supabase = supabase;
    this.redisService = redisService;
  }

  async setOnlineStatus(authId: string, isOnline: boolean): Promise<boolean> {
    try {
      const lastSeen = isOnline ? null : new Date().toISOString();

      // Update in Supabase
      if (this.supabase) {
        const { error } = await this.supabase
          .from('user_profiles')
          .update({ is_online: isOnline, last_seen: lastSeen })
          .eq('id', authId);

        if (error) throw error;
      }

      // Cache update in Redis
      if (this.redisService) {
        await this.redisService.cacheUserOnlineStatus(authId, isOnline, lastSeen ? new Date(lastSeen) : undefined);
      }

      logger.debug(`🌐 Set online status for ${authId}: ${isOnline}`);
      return true;
    } catch (error) {
      logger.error(`❌ Failed to set online status for : ${authId}:`, error);
      return false;
    }
  }

  async getOnlineStatus(authId: string): Promise<{ isOnline: boolean; lastSeen?: string }> {
    try {
      if (this.redisService) {
        const cached = await this.redisService.getCachedOnlineStatus(authId);
        if (cached) return cached;
      }

      if (this.supabase) {
        const { data, error } = await this.supabase
          .from('user_profiles')
          .select('is_online, last_seen')
          .eq('id', authId)
          .single();

        if (error || !data) throw error;

        const status = {
          isOnline: !!data.is_online,
          lastSeen: data.last_seen || undefined
        };

        if (this.redisService) {
          await this.redisService.cacheUserOnlineStatus(authId, status.isOnline, status.lastSeen ? new Date(status.lastSeen) : undefined);
        }

        return status;
      }
    } catch (err) {
      logger.error(`❌ Failed to get online status for ${authId}:`, err);
    }

    return { isOnline: false };
  }

  async getOnlineUsers(): Promise<string[]> {
    try {
      if (this.redisService) {
        const cached = await this.redisService.getCachedOnlineUsers();
        if (cached) return cached;
      }

      if (this.supabase) {
        const { data, error } = await this.supabase
          .from('user_profiles')
          .select('id')
          .eq('is_online', true)
          .limit(1000);

        if (error || !data) throw error;

        const ids = data.map(d => d.id);

        if (this.redisService) {
          await this.redisService.cacheOnlineUsers(ids);
        }

        return ids;
      }
    } catch (err) {
      logger.error('❌ Failed to fetch online users:', err);
    }

    return [];
  }

  async batchGetOnlineStatus(authIds: string[]): Promise<Record<string, boolean>> {
    const result: Record<string, boolean> = {};
    const missingIds: string[] = [];

    if (this.redisService) {
      const cachedStatuses = await this.redisService.batchGetOnlineStatus(authIds);

      cachedStatuses.forEach((status, index) => {
        if (status !== null) {
          result[authIds[index]] = status.isOnline;
        } else {
          missingIds.push(authIds[index]);
        }
      });
    } else {
      missingIds.push(...authIds);
    }

    if (missingIds.length && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('user_profiles')
          .select('id, is_online')
          .in('id', missingIds);

        if (error || !data) throw error;

        const updates: Array<{ authId: string; isOnline: boolean }> = [];

        data.forEach(user => {
          result[user.id] = !!user.is_online;
          updates.push({ authId: user.id, isOnline: !!user.is_online });
        });

        if (this.redisService) {
          await this.redisService.batchSetOnlineStatus(updates);
        }
      } catch (error) {
        logger.error('❌ Batch DB fallback failed:', error);
      }
    }

    return result;
  }
}
