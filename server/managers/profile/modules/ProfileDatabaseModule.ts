// server/managers/profile/modules/ProfileDatabaseModule.ts
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
        .select('*')
        .eq('id', authId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error(`Database profile fetch error for ${authId}:`, error);
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

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error(`Database profile creation error for ${authId}:`, error);
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

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error(`Database profile update error for ${authId}:`, error);
      return false;
    }
  }
}