// server/config/xata.ts - COMPLETE FIXED VERSION WITH PROPER ERROR HANDLING
import { logger } from '../utils/logger';
import { UserProfile } from '../managers/profile/ProfileManager';
import { FriendData } from '../managers/profile/types/FriendTypes';
import { UserStatus } from '../types/User';
// server/config/xata.ts
import { getXataClient as generatedClient } from "./xata.codegen";

// Xata API response types
interface XataRecord {
  id: string;
  xata: {
    createdAt: string;
    updatedAt: string;
    version: number;
  };
}

interface XataUser extends XataRecord {
  username: string;
  display_name?: string;
  avatar_url?: string;
  banner_url?: string;
  pronouns?: string;
  status?: UserStatus;
  display_name_color?: string;
  display_name_animation?: string;
  rainbow_speed?: number;
  badges?: any[];
  bio?: string;
  last_seen?: string;
  is_online?: boolean;
  profile_complete?: boolean;
  profile_card_css?: string;
  easy_customization_data?: any;
  blocked_users?: string[];
}

interface XataFriendship extends XataRecord {
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

interface XataFriendRequest extends XataRecord {
  sender_id: string;
  receiver_id: string;
  message?: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

interface XataBlockedUser extends XataRecord {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

interface XataChatMessage extends XataRecord {
  sender_id: string;
  receiver_id: string;
  content: string;
  message_type: 'text' | 'image' | 'file';
  is_read: boolean;
  created_at: string;
}

// Enhanced HTTP client for Xata REST API with comprehensive error handling
class XataClient {
  private baseUrl: string;
  private apiKey: string;
  private dbBranch: string;
  private isInitialized: boolean = false;
  private connectionRetries: number = 0;
  private readonly MAX_RETRIES = 3;

  constructor(databaseUrl: string, apiKey: string, branch?: string) {
    if (!databaseUrl || !apiKey) {
      throw new Error('Xata database URL and API key are required');
    }

    this.apiKey = apiKey;
    this.baseUrl = databaseUrl;
    
    // Handle branch configuration
    if (branch && branch !== 'main') {
      // Only modify URL for non-main branches
      this.baseUrl = databaseUrl.replace('/db/tinchat', `/db/tinchat:${branch}`);
      this.dbBranch = branch;
      logger.info(`🗄️ Xata client configured for branch: ${branch}`);
    } else {
      // For main branch or no branch specified, use URL as-is
      this.baseUrl = databaseUrl;
      this.dbBranch = branch || 'main';
      logger.info(`🗄️ Xata client configured for main branch`);
    }

    this.isInitialized = true;
  }
// Add to your XataClient class
public async executeSQL(query: string): Promise<any> {
  return this.request('/sql', {
    method: 'POST',
    body: JSON.stringify({ statement: query })
  });
}
  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Xata client not initialized');
    }

    const url = `${this.baseUrl}${endpoint}`;
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(url, {
          ...options,
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'X-Xata-Agent': 'tinchat-server@1.0.0',
            ...options.headers,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          const error = new Error(`Xata API error: ${response.status} ${response.statusText} - ${errorText}`);
          
          // Don't retry on client errors (4xx)
          if (response.status >= 400 && response.status < 500) {
            logger.error(`Xata client error ${response.status}:`, errorText);
            throw error;
          }
          
          // Retry on server errors (5xx) and network issues
          if (attempt < this.MAX_RETRIES - 1) {
            logger.warn(`Xata server error ${response.status}, retrying... (attempt ${attempt + 1})`);
            await this.delay(Math.pow(2, attempt) * 1000); // Exponential backoff
            lastError = error;
            continue;
          }
          
          throw error;
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          this.connectionRetries = 0; // Reset retry counter on success
          return data;
        }
        
        const text = await response.text();
        this.connectionRetries = 0;
        return text;
        
      } catch (error: any) {
        lastError = error;
        
        // Handle AbortError (timeout)
        if (error.name === 'AbortError') {
          logger.warn(`Xata request timeout for ${endpoint}, retrying... (attempt ${attempt + 1})`);
          if (attempt < this.MAX_RETRIES - 1) {
            await this.delay(Math.pow(2, attempt) * 1000);
            continue;
          }
          throw new Error(`Request timeout after ${this.MAX_RETRIES} attempts`);
        }
        
        // Don't retry on parse errors or invalid requests
        if (error.name === 'SyntaxError' || error.message?.includes('Invalid')) {
          throw error;
        }
        
        // Retry on network errors
        if (attempt < this.MAX_RETRIES - 1) {
          this.connectionRetries++;
          logger.warn(`Xata request failed, retrying... (attempt ${attempt + 1}):`, error.message);
          await this.delay(Math.pow(2, attempt) * 1000);
          continue;
        }
        
        logger.error(`Xata request failed after ${this.MAX_RETRIES} attempts for ${endpoint}:`, error.message);
        throw error;
      }
    }
    
    throw lastError || new Error('All retry attempts failed');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==================== USER PROFILES ====================

  async getUserProfile(id: string): Promise<UserProfile | null> {
    if (!id || typeof id !== 'string') {
      logger.warn('Invalid user ID provided to getUserProfile');
      return null;
    }

    try {
      const result = await this.request(`/tables/user_profiles/data/${encodeURIComponent(id)}`);
      if (!result) {
        return null;
      }
      return this.transformXataUserToProfile(result);
    } catch (error: any) {
      if (error.message?.includes('404')) {
        return null; // Profile not found is not an error
      }
      logger.error(`Failed to get user profile for ${id}:`, error.message);
      throw error;
    }
  }

  async createUserProfile(id: string, data: Partial<UserProfile>): Promise<UserProfile> {
    if (!id || !data) {
      throw new Error('User ID and profile data are required');
    }

    try {
      const payload = {
        id: encodeURIComponent(id),
        ...this.transformProfileToXataUser(data),
      };

      const result = await this.request(`/tables/user_profiles/data`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      logger.info(`Created user profile for ${id}`);
      return this.transformXataUserToProfile(result);
    } catch (error: any) {
      logger.error(`Failed to create user profile for ${id}:`, error.message);
      throw error;
    }
  }

  async updateUserProfile(id: string, data: Partial<UserProfile>): Promise<UserProfile | null> {
    if (!id || !data || Object.keys(data).length === 0) {
      logger.warn('Invalid update data provided');
      return null;
    }

    try {
      const payload = this.transformProfileToXataUser(data);
      const result = await this.request(`/tables/user_profiles/data/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      logger.debug(`Updated user profile for ${id}`);
      return this.transformXataUserToProfile(result);
    } catch (error: any) {
      if (error.message?.includes('404')) {
        logger.warn(`User profile not found for update: ${id}`);
        return null;
      }
      logger.error(`Failed to update user profile for ${id}:`, error.message);
      throw error;
    }
  }

  async deleteUserProfile(id: string): Promise<boolean> {
    if (!id) {
      throw new Error('User ID is required');
    }

    try {
      await this.request(`/tables/user_profiles/data/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      logger.info(`Deleted user profile for ${id}`);
      return true;
    } catch (error: any) {
      if (error.message?.includes('404')) {
        logger.warn(`User profile not found for deletion: ${id}`);
        return false;
      }
      logger.error(`Failed to delete user profile for ${id}:`, error.message);
      throw error;
    }
  }

  async searchUserProfiles(searchTerm: string, limit: number = 20): Promise<UserProfile[]> {
    if (!searchTerm || typeof searchTerm !== 'string') {
      return [];
    }

    try {
      const filter = {
        "$any": [
          { "username": { "$iContains": searchTerm.trim() } },
          { "display_name": { "$iContains": searchTerm.trim() } }
        ]
      };

      const result = await this.request('/tables/user_profiles/query', {
        method: 'POST',
        body: JSON.stringify({
          filter,
          page: { size: Math.min(limit, 100) },
          sort: [{ "username": "asc" }]
        }),
      });

      const profiles = result.records?.map((record: XataUser) => 
        this.transformXataUserToProfile(record)
      ) || [];
      
      logger.debug(`Search for "${searchTerm}" returned ${profiles.length} profiles`);
      return profiles;
    } catch (error: any) {
      logger.error(`Failed to search user profiles for "${searchTerm}":`, error.message);
      return [];
    }
  }

  async getOnlineUsers(limit: number = 100): Promise<UserProfile[]> {
    try {
      const result = await this.request('/tables/user_profiles/query', {
        method: 'POST',
        body: JSON.stringify({
          filter: { "is_online": true },
          page: { size: Math.min(limit, 500) },
          sort: [{ "last_seen": "desc" }]
        }),
      });

      const profiles = result.records?.map((record: XataUser) => 
        this.transformXataUserToProfile(record)
      ) || [];
      
      logger.debug(`Retrieved ${profiles.length} online users`);
      return profiles;
    } catch (error: any) {
      logger.error('Failed to get online users:', error.message);
      return [];
    }
  }

  async getUserProfilesByIds(userIds: string[]): Promise<UserProfile[]> {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return [];
    }

    try {
      // Filter valid IDs and limit batch size
      const validIds = userIds.filter(id => id && typeof id === 'string').slice(0, 200);
      
      if (validIds.length === 0) {
        return [];
      }

      const result = await this.request('/tables/user_profiles/query', {
        method: 'POST',
        body: JSON.stringify({
          filter: {
            "id": { "$any": validIds }
          },
          page: { size: validIds.length }
        }),
      });

      const profiles = result.records?.map((record: XataUser) => 
        this.transformXataUserToProfile(record)
      ) || [];
      
      logger.debug(`Retrieved ${profiles.length}/${validIds.length} profiles by IDs`);
      return profiles;
    } catch (error: any) {
      logger.error('Failed to get user profiles by IDs:', error.message);
      return [];
    }
  }

  async getUserProfileByUsername(username: string): Promise<UserProfile | null> {
    if (!username || typeof username !== 'string') {
      return null;
    }

    try {
      const result = await this.request('/tables/user_profiles/query', {
        method: 'POST',
        body: JSON.stringify({
          filter: { username: { "$equals": username.trim().toLowerCase() } },
          page: { size: 1 }
        }),
      });

      if (result.records?.[0]) {
        return this.transformXataUserToProfile(result.records[0]);
      }
      return null;
    } catch (error: any) {
      logger.error(`Failed to get user profile by username "${username}":`, error.message);
      return null;
    }
  }

  async getUserProfileByDisplayName(displayName: string): Promise<UserProfile | null> {
    if (!displayName || typeof displayName !== 'string') {
      return null;
    }

    try {
      const result = await this.request('/tables/user_profiles/query', {
        method: 'POST',
        body: JSON.stringify({
          filter: { display_name: { "$equals": displayName.trim() } },
          page: { size: 1 }
        }),
      });

      if (result.records?.[0]) {
        return this.transformXataUserToProfile(result.records[0]);
      }
      return null;
    } catch (error: any) {
      logger.error(`Failed to get user profile by display name "${displayName}":`, error.message);
      return null;
    }
  }

  async batchUpdateUserStatus(userIds: string[], status: UserStatus, isOnline: boolean): Promise<number> {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return 0;
    }

    try {
      const now = new Date().toISOString();
      let updatedCount = 0;

      // Process in batches of 10 to avoid overwhelming the API
      for (let i = 0; i < userIds.length; i += 10) {
        const batch = userIds.slice(i, i + 10);
        const promises = batch.map(async (userId) => {
          try {
            const result = await this.updateUserProfile(userId, {
              status: status,
              is_online: isOnline,
              last_seen: now,
              updated_at: now
            });
            return result !== null;
          } catch (err) {
            logger.warn(`Failed to update status for ${userId}:`, err);
            return false;
          }
        });

        const results = await Promise.allSettled(promises);
        updatedCount += results.filter(result => 
          result.status === 'fulfilled' && result.value === true
        ).length;
      }

      logger.info(`✅ Batch updated ${updatedCount}/${userIds.length} user statuses`);
      return updatedCount;
    } catch (error: any) {
      logger.error('❌ Batch status update failed:', error.message);
      return 0;
    }
  }

  async batchUpdateLastSeen(userIds: string[], timestamp: string): Promise<number> {
    if (!Array.isArray(userIds) || userIds.length === 0 || !timestamp) {
      return 0;
    }

    let updatedCount = 0;

    try {
      // Process in batches
      for (let i = 0; i < userIds.length; i += 10) {
        const batch = userIds.slice(i, i + 10);
        const updates = batch.map(async (id) => {
          try {
            const result = await this.updateUserProfile(id, { last_seen: timestamp });
            return result !== null;
          } catch (err) {
            logger.warn(`Failed to update last_seen for ${id}:`, err);
            return false;
          }
        });

        const results = await Promise.allSettled(updates);
        updatedCount += results.filter(r => 
          r.status === 'fulfilled' && r.value === true
        ).length;
      }

      logger.info(`✅ Batch updated last_seen for ${updatedCount}/${userIds.length} users`);
      return updatedCount;
    } catch (error: any) {
      logger.error('Failed to batch update last seen:', error.message);
      return 0;
    }
  }

  // ==================== FRIENDSHIPS ====================

  async getFriendsList(userId: string): Promise<FriendData[]> {
    if (!userId) {
      return [];
    }

    try {
      const result = await this.request('/tables/friendships/query', {
        method: 'POST',
        body: JSON.stringify({
          filter: {
            "$all": [
              { "user_id": userId },
              { "status": "accepted" }
            ]
          },
          columns: ["friend_id", "created_at"],
          page: { size: 200 }
        }),
      });

      if (!result.records || result.records.length === 0) {
        return [];
      }

      // Get friend profile data
      const friendIds: string[] = result.records.map((r: any) => r.friend_id);
      const friendProfiles = await this.getUserProfilesByIds(friendIds);

      const friendsMap = new Map(friendProfiles.map(p => [p.id, p]));
      const friendshipMap = new Map(result.records.map((r: any) => [r.friend_id, r.created_at]));

      return friendIds
        .map((friendId: string) => {
          const profile = friendsMap.get(friendId);
          const friendsSince = friendshipMap.get(friendId);
          
          if (!profile) return null;

          return {
            id: profile.id,
            username: profile.username,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
            status: profile.status || 'offline',
            last_seen: profile.last_seen || new Date().toISOString(),
            is_online: profile.is_online || false,
            friends_since: friendsSince
          } as FriendData;
        })
        .filter((friend: FriendData | null): friend is FriendData => friend !== null);
    } catch (error: any) {
      logger.error(`Failed to get friends list for ${userId}:`, error.message);
      return [];
    }
  }

  async createFriendship(userId: string, friendId: string): Promise<boolean> {
    if (!userId || !friendId || userId === friendId) {
      return false;
    }

    try {
      const now = new Date().toISOString();
      
      // Create friendship in both directions
      await Promise.all([
        this.request('/tables/friendships/data', {
          method: 'POST',
          body: JSON.stringify({
            user_id: userId,
            friend_id: friendId,
            status: 'accepted',
            created_at: now
          }),
        }),
        this.request('/tables/friendships/data', {
          method: 'POST',
          body: JSON.stringify({
            user_id: friendId,
            friend_id: userId,
            status: 'accepted',
            created_at: now
          }),
        })
      ]);

      logger.info(`Created friendship: ${userId} <-> ${friendId}`);
      return true;
    } catch (error: any) {
      logger.error(`Failed to create friendship ${userId} <-> ${friendId}:`, error.message);
      return false;
    }
  }

  async removeFriendship(userId: string, friendId: string): Promise<boolean> {
    if (!userId || !friendId || userId === friendId) {
      return false;
    }

    try {
      // Remove both directions of the friendship
      await Promise.all([
        this.request('/tables/friendships/query', {
          method: 'DELETE',
          body: JSON.stringify({
            filter: {
              "$all": [
                { "user_id": userId },
                { "friend_id": friendId }
              ]
            }
          }),
        }),
        this.request('/tables/friendships/query', {
          method: 'DELETE',
          body: JSON.stringify({
            filter: {
              "$all": [
                { "user_id": friendId },
                { "friend_id": userId }
              ]
            }
          }),
        })
      ]);

      logger.info(`Removed friendship: ${userId} <-> ${friendId}`);
      return true;
    } catch (error: any) {
      logger.error(`Failed to remove friendship ${userId} <-> ${friendId}:`, error.message);
      return false;
    }
  }

  // ==================== FRIEND REQUESTS ====================

  async sendFriendRequest(senderId: string, receiverId: string, message?: string): Promise<{
    success: boolean;
    message: string;
    autoAccepted?: boolean;
  }> {
    if (!senderId || !receiverId || senderId === receiverId) {
      return {
        success: false,
        message: 'Invalid sender or receiver ID'
      };
    }

    try {
      // Check if friendship already exists
      const existingFriendship = await this.request('/tables/friendships/query', {
        method: 'POST',
        body: JSON.stringify({
          filter: {
            "$all": [
              { "user_id": senderId },
              { "friend_id": receiverId },
              { "status": "accepted" }
            ]
          },
          page: { size: 1 }
        }),
      });

      if (existingFriendship.records && existingFriendship.records.length > 0) {
        return {
          success: false,
          message: 'Already friends'
        };
      }

      // Check for existing pending request
      const existingRequest = await this.request('/tables/friend_requests/query', {
        method: 'POST',
        body: JSON.stringify({
          filter: {
            "$all": [
              { "sender_id": senderId },
              { "receiver_id": receiverId },
              { "status": "pending" }
            ]
          },
          page: { size: 1 }
        }),
      });

      if (existingRequest.records && existingRequest.records.length > 0) {
        return {
          success: false,
          message: 'Friend request already sent'
        };
      }

      // Create friend request
      await this.request('/tables/friend_requests/data', {
        method: 'POST',
        body: JSON.stringify({
          sender_id: senderId,
          receiver_id: receiverId,
          message: message ? message.trim().substring(0, 500) : '',
          status: 'pending',
          created_at: new Date().toISOString()
        }),
      });

      logger.info(`Friend request sent: ${senderId} -> ${receiverId}`);
      return {
        success: true,
        message: 'Friend request sent successfully'
      };
    } catch (error: any) {
      logger.error(`Failed to send friend request ${senderId} -> ${receiverId}:`, error.message);
      return {
        success: false,
        message: 'Failed to send friend request'
      };
    }
  }

  async acceptFriendRequest(requestId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    if (!requestId) {
      return {
        success: false,
        message: 'Invalid request ID'
      };
    }

    try {
      // Get the friend request
      const request = await this.request(`/tables/friend_requests/data/${encodeURIComponent(requestId)}`);
      
      if (!request || request.status !== 'pending') {
        return {
          success: false,
          message: 'Friend request not found or already processed'
        };
      }

      // Update request status
      await this.request(`/tables/friend_requests/data/${encodeURIComponent(requestId)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'accepted'
        }),
      });

      // Create friendships
      await this.createFriendship(request.sender_id, request.receiver_id);

      logger.info(`Friend request accepted: ${requestId}`);
      return {
        success: true,
        message: 'Friend request accepted'
      };
    } catch (error: any) {
      logger.error(`Failed to accept friend request ${requestId}:`, error.message);
      return {
        success: false,
        message: 'Failed to accept friend request'
      };
    }
  }

  async declineFriendRequest(requestId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    if (!requestId) {
      return {
        success: false,
        message: 'Invalid request ID'
      };
    }

    try {
      await this.request(`/tables/friend_requests/data/${encodeURIComponent(requestId)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'declined'
        }),
      });

      logger.info(`Friend request declined: ${requestId}`);
      return {
        success: true,
        message: 'Friend request declined'
      };
    } catch (error: any) {
      logger.error(`Failed to decline friend request ${requestId}:`, error.message);
      return {
        success: false,
        message: 'Failed to decline friend request'
      };
    }
  }

  async getPendingFriendRequests(userId: string, type: 'received' | 'sent' = 'received'): Promise<any[]> {
    if (!userId) {
      return [];
    }

    try {
      const field = type === 'received' ? 'receiver_id' : 'sender_id';
      
      const result = await this.request('/tables/friend_requests/query', {
        method: 'POST',
        body: JSON.stringify({
          filter: {
            "$all": [
              { [field]: userId },
              { "status": "pending" }
            ]
          },
          sort: [{ "created_at": "desc" }],
          page: { size: 50 }
        }),
      });

      return result.records || [];
    } catch (error: any) {
      logger.error(`Failed to get ${type} friend requests for ${userId}:`, error.message);
      return [];
    }
  }

  async getFriendRequestById(requestId: string): Promise<any | null> {
    if (!requestId) {
      return null;
    }

    try {
      return await this.request(`/tables/friend_requests/data/${encodeURIComponent(requestId)}`);
    } catch (error: any) {
      if (error.message?.includes('404')) {
        return null;
      }
      logger.error(`Failed to get friend request ${requestId}:`, error.message);
      return null;
    }
  }

  // ==================== BLOCKED USERS ====================

  async blockUser(blockerId: string, blockedId: string): Promise<boolean> {
    if (!blockerId || !blockedId || blockerId === blockedId) {
      return false;
    }

    try {
      await this.request('/tables/blocked_users/data', {
        method: 'POST',
        body: JSON.stringify({
          blocker_id: blockerId,
          blocked_id: blockedId,
          created_at: new Date().toISOString()
        }),
      });

      // Remove any existing friendship
      await this.removeFriendship(blockerId, blockedId);

      logger.info(`User blocked: ${blockerId} blocked ${blockedId}`);
      return true;
    } catch (error: any) {
      logger.error(`Failed to block user ${blockedId} by ${blockerId}:`, error.message);
      return false;
    }
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<boolean> {
    if (!blockerId || !blockedId || blockerId === blockedId) {
      return false;
    }

    try {
      await this.request('/tables/blocked_users/query', {
        method: 'DELETE',
        body: JSON.stringify({
          filter: {
            "$all": [
              { "blocker_id": blockerId },
              { "blocked_id": blockedId }
            ]
          }
        }),
      });

      logger.info(`User unblocked: ${blockerId} unblocked ${blockedId}`);
      return true;
    } catch (error: any) {
      logger.error(`Failed to unblock user ${blockedId} by ${blockerId}:`, error.message);
      return false;
    }
  }

  async isUserBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    if (!blockerId || !blockedId || blockerId === blockedId) {
      return false;
    }

    try {
      const result = await this.request('/tables/blocked_users/query', {
        method: 'POST',
        body: JSON.stringify({
          filter: {
            "$all": [
              { "blocker_id": blockerId },
              { "blocked_id": blockedId }
            ]
          },
          page: { size: 1 }
        }),
      });

      return result.records && result.records.length > 0;
    } catch (error: any) {
      logger.error(`Failed to check block status ${blockerId} -> ${blockedId}:`, error.message);
      return false;
    }
  }

  async getBlockedUsers(blockerId: string): Promise<string[]> {
    if (!blockerId) {
      return [];
    }

    try {
      const result = await this.request('/tables/blocked_users/query', {
        method: 'POST',
        body: JSON.stringify({
          filter: { blocker_id: blockerId },
          columns: ['blocked_id'],
          page: { size: 500 },
        }),
      });

      return result.records?.map((r: any) => r.blocked_id) || [];
    } catch (error: any) {
      logger.error(`Failed to get blocked users for ${blockerId}:`, error.message);
      return [];
    }
  }

  async getBlockedByUsers(blockedId: string): Promise<string[]> {
    if (!blockedId) {
      return [];
    }

    try {
      const result = await this.request('/tables/blocked_users/query', {
        method: 'POST',
        body: JSON.stringify({
          filter: { blocked_id: blockedId },
          columns: ['blocker_id'],
          page: { size: 500 },
        }),
      });

      return result.records?.map((r: any) => r.blocker_id) || [];
    } catch (error: any) {
      logger.error(`Failed to get users who blocked ${blockedId}:`, error.message);
      return [];
    }
  }

  // ==================== CHAT MESSAGES ====================

  async saveChatMessage(senderId: string, receiverId: string, content: string, messageType: 'text' | 'image' | 'file' = 'text'): Promise<string | null> {
    if (!senderId || !receiverId || !content) {
      return null;
    }

    try {
      const result = await this.request('/tables/chat_messages/data', {
        method: 'POST',
        body: JSON.stringify({
          sender_id: senderId,
          receiver_id: receiverId,
          content: content.trim().substring(0, 2000),
          message_type: messageType,
          is_read: false,
          created_at: new Date().toISOString()
        }),
      });

      logger.debug(`Saved chat message: ${senderId} -> ${receiverId}`);
      return result.id;
    } catch (error: any) {
      logger.error(`Failed to save chat message ${senderId} -> ${receiverId}:`, error.message);
      return null;
    }
  }

  async getChatHistory(userId1: string, userId2: string, limit: number = 50, offset: number = 0): Promise<any[]> {
    if (!userId1 || !userId2) {
      return [];
    }

    try {
      const result = await this.request('/tables/chat_messages/query', {
        method: 'POST',
        body: JSON.stringify({
          filter: {
            "$any": [
              {
                "$all": [
                  { "sender_id": userId1 },
                  { "receiver_id": userId2 }
                ]
              },
              {
                "$all": [
                  { "sender_id": userId2 },
                  { "receiver_id": userId1 }
                ]
              }
            ]
          },
          sort: [{ "created_at": "desc" }],
          page: { size: Math.min(limit, 100), offset: Math.max(offset, 0) }
        }),
      });

      return result.records || [];
    } catch (error: any) {
      logger.error(`Failed to get chat history between ${userId1} and ${userId2}:`, error.message);
      return [];
    }
  }

  async markMessagesAsRead(userId: string, senderId: string): Promise<boolean> {
    if (!userId || !senderId) {
      return false;
    }

    try {
      await this.request('/tables/chat_messages/query', {
        method: 'PATCH',
        body: JSON.stringify({
          filter: {
            "$all": [
              { "sender_id": senderId },
              { "receiver_id": userId },
              { "is_read": false }
            ]
          },
          update: {
            is_read: true
          }
        }),
      });

      logger.debug(`Marked messages as read: ${senderId} -> ${userId}`);
      return true;
    } catch (error: any) {
      logger.error(`Failed to mark messages as read for ${userId} from ${senderId}:`, error.message);
      return false;
    }
  }

  async getUnreadMessageCount(userId: string): Promise<Record<string, number>> {
    if (!userId) {
      return {};
    }

    try {
      const result = await this.request('/tables/chat_messages/query', {
        method: 'POST',
        body: JSON.stringify({
          filter: {
            "$all": [
              { "receiver_id": userId },
              { "is_read": false }
            ]
          },
          columns: ["sender_id"],
          page: { size: 1000 }
        }),
      });

      const counts: Record<string, number> = {};
      result.records?.forEach((record: any) => {
        counts[record.sender_id] = (counts[record.sender_id] || 0) + 1;
      });

      return counts;
    } catch (error: any) {
      logger.error(`Failed to get unread message count for ${userId}:`, error.message);
      return {};
    }
  }

  // ==================== UTILITY METHODS ====================

  async testConnection(): Promise<boolean> {
    try {
      await this.request('/tables/user_profiles/schema');
      logger.debug('✅ Xata connection test successful');
      return true;
    } catch (error: any) {
      logger.error('❌ Xata connection test failed:', error.message);
      return false;
    }
  }

  async getDatabaseStats(): Promise<{
    userProfiles: number;
    friendships: number;
    friendRequests: number;
    blockedUsers: number;
    chatMessages: number;
  }> {
    try {
      const [profiles, friendships, requests, blocked, messages] = await Promise.allSettled([
        this.request('/tables/user_profiles/query', {
          method: 'POST',
          body: JSON.stringify({
            page: { size: 0 },
            summaries: { count: "*" }
          })
        }),
        this.request('/tables/friendships/query', {
          method: 'POST',
          body: JSON.stringify({
            page: { size: 0 },
            summaries: { count: "*" }
          })
        }),
        this.request('/tables/friend_requests/query', {
          method: 'POST',
          body: JSON.stringify({
            page: { size: 0 },
            summaries: { count: "*" }
          })
        }),
        this.request('/tables/blocked_users/query', {
          method: 'POST',
          body: JSON.stringify({
            page: { size: 0 },
            summaries: { count: "*" }
          })
        }),
        this.request('/tables/chat_messages/query', {
          method: 'POST',
          body: JSON.stringify({
            page: { size: 0 },
            summaries: { count: "*" }
          })
        })
      ]);

      return {
        userProfiles: profiles.status === 'fulfilled' ? (profiles.value.meta?.summaries?.count || 0) : 0,
        friendships: friendships.status === 'fulfilled' ? (friendships.value.meta?.summaries?.count || 0) : 0,
        friendRequests: requests.status === 'fulfilled' ? (requests.value.meta?.summaries?.count || 0) : 0,
        blockedUsers: blocked.status === 'fulfilled' ? (blocked.value.meta?.summaries?.count || 0) : 0,
        chatMessages: messages.status === 'fulfilled' ? (messages.value.meta?.summaries?.count || 0) : 0,
      };
    } catch (error: any) {
      logger.error('Failed to get database stats:', error.message);
      return {
        userProfiles: 0,
        friendships: 0,
        friendRequests: 0,
        blockedUsers: 0,
        chatMessages: 0,
      };
    }
  }

  // ==================== TRANSFORM METHODS ====================

  private transformXataUserToProfile(xataUser: XataUser): UserProfile {
    try {
      return {
        id: xataUser.id,
        username: xataUser.username,
        display_name: xataUser.display_name,
        avatar_url: xataUser.avatar_url,
        banner_url: xataUser.banner_url,
        pronouns: xataUser.pronouns,
        status: xataUser.status,
        display_name_color: xataUser.display_name_color,
        display_name_animation: xataUser.display_name_animation,
        rainbow_speed: xataUser.rainbow_speed,
        badges: this.parseJsonField(xataUser.badges, []),
        bio: xataUser.bio,
        last_seen: xataUser.last_seen,
        is_online: xataUser.is_online,
        profile_complete: xataUser.profile_complete,
        created_at: xataUser.xata?.createdAt,
        updated_at: xataUser.xata?.updatedAt,
        profile_card_css: xataUser.profile_card_css,
        easy_customization_data: this.parseJsonField(xataUser.easy_customization_data, {}),
        blocked_users: this.parseJsonField(xataUser.blocked_users, []),
      };
    } catch (error: any) {
      logger.error('Failed to transform Xata user to profile:', error.message);
      throw error;
    }
  }

  private transformProfileToXataUser(profile: Partial<UserProfile>): Partial<XataUser> {
    const xataUser: Partial<XataUser> = {};
    
    if (profile.username) xataUser.username = profile.username;
    if (profile.display_name !== undefined) xataUser.display_name = profile.display_name;
    if (profile.avatar_url !== undefined) xataUser.avatar_url = profile.avatar_url;
    if (profile.banner_url !== undefined) xataUser.banner_url = profile.banner_url;
    if (profile.pronouns !== undefined) xataUser.pronouns = profile.pronouns;
    if (profile.status !== undefined) xataUser.status = profile.status;
    if (profile.display_name_color !== undefined) xataUser.display_name_color = profile.display_name_color;
    if (profile.display_name_animation !== undefined) xataUser.display_name_animation = profile.display_name_animation;
    if (profile.rainbow_speed !== undefined) xataUser.rainbow_speed = profile.rainbow_speed;
    if (profile.badges !== undefined) xataUser.badges = profile.badges;
    if (profile.bio !== undefined) xataUser.bio = profile.bio;
    if (profile.last_seen !== undefined) xataUser.last_seen = profile.last_seen;
    if (profile.is_online !== undefined) xataUser.is_online = profile.is_online;
    if (profile.profile_complete !== undefined) xataUser.profile_complete = profile.profile_complete;
    if (profile.profile_card_css !== undefined) xataUser.profile_card_css = profile.profile_card_css;
    if (profile.easy_customization_data !== undefined) xataUser.easy_customization_data = profile.easy_customization_data;
    if (profile.blocked_users !== undefined) xataUser.blocked_users = profile.blocked_users;

    return xataUser;
  }

  private parseJsonField(field: any, defaultValue: any): any {
    if (field === null || field === undefined) {
      return defaultValue;
    }
    
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch (error) {
        logger.warn('Failed to parse JSON field, using default:', error);
        return defaultValue;
      }
    }
    
    return field;
  }

  // Health check methods
  getConnectionStatus(): {
    initialized: boolean;
    retries: number;
    maxRetries: number;
    dbBranch: string;
  } {
    return {
      initialized: this.isInitialized,
      retries: this.connectionRetries,
      maxRetries: this.MAX_RETRIES,
      dbBranch: this.dbBranch
    };
  }
}

// ==================== SINGLETON INSTANCE ====================

let xataClient: XataClient | null = null;

export function initializeXata(): XataClient | null {
  const databaseUrl = process.env.XATA_DB_URL;
  const apiKey = process.env.XATA_API_KEY;
  const branch = process.env.XATA_BRANCH;

  if (!databaseUrl || !apiKey) {
    logger.error('❌ Missing Xata environment variables:', {
      hasDatabaseUrl: !!databaseUrl,
      hasApiKey: !!apiKey,
      branch: branch || 'not specified'
    });
    logger.info('📋 Required environment variables:');
    logger.info('   - XATA_DB_URL');
    logger.info('   - XATA_API_KEY');
    logger.info('   - XATA_BRANCH (optional, defaults to main)');
    return null;
  }

  try {
    xataClient = new XataClient(databaseUrl, apiKey, branch);
    
    logger.info('✅ Xata client initialized successfully');
    logger.info(`🗄️ Database URL: ${databaseUrl.substring(0, 50)}...`);
    logger.info(`🔑 API key configured: ${apiKey.substring(0, 20)}...`);
    logger.info(`🌿 Branch: ${branch || 'main (default)'}`);
    
    return xataClient;
  } catch (error: any) {
    logger.error('❌ Failed to initialize Xata client:', error.message);
    return null;
  }
}

export function getXataClient(): XataClient | null {
  if (!xataClient) {
    logger.warn('⚠️ Xata client not initialized, attempting to initialize...');
    xataClient = initializeXata();
  }
  return xataClient;
}

export async function testXataConnection(): Promise<boolean> {
  if (!xataClient) {
    logger.warn('⚠️ No Xata client available for testing');
    return false;
  }

  try {
    logger.info('🔍 Testing Xata database connection...');
    const isConnected = await xataClient.testConnection();
    
    if (isConnected) {
      logger.info('✅ Xata database connection test successful');
      
      // Test basic operations
      try {
        const stats = await xataClient.getDatabaseStats();
        logger.info('📊 Xata database stats:', stats);
      } catch (error: any) {
        logger.warn('⚠️ Could not fetch database stats (non-critical):', error.message);
      }
    } else {
      logger.error('❌ Xata database connection test failed');
    }
    
    return isConnected;
  } catch (error: any) {
    logger.error('❌ Xata connection test exception:', error.message);
    return false;
  }
}

export async function getXataStats(): Promise<any> {
  if (!xataClient) {
    return {
      connected: false,
      error: 'Xata client not initialized'
    };
  }

  try {
    const stats = await xataClient.getDatabaseStats();
    const connectionStatus = xataClient.getConnectionStatus();
    
    return {
      connected: true,
      stats,
      connectionStatus,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    return {
      connected: false,
      error: error.message || 'Unknown error'
    };
  }
}

// Initialize on module load if environment variables are available
if (process.env.XATA_DB_URL && process.env.XATA_API_KEY) {
  xataClient = initializeXata();
}