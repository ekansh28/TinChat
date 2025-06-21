// src/lib/fastProfileFetcher.ts - ENHANCED WITH BACKEND API INTEGRATION

import { supabase } from '@/lib/supabase';
import { profileCache } from '@/lib/profileCache';

export interface FastProfileOptions {
  useCache?: boolean;
  timeout?: number;
  retries?: number;
  fields?: string[];
  forceRefresh?: boolean;
  useBackendApi?: boolean;
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

// ✅ NEW: API Configuration
class ApiConfig {
  private static instance: ApiConfig;
  private backendApiUrl: string;
  private fallbackToSupabase: boolean;

  private constructor() {
    // ✅ ENHANCED: Smart API URL detection
    this.backendApiUrl = this.detectApiUrl();
    this.fallbackToSupabase = process.env.NODE_ENV === 'development';
    
    console.log(`📡 FastProfileFetcher configured:`, {
      backendApiUrl: this.backendApiUrl,
      fallbackToSupabase: this.fallbackToSupabase,
      environment: process.env.NODE_ENV
    });
  }

  static getInstance(): ApiConfig {
    if (!ApiConfig.instance) {
      ApiConfig.instance = new ApiConfig();
    }
    return ApiConfig.instance;
  }

  private detectApiUrl(): string {
    // ✅ ENHANCED: Multi-environment API URL detection
    
    // 1. Check for explicit environment variable
    if (process.env.NEXT_PUBLIC_API_URL) {
      return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
    }
    
    // 2. Check for socket server URL and derive API URL
    if (process.env.NEXT_PUBLIC_SOCKET_SERVER_URL) {
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL;
      // Convert ws://localhost:3001 to http://localhost:3001
      const apiUrl = socketUrl.replace(/^ws/, 'http').replace(/:\d+/, ':3001');
      return apiUrl;
    }
    
    // 3. Development defaults based on current location
    if (typeof window !== 'undefined') {
      const currentOrigin = window.location.origin;
      
      // If running on localhost:3000 (Next.js dev), point to :3001 (backend)
      if (currentOrigin.includes('localhost:3000') || currentOrigin.includes('127.0.0.1:3000')) {
        return 'http://localhost:3001';
      }
      
      // If running on different localhost port, try to detect backend port
      if (currentOrigin.includes('localhost') || currentOrigin.includes('127.0.0.1')) {
        return 'http://localhost:3001';
      }
    }
    
    // 4. Production defaults
    const productionUrls = [
      'https://tinchat.online',
      'https://www.tinchat.online',
      'https://studio--chitchatconnect-aqa0w.us-central1.hosted.app',
      'https://delightful-pond-0cb3e0010.6.azurestaticapps.net'
    ];
    
    // Use first production URL as default
    return productionUrls[0];
  }

  getApiUrl(): string {
    return this.backendApiUrl;
  }

  shouldFallbackToSupabase(): boolean {
    return this.fallbackToSupabase;
  }

  setApiUrl(url: string): void {
    this.backendApiUrl = url.replace(/\/$/, '');
    console.log(`📡 API URL updated to: ${this.backendApiUrl}`);
  }

  setFallbackToSupabase(enabled: boolean): void {
    this.fallbackToSupabase = enabled;
    console.log(`📡 Supabase fallback ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// ✅ NEW: Backend API client
class BackendApiClient {
  private apiConfig: ApiConfig;
  private abortControllers = new Map<string, AbortController>();

  constructor() {
    this.apiConfig = ApiConfig.getInstance();
  }

  private async makeApiRequest<T>(
    endpoint: string, 
    options: RequestInit = {}, 
    timeout: number = 8000
  ): Promise<T> {
    const controller = new AbortController();
    const url = `${this.apiConfig.getApiUrl()}${endpoint}`;
    
    // Set up timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          return null as T;
        }
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Backend API returns { success: boolean, data: T, error?: string }
      if (data.success && data.data) {
        return data.data as T;
      } else if (data.success && data.data === null) {
        return null as T;
      } else {
        throw new Error(data.error || 'API request failed');
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`API request timeout after ${timeout}ms`);
      }
      
      throw error;
    }
  }

  async fetchProfile(userId: string, timeout: number = 8000): Promise<ProfileData | null> {
    try {
      console.log(`📡 Fetching profile via backend API: ${userId}`);
      
      const profile = await this.makeApiRequest<ProfileData>(
        `/api/profiles/${encodeURIComponent(userId)}`,
        { method: 'GET' },
        timeout
      );
      
      if (profile) {
        console.log(`✅ Backend API profile fetch successful: ${userId}`);
        return profile;
      }
      
      console.log(`📭 Backend API profile not found: ${userId}`);
      return null;
    } catch (error: any) {
      console.warn(`❌ Backend API profile fetch failed for ${userId}:`, error.message);
      throw error;
    }
  }

  async createProfile(userId: string, username: string, displayName?: string): Promise<ProfileData | null> {
    try {
      console.log(`📡 Creating profile via backend API: ${userId}`);
      
      const profile = await this.makeApiRequest<ProfileData>(
        `/api/profiles/${encodeURIComponent(userId)}`,
        { 
          method: 'POST',
          body: JSON.stringify({ username, displayName })
        }
      );
      
      console.log(`✅ Backend API profile creation successful: ${userId}`);
      return profile;
    } catch (error: any) {
      console.error(`❌ Backend API profile creation failed for ${userId}:`, error.message);
      throw error;
    }
  }

  async updateProfile(userId: string, updates: Partial<ProfileData>): Promise<ProfileData | null> {
    try {
      console.log(`📡 Updating profile via backend API: ${userId}`);
      
      const profile = await this.makeApiRequest<ProfileData>(
        `/api/profiles/${encodeURIComponent(userId)}`,
        { 
          method: 'PUT',
          body: JSON.stringify(updates)
        }
      );
      
      console.log(`✅ Backend API profile update successful: ${userId}`);
      return profile;
    } catch (error: any) {
      console.error(`❌ Backend API profile update failed for ${userId}:`, error.message);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.makeApiRequest('/api/profiles/health', { method: 'GET' }, 3000);
      return true;
    } catch (error) {
      console.warn('❌ Backend API health check failed:', error);
      return false;
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
}

class FastProfileFetcher {
  private abortControllers = new Map<string, AbortController>();
  private apiClient: BackendApiClient;
  private apiConfig: ApiConfig;

  constructor() {
    this.apiClient = new BackendApiClient();
    this.apiConfig = ApiConfig.getInstance();
  }

  async fetchProfile(userId: string, options: FastProfileOptions = {}): Promise<ProfileData | null> {
    const {
      useCache = true,
      timeout = 12000,
      retries = 2,
      fields = DEFAULT_FIELDS,
      forceRefresh = false,
      useBackendApi = true
    } = options;

    if (!userId?.trim()) throw new Error('User ID is required');

    if (!useCache || forceRefresh) this.cancelRequest(userId);

    if (useCache) {
      try {
        return await profileCache.getOrFetch(
          userId,
          () => this.performFetch(userId, { timeout, retries, fields, useBackendApi }),
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

    return this.performFetch(userId, { timeout, retries, fields, useBackendApi });
  }

  async fetchMinimalProfile(userId: string): Promise<ProfileData | null> {
    return this.fetchProfile(userId, {
      fields: MINIMAL_FIELDS,
      timeout: 5000,
      retries: 1,
      useBackendApi: true
    });
  }

  async fetchFullProfile(userId: string, forceRefresh = false): Promise<ProfileData | null> {
    return this.fetchProfile(userId, {
      fields: ['*'],
      timeout: 8000,
      retries: 3,
      forceRefresh,
      useBackendApi: true
    });
  }

  // ✅ NEW: Backend API integration methods
  async createProfile(userId: string, username: string, displayName?: string): Promise<ProfileData | null> {
    try {
      const profile = await this.apiClient.createProfile(userId, username, displayName);
      
      // Update cache with new profile
      if (profile) {
        profileCache.set(userId, profile);
      }
      
      return profile;
    } catch (error) {
      console.error(`Profile creation failed for ${userId}:`, error);
      
      // Fallback to direct Supabase if backend API fails
      if (this.apiConfig.shouldFallbackToSupabase()) {
        console.log(`🔄 Falling back to direct Supabase for profile creation: ${userId}`);
        return this.createProfileDirectSupabase(userId, username, displayName);
      }
      
      throw error;
    }
  }

  async updateProfile(userId: string, updates: Partial<ProfileData>): Promise<ProfileData | null> {
    try {
      const profile = await this.apiClient.updateProfile(userId, updates);
      
      // Update cache with updated profile
      if (profile) {
        profileCache.set(userId, profile);
      }
      
      return profile;
    } catch (error) {
      console.error(`Profile update failed for ${userId}:`, error);
      
      // Fallback to direct Supabase if backend API fails
      if (this.apiConfig.shouldFallbackToSupabase()) {
        console.log(`🔄 Falling back to direct Supabase for profile update: ${userId}`);
        return this.updateProfileDirectSupabase(userId, updates);
      }
      
      throw error;
    }
  }

  private async performFetch(
    userId: string,
    options: { timeout: number; retries: number; fields: string[]; useBackendApi: boolean }
  ): Promise<ProfileData | null> {
    const { timeout, retries, fields, useBackendApi } = options;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // ✅ ENHANCED: Try backend API first, then fallback to Supabase
        if (useBackendApi) {
          try {
            const profile = await this.apiClient.fetchProfile(userId, timeout);
            if (profile) {
              console.log(`✅ Backend API fetch successful: ${userId} (attempt ${attempt + 1})`);
              return profile;
            }
          } catch (apiError: any) {
            console.warn(`⚠️ Backend API failed for ${userId} (attempt ${attempt + 1}):`, apiError.message);
            
            // If this is the last attempt or we shouldn't fallback, throw the error
            if (attempt === retries || !this.apiConfig.shouldFallbackToSupabase()) {
              throw apiError;
            }
            
            // Otherwise, try Supabase fallback on the next iteration
            console.log(`🔄 Will try Supabase fallback for ${userId} (attempt ${attempt + 1})`);
          }
        }
        
        // ✅ Fallback to direct Supabase query
        if (this.apiConfig.shouldFallbackToSupabase()) {
          console.log(`🔄 Using Supabase fallback for ${userId} (attempt ${attempt + 1})`);
          const profile = await this.performSupabaseFetch(userId, { timeout, retries: 0, fields });
          
          if (profile) {
            console.log(`✅ Supabase fallback successful: ${userId} (attempt ${attempt + 1})`);
            return profile;
          }
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

    throw lastError || new Error('All fetch attempts failed');
  }

  private async performSupabaseFetch(
    userId: string,
    options: { timeout: number; retries: number; fields: string[] }
  ): Promise<ProfileData | null> {
    const { timeout, fields } = options;
    
    const controller = new AbortController();
    this.abortControllers.set(userId, controller);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        controller.abort();
        reject(new Error(`Supabase fetch timeout after ${timeout}ms`));
      }, timeout);
    });

    try {
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
        return profileData as ProfileData;
      }

      return null;
    } catch (error: any) {
      this.abortControllers.delete(userId);
      throw error;
    }
  }

  // ✅ NEW: Direct Supabase fallback methods
  private async createProfileDirectSupabase(userId: string, username: string, displayName?: string): Promise<ProfileData | null> {
    try {
      const profileData = {
        id: userId,
        username: username.trim(),
        display_name: displayName?.trim() || null,
        status: 'online' as const,
        display_name_color: '#667eea',
        display_name_animation: 'none',
        rainbow_speed: 3,
        profile_complete: false,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('user_profiles')
        .insert(profileData)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data as ProfileData;
    } catch (error) {
      console.error(`Direct Supabase profile creation failed for ${userId}:`, error);
      throw error;
    }
  }

  private async updateProfileDirectSupabase(userId: string, updates: Partial<ProfileData>): Promise<ProfileData | null> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data as ProfileData;
    } catch (error) {
      console.error(`Direct Supabase profile update failed for ${userId}:`, error);
      throw error;
    }
  }

  cancelRequest(userId: string): void {
    const controller = this.abortControllers.get(userId);
    if (controller) controller.abort();
    this.abortControllers.delete(userId);
    
    // Also cancel backend API requests
    this.apiClient.cancelRequest(userId);
  }

  cancelAllRequests(): void {
    for (const controller of this.abortControllers.values()) controller.abort();
    this.abortControllers.clear();
    
    // Also cancel all backend API requests
    this.apiClient.cancelAllRequests();
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
        this.performFetch(userId, { timeout: 3000, retries: 1, fields: MINIMAL_FIELDS, useBackendApi: true })
      );
    } catch (error) {
      console.warn('Profile preload failed:', error);
    }
  }

  // ✅ NEW: Configuration methods
  setApiUrl(url: string): void {
    this.apiConfig.setApiUrl(url);
  }

  enableSupabaseFallback(enabled: boolean): void {
    this.apiConfig.setFallbackToSupabase(enabled);
  }

  async testBackendConnection(): Promise<boolean> {
    return this.apiClient.testConnection();
  }

  getConfiguration(): { apiUrl: string; fallbackEnabled: boolean } {
    return {
      apiUrl: this.apiConfig.getApiUrl(),
      fallbackEnabled: this.apiConfig.shouldFallbackToSupabase()
    };
  }
}

export const fastProfileFetcher = new FastProfileFetcher();
export { profileCache } from '@/lib/profileCache';