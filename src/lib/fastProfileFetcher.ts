// src/lib/fastProfileFetcher.ts - OPTIMIZED FAST PROFILE FETCHER

import { supabase } from '@/lib/supabase';
import { profileCache } from '@/lib/profileCache';

export interface FastProfileOptions {
  useCache?: boolean;
  timeout?: number;
  retries?: number;
  fields?: string[];
  forceRefresh?: boolean;
}

export interface ProfileData {
  id: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  banner_url?: string;
  pronouns?: string;
  bio?: string;
  status?: 'online' | 'idle' | 'dnd' | 'offline';
  display_name_color?: string;
  display_name_animation?: string;
  rainbow_speed?: number;
  badges?: any[];
  profile_complete?: boolean;
  created_at?: string;
  updated_at?: string;
  profile_card_css?: string;
}

const DEFAULT_FIELDS = [
  'id','username','display_name','avatar_url','pronouns','bio','status',
  'display_name_color','display_name_animation','rainbow_speed',
  'badges','profile_complete','created_at'
];

const MINIMAL_FIELDS = [
  'id','username','display_name','avatar_url','profile_complete'
];

class FastProfileFetcher {
  private abortControllers = new Map<string, AbortController>();

  async fetchProfile(userId: string, options: FastProfileOptions = {}): Promise<ProfileData | null> {
    const {
      useCache = true,
      timeout = 12000,
      retries = 2,
      fields = DEFAULT_FIELDS,
      forceRefresh = false
    } = options;

    if (!userId?.trim()) throw new Error('User ID is required');

    if (!useCache || forceRefresh) this.cancelRequest(userId);

    if (useCache) {
      try {
        return await profileCache.getOrFetch(
          userId,
          () => this.performFetch(userId, { timeout, retries, fields }),
          { forceRefresh }
        );
      } catch (error: any) {
        if (error.message?.includes('cancelled')) {
          console.warn(`FastProfileFetcher: Fetch cancelled for ${userId}`);
          return null;
        }
        console.error('FastProfileFetcher: Cache fetch failed:', error);
      }
    }

    return this.performFetch(userId, { timeout, retries, fields });
  }

  async fetchMinimalProfile(userId: string): Promise<ProfileData | null> {
    return this.fetchProfile(userId, {
      fields: MINIMAL_FIELDS,
      timeout: 5000,
      retries: 1
    });
  }

  async fetchFullProfile(userId: string, forceRefresh = false): Promise<ProfileData | null> {
    return this.fetchProfile(userId, {
      fields: ['*'],
      timeout: 8000,
      retries: 3,
      forceRefresh
    });
  }
  //mhmmm

  private async performFetch(
    userId: string,
    options: { timeout: number; retries: number; fields: string[] }
  ): Promise<ProfileData | null> {
    const { timeout, retries, fields } = options;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        this.abortControllers.set(userId, controller);

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            controller.abort();
            reject(new Error(`Profile fetch timeout after ${timeout}ms`));
          }, timeout);
        });

        const fetchPromise = supabase
          .from('user_profiles')
          .select(fields.join(', '), { head: false })
          .eq('id', userId)
          .limit(1)
          .abortSignal(controller.signal)
          .single();

        const result = await Promise.race([fetchPromise, timeoutPromise]);
        this.abortControllers.delete(userId);

        if (controller.signal.aborted) throw new Error('Request was cancelled');

        const { data, error } = result as any;
        if (error) {
          if (error.code === 'PGRST116') return null;
          throw new Error(error.message || 'Database error');
        }

        if (data) {
          let profileData: any = JSON.parse(JSON.stringify(data));
          try {
            profileData.badges = typeof profileData.badges === 'string'
              ? JSON.parse(profileData.badges)
              : profileData.badges;
            if (!Array.isArray(profileData.badges)) profileData.badges = [];
          } catch {
            profileData.badges = [];
          }
          if (!profileData.id) profileData.id = userId;
          console.log(`FastProfileFetcher: Successfully fetched ${userId} (attempt ${attempt + 1})`);
          return profileData as ProfileData;
        }

        return null;
      } catch (error: any) {
        lastError = error;
        console.warn(`FastProfileFetcher: Attempt ${attempt + 1} failed for ${userId}:`, error.message);
        if (error.message.includes('cancelled') || attempt === retries) break;
        const delay = 250 * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    this.abortControllers.delete(userId);
    throw lastError || new Error('All fetch attempts failed');
  }

  cancelRequest(userId: string): void {
    const controller = this.abortControllers.get(userId);
    if (controller) controller.abort();
    this.abortControllers.delete(userId);
  }

  cancelAllRequests(): void {
    for (const controller of this.abortControllers.values()) controller.abort();
    this.abortControllers.clear();
  }

  async batchFetch(userIds: string[]): Promise<Map<string, ProfileData | null>> {
    const results = new Map<string, ProfileData | null>();
    const BATCH_SIZE = 5;
    const batches = [];
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      batches.push(userIds.slice(i, i + BATCH_SIZE));
    }
    for (const batch of batches) {
      const promises = batch.map(async (userId) => {
        try {
          const profile = await this.fetchMinimalProfile(userId);
          results.set(userId, profile);
        } catch (error) {
          console.warn(`Batch fetch failed for ${userId}:`, error);
          results.set(userId, null);
        }
      });
      await Promise.allSettled(promises);
    }
    return results;
  }

  async preloadProfiles(userIds: string[]): Promise<void> {
    try {
      await profileCache.preload(userIds, (userId) =>
        this.performFetch(userId, { timeout: 3000, retries: 1, fields: MINIMAL_FIELDS })
      );
    } catch (error) {
      console.warn('Profile preload failed:', error);
    }
  }
}

export const fastProfileFetcher = new FastProfileFetcher();
export { profileCache } from '@/lib/profileCache';