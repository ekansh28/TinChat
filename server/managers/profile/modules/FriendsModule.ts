// server/managers/profile/modules/FriendsModule.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { RedisService } from '../../../services/RedisService';
import { FriendData, FriendshipStatus } from '../types/FriendTypes';
import { logger } from '../../../utils/logger';

export class FriendsModule {
  private supabase: SupabaseClient | null;
  private redisService: RedisService | null;

  constructor(supabase: SupabaseClient | null, redisService: RedisService | null) {
    this.supabase = supabase;
    this.redisService = redisService;
  }

  async getFriendsList(authId: string): Promise<FriendData[]> {
    if (!this.supabase) return [];

    try {
      const { data, error } = await this.supabase
        .from('friendships')
        .select(`
          friend_id,
          created_at,
          friend:user_profiles!friendships_friend_id_fkey (
            id, username, display_name, avatar_url, status, last_seen, is_online
          )
        `)
        .eq('user_id', authId)
        .eq('status', 'accepted');

      if (error) throw error;

      return (data || []).map(f => ({
        id: f.friend.id,
        username: f.friend.username,
        display_name: f.friend.display_name,
        avatar_url: f.friend.avatar_url,
        status: f.friend.status || 'offline',
        last_seen: f.friend.last_seen || new Date().toISOString(),
        is_online: f.friend.is_online || false,
        friends_since: f.created_at
      }));
    } catch (error) {
      logger.error(`Error fetching friends for ${authId}:`, error);
      return [];
    }
  }

  async getFriendshipStatus(user1AuthId: string, user2AuthId: string): Promise<{
    status: 'none' | 'friends' | 'pending_sent' | 'pending_received' | 'blocked' | 'blocked_by';
    since?: string;
  }> {
    if (!this.supabase || !user1AuthId || !user2AuthId || user1AuthId === user2AuthId) {
      return { status: 'none' };
    }

    try {
      // Check if they are friends
      const { data: friendship } = await this.supabase
        .from('friendships')
        .select('created_at')
        .eq('user_id', user1AuthId)
        .eq('friend_id', user2AuthId)
        .eq('status', 'accepted')
        .single();

      if (friendship) {
        return {
          status: 'friends',
          since: friendship.created_at
        };
      }

      // Check for pending requests
      const { data: sentRequest } = await this.supabase
        .from('friend_requests')
        .select('created_at')
        .eq('sender_id', user1AuthId)
        .eq('receiver_id', user2AuthId)
        .eq('status', 'pending')
        .single();

      if (sentRequest) {
        return { status: 'pending_sent', since: sentRequest.created_at };
      }

      const { data: receivedRequest } = await this.supabase
        .from('friend_requests')
        .select('created_at')
        .eq('sender_id', user2AuthId)
        .eq('receiver_id', user1AuthId)
        .eq('status', 'pending')
        .single();

      if (receivedRequest) {
        return { status: 'pending_received', since: receivedRequest.created_at };
      }

      // Check if blocked
      const { data: blocked } = await this.supabase
        .from('blocked_users')
        .select('created_at')
        .eq('blocker_id', user1AuthId)
        .eq('blocked_id', user2AuthId)
        .single();

      if (blocked) {
        return { status: 'blocked', since: blocked.created_at };
      }

      // Check if blocked by
      const { data: blockedBy } = await this.supabase
        .from('blocked_users')
        .select('created_at')
        .eq('blocker_id', user2AuthId)
        .eq('blocked_id', user1AuthId)
        .single();

      if (blockedBy) {
        return { status: 'blocked_by', since: blockedBy.created_at };
      }

      return { status: 'none' };
    } catch (err) {
      logger.error(`Exception checking friendship status:`, err);
      return { status: 'none' };
    }
  }


  async invalidateFriendsCache(authId: string): Promise<void> {
    if (this.redisService) {
      await this.redisService.invalidateFriendsList(authId);
    }
  }
}