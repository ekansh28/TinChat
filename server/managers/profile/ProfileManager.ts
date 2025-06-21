// server/managers/profile/ProfileManager.ts - COMPLETE ENHANCED VERSION WITH REDIS INTEGRATION

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import { LRUCache } from '../../utils/LRUCache';
import { RedisService } from '../../services/RedisService';
import { UserStatus } from '../../types/User';

export interface UserProfile {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  banner_url?: string;
  pronouns?: string;
  status?: UserStatus;
  display_name_color?: string;
  display_name_animation?: string;
  rainbow_speed?: number;
  badges?: any[];
  bio?: string;
  last_seen?: string;
  is_online?: boolean;
  profile_complete?: boolean;
  created_at?: string;
  updated_at?: string;
  profile_card_css?: string;
  easy_customization_data?: any;
  blocked_users?: string[];
}

export interface StatusUpdate {
  authId: string;
  status: UserStatus;
  lastSeen?: string;
}

export interface FriendData {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  status: UserStatus;
  last_seen: string;
  is_online: boolean;
  friends_since?: string;
}

export class ProfileManager {
  private supabase: SupabaseClient | null;
  private profileCache: LRUCache<UserProfile>;
  private redisService: RedisService | null;
  private statusUpdateQueue: StatusUpdate[] = [];
  private batchUpdateInterval: NodeJS.Timeout | null = null;
  private periodicCleanupInterval: NodeJS.Timeout | null = null;
  private cacheCleanupInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  
  // Enhanced caching configuration
  private readonly CACHE_DURATION = 30000; // 30 seconds for local cache
  private readonly BATCH_UPDATE_INTERVAL = 5000; // 5 seconds
  private readonly DEFAULT_PROFILE_COLOR = '#667eea';
  private readonly FRIENDS_CACHE_DURATION = 60; // 1 minute in Redis
  private readonly PROFILE_CACHE_DURATION = 7 * 24 * 60 * 60; // 7 days in Redis

  constructor(supabase: SupabaseClient | null, redisService: RedisService | null = null) {
    this.supabase = supabase;
    this.redisService = redisService;
    this.profileCache = new LRUCache<UserProfile>(1000);
    
    if (this.supabase) {
      this.startBatchUpdates();
      this.startPeriodicCleanup();
      logger.info('👤 ProfileManager initialized with database connection');
    } else {
      logger.warn('👤 ProfileManager initialized without database connection');
    }

    if (this.redisService) {
      this.testRedisConnection();
      logger.info('📋 ProfileManager initialized with enhanced Redis caching');
    }
  }

  /**
   * Test Redis connection and setup cache warming
   */
  private async testRedisConnection(): Promise<void> {
    if (!this.redisService) return;
    
    try {
      const isConnected = await this.redisService.testConnection();
      if (isConnected) {
        logger.info('✅ ProfileManager Redis connection verified');
        await this.warmFrequentProfileCache();
      } else {
        logger.warn('⚠️ ProfileManager Redis connection failed - using local cache only');
      }
    } catch (error) {
      logger.error('❌ ProfileManager Redis test failed:', error);
    }
  }

  /**
   * Warm cache with frequently accessed profiles
   */
  private async warmFrequentProfileCache(): Promise<void> {
    if (!this.supabase || !this.redisService) return;
    
    try {
      const { data: recentProfiles } = await this.supabase
        .from('user_profiles')
        .select('id, username, display_name, avatar_url, status, display_name_color')
        .gte('last_seen', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .eq('is_online', true)
        .limit(50);
      
      if (recentProfiles && recentProfiles.length > 0) {
        const cachePromises = recentProfiles.map(profile => 
          this.redisService!.cacheUserProfile(profile.id, profile as UserProfile, false)
            .catch(err => logger.debug(`Cache warming failed for ${profile.id}:`, err))
        );
        
        await Promise.allSettled(cachePromises);
        logger.info(`🔥 Warmed cache with ${recentProfiles.length} recent profiles`);
      }
    } catch (error) {
      logger.debug('Cache warming failed (non-critical):', error);
    }
  }

  /**
   * Enhanced profile fetching with 3-tier caching strategy
   */
  async fetchUserProfile(authId: string): Promise<UserProfile | null> {
    if (!this.supabase || !authId || this.isShuttingDown) {
      logger.debug(`Profile fetch skipped: supabase=${!!this.supabase}, authId=${!!authId}, shutting down=${this.isShuttingDown}`);
      return null;
    }
    
    const startTime = Date.now();
    
    // TIER 1: Check local LRU cache first (fastest)
    const localCached = this.profileCache.get(authId);
    if (localCached) {
      logger.debug(`📋 Local cache hit for profile ${authId} (${Date.now() - startTime}ms)`);
      
      // Background Redis cache sync if available
      if (this.redisService) {
        this.syncToRedisInBackground(authId, localCached);
      }
      
      return localCached;
    }
    
    // TIER 2: Check Redis cache (medium speed)
    if (this.redisService) {
      try {
        const redisProfile = await this.redisService.getCachedUserProfile(authId);
        if (redisProfile) {
          logger.debug(`📋 Redis cache hit for profile ${authId} (${Date.now() - startTime}ms)`);
          
          // Update local cache
          this.profileCache.set(authId, redisProfile);
          return redisProfile;
        }
      } catch (error) {
        logger.warn(`Redis profile fetch failed for ${authId}, falling back to database:`, error);
      }
    }
    
    // TIER 3: Fetch from database (slowest)
    try {
      logger.debug(`🔄 Fetching fresh profile from database for ${authId}`);
      
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select(`
          id, username, display_name, avatar_url, banner_url, pronouns, status,
          display_name_color, display_name_animation, rainbow_speed, badges, bio,
          last_seen, is_online, profile_complete, created_at, updated_at,
          profile_card_css, easy_customization_data, blocked_users
        `)
        .eq('id', authId)
        .maybeSingle();

      if (error) {
        if (error.code !== 'PGRST116') {
          logger.error(`Database profile fetch error for ${authId}:`, error);
        } else {
          logger.debug(`No profile found in database for ${authId}`);
        }
        return null;
      }
      
      if (!data) {
        logger.debug(`Empty profile data from database for ${authId}`);
        return null;
      }
      
      const profileData = this.parseAndValidateProfile(data, authId);
      
      // Cache in both local and Redis with proper error handling
      this.profileCache.set(authId, profileData);
      
      if (this.redisService) {
        const isFrequentlyUpdated = this.isFrequentlyUpdatedProfile(profileData);
        this.redisService.cacheUserProfile(authId, profileData, isFrequentlyUpdated)
          .catch(err => logger.debug(`Redis profile caching failed for ${authId}:`, err));
      }
      
      const fetchTime = Date.now() - startTime;
      logger.debug(`✅ Profile fetched from database and cached for ${authId} (${fetchTime}ms)`);
      
      return profileData;
    } catch (err) {
      logger.error(`Exception fetching profile for ${authId}:`, err);
      return null;
    }
  }

  // Background Redis sync to avoid blocking main thread
  private async syncToRedisInBackground(authId: string, profile: UserProfile): Promise<void> {
    if (!this.redisService) return;
    
    try {
      const redisProfile = await this.redisService.getCachedUserProfile(authId);
      if (!redisProfile) {
        const isFrequentlyUpdated = this.isFrequentlyUpdatedProfile(profile);
        await this.redisService.cacheUserProfile(authId, profile, isFrequentlyUpdated);
        logger.debug(`📋 Background sync to Redis for ${authId}`);
      }
    } catch (error) {
      logger.debug(`Background Redis sync failed for ${authId}:`, error);
    }
  }

  /**
   * Parse and validate profile data with consistent defaults
   */
  private parseAndValidateProfile(data: any, authId: string): UserProfile {
    let parsedBadges = [];
    if (data.badges) {
      try {
        parsedBadges = typeof data.badges === 'string' ? JSON.parse(data.badges) : data.badges;
        
        if (Array.isArray(parsedBadges)) {
          parsedBadges = parsedBadges.filter(badge => 
            badge && 
            typeof badge === 'object' && 
            typeof badge.id === 'string' && 
            typeof badge.url === 'string'
          );
        } else {
          logger.warn(`Invalid badges structure for ${authId}, expected array`);
          parsedBadges = [];
        }
      } catch (e) {
        logger.warn(`Badge parsing failed for ${authId}, using empty array:`, e);
        parsedBadges = [];
      }
    }

    // Parse easy customization data
    let parsedCustomizationData = {};
    if (data.easy_customization_data) {
      try {
        parsedCustomizationData = typeof data.easy_customization_data === 'string' 
          ? JSON.parse(data.easy_customization_data) 
          : data.easy_customization_data;
      } catch (e) {
        logger.warn(`Customization data parsing failed for ${authId}:`, e);
        parsedCustomizationData = {};
      }
    }
    
    return {
      ...data,
      badges: parsedBadges,
      easy_customization_data: parsedCustomizationData,
      display_name_color: data.display_name_color || this.DEFAULT_PROFILE_COLOR,
      display_name_animation: data.display_name_animation || 'none',
      rainbow_speed: data.rainbow_speed || 3,
      status: data.status || 'online',
      blocked_users: data.blocked_users || []
    };
  }

  /**
   * Determine if a profile is frequently updated
   */
  private isFrequentlyUpdatedProfile(profile: UserProfile): boolean {
    const isOnlineAndActive = profile.is_online && profile.status === 'online';
    const hasDynamicAnimation = profile.display_name_animation !== 'none';
    
    let wasRecentlyUpdated = false;
    if (profile.updated_at) {
      const updateTime = new Date(profile.updated_at).getTime();
      const timeSinceUpdate = Date.now() - updateTime;
      wasRecentlyUpdated = timeSinceUpdate < 24 * 60 * 60 * 1000;
    }
    
    return isOnlineAndActive && (hasDynamicAnimation || wasRecentlyUpdated);
  }

  // ==================== FRIENDS SYSTEM METHODS ====================

  /**
   * Enhanced friends list management with Redis caching
   */
  async fetchUserFriends(authId: string): Promise<FriendData[]> {
    if (!this.supabase || !authId) {
      return [];
    }
    
    const startTime = Date.now();
    
    // Check Redis cache first
    if (this.redisService) {
      try {
        const cachedFriends = await this.redisService.getCachedFriendsList(authId);
        if (cachedFriends) {
          logger.debug(`👥 Friends cache hit for ${authId} (${Date.now() - startTime}ms)`);
          return cachedFriends;
        }
      } catch (error) {
        logger.warn(`Redis friends fetch failed for ${authId}:`, error);
      }
    }
    
    try {
      const { data: friendships, error } = await this.supabase
        .from('friendships')
        .select(`
          friend_id,
          created_at,
          friend:user_profiles!friendships_friend_id_fkey (
            id,
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
        logger.error(`Error fetching friends for ${authId}:`, error);
        return [];
      }
      
      const friends: FriendData[] = (friendships || [])
        .filter(f => f.friend)
        .map(f => ({
          id: f.friend.id,
          username: f.friend.username,
          display_name: f.friend.display_name,
          avatar_url: f.friend.avatar_url,
          status: f.friend.status || 'offline',
          last_seen: f.friend.last_seen || new Date().toISOString(),
          is_online: f.friend.is_online || false,
          friends_since: f.created_at
        }));
      
      // Cache in Redis
      if (this.redisService) {
        this.redisService.cacheFriendsList(authId, friends)
          .catch(err => logger.debug(`Friends caching failed for ${authId}:`, err));
      }
      
      const fetchTime = Date.now() - startTime;
      logger.debug(`👥 Fetched ${friends.length} friends for ${authId} from database (${fetchTime}ms)`);
      
      return friends;
    } catch (err) {
      logger.error(`Exception fetching friends for ${authId}:`, err);
      return [];
    }
  }

  /**
   * Get pending friend requests for a user
   */
  async fetchPendingFriendRequests(authId: string, type: 'received' | 'sent' = 'received'): Promise<any[]> {
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
        `)
        .eq(field, authId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

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

  /**
   * Send a friend request
   */
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

  /**
   * Accept a friend request
   */
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

  /**
   * Decline a friend request
   */
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

  /**
   * Remove a friend
   */
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

  /**
   * Block a user
   */
  async blockUser(blockerAuthId: string, blockedAuthId: string, reason?: string): Promise<{
    success: boolean;
    message: string;
  }> {
    if (!this.supabase || !blockerAuthId || !blockedAuthId) {
      return { success: false, message: 'Invalid parameters' };
    }

    try {
      const { data, error } = await this.supabase
        .rpc('block_user', {
          blocker_uuid: blockerAuthId,
          blocked_uuid: blockedAuthId,
          block_reason: reason || null
        });

      if (error) {
        logger.error(`Error blocking user ${blockedAuthId} by ${blockerAuthId}:`, error);
        return { success: false, message: 'Failed to block user' };
      }

      // Invalidate friends cache for both users
      if (this.redisService && data.success) {
        this.redisService.invalidateFriendsList(blockerAuthId);
        this.redisService.invalidateFriendsList(blockedAuthId);
      }

      return {
        success: data.success,
        message: data.message
      };
    } catch (err) {
      logger.error(`Exception blocking user:`, err);
      return { success: false, message: 'Failed to block user' };
    }
  }

  /**
   * Get mutual friends between two users
   */
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

  /**
   * Search for users to add as friends
   */
  async searchUsersToAddAsFriends(currentUserAuthId: string, searchTerm: string, limit: number = 20): Promise<UserProfile[]> {
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

      return filteredUsers.map(user => this.parseAndValidateProfile(user, user.id));

    } catch (err) {
      logger.error(`Exception searching users to add as friends:`, err);
      return [];
    }
  }

  /**
   * Get friend statistics for a user
   */
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

  /**
   * Check friendship status between two users
   */
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

  /**
   * Get online friends count for quick display
   */
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

  // ==================== CORE PROFILE METHODS ====================

  /**
   * Enhanced status update with smart cache invalidation
   */
  async updateUserStatus(authId: string, status: UserStatus): Promise<boolean> {
    if (!this.supabase || !authId || this.isShuttingDown) {
      logger.debug(`Status update skipped: supabase=${!!this.supabase}, authId=${!!authId}, shutting down=${this.isShuttingDown}`);
      return false;
    }
    
    const statusUpdate: StatusUpdate = {
      authId,
      status,
      lastSeen: new Date().toISOString()
    };
    
    // Add to batch queue
    this.statusUpdateQueue.push(statusUpdate);
    
    // CRITICAL: Invalidate all cache layers immediately for consistency
    this.profileCache.delete(authId);
    
    if (this.redisService) {
      try {
        // Parallel cache operations for better performance
        await Promise.allSettled([
          this.redisService.cacheUserOnlineStatus(authId, status === 'online', new Date()),
          this.redisService.invalidateUserProfile(authId),
          this.invalidateFriendsListsContainingUser(authId)
        ]);
        
        logger.debug(`📊 Status update queued and caches invalidated for ${authId}: ${status}`);
      } catch (error) {
        logger.error(`Cache invalidation failed for ${authId}:`, error);
      }
    }
    
    return true;
  }

  /**
   * Enhanced profile creation with immediate caching
   */
  async createUserProfile(authId: string, username: string, displayName?: string): Promise<boolean> {
    if (!this.supabase || !authId || !username) {
      logger.warn(`Profile creation failed: missing required parameters`);
      return false;
    }
    
    try {
      const profileData = {
        id: authId,
        username: username.trim(),
        display_name: displayName?.trim() || null,
        status: 'online' as UserStatus,
        display_name_color: this.DEFAULT_PROFILE_COLOR,
        display_name_animation: 'none',
        rainbow_speed: 3,
        is_online: true,
        profile_complete: false,
        created_at: new Date().toISOString(),
        last_seen: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('user_profiles')
        .insert(profileData);
      
      if (error) {
        logger.error(`Error creating profile for ${authId}:`, error);
        return false;
      }
      
      const fullProfile = profileData as UserProfile;
      
      this.profileCache.set(authId, fullProfile);
      
      if (this.redisService) {
        const isFrequentlyUpdated = true;
        this.redisService.cacheUserProfile(authId, fullProfile, isFrequentlyUpdated)
          .catch(err => logger.debug(`Redis caching failed for new profile ${authId}:`, err));
        
        this.redisService.cacheUserOnlineStatus(authId, true, new Date())
          .catch(err => logger.debug(`Online status caching failed for ${authId}:`, err));
      }
      
      logger.info(`✅ Created and cached new profile for ${authId} with username: ${username}`);
      return true;
    } catch (err) {
      logger.error(`Exception creating profile for ${authId}:`, err);
      return false;
    }
  }

  /**
   * Enhanced profile update with smart cache management
   */
  async updateUserProfile(authId: string, updates: Partial<UserProfile>): Promise<boolean> {
    if (!this.supabase || !authId || this.isShuttingDown) {
      logger.debug(`Profile update skipped: supabase=${!!this.supabase}, authId=${!!authId}, shutting down=${this.isShuttingDown}`);
      return false;
    }

    try {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      // Atomic database update
      const { error } = await this.supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', authId);

      if (error) {
        logger.error(`Error updating profile for ${authId}:`, error);
        return false;
      }

      // CRITICAL: Immediate cache invalidation for consistency
      this.profileCache.delete(authId);
      
      if (this.redisService) {
        try {
          // Parallel invalidation operations
          const invalidationPromises = [
            this.redisService.invalidateUserProfile(authId)
          ];
          
          // Invalidate friends lists if display data changed
          if (updates.display_name !== undefined || updates.avatar_url !== undefined) {
            invalidationPromises.push(this.invalidateFriendsListsContainingUser(authId));
          }
          
          // Update online status if status changed
          if (updates.status !== undefined) {
            const isOnline = updates.status === 'online';
            invalidationPromises.push(
              this.redisService.cacheUserOnlineStatus(authId, isOnline, new Date())
            );
          }
          
          await Promise.allSettled(invalidationPromises);
          
        } catch (redisError) {
          logger.warn(`Redis cache invalidation failed for ${authId}:`, redisError);
        }
      }

      logger.info(`✅ Updated profile for ${authId} and invalidated caches`);
      return true;
    } catch (err) {
      logger.error(`Exception updating profile for ${authId}:`, err);
      return false;
    }
  }

  /**
   * Enhanced profile deletion with cache cleanup
   */
  async deleteUserProfile(authId: string): Promise<boolean> {
    if (!this.supabase || !authId) {
      logger.debug(`Profile deletion skipped: supabase=${!!this.supabase}, authId=${!!authId}`);
      return false;
    }

    try {
      const { error } = await this.supabase
        .from('user_profiles')
        .delete()
        .eq('id', authId);

      if (error) {
        logger.error(`Error deleting profile for ${authId}:`, error);
        return false;
      }

      this.profileCache.delete(authId);

      if (this.redisService) {
        this.redisService.invalidateUserProfile(authId)
          .catch(err => logger.debug(`Redis profile deletion failed for ${authId}:`, err));
      }

      logger.info(`✅ Deleted profile for ${authId} and cleaned up caches`);
      return true;
    } catch (err) {
      logger.error(`Exception deleting profile for ${authId}:`, err);
      return false;
    }
  }

  /**
   * Enhanced profile search with Redis result caching
   */
  async searchProfiles(query: string, limit: number = 10): Promise<UserProfile[]> {
    if (!this.supabase || !query.trim()) {
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select(`
          id, username, display_name, avatar_url, status, 
          display_name_color, display_name_animation, badges
        `)
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .eq('is_online', true)
        .limit(limit);

      if (error) {
        logger.error(`Profile search error:`, error);
        return [];
      }

      const results = (data || []).map(profile => 
        this.parseAndValidateProfile(profile, profile.id)
      );

      logger.debug(`🔍 Search for "${query}" returned ${results.length} results`);
      return results;
    } catch (err) {
      logger.error(`Exception during profile search:`, err);
      return [];
    }
  }

  /**
   * Get online users with Redis acceleration
   */
  async getOnlineUsers(limit: number = 100): Promise<UserProfile[]> {
    if (!this.supabase) return [];
    
    try {
      if (this.redisService) {
        const cachedOnlineUsers = await this.redisService.getCachedOnlineUsers();
        if (cachedOnlineUsers && cachedOnlineUsers.length > 0) {
          const profilePromises = cachedOnlineUsers.slice(0, limit).map(username => 
            this.searchProfiles(username, 1).then(results => results[0]).catch(() => null)
          );
          
          const profiles = (await Promise.allSettled(profilePromises))
            .map(result => result.status === 'fulfilled' ? result.value : null)
            .filter((profile): profile is UserProfile => profile !== null);
          
          if (profiles.length > 0) {
            logger.debug(`👥 Got ${profiles.length} online users from Redis cache`);
            return profiles;
          }
        }
      }
      
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select(`
          id, username, display_name, avatar_url, status, 
          display_name_color, display_name_animation, badges, last_seen
        `)
        .eq('is_online', true)
        .order('last_seen', { ascending: false })
        .limit(limit);
      
      if (error) {
        logger.error('Error fetching online users:', error);
        return [];
      }
      
      const onlineUsers = (data || []).map(user => 
        this.parseAndValidateProfile(user, user.id)
      );
      
      if (this.redisService && onlineUsers.length > 0) {
        const usernames = onlineUsers.map(u => u.username);
        this.redisService.cacheOnlineUsers(usernames).catch(err =>
          logger.debug('Failed to cache online users list:', err)
        );
      }
      
      logger.debug(`👥 Fetched ${onlineUsers.length} online users from database`);
      return onlineUsers;
    } catch (err) {
      logger.error('Exception fetching online users:', err);
      return [];
    }
  }

  // ==================== BATCH AND MONITORING METHODS ====================

  /**
   * Enhanced batch status updates with Redis coordination
   */
  private startBatchUpdates(): void {
    this.batchUpdateInterval = setInterval(async () => {
      if (this.statusUpdateQueue.length === 0 || this.isShuttingDown) return;
      
      const updates = [...this.statusUpdateQueue];
      this.statusUpdateQueue = [];
      
      try {
        // Group updates by status for efficient batch processing
        const updateGroups = updates.reduce((groups, update) => {
          if (!groups[update.status]) groups[update.status] = [];
          groups[update.status]!.push(update);
          return groups;
        }, {} as Record<string, StatusUpdate[]>);
        
        // Process each status group
        for (const [status, statusUpdates] of Object.entries(updateGroups)) {
          const authIds = statusUpdates.map(u => u.authId);
          
          try {
            const { error, count } = await this.supabase!
              .from('user_profiles')
              .update({
                status: status as UserStatus,
                last_seen: new Date().toISOString(),
                is_online: status === 'online',
                updated_at: new Date().toISOString()
              })
              .in('id', authIds);
            
            if (error) {
              logger.error(`Batch status update error for ${status}:`, error);
              // Re-queue failed updates
              this.statusUpdateQueue.push(...statusUpdates);
            } else {
              logger.debug(`✅ Batch updated ${count || authIds.length} users to ${status} in database`);
              
              // Update Redis cache in parallel
              if (this.redisService) {
                const redisOperations = statusUpdates.map(update => 
                  this.redisService!.cacheUserOnlineStatus(
                    update.authId, 
                    status === 'online', 
                    new Date(update.lastSeen || Date.now())
                  ).catch(err => 
                    logger.debug(`Redis status update failed for ${update.authId}:`, err)
                  )
                );
                
                await Promise.allSettled(redisOperations);
              }
            }
          } catch (groupError) {
            logger.error(`Batch update failed for status ${status}:`, groupError);
            // Re-queue failed updates
            this.statusUpdateQueue.push(...statusUpdates);
          }
        }
      } catch (error) {
        logger.error('Exception during batch status update:', error);
        // Re-queue all updates
        this.statusUpdateQueue.push(...updates);
      }
    }, this.BATCH_UPDATE_INTERVAL);

    logger.info(`📦 Enhanced profile batch updates started (${this.BATCH_UPDATE_INTERVAL}ms interval)`);
  }

  /**
   * Enhanced periodic cleanup with Redis maintenance
   */
  private startPeriodicCleanup(): void {
    // Database cleanup
    this.periodicCleanupInterval = setInterval(async () => {
      if (!this.supabase || this.isShuttingDown) return;
      
      try {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

        const { error, count } = await this.supabase
          .from('user_profiles')
          .update({ 
            status: 'offline',
            is_online: false,
            updated_at: new Date().toISOString()
          })
          .lt('last_seen', tenMinutesAgo)
          .neq('status', 'offline');

        if (error) {
          logger.error('Error in periodic user cleanup:', error);
        } else if (count && count > 0) {
          logger.debug(`🧹 Completed periodic user cleanup: ${count} users set offline`);
        }

        // Redis cleanup
        if (this.redisService) {
          await this.redisService.cleanup();
        }
        
      } catch (err) {
        logger.error('Exception during periodic cleanup:', err);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
    
    // Local cache cleanup
    this.cacheCleanupInterval = setInterval(() => {
      if (this.isShuttingDown) return;
      
      const sizeBefore = this.profileCache.size();
      this.profileCache.cleanup(this.CACHE_DURATION);
      const sizeAfter = this.profileCache.size();
      
      if (sizeBefore !== sizeAfter) {
        logger.debug(`🗄️ Profile cache cleanup: ${sizeBefore} → ${sizeAfter} entries`);
      }
    }, 2 * 60 * 1000); // Every 2 minutes

    logger.info('🧹 Enhanced profile periodic cleanup started');
  }

  /**
   * Invalidate friends lists that contain a specific user
   */
  private async invalidateFriendsListsContainingUser(userAuthId: string): Promise<void> {
    if (!this.supabase || !this.redisService) return;
    
    try {
      const { data: friendships } = await this.supabase
        .from('friendships')
        .select('user_id')
        .eq('friend_id', userAuthId)
        .eq('status', 'accepted');
      
      if (friendships && friendships.length > 0) {
        const invalidationPromises = friendships.map(friendship => 
          this.redisService!.invalidateFriendsList(friendship.user_id)
            .catch(err => logger.debug(`Failed to invalidate friends list for ${friendship.user_id}:`, err))
        );
        
        await Promise.allSettled(invalidationPromises);
        logger.debug(`👥 Invalidated friends lists for users containing ${userAuthId}`);
      }
    } catch (error) {
      logger.debug(`Failed to invalidate friends lists containing ${userAuthId}:`, error);
    }
  }

  /**
   * Enhanced cache statistics with Redis metrics
   */
  getCacheStats(): { 
    local: { size: number; hitRate: number; capacity: number };
    redis?: { connected: boolean; stats?: any };
  } {
    const localStats = {
      size: this.profileCache.size(),
      hitRate: this.profileCache.getHitRate(),
      capacity: 1000
    };

    const result: any = { local: localStats };

    if (this.redisService) {
      result.redis = { 
        connected: this.redisService.isRedisConnected(),
        stats: null
      };
      
      // Get Redis stats asynchronously (non-blocking)
      this.redisService.getRedisStats().then(stats => {
        result.redis.stats = stats;
      }).catch(err => {
        result.redis.connected = false;
        logger.debug('Failed to get Redis stats:', err);
      });
    }

    return result;
  }

  /**
   * Enhanced health check with comprehensive Redis validation
   */
  async testConnection(): Promise<{ 
    database: boolean; 
    redis?: boolean;
    overall: boolean;
    cachePerformance?: any;
    errors: string[];
  }> {
    const result: any = { overall: false, errors: [] };

    // Test database connection
    if (!this.supabase) {
      result.database = false;
      result.errors.push('Supabase client not initialized');
    } else {
      try {
        const startTime = Date.now();
        const { data, error } = await this.supabase
          .from('user_profiles')
          .select('id')
          .limit(1);
        
        const dbLatency = Date.now() - startTime;
        
        if (error) {
          logger.error('Database connection test failed:', error);
          result.database = false;
          result.errors.push(`Database error: ${error.message}`);
        } else {
          logger.debug(`✅ Database connection test passed (${dbLatency}ms)`);
          result.database = true;
          result.dbLatency = dbLatency;
        }
      } catch (error) {
        logger.error('Database connection test exception:', error);
        result.database = false;
        result.errors.push(`Database exception: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    // Test Redis connection
    if (this.redisService) {
      try {
        const startTime = Date.now();
        result.redis = await this.redisService.testConnection();
        const redisLatency = Date.now() - startTime;
        result.redisLatency = redisLatency;
        
        if (result.redis) {
          // Test cache operations
          const testKey = 'test_profile_cache';
          const testData = { id: 'test', username: 'test_user' };
          
          const cacheStartTime = Date.now();
          const cacheSuccess = await this.redisService.cacheUserProfile(testKey, testData as UserProfile, false);
          
          if (cacheSuccess) {
            const cached = await this.redisService.getCachedUserProfile(testKey);
            await this.redisService.invalidateUserProfile(testKey);
            const cacheLatency = Date.now() - cacheStartTime;
            
            result.cachePerformance = {
              writeReadDeleteLatency: cacheLatency,
              cacheWorking: !!cached,
              operationsSuccessful: true
            };
          } else {
            result.errors.push('Redis cache operations failed');
            result.cachePerformance = { operationsSuccessful: false };
          }
        } else {
          result.errors.push('Redis connection test failed');
        }
      } catch (error) {
        logger.error('Redis connection test exception:', error);
        result.redis = false;
        result.errors.push(`Redis exception: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    // Determine overall health
    result.overall = result.database && (!this.redisService || result.redis);
    
    return result;
  }

  /**
   * Bulk operations for better performance
   */
  async bulkUpdateStatus(authIds: string[], status: UserStatus): Promise<number> {
    if (!this.supabase || authIds.length === 0) return 0;

    try {
      const startTime = Date.now();
      
      const { error, count } = await this.supabase
        .from('user_profiles')
        .update({
          status,
          last_seen: new Date().toISOString(),
          is_online: status === 'online',
          updated_at: new Date().toISOString()
        })
        .in('id', authIds);

      if (error) {
        logger.error(`Bulk status update error:`, error);
        return 0;
      }

      authIds.forEach(authId => this.profileCache.delete(authId));

      if (this.redisService) {
        const redisOperations = authIds.flatMap(authId => [
          {
            operation: 'del' as const,
            key: `profile:${authId}`
          },
          {
            operation: 'setex' as const,
            key: `online:${authId}`,
            value: {
              isOnline: status === 'online',
              lastSeen: new Date().toISOString(),
              updated_at: Date.now()
            },
            ttl: this.redisService.isRedisConnected() ? 30 : undefined
          }
        ]);
        
        this.redisService.batchOperations(redisOperations).catch(err => 
          logger.debug(`Bulk Redis operations failed:`, err)
        );
      }

      const updateTime = Date.now() - startTime;
      logger.info(`✅ Bulk updated ${count || 0} users to ${status} (${updateTime}ms)`);
      return count || 0;
    } catch (err) {
      logger.error(`Exception during bulk status update:`, err);
      return 0;
    }
  }

  /**
   * Force refresh profile from database (bypass all caches)
   */
  async forceRefreshProfile(authId: string): Promise<UserProfile | null> {
    this.profileCache.delete(authId);
    
    if (this.redisService) {
      await this.redisService.invalidateUserProfile(authId);
    }
    
    return this.fetchUserProfile(authId);
  }

  /**
   * Get comprehensive profile statistics
   */
  getProfileStats(): {
    cacheStats: any;
    queueStats: any;
    redisStats?: any;
    performanceMetrics: any;
  } {
    const cacheStats = this.getCacheStats();
    const queueStats = {
      pending: this.statusUpdateQueue.length,
      batchInterval: this.BATCH_UPDATE_INTERVAL
    };
    
    const performanceMetrics = {
      localCacheHitRate: this.profileCache.getHitRate(),
      localCacheSize: this.profileCache.size(),
      memoryUsage: this.profileCache.getMemoryUsage()
    };
    
    const result: any = {
      cacheStats,
      queueStats,
      performanceMetrics
    };
    
    if (this.redisService) {
      result.redisStats = {
        connected: this.redisService.isRedisConnected(),
      };
    }
    
    return result;
  }

  /**
   * Enhanced graceful shutdown with comprehensive cleanup
   */
  async destroy(): Promise<void> {
    logger.info('👤 Starting enhanced ProfileManager graceful shutdown...');
    this.isShuttingDown = true;
    
    try {
      // Stop all intervals
      if (this.batchUpdateInterval) {
        clearInterval(this.batchUpdateInterval);
        this.batchUpdateInterval = null;
      }
      
      if (this.periodicCleanupInterval) {
        clearInterval(this.periodicCleanupInterval);
        this.periodicCleanupInterval = null;
      }

      if (this.cacheCleanupInterval) {
        clearInterval(this.cacheCleanupInterval);
        this.cacheCleanupInterval = null;
      }
      
      // Process remaining status updates
      if (this.statusUpdateQueue.length > 0) {
        logger.info(`📦 Processing ${this.statusUpdateQueue.length} final status updates...`);
        
        const finalUpdates = [...this.statusUpdateQueue];
        this.statusUpdateQueue = [];
        
        if (this.supabase) {
          try {
            // Set all remaining users offline
            const authIds = finalUpdates.map(u => u.authId);
            await this.supabase
              .from('user_profiles')
              .update({
                status: 'offline',
                is_online: false,
                last_seen: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .in('id', authIds);
            
            logger.info(`✅ Set ${authIds.length} users offline during shutdown`);
          } catch (error) {
            logger.error('Failed to process final status updates:', error);
          }
        }
      }
      
      // Clear local cache
      this.profileCache.clear();
      
      // Redis cleanup (if available)
      if (this.redisService) {
        try {
          await this.redisService.cleanup();
          logger.info('✅ Redis cleanup completed during shutdown');
        } catch (error) {
          logger.error('❌ Redis cleanup failed during shutdown:', error);
        }
      }
      
      logger.info('👤 Enhanced ProfileManager graceful shutdown completed');
    } catch (error) {
      logger.error('❌ Error during ProfileManager shutdown:', error);
      throw error;
    }
  }

  /**
   * Get Redis service instance for advanced operations
   */
  getRedisService(): RedisService | null {
    return this.redisService;
  }
}