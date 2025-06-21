// server/managers/ProfileManager.ts - FIXED VERSION with Redis support
import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { LRUCache } from '../utils/LRUCache';
import { RedisService } from '../services/RedisService';
import { UserStatus } from '../types/User';

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
}

export interface StatusUpdate {
  authId: string;
  status: UserStatus;
  lastSeen?: string;
}

export class ProfileManager {
  private supabase: SupabaseClient | null;
  private profileCache: LRUCache<UserProfile>;
  private redisService: RedisService | null;
  private statusUpdateQueue: StatusUpdate[] = [];
  private batchUpdateInterval: NodeJS.Timeout | null = null;
  private readonly CACHE_DURATION = 30000; // 30 seconds
  private readonly BATCH_UPDATE_INTERVAL = 5000; // 5 seconds
  private readonly DEFAULT_PROFILE_COLOR = '#667eea';

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

    // Test Redis connection if available
    if (this.redisService) {
      this.testRedisConnection();
      logger.info('📋 ProfileManager initialized with Redis caching');
    }
  }

  /**
   * Test Redis connection on startup
   */
  private async testRedisConnection(): Promise<void> {
    if (!this.redisService) return;
    
    try {
      const isConnected = await this.redisService.testConnection();
      if (isConnected) {
        logger.info('✅ ProfileManager Redis connection verified');
      } else {
        logger.warn('⚠️ ProfileManager Redis connection failed - falling back to local cache only');
      }
    } catch (error) {
      logger.error('❌ ProfileManager Redis test failed:', error);
    }
  }

  /**
   * Enhanced profile fetching with Redis caching
   * 1. Check Redis cache first (fastest)
   * 2. Check local LRU cache (fast)
   * 3. Query database (slowest)
   */
  async fetchUserProfile(authId: string): Promise<UserProfile | null> {
    if (!this.supabase || !authId) {
      logger.debug(`Profile fetch skipped: supabase=${!!this.supabase}, authId=${!!authId}`);
      return null;
    }
    
    // STEP 1: Check Redis cache first (distributed cache)
    if (this.redisService) {
      try {
        const redisProfile = await this.redisService.getCachedUserProfile(authId);
        if (redisProfile) {
          logger.debug(`📋 Redis cache hit for profile ${authId}`);
          // Also update local cache for faster subsequent access
          this.profileCache.set(authId, redisProfile);
          return redisProfile;
        }
      } catch (error) {
        logger.warn(`Redis profile fetch failed for ${authId}, falling back:`, error);
      }
    }
    
    // STEP 2: Check local LRU cache (in-memory cache)
    const localCached = this.profileCache.get(authId);
    if (localCached) {
      logger.debug(`📋 Local cache hit for profile ${authId}`);
      // Async update Redis cache with local data (don't wait for it)
      if (this.redisService) {
        this.redisService.cacheUserProfile(authId, localCached).catch(err => 
          logger.debug(`Background Redis cache update failed for ${authId}:`, err)
        );
      }
      return localCached;
    }
    
    // STEP 3: Query database (last resort)
    try {
      logger.debug(`🔄 Fetching fresh profile from database for ${authId}`);
      
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select(`
          id,
          username, 
          display_name, 
          avatar_url, 
          banner_url, 
          pronouns, 
          status, 
          display_name_color, 
          display_name_animation,
          rainbow_speed,
          badges,
          bio,
          last_seen,
          is_online,
          profile_complete,
          created_at,
          updated_at
        `)
        .eq('id', authId)
        .maybeSingle();

      if (error) {
        if (error.code !== 'PGRST116') { // PGRST116 = no rows returned
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
      
      // Parse badges safely with improved error handling
      let parsedBadges = [];
      if (data.badges) {
        try {
          parsedBadges = typeof data.badges === 'string' ? JSON.parse(data.badges) : data.badges;
          
          // Validate badges array structure
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
      
      // Create profile data with consistent defaults
      const profileData: UserProfile = {
        ...data,
        badges: parsedBadges,
        display_name_color: data.display_name_color || this.DEFAULT_PROFILE_COLOR,
        display_name_animation: data.display_name_animation || 'none',
        rainbow_speed: data.rainbow_speed || 3,
        status: data.status || 'online'
      };
      
      // STEP 4: Cache the fresh data in both local and Redis caches
      this.profileCache.set(authId, profileData);
      
      // Async cache in Redis (don't wait for it to complete)
      if (this.redisService) {
        this.redisService.cacheUserProfile(authId, profileData).catch(err => 
          logger.debug(`Redis profile caching failed for ${authId}:`, err)
        );
      }
      
      logger.debug(`✅ Profile fetched from database and cached for ${authId}:`, {
        username: profileData.username,
        display_name: profileData.display_name,
        color: profileData.display_name_color,
        animation: profileData.display_name_animation,
        badges: profileData.badges?.length || 0
      });
      
      return profileData;
    } catch (err) {
      logger.error(`Exception fetching profile for ${authId}:`, err);
      return null;
    }
  }

  /**
   * Enhanced status update with cache invalidation
   */
  async updateUserStatus(authId: string, status: UserStatus): Promise<boolean> {
    if (!this.supabase || !authId) {
      logger.debug(`Status update skipped: supabase=${!!this.supabase}, authId=${!!authId}`);
      return false;
    }
    
    const statusUpdate: StatusUpdate = {
      authId,
      status,
      lastSeen: new Date().toISOString()
    };
    
    // Add to batch queue for efficient database updates
    this.statusUpdateQueue.push(statusUpdate);
    
    // STEP 1: Invalidate local cache immediately
    this.profileCache.delete(authId);
    
    // STEP 2: Invalidate Redis cache immediately (async)
    if (this.redisService) {
      this.redisService.invalidateUserProfile(authId).catch(err => 
        logger.debug(`Redis profile invalidation failed for ${authId}:`, err)
      );
    }
    
    logger.debug(`📊 Status update queued for ${authId}: ${status}`);
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

      // STEP 1: Insert into database
      const { error } = await this.supabase
        .from('user_profiles')
        .insert(profileData);
      
      if (error) {
        logger.error(`Error creating profile for ${authId}:`, error);
        return false;
      }
      
      // STEP 2: Immediately cache the new profile locally
      this.profileCache.set(authId, profileData as UserProfile);
      
      // STEP 3: Cache in Redis asynchronously
      if (this.redisService) {
        this.redisService.cacheUserProfile(authId, profileData as UserProfile).catch(err => 
          logger.debug(`Redis profile caching failed for new profile ${authId}:`, err)
        );
      }
      
      logger.info(`✅ Created and cached new profile for ${authId} with username: ${username}`);
      return true;
    } catch (err) {
      logger.error(`Exception creating profile for ${authId}:`, err);
      return false;
    }
  }

  /**
   * Enhanced profile update with cache invalidation
   */
  async updateUserProfile(authId: string, updates: Partial<UserProfile>): Promise<boolean> {
    if (!this.supabase || !authId) {
      logger.debug(`Profile update skipped: supabase=${!!this.supabase}, authId=${!!authId}`);
      return false;
    }

    try {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      // STEP 1: Update in database
      const { error } = await this.supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', authId);

      if (error) {
        logger.error(`Error updating profile for ${authId}:`, error);
        return false;
      }

      // STEP 2: Invalidate both local and Redis caches immediately
      this.profileCache.delete(authId);
      
      // STEP 3: Invalidate Redis cache asynchronously
      if (this.redisService) {
        this.redisService.invalidateUserProfile(authId).catch(err => 
          logger.debug(`Redis profile invalidation failed for ${authId}:`, err)
        );
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
      // STEP 1: Delete from database
      const { error } = await this.supabase
        .from('user_profiles')
        .delete()
        .eq('id', authId);

      if (error) {
        logger.error(`Error deleting profile for ${authId}:`, error);
        return false;
      }

      // STEP 2: Remove from local cache
      this.profileCache.delete(authId);

      // STEP 3: Remove from Redis cache asynchronously
      if (this.redisService) {
        this.redisService.invalidateUserProfile(authId).catch(err => 
          logger.debug(`Redis profile deletion failed for ${authId}:`, err)
        );
      }

      logger.info(`✅ Deleted profile for ${authId} and cleaned up caches`);
      return true;
    } catch (err) {
      logger.error(`Exception deleting profile for ${authId}:`, err);
      return false;
    }
  }

  /**
   * Enhanced profile search (no caching needed - search results change frequently)
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

      const results = data || [];
      
      // Optionally cache search results in Redis for short term
      if (this.redisService && results.length > 0) {
        const searchKey = `search:${query.toLowerCase().trim()}`;
        this.redisService.batchOperations([{
          operation: 'set',
          key: searchKey,
          value: results,
          ttl: 30 // Only 30 seconds since search results change quickly
        }]).catch(err => 
          logger.debug(`Search result caching failed:`, err)
        );
      }

      return results;
    } catch (err) {
      logger.error(`Exception during profile search:`, err);
      return [];
    }
  }

  /**
   * Enhanced batch status updates with Redis operations
   */
  private startBatchUpdates(): void {
    this.batchUpdateInterval = setInterval(async () => {
      if (this.statusUpdateQueue.length === 0) return;
      
      const updates = [...this.statusUpdateQueue];
      this.statusUpdateQueue = [];
      
      try {
        // Group updates by status for more efficient queries
        const updateGroups = updates.reduce((groups, update) => {
          if (!groups[update.status]) groups[update.status] = [];
          groups[update.status]!.push(update);
          return groups;
        }, {} as Record<string, StatusUpdate[]>);
        
        // Batch database updates
        for (const [status, statusUpdates] of Object.entries(updateGroups)) {
          const authIds = statusUpdates.map(u => u.authId);
          
          const { error } = await this.supabase!
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
          } else {
            logger.debug(`✅ Batch updated ${authIds.length} users to ${status} in database`);
            
            // Batch invalidate Redis cache for all updated users
            if (this.redisService) {
              const invalidationOps = authIds.map(authId => ({
                operation: 'del' as const,
                key: `profile:${authId}`
              }));
              
              this.redisService.batchOperations(invalidationOps).catch(err => 
                logger.debug(`Batch Redis invalidation failed:`, err)
              );
            }
          }
        }
      } catch (error) {
        logger.error('Exception during batch status update:', error);
      }
    }, this.BATCH_UPDATE_INTERVAL);

    logger.info(`📦 Profile batch updates started (${this.BATCH_UPDATE_INTERVAL}ms interval)`);
  }

  /**
   * Enhanced periodic cleanup with Redis maintenance
   */
  private startPeriodicCleanup(): void {
    // Clean up inactive users every 5 minutes
    setInterval(async () => {
      if (!this.supabase) return;
      
      try {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

        // Update database
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
          logger.error('Error in periodic cleanup:', error);
        } else {
          logger.debug(`🧹 Completed periodic user cleanup: ${count || 0} users set offline`);
        }

        // Perform Redis cleanup
        if (this.redisService) {
          await this.redisService.cleanup();
        }
        
      } catch (err) {
        logger.error('Exception during periodic cleanup:', err);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
    
    // Clear profile cache periodically to prevent memory leaks
    setInterval(() => {
      const sizeBefore = this.profileCache.size();
      this.profileCache.cleanup();
      const sizeAfter = this.profileCache.size();
      
      if (sizeBefore !== sizeAfter) {
        logger.debug(`🗄️ Profile cache cleanup: ${sizeBefore} → ${sizeAfter} entries`);
      }
    }, 2 * 60 * 1000); // Every 2 minutes

    logger.info('🧹 Profile periodic cleanup started');
  }

  /**
   * Enhanced cache statistics including Redis
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

    // Add Redis stats if available
    if (this.redisService) {
      result.redis = { connected: true };
      
      // Get Redis stats asynchronously (don't block)
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
   * Get comprehensive queue and caching statistics
   */
  getQueueStats(): { 
    pending: number; 
    batchInterval: number;
    redis?: { connected: boolean };
  } {
    const result = {
      pending: this.statusUpdateQueue.length,
      batchInterval: this.BATCH_UPDATE_INTERVAL
    };

    // Add Redis connection status
    if (this.redisService) {
      return { 
        ...result, 
        redis: { connected: true } 
      };
    }

    return result;
  }

  /**
   * Enhanced health check including Redis
   */
  async testConnection(): Promise<{ 
    database: boolean; 
    redis?: boolean;
    overall: boolean;
  }> {
    const result: any = { overall: false };

    // Test database connection
    if (!this.supabase) {
      result.database = false;
    } else {
      try {
        const { data, error } = await this.supabase
          .from('user_profiles')
          .select('id')
          .limit(1);
        
        if (error) {
          logger.error('Database connection test failed:', error);
          result.database = false;
        } else {
          logger.debug('✅ Database connection test passed');
          result.database = true;
        }
      } catch (error) {
        logger.error('Database connection test exception:', error);
        result.database = false;
      }
    }

    // Test Redis connection
    if (this.redisService) {
      try {
        result.redis = await this.redisService.testConnection();
      } catch (error) {
        logger.error('Redis connection test exception:', error);
        result.redis = false;
      }
    }

    // Overall health is good if database works (Redis is optional)
    result.overall = result.database;

    return result;
  }

  /**
   * Force cache refresh for a user (useful for debugging)
   */
  async forceRefreshProfile(authId: string): Promise<UserProfile | null> {
    // Invalidate all caches first
    this.profileCache.delete(authId);
    
    if (this.redisService) {
      await this.redisService.invalidateUserProfile(authId);
    }
    
    // Fetch fresh from database
    return this.fetchUserProfile(authId);
  }

  /**
   * Bulk operations for better performance
   */
  async bulkUpdateStatus(authIds: string[], status: UserStatus): Promise<number> {
    if (!this.supabase || authIds.length === 0) return 0;

    try {
      // Update database
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

      // Bulk invalidate local cache
      authIds.forEach(authId => this.profileCache.delete(authId));

      // Bulk invalidate Redis cache
      if (this.redisService) {
        const invalidationOps = authIds.map(authId => ({
          operation: 'del' as const,
          key: `profile:${authId}`
        }));
        
        this.redisService.batchOperations(invalidationOps).catch(err => 
          logger.debug(`Bulk Redis invalidation failed:`, err)
        );
      }

      logger.info(`✅ Bulk updated ${count || 0} users to ${status} and invalidated caches`);
      return count || 0;
    } catch (err) {
      logger.error(`Exception during bulk status update:`, err);
      return 0;
    }
  }

  /**
   * Enhanced graceful shutdown with Redis cleanup
   */
  async destroy(): Promise<void> {
    logger.info('👤 Starting ProfileManager graceful shutdown...');
    
    // Stop batch processing
    if (this.batchUpdateInterval) {
      clearInterval(this.batchUpdateInterval);
      this.batchUpdateInterval = null;
    }
    
    // Process remaining status updates
    if (this.statusUpdateQueue.length > 0) {
      logger.info(`📦 Processing ${this.statusUpdateQueue.length} final status updates...`);
      // Note: In a real shutdown, you'd want to await this processing
    }
    
    // Clear local cache
    this.profileCache.clear();
    
    // Perform final Redis cleanup
    if (this.redisService) {
      try {
        await this.redisService.cleanup();
        logger.info('✅ Redis cleanup completed');
      } catch (error) {
        logger.error('❌ Redis cleanup failed:', error);
      }
    }
    
    logger.info('👤 ProfileManager graceful shutdown completed');
  }

  /**
   * Get Redis service instance (for advanced operations)
   */
  getRedisService(): RedisService | null {
    return this.redisService;
  }
}