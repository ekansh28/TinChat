// server/managers/profile/ProfileManager.ts - FIXED FOR CLERK_ID SCHEMA

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

// ✅ FIXED: Added clerk_id to interface
export interface UserProfile {
  id: string;
  clerk_id: string; // ✅ CRITICAL: Added clerk_id field
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
  authId: string; // This will be clerk_id
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
  private readonly CACHE_DURATION = 60000; // ✅ INCREASED: 60 seconds for local cache
  private readonly BATCH_UPDATE_INTERVAL = 5000; // 5 seconds
  private readonly DEFAULT_PROFILE_COLOR = '#667eea';
  private readonly MAX_PROFILE_SIZE = 30000; // ✅ REDUCED: 30KB limit for profiles

  // ✅ NEW: Connection retry logic
  private connectionRetries = 0;
  private readonly MAX_CONNECTION_RETRIES = 3;
  private readonly RETRY_DELAY = 2000; // 2 seconds

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
      logger.info('👤 Enhanced ProfileManager initialized with Clerk schema alignment');
    } else {
      logger.warn('👤 ProfileManager initialized without database connection');
    }

    if (this.redisService) {
      this.testRedisConnection();
      logger.info('📋 ProfileManager initialized with enhanced Redis caching');
    }
  }

  /**
   * ✅ CRITICAL FIX: Fetch user profile by clerk_id instead of id
   */
  async fetchUserProfile(clerkId: string): Promise<UserProfile | null> {
    if (!this.supabase || !clerkId || this.isShuttingDown) {
      logger.debug(`Profile fetch skipped: supabase=${!!this.supabase}, clerkId=${!!clerkId}, shutting down=${this.isShuttingDown}`);
      return null;
    }
    
    console.log(`[ProfileManager] 🔍 Fetching profile for clerk_id: ${clerkId}`);
    const startTime = Date.now();
    
    // TIER 1: Check local LRU cache first (fastest)
    const localCached = this.profileCache.get(clerkId);
    if (localCached) {
      console.log(`[ProfileManager] ✅ Local cache hit for ${clerkId}:`, {
        username: localCached.username,
        display_name: localCached.display_name
      });
      
      // Background Redis cache sync if available (but don't wait for it)
      if (this.redisService) {
        this.syncToRedisInBackground(clerkId, localCached);
      }
      
      return localCached;
    }
    
    // TIER 2: Check Redis cache (medium speed) - but with timeout
    if (this.redisService) {
      try {
        const redisProfile = await this.fetchFromRedisWithTimeout(clerkId, 1000); // 1 second timeout
        if (redisProfile) {
          console.log(`[ProfileManager] ✅ Redis cache hit for ${clerkId}:`, {
            username: redisProfile.username,
            display_name: redisProfile.display_name
          });
          
          // Update local cache
          this.profileCache.set(clerkId, redisProfile);
          return redisProfile;
        }
      } catch (error) {
        console.warn(`[ProfileManager] Redis profile fetch failed for ${clerkId}, falling back to database:`, error);
      }
    }
    
    // TIER 3: Fetch from database with enhanced error handling
    return await this.fetchFromDatabaseWithRetry(clerkId, startTime);
  }

  /**
   * ✅ NEW: Fetch from Redis with timeout to prevent hanging
   */
  private async fetchFromRedisWithTimeout(clerkId: string, timeout: number): Promise<UserProfile | null> {
    return Promise.race([
      this.redisService!.getCachedUserProfile(clerkId),
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Redis timeout')), timeout)
      )
    ]).catch(() => null); // Return null on timeout or error
  }

  /**
   * ✅ CRITICAL FIX: Enhanced database fetch with clerk_id queries
   */
  private async fetchFromDatabaseWithRetry(clerkId: string, startTime: number): Promise<UserProfile | null> {
    for (let attempt = 0; attempt < this.MAX_CONNECTION_RETRIES; attempt++) {
      try {
        console.log(`[ProfileManager] 🔄 Fetching fresh profile from database for clerk_id: ${clerkId} (attempt ${attempt + 1})`);
        
        // ✅ CRITICAL FIX: Query by clerk_id instead of id
        const { data: profileData, error } = await this.supabase!
          .from('user_profiles')
          .select('*')
          .eq('clerk_id', clerkId) // ✅ FIXED: Use clerk_id
          .single();
        
        if (error) {
          if (error.code === 'PGRST116') {
            console.log(`[ProfileManager] ⚠️ No profile found for clerk_id: ${clerkId}`);
            return null;
          }
          throw error;
        }
        
        if (!profileData) {
          console.log(`[ProfileManager] ⚠️ Empty profile data from database for clerk_id: ${clerkId}`);
          return null;
        }
        
        console.log(`[ProfileManager] ✅ Profile found for ${clerkId}:`, {
          id: profileData.id,
          clerk_id: profileData.clerk_id,
          username: profileData.username,
          display_name: profileData.display_name
        });
        
        const validatedProfile = this.parseAndValidateProfile(profileData, clerkId);
        
        // ✅ ENHANCED: Check profile size before caching
        const profileSize = JSON.stringify(validatedProfile).length;
        if (profileSize > this.MAX_PROFILE_SIZE) {
          console.warn(`[ProfileManager] Profile ${clerkId} too large: ${profileSize} bytes, creating lightweight version`);
          const lightweightProfile = this.createLightweightProfile(validatedProfile);
          this.profileCache.set(clerkId, lightweightProfile);
          
          // Cache lightweight version in Redis too
          if (this.redisService) {
            const isFrequentlyUpdated = this.isFrequentlyUpdatedProfile(lightweightProfile);
            this.redisService.cacheUserProfile(clerkId, lightweightProfile, isFrequentlyUpdated)
              .catch(err => logger.debug(`Redis profile caching failed for ${clerkId}:`, err));
          }
          
          return lightweightProfile;
        } else {
          // Cache in both local and Redis
          this.profileCache.set(clerkId, validatedProfile);
          
          if (this.redisService) {
            const isFrequentlyUpdated = this.isFrequentlyUpdatedProfile(validatedProfile);
            this.redisService.cacheUserProfile(clerkId, validatedProfile, isFrequentlyUpdated)
              .catch(err => logger.debug(`Redis profile caching failed for ${clerkId}:`, err));
          }
        }
        
        const fetchTime = Date.now() - startTime;
        console.log(`[ProfileManager] ✅ Profile fetched from database and cached for ${clerkId} (${fetchTime}ms)`);
        
        this.connectionRetries = 0; // Reset retry counter on success
        return validatedProfile;
        
      } catch (err: any) {
        this.connectionRetries++;
        
        if (err.message && err.message.includes('fetch failed')) {
          console.error(`[ProfileManager] ❌ Database connection failed for ${clerkId} (attempt ${attempt + 1}):`, {
            message: err.message,
            code: err.code || 'UNKNOWN',
            clerkId: clerkId,
            attempt: attempt + 1
          });
          
          if (attempt < this.MAX_CONNECTION_RETRIES - 1) {
            console.log(`[ProfileManager] ⏳ Retrying database fetch for ${clerkId} in ${this.RETRY_DELAY}ms...`);
            await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
            continue;
          }
        } else {
          console.error(`[ProfileManager] ❌ Database error (non-network) for ${clerkId}:`, err);
          break; // Don't retry for non-network errors
        }
      }
    }
    
    console.error(`[ProfileManager] ❌ All database fetch attempts failed for ${clerkId}`);
    return null;
  }

  /**
   * ✅ CRITICAL FIX: Update user profile by clerk_id
   */
  async updateUserProfile(clerkId: string, updates: Partial<UserProfile>): Promise<boolean> {
    if (!this.supabase || !clerkId || this.isShuttingDown) {
      logger.debug(`Profile update skipped: supabase=${!!this.supabase}, clerkId=${!!clerkId}, shutting down=${this.isShuttingDown}`);
      return false;
    }

    try {
      console.log(`[ProfileManager] 🔄 Updating profile for clerk_id: ${clerkId}`, updates);

      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      // ✅ CRITICAL FIX: Update by clerk_id instead of id
      const { data, error } = await this.supabase
        .from('user_profiles')
        .update(updateData)
        .eq('clerk_id', clerkId) // ✅ FIXED: Use clerk_id
        .select()
        .single();

      if (error) {
        console.error(`[ProfileManager] ❌ Failed to update profile for ${clerkId}:`, error);
        return false;
      }

      if (!data) {
        console.warn(`[ProfileManager] ⚠️ No profile updated for clerk_id: ${clerkId}`);
        return false;
      }

      // ✅ ENHANCED: Smarter cache invalidation strategy
      // Instead of immediate invalidation, update the cache with new data
      const existingProfile = this.profileCache.get(clerkId);
      if (existingProfile) {
        const updatedProfile = { ...existingProfile, ...updateData };
        this.profileCache.set(clerkId, updatedProfile);
        console.log(`[ProfileManager] ✅ Updated local cache for ${clerkId} instead of invalidating`);
      }
      
      // ✅ DELAYED: Invalidate Redis cache after a short delay to allow for multiple rapid updates
      if (this.redisService) {
        setTimeout(async () => {
          try {
            await this.redisService!.invalidateUserProfile(clerkId);
            
            // Invalidate friends lists if display data changed
            if (updates.display_name !== undefined || updates.avatar_url !== undefined) {
              await this.invalidateFriendsListsContainingUser(clerkId);
            }
            
            // Update online status if status changed
            if (updates.status !== undefined) {
              const isOnline = updates.status === 'online';
              await this.redisService!.cacheUserOnlineStatus(clerkId, isOnline, new Date());
            }
            
          } catch (redisError) {
            logger.warn(`Redis cache invalidation failed for ${clerkId}:`, redisError);
          }
        }, 2000); // ✅ 2 second delay to batch multiple updates
      }

      console.log(`[ProfileManager] ✅ Updated profile for ${clerkId}`);
      return true;
    } catch (err) {
      console.error(`[ProfileManager] ❌ Exception updating profile for ${clerkId}:`, err);
      return false;
    }
  }

  /**
   * ✅ CRITICAL FIX: Create user profile with clerk_id
   */
  async createUserProfile(clerkId: string, username: string, displayName?: string): Promise<boolean> {
    if (!this.supabase || !clerkId || this.isShuttingDown) {
      logger.debug(`Profile creation skipped: supabase=${!!this.supabase}, clerkId=${!!clerkId}, shutting down=${this.isShuttingDown}`);
      return false;
    }

    // Validate username
    if (!username || username.length < 3 || username.length > 20) {
      console.error(`[ProfileManager] ❌ Invalid username for ${clerkId}: ${username}`);
      return false;
    }

    try {
      console.log(`[ProfileManager] 👤 Creating profile for clerk_id: ${clerkId}`, { username, displayName });

      // Check if profile already exists
      const existing = await this.fetchUserProfile(clerkId);
      if (existing) {
        console.warn(`[ProfileManager] ⚠️ Profile already exists for clerk_id: ${clerkId}`);
        return false;
      }

      // ✅ CRITICAL FIX: Create profile with clerk_id
      const { data, error } = await this.supabase
        .from('user_profiles')
        .insert({
          id: crypto.randomUUID(), // Generate new UUID for internal id
          clerk_id: clerkId, // ✅ FIXED: Store clerk_id
          username,
          display_name: displayName || username,
          status: 'offline',
          is_online: false,
          last_seen: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          profile_complete: true,
          display_name_color: this.DEFAULT_PROFILE_COLOR,
          display_name_animation: 'none',
          rainbow_speed: 3,
          blocked_users: [],
          badges: [],
          easy_customization_data: {}
        })
        .select()
        .single();

      if (error) {
        console.error(`[ProfileManager] ❌ Failed to create profile for ${clerkId}:`, error);
        return false;
      }

      console.log(`[ProfileManager] ✅ Created profile for ${clerkId}:`, {
        id: data.id,
        clerk_id: data.clerk_id,
        username: data.username
      });
      
      // Invalidate caches
      this.profileCache.delete(clerkId);
      if (this.redisService) {
        await this.redisService.invalidateUserProfile(clerkId);
      }
      
      return true;
    } catch (error) {
      console.error(`[ProfileManager] ❌ Exception creating profile for ${clerkId}:`, error);
      return false;
    }
  }

  /**
   * ✅ CRITICAL FIX: Delete user profile by clerk_id
   */
  async deleteUserProfile(clerkId: string): Promise<boolean> {
    if (!this.supabase || !clerkId || this.isShuttingDown) {
      logger.debug(`Profile deletion skipped: supabase=${!!this.supabase}, clerkId=${!!clerkId}, shutting down=${this.isShuttingDown}`);
      return false;
    }

    try {
      console.log(`[ProfileManager] 🗑️ Deleting profile for clerk_id: ${clerkId}`);

      // ✅ CRITICAL FIX: Delete by clerk_id instead of id
      const { error } = await this.supabase
        .from('user_profiles')
        .delete()
        .eq('clerk_id', clerkId); // ✅ FIXED: Use clerk_id

      if (error) {
        console.error(`[ProfileManager] ❌ Failed to delete profile for ${clerkId}:`, error);
        return false;
      }

      console.log(`[ProfileManager] ✅ Deleted profile for ${clerkId}`);
      
      // Clean up caches
      this.profileCache.delete(clerkId);
      if (this.redisService) {
        await Promise.all([
          this.redisService.invalidateUserProfile(clerkId),
          this.redisService.invalidateFriendsList(clerkId),
          this.redisService.cacheUserOnlineStatus(clerkId, false, new Date())
        ]);
      }
      
      return true;
    } catch (error) {
      console.error(`[ProfileManager] ❌ Exception deleting profile for ${clerkId}:`, error);
      return false;
    }
  }

 // ===== CRITICAL FIX 1: Database Connection Resilience =====
// Add this to your ProfileManager.updateUserStatus method

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
  
  // Add to batch queue (existing logic)
  this.statusUpdateQueue.push(statusUpdate);
  
  // ✅ FIXED: Update local cache immediately with new status
  const existingProfile = this.profileCache.get(authId);
  if (existingProfile) {
    existingProfile.status = status;
    existingProfile.is_online = status === 'online';
    existingProfile.last_seen = statusUpdate.lastSeen;
    this.profileCache.set(authId, existingProfile);
    logger.debug(`✅ Updated local cache status for ${authId}: ${status}`);
  }
  
  // ✅ FIXED: Enhanced Redis status update with timeout and fallback
  if (this.redisService) {
    try {
      // Use Promise.race to add timeout
      await Promise.race([
        Promise.allSettled([
          this.statusModule.setOnlineStatus(authId, status === 'online'),
          this.redisService.cacheUserOnlineStatus(authId, status === 'online', new Date())
        ]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 2000))
      ]);
      
      logger.debug(`📊 Status update cached for ${authId}: ${status}`);
    } catch (error) {
      // ✅ FIXED: Don't fail the entire operation if Redis fails
      logger.warn(`Redis status update failed for ${authId} (non-critical):`, error instanceof Error ? error.message : error);
      // Continue - local cache update was successful
    }
  }
  
  return true; // Return success as long as local update worked
}

  // ==================== EXISTING METHODS (keeping the rest of your implementation) ====================

  /**
   * ✅ NEW: Create lightweight version of profile by removing large data
   */
  private createLightweightProfile(profile: UserProfile): UserProfile {
    const lightweightProfile = { ...profile };
    
    // Remove or truncate large fields
    if (lightweightProfile.profile_card_css && lightweightProfile.profile_card_css.length > 5000) {
      lightweightProfile.profile_card_css = lightweightProfile.profile_card_css.substring(0, 5000) + '...';
    }
    
    if (lightweightProfile.avatar_url && lightweightProfile.avatar_url.startsWith('data:')) {
      // Remove base64 images - they're too large
      lightweightProfile.avatar_url = '';
    }
    
    if (lightweightProfile.banner_url && lightweightProfile.banner_url.startsWith('data:')) {
      // Remove base64 images - they're too large
      lightweightProfile.banner_url = '';
    }
    
    if (lightweightProfile.bio && lightweightProfile.bio.length > 500) {
      lightweightProfile.bio = lightweightProfile.bio.substring(0, 500) + '...';
    }
    
    // Simplify easy_customization_data
    if (lightweightProfile.easy_customization_data) {
      lightweightProfile.easy_customization_data = {
        version: lightweightProfile.easy_customization_data.version || 1,
        // Keep only essential data, remove large customization objects
      };
    }
    
    return lightweightProfile;
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
        .select('clerk_id, username, display_name, avatar_url, status, display_name_color')
        .gte('last_seen', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .eq('is_online', true)
        .limit(50);
      
      if (recentProfiles && recentProfiles.length > 0) {
        const cachePromises = recentProfiles.map(profile => 
          this.redisService!.cacheUserProfile(profile.clerk_id, profile as UserProfile, false)
            .catch(err => logger.debug(`Cache warming failed for ${profile.clerk_id}:`, err))
        );
        
        await Promise.allSettled(cachePromises);
        logger.info(`🔥 Warmed cache with ${recentProfiles.length} recent profiles`);
      }
    } catch (error) {
      logger.debug('Cache warming failed (non-critical):', error);
    }
  }

  // Background Redis sync to avoid blocking main thread
  private async syncToRedisInBackground(clerkId: string, profile: UserProfile): Promise<void> {
    if (!this.redisService) return;
    
    // Don't block - run in background
    setImmediate(async () => {
      try {
        const redisProfile = await this.redisService!.getCachedUserProfile(clerkId);
        if (!redisProfile) {
          const isFrequentlyUpdated = this.isFrequentlyUpdatedProfile(profile);
          await this.redisService!.cacheUserProfile(clerkId, profile, isFrequentlyUpdated);
          logger.debug(`📋 Background sync to Redis for ${clerkId}`);
        }
      } catch (error) {
        logger.debug(`Background Redis sync failed for ${clerkId}:`, error);
      }
    });
  }

  /**
   * Parse and validate profile data with consistent defaults and size limits
   */
  private parseAndValidateProfile(data: any, clerkId: string): UserProfile {
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
          ).slice(0, 10); // ✅ Limit to 10 badges max
        } else {
          logger.warn(`Invalid badges structure for ${clerkId}, expected array`);
          parsedBadges = [];
        }
      } catch (e) {
        logger.warn(`Badge parsing failed for ${clerkId}, using empty array:`, e);
        parsedBadges = [];
      }
    }

    // Parse easy customization data with size limits
    let parsedCustomizationData = {};
    if (data.easy_customization_data) {
      try {
        parsedCustomizationData = typeof data.easy_customization_data === 'string' 
          ? JSON.parse(data.easy_customization_data) 
          : data.easy_customization_data;
      } catch (e) {
        logger.warn(`Customization data parsing failed for ${clerkId}:`, e);
        parsedCustomizationData = {};
      }
    }

    // ✅ ENHANCED: Apply size limits to text fields
    const profile: UserProfile = {
      ...data,
      badges: parsedBadges,
      easy_customization_data: parsedCustomizationData,
      display_name_color: data.display_name_color || this.DEFAULT_PROFILE_COLOR,
      display_name_animation: data.display_name_animation || 'none',
      rainbow_speed: data.rainbow_speed || 3,
      status: data.status || 'online',
      blocked_users: data.blocked_users || [],
      // Apply size limits
      bio: data.bio ? data.bio.substring(0, 1000) : undefined, // Limit bio to 1000 chars
      profile_card_css: data.profile_card_css ? data.profile_card_css.substring(0, 10000) : undefined, // Limit CSS
    };
    
    return profile;
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
  private async invalidateFriendsListsContainingUser(userClerkId: string): Promise<void> {
    if (!this.supabase || !this.redisService) return;
    
    try {
      // ✅ FIXED: Query by clerk_id in both directions
      const { data: friendships } = await this.supabase
        .from('friendships')
        .select('user_id, friend_id')
        .or(`user_id.eq.${userClerkId},friend_id.eq.${userClerkId}`)
        .eq('status', 'accepted');
      
      if (friendships && friendships.length > 0) {
        const friendIds = friendships.map(f => 
          f.user_id === userClerkId ? f.friend_id : f.user_id
        ).filter(Boolean);
        
        const invalidationPromises = friendIds.map(friendId => 
          this.friendsModule.invalidateFriendsCache(friendId)
        );
        
        await Promise.allSettled(invalidationPromises);
        logger.debug(`👥 Invalidated friends lists for users containing ${userClerkId}`);
      }
    } catch (error) {
      logger.debug(`Failed to invalidate friends lists containing ${userClerkId}:`, error);
    }
  }

  /**
   * ✅ FIXED: Enhanced health check with proper error handling and no 401 errors
   */
  async testConnection(): Promise<{ 
    database: boolean; 
    redis?: boolean;
    overall: boolean;
    cachePerformance?: any;
    errors: string[];
    dbLatency?: number;
    redisLatency?: number;
  }> {
    const result: any = { overall: false, errors: [] };

    // ✅ FIXED: Test database connection using simple select that doesn't require auth
    if (!this.supabase) {
      result.database = false;
      result.errors.push('Supabase client not initialized');
    } else {
      try {
        console.log('[ProfileManager] 🔍 Testing database connection...');
        const startTime = Date.now();
        
        // ✅ FIXED: Use a simple query that doesn't trigger auth errors
        const { data, error } = await this.supabase
          .from('user_profiles')
          .select('id')
          .limit(1);
        
        const dbLatency = Date.now() - startTime;
        
        if (error) {
          console.error('[ProfileManager] ❌ Database test failed:', error);
          result.database = false;
          result.errors.push(`Database error: ${error.message}`);
        } else {
          console.log(`[ProfileManager] ✅ Database test passed (${dbLatency}ms)`);
          result.database = true;
          result.dbLatency = dbLatency;
        }
      } catch (error: any) {
        console.error('[ProfileManager] ❌ Database exception:', error.message);
        result.database = false;
        result.errors.push(`Database exception: ${error.message}`);
      }
    }

    // ✅ FIXED: Test Redis connection (optional)
    if (this.redisService) {
      try {
        const startTime = Date.now();
        result.redis = await this.redisService.testConnection();
        result.redisLatency = Date.now() - startTime;
        
        if (!result.redis) {
          result.errors.push('Redis connection failed');
        }
      } catch (error: any) {
        result.redis = false;
        result.errors.push(`Redis error: ${error.message}`);
      }
    }

    // Overall health - require database to be working
    result.overall = result.database && (!this.redisService || result.redis);
    
    console.log(`[ProfileManager] 📊 Health check completed:`, {
      database: result.database,
      redis: result.redis,
      overall: result.overall,
      errors: result.errors.length
    });
    
    return result;
  }

  // ==================== BATCH AND MONITORING METHODS ====================

  /**
   * Enhanced batch status updates with Redis coordination
   */
  private startBatchUpdates(): void {
    // ✅ SAFE: Only process status updates in memory, no database batch operations
    logger.info('📦 Starting safe batch status processing (memory only)');
    
    this.batchUpdateInterval = setInterval(() => {
      if (this.isShuttingDown) return;
      
      try {
        // ✅ SAFE: Only clear large queues to prevent memory issues
        if (this.statusUpdateQueue.length > 100) {
          logger.warn(`📦 Clearing large status update queue: ${this.statusUpdateQueue.length} items`);
          this.statusUpdateQueue = this.statusUpdateQueue.slice(-50); // Keep last 50
        }
        
        // ✅ SAFE: Process individual status updates to Redis only (no database)
        if (this.redisService && this.statusUpdateQueue.length > 0) {
          const batchSize = Math.min(this.statusUpdateQueue.length, 10);
          const batch = this.statusUpdateQueue.splice(0, batchSize);
          
          // Process batch to Redis only (safe operation)
          Promise.allSettled(
            batch.map(update => 
              this.redisService!.cacheUserOnlineStatus(
                update.authId, 
                update.status === 'online', 
                new Date()
              )
            )
          ).then(results => {
            const successful = results.filter(r => r.status === 'fulfilled').length;
            if (successful > 0) {
              logger.debug(`📦 Processed ${successful}/${batch.length} status updates to Redis`);
            }
          }).catch(err => {
            logger.debug('📦 Batch Redis status update failed (non-critical):', err);
          });
        }
      } catch (error) {
        logger.debug('📦 Batch processing error (non-critical):', error);
      }
    }, this.BATCH_UPDATE_INTERVAL);

    logger.info('📦 Safe batch status processing started');
  }

  /**
   * Enhanced periodic cleanup with Redis maintenance
   */
  private startPeriodicCleanup(): void {
    // ✅ SAFE: Only local cache cleanup, no database operations
    logger.info('🧹 Starting safe periodic cleanup (cache only)');
    
    this.cacheCleanupInterval = setInterval(() => {
      if (this.isShuttingDown) return;
      
      try {
        // ✅ SAFE: Local cache cleanup only
        const sizeBefore = this.profileCache.size();
        this.profileCache.cleanup(this.CACHE_DURATION);
        const sizeAfter = this.profileCache.size();
        
        if (sizeBefore !== sizeAfter) {
          logger.debug(`🗄️ Profile cache cleanup: ${sizeBefore} → ${sizeAfter} entries`);
        }
        
        // ✅ SAFE: Redis cleanup (optional, safe operation)
        if (this.redisService) {
          this.redisService.cleanup().catch(err => {
            logger.debug('🗄️ Redis cleanup failed (non-critical):', err);
          });
        }
      } catch (error) {
        logger.debug('🧹 Cache cleanup error (non-critical):', error);
      }
    }, 2 * 60 * 1000); // Every 2 minutes

    logger.info('🧹 Safe periodic cleanup started');
  }

  // ==================== STATUS METHODS (using StatusModule) ====================

  async getOnlineStatus(clerkId: string): Promise<{ isOnline: boolean; lastSeen?: string }> {
    return this.statusModule.getOnlineStatus(clerkId);
  }

  async getOnlineUsers(limit: number = 100): Promise<string[]> {
    return this.statusModule.getOnlineUsers();
  }

  async batchGetOnlineStatus(clerkIds: string[]): Promise<Record<string, boolean>> {
    return this.statusModule.batchGetOnlineStatus(clerkIds);
  }

  async batchSetOnlineStatus(updates: { authId: string; isOnline: boolean }[]): Promise<void> {
    if (!this.redisService || updates.length === 0) return;

    try {
      const pipeline = this.redisService.pipeline();
      updates.forEach(update => {
        pipeline.set(`user:${update.authId}:online`, update.isOnline ? 'true' : 'false');
      });
      await pipeline.exec();
      logger.debug(`✅ Batch online status updated for ${updates.length} users`);
    } catch (error) {
      logger.error('Batch online status update failed:', error);
    }
  }

  async bulkUpdateStatus(clerkIds: string[], status: UserStatus): Promise<number> {
    if (!this.supabase || clerkIds.length === 0) return 0;

    try {
      const startTime = Date.now();
      
      // ✅ FIXED: Update by clerk_id instead of id
      const { error, count } = await this.supabase
        .from('user_profiles')
        .update({
          status,
          last_seen: new Date().toISOString(),
          is_online: status === 'online',
          updated_at: new Date().toISOString()
        })
        .in('clerk_id', clerkIds); // ✅ FIXED: Use clerk_id

      if (error) {
        logger.error(`Bulk status update error:`, error);
        return 0;
      }

      clerkIds.forEach(clerkId => this.profileCache.delete(clerkId));

      if (this.redisService) {
        const updates = clerkIds.map(clerkId => ({
          authId: clerkId,
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

  async fetchUserFriends(clerkId: string): Promise<FriendData[]> {
    return this.friendsModule.getFriendsList(clerkId);
  }

  async getFriendshipStatus(user1ClerkId: string, user2ClerkId: string): Promise<any> {
    return this.friendsModule.getFriendshipStatus(user1ClerkId, user2ClerkId);
  }

  // ==================== SEARCH METHODS (using SearchModule) ====================

  async searchProfiles(query: string, limit: number = 10): Promise<UserProfile[]> {
    if (!query.trim()) return [];
    
    const results = await this.searchModule.searchUsers(query, limit);
    return results.map(result => this.parseAndValidateProfile(result, result.clerk_id));
  }

  async searchUsersToAddAsFriends(currentUserClerkId: string, searchTerm: string, limit: number = 20): Promise<UserProfile[]> {
    const results = await this.searchModule.searchUsers(searchTerm, limit);
    // Additional filtering logic for friends would go here
    return results.map(result => this.parseAndValidateProfile(result, result.clerk_id));
  }

  // ==================== BLOCKING METHODS (using BlockingModule) ====================

  async blockUser(blockerClerkId: string, blockedClerkId: string, reason?: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const success = await this.blockingModule.blockUser(blockerClerkId, blockedClerkId);
      
      // Invalidate friends cache for both users
      if (this.redisService && success) {
        await Promise.all([
          this.friendsModule.invalidateFriendsCache(blockerClerkId),
          this.friendsModule.invalidateFriendsCache(blockedClerkId)
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
   * Force refresh profile from database (bypass all caches)
   */
  async forceRefreshProfile(clerkId: string): Promise<UserProfile | null> {
    this.profileCache.delete(clerkId);
    
    if (this.redisService) {
      await this.redisService.invalidateUserProfile(clerkId);
    }
    
    return this.fetchUserProfile(clerkId);
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
      
      // ✅ SAFE: Only clear memory queues, no database operations during shutdown
      if (this.statusUpdateQueue.length > 0) {
        logger.info(`📦 Clearing ${this.statusUpdateQueue.length} pending status updates from memory`);
        this.statusUpdateQueue = [];
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
   * ✅ FIXED: All methods now use clerkId parameters
   */

  async fetchPendingFriendRequests(clerkId: string, type: 'received' | 'sent' = 'received'): Promise<any[]> {
    return this.friendsModule.getPendingFriendRequests(clerkId, type);
  }

  async sendFriendRequest(senderClerkId: string, receiverClerkId: string, message?: string): Promise<{
    success: boolean;
    message: string;
    autoAccepted?: boolean;
  }> {
    return this.friendsModule.sendFriendRequest(senderClerkId, receiverClerkId, message);
  }

  async acceptFriendRequest(requestId: string, acceptingUserClerkId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.friendsModule.acceptFriendRequest(requestId, acceptingUserClerkId);
  }

  async declineFriendRequest(requestId: string, decliningUserClerkId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.friendsModule.declineFriendRequest(requestId, decliningUserClerkId);
  }

  async removeFriend(user1ClerkId: string, user2ClerkId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.friendsModule.removeFriend(user1ClerkId, user2ClerkId);
  }

  async getMutualFriends(user1ClerkId: string, user2ClerkId: string): Promise<any[]> {
    return this.friendsModule.getMutualFriends(user1ClerkId, user2ClerkId);
  }

  async getFriendStats(clerkId: string): Promise<{
    friendCount: number;
    pendingSentCount: number;
    pendingReceivedCount: number;
    mutualFriendsWithRecent?: number;
  }> {
    return this.friendsModule.getFriendStats(clerkId);
  }

  async getOnlineFriendsCount(clerkId: string): Promise<number> {
    return this.friendsModule.getOnlineFriendsCount(clerkId);
  }
}