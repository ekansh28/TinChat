// server/managers/profile/modules/BlockingModule.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { RedisService } from '../../../services/RedisService';
import { logger } from '../../../utils/logger';

export class BlockingModule {
  private supabase: SupabaseClient | null;
  private redisService: RedisService | null;

  constructor(supabase: SupabaseClient | null, redisService: RedisService | null) {
    this.supabase = supabase;
    this.redisService = redisService;
  }

  async blockUser(blockerId: string, blockedId: string): Promise<boolean> {
    if (!this.supabase || blockerId === blockedId) return false;

    try {
      const { error } = await this.supabase
        .from('blocked_users')
        .upsert({
          blocker_id: blockerId,
          blocked_id: blockedId,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      // Invalidate any cached friendship status
      if (this.redisService) {
        await Promise.all([
          this.redisService.invalidateFriendsList(blockerId),
          this.redisService.invalidateFriendsList(blockedId)
        ]);
      }

      logger.info(`🚫 User ${blockerId} blocked  : ${blockedId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to block user ${blockedId} by ${blockerId}:`, error);
      return false;
    }
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      const { error } = await this.supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', blockerId)
        .eq('blocked_id', blockedId);

      if (error) throw error;

      // Invalidate any cached friendship status
      if (this.redisService) {
        await Promise.all([
          this.redisService.invalidateFriendsList(blockerId),
          this.redisService.invalidateFriendsList(blockedId)
        ]);
      }

      logger.info(`🔓 User ${blockerId} unblocked ${blockedId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to unblock user ${blockedId} by ${blockerId}:`, error);
      return false;
    }
  }

  async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      const { data, error } = await this.supabase
        .from('blocked_users')
        .select('blocker_id')
        .eq('blocker_id', blockerId)
        .eq('blocked_id', blockedId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // Ignore "no rows" error
      return !!data;
    } catch (error) {
      logger.error(`Failed to check block status between ${blockerId} and ${blockedId}:`, error);
      return false;
    }
  }

  async getBlockedUsers(authId: string): Promise<string[]> {
    if (!this.supabase) return [];

    try {
      const { data, error } = await this.supabase
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', authId);

      if (error) throw error;
      return data?.map(entry => entry.blocked_id) || [];
    } catch (error) {
      logger.error(`Failed to get blocked users for ${authId}:`, error);
      return [];
    }
  }

  async getBlockedByUsers(authId: string): Promise<string[]> {
    if (!this.supabase) return [];

    try {
      const { data, error } = await this.supabase
        .from('blocked_users')
        .select('blocker_id')
        .eq('blocked_id', authId);

      if (error) throw error;
      return data?.map(entry => entry.blocker_id) || [];
    } catch (error) {
      logger.error(`Failed to get users who blocked ${authId}:`, error);
      return [];
    }
  }
}