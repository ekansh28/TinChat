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
      // Update in database
      if (this.supabase) {
        const { error } = await this.supabase
          .from('user_profiles')
          .update({ 
            is_online: isOnline,
            last_seen: isOnline ? null : new Date().toISOString()
          })
          .eq('id', authId);

        if (error) throw error;
      }

      // Update in cache
      if (this.redisService) {
        await this.redisService.cacheUserOnlineStatus(
          authId, 
          isOnline,
          isOnline ? undefined : new Date()
        );
      }

      logger.debug(`🌐 Set online status for ${authId}: ${isOnline}`);
      return true;
    } catch (error) {
      logger.error(`Failed to set online status for ${authId}:`, error);
      return false;
    }
  }

  async getOnlineStatus(authId: string): Promise<{ isOnline: boolean; lastSeen?: string }> {
    // Try cache first
    if (this.redisService) {
      const cachedStatus = await this.redisService.getCachedOnlineStatus(authId);
      if (cachedStatus) {
        return {
          isOnline: cachedStatus.isOnline,
          lastSeen: cachedStatus.lastSeen
        };
      }
    }

    // Fallback to database
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('user_profiles')
          .select('is_online, last_seen')
          .eq('id', authId)
          .single();

        if (error) throw error;

        // Cache the result
        if (data && this.redisService) {
          await this.redisService.cacheUserOnlineStatus(
            authId,
            data.is_online,
            data.last_seen ? new Date(data.last_seen) : undefined
          );
        }

        return {
          isOnline: data?.is_online || false,
          lastSeen: data?.last_seen
        };
      } catch (error) {
        logger.error(`Failed to get online status for ${authId}:`, error);
      }
    }

    return { isOnline: false };
  }

  async getOnlineUsers(): Promise<string[]> {
    // Try cache first
    if (this.redisService) {
      const cachedOnline = await this.redisService.getCachedOnlineUsers();
      if (cachedOnline) {
        return cachedOnline;
      }
    }

    // Fallback to database
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('user_profiles')
          .select('id')
          .eq('is_online', true)
          .limit(1000);

        if (error) throw error;

        const onlineIds = data?.map(user => user.id) || [];

        // Cache the result
        if (this.redisService) {
          await this.redisService.cacheOnlineUsers(onlineIds);
        }

        return onlineIds;
      } catch (error) {
        logger.error('Failed to get online users:', error);
      }
    }

    return [];
  }

  async batchGetOnlineStatus(authIds: string[]): Promise<Record<string, boolean>> {
    // Try cache first
    if (this.redisService) {
      const cachedStatuses = await this.redisService.batchGetOnlineStatus(authIds);
      if (cachedStatuses.every(status => status !== null)) {
        const result: Record<string, boolean> = {};
        cachedStatuses.forEach((status, index) => {
          if (status) {
            result[authIds[index]] = status.isOnline;
          }
        });
        return result;
      }
    }

    // Fallback to database
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('user_profiles')
          .select('id, is_online')
          .in('id', authIds);

        if (error) throw error;

        const result: Record<string, boolean> = {};
        const statusUpdates: Array<{
          authId: string;
          isOnline: boolean;
          lastSeen?: Date;
        }> = [];

        data?.forEach(user => {
          result[user.id] = user.is_online;
          statusUpdates.push({
            authId: user.id,
            isOnline: user.is_online
          });
        });

        // Cache the results
        if (this.redisService) {
          await this.redisService.batchSetOnlineStatus(statusUpdates);
        }

        return result;
      } catch (error) {
        logger.error('Failed to batch get online status:', error);
      }
    }

    return {};
  }
}