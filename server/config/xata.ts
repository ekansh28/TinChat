// server/config/xata.ts - ENHANCED XATA CLIENT WITH FULL DATABASE OPERATIONS
import { logger } from '../utils/logger';
import { UserProfile } from '../managers/profile/ProfileManager';
import { FriendData } from '../managers/profile/types/FriendTypes';
import { UserStatus } from '../types/User';

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

// Enhanced HTTP client for Xata REST API with full CRUD operations
class XataClient {
  private baseUrl: string;
  private apiKey: string;
  private dbBranch: string;

  constructor(databaseUrl: string, apiKey: string, branch: string = 'main') {
    this.baseUrl = databaseUrl.replace('/db:', `/db:${branch}:`);
    this.apiKey = apiKey;
    this.dbBranch = branch;
    logger.info(`🗄️ Xata client initialized for branch: ${branch}`);
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-Xata-Agent': 'tinchat-server@1.0.0',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Xata API error ${response.status}:`, errorText);
        throw new Error(`Xata API error: ${response.status} ${errorText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return response.json();
      }
      
      return response.text();
    } catch (error: any) {
      logger.error(`Xata request failed for ${endpoint}:`, error.message);
      throw error;
    }
  }

  // ==================== USER PROFILES ====================

  async getUserProfile(id: string): Promise<UserProfile | null> {
    try {
      const result = await this.request(`/tables/user_profiles/data/${id}`);
      return this.transformXataUserToProfile(result);
    } catch (error: any) {
      if (error.message.includes('404')) {
        return null; // Profile not found
      }
      throw error;
    }
  }

  async createUserProfile(id: string, data: Partial<UserProfile>): Promise<UserProfile> {
    const payload = {
      id,
      ...this.transformProfileToXataUser(data),
    };

    const result = await this.request(`/tables/user_profiles/data`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return this.transformXataUserToProfile(result);
  }

  async updateUserProfile(id: string, data: Partial<UserProfile>): Promise<UserProfile | null> {
    try {
      const payload = this.transformProfileToXataUser(data);
      const result = await this.request(`/tables/user_profiles/data/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      return this.transformXataUserToProfile(result);
    } catch (error: any) {
      if (error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async deleteUserProfile(id: string): Promise<boolean> {
    try {
      await this.request(`/tables/user_profiles/data/${id}`, {
        method: 'DELETE',
      });
      return true;
    } catch (error: any) {
      if (error.message.includes('404')) {
        return false;
      }
      throw error;
    }
  }

  async searchUserProfiles(searchTerm: string, limit: number = 20): Promise<UserProfile[]> {
    const filter = {
      "$any": [
        { "username": { "$iContains": searchTerm } },
        { "display_name": { "$iContains": searchTerm } }
      ]
    };

    const result = await this.request('/tables/user_profiles/query', {
      method: 'POST',
      body: JSON.stringify({
        filter,
        page: { size: limit },
        sort: [{ "username": "asc" }]
      }),
    });

    return result.records?.map((record: XataUser) => this.transformXataUserToProfile(record)) || [];
  }

  async getOnlineUsers(limit: number = 100): Promise<UserProfile[]> {
    const result = await this.request('/tables/user_profiles/query', {
      method: 'POST',
      body: JSON.stringify({
        filter: { "is_online": true },
        page: { size: limit },
        sort: [{ "last_seen": "desc" }]
      }),
    });

    return result.records?.map((record: XataUser) => this.transformXataUserToProfile(record)) || [];
  }

  async batchUpdateUserStatus(userIds: string[], status: UserStatus, isOnline: boolean): Promise<number> {
    try {
      const now = new Date().toISOString();
      let updatedCount = 0;

      // Process in batches of 10
      for (let i = 0; i < userIds.length; i += 10) {
        const batch = userIds.slice(i, i + 10);
        const promises = batch.map(userId => 
          this.updateUserProfile(userId, {
            status: status,
            is_online: isOnline,
            last_seen: now,
            updated_at: now
          }).catch(err => {
            logger.warn(`Failed to update status for ${userId}:`, err);
            return null;
          })
        );

        const results = await Promise.all(promises);
        updatedCount += results.filter(result => result !== null).length;
      }

      logger.info(`✅ Batch updated ${updatedCount}/${userIds.length} user statuses`);
      return updatedCount;
    } catch (error) {
      logger.error('❌ Batch status update failed:', error);
      return 0;
    }
  }

  // ==================== FRIENDSHIPS ====================

  async getFriendsList(userId: string): Promise<FriendData[]> {
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
  }

  async createFriendship(userId: string, friendId: string): Promise<boolean> {
    try {
      await this.request('/tables/friendships/data', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          friend_id: friendId,
          status: 'accepted',
          created_at: new Date().toISOString()
        }),
      });

      // Create reciprocal friendship
      await this.request('/tables/friendships/data', {
        method: 'POST',
        body: JSON.stringify({
          user_id: friendId,
          friend_id: userId,
          status: 'accepted',
          created_at: new Date().toISOString()
        }),
      });

      return true;
    } catch (error) {
      logger.error(`Failed to create friendship ${userId} <-> ${friendId}:`, error);
      return false;
    }
  }

  async removeFriendship(userId: string, friendId: string): Promise<boolean> {
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

      return true;
    } catch (error) {
      logger.error(`Failed to remove friendship ${userId} <-> ${friendId}:`, error);
      return false;
    }
  }

  // ==================== FRIEND REQUESTS ====================

  async sendFriendRequest(senderId: string, receiverId: string, message?: string): Promise<{
    success: boolean;
    message: string;
    autoAccepted?: boolean;
  }> {
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
          message: message || '',
          status: 'pending',
          created_at: new Date().toISOString()
        }),
      });

      return {
        success: true,
        message: 'Friend request sent successfully'
      };
    } catch (error) {
      logger.error(`Failed to send friend request ${senderId} -> ${receiverId}:`, error);
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
    try {
      // Get the friend request
      const request = await this.request(`/tables/friend_requests/data/${requestId}`);
      
      if (!request || request.status !== 'pending') {
        return {
          success: false,
          message: 'Friend request not found or already processed'
        };
      }

      // Update request status
      await this.request(`/tables/friend_requests/data/${requestId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'accepted'
        }),
      });

      // Create friendships
      await this.createFriendship(request.sender_id, request.receiver_id);

      return {
        success: true,
        message: 'Friend request accepted'
      };
    } catch (error) {
      logger.error(`Failed to accept friend request ${requestId}:`, error);
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
    try {
      await this.request(`/tables/friend_requests/data/${requestId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'declined'
        }),
      });

      return {
        success: true,
        message: 'Friend request declined'
      };
    } catch (error) {
      logger.error(`Failed to decline friend request ${requestId}:`, error);
      return {
        success: false,
        message: 'Failed to decline friend request'
      };
    }
  }

  async getPendingFriendRequests(userId: string, type: 'received' | 'sent' = 'received'): Promise<any[]> {
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
  }

  // ==================== BLOCKED USERS ====================

  async blockUser(blockerId: string, blockedId: string): Promise<boolean> {
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

      return true;
    } catch (error) {
      logger.error(`Failed to block user ${blockedId} by ${blockerId}:`, error);
      return false;
    }
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<boolean> {
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

      return true;
    } catch (error) {
      logger.error(`Failed to unblock user ${blockedId} by ${blockerId}:`, error);
      return false;
    }
  }

  async isUserBlocked(blockerId: string, blockedId: string): Promise<boolean> {
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
    } catch (error) {
      logger.error(`Failed to check block status ${blockerId} -> ${blockedId}:`, error);
      return false;
    }
  }

  // ==================== CHAT MESSAGES ====================

  async saveChatMessage(senderId: string, receiverId: string, content: string, messageType: 'text' | 'image' | 'file' = 'text'): Promise<string | null> {
    try {
      const result = await this.request('/tables/chat_messages/data', {
        method: 'POST',
        body: JSON.stringify({
          sender_id: senderId,
          receiver_id: receiverId,
          content,
          message_type: messageType,
          is_read: false,
          created_at: new Date().toISOString()
        }),
      });

      return result.id;
    } catch (error) {
      logger.error(`Failed to save chat message ${senderId} -> ${receiverId}:`, error);
      return null;
    }
  }

  async getChatHistory(userId1: string, userId2: string, limit: number = 50, offset: number = 0): Promise<any[]> {
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
        page: { size: limit, offset }
      }),
    });

    return result.records || [];
  }

  async markMessagesAsRead(userId: string, senderId: string): Promise<boolean> {
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

      return true;
    } catch (error) {
      logger.error(`Failed to mark messages as read for ${userId} from ${senderId}:`, error);
      return false;
    }
  }

  async getUnreadMessageCount(userId: string): Promise<Record<string, number>> {
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
    } catch (error) {
      logger.error(`Failed to get unread message count for ${userId}:`, error);
      return {};
    }
  }

  // ==================== UTILITY METHODS ====================

  async getUserProfilesByIds(userIds: string[]): Promise<UserProfile[]> {
    if (userIds.length === 0) return [];

    const result = await this.request('/tables/user_profiles/query', {
      method: 'POST',
      body: JSON.stringify({
        filter: {
          "id": { "$any": userIds }
        },
        page: { size: Math.min(userIds.length, 200) }
      }),
    });

    return result.records?.map((record: XataUser) => this.transformXataUserToProfile(record)) || [];
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.request('/tables/user_profiles/schema');
      logger.info('✅ Xata connection test successful');
      return true;
    } catch (error) {
      logger.error('❌ Xata connection test failed:', error);
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
    } catch (error) {
      logger.error('Failed to get database stats:', error);
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
      badges: xataUser.badges,
      bio: xataUser.bio,
      last_seen: xataUser.last_seen,
      is_online: xataUser.is_online,
      profile_complete: xataUser.profile_complete,
      created_at: xataUser.xata?.createdAt,
      updated_at: xataUser.xata?.updatedAt,
      profile_card_css: xataUser.profile_card_css,
      easy_customization_data: xataUser.easy_customization_data,
      blocked_users: xataUser.blocked_users,
    };
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
}

// ==================== SINGLETON INSTANCE ====================

let xataClient: XataClient | null = null;

export function initializeXata(): XataClient | null {
  const databaseUrl = process.env.XATA_DB_URL;
  const apiKey = process.env.XATA_API_KEY;
  const branch = process.env.XATA_BRANCH || 'main';

  if (!databaseUrl || !apiKey) {
    logger.error('❌ Missing Xata environment variables:', {
      hasDatabaseUrl: !!databaseUrl,
      hasApiKey: !!apiKey,
      branch
    });
    logger.info('📋 Required environment variables:');
    logger.info('   - XATA_DB_URL');
    logger.info('   - XATA_API_KEY');
    logger.info('   - XATA_BRANCH (optional, defaults to "main")');
    return null;
  }

  try {
    xataClient = new XataClient(databaseUrl, apiKey, branch);
    logger.info('✅ Xata client initialized successfully');
    logger.info(`🗄️ Database URL: ${databaseUrl.substring(0, 50)}...`);
    logger.info(`🔑 API key configured: ${apiKey.substring(0, 20)}...`);
    logger.info(`🌿 Branch: ${branch}`);
    return xataClient;
  } catch (error) {
    logger.error('❌ Failed to initialize Xata client:', error);
    return null;
  }
}

export function getXataClient(): XataClient | null {
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
      } catch (error) {
        logger.warn('⚠️ Could not fetch database stats (non-critical):', error);
      }
    } else {
      logger.error('❌ Xata database connection test failed');
    }
    
    return isConnected;
  } catch (error) {
    logger.error('❌ Xata connection test exception:', error);
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
    return {
      connected: true,
      stats,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}