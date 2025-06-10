// server/managers/ProfileManager.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { LRUCache } from '../utils/LRUCache';

export interface UserProfile {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  banner_url?: string;
  pronouns?: string;
  status?: 'online' | 'idle' | 'dnd' | 'offline';
  display_name_color?: string;
  display_name_animation?: string;
  rainbow_speed?: number;
  badges?: any[];
  bio?: string;
  last_seen?: string;
  is_online?: boolean;
}

export interface StatusUpdate {
  authId: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  lastSeen?: string;
}

export class ProfileManager {
  private supabase: SupabaseClient | null;
  private profileCache: LRUCache<UserProfile>;
  private statusUpdateQueue: StatusUpdate[] = [];
  private batchUpdateInterval: NodeJS.Timeout | null = null;
  private readonly CACHE_DURATION = 30000; // 30 seconds
  private readonly BATCH_UPDATE_INTERVAL = 5000; // 5 seconds

  constructor(supabase: SupabaseClient | null) {
    this.supabase = supabase;
    this.profileCache = new LRUCache<UserProfile>(1000); // Cache up to 1000 profiles
    
    if (this.supabase) {
      this.startBatchUpdates();
      this.startPeriodicCleanup();
    }
  }

  async fetchUserProfile(authId: string): Promise<UserProfile | null> {
    if (!this.supabase || !authId) return null;  
    // Check cache first
    const cached = this.profileCache.get(authId);
    if (cached) {
      return cached; // LRUCache already returns the data directly
    }
    
    try {
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
          is_online
        `)
        .eq('id', authId)
        .maybeSingle();

      if (error) {
        if (error.code !== 'PGRST116') {
          logger.error(`Error fetching profile for ${authId}:`, error);
        }
        return null;
      }
      
      if (!data) return null;
      
      // Parse badges safely
      let parsedBadges = [];
      if (data.badges) {
        try {
          parsedBadges = typeof data.badges === 'string' ? JSON.parse(data.badges) : data.badges;
          if (!Array.isArray(parsedBadges)) parsedBadges = [];
        } catch (e) {
          logger.warn(`Failed to parse badges for ${authId}:`, e);
          parsedBadges = [];
        }
      }
      
      const profileData: UserProfile = {
        ...data,
        badges: parsedBadges
      };
      
      // Cache the result
      this.profileCache.set(authId, profileData);
      
      return profileData;
    } catch (err) {
      logger.error(`Exception fetching profile for ${authId}:`, err);
      return null;
    }
  }

  async updateUserStatus(authId: string, status: 'online' | 'idle' | 'dnd' | 'offline'): Promise<boolean> {
    if (!this.supabase || !authId) return false;
    
    const statusUpdate: StatusUpdate = {
      authId,
      status,
      lastSeen: new Date().toISOString()
    };
    
    // Add to batch queue for efficient updates
    this.statusUpdateQueue.push(statusUpdate);
    
    // Clear cache entry so next fetch gets fresh data
    this.profileCache.delete(authId);
    
    return true;
  }

  private startBatchUpdates(): void {
    this.batchUpdateInterval = setInterval(async () => {
      if (this.statusUpdateQueue.length === 0) return;
      
      const updates = [...this.statusUpdateQueue];
      this.statusUpdateQueue = [];
      
      try {
        // Group updates by status for more efficient queries
        const updateGroups = updates.reduce((groups, update) => {
          if (!groups[update.status]) groups[update.status] = [];
          groups[update.status].push(update);
          return groups;
        }, {} as Record<string, StatusUpdate[]>);
        
        for (const [status, statusUpdates] of Object.entries(updateGroups)) {
          const authIds = statusUpdates.map(u => u.authId);
          
          const { error } = await this.supabase!
            .from('user_profiles')
            .update({
              status: status as any,
              last_seen: new Date().toISOString(),
              is_online: status === 'online'
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
  }

  private startPeriodicCleanup(): void {
    // Clean up inactive users every 5 minutes
    setInterval(async () => {
      if (!this.supabase) return;
      
      try {
        const { error } = await this.supabase
          .from('user_profiles')
          .update({ 
            status: 'offline',
            is_online: false,
            updated_at: new Date().toISOString()
          })
          .lt('last_seen', new Date(Date.now() - 10 * 60 * 1000).toISOString()) // 10 minutes ago
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
      this.profileCache.cleanup();
      logger.debug(`🗄️  Profile cache size after cleanup: ${this.profileCache.size()}`);
    }, 2 * 60 * 1000); // Every 2 minutes
  }

  async createUserProfile(authId: string, username: string, displayName?: string): Promise<boolean> {
    if (!this.supabase || !authId || !username) return false;
    
    try {
      const { error } = await this.supabase
        .from('user_profiles')
        .insert({
          id: authId,
          username: username.trim(),
          display_name: displayName?.trim() || null,
          status: 'online',
          is_online: true,
          created_at: new Date().toISOString(),
          last_seen: new Date().toISOString()
        });
      
      if (error) {
        logger.error(`Error creating profile for ${authId}:`, error);
        return false;
      }
      
      logger.info(`✅ Created new profile for ${authId} with username: ${username}`);
      return true;
    } catch (err) {
      logger.error(`Exception creating profile for ${authId}:`, err);
      return false;
    }
  }

  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.profileCache.size(),
      hitRate: this.profileCache.getHitRate()
    };
  }

  destroy(): void {
    if (this.batchUpdateInterval) {
      clearInterval(this.batchUpdateInterval);
    }
    this.profileCache.clear();
  }
}