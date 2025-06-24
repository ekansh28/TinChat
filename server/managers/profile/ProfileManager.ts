// server/managers/profile/ProfileManager.ts - FIXED VERSION WITH COMPREHENSIVE ERROR HANDLING

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

// Re-export types for backward compatibility.
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
      logger.info('👤 Enhanced ProfileManager initialized with robust error handling');
    } else {
      logger.warn('👤 ProfileManager initialized without database connection');
    }

    if (this.redisService) {
      this.testRedisConnection();
      logger.info('📋 ProfileManager initialized with enhanced Redis caching');
    }
  }

  /**
   * ✅ ENHANCED: Enhanced profile fetching with better error handling and optimized caching
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
      
      // Background Redis cache sync if available (but don't wait for it)
      if (this.redisService) {
        this.syncToRedisInBackground(authId, localCached);
      }
      
      return localCached;
    }
    
    // TIER 2: Check Redis cache (medium speed) - but with timeout
    if (this.redisService) {
      try {
        const redisProfile = await this.fetchFromRedisWithTimeout(authId, 1000); // 1 second timeout
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
    
    // TIER 3: Fetch from database with enhanced error handling
    return await this.fetchFromDatabaseWithRetry(authId, startTime);
  }

  /**
   * ✅ NEW: Fetch from Redis with timeout to prevent hanging
   */
  private async fetchFromRedisWithTimeout(authId: string, timeout: number): Promise<UserProfile | null> {
    return Promise.race([
      this.redisService!.getCachedUserProfile(authId),
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Redis timeout')), timeout)
      )
    ]).catch(() => null); // Return null on timeout or error
  }

  /**
   * ✅ NEW: Enhanced database fetch with retry logic
   */
  private async fetchFromDatabaseWithRetry(authId: string, startTime: number): Promise<UserProfile | null> {
    for (let attempt = 0; attempt < this.MAX_CONNECTION_RETRIES; attempt++) {
      try {
        logger.debug(`🔄 Fetching fresh profile from database for ${authId} (attempt ${attempt + 1})`);
        
        const profileData = await this.databaseModule.fetchProfile(authId);
        
        if (!profileData) {
          logger.debug(`Empty profile data from database for ${authId}`);
          return null;
        }
        
        const validatedProfile = this.parseAndValidateProfile(profileData, authId);
        
        // ✅ ENHANCED: Check profile size before caching
        const profileSize = JSON.stringify(validatedProfile).length;
        if (profileSize > this.MAX_PROFILE_SIZE) {
          logger.warn(`Profile ${authId} too large: ${profileSize} bytes, creating lightweight version`);
          const lightweightProfile = this.createLightweightProfile(validatedProfile);
          this.profileCache.set(authId, lightweightProfile);
          
          // Cache lightweight version in Redis too
          if (this.redisService) {
            const isFrequentlyUpdated = this.isFrequentlyUpdatedProfile(lightweightProfile);
            this.redisService.cacheUserProfile(authId, lightweightProfile, isFrequentlyUpdated)
              .catch(err => logger.debug(`Redis profile caching failed for ${authId}:`, err));
          }
          
          return lightweightProfile;
        } else {
          // Cache in both local and Redis
          this.profileCache.set(authId, validatedProfile);
          
          if (this.redisService) {
            const isFrequentlyUpdated = this.isFrequentlyUpdatedProfile(validatedProfile);
            this.redisService.cacheUserProfile(authId, validatedProfile, isFrequentlyUpdated)
              .catch(err => logger.debug(`Redis profile caching failed for ${authId}:`, err));
          }
        }
        
        const fetchTime = Date.now() - startTime;
        logger.debug(`✅ Profile fetched from database and cached for ${authId} (${fetchTime}ms)`);
        
        this.connectionRetries = 0; // Reset retry counter on success
        return validatedProfile;
        
      } catch (err: any) {
        this.connectionRetries++;
        
        if (err.message && err.message.includes('fetch failed')) {
          logger.error(`❌ Database connection failed for ${authId} (attempt ${attempt + 1}):`, {
            message: err.message,
            code: err.code || 'UNKNOWN',
            authId: authId,
            attempt: attempt + 1
          });
          
          if (attempt < this.MAX_CONNECTION_RETRIES - 1) {
            logger.info(`⏳ Retrying database fetch for ${authId} in ${this.RETRY_DELAY}ms...`);
            await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
            continue;
          }
        } else {
          logger.error(`❌ Database error (non-network) for ${authId}:`, err);
          break; // Don't retry for non-network errors
        }
      }
    }
    
    logger.error(`❌ All database fetch attempts failed for ${authId}`);
    return null;
  }

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
   * ✅ ENHANCED: Profile update with better cache management
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

      // ✅ ENHANCED: Smarter cache invalidation strategy
      // Instead of immediate invalidation, update the cache with new data
      const existingProfile = this.profileCache.get(authId);
      if (existingProfile) {
        const updatedProfile = { ...existingProfile, ...updateData };
        this.profileCache.set(authId, updatedProfile);
        logger.debug(`✅ Updated local cache for ${authId} instead of invalidating`);
      }
      
      // ✅ DELAYED: Invalidate Redis cache after a short delay to allow for multiple rapid updates
      if (this.redisService) {
        setTimeout(async () => {
          try {
            await this.redisService!.invalidateUserProfile(authId);
            
            // Invalidate friends lists if display data changed
            if (updates.display_name !== undefined || updates.avatar_url !== undefined) {
              await this.invalidateFriendsListsContainingUser(authId);
            }
            
            // Update online status if status changed
            if (updates.status !== undefined) {
              const isOnline = updates.status === 'online';
              await this.redisService!.cacheUserOnlineStatus(authId, isOnline, new Date());
            }
            
          } catch (redisError) {
            logger.warn(`Redis cache invalidation failed for ${authId}:`, redisError);
          }
        }, 2000); // ✅ 2 second delay to batch multiple updates
      }

      logger.info(`✅ Updated profile for ${authId} with smart cache management`);
      return true;
    } catch (err) {
      logger.error(`Exception updating profile for ${authId}:`, err);
      return false;
    }
  }

    /**
 * Create a new user profile with basic required fields
 */
async createUserProfile(authId: string, username: string, displayName?: string): Promise<boolean> {
  if (!this.supabase || !authId || this.isShuttingDown) {
    logger.debug(`Profile creation skipped: supabase=${!!this.supabase}, authId=${!!authId}, shutting down=${this.isShuttingDown}`);
    return false;
  }

  // Validate username
  if (!username || username.length < 3 || username.length > 20) {
    logger.error(`Invalid username for ${authId}: ${username}`);
    return false;
  }

  try {
    const profileData: Partial<UserProfile> = {
      id: authId,
      username,
      display_name: displayName || username,
      status: 'offline',
      is_online: false,
      last_seen: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      profile_complete: false,
      display_name_color: this.DEFAULT_PROFILE_COLOR,
      display_name_animation: 'none',
      rainbow_speed: 3
    };

    const success = await this.databaseModule.createProfile(authId, profileData);

    if (success) {
      logger.info(`✅ Created new profile for ${authId} with username ${username}`);
      
      // Invalidate caches
      this.profileCache.delete(authId);
      if (this.redisService) {
        await this.redisService.invalidateUserProfile(authId);
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error(`Exception creating profile for ${authId}:`, error);
    return false;
  }
}

/**
 * Delete a user profile and clean up related data
 */
async deleteUserProfile(authId: string): Promise<boolean> {
  if (!this.supabase || !authId || this.isShuttingDown) {
    logger.debug(`Profile deletion skipped: supabase=${!!this.supabase}, authId=${!!authId}, shutting down=${this.isShuttingDown}`);
    return false;
  }

  try {
    const success = await this.databaseModule.deleteProfile(authId);

    if (success) {
      logger.info(`✅ Deleted profile for ${authId}`);
      
      // Clean up caches
      this.profileCache.delete(authId);
      if (this.redisService) {
        await Promise.all([
          this.redisService.invalidateUserProfile(authId),
          this.redisService.invalidateFriendsList(authId),
          this.redisService.cacheUserOnlineStatus(authId, false, new Date())
        ]);
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error(`Exception deleting profile for ${authId}:`, error);
    return false;
  }
}
  /**
   * ✅ ENHANCED: Status update with better error handling
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
    
    // ✅ ENHANCED: Update local cache immediately with new status
    const existingProfile = this.profileCache.get(authId);
    if (existingProfile) {
      existingProfile.status = status;
      existingProfile.is_online = status === 'online';
      existingProfile.last_seen = statusUpdate.lastSeen;
      this.profileCache.set(authId, existingProfile);
      logger.debug(`✅ Updated local cache status for ${authId}: ${status}`);
    }
    
    // ✅ ENHANCED: Update Redis status without full cache invalidation
    if (this.redisService) {
      try {
        await Promise.allSettled([
          this.statusModule.setOnlineStatus(authId, status === 'online'),
          // Don't invalidate the full profile, just update status-related caches
          this.redisService.cacheUserOnlineStatus(authId, status === 'online', new Date())
        ]);
        
        logger.debug(`📊 Status update cached for ${authId}: ${status}`);
      } catch (error) {
        logger.error(`Redis status update failed for ${authId}:`, error);
      }
    }
    
    return true;
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

  // Background Redis sync to avoid blocking main thread
  private async syncToRedisInBackground(authId: string, profile: UserProfile): Promise<void> {
    if (!this.redisService) return;
    
    // Don't block - run in background
    setImmediate(async () => {
      try {
        const redisProfile = await this.redisService!.getCachedUserProfile(authId);
        if (!redisProfile) {
          const isFrequentlyUpdated = this.isFrequentlyUpdatedProfile(profile);
          await this.redisService!.cacheUserProfile(authId, profile, isFrequentlyUpdated);
          logger.debug(`📋 Background sync to Redis for ${authId}`);
        }
      } catch (error) {
        logger.debug(`Background Redis sync failed for ${authId}:`, error);
      }
    });
  }

  /**
   * Parse and validate profile data with consistent defaults and size limits
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
          ).slice(0, 10); // ✅ Limit to 10 badges max
        } else {
          logger.warn(`Invalid badges structure for ${authId}, expected array`);
          parsedBadges = [];
        }
      } catch (e) {
        logger.warn(`Badge parsing failed for ${authId}, using empty array:`, e);
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
        logger.warn(`Customization data parsing failed for ${authId}:`, e);
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

  // ... (rest of the methods remain the same but with enhanced error handling)

  /**
   * Enhanced health check with comprehensive validation
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


    // Test database connection with simplified approach
    if (!this.supabase) {
      result.database = false;
      result.errors.push('Supabase client not initialized');
      logger.error('❌ ProfileManager: Supabase client not initialized');
    } else {
      try {
        logger.info('🔍 ProfileManager: Testing database connection...');
        const startTime = Date.now();
        
        // ✅ SIMPLIFIED: Use basic select query instead of complex validation
        const { data, error, count } = await this.supabase
          .from('user_profiles')
          .select('id', { count: 'exact', head: true });
        
        const dbLatency = Date.now() - startTime;
        
        if (error) {
          logger.error('❌ ProfileManager database test failed:', {
            code: error.code,
            message: error.message,
            details: error.details
          });
          
          result.database = false;
          result.errors.push(`Database error: ${error.message}`);
          
          // Provide specific guidance based on error type
          if (error.code === '42P01') {
            result.errors.push('Table user_profiles does not exist - run migrations');
          } else if (error.message?.includes('JWT') || error.code === '401') {
            result.errors.push('Authentication failed - check SUPABASE_SERVICE_ROLE_KEY');
          }
        } else {
          logger.info(`✅ ProfileManager database test passed (${dbLatency}ms, ${count} users)`);
          result.database = true;
          result.dbLatency = dbLatency;
        }
      } catch (error: any) {
        logger.error('❌ ProfileManager database test exception:', {
          message: error.message,
          name: error.name
        });
        result.database = false;
        result.errors.push(`Database exception: ${error.message}`);
      }
    }

    // Test Redis connection (simplified)
    if (this.redisService) {
      try {
        logger.debug('🔍 ProfileManager: Testing Redis connection...');
        const startTime = Date.now();
        result.redis = await this.redisService.testConnection();
        const redisLatency = Date.now() - startTime;
        result.redisLatency = redisLatency;
        
        if (result.redis) {
          logger.debug(`✅ ProfileManager Redis test passed (${redisLatency}ms)`);
          
          // Test basic cache operations (simplified)
          try {
            const testKey = 'test_profile_manager';
            const testData = { id: 'test', username: 'test_user' };
            
            const cacheStartTime = Date.now();
            await this.redisService.set(testKey, testData, 10); // 10 second TTL
            const cached = await this.redisService.get(testKey);
            await this.redisService.del(testKey);
            const cacheLatency = Date.now() - cacheStartTime;
            
            result.cachePerformance = {
              writeReadDeleteLatency: cacheLatency,
              cacheWorking: !!cached,
              operationsSuccessful: true
            };
            logger.debug(`✅ ProfileManager Redis cache test passed (${cacheLatency}ms)`);
          } catch (cacheError) {
            logger.warn('⚠️ ProfileManager Redis cache operations failed:', cacheError);
            result.cachePerformance = { operationsSuccessful: false };
            result.errors.push('Redis cache operations failed');
          }
        } else {
          logger.warn('⚠️ ProfileManager Redis connection test failed');
          result.errors.push('Redis connection test failed');
        }
      } catch (error: any) {
        logger.error('❌ ProfileManager Redis test exception:', error);
        result.redis = false;
        result.errors.push(`Redis exception: ${error.message}`);
      }
    } else {
      logger.debug('📋 ProfileManager: Redis not configured');
      result.redis = undefined;
    }

    // Determine overall health
    result.overall = result.database && (!this.redisService || result.redis);
    
    const healthStatus = result.overall ? 'HEALTHY' : 'DEGRADED';
    logger.info(`📊 ProfileManager health check complete: ${healthStatus}`, {
      database: result.database,
      redis: result.redis,
      errors: result.errors,
      dbLatency: result.dbLatency,
      redisLatency: result.redisLatency
    });
    
    return result;
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

  // ==================== STATUS METHODS (using StatusModule) ====================

  async getOnlineStatus(authId: string): Promise<{ isOnline: boolean; lastSeen?: string }> {
    return this.statusModule.getOnlineStatus(authId);
  }

  async getOnlineUsers(limit: number = 100): Promise<string[]> {
    return this.statusModule.getOnlineUsers();
  }

  async batchGetOnlineStatus(authIds: string[]): Promise<Record<string, boolean>> {
    return this.statusModule.batchGetOnlineStatus(authIds);
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
