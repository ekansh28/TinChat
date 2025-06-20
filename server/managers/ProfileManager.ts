// server/managers/ProfileManager.ts - Handles ALL profile operations
import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { LRUCache } from '../utils/LRUCache';
import { UserStatus } from '../types/User';
import { User } from '../types/User'; // or '@/types/User' if you use path aliases
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
  private statusUpdateQueue: StatusUpdate[] = [];
  private batchUpdateInterval: NodeJS.Timeout | null = null;
  private readonly CACHE_DURATION = 30000; // 30 seconds
  private readonly BATCH_UPDATE_INTERVAL = 5000; // 5 seconds
  private readonly DEFAULT_PROFILE_COLOR = '#667eea'; // Consistent with client

  constructor(supabase: SupabaseClient | null) {
    this.supabase = supabase;
    this.profileCache = new LRUCache<UserProfile>(1000); // Cache up to 1000 profiles
    
    if (this.supabase) {
      this.startBatchUpdates();
      this.startPeriodicCleanup();
      logger.info('👤 ProfileManager initialized with database connection');
    } else {
      logger.warn('👤 ProfileManager initialized without database connection');
    }
  }

  async fetchUserProfile(authId: string): Promise<UserProfile | null> {
    if (!this.supabase || !authId) {
      logger.debug(`Profile fetch skipped: supabase=${!!this.supabase}, authId=${!!authId}`);
      return null;
    }
    
    // Check cache first
    const cached = this.profileCache.get(authId);
    if (cached) {
      logger.debug(`📋 Profile cache hit for ${authId}`);
      return cached;
    }
    
    try {
      logger.debug(`🔄 Fetching fresh profile for ${authId}`);
      
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
          logger.error(`Profile fetch error for ${authId}:`, error);
        } else {
          logger.debug(`No profile found for ${authId}`);
        }
        return null;
      }
      
      if (!data) {
        logger.debug(`Empty profile data for ${authId}`);
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
      
      // Cache the result
      this.profileCache.set(authId, profileData);
      
      logger.debug(`✅ Profile fetched and cached for ${authId}:`, {
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
    
    // Add to batch queue for efficient updates
    this.statusUpdateQueue.push(statusUpdate);
    
    // Clear cache entry so next fetch gets fresh data
    this.profileCache.delete(authId);
    
    logger.debug(`📊 Status update queued for ${authId}: ${status}`);
    return true;
  }

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
      
      // Cache the new profile
      this.profileCache.set(authId, profileData as UserProfile);
      
      logger.info(`✅ Created new profile for ${authId} with username: ${username}`);
      return true;
    } catch (err) {
      logger.error(`Exception creating profile for ${authId}:`, err);
      return false;
    }
  }

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

      const { error } = await this.supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', authId);

      if (error) {
        logger.error(`Error updating profile for ${authId}:`, error);
        return false;
      }

      // Invalidate cache so next fetch gets fresh data
      this.profileCache.delete(authId);

      logger.info(`✅ Updated profile for ${authId}`);
      return true;
    } catch (err) {
      logger.error(`Exception updating profile for ${authId}:`, err);
      return false;
    }
  }

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

      // Remove from cache
      this.profileCache.delete(authId);

      logger.info(`✅ Deleted profile for ${authId}`);
      return true;
    } catch (err) {
      logger.error(`Exception deleting profile for ${authId}:`, err);
      return false;
    }
  }

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

      return data || [];
    } catch (err) {
      logger.error(`Exception during profile search:`, err);
      return [];
    }
  }

  private startBatchUpdates(): void {
    this.batchUpdateInterval = setInterval(async () => {
      if (this.statusUpdateQueue.length === 0) return;
      
      const updates = [...this.statusUpdateQueue];
      this.statusUpdateQueue = [];
      
      try {
        // Group updates by status for more efficient queries
        const updateGroups = updates.reduce((groups, update) => {
            // Replace line 324 in ProfileManager.ts
            if (!groups[update.status]) groups[update.status] = [];
            groups[update.status]!.push(update);
          return groups;
        }, {} as Record<string, StatusUpdate[]>);
        
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
            logger.debug(`✅ Batch updated ${authIds.length} users to ${status}`);
          }
        }
      } catch (error) {
        logger.error('Exception during batch status update:', error);
      }
    }, this.BATCH_UPDATE_INTERVAL);

    logger.info(`📦 Profile batch updates started (${this.BATCH_UPDATE_INTERVAL}ms interval)`);
  }

  private startPeriodicCleanup(): void {
    // Clean up inactive users every 5 minutes
    setInterval(async () => {
      if (!this.supabase) return;
      
      try {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

        const { error } = await this.supabase
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
          logger.debug('🧹 Completed periodic user cleanup');
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

  // Statistics and monitoring
  getCacheStats(): { size: number; hitRate: number; capacity: number } {
    return {
      size: this.profileCache.size(),
      hitRate: this.profileCache.getHitRate(),
      capacity: 1000
    };
  }

  getQueueStats(): { pending: number; batchInterval: number } {
    return {
      pending: this.statusUpdateQueue.length,
      batchInterval: this.BATCH_UPDATE_INTERVAL
    };
  }

  // Health check
  async testConnection(): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('id')
        .limit(1);
      
      if (error) {
        logger.error('Database connection test failed:', error);
        return false;
      }
      
      logger.debug('✅ Database connection test passed');
      return true;
    } catch (error) {
      logger.error('Database connection test exception:', error);
      return false;
    }
  }

  // Force cache refresh for a user
  invalidateCache(authId: string): void {
    this.profileCache.delete(authId);
    logger.debug(`🗑️ Cache invalidated for ${authId}`);
  }

  // Bulk operations
  async bulkUpdateStatus(authIds: string[], status: UserStatus): Promise<number> {
    if (!this.supabase || authIds.length === 0) return 0;

    try {
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

      // Invalidate cache for all updated users
      authIds.forEach(authId => this.profileCache.delete(authId));

      logger.info(`✅ Bulk updated ${count || 0} users to ${status}`);
      return count || 0;
    } catch (err) {
      logger.error(`Exception during bulk status update:`, err);
      return 0;
    }
  }

  // Graceful shutdown
  destroy(): void {
    if (this.batchUpdateInterval) {
      clearInterval(this.batchUpdateInterval);
      this.batchUpdateInterval = null;
    }
    
    // Process remaining status updates
    if (this.statusUpdateQueue.length > 0) {
      logger.info(`📦 Processing ${this.statusUpdateQueue.length} final status updates...`);
      // Note: In a real shutdown, you'd want to await this
    }
    
    this.profileCache.clear();
    logger.info('👤 ProfileManager destroyed');
  }
}