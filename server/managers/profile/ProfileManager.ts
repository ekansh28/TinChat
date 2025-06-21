// server/managers/profile/ProfileManager.ts - MODULARIZED VERSION

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import { LRUCache } from '../../utils/LRUCache';
import { RedisService } from '../../services/RedisService';
import { UserStatus } from '../../types/User';

// Import all modular components
import { ProfileDatabaseModule } from './modules/ProfileDatabaseModule';
import { FriendsModule } from './modules/FriendsModule';
import { SearchModule } from './modules/SearchModule';
import { StatusModule } from './modules/StatusModule';
import { BlockingModule } from './modules/BlockingModule';

// Re-export types for backward compatibility
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
  private redisService: RedisService | null;
  private profileCache: LRUCache<UserProfile>;
  private statusUpdateQueue: StatusUpdate[] = [];
  private batchUpdateInterval: NodeJS.Timeout | null = null;
  private periodicCleanupInterval: NodeJS.Timeout | null = null;
  private cacheCleanupInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  
  // Modular components
  private databaseModule: ProfileDatabaseModule;
  private friendsModule: FriendsModule;
  private searchModule: SearchModule;
  private statusModule: StatusModule;
  private blockingModule: BlockingModule;
  
  // Enhanced caching configuration
  private readonly CACHE_DURATION = 30000; // 30 seconds for local cache
  private readonly BATCH_UPDATE_INTERVAL = 5000; // 5 seconds
  private readonly DEFAULT_PROFILE_COLOR = '#667eea';

  constructor(supabase: SupabaseClient | null, redisService: RedisService | null = null) {
    this.supabase = supabase;
    this.redisService = redisService;
    this.profileCache = new LRUCache<UserProfile>(1000);
    
    // Initialize all modular components
    this.databaseModule = new ProfileDatabaseModule(supabase);
    this.friendsModule = new FriendsModule(supabase, redisService);
    this.searchModule = new SearchModule(supabase, redisService);
    this.statusModule = new StatusModule(supabase, redisService);
    this.blockingModule = new BlockingModule(supabase, redisService);
    
    if (this.supabase) {
      this.startBatchUpdates();
      this.startPeriodicCleanup();
      logger.info('👤 Modular ProfileManager initialized with database connection');
    } else {
      logger.warn('👤 Modular ProfileManager initialized without database connection');
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

  // ==================== CORE PROFILE METHODS (using DatabaseModule) ====================

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
    
    // TIER 3: Fetch from database using DatabaseModule
    try {
      logger.debug(`🔄 Fetching fresh profile from database for ${authId}`);
      
      const profileData = await this.databaseModule.fetchProfile(authId);
      
      if (!profileData) {
        logger.debug(`Empty profile data from database for ${authId}`);
        return null;
      }
      
      const validatedProfile = this.parseAndValidateProfile(profileData, authId);
      
      // Cache in both local and Redis with proper error handling
      this.profileCache.set(authId, validatedProfile);
      
      if (this.redisService) {
        const isFrequentlyUpdated = this.isFrequentlyUpdatedProfile(validatedProfile);
        this.redisService.cacheUserProfile(authId, validatedProfile, isFrequentlyUpdated)
          .catch(err => logger.debug(`Redis profile caching failed for ${authId}:`, err));
      }
      
      const fetchTime = Date.now() - startTime;
      logger.debug(`✅ Profile fetched from database and cached for ${authId} (${fetchTime}ms)`);
      
      return validatedProfile;
    } catch (err) {
      logger.error(`Exception fetching profile for ${authId}:`, err);
      return null;
    }
  }

  /**
   * Enhanced profile creation using DatabaseModule
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
        display_name: displayName?.trim() || undefined,
        status: 'online' as UserStatus,
        display_name_color: this.DEFAULT_PROFILE_COLOR,
        display_name_animation: 'none',
        rainbow_speed: 3,
        is_online: true,
        profile_complete: false,
        created_at: new Date().toISOString(),
        last_seen: new Date().toISOString()
      };

      const createdProfile = await this.databaseModule.createProfile(authId, profileData);
      
      if (!createdProfile) {
        logger.error(`Failed to create profile for ${authId}`);
        return false;
      }
      
      const fullProfile = createdProfile as UserProfile;
      
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
   * Enhanced profile update using DatabaseModule
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

      const success = await this.databaseModule.updateProfile(authId, updateData);

      if (!success) {
        logger.error(`Failed to update profile for ${authId}`);
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
            invalidationPromises.push(
              this.invalidateFriendsListsContainingUser(authId).then(() => true).catch(() => false)
            );
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
   * Enhanced profile deletion using DatabaseModule
   */
  async deleteUserProfile(authId: string): Promise<boolean> {
    if (!this.supabase || !authId) {
      logger.debug(`Profile deletion skipped: supabase=${!!this.supabase}, authId=${!!authId}`);
      return false;
    }

    try {
      // Use database module for deletion (you'll need to add this method to ProfileDatabaseModule)
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

  // ==================== STATUS METHODS (using StatusModule) ====================

  /**
   * Enhanced status update using StatusModule
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
        // Use StatusModule for Redis operations
        await Promise.allSettled([
          this.statusModule.setOnlineStatus(authId, status === 'online'),
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

  async getOnlineStatus(authId: string): Promise<{ isOnline: boolean; lastSeen?: string }> {
    return this.statusModule.getOnlineStatus(authId);
  }

  async getOnlineUsers(limit: number = 100): Promise<string[]> {
    return this.statusModule.getOnlineUsers();
  }

  async batchGetOnlineStatus(authIds: string[]): Promise<Record<string, boolean>> {
    return this.statusModule.batchGetOnlineStatus(authIds);
  }

  // Add batch set method that uses individual calls
  async batchSetOnlineStatus(updates: Array<{ authId: string; isOnline: boolean }>): Promise<boolean> {
    if (updates.length === 0) return true;
    
    try {
      const results = await Promise.allSettled(
        updates.map(update => 
          this.statusModule.setOnlineStatus(update.authId, update.isOnline)
        )
      );
      
      const successCount = results.filter(result => 
        result.status === 'fulfilled' && result.value === true
      ).length;
      
      logger.debug(`📊 Batch set ${successCount}/${updates.length} online statuses`);
      return successCount === updates.length;
    } catch (error) {
      logger.error('Batch set online status failed:', error);
      return false;
    }
  }

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
        const updates = authIds.map(authId => ({
          authId,
          isOnline: status === 'online'
        }));
        
        // Use the batch method we just created
        this.batchSetOnlineStatus(updates).catch((err: any) => 
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

  // ==================== FRIENDS METHODS (using FriendsModule) ====================

  async fetchUserFriends(authId: string): Promise<FriendData[]> {
    return this.friendsModule.getFriendsList(authId);
  }

  async getFriendshipStatus(user1AuthId: string, user2AuthId: string): Promise<any> {
    return this.friendsModule.getFriendshipStatus(user1AuthId, user2AuthId);
  }

  // ==================== SEARCH METHODS (using SearchModule) ====================

  async searchProfiles(query: string, limit: number = 10): Promise<UserProfile[]> {
    if (!query.trim()) return [];
    
    const results = await this.searchModule.searchUsers(query, limit);
    return results.map(result => this.parseAndValidateProfile(result, result.id));
  }

  async searchUsersToAddAsFriends(currentUserAuthId: string, searchTerm: string, limit: number = 20): Promise<UserProfile[]> {
    const results = await this.searchModule.searchUsers(searchTerm, limit);
    // Additional filtering logic for friends would go here
    return results.map(result => this.parseAndValidateProfile(result, result.id));
  }

  // ==================== BLOCKING METHODS (using BlockingModule) ====================

  async blockUser(blockerAuthId: string, blockedAuthId: string, reason?: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const success = await this.blockingModule.blockUser(blockerAuthId, blockedAuthId);
      
      // Invalidate friends cache for both users
      if (this.redisService && success) {
        await Promise.all([
          this.friendsModule.invalidateFriendsCache(blockerAuthId),
          this.friendsModule.invalidateFriendsCache(blockedAuthId)
        ]);
      }

      return {
        success,
        message: success ? 'User blocked successfully' : 'Failed to block user'
      };
    } catch (err) {
      logger.error(`Exception blocking user:`, err);
      return { success: false, message: 'Failed to block user' };
    }
  }

  async isUserBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    return this.blockingModule.isBlocked(blockerId, blockedId);
  }

  async getBlockedUsers(authId: string): Promise<string[]> {
    return this.blockingModule.getBlockedUsers(authId);
  }

  // ==================== HELPER METHODS ====================

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
    
    return Boolean(isOnlineAndActive) && (Boolean(hasDynamicAnimation) || wasRecentlyUpdated);
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
          this.friendsModule.invalidateFriendsCache(friendship.user_id)
        );
        
        await Promise.allSettled(invalidationPromises);
        logger.debug(`👥 Invalidated friends lists for users containing ${userAuthId}`);
      }
    } catch (error) {
      logger.debug(`Failed to invalidate friends lists containing ${userAuthId}:`, error);
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
              
              // Update Redis cache using StatusModule
              if (this.redisService) {
                const redisOperations = statusUpdates.map(update => ({
                  authId: update.authId,
                  isOnline: status === 'online'
                }));
                
                // Use the batch method for Redis operations
                this.batchSetOnlineStatus(redisOperations).catch((err: any) => 
                  logger.debug(`Redis batch status update failed:`, err)
                );
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

  // ==================== MONITORING AND MAINTENANCE ====================

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

  // ==================== MODULE ACCESS METHODS ====================

  /**
   * Get access to the database module for advanced operations
   */
  getDatabaseModule(): ProfileDatabaseModule {
    return this.databaseModule;
  }

  /**
   * Get access to the friends module for advanced operations
   */
  getFriendsModule(): FriendsModule {
    return this.friendsModule;
  }

  /**
   * Get access to the search module for advanced operations
   */
  getSearchModule(): SearchModule {
    return this.searchModule;
  }

  /**
   * Get access to the status module for advanced operations
   */
  getStatusModule(): StatusModule {
    return this.statusModule;
  }

  /**
   * Get access to the blocking module for advanced operations
   */
  getBlockingModule(): BlockingModule {
    return this.blockingModule;
  }

  // ==================== LEGACY COMPATIBILITY METHODS ====================

  /**
   * Legacy methods for backward compatibility - these delegate to the appropriate modules
   */

  async fetchPendingFriendRequests(authId: string, type: 'received' | 'sent' = 'received'): Promise<any[]> {
    // This would need to be implemented in the FriendsModule
    logger.warn('fetchPendingFriendRequests not yet implemented in modular version');
    return [];
  }

  async sendFriendRequest(senderAuthId: string, receiverAuthId: string, message?: string): Promise<{
    success: boolean;
    message: string;
    autoAccepted?: boolean;
  }> {
    // This would need to be implemented in the FriendsModule
    logger.warn('sendFriendRequest not yet implemented in modular version');
    return { success: false, message: 'Not implemented in modular version' };
  }

  async acceptFriendRequest(requestId: string, acceptingUserId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    // This would need to be implemented in the FriendsModule
    logger.warn('acceptFriendRequest not yet implemented in modular version');
    return { success: false, message: 'Not implemented in modular version' };
  }

  async declineFriendRequest(requestId: string, decliningUserId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    // This would need to be implemented in the FriendsModule
    logger.warn('declineFriendRequest not yet implemented in modular version');
    return { success: false, message: 'Not implemented in modular version' };
  }

  async removeFriend(user1AuthId: string, user2AuthId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    // This would need to be implemented in the FriendsModule
    logger.warn('removeFriend not yet implemented in modular version');
    return { success: false, message: 'Not implemented in modular version' };
  }

  async getMutualFriends(user1AuthId: string, user2AuthId: string): Promise<any[]> {
    // This would need to be implemented in the FriendsModule
    logger.warn('getMutualFriends not yet implemented in modular version');
    return [];
  }

  async getFriendStats(authId: string): Promise<{
    friendCount: number;
    pendingSentCount: number;
    pendingReceivedCount: number;
    mutualFriendsWithRecent?: number;
  }> {
    // This would need to be implemented in the FriendsModule
    logger.warn('getFriendStats not yet implemented in modular version');
    return {
      friendCount: 0,
      pendingSentCount: 0,
      pendingReceivedCount: 0
    };
  }

  async getOnlineFriendsCount(authId: string): Promise<number> {
    // This would need to be implemented in the FriendsModule or StatusModule
    logger.warn('getOnlineFriendsCount not yet implemented in modular version');
    return 0;
  }
}