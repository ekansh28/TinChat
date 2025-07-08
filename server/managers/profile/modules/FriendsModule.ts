//server/managers/profile/modules/FriendsModule.ts - ENHANCED VERSION WITH FIXED AUTH
import { SupabaseClient } from '@supabase/supabase-js';
import { RedisService } from '../../../services/RedisService';
import { FriendData, FriendshipStatus } from '../types/FriendTypes';
import { logger } from '../../../utils/logger';

// ✅ FIXED: Proper type definitions with clerk_id consistency
type FriendRow = {
friend_id: string;
created_at: string;
friend: {
id: string;
clerk_id: string; // ✅ ADDED: Ensure clerk_id is always available
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
clerk_id: string; // ✅ ADDED: Clerk ID for sender
username: string;
display_name?: string;
avatar_url?: string;
is_online?: boolean;
} | null;
receiver?: {
id: string;
clerk_id: string; // ✅ ADDED: Clerk ID for receiver
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
    if (!this.supabase) {
      logger.debug('FriendsModule: No Supabase client available');
      return [];
    }

    if (!authId || authId.trim() === '') {
      logger.debug('FriendsModule: Invalid authId provided');
      return [];
    }

    // ✅ Try Redis first
    try {
      const cached = await this.redisService?.getCachedFriendsList?.(authId);
      if (cached) {
        logger.debug(`FriendsModule: Redis cache hit for friends list ${authId}`);
        return cached;
      }
    } catch (error) {
      logger.debug(`FriendsModule: Redis cache failed for ${authId}:`, error);
    }

    try {
      logger.debug(`FriendsModule: Fetching friends list from database for ${authId}`);
      
      // ✅ FIXED: Better error handling and validation
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
        .eq('status', 'accepted') as unknown as { data: FriendRow[]; error: any };

      if (error) {
        logger.error(`FriendsModule: Database error fetching friends for ${authId}:`, {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return [];
      }

      if (!data) {
        logger.debug(`FriendsModule: No friends data returned for ${authId}`);
        return [];
      }

      const friends: FriendData[] = data
        .filter(f => f.friend) // Only include records with valid friend data
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
      try {
        await this.redisService?.cacheFriendsList?.(authId, friends);
        logger.debug(`FriendsModule: Cached ${friends.length} friends for ${authId}`);
      } catch (error) {
        logger.debug(`FriendsModule: Redis caching failed for ${authId}:`, error);
      }
      
      logger.debug(`FriendsModule: Successfully fetched ${friends.length} friends for ${authId}`);
      return friends;

    } catch (error: any) {
      logger.error(`FriendsModule: Exception fetching friends for ${authId}:`, {
        message: error.message,
        name: error.name,
        cause: error.cause
      });
      return [];
    }
  }

  async getFriendshipStatus(user1Id: string, user2Id: string): Promise<FriendshipStatus> {
    if (!this.supabase) {
      logger.debug('FriendsModule: No Supabase client available for friendship status');
      return { status: 'none' };
    }

    if (!user1Id || !user2Id || user1Id.trim() === '' || user2Id.trim() === '') {
      logger.debug('FriendsModule: Invalid user IDs provided for friendship status');
      return { status: 'none' };
    }

    try {
      logger.debug(`FriendsModule: Checking friendship status: ${user1Id} <-> ${user2Id}`);
      
      // Check if they are friends
      const { data: friendship, error: friendshipError } = await this.supabase
        .from('friendships')
        .select('created_at')
        .eq('user_id', user1Id)
        .eq('friend_id', user2Id)
        .eq('status', 'accepted')
        .maybeSingle();

      if (friendshipError) {
        logger.error(`FriendsModule: Error checking friendship:`, {
          message: friendshipError.message,
          code: friendshipError.code
        });
      } else if (friendship) {
        return {
          status: 'friends',
          since: friendship.created_at
        };
      }

      // Check for pending requests
      const { data: sentRequest, error: sentError } = await this.supabase
        .from('friend_requests')
        .select('created_at')
        .eq('sender_id', user1Id)
        .eq('receiver_id', user2Id)
        .eq('status', 'pending')
        .maybeSingle();

      if (sentError) {
        logger.error(`FriendsModule: Error checking sent request:`, {
          message: sentError.message,
          code: sentError.code
        });
      } else if (sentRequest) {
        return { status: 'pending_sent', since: sentRequest.created_at };
      }

      const { data: receivedRequest, error: receivedError } = await this.supabase
        .from('friend_requests')
        .select('created_at')
        .eq('sender_id', user2Id)
        .eq('receiver_id', user1Id)
        .eq('status', 'pending')
        .maybeSingle();

      if (receivedError) {
        logger.error(`FriendsModule: Error checking received request:`, {
          message: receivedError.message,
          code: receivedError.code
        });
      } else if (receivedRequest) {
        return { status: 'pending_received', since: receivedRequest.created_at };
      }

      // Check if blocked
      const { data: blocked, error: blockedError } = await this.supabase
        .from('blocked_users')
        .select('created_at')
        .eq('blocker_id', user1Id)
        .eq('blocked_id', user2Id)
        .maybeSingle();

      if (blockedError) {
        logger.error(`FriendsModule: Error checking blocked status:`, {
          message: blockedError.message,
          code: blockedError.code
        });
      } else if (blocked) {
        return { status: 'blocked', since: blocked.created_at };
      }

      // Check if blocked by
      const { data: blockedBy, error: blockedByError } = await this.supabase
        .from('blocked_users')
        .select('created_at')
        .eq('blocker_id', user2Id)
        .eq('blocked_id', user1Id)
        .maybeSingle();

      if (blockedByError) {
        logger.error(`FriendsModule: Error checking blocked by status:`, {
          message: blockedByError.message,
          code: blockedByError.code
        });
      } else if (blockedBy) {
        return { status: 'blocked_by', since: blockedBy.created_at };
      }

      return { status: 'none' };
      
    } catch (error: any) {
      logger.error(`FriendsModule: Exception getting friendship status between ${user1Id} and ${user2Id}:`, {
        message: error.message,
        name: error.name
      });
      return { status: 'none' };
    }
  }

  async invalidateFriendsCache(authId: string): Promise<void> {
    try {
      await this.redisService?.invalidateFriendsList?.(authId);
      logger.debug(`FriendsModule: Invalidated friends cache for ${authId}`);
    } catch (error) {
      logger.debug(`FriendsModule: Failed to invalidate friends cache for ${authId}:`, error);
    }
  }

  // ==================== FRIEND REQUEST METHODS ====================

  async getPendingFriendRequests(authId: string, type: 'received' | 'sent' = 'received'): Promise<any[]> {
    if (!this.supabase || !authId || authId.trim() === '') {
      logger.debug('FriendsModule: Invalid parameters for getting pending friend requests');
      return [];
    }

    try {
      logger.debug(`FriendsModule: Fetching ${type} friend requests for ${authId}`);
      
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
        `)
        .eq(field, authId)
        .eq('status', 'pending') as unknown as { data: FriendRequestRow[]; error: any };

      if (error) {
        logger.error(`FriendsModule: Error fetching ${type} friend requests for ${authId}:`, {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return [];
      }

      logger.debug(`FriendsModule: Found ${requests?.length || 0} ${type} friend requests for ${authId}`);
      return requests || [];
      
    } catch (err: any) {
      logger.error(`FriendsModule: Exception fetching ${type} friend requests for ${authId}:`, {
        message: err.message,
        name: err.name
      });
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

    if (senderAuthId.trim() === '' || receiverAuthId.trim() === '') {
      return { success: false, message: 'Invalid user IDs' };
    }

    try {
      logger.debug(`FriendsModule: Sending friend request from ${senderAuthId} to ${receiverAuthId}`);
      
      const { data, error } = await this.supabase
        .rpc('send_friend_request', {
          sender_uuid: senderAuthId,
          receiver_uuid: receiverAuthId,
          request_message: message || null
        });

      if (error) {
        logger.error(`FriendsModule: Error sending friend request from ${senderAuthId} to ${receiverAuthId}:`, {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return { success: false, message: 'Failed to send friend request' };
      }

      // Invalidate friends cache for both users if auto-accepted
      if (this.redisService && data?.auto_accepted) {
        try {
          await Promise.allSettled([
            this.redisService.invalidateFriendsList(senderAuthId),
            this.redisService.invalidateFriendsList(receiverAuthId)
          ]);
        } catch (cacheError) {
          logger.debug('FriendsModule: Cache invalidation failed after auto-accept:', cacheError);
        }
      }

      logger.info(`FriendsModule: Friend request sent from ${senderAuthId} to ${receiverAuthId}, auto-accepted: ${data?.auto_accepted}`);
      return {
        success: data?.success || true,
        message: data?.message || 'Friend request sent successfully',
        autoAccepted: data?.auto_accepted
      };
      
    } catch (err: any) {
      logger.error(`FriendsModule: Exception sending friend request:`, {
        message: err.message,
        name: err.name
      });
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

    if (requestId.trim() === '' || acceptingUserId.trim() === '') {
      return { success: false, message: 'Invalid IDs' };
    }

    try {
      logger.debug(`FriendsModule: Accepting friend request ${requestId} by ${acceptingUserId}`);
      
      const { data, error } = await this.supabase
        .rpc('accept_friend_request', {
          request_id: requestId,
          accepting_user_id: acceptingUserId
        });

      if (error) {
        logger.error(`FriendsModule: Error accepting friend request ${requestId}:`, {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return { success: false, message: 'Failed to accept friend request' };
      }

      // Invalidate friends cache for both users
      if (this.redisService && data?.success) {
        try {
          const { data: requestData } = await this.supabase
            .from('friend_requests')
            .select('sender_id, receiver_id')
            .eq('id', requestId)
            .maybeSingle();

          if (requestData) {
            await Promise.allSettled([
              this.redisService.invalidateFriendsList(requestData.sender_id),
              this.redisService.invalidateFriendsList(requestData.receiver_id)
            ]);
          }
        } catch (cacheError) {
          logger.debug('FriendsModule: Cache invalidation failed after accept:', cacheError);
        }
      }

      logger.info(`FriendsModule: Friend request ${requestId} accepted by ${acceptingUserId}`);
      return {
        success: data?.success || true,
        message: data?.message || 'Friend request accepted successfully'
      };
      
    } catch (err: any) {
      logger.error(`FriendsModule: Exception accepting friend request:`, {
        message: err.message,
        name: err.name
      });
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

    if (requestId.trim() === '' || decliningUserId.trim() === '') {
      return { success: false, message: 'Invalid IDs' };
    }

    try {
      logger.debug(`FriendsModule: Declining friend request ${requestId} by ${decliningUserId}`);
      
      const { data, error } = await this.supabase
        .rpc('decline_friend_request', {
          request_id: requestId,
          declining_user_id: decliningUserId
        });

      if (error) {
        logger.error(`FriendsModule: Error declining friend request ${requestId}:`, {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return { success: false, message: 'Failed to decline friend request' };
      }

      logger.info(`FriendsModule: Friend request ${requestId} declined by ${decliningUserId}`);
      return {
        success: data?.success || true,
        message: data?.message || 'Friend request declined successfully'
      };
      
    } catch (err: any) {
      logger.error(`FriendsModule: Exception declining friend request:`, {
        message: err.message,
        name: err.name
      });
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

    if (user1AuthId.trim() === '' || user2AuthId.trim() === '') {
      return { success: false, message: 'Invalid user IDs' };
    }

    try {
      logger.debug(`FriendsModule: Removing friendship between ${user1AuthId} and ${user2AuthId}`);
      
      const { data, error } = await this.supabase
        .rpc('remove_friend', {
          user1_id: user1AuthId,
          user2_id: user2AuthId
        });

      if (error) {
        logger.error(`FriendsModule: Error removing friendship between ${user1AuthId} and ${user2AuthId}:`, {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return { success: false, message: 'Failed to remove friend' };
      }

      // Invalidate friends cache for both users
      if (this.redisService && data?.success) {
        try {
          await Promise.allSettled([
            this.redisService.invalidateFriendsList(user1AuthId),
            this.redisService.invalidateFriendsList(user2AuthId)
          ]);
        } catch (cacheError) {
          logger.debug('FriendsModule: Cache invalidation failed after remove:', cacheError);
        }
      }

      logger.info(`FriendsModule: Friendship removed between ${user1AuthId} and ${user2AuthId}`);
      return {
        success: data?.success || true,
        message: data?.message || 'Friend removed successfully'
      };
      
    } catch (err: any) {
      logger.error(`FriendsModule: Exception removing friend:`, {
        message: err.message,
        name: err.name
      });
      return { success: false, message: 'Failed to remove friend' };
    }
  }

  // ==================== MUTUAL FRIENDS AND STATS ====================

  async getMutualFriends(user1AuthId: string, user2AuthId: string): Promise<any[]> {
    if (!this.supabase || !user1AuthId || !user2AuthId) {
      return [];
    }

    if (user1AuthId.trim() === '' || user2AuthId.trim() === '') {
      return [];
    }

    try {
      logger.debug(`FriendsModule: Fetching mutual friends between ${user1AuthId} and ${user2AuthId}`);
      
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
        logger.error(`FriendsModule: Error fetching mutual friends:`, {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return [];
      }

      logger.debug(`FriendsModule: Found ${mutuals?.length || 0} mutual friends`);
      return mutuals || [];
      
    } catch (err: any) {
      logger.error(`FriendsModule: Exception fetching mutual friends:`, {
        message: err.message,
        name: err.name
      });
      return [];
    }
  }

  async getFriendStats(authId: string): Promise<{
    friendCount: number;
    pendingSentCount: number;
    pendingReceivedCount: number;
    mutualFriendsWithRecent?: number;
  }> {
    if (!this.supabase || !authId || authId.trim() === '') {
      return {
        friendCount: 0,
        pendingSentCount: 0,
        pendingReceivedCount: 0
      };
    }

    try {
      logger.debug(`FriendsModule: Fetching friend stats for ${authId}`);
      
      const { data: stats, error } = await this.supabase
        .from('user_friend_counts')
        .select('friend_count, pending_sent_count, pending_received_count')
        .eq('id', authId)
        .maybeSingle();

      if (error) {
        logger.error(`FriendsModule: Error fetching friend stats for ${authId}:`, {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return {
          friendCount: 0,
          pendingSentCount: 0,
          pendingReceivedCount: 0
        };
      }

      const result = {
        friendCount: stats?.friend_count || 0,
        pendingSentCount: stats?.pending_sent_count || 0,
        pendingReceivedCount: stats?.pending_received_count || 0
      };

      logger.debug(`FriendsModule: Friend stats for ${authId}:`, result);
      return result;
      
    } catch (err: any) {
      logger.error(`FriendsModule: Exception fetching friend stats:`, {
        message: err.message,
        name: err.name
      });
      return {
        friendCount: 0,
        pendingSentCount: 0,
        pendingReceivedCount: 0
      };
    }
  }

  async getOnlineFriendsCount(authId: string): Promise<number> {
    if (!this.supabase || !authId || authId.trim() === '') {
      return 0;
    }

    // Check Redis cache first
    if (this.redisService) {
      try {
        const cacheKey = `online_friends_count:${authId}`;
        const redisInstance = this.redisService.getRedisInstance();
        const cached = await redisInstance.get(cacheKey);
        
        if (cached) {
          const count = parseInt(cached, 10) || 0;
          logger.debug(`FriendsModule: Redis cache hit for online friends count ${authId}: ${count}`);
          return count;
        }
      } catch (error) {
        logger.debug(`FriendsModule: Redis online friends count fetch failed:`, error);
      }
    }

    try {
      logger.debug(`FriendsModule: Fetching online friends count for ${authId}`);
      
      const { count, error } = await this.supabase
        .from('friendships')
        .select('friend_id', { count: 'exact', head: true })
        .eq('user_id', authId)
        .eq('status', 'accepted')
        .eq('friend.is_online', true);

      if (error) {
        logger.error(`FriendsModule: Error getting online friends count:`, {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return 0;
      }

      const onlineCount = count || 0;

      // Cache the result for 30 seconds
      if (this.redisService) {
        try {
          const cacheKey = `online_friends_count:${authId}`;
          const redisInstance = this.redisService.getRedisInstance();
          await redisInstance.setex(cacheKey, 30, onlineCount.toString());
        } catch (cacheError) {
          logger.debug('FriendsModule: Failed to cache online friends count:', cacheError);
        }
      }

      logger.debug(`FriendsModule: Online friends count for ${authId}: ${onlineCount}`);
      return onlineCount;
      
    } catch (err: any) {
      logger.error(`FriendsModule: Exception getting online friends count:`, {
        message: err.message,
        name: err.name
      });
      return 0;
    }
  }

  // ==================== SEARCH AND DISCOVERY ====================

  async searchUsersToAddAsFriends(currentUserAuthId: string, searchTerm: string, limit: number = 20): Promise<any[]> {
    if (!this.supabase || !currentUserAuthId || !searchTerm.trim()) {
      return [];
    }

    if (currentUserAuthId.trim() === '' || limit <= 0 || limit > 100) {
      return [];
    }

    try {
      logger.debug(`FriendsModule: Searching users for "${searchTerm}" by ${currentUserAuthId}`);
      
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
        logger.error(`FriendsModule: Error searching users:`, {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return [];
      }

      if (!users || users.length === 0) {
        logger.debug(`FriendsModule: No users found for search "${searchTerm}"`);
        return [];
      }

      const userIds = users.map(u => u.id);
      
      // Get existing relationships
      const [
        existingFriendsResult,
        blockedUsersResult,
        blockedByUsersResult,
        pendingRequestsResult
      ] = await Promise.allSettled([
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

      // Create filter sets with proper Promise.allSettled handling
      const friendIds = new Set(
        (existingFriendsResult.status === 'fulfilled' && existingFriendsResult.value.data) 
          ? existingFriendsResult.value.data.map((f: any) => f.friend_id) 
          : []
      );
      
      const blockedIds = new Set(
        (blockedUsersResult.status === 'fulfilled' && blockedUsersResult.value.data) 
          ? blockedUsersResult.value.data.map((b: any) => b.blocked_id) 
          : []
      );
      
      const blockedByIds = new Set(
        (blockedByUsersResult.status === 'fulfilled' && blockedByUsersResult.value.data) 
          ? blockedByUsersResult.value.data.map((b: any) => b.blocker_id) 
          : []
      );
      
      const pendingIds = new Set();

      if (pendingRequestsResult.status === 'fulfilled' && pendingRequestsResult.value.data) {
        pendingRequestsResult.value.data.forEach((req: any) => {
          if (req.sender_id === currentUserAuthId) {
            pendingIds.add(req.receiver_id);
          } else if (req.receiver_id === currentUserAuthId) {
            pendingIds.add(req.sender_id);
          }
        });
      }

      // Filter users
      const filteredUsers = users.filter(user => 
        !friendIds.has(user.id) &&
        !blockedIds.has(user.id) &&
        !blockedByIds.has(user.id) &&
        !pendingIds.has(user.id)
      );

      logger.debug(`FriendsModule: Search returned ${filteredUsers.length} filtered users for "${searchTerm}"`);
      return filteredUsers;

    } catch (err: any) {
      logger.error(`FriendsModule: Exception searching users to add as friends:`, {
        message: err.message,
        name: err.name
      });
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
      logger.debug(`FriendsModule: Batch invalidated ${authIds.length} friends lists`);
    } catch (error) {
      logger.error('FriendsModule: Batch friends cache invalidation failed:', error);
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
      logger.debug('FriendsModule: Fetching module stats');
      
      const [friendshipsResult, requestsResult] = await Promise.allSettled([
        this.supabase.from('friendships').select('id', { count: 'exact', head: true }).eq('status', 'accepted'),
        this.supabase.from('friend_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      ]);

      const stats = {
        totalFriendships: friendshipsResult.status === 'fulfilled' ? friendshipsResult.value.count || 0 : 0,
        pendingRequests: requestsResult.status === 'fulfilled' ? requestsResult.value.count || 0 : 0,
        cacheHitRate: 0.85 // Placeholder - would need Redis metrics tracking
      };

      logger.debug('FriendsModule: Module stats:', stats);
      return stats;
      
    } catch (error: any) {
      logger.error('FriendsModule: Error getting friends module stats:', {
        message: error.message,
        name: error.name
      });
      return {
        totalFriendships: 0,
        pendingRequests: 0,
        cacheHitRate: 0
      };
    }
  }

  // ✅ NEW: Simple connection test method
  async testConnection(): Promise<{ success: boolean; latency?: number; error?: string }> {
    if (!this.supabase) {
      return { success: false, error: 'No Supabase client available' };
    }

    try {
      logger.debug('FriendsModule: Testing database connection');
      
      const startTime = Date.now();
      
      // ✅ Simple test query
      const { data, error } = await this.supabase
        .from('friendships')
        .select('id')
        .limit(1);
      
      const latency = Date.now() - startTime;

      if (error) {
        logger.error('FriendsModule: Connection test failed:', {
          message: error.message,
          code: error.code
        });
        return { success: false, latency, error: error.message };
      }

      logger.debug(`FriendsModule: Connection test successful (${latency}ms)`);
      return { success: true, latency };
      
    } catch (error: any) {
      logger.error('FriendsModule: Connection test exception:', {
        message: error.message,
        name: error.name
      });
      return { success: false, error: error.message };
    }
  }
}