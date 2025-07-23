// server/managers/profile/modules/ProfileDatabaseModule.ts - ENHANCED VERSION WITH FIXED AUTH
import { SupabaseClient } from '@supabase/supabase-js';
import { UserProfile } from '../ProfileManager';
import { logger } from '../../../utils/logger';

export class ProfileDatabaseModule {
  private supabase: SupabaseClient | null;

  constructor(supabase: SupabaseClient | null) {
    this.supabase = supabase;
  }

  async fetchProfile(authId: string): Promise<UserProfile | null> {
    if (!this.supabase) {
      logger.debug('ProfileDatabaseModule: No Supabase client available');
      return null;
    }

    if (!authId || authId.trim() === '') {
      logger.debug('ProfileDatabaseModule: Invalid authId provided');
      return null;
    }

    try {
      logger.debug(`ProfileDatabaseModule: Fetching profile for ${authId}`);
      
      // ✅ FIXED: Use the exact same query structure that works in PowerShell
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
        // ✅ IMPROVED: Better error handling
        if (error.code === 'PGRST116') {
          logger.debug(`ProfileDatabaseModule: No profile found for ${authId}`);
          return null;
        }
        
        logger.error(`ProfileDatabaseModule: Database error for ${authId}:`, {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return null;
      }
      
      if (!data) {
        logger.debug(`ProfileDatabaseModule: No data returned for ${authId}`);
        return null;
      }

      logger.debug(`ProfileDatabaseModule: Successfully fetched profile for ${authId}`);
      return data as UserProfile;
      
    } catch (error: any) {
      logger.error(`ProfileDatabaseModule: Exception fetching profile for ${authId}:`, {
        message: error.message,
        name: error.name,
        cause: error.cause
      });
      return null;
    }
  }

  async createProfile(authId: string, profileData: Partial<UserProfile>): Promise<UserProfile | null> {
    if (!this.supabase) {
      logger.debug('ProfileDatabaseModule: No Supabase client available for create');
      return null;
    }

    if (!authId || authId.trim() === '') {
      logger.debug('ProfileDatabaseModule: Invalid authId provided for create');
      return null;
    }

    try {
      logger.debug(`ProfileDatabaseModule: Creating profile for ${authId}`);
      
      const { data, error } = await this.supabase
        .from('user_profiles')
        .insert({ ...profileData, id: authId })
        .select()
        .single();

      if (error) {
        logger.error(`ProfileDatabaseModule: Create error for ${authId}:`, {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return null;
      }
      
      logger.info(`ProfileDatabaseModule: Successfully created profile for ${authId}`);
      return data as UserProfile;
      
    } catch (error: any) {
      logger.error(`ProfileDatabaseModule: Exception creating profile for ${authId}:`, {
        message: error.message,
        name: error.name,
        cause: error.cause
      });
      return null;
    }
  }

  async updateProfile(authId: string, updates: Partial<UserProfile>): Promise<boolean> {
    if (!this.supabase) {
      logger.debug('ProfileDatabaseModule: No Supabase client available for update');
      return false;
    }

    if (!authId || authId.trim() === '') {
      logger.debug('ProfileDatabaseModule: Invalid authId provided for update');
      return false;
    }

    try {
      logger.debug(`ProfileDatabaseModule: Updating profile for ${authId}`);
      
      const { error } = await this.supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', authId);

      if (error) {
        logger.error(`ProfileDatabaseModule: Update error for ${authId}:`, {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return false;
      }
      
      logger.debug(`ProfileDatabaseModule: Successfully updated profile for ${authId}`);
      return true;
      
    } catch (error: any) {
      logger.error(`ProfileDatabaseModule: Exception updating profile for ${authId}:`, {
        message: error.message,
        name: error.name,
        cause: error.cause
      });
      return false;
    }
  }

  async deleteProfile(authId: string): Promise<boolean> {
    if (!this.supabase) {
      logger.debug('ProfileDatabaseModule: No Supabase client available for delete');
      return false;
    }

    if (!authId || authId.trim() === '') {
      logger.debug('ProfileDatabaseModule: Invalid authId provided for delete');
      return false;
    }

    try {
      logger.debug(`ProfileDatabaseModule: Deleting profile for ${authId}`);
      
      const { error } = await this.supabase
        .from('user_profiles')
        .delete()
        .eq('id', authId);

      if (error) {
        logger.error(`ProfileDatabaseModule: Delete error for ${authId}:`, {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return false;
      }
      
      logger.info(`ProfileDatabaseModule: Successfully deleted profile for ${authId}`);
      return true;
      
    } catch (error: any) {
      logger.error(`ProfileDatabaseModule: Exception deleting profile for ${authId}:`, {
        message: error.message,
        name: error.name,
        cause: error.cause
      });
      return false;
    }
  }

  async batchUpdateProfiles(updates: Array<{ authId: string; data: Partial<UserProfile> }>): Promise<number> {
    if (!this.supabase || updates.length === 0) {
      return 0;
    }

    try {
      logger.debug(`ProfileDatabaseModule: Batch updating ${updates.length} profiles`);
      
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
      
      logger.debug(`ProfileDatabaseModule: Batch updated ${successCount}/${updates.length} profiles`);
      return successCount;
      
    } catch (error: any) {
      logger.error('ProfileDatabaseModule: Batch update exception:', {
        message: error.message,
        name: error.name
      });
      return 0;
    }
  }

  async searchProfiles(query: string, limit: number = 20): Promise<UserProfile[]> {
    if (!this.supabase || !query.trim()) {
      return [];
    }

    try {
      logger.debug(`ProfileDatabaseModule: Searching profiles for "${query}"`);
      
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select(`
          id, username, display_name, avatar_url, status, 
          display_name_color, display_name_animation, badges, is_online
        `)
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(limit);

      if (error) {
        logger.error(`ProfileDatabaseModule: Search error:`, {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return [];
      }

      logger.debug(`ProfileDatabaseModule: Search returned ${data?.length || 0} results`);
      return (data || []) as UserProfile[];
      
    } catch (error: any) {
      logger.error(`ProfileDatabaseModule: Search exception:`, {
        message: error.message,
        name: error.name
      });
      return [];
    }
  }

  async getOnlineProfiles(limit: number = 100): Promise<UserProfile[]> {
    if (!this.supabase) {
      return [];
    }
    
    try {
      logger.debug(`ProfileDatabaseModule: Fetching online profiles (limit: ${limit})`);
      
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
        logger.error('ProfileDatabaseModule: Get online profiles error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return [];
      }
      
      logger.debug(`ProfileDatabaseModule: Found ${data?.length || 0} online profiles`);
      return (data || []) as UserProfile[];
      
    } catch (error: any) {
      logger.error('ProfileDatabaseModule: Get online profiles exception:', {
        message: error.message,
        name: error.name
      });
      return [];
    }
  }

  async getProfilesByIds(authIds: string[]): Promise<UserProfile[]> {
    if (!this.supabase || authIds.length === 0) {
      return [];
    }

    try {
      logger.debug(`ProfileDatabaseModule: Fetching ${authIds.length} profiles by IDs`);
      
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select(`
          id, username, display_name, avatar_url, status,
          display_name_color, display_name_animation, badges, is_online
        `)
        .in('id', authIds);

      if (error) {
        logger.error('ProfileDatabaseModule: Get profiles by IDs error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return [];
      }

      logger.debug(`ProfileDatabaseModule: Retrieved ${data?.length || 0} profiles by IDs`);
      return (data || []) as UserProfile[];
      
    } catch (error: any) {
      logger.error('ProfileDatabaseModule: Get profiles by IDs exception:', {
        message: error.message,
        name: error.name
      });
      return [];
    }
  }

  async updateLastSeen(authIds: string[], timestamp?: Date): Promise<boolean> {
    if (!this.supabase || authIds.length === 0) {
      return false;
    }

    try {
      const lastSeen = timestamp ? timestamp.toISOString() : new Date().toISOString();
      
      logger.debug(`ProfileDatabaseModule: Updating last seen for ${authIds.length} users`);
      
      const { error } = await this.supabase
        .from('user_profiles')
        .update({ 
          last_seen: lastSeen,
          updated_at: new Date().toISOString()
        })
        .in('id', authIds);

      if (error) {
        logger.error('ProfileDatabaseModule: Update last seen error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return false;
      }

      logger.debug(`ProfileDatabaseModule: Successfully updated last seen for ${authIds.length} users`);
      return true;
      
    } catch (error: any) {
      logger.error('ProfileDatabaseModule: Update last seen exception:', {
        message: error.message,
        name: error.name
      });
      return false;
    }
  }

  async setUsersOffline(authIds: string[]): Promise<number> {
    if (!this.supabase || authIds.length === 0) {
      return 0;
    }

    try {
      logger.debug(`ProfileDatabaseModule: Setting ${authIds.length} users offline`);
      
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
        logger.error('ProfileDatabaseModule: Set users offline error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return 0;
      }

      const affected = count || 0;
      logger.info(`ProfileDatabaseModule: Set ${affected} users offline`);
      return affected;
      
    } catch (error: any) {
      logger.error('ProfileDatabaseModule: Set users offline exception:', {
        message: error.message,
        name: error.name
      });
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
      logger.debug('ProfileDatabaseModule: Fetching profile stats');
      
      const [totalResult, onlineResult, recentResult, completeResult] = await Promise.allSettled([
        this.supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
        this.supabase.from('user_profiles').select('id', { count: 'exact', head: true }).eq('is_online', true),
        this.supabase.from('user_profiles').select('id', { count: 'exact', head: true })
          .gte('last_seen', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        this.supabase.from('user_profiles').select('id', { count: 'exact', head: true }).eq('profile_complete', true)
      ]);

      const stats = {
        totalProfiles: totalResult.status === 'fulfilled' ? totalResult.value.count || 0 : 0,
        onlineProfiles: onlineResult.status === 'fulfilled' ? onlineResult.value.count || 0 : 0,
        recentlyActive: recentResult.status === 'fulfilled' ? recentResult.value.count || 0 : 0,
        completeProfiles: completeResult.status === 'fulfilled' ? completeResult.value.count || 0 : 0
      };

      logger.debug('ProfileDatabaseModule: Retrieved profile stats', stats);
      return stats;
      
    } catch (error: any) {
      logger.error('ProfileDatabaseModule: Get profile stats exception:', {
        message: error.message,
        name: error.name
      });
      return {
        totalProfiles: 0,
        onlineProfiles: 0,
        recentlyActive: 0,
        completeProfiles: 0
      };
    }
  }

  async cleanupStaleProfiles(staleThreshold: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    if (!this.supabase) {
      return 0;
    }

    try {
      const staleDate = new Date(Date.now() - staleThreshold).toISOString();
      
      logger.debug(`ProfileDatabaseModule: Cleaning up stale profiles older than ${staleDate}`);
      
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
        logger.error('ProfileDatabaseModule: Cleanup stale profiles error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return 0;
      }

      const cleaned = count || 0;
      if (cleaned > 0) {
        logger.info(`ProfileDatabaseModule: Cleaned up ${cleaned} stale profiles`);
      }

      return cleaned;
      
    } catch (error: any) {
      logger.error('ProfileDatabaseModule: Cleanup stale profiles exception:', {
        message: error.message,
        name: error.name
      });
      return 0;
    }
  }

  // ✅ NEW: Simple connection test method
  async testConnection(): Promise<{ success: boolean; latency?: number; error?: string }> {
    if (!this.supabase) {
      return { success: false, error: 'No Supabase client available' };
    }

    try {
      logger.debug('ProfileDatabaseModule: Testing database connection');
      
      const startTime = Date.now();
      
      // ✅ FIXED: Use the same query that works in PowerShell
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('id')
        .limit(1);
      
      const latency = Date.now() - startTime;

      if (error) {
        logger.error('ProfileDatabaseModule: Connection test failed:', {
          message: error.message,
          code: error.code
        });
        return { success: false, latency, error: error.message };
      }

      logger.debug(`ProfileDatabaseModule: Connection test successful (${latency}ms)`);
      return { success: true, latency };
      
    } catch (error: any) {
      logger.error('ProfileDatabaseModule: Connection test exception:', {
        message: error.message,
        name: error.name
      });
      return { success: false, error: error.message };
    }
  }
}