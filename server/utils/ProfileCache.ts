// ===== server/utils/ProfileCache.ts - NEW FILE for caching =====
export interface CachedProfile {
  profile: any;
  timestamp: number;
  authId: string;
}

export class ProfileCache {
  private cache = new Map<string, CachedProfile>();
  private readonly CACHE_DURATION = 30000; // 30 seconds
  private readonly MAX_CACHE_SIZE = 1000;
  
  async getProfile(
    authId: string, 
    fetchFunction: (authId: string) => Promise<any>
  ): Promise<any> {
    const cached = this.cache.get(authId);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < this.CACHE_DURATION) {
      return cached.profile;
    }
    
    const profile = await fetchFunction(authId);
    
    if (profile) {
      if (this.cache.size >= this.MAX_CACHE_SIZE) {
        this.cleanup();
      }
      
      this.cache.set(authId, {
        profile,
        timestamp: now,
        authId
      });
    }
    
    return profile;
  }
  
  invalidate(authId: string): void {
    this.cache.delete(authId);
  }
  
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [authId, cached] of this.cache.entries()) {
      if ((now - cached.timestamp) > this.CACHE_DURATION) {
        expiredKeys.push(authId);
      }
    }
    
    if (this.cache.size > this.MAX_CACHE_SIZE * 0.8) {
      const sortedEntries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const entriesToRemove = sortedEntries.slice(0, this.cache.size - this.MAX_CACHE_SIZE * 0.6);
      entriesToRemove.forEach(([authId]) => expiredKeys.push(authId));
    }
    
    expiredKeys.forEach(authId => this.cache.delete(authId));
  }
  
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      cacheDuration: this.CACHE_DURATION
    };
  }
  
  clear(): void {
    this.cache.clear();
  }
}