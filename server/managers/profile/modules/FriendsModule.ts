//server/managers/profile/modules/FriendsModule.ts - ENHANCED VERSION
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

type FriendRequestRow = {
  id: string;
  sender_id?: string;
  receiver_id?: string;
  message?: string;
  created_at: string;
  sender?: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
    is_online?: boolean;
  } | null;
  receiver?: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
    is_online?: boolean;
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
      // Check if they are friends
      const { data: friendship } = await this.supabase
        .from('friendships')
        .select('created_at')
        .eq('user_id', user1Id)
        .eq('friend_id', user2Id)
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
        .eq('sender_id', user1Id)
        .eq('receiver_id', user2Id)
        .eq('status', 'pending')
        .single();

      if (sentRequest) {
        return { status: 'pending_sent', since: sentRequest.created_at };
      }

      const { data: receivedRequest } = await this.supabase
        .from('friend_requests')
        .select('created_at')
        .eq('sender_id', user2Id)
        .eq('receiver_id', user1Id)
        .eq('status', 'pending')
        .single();

      if (receivedRequest) {
        return { status: 'pending_received', since: receivedRequest.created_at };
      }

      // Check if blocked
      const { data: blocked } = await this.supabase
        .from('blocked_users')
        .select('created_at')
        .eq('blocker_id', user1Id)
        .eq('blocked_id', user2Id)
        .single();

      if (blocked) {
        return { status: 'blocked', since: blocked.created_at };
      }

      // Check if blocked by
      const { data: blockedBy } = await this.supabase
        .from('blocked_users')
        .select('created_at')
        .eq('blocker_id', user2Id)
        .eq('blocked_id', user1Id)
        .single();

      if (blockedBy) {
        return { status: 'blocked_by', since: blockedBy.created_at };
      }

      return { status: 'none' };
    } catch (error) {
      logger.error(`Error getting friendship status between : ${user1Id} and ${user2Id}:`, error);
      return { status: 'none' };
    }
  }

  async invalidateFriendsCache(authId: string): Promise<void> {
    await this.redisService?.invalidateFriendsList?.(authId);
  }

  // ==================== FRIEND REQUEST METHODS ====================

  async getPendingFriendRequests(authId: string, type: 'received' | 'sent' = 'received'): Promise<any[]> {
    if (!this.supabase || !authId) {
      return [];
    }

    try {
      const field = type === 'received' ? 'receiver_id' : 'sender_id';
      const joinField = type === 'received' ? 'sender_id' : 'receiver_id';
      const aliasField = type === 'received' ? 'sender' : 'receiver';

      const { data: requests, error } = await this.supabase
        .from('friend_requests')
        .select(`
          id,
          ${joinField},
          message,
          created_at,
          ${aliasField}:user_profiles!friend_requests_${joinField}_fkey (
            id,
            username,
            display_name,
            avatar_url,
            is_online
          )
        `) as unknown as { data: FriendRequestRow[]; error: any };

      if (error) {
        logger.error(`Error fetching ${type} friend requests for ${authId}:`, error);
        return [];
      }

      return requests || [];
    } catch (err) {
      logger.error(`Exception fetching ${type} friend requests for ${authId}:`, err);
      return [];
    }
  }

  async sendFriendRequest(senderAuthId: string, receiverAuthId: string, message?: string): Promise<{
    success: boolean;
    message: string;
    autoAccepted?: boolean;
  }> {
    if (!this.supabase || !senderAuthId || !receiverAuthId) {
      return { success: false, message: 'Invalid parameters' };
    }

    try {
      const { data, error } = await this.supabase
        .rpc('send_friend_request', {
          sender_uuid: senderAuthId,
          receiver_uuid: receiverAuthId,
          request_message: message || null
        });

      if (error) {
        logger.error(`Error sending friend request from ${senderAuthId} to ${receiverAuthId}:`, error);
        return { success: false, message: 'Failed to send friend request' };
      }

      // Invalidate friends cache for both users if auto-accepted
      if (this.redisService && data.auto_accepted) {
        this.redisService.invalidateFriendsList(senderAuthId);
        this.redisService.invalidateFriendsList(receiverAuthId);
      }

      return {
        success: data.success,
        message: data.message,
        autoAccepted: data.auto_accepted
      };
    } catch (err) {
      logger.error(`Exception sending friend request:`, err);
      return { success: false, message: 'Failed to send friend request' };
    }
  }

  async acceptFriendRequest(requestId: string, acceptingUserId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    if (!this.supabase || !requestId || !acceptingUserId) {
      return { success: false, message: 'Invalid parameters' };
    }

    try {
      const { data, error } = await this.supabase
        .rpc('accept_friend_request', {
          request_id: requestId,
          accepting_user_id: acceptingUserId
        });

      if (error) {
        logger.error(`Error accepting friend request ${requestId}:`, error);
        return { success: false, message: 'Failed to accept friend request' };
      }

      // Invalidate friends cache for both users
      if (this.redisService && data.success) {
        const { data: requestData } = await this.supabase
          .from('friend_requests')
          .select('sender_id, receiver_id')
          .eq('id', requestId)
          .single();

        if (requestData) {
          this.redisService.invalidateFriendsList(requestData.sender_id);
          this.redisService.invalidateFriendsList(requestData.receiver_id);
        }
      }

      return {
        success: data.success,
        message: data.message
      };
    } catch (err) {
      logger.error(`Exception accepting friend request:`, err);
      return { success: false, message: 'Failed to accept friend request' };
    }
  }

  async declineFriendRequest(requestId: string, decliningUserId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    if (!this.supabase || !requestId || !decliningUserId) {
      return { success: false, message: 'Invalid parameters' };
    }

    try {
      const { data, error } = await this.supabase
        .rpc('decline_friend_request', {
          request_id: requestId,
          declining_user_id: decliningUserId
        });

      if (error) {
        logger.error(`Error declining friend request ${requestId}:`, error);
        return { success: false, message: 'Failed to decline friend request' };
      }

      return {
        success: data.success,
        message: data.message
      };
    } catch (err) {
      logger.error(`Exception declining friend request:`, err);
      return { success: false, message: 'Failed to decline friend request' };
    }
  }

  async removeFriend(user1AuthId: string, user2AuthId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    if (!this.supabase || !user1AuthId || !user2AuthId) {
      return { success: false, message: 'Invalid parameters' };
    }

    try {
      const { data, error } = await this.supabase
        .rpc('remove_friend', {
          user1_id: user1AuthId,
          user2_id: user2AuthId
        });

      if (error) {
        logger.error(`Error removing friendship between ${user1AuthId} and ${user2AuthId}:`, error);
        return { success: false, message: 'Failed to remove friend' };
      }

      // Invalidate friends cache for both users
      if (this.redisService && data.success) {
        this.redisService.invalidateFriendsList(user1AuthId);
        this.redisService.invalidateFriendsList(user2AuthId);
      }

      return {
        success: data.success,
        message: data.message
      };
    } catch (err) {
      logger.error(`Exception removing friend:`, err);
      return { success: false, message: 'Failed to remove friend' };
    }
  }

  // ==================== MUTUAL FRIENDS AND STATS ====================

  async getMutualFriends(user1AuthId: string, user2AuthId: string): Promise<any[]> {
    if (!this.supabase || !user1AuthId || !user2AuthId) {
      return [];
    }

    try {
      const { data: mutuals, error } = await this.supabase
        .from('mutual_friends')
        .select(`
          mutual_friend_id,
          mutual_friend_username,
          mutual_friend_display_name,
          mutual_friend_avatar
        `)
        .eq('user1_id', user1AuthId)
        .eq('user2_id', user2AuthId);

      if (error) {
        logger.error(`Error fetching mutual friends:`, error);
        return [];
      }

      return mutuals || [];
    } catch (err) {
      logger.error(`Exception fetching mutual friends:`, err);
      return [];
    }
  }

  async getFriendStats(authId: string): Promise<{
    friendCount: number;
    pendingSentCount: number;
    pendingReceivedCount: number;
    mutualFriendsWithRecent?: number;
  }> {
    if (!this.supabase || !authId) {
      return {
        friendCount: 0,
        pendingSentCount: 0,
        pendingReceivedCount: 0
      };
    }

    try {
      const { data: stats, error } = await this.supabase
        .from('user_friend_counts')
        .select('friend_count, pending_sent_count, pending_received_count')
        .eq('id', authId)
        .single();

      if (error) {
        logger.error(`Error fetching friend stats for ${authId}:`, error);
        return {
          friendCount: 0,
          pendingSentCount: 0,
          pendingReceivedCount: 0
        };
      }

      return {
        friendCount: stats?.friend_count || 0,
        pendingSentCount: stats?.pending_sent_count || 0,
        pendingReceivedCount: stats?.pending_received_count || 0
      };
    } catch (err) {
      logger.error(`Exception fetching friend stats:`, err);
      return {
        friendCount: 0,
        pendingSentCount: 0,
        pendingReceivedCount: 0
      };
    }
  }

  async getOnlineFriendsCount(authId: string): Promise<number> {
    if (!this.supabase || !authId) {
      return 0;
    }

    // Check Redis cache first
    if (this.redisService) {
      try {
        const cacheKey = `online_friends_count:${authId}`;
        const redisInstance = this.redisService.getRedisInstance();
        const cached = await redisInstance.get(cacheKey);
        
        if (cached) {
          return parseInt(cached, 10) || 0;
        }
      } catch (error) {
        logger.debug(`Redis online friends count fetch failed:`, error);
      }
    }

    try {
      const { count, error } = await this.supabase
        .from('friendships')
        .select('friend_id', { count: 'exact', head: true })
        .eq('user_id', authId)
        .eq('status', 'accepted')
        .eq('friend.is_online', true);

      if (error) {
        logger.error(`Error getting online friends count:`, error);
        return 0;
      }

      const onlineCount = count || 0;

      // Cache the result for 30 seconds
      if (this.redisService) {
        const cacheKey = `online_friends_count:${authId}`;
        const redisInstance = this.redisService.getRedisInstance();
        redisInstance.setex(cacheKey, 30, onlineCount.toString()).catch(() => {});
      }

      return onlineCount;
    } catch (err) {
      logger.error(`Exception getting online friends count:`, err);
      return 0;
    }
  }

  // ==================== SEARCH AND DISCOVERY ====================

  async searchUsersToAddAsFriends(currentUserAuthId: string, searchTerm: string, limit: number = 20): Promise<any[]> {
    if (!this.supabase || !currentUserAuthId || !searchTerm.trim()) {
      return [];
    }

    try {
      const { data: users, error } = await this.supabase
        .from('user_profiles')
        .select(`
          id, username, display_name, avatar_url, status, is_online,
          display_name_color, badges
        `)
        .ilike('username', `%${searchTerm}%`)
        .neq('id', currentUserAuthId)
        .limit(limit);

      if (error) {
        logger.error(`Error searching users:`, error);
        return [];
      }

      if (!users || users.length === 0) {
        return [];
      }

      const userIds = users.map(u => u.id);
      
      // Get existing relationships
      const [
        { data: existingFriends },
        { data: blockedUsers },
        { data: blockedByUsers },
        { data: pendingRequests }
      ] = await Promise.all([
        this.supabase
          .from('friendships')
          .select('friend_id')
          .eq('user_id', currentUserAuthId)
          .in('friend_id', userIds),
        this.supabase
          .from('blocked_users')
          .select('blocked_id')
          .eq('blocker_id', currentUserAuthId)
          .in('blocked_id', userIds),
        this.supabase
          .from('blocked_users')
          .select('blocker_id')
          .eq('blocked_id', currentUserAuthId)
          .in('blocker_id', userIds),
        this.supabase
          .from('friend_requests')
          .select('sender_id, receiver_id')
          .eq('status', 'pending')
          .or(`sender_id.eq.${currentUserAuthId},receiver_id.eq.${currentUserAuthId}`)
          .or(`sender_id.in.(${userIds.join(',')}),receiver_id.in.(${userIds.join(',')})`)
      ]);

      // Create filter sets
      const friendIds = new Set((existingFriends || []).map(f => f.friend_id));
      const blockedIds = new Set((blockedUsers || []).map(b => b.blocked_id));
      const blockedByIds = new Set((blockedByUsers || []).map(b => b.blocker_id));
      const pendingIds = new Set();

      (pendingRequests || []).forEach(req => {
        if (req.sender_id === currentUserAuthId) {
          pendingIds.add(req.receiver_id);
        } else if (req.receiver_id === currentUserAuthId) {
          pendingIds.add(req.sender_id);
        }
      });

      // Filter users
      const filteredUsers = users.filter(user => 
        !friendIds.has(user.id) &&
        !blockedIds.has(user.id) &&
        !blockedByIds.has(user.id) &&
        !pendingIds.has(user.id)
      );

      return filteredUsers;

    } catch (err) {
      logger.error(`Exception searching users to add as friends:`, err);
      return [];
    }
  }

  // ==================== UTILITY METHODS ====================

  async batchInvalidateFriendsCache(authIds: string[]): Promise<void> {
    if (!this.redisService || authIds.length === 0) return;

    try {
      const invalidationPromises = authIds.map(authId => 
        this.redisService!.invalidateFriendsList(authId)
      );
      
      await Promise.allSettled(invalidationPromises);
      logger.debug(`👥 Batch invalidated ${authIds.length} friends lists`);
    } catch (error) {
      logger.error('Batch friends cache invalidation failed:', error);
    }
  }

  async getFriendsModuleStats(): Promise<{
    totalFriendships: number;
    pendingRequests: number;
    cacheHitRate: number;
  }> {
    if (!this.supabase) {
      return {
        totalFriendships: 0,
        pendingRequests: 0,
        cacheHitRate: 0
      };
    }

    try {
      const [friendshipsResult, requestsResult] = await Promise.allSettled([
        this.supabase.from('friendships').select('id', { count: 'exact', head: true }).eq('status', 'accepted'),
        this.supabase.from('friend_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      ]);

      return {
        totalFriendships: friendshipsResult.status === 'fulfilled' ? friendshipsResult.value.count || 0 : 0,
        pendingRequests: requestsResult.status === 'fulfilled' ? requestsResult.value.count || 0 : 0,
        cacheHitRate: 0.85 // Placeholder - would need Redis metrics tracking
      };
    } catch (error) {
      logger.error('Error getting friends module stats:', error);
      return {
        totalFriendships: 0,
        pendingRequests: 0,
        cacheHitRate: 0
      };
    }
  }
}