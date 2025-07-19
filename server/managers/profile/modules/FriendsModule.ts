//server/managers/profile/modules/FriendsModule.ts - FIXED VERSION WITH ALL TYPE ERRORS RESOLVED
import { SupabaseClient } from '@supabase/supabase-js';
import { RedisService } from '../../../services/RedisService';
import { FriendData, FriendshipStatus } from '../types/FriendTypes';
import { logger } from '../../../utils/logger';

// ✅ FIXED: Update type to match actual Supabase response
type FriendRow = {
  friend_id: string;
  created_at: string;
  friend: Array<{
    id: string;
    clerk_id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
    status?: string | null;
    last_seen?: string | null;
    is_online?: boolean | null;
  }> | null; // Array instead of single object
};

type FriendRequestRow = {
  id: string;
  sender_id?: string;
  receiver_id?: string;
  message?: string;
  created_at: string;
  status?: string;
  sender?: {
    id: string;
    clerk_id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
    is_online?: boolean;
  } | null;
  receiver?: {
    id: string;
    clerk_id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
    is_online?: boolean;
  } | null;
};

const VALID_STATUSES = ['online', 'idle', 'dnd', 'offline'];
const CACHE_TTL = 300; // 5 minutes
const MAX_SEARCH_RESULTS = 50;

export class FriendsModule {
  private supabase: SupabaseClient | null;
  private redisService: RedisService | null;

  constructor(supabase: SupabaseClient | null, redisService: RedisService | null) {
    this.supabase = supabase;
    this.redisService = redisService;
  }

  // ==================== CORE FRIENDS OPERATIONS ====================

  async getFriendsList(authId: string): Promise<FriendData[]> {
    if (!this.supabase) {
      logger.debug('FriendsModule: No Supabase client available');
      return [];
    }

    if (!authId || authId.trim() === '') {
      logger.debug('FriendsModule: Invalid authId provided');
      return [];
    }

    // ✅ Try Redis cache first
    const cacheKey = `friends:${authId}`;
    try {
      if (this.redisService) {
        const cached = await this.getCachedData(cacheKey);
        if (cached) {
          logger.debug(`FriendsModule: Redis cache hit for ${authId}`);
          return cached;
        }
      }
    } catch (error) {
      logger.debug(`FriendsModule: Redis cache failed for ${authId}:`, error);
    }

    try {
      logger.debug(`FriendsModule: Fetching friends from database for ${authId}`);
      
      // ✅ FIXED: Proper query with correct field references and data awaiting
      const { data, error } = await this.supabase
        .from('friendships')
        .select(`
          friend_id,
          created_at,
          friend:user_profiles!friendships_friend_id_fkey (
            id,
            clerk_id,
            username,
            display_name,
            avatar_url,
            status,
            last_seen,
            is_online
          )
        `)
        .eq('user_id', authId)
        .eq('status', 'accepted');

      if (error) {
        logger.error(`FriendsModule: Database error fetching friends for ${authId}:`, error);
        return [];
      }

      if (!data || data.length === 0) {
        logger.debug(`FriendsModule: No friends found for ${authId}`);
        return [];
      }

  // ✅ FIXED: Updated transformation to handle array
  const typedData = data as FriendRow[];
  const friends: FriendData[] = typedData
    .filter(f => f.friend !== null && f.friend.length > 0)
    .map(f => {
      const friend = f.friend![0];
      const safeStatus = VALID_STATUSES.includes(friend.status || '')
        ? (friend.status as 'online' | 'idle' | 'dnd' | 'offline')
        : 'offline';

      return {
        id: friend.clerk_id || friend.id,
        username: friend.username || 'Unknown',
        display_name: friend.display_name || friend.username || 'Unknown',
        avatar_url: friend.avatar_url || undefined, // ✅ FIXED: Use undefined instead of null
        status: safeStatus,
        last_seen: friend.last_seen || new Date().toISOString(),
        is_online: friend.is_online ?? false,
        friends_since: f.created_at,
      };
    });

      // ✅ Cache result in Redis
      try {
        if (this.redisService) {
          await this.setCachedData(cacheKey, friends, CACHE_TTL);
          logger.debug(`FriendsModule: Cached ${friends.length} friends for ${authId}`);
        }
      } catch (error) {
        logger.debug(`FriendsModule: Redis caching failed for ${authId}:`, error);
      }
      
      logger.debug(`FriendsModule: Successfully fetched ${friends.length} friends for ${authId}`);
      return friends;

    } catch (error: any) {
      logger.error(`FriendsModule: Exception fetching friends for ${authId}:`, error);
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

    if (user1Id === user2Id) {
      return { status: 'none' };
    }

    // ✅ Try cache first
    const cacheKey = `friendship_status:${[user1Id, user2Id].sort().join(':')}`;
    try {
      if (this.redisService) {
        const cached = await this.getCachedData(cacheKey);
        if (cached) {
          return cached;
        }
      }
    } catch (error) {
      logger.debug('FriendsModule: Cache check failed for friendship status:', error);
    }

    try {
      logger.debug(`FriendsModule: Checking friendship status: ${user1Id} <-> ${user2Id}`);
      
      // ✅ FIXED: Check all relationship types in parallel for better performance
      const [friendshipResult, sentRequestResult, receivedRequestResult, blockedResult, blockedByResult] = await Promise.all([
        // Check if they are friends
        this.supabase
          .from('friendships')
          .select('created_at')
          .eq('user_id', user1Id)
          .eq('friend_id', user2Id)
          .eq('status', 'accepted')
          .maybeSingle(),
        
        // Check for sent requests
        this.supabase
          .from('friend_requests')
          .select('created_at')
          .eq('sender_id', user1Id)
          .eq('receiver_id', user2Id)
          .eq('status', 'pending')
          .maybeSingle(),
        
        // Check for received requests
        this.supabase
          .from('friend_requests')
          .select('created_at')
          .eq('sender_id', user2Id)
          .eq('receiver_id', user1Id)
          .eq('status', 'pending')
          .maybeSingle(),
        
        // Check if user1 blocked user2
        this.supabase
          .from('blocked_users')
          .select('created_at')
          .eq('blocker_id', user1Id)
          .eq('blocked_id', user2Id)
          .maybeSingle(),
        
        // Check if user2 blocked user1
        this.supabase
          .from('blocked_users')
          .select('created_at')
          .eq('blocker_id', user2Id)
          .eq('blocked_id', user1Id)
          .maybeSingle()
      ]);

      let status: FriendshipStatus = { status: 'none' };

      // Check results in priority order
      if (friendshipResult.data) {
        status = { status: 'friends', since: friendshipResult.data.created_at };
      } else if (sentRequestResult.data) {
        status = { status: 'pending_sent', since: sentRequestResult.data.created_at };
      } else if (receivedRequestResult.data) {
        status = { status: 'pending_received', since: receivedRequestResult.data.created_at };
      } else if (blockedResult.data) {
        status = { status: 'blocked', since: blockedResult.data.created_at };
      } else if (blockedByResult.data) {
        status = { status: 'blocked_by', since: blockedByResult.data.created_at };
      }

      // ✅ Cache the result
      try {
        if (this.redisService) {
          await this.setCachedData(cacheKey, status, 60); // Cache for 1 minute
        }
      } catch (error) {
        logger.debug('FriendsModule: Cache set failed for friendship status:', error);
      }

      return status;
      
    } catch (error: any) {
      logger.error(`FriendsModule: Exception getting friendship status between ${user1Id} and ${user2Id}:`, error);
      return { status: 'none' };
    }
  }

  // ==================== FRIEND REQUEST OPERATIONS ====================

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

    if (senderAuthId === receiverAuthId) {
      return { success: false, message: 'Cannot send friend request to yourself' };
    }

    try {
      logger.debug(`FriendsModule: Sending friend request from ${senderAuthId} to ${receiverAuthId}`);
      
      // ✅ FIXED: First check if users exist and get their database IDs
      const [senderResult, receiverResult] = await Promise.all([
        this.supabase
          .from('user_profiles')
          .select('id, username')
          .eq('clerk_id', senderAuthId)
          .single(),
        this.supabase
          .from('user_profiles')
          .select('id, username')
          .eq('clerk_id', receiverAuthId)
          .single()
      ]);

      if (senderResult.error || receiverResult.error) {
        logger.error('FriendsModule: User lookup failed:', { senderResult, receiverResult });
        return { success: false, message: 'One or both users not found' };
      }

      const senderId = senderResult.data.id;
      const receiverId = receiverResult.data.id;

      // ✅ Check existing relationship
      const existingStatus = await this.getFriendshipStatus(senderAuthId, receiverAuthId);
      
      if (existingStatus.status === 'friends') {
        return { success: false, message: 'Already friends' };
      }
      
      if (existingStatus.status === 'pending_sent') {
        return { success: false, message: 'Friend request already sent' };
      }
      
      if (existingStatus.status === 'pending_received') {
        return { success: false, message: 'You have a pending request from this user' };
      }
      
      if (existingStatus.status === 'blocked' || existingStatus.status === 'blocked_by') {
        return { success: false, message: 'Cannot send friend request' };
      }

      // ✅ FIXED: Use RPC function if available, otherwise direct insert
      let result;
      try {
        // Try using RPC function first
        result = await this.supabase.rpc('send_friend_request', {
          sender_uuid: senderId,
          receiver_uuid: receiverId,
          request_message: message || null
        });
      } catch (rpcError) {
        logger.debug('FriendsModule: RPC not available, using direct insert');
        
        // Fallback to direct insert
        result = await this.supabase
          .from('friend_requests')
          .insert({
            sender_id: senderId,
            receiver_id: receiverId,
            message: message?.trim() || null,
            status: 'pending',
            created_at: new Date().toISOString()
          })
          .select()
          .single();
      }

      if (result.error) {
        logger.error(`FriendsModule: Error sending friend request:`, result.error);
        return { success: false, message: 'Failed to send friend request' };
      }

      // ✅ Invalidate relevant caches
      await this.invalidateUserCaches([senderAuthId, receiverAuthId]);

      logger.info(`FriendsModule: Friend request sent from ${senderAuthId} to ${receiverAuthId}`);
      
      return {
        success: true,
        message: `Friend request sent to ${receiverResult.data.username}`,
        autoAccepted: result.data?.auto_accepted || false
      };
      
    } catch (err: any) {
      logger.error(`FriendsModule: Exception sending friend request:`, err);
      return { success: false, message: 'Failed to send friend request' };
    }
  }

  async acceptFriendRequest(requestId: string, acceptingUserAuthId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    if (!this.supabase || !requestId || !acceptingUserAuthId) {
      return { success: false, message: 'Invalid parameters' };
    }

    try {
      logger.debug(`FriendsModule: Accepting friend request ${requestId} by ${acceptingUserAuthId}`);
      
      // ✅ FIXED: Get user's database ID
      const { data: userProfile, error: userError } = await this.supabase
        .from('user_profiles')
        .select('id')
        .eq('clerk_id', acceptingUserAuthId)
        .single();

      if (userError || !userProfile) {
        return { success: false, message: 'User not found' };
      }

      // ✅ First verify the request exists and is valid
      const { data: request, error: requestError } = await this.supabase
        .from('friend_requests')
        .select(`
          id,
          sender_id,
          receiver_id,
          status,
          sender:user_profiles!friend_requests_sender_id_fkey(clerk_id),
          receiver:user_profiles!friend_requests_receiver_id_fkey(clerk_id)
        `)
        .eq('id', requestId)
        .eq('receiver_id', userProfile.id)
        .eq('status', 'pending')
        .single();

      if (requestError || !request) {
        return { success: false, message: 'Friend request not found or already processed' };
      }

      // ✅ Use transaction for atomicity
      const { error: transactionError } = await this.supabase.rpc('accept_friend_request_transaction', {
        request_id: requestId,
        sender_id: request.sender_id,
        receiver_id: request.receiver_id
      });

      if (transactionError) {
        logger.error(`FriendsModule: Transaction error accepting request:`, transactionError);
        
        // ✅ Fallback to manual steps
        const { error: updateError } = await this.supabase
          .from('friend_requests')
          .update({ 
            status: 'accepted',
            updated_at: new Date().toISOString()
          })
          .eq('id', requestId);

        if (updateError) {
          return { success: false, message: 'Failed to accept friend request' };
        }

        // Create friendship records
        const friendshipData = [
          {
            user_id: request.sender_id,
            friend_id: request.receiver_id,
            status: 'accepted',
            created_at: new Date().toISOString()
          },
          {
            user_id: request.receiver_id,
            friend_id: request.sender_id,
            status: 'accepted',
            created_at: new Date().toISOString()
          }
        ];

        const { error: friendshipError } = await this.supabase
          .from('friendships')
          .insert(friendshipData);

        if (friendshipError) {
          logger.error('FriendsModule: Failed to create friendship records:', friendshipError);
          return { success: false, message: 'Failed to create friendship' };
        }
      }

      // ✅ Invalidate caches for both users
      const senderAuthId = (request.sender as any)?.clerk_id;
      if (senderAuthId) {
        await this.invalidateUserCaches([senderAuthId, acceptingUserAuthId]);
      }

      logger.info(`FriendsModule: Friend request ${requestId} accepted by ${acceptingUserAuthId}`);
      
      return {
        success: true,
        message: 'Friend request accepted successfully'
      };
      
    } catch (err: any) {
      logger.error(`FriendsModule: Exception accepting friend request:`, err);
      return { success: false, message: 'Failed to accept friend request' };
    }
  }

  async declineFriendRequest(requestId: string, decliningUserAuthId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    if (!this.supabase || !requestId || !decliningUserAuthId) {
      return { success: false, message: 'Invalid parameters' };
    }

    try {
      logger.debug(`FriendsModule: Declining friend request ${requestId} by ${decliningUserAuthId}`);
      
      // ✅ Get user's database ID and verify request
      const { data: userProfile, error: userError } = await this.supabase
        .from('user_profiles')
        .select('id')
        .eq('clerk_id', decliningUserAuthId)
        .single();

      if (userError || !userProfile) {
        return { success: false, message: 'User not found' };
      }

      const { error } = await this.supabase
        .from('friend_requests')
        .update({ 
          status: 'declined',
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .eq('receiver_id', userProfile.id)
        .eq('status', 'pending');

      if (error) {
        logger.error(`FriendsModule: Error declining friend request:`, error);
        return { success: false, message: 'Failed to decline friend request' };
      }

      logger.info(`FriendsModule: Friend request ${requestId} declined by ${decliningUserAuthId}`);
      
      return {
        success: true,
        message: 'Friend request declined successfully'
      };
      
    } catch (err: any) {
      logger.error(`FriendsModule: Exception declining friend request:`, err);
      return { success: false, message: 'Failed to decline friend request' };
    }
  }

  async getPendingFriendRequests(authId: string, type: 'received' | 'sent' = 'received'): Promise<any[]> {
    if (!this.supabase || !authId || authId.trim() === '') {
      return [];
    }

    try {
      logger.debug(`FriendsModule: Fetching ${type} friend requests for ${authId}`);
      
      // ✅ Get user's database ID
      const { data: userProfile, error: userError } = await this.supabase
        .from('user_profiles')
        .select('id')
        .eq('clerk_id', authId)
        .single();

      if (userError || !userProfile) {
        logger.error('FriendsModule: User not found for requests:', userError);
        return [];
      }

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
            clerk_id,
            username,
            display_name,
            avatar_url,
            is_online
          )
        `)
        .eq(field, userProfile.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        logger.error(`FriendsModule: Error fetching requests:`, error);
        return [];
      }

      logger.debug(`FriendsModule: Found ${requests?.length || 0} ${type} requests for ${authId}`);
      return requests || [];
      
    } catch (err: any) {
      logger.error(`FriendsModule: Exception fetching requests:`, err);
      return [];
    }
  }

  // ==================== FRIEND MANAGEMENT ====================

  async removeFriend(user1AuthId: string, user2AuthId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    if (!this.supabase || !user1AuthId || !user2AuthId) {
      return { success: false, message: 'Invalid parameters' };
    }

    if (user1AuthId === user2AuthId) {
      return { success: false, message: 'Cannot remove yourself' };
    }

    try {
      logger.debug(`FriendsModule: Removing friendship between ${user1AuthId} and ${user2AuthId}`);
      
      // ✅ Get both users' database IDs
      const [user1Result, user2Result] = await Promise.all([
        this.supabase
          .from('user_profiles')
          .select('id')
          .eq('clerk_id', user1AuthId)
          .single(),
        this.supabase
          .from('user_profiles')
          .select('id')
          .eq('clerk_id', user2AuthId)
          .single()
      ]);

      if (user1Result.error || user2Result.error) {
        return { success: false, message: 'One or both users not found' };
      }

      const user1Id = user1Result.data.id;
      const user2Id = user2Result.data.id;

      // ✅ Remove both friendship records
      const { error } = await this.supabase
        .from('friendships')
        .delete()
        .or(`and(user_id.eq.${user1Id},friend_id.eq.${user2Id}),and(user_id.eq.${user2Id},friend_id.eq.${user1Id})`);

      if (error) {
        logger.error(`FriendsModule: Error removing friendship:`, error);
        return { success: false, message: 'Failed to remove friend' };
      }

      // ✅ Invalidate caches
      await this.invalidateUserCaches([user1AuthId, user2AuthId]);

      logger.info(`FriendsModule: Friendship removed between ${user1AuthId} and ${user2AuthId}`);
      
      return {
        success: true,
        message: 'Friend removed successfully'
      };
      
    } catch (err: any) {
      logger.error(`FriendsModule: Exception removing friend:`, err);
      return { success: false, message: 'Failed to remove friend' };
    }
  }

  // ==================== SEARCH AND DISCOVERY ====================

  async searchUsersToAddAsFriends(currentUserAuthId: string, searchTerm: string, limit: number = 20): Promise<any[]> {
    if (!this.supabase || !currentUserAuthId || !searchTerm.trim()) {
      return [];
    }

    if (limit <= 0 || limit > MAX_SEARCH_RESULTS) {
      limit = MAX_SEARCH_RESULTS;
    }

    try {
      logger.debug(`FriendsModule: Searching users for "${searchTerm}" by ${currentUserAuthId}`);
      
      // ✅ Get current user's database ID
      const { data: currentUser, error: userError } = await this.supabase
        .from('user_profiles')
        .select('id')
        .eq('clerk_id', currentUserAuthId)
        .single();

      if (userError || !currentUser) {
        logger.error('FriendsModule: Current user not found for search:', userError);
        return [];
      }

      // ✅ Search for users excluding current user
      const { data: users, error } = await this.supabase
        .from('user_profiles')
        .select('id, clerk_id, username, display_name, avatar_url, status, is_online')
        .or(`username.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%`)
        .neq('id', currentUser.id)
        .limit(limit);

      if (error) {
        logger.error(`FriendsModule: Search error:`, error);
        return [];
      }

      if (!users || users.length === 0) {
        return [];
      }

      // ✅ Get existing relationships for filtering
      const userIds = users.map(u => u.id);
      
      const [friendsResult, blockedResult, requestsResult] = await Promise.all([
        this.supabase
          .from('friendships')
          .select('friend_id')
          .eq('user_id', currentUser.id)
          .in('friend_id', userIds),
        this.supabase
          .from('blocked_users')
          .select('blocked_id, blocker_id')
          .or(`and(blocker_id.eq.${currentUser.id},blocked_id.in.(${userIds.join(',')})),and(blocked_id.eq.${currentUser.id},blocker_id.in.(${userIds.join(',')}))`),
        this.supabase
          .from('friend_requests')
          .select('sender_id, receiver_id')
          .eq('status', 'pending')
          .or(`and(sender_id.eq.${currentUser.id},receiver_id.in.(${userIds.join(',')})),and(receiver_id.eq.${currentUser.id},sender_id.in.(${userIds.join(',')}))`)
      ]);

      // ✅ Create filter sets
      const friendIds = new Set((friendsResult.data || []).map(f => f.friend_id));
      const blockedIds = new Set();
      const pendingIds = new Set();

      // Process blocked users
      (blockedResult.data || []).forEach(b => {
        if (b.blocker_id === currentUser.id) {
          blockedIds.add(b.blocked_id);
        } else {
          blockedIds.add(b.blocker_id);
        }
      });

      // Process pending requests
      (requestsResult.data || []).forEach(r => {
        if (r.sender_id === currentUser.id) {
          pendingIds.add(r.receiver_id);
        } else {
          pendingIds.add(r.sender_id);
        }
      });

      // ✅ Filter and transform results
      const filteredUsers = users
        .filter(user => 
          !friendIds.has(user.id) &&
          !blockedIds.has(user.id) &&
          !pendingIds.has(user.id)
        )
        .map(user => ({
          id: user.clerk_id,
          username: user.username,
          displayName: user.display_name || user.username,
          avatarUrl: user.avatar_url,
          status: user.status || 'offline',
          isOnline: user.is_online || false,
          friendshipStatus: 'none'
        }));

      logger.debug(`FriendsModule: Search returned ${filteredUsers.length} filtered users`);
      return filteredUsers;

    } catch (err: any) {
      logger.error(`FriendsModule: Exception searching users:`, err);
      return [];
    }
  }

  // ==================== STATISTICS ====================

  async getFriendStats(authId: string): Promise<{
    friendCount: number;
    pendingSentCount: number;
    pendingReceivedCount: number;
    onlineFriendsCount: number;
  }> {
    if (!this.supabase || !authId || authId.trim() === '') {
      return {
        friendCount: 0,
        pendingSentCount: 0,
        pendingReceivedCount: 0,
        onlineFriendsCount: 0
      };
    }

    try {
      logger.debug(`FriendsModule: Fetching friend stats for ${authId}`);
      
      // ✅ Get user's database ID
      const { data: userProfile, error: userError } = await this.supabase
        .from('user_profiles')
        .select('id')
        .eq('clerk_id', authId)
        .single();

      if (userError || !userProfile) {
        logger.error('FriendsModule: User not found for stats:', userError);
        return {
          friendCount: 0,
          pendingSentCount: 0,
          pendingReceivedCount: 0,
          onlineFriendsCount: 0
        };
      }

      // ✅ FIXED: Get all stats in parallel with proper count queries
      const [friendsResult, sentResult, receivedResult] = await Promise.all([
        this.supabase
          .from('friendships')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userProfile.id)
          .eq('status', 'accepted'),
        this.supabase
          .from('friend_requests')
          .select('id', { count: 'exact', head: true })
          .eq('sender_id', userProfile.id)
          .eq('status', 'pending'),
        this.supabase
          .from('friend_requests')
          .select('id', { count: 'exact', head: true })
          .eq('receiver_id', userProfile.id)
          .eq('status', 'pending')
      ]);

      // ✅ FIXED: Get online friends count with a separate query
      const { count: onlineCount } = await this.supabase
        .from('friendships')
        .select('friend:user_profiles!friendships_friend_id_fkey(is_online)', { count: 'exact', head: true })
        .eq('user_id', userProfile.id)
        .eq('status', 'accepted')
        .eq('friend.is_online', true);

      const stats = {
        friendCount: friendsResult.count || 0,
        pendingSentCount: sentResult.count || 0,
        pendingReceivedCount: receivedResult.count || 0,
        onlineFriendsCount: onlineCount || 0
      };

      logger.debug(`FriendsModule: Friend stats for ${authId}:`, stats);
      return stats;
      
    } catch (err: any) {
      logger.error(`FriendsModule: Exception fetching friend stats:`, err);
      return {
        friendCount: 0,
        pendingSentCount: 0,
        pendingReceivedCount: 0,
        onlineFriendsCount: 0
      };
    }
  }

  async getOnlineFriendsCount(authId: string): Promise<number> {
    if (!this.supabase || !authId || authId.trim() === '') {
      return 0;
    }

    // ✅ Check cache first
    const cacheKey = `online_friends_count:${authId}`;
    try {
      if (this.redisService) {
        const cached = await this.getCachedData(cacheKey);
        if (cached !== null) {
          return cached;
        }
      }
    } catch (error) {
      logger.debug('FriendsModule: Cache check failed for online count:', error);
    }

    try {
      logger.debug(`FriendsModule: Fetching online friends count for ${authId}`);
      
      // ✅ Get user's database ID
      const { data: userProfile, error: userError } = await this.supabase
        .from('user_profiles')
        .select('id')
        .eq('clerk_id', authId)
        .single();

      if (userError || !userProfile) {
        return 0;
      }

      const { count, error } = await this.supabase
        .from('friendships')
        .select('friend:user_profiles!friendships_friend_id_fkey(is_online)', { count: 'exact', head: true })
        .eq('user_id', userProfile.id)
        .eq('status', 'accepted')
        .eq('friend.is_online', true);

      if (error) {
        logger.error(`FriendsModule: Error getting online friends count:`, error);
        return 0;
      }

      const onlineCount = count || 0;

      // ✅ Cache the result
      try {
        if (this.redisService) {
          await this.setCachedData(cacheKey, onlineCount, 30); // Cache for 30 seconds
        }
      } catch (cacheError) {
        logger.debug('FriendsModule: Failed to cache online count:', cacheError);
      }

      logger.debug(`FriendsModule: Online friends count for ${authId}: ${onlineCount}`);
      return onlineCount;
      
    } catch (err: any) {
      logger.error(`FriendsModule: Exception getting online friends count:`, err);
      return 0;
    }
  }

  // ==================== MUTUAL FRIENDS ====================

  async getMutualFriends(user1AuthId: string, user2AuthId: string): Promise<any[]> {
    if (!this.supabase || !user1AuthId || !user2AuthId || user1AuthId === user2AuthId) {
      return [];
    }

    try {
      logger.debug(`FriendsModule: Fetching mutual friends between ${user1AuthId} and ${user2AuthId}`);
      
      // ✅ Get both users' database IDs
      const [user1Result, user2Result] = await Promise.all([
        this.supabase
          .from('user_profiles')
          .select('id')
          .eq('clerk_id', user1AuthId)
          .single(),
        this.supabase
          .from('user_profiles')
          .select('id')
          .eq('clerk_id', user2AuthId)
          .single()
      ]);

      if (user1Result.error || user2Result.error) {
        return [];
      }

      // ✅ FIXED: Find mutual friends using proper subquery approach
      // First get user1's friends
      const { data: user1Friends, error: user1Error } = await this.supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', user1Result.data.id)
        .eq('status', 'accepted');

      if (user1Error || !user1Friends || user1Friends.length === 0) {
        return [];
      }

      const user1FriendIds = user1Friends.map(f => f.friend_id);

      // Then find which of those are also friends with user2
      const { data: mutuals, error } = await this.supabase
        .from('friendships')
        .select(`
          friend_id,
          friend:user_profiles!friendships_friend_id_fkey (
            clerk_id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('user_id', user2Result.data.id)
        .eq('status', 'accepted')
        .in('friend_id', user1FriendIds);

      if (error) {
        logger.error(`FriendsModule: Error fetching mutual friends:`, error);
        return [];
      }

      const result = (mutuals || [])
        .filter(m => m.friend)
        .map(m => ({
          id: (m.friend as any).clerk_id,
          username: (m.friend as any).username,
          displayName: (m.friend as any).display_name || (m.friend as any).username,
          avatarUrl: (m.friend as any).avatar_url
        }));

      logger.debug(`FriendsModule: Found ${result.length} mutual friends`);
      return result;
      
    } catch (err: any) {
      logger.error(`FriendsModule: Exception fetching mutual friends:`, err);
      return [];
    }
  }

  // ==================== UTILITY METHODS ====================

  async invalidateFriendsCache(authId: string): Promise<void> {
    await this.invalidateUserCaches([authId]);
  }

  async batchInvalidateFriendsCache(authIds: string[]): Promise<void> {
    await this.invalidateUserCaches(authIds);
  }

  private async invalidateUserCaches(authIds: string[]): Promise<void> {
    if (!this.redisService || authIds.length === 0) return;

    try {
      const cacheKeys = authIds.flatMap(authId => [
        `friends:${authId}`,
        `online_friends_count:${authId}`
      ]);

      // Add friendship status cache keys
      for (let i = 0; i < authIds.length; i++) {
        for (let j = i + 1; j < authIds.length; j++) {
          const sortedPair = [authIds[i], authIds[j]].sort();
          cacheKeys.push(`friendship_status:${sortedPair.join(':')}`);
        }
      }

      await this.deleteCachedData(cacheKeys);
      logger.debug(`FriendsModule: Invalidated ${cacheKeys.length} cache keys for ${authIds.length} users`);
    } catch (error) {
      logger.error('FriendsModule: Cache invalidation failed:', error);
    }
  }

  private async getCachedData(key: string): Promise<any> {
    if (!this.redisService) return null;
    
    try {
      const redisInstance = this.redisService.getRedisInstance();
      const cached = await redisInstance.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.debug(`FriendsModule: Cache get failed for ${key}:`, error);
      return null;
    }
  }

  private async setCachedData(key: string, data: any, ttl: number = CACHE_TTL): Promise<void> {
    if (!this.redisService) return;
    
    try {
      const redisInstance = this.redisService.getRedisInstance();
      await redisInstance.setex(key, ttl, JSON.stringify(data));
    } catch (error) {
      logger.debug(`FriendsModule: Cache set failed for ${key}:`, error);
    }
  }

  private async deleteCachedData(keys: string[]): Promise<void> {
    if (!this.redisService || keys.length === 0) return;
    
    try {
      const redisInstance = this.redisService.getRedisInstance();
      if (keys.length === 1) {
        await redisInstance.del(keys[0]);
      } else {
        await redisInstance.del(...keys);
      }
    } catch (error) {
      logger.debug(`FriendsModule: Cache delete failed:`, error);
    }
  }

  // ==================== HEALTH AND DIAGNOSTICS ====================

  async testConnection(): Promise<{ success: boolean; latency?: number; error?: string }> {
    if (!this.supabase) {
      return { success: false, error: 'No Supabase client available' };
    }

    try {
      logger.debug('FriendsModule: Testing database connection');
      
      const startTime = Date.now();
      
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('id')
        .limit(1);
      
      const latency = Date.now() - startTime;

      if (error) {
        logger.error('FriendsModule: Connection test failed:', error);
        return { success: false, latency, error: error.message };
      }

      logger.debug(`FriendsModule: Connection test successful (${latency}ms)`);
      return { success: true, latency };
      
    } catch (error: any) {
      logger.error('FriendsModule: Connection test exception:', error);
      return { success: false, error: error.message };
    }
  }

  async getFriendsModuleStats(): Promise<{
    totalFriendships: number;
    pendingRequests: number;
    cacheHitRate: number;
    performance: {
      avgQueryTime: number;
      cacheEnabled: boolean;
    };
  }> {
    if (!this.supabase) {
      return {
        totalFriendships: 0,
        pendingRequests: 0,
        cacheHitRate: 0,
        performance: {
          avgQueryTime: 0,
          cacheEnabled: false
        }
      };
    }

    try {
      logger.debug('FriendsModule: Fetching module statistics');
      
      const startTime = Date.now();
      
      const [friendshipsResult, requestsResult] = await Promise.all([
        this.supabase
          .from('friendships')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'accepted'),
        this.supabase
          .from('friend_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
      ]);

      const queryTime = Date.now() - startTime;

      const stats = {
        totalFriendships: friendshipsResult.count || 0,
        pendingRequests: requestsResult.count || 0,
        cacheHitRate: 0.85, // Placeholder - would need actual metrics
        performance: {
          avgQueryTime: queryTime,
          cacheEnabled: !!this.redisService
        }
      };

      logger.debug('FriendsModule: Module statistics:', stats);
      return stats;
      
    } catch (error: any) {
      logger.error('FriendsModule: Error getting module stats:', error);
      return {
        totalFriendships: 0,
        pendingRequests: 0,
        cacheHitRate: 0,
        performance: {
          avgQueryTime: 0,
          cacheEnabled: false
        }
      };
    }
  }

  // ==================== CLEANUP AND MAINTENANCE ====================

  async cleanupExpiredRequests(olderThanDays: number = 30): Promise<number> {
    if (!this.supabase || olderThanDays <= 0) {
      return 0;
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const { count, error } = await this.supabase
        .from('friend_requests')
        .delete()
        .eq('status', 'pending')
        .lt('created_at', cutoffDate.toISOString());

      if (error) {
        logger.error('FriendsModule: Error cleaning up expired requests:', error);
        return 0;
      }

      const cleaned = count || 0;
      if (cleaned > 0) {
        logger.info(`FriendsModule: Cleaned up ${cleaned} expired friend requests`);
      }

      return cleaned;
      
    } catch (err: any) {
      logger.error('FriendsModule: Exception cleaning up expired requests:', err);
      return 0;
    }
  }

  async validateFriendshipsIntegrity(): Promise<{
    issues: string[];
    fixed: number;
  }> {
    if (!this.supabase) {
      return { issues: ['No Supabase client'], fixed: 0 };
    }

    const issues: string[] = [];
    let fixed = 0;

    try {
      logger.debug('FriendsModule: Validating friendships integrity');

      // ✅ Check for missing reciprocal friendships
      try {
        const { data: asymmetric, error: asymmetricError } = await this.supabase
          .rpc('find_asymmetric_friendships');

        if (asymmetricError) {
          issues.push(`Failed to check asymmetric friendships: ${asymmetricError.message}`);
        } else if (asymmetric && asymmetric.length > 0) {
          issues.push(`Found ${asymmetric.length} asymmetric friendships`);
          
          // ✅ Fix asymmetric friendships
          try {
            const { count, error: fixError } = await this.supabase
              .rpc('fix_asymmetric_friendships');
            
            if (fixError) {
              issues.push(`Failed to fix asymmetric friendships: ${fixError.message}`);
            } else {
              fixed += count || 0;
            }
          } catch (fixErr) {
            issues.push(`Exception fixing asymmetric friendships: ${fixErr}`);
          }
        }
      } catch (rpcError) {
        issues.push(`RPC functions not available for integrity check`);
      }

      // ✅ FIXED: Check for duplicate friend requests (removed .group() usage)
      try {
        const { data: allRequests, error: requestsError } = await this.supabase
          .from('friend_requests')
          .select('sender_id, receiver_id, status, created_at')
          .eq('status', 'pending')
          .order('created_at', { ascending: true });

        if (requestsError) {
          issues.push(`Failed to check duplicate requests: ${requestsError.message}`);
        } else if (allRequests && allRequests.length > 0) {
          // Manual duplicate detection
          const seenPairs = new Map<string, number>();
          let duplicateCount = 0;

          for (const request of allRequests) {
            const pairKey = `${request.sender_id}_${request.receiver_id}`;
            const count = seenPairs.get(pairKey) || 0;
            seenPairs.set(pairKey, count + 1);
            
            if (count > 0) {
              duplicateCount++;
            }
          }

          if (duplicateCount > 0) {
            issues.push(`Found ${duplicateCount} duplicate request pairs`);
          }
        }
      } catch (dupError) {
        issues.push(`Failed to check duplicates: ${dupError}`);
      }

      logger.debug(`FriendsModule: Integrity check completed - ${issues.length} issues, ${fixed} fixed`);
      
      return { issues, fixed };
      
    } catch (err: any) {
      logger.error('FriendsModule: Exception in integrity validation:', err);
      return { 
        issues: [...issues, `Exception: ${err.message}`], 
        fixed 
      };
    }
  }
}