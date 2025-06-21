//server/managers/profile/modules/FriendsModule.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { RedisService } from '../../../services/RedisService';
import { FriendData, FriendshipStatus } from '../types/FriendTypes';
import { logger } from '../../../utils/logger';

// Typing the structure Supabase will return
type FriendRow = {
  friend_id: string;
  created_at: string;
  friend: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
    status?: string | null;
    last_seen?: string | null;
    is_online?: boolean | null;
  } | null;
};

const VALID_STATUSES = ['online', 'idle', 'dnd', 'offline'];

export class FriendsModule {
  private supabase: SupabaseClient | null;
  private redisService: RedisService | null;

  constructor(supabase: SupabaseClient | null, redisService: RedisService | null) {
    this.supabase = supabase;
    this.redisService = redisService;
  }

  async getFriendsList(authId: string): Promise<FriendData[]> {
    if (!this.supabase) return [];

    // ✅ Try Redis first
    const cached = await this.redisService?.getCachedFriendsList?.(authId);
    if (cached) return cached;

    try {
      const { data, error } = await this.supabase
        .from('friendships')
        .select(`
          friend_id,
          created_at,
          friend:user_profiles!friendships_friend_id_fkey (
            id, username, display_name, avatar_url, status, last_seen, is_online
          )
        `) as unknown as { data: FriendRow[]; error: any };

      if (error || !data) throw error ?? new Error('No data returned');

      const friends: FriendData[] = data
        .filter(f => f.friend)
        .map(f => {
          const friend = f.friend!;
          const safeStatus = VALID_STATUSES.includes(friend.status || '')
            ? (friend.status as 'online' | 'idle' | 'dnd' | 'offline')
            : 'offline';

          return {
            id: friend.id,
            username: friend.username,
            display_name: friend.display_name,
            avatar_url: friend.avatar_url,
            status: safeStatus,
            last_seen: friend.last_seen || new Date().toISOString(),
            is_online: friend.is_online ?? false,
            friends_since: f.created_at,
          };
        });

      // ✅ Cache in Redis (with optional TTL if supported)
      await this.redisService?.cacheFriendsList?.(authId, friends);
      return friends;

    } catch (error) {
      logger.error(`Error fetching friends for ${authId}:`, error);
      return [];
    }
  }

  async getFriendshipStatus(user1Id: string, user2Id: string): Promise<FriendshipStatus> {
    if (!this.supabase) return { status: 'none' };

    try {
      const { data, error } = await this.supabase
        .from('friendships')
        .select('status, created_at')
        .or(`and(user_id.eq.${user1Id},friend_id.eq.${user2Id}),and(user_id.eq.${user2Id},friend_id.eq.${user1Id})`)
        .maybeSingle();

      if (error || !data) return { status: 'none' };

      return {
        status: data.status as FriendshipStatus['status'],
        since: data.created_at,
      };
    } catch (error) {
      logger.error(`Error getting friendship status between ${user1Id} and ${user2Id}:`, error);
      return { status: 'none' };
    }
  }

  async invalidateFriendsCache(authId: string): Promise<void> {
    await this.redisService?.invalidateFriendsList?.(authId);
  }
}
