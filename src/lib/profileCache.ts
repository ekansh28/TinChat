// ===============================================================================
// src/lib/profileCache.ts - FAST PROFILE CACHING SYSTEM
// ===============================================================================

interface CachedProfile {
  data: any;
  timestamp: number;
  etag?: string;
  version: number;
}

interface CacheConfig {
  maxAge: number; // milliseconds
  staleWhileRevalidate: number; // milliseconds
  maxEntries: number;
}

class ProfileCache {
  private cache = new Map<string, CachedProfile>();
  private pendingRequests = new Map<string, Promise<any>>();
  private config: CacheConfig = {
    maxAge: 5 * 60 * 1000, // 5 minutes fresh
    staleWhileRevalidate: 15 * 60 * 1000, // 15 minutes stale-while-revalidate
    maxEntries: 100 // max cached profiles
  };

  constructor(config?: Partial<CacheConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  private isExpired(cached: CachedProfile): boolean {
    return Date.now() - cached.timestamp > this.config.maxAge;
  }

  private isStale(cached: CachedProfile): boolean {
    return Date.now() - cached.timestamp > this.config.staleWhileRevalidate;
  }

  private evictOldest(): void {
    if (this.cache.size <= this.config.maxEntries) return;

    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, cached] of this.cache.entries()) {
      if (cached.timestamp < oldestTime) {
        oldestTime = cached.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  get(userId: string): CachedProfile | null {
    const cached = this.cache.get(userId);
    if (!cached) return null;

    // Return even if stale - caller can decide to revalidate
    return cached;
  }

  set(userId: string, data: any, etag?: string): void {
    this.evictOldest();
    this.cache.set(userId, {
      data,
      timestamp: Date.now(),
      etag,
      version: Date.now() // Simple versioning
    });
  }

  async getOrFetch(
    userId: string,
    fetcher: () => Promise<any>,
    options: { forceRefresh?: boolean; backgroundRefresh?: boolean } = {}
  ): Promise<any> {
    const cached = this.get(userId);
    const { forceRefresh = false, backgroundRefresh = true } = options;

    // Return immediately if we have fresh data and not forcing refresh
    if (cached && !this.isExpired(cached) && !forceRefresh) {
      console.log(`ProfileCache: Serving fresh data for ${userId}`);
      return cached.data;
    }

    // Check if we already have a pending request for this user
    const pending = this.pendingRequests.get(userId);
    if (pending) {
      console.log(`ProfileCache: Joining existing request for ${userId}`);
      return pending;
    }

    // If we have stale data, return it immediately and refresh in background
    if (cached && !this.isStale(cached) && backgroundRefresh && !forceRefresh) {
      console.log(`ProfileCache: Serving stale data for ${userId}, refreshing in background`);
      
      // Start background refresh
      this.backgroundRefresh(userId, fetcher);
      return cached.data;
    }

    // No usable cache, fetch fresh data
    console.log(`ProfileCache: Fetching fresh data for ${userId}`);
    const fetchPromise = this.fetchAndCache(userId, fetcher);
    this.pendingRequests.set(userId, fetchPromise);

    try {
      const result = await fetchPromise;
      return result;
    } finally {
      this.pendingRequests.delete(userId);
    }
  }

  private async fetchAndCache(userId: string, fetcher: () => Promise<any>): Promise<any> {
    try {
      const data = await fetcher();
      this.set(userId, data);
      return data;
    } catch (error) {
      // If fetch fails and we have stale data, return it
      const cached = this.get(userId);
      if (cached) {
        console.warn(`ProfileCache: Fetch failed for ${userId}, serving stale data`);
        return cached.data;
      }
      throw error;
    }
  }

  private backgroundRefresh(userId: string, fetcher: () => Promise<any>): void {
    // Don't wait for this
    this.fetchAndCache(userId, fetcher).catch(error => {
      console.warn(`ProfileCache: Background refresh failed for ${userId}:`, error);
    });
  }

  invalidate(userId: string): void {
    this.cache.delete(userId);
    this.pendingRequests.delete(userId);
  }

  clear(): void {
    this.cache.clear();
    this.pendingRequests.clear();
  }

  // Preload multiple profiles
  async preload(userIds: string[], fetcher: (userId: string) => Promise<any>): Promise<void> {
    const promises = userIds.map(userId => {
      if (!this.cache.has(userId)) {
        return this.getOrFetch(userId, () => fetcher(userId), { backgroundRefresh: false });
      }
      return Promise.resolve();
    });

    await Promise.allSettled(promises);
  }
}

// Singleton instance
export const profileCache = new ProfileCache();