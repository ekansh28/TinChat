// server/managers/profile/modules/ProfileDatabaseModule.ts - ENHANCED VERSION
import { SupabaseClient } from '@supabase/supabase-js';
import { UserProfile } from '../ProfileManager';
import { logger } from '../../../utils/logger';

export class ProfileDatabaseModule {
  private supabase: SupabaseClient | null;

  constructor(supabase: SupabaseClient | null) {
    this.supabase = supabase;
  }

  async fetchProfile(authId: string): Promise<UserProfile | null> {
    if (!this.supabase) return null;

    try {
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
        }
        return null;
      }
      
      return data;
    } catch (error) {
      logger.error(`Database profile fetch exception for ${authId}:`, error);
      return null;
    }
  }

  async createProfile(authId: string, profileData: Partial<UserProfile>): Promise<UserProfile | null> {
    if (!this.supabase) return null;

    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .insert({ ...profileData, id: authId })
        .select()
        .single();

      if (error) {
        logger.error(`Database profile creation error for ${authId}:`, error);
        return null;
      }
      
      return data;
    } catch (error) {
      logger.error(`Database profile creation exception for ${authId}:`, error);
      return null;
    }
  }

  async updateProfile(authId: string, updates: Partial<UserProfile>): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      const { error } = await this.supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', authId);

      if (error) {
        logger.error(`Database profile update error for ${authId}:`, error);
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error(`Database profile update exception for ${authId}:`, error);
      return false;
    }
  }

  async deleteProfile(authId: string): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      const { error } = await this.supabase
        .from('user_profiles')
        .delete()
        .eq('id', authId);

      if (error) {
        logger.error(`Database profile deletion error for ${authId}:`, error);
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error(`Database profile deletion exception for ${authId}:`, error);
      return false;
    }
  }

  async batchUpdateProfiles(updates: Array<{ authId: string; data: Partial<UserProfile> }>): Promise<number> {
    if (!this.supabase || updates.length === 0) return 0;

    try {
      let successCount = 0;
      
      // Process in batches to avoid overwhelming the database
      const BATCH_SIZE = 50;
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        
        const results = await Promise.allSettled(
          batch.map(({ authId, data }) => this.updateProfile(authId, data))
        );
        
        successCount += results.filter(result => 
          result.status === 'fulfilled' && result.value === true
        ).length;
      }
      
      logger.debug(`✅ Batch updated ${successCount}/${updates.length} profiles`);
      return successCount;
    } catch (error) {
      logger.error('Database batch profile update exception:', error);
      return 0;
    }
  }

  async searchProfiles(query: string, limit: number = 20): Promise<UserProfile[]> {
    if (!this.supabase || !query.trim()) return [];

    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select(`
          id, username, display_name, avatar_url, status, 
          display_name_color, display_name_animation, badges, is_online
        `)
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(limit);

      if (error) {
        logger.error(`Database profile search error:`, error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error(`Database profile search exception:`, error);
      return [];
    }
  }

  async getOnlineProfiles(limit: number = 100): Promise<UserProfile[]> {
    if (!this.supabase) return [];
    
    try {
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
        logger.error('Database online profiles fetch error:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      logger.error('Database online profiles fetch exception:', error);
      return [];
    }
  }

  async getProfilesByIds(authIds: string[]): Promise<UserProfile[]> {
    if (!this.supabase || authIds.length === 0) return [];

    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select(`
          id, username, display_name, avatar_url, status,
          display_name_color, display_name_animation, badges, is_online
        `)
        .in('id', authIds);

      if (error) {
        logger.error('Database batch profile fetch error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Database batch profile fetch exception:', error);
      return [];
    }
  }

  async updateLastSeen(authIds: string[], timestamp?: Date): Promise<boolean> {
    if (!this.supabase || authIds.length === 0) return false;

    try {
      const lastSeen = timestamp ? timestamp.toISOString() : new Date().toISOString();
      
      const { error } = await this.supabase
        .from('user_profiles')
        .update({ 
          last_seen: lastSeen,
          updated_at: new Date().toISOString()
        })
        .in('id', authIds);

      if (error) {
        logger.error('Database last seen update error:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Database last seen update exception:', error);
      return false;
    }
  }

  async setUsersOffline(authIds: string[]): Promise<number> {
    if (!this.supabase || authIds.length === 0) return 0;

    try {
      const { error, count } = await this.supabase
        .from('user_profiles')
        .update({
          status: 'offline',
          is_online: false,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .in('id', authIds);

      if (error) {
        logger.error('Database set users offline error:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      logger.error('Database set users offline exception:', error);
      return 0;
    }
  }

  async getProfileStats(): Promise<{
    totalProfiles: number;
    onlineProfiles: number;
    recentlyActive: number;
    completeProfiles: number;
  }> {
    if (!this.supabase) {
      return {
        totalProfiles: 0,
        onlineProfiles: 0,
        recentlyActive: 0,
        completeProfiles: 0
      };
    }

    try {
      const [totalResult, onlineResult, recentResult, completeResult] = await Promise.allSettled([
        this.supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
        this.supabase.from('user_profiles').select('id', { count: 'exact', head: true }).eq('is_online', true),
        this.supabase.from('user_profiles').select('id', { count: 'exact', head: true })
          .gte('last_seen', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        this.supabase.from('user_profiles').select('id', { count: 'exact', head: true }).eq('profile_complete', true)
      ]);

      return {
        totalProfiles: totalResult.status === 'fulfilled' ? totalResult.value.count || 0 : 0,
        onlineProfiles: onlineResult.status === 'fulfilled' ? onlineResult.value.count || 0 : 0,
        recentlyActive: recentResult.status === 'fulfilled' ? recentResult.value.count || 0 : 0,
        completeProfiles: completeResult.status === 'fulfilled' ? completeResult.value.count || 0 : 0
      };
    } catch (error) {
      logger.error('Database profile stats exception:', error);
      return {
        totalProfiles: 0,
        onlineProfiles: 0,
        recentlyActive: 0,
        completeProfiles: 0
      };
    }
  }

  async cleanupStaleProfiles(staleThreshold: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    if (!this.supabase) return 0;

    try {
      const staleDate = new Date(Date.now() - staleThreshold).toISOString();
      
      const { error, count } = await this.supabase
        .from('user_profiles')
        .update({
          status: 'offline',
          is_online: false,
          updated_at: new Date().toISOString()
        })
        .lt('last_seen', staleDate)
        .neq('status', 'offline');

      if (error) {
        logger.error('Database stale profile cleanup error:', error);
        return 0;
      }

      if (count && count > 0) {
        logger.info(`🧹 Set ${count} stale profiles offline`);
      }

      return count || 0;
    } catch (error) {
      logger.error('Database stale profile cleanup exception:', error);
      return 0;
    }
  }
}