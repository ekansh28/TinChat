// src/lib/fastProfileFetcher.ts - FIXED TO WORK WITH EXISTING API AND USER OBJECTS
import { UserProfile, Badge } from '@/components/ProfileCustomizer/types';

interface ProfileCache {
  [userId: string]: {
    data: UserProfile | null;
    timestamp: number;
    expires: number;
  };
}

class FastProfileFetcher {
  private cache: ProfileCache = {};
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private abortControllers = new Map<string, AbortController>();

  async fetchProfile(userIdOrObject: string | any, useCache = true): Promise<UserProfile | null> {
    // ✅ Handle both string IDs and user objects
    let userId: string;
    let existingUserData: UserProfile | null = null;

    if (typeof userIdOrObject === 'string') {
      userId = userIdOrObject;
    } else if (userIdOrObject && typeof userIdOrObject === 'object') {
      // Extract the user ID from the object
      userId = userIdOrObject.id || userIdOrObject.clerk_id || userIdOrObject.authId;
      
      // If we have a user object with basic data, use it as fallback
      if (userIdOrObject.username || userIdOrObject.display_name) {
        existingUserData = {
          clerk_id: userId,
          username: userIdOrObject.username,
          display_name: userIdOrObject.display_name,
          avatar_url: userIdOrObject.avatar_url || '',
          banner_url: userIdOrObject.banner_url || '',
          pronouns: userIdOrObject.pronouns || '',
          bio: userIdOrObject.bio || '',
          status: userIdOrObject.status || 'offline',
          display_name_color: userIdOrObject.display_name_color || '#000000',
          display_name_animation: userIdOrObject.display_name_animation || 'none',
          rainbow_speed: userIdOrObject.rainbow_speed || 3,
          profile_complete: userIdOrObject.profile_complete || false,
          badges: userIdOrObject.badges || [],
          profile_card_css: userIdOrObject.profile_card_css || '',
          created_at: userIdOrObject.created_at,
          updated_at: userIdOrObject.updated_at
        };
      }
    } else {
      throw new Error('User ID or user object is required');
    }

    if (!userId?.trim()) {
      throw new Error('Valid user ID is required');
    }

    // Check cache first
    if (useCache && this.isCacheValid(userId)) {
      console.log(`FastProfileFetcher: Using cached profile for ${userId}`);
      return this.cache[userId].data;
    }

    // If we have existing user data and no need to fetch from server, use it
    if (existingUserData && useCache) {
      console.log(`FastProfileFetcher: Using provided user data for ${userId}`);
      this.cache[userId] = {
        data: existingUserData,
        timestamp: Date.now(),
        expires: Date.now() + this.CACHE_DURATION
      };
      return existingUserData;
    }

    // Cancel any existing request for this user
    this.cancelRequest(userId);

    try {
      const controller = new AbortController();
      this.abortControllers.set(userId, controller);

      console.log(`FastProfileFetcher: Fetching profile for ${userId}`);

      // ✅ Use your existing API endpoint instead of a new public one
      const response = await fetch('/api/profile/load', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include session cookies
        body: JSON.stringify({ clerkUserId: userId }),
        signal: controller.signal,
      });

      // Clean up controller
      this.abortControllers.delete(userId);

      if (!response.ok) {
        // If the API call fails but we have existing user data, use that as fallback
        if (existingUserData) {
          console.log(`FastProfileFetcher: API failed, using fallback data for ${userId}`);
          this.cache[userId] = {
            data: existingUserData,
            timestamp: Date.now(),
            expires: Date.now() + (this.CACHE_DURATION / 2) // Shorter cache for fallback data
          };
          return existingUserData;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        const profileData = result.data;
        
        // Parse badges if they exist
        if (profileData.badges) {
          try {
            profileData.badges = typeof profileData.badges === 'string' 
              ? JSON.parse(profileData.badges) 
              : profileData.badges;
            
            if (!Array.isArray(profileData.badges)) {
              profileData.badges = [];
            }
          } catch (e) {
            console.warn('Failed to parse badges for user:', userId);
            profileData.badges = [];
          }
        } else {
          profileData.badges = [];
        }
        
        // Cache the result
        this.cache[userId] = {
          data: profileData,
          timestamp: Date.now(),
          expires: Date.now() + this.CACHE_DURATION
        };

        console.log(`FastProfileFetcher: Profile fetched and cached for ${userId}`);
        return profileData;
      } else {
        // If API returns no data but we have existing user data, use that
        if (existingUserData) {
          console.log(`FastProfileFetcher: No API data, using fallback for ${userId}`);
          this.cache[userId] = {
            data: existingUserData,
            timestamp: Date.now(),
            expires: Date.now() + (this.CACHE_DURATION / 2)
          };
          return existingUserData;
        }
        throw new Error(result.error || 'Failed to fetch profile');
      }
    } catch (error: any) {
      this.abortControllers.delete(userId);
      
      if (error.name === 'AbortError') {
        console.log(`FastProfileFetcher: Request cancelled for ${userId}`);
        return null;
      }
      
      // If fetch failed but we have existing user data, use that as fallback
      if (existingUserData) {
        console.log(`FastProfileFetcher: Fetch failed, using fallback data for ${userId}:`, error.message);
        this.cache[userId] = {
          data: existingUserData,
          timestamp: Date.now(),
          expires: Date.now() + 60000 // 1 minute cache for error fallback
        };
        return existingUserData;
      }
      
      console.error(`FastProfileFetcher: Error fetching ${userId}:`, error);
      throw error;
    }
  }

  async fetchMinimalProfile(userIdOrObject: string | any): Promise<UserProfile | null> {
    return this.fetchProfile(userIdOrObject, true);
  }

  async fetchFullProfile(userIdOrObject: string | any, forceRefresh = false): Promise<UserProfile | null> {
    return this.fetchProfile(userIdOrObject, !forceRefresh);
  }

  async fetchMultipleProfiles(userIdsOrObjects: (string | any)[]): Promise<Map<string, UserProfile | null>> {
    const results = new Map<string, UserProfile | null>();
    
    // Process in batches to avoid overwhelming the server
    const BATCH_SIZE = 5;
    const batches = [];
    
    for (let i = 0; i < userIdsOrObjects.length; i += BATCH_SIZE) {
      batches.push(userIdsOrObjects.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      const promises = batch.map(async (userIdOrObject) => {
        try {
          const profile = await this.fetchProfile(userIdOrObject);
          const userId = typeof userIdOrObject === 'string' ? userIdOrObject : userIdOrObject.id;
          results.set(userId, profile);
        } catch (error) {
          const userId = typeof userIdOrObject === 'string' ? userIdOrObject : userIdOrObject.id;
          console.warn(`Batch fetch failed for ${userId}:`, error);
          results.set(userId, null);
        }
      });

      await Promise.allSettled(promises);
    }

    return results;
  }

  preloadProfile(userIdOrObject: string | any): Promise<void> {
    return this.fetchProfile(userIdOrObject).then(() => {}).catch(() => {});
  }

  preloadProfiles(userIdsOrObjects: (string | any)[]): Promise<void> {
    return this.fetchMultipleProfiles(userIdsOrObjects).then(() => {}).catch(() => {});
  }

  invalidateCache(userId?: string): void {
    if (userId) {
      delete this.cache[userId];
      console.log(`FastProfileFetcher: Cache invalidated for ${userId}`);
    } else {
      this.cache = {};
      console.log('FastProfileFetcher: All cache invalidated');
    }
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

  private isCacheValid(userId: string): boolean {
    const cached = this.cache[userId];
    return cached && Date.now() < cached.expires;
  }

  // Utility methods
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: Object.keys(this.cache).length,
      entries: Object.keys(this.cache)
    };
  }

  getCachedProfile(userId: string): UserProfile | null {
    return this.isCacheValid(userId) ? this.cache[userId].data : null;
  }

  // Alias methods to maintain compatibility with old API
  async batchFetch(userIdsOrObjects: (string | any)[]): Promise<Map<string, UserProfile | null>> {
    return this.fetchMultipleProfiles(userIdsOrObjects);
  }
}

// Export singleton instance
export const fastProfileFetcher = new FastProfileFetcher();

// Export types for convenience
export type { UserProfile, Badge } from '@/components/ProfileCustomizer/types';

// Export interfaces for compatibility
export interface FastProfileOptions {
  useCache?: boolean;
  timeout?: number;
  retries?: number;
  forceRefresh?: boolean;
}

export interface ProfileData extends UserProfile {}