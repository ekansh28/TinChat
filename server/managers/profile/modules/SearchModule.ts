// server/managers/profile/modules/SearchModule.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { RedisService } from '../../../services/RedisService';
import { logger } from '../../../utils/logger';

interface UserSearchResult {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  is_online?: boolean;
}

export class SearchModule {
  private supabase: SupabaseClient | null;
  private redisService: RedisService | null;

  constructor(supabase: SupabaseClient | null, redisService: RedisService | null) {
    this.supabase = supabase;
    this.redisService = redisService;
  }

  async searchUsers(query: string, limit: number = 20): Promise<UserSearchResult[]> {
    if (!this.supabase || !query) return [];

    try {
      // Cache key based on search query
      const cacheKey = `search:${query.toLowerCase().trim()}`;
      
      // Try cache first
      if (this.redisService) {
        const cached = await this.redisService.get<UserSearchResult[]>(cacheKey);
        if (cached) {
          logger.debug(`🔍 Search cache hit for : ${query}`);
          return cached;
        }
      }

      // Perform search
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('id, username, display_name, avatar_url, is_online')
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(limit);

      if (error) throw error;

      const results = data?.map(user => ({
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        is_online: user.is_online
      })) || [];

      // Cache the results for 5 minutes
      if (this.redisService && results.length > 0) {
        await this.redisService.set(cacheKey, results, 300);
      }

      logger.debug(`🔍 Found ${results.length} users for query: ${query}`);
      return results;
    } catch (error) {
      logger.error(`Search failed for query "${query}":`, error);
      return [];
    }
  }

  async searchExactUsername(username: string): Promise<UserSearchResult | null> {
    if (!this.supabase || !username) return null;

    try {
      const cacheKey = `search:exact:${username.toLowerCase()}`;
      
      // Try cache first
      if (this.redisService) {
        const cached = await this.redisService.get<UserSearchResult>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('id, username, display_name, avatar_url, is_online')
        .eq('username', username)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows found
          return null;
        }
        throw error;
      }

      const result = data ? {
        id: data.id,
        username: data.username,
        display_name: data.display_name,
        avatar_url: data.avatar_url,
        is_online: data.is_online
      } : null;

      // Cache the result for 1 hour
      if (this.redisService && result) {
        await this.redisService.set(cacheKey, result, 3600);
      }

      return result;
    } catch (error) {
      logger.error(`Exact username search failed for "${username}":`, error);
      return null;
    }
  }

  async searchByIds(userIds: string[]): Promise<UserSearchResult[]> {
    if (!this.supabase || userIds.length === 0) return [];

    try {
      const cacheKey = `search:ids:${userIds.sort().join(',')}`;
      
      // Try cache first
      if (this.redisService) {
        const cached = await this.redisService.get<UserSearchResult[]>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('id, username, display_name, avatar_url, is_online')
        .in('id', userIds);

      if (error) throw error;

      const results = data?.map(user => ({
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        is_online: user.is_online
      })) || [];

      // Cache the results for 15 minutes
      if (this.redisService && results.length > 0) {
        await this.redisService.set(cacheKey, results, 900);
      }

      return results;
    } catch (error) {
      logger.error(`Search by IDs failed for ${userIds.length} IDs:`, error);
      return [];
    }
  }
}