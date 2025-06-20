// ===============================================================================
// src/lib/fastProfileFetcher.ts - OPTIMIZED PROFILE FETCHER
// ===============================================================================

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
  'id',
  'username',
  'display_name',
  'avatar_url',
  'pronouns',
  'bio',
  'status',
  'display_name_color',
  'display_name_animation',
  'rainbow_speed',
  'badges',
  'profile_complete',
  'created_at'
];

const MINIMAL_FIELDS = [
  'id',
  'username',
  'display_name',
  'avatar_url',
  'profile_complete'
];

class FastProfileFetcher {
  private abortControllers = new Map<string, AbortController>();

  // Fast fetch with aggressive caching and optimizations
  async fetchProfile(
    userId: string, 
    options: FastProfileOptions = {}
  ): Promise<ProfileData | null> {
    const {
      useCache = true,
      timeout = 4000,
      retries = 2,
      fields = DEFAULT_FIELDS,
      forceRefresh = false
    } = options;

    if (!userId?.trim()) {
      throw new Error('User ID is required');
    }

    // Cancel any existing request for this user
    this.cancelRequest(userId);

    if (useCache) {
      try {
        return await profileCache.getOrFetch(
          userId,
          () => this.performFetch(userId, { timeout, retries, fields }),
          { forceRefresh }
        );
      } catch (error) {
        console.error('FastProfileFetcher: Cache fetch failed:', error);
        // Fallback to direct fetch
      }
    }

    return this.performFetch(userId, { timeout, retries, fields });
  }

  // Minimal fetch for auth components (just username/display_name)
  async fetchMinimalProfile(userId: string): Promise<{ username?: string; display_name?: string; profile_complete?: boolean } | null> {
    return this.fetchProfile(userId, {
      fields: MINIMAL_FIELDS,
      timeout: 3000,
      retries: 1
    });
  }

  // Full fetch for profile customizer
  async fetchFullProfile(userId: string, forceRefresh = false): Promise<ProfileData | null> {
    return this.fetchProfile(userId, {
      fields: ['*'], // All fields
      timeout: 8000,
      retries: 3,
      forceRefresh
    });
  }

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

        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            controller.abort();
            reject(new Error(`Profile fetch timeout after ${timeout}ms`));
          }, timeout);
        });

        // Create fetch promise
        let query = supabase
          .from('user_profiles')
          .select(fields.join(', '))
          .eq('id', userId)
          .abortSignal(controller.signal);

        // Add single() only if we're not selecting all fields
        if (!fields.includes('*')) {
          query = query.single();
        } else {
          query = query.limit(1).single();
        }

        const fetchPromise = query;

        // Race between fetch and timeout
        const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

        this.abortControllers.delete(userId);

        if (controller.signal.aborted) {
          throw new Error('Request was cancelled');
        }

        if (error) {
          if (error.code === 'PGRST116') {
            // No profile found - this is valid
            return null;
          }
          throw new Error(error.message || 'Database error');
        }

        if (data) {
          // Parse badges if present
          if (data.badges) {
            try {
              data.badges = typeof data.badges === 'string' ? JSON.parse(data.badges) : data.badges;
              if (!Array.isArray(data.badges)) data.badges = [];
            } catch {
              data.badges = [];
            }
          }

          console.log(`FastProfileFetcher: Successfully fetched profile for ${userId} (attempt ${attempt + 1})`);
          return data;
        }

        return null;

      } catch (error: any) {
        lastError = error;
        console.warn(`FastProfileFetcher: Attempt ${attempt + 1} failed for ${userId}:`, error.message);

        // Don't retry if cancelled or if it's the last attempt
        if (error.message?.includes('cancelled') || attempt === retries) {
          break;
        }

        // Progressive delay: 300ms, 600ms, 1200ms
        const delay = 300 * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    this.abortControllers.delete(userId);
    throw lastError || new Error('All fetch attempts failed');
  }

  cancelRequest(userId: string): void {
    const controller = this.abortControllers.get(userId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(userId);
    }
  }

  cancelAllRequests(): void {
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }
    this.abortControllers.clear();
  }

  // Batch fetch multiple profiles efficiently
  async batchFetch(userIds: string[]): Promise<Map<string, ProfileData | null>> {
    const results = new Map<string, ProfileData | null>();
    
    // Fetch in parallel but limit concurrency
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

  // Preload profiles for likely-to-be-accessed users
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

// Singleton instance
export const fastProfileFetcher = new FastProfileFetcher();

// Re-export profileCache for convenience
export { profileCache } from '@/lib/profileCache';