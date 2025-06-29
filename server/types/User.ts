// server/types/User.ts - COMPREHENSIVE TYPE DEFINITIONS FOR TINCHAT

// ==================== CORE USER TYPES ====================

export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';
export type ChatType = 'text' | 'video';
export type MessageType = 'text' | 'image' | 'file';
export type FriendshipStatus = 'none' | 'friends' | 'pending_sent' | 'pending_received' | 'blocked' | 'blocked_by';
export type RequestStatus = 'pending' | 'accepted' | 'declined';

// ==================== SOCKET/MATCHMAKING USER ====================

/**
 * User object used for Socket.IO connections and matchmaking
 */
export interface User {
  id: string;
  authId: string | null;
  interests: string[];
  chatType: ChatType;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  pronouns?: string;
  status?: UserStatus;
  displayNameColor?: string;
  displayNameAnimation?: string;
  rainbowSpeed?: number;
  badges?: Badge[];
  connectionStartTime?: number;
}

// ==================== DATABASE USER PROFILE ====================

/**
 * Complete user profile stored in database (Xata/Supabase)
 */
export interface UserProfile {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  banner_url?: string;
  pronouns?: string;
  status?: UserStatus;
  display_name_color?: string;
  display_name_animation?: string;
  rainbow_speed?: number;
  badges?: Badge[];
  bio?: string;
  last_seen?: string;
  is_online?: boolean;
  profile_complete?: boolean;
  created_at?: string;
  updated_at?: string;
  profile_card_css?: string;
  easy_customization_data?: any;
  blocked_users?: string[];
}

/**
 * User badge/achievement definition
 */
export interface Badge {
  id: string;
  name: string;
  description?: string;
  url: string;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  earned_at?: string;
}

// ==================== FRIENDS SYSTEM ====================

/**
 * Friend data with status information
 */
export interface FriendData {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  status: UserStatus;
  last_seen: string;
  is_online: boolean;
  friends_since?: string;
}

/**
 * Friend request object
 */
export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  message?: string;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
  sender?: PublicUserInfo;
  receiver?: PublicUserInfo;
}

/**
 * Friendship status between two users
 */
export interface FriendshipStatusData {
  status: FriendshipStatus;
  since?: string;
}

/**
 * Public user information (for friend requests, search results, etc.)
 */
export interface PublicUserInfo {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  status?: UserStatus;
  is_online?: boolean;
  badges?: Badge[];
}

// ==================== CHAT SYSTEM ====================

/**
 * Chat message object
 */
export interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  message_type: MessageType;
  is_read: boolean;
  created_at: string;
  sender?: PublicUserInfo;
}

/**
 * Chat conversation summary
 */
export interface ChatConversation {
  friend_id: string;
  friend: PublicUserInfo;
  last_message?: ChatMessage;
  unread_count: number;
  last_activity: string;
}

// ==================== AUTHENTICATION ====================

/**
 * Authentication result from Clerk
 */
export interface AuthResult {
  userId: string | null;
  isAuthenticated: boolean;
  user?: ClerkUser;
  error?: string;
  cached?: boolean;
}

/**
 * Clerk user information
 */
export interface ClerkUser {
  id: string;
  emailAddresses: Array<{
    emailAddress: string;
    verification?: {
      status: string;
    };
  }>;
  username?: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  createdAt: number;
  updatedAt: number;
  lastSignInAt?: number;
  banned?: boolean;
  locked?: boolean;
}

/**
 * Authentication info for API responses
 */
export interface AuthInfo {
  userId?: string;
  username?: string;
  email?: string;
}

// ==================== API RESPONSES ====================

/**
 * Standard API response format
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  cached?: boolean;
  fetchTime?: number;
  authenticated?: boolean;
  source?: 'xata' | 'supabase' | 'cache';
  auth?: AuthInfo;
}

/**
 * Search result for user profiles
 */
export interface UserSearchResult {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  status?: UserStatus;
  is_online?: boolean;
  badges?: Badge[];
}

/**
 * Cleaned profile for API responses (with dynamic properties)
 */
export interface CleanedProfile extends UserSearchResult {
  banner_url?: string;
  bio?: string;
  profile_card_css?: string;
  avatar_url_large?: boolean;
  banner_url_large?: boolean;
  [key: string]: any;
}

// ==================== SOCKET.IO EVENTS ====================

/**
 * Socket.IO event types
 */
export interface SocketEvents {
  // Connection events
  identify_tab: (data: {
    tabId?: string;
    chatType?: ChatType;
    authId?: string;
    isReconnect?: boolean;
    timestamp?: number;
  }) => void;
  
  tab_identified: (data: {
    socketId: string;
    tabId: string;
    chatType?: ChatType;
    isReconnect: boolean;
    timestamp: number;
  }) => void;
  
  // Chat events
  join_chat_queue: (data: {
    interests: string[];
    chatType: ChatType;
    userProfile?: PublicUserInfo;
  }) => void;
  
  leave_chat_queue: () => void;
  
  match_found: (data: {
    roomId: string;
    chatType: ChatType;
    partner: PublicUserInfo;
  }) => void;
  
  // Friends events
  friend_request_received: (data: FriendRequest) => void;
  friend_request_accepted: (data: { friend: FriendData }) => void;
  friend_status_changed: (data: { 
    friendId: string; 
    status: UserStatus; 
    isOnline: boolean 
  }) => void;
  
  // Message events
  private_message: (data: ChatMessage) => void;
  message_read: (data: { 
    messageId: string; 
    senderId: string 
  }) => void;
  
  // Error events
  error: (data: { 
    message: string; 
    code?: string 
  }) => void;
}

// ==================== UTILITY TYPES ====================

/**
 * Status update for batch operations
 */
export interface StatusUpdate {
  authId: string;
  status: UserStatus;
  lastSeen?: string;
}

/**
 * Batch status update data
 */
export interface BatchStatusUpdate {
  authId: string;
  isOnline: boolean;
}

/**
 * Database health check result
 */
export interface HealthCheckResult {
  connected: boolean;
  latency?: number;
  error?: string;
  strategy?: string;
}

/**
 * Comprehensive health status
 */
export interface ServiceHealth {
  database: boolean;
  redis?: boolean;
  overall: boolean;
  cachePerformance?: any;
  errors: string[];
  dbLatency?: number;
  redisLatency?: number;
}

// ==================== VALIDATION TYPES ====================

/**
 * Username validation result
 */
export interface UsernameValidation {
  valid: boolean;
  available: boolean;
  reason?: string;
}

/**
 * Profile validation result
 */
export interface ProfileValidation {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

// ==================== STATISTICS TYPES ====================

/**
 * User statistics
 */
export interface UserStats {
  friendCount: number;
  pendingSentCount: number;
  pendingReceivedCount: number;
  onlineFriendsCount: number;
  totalChatMessages?: number;
  profileViews?: number;
}

/**
 * Server statistics
 */
export interface ServerStats {
  onlineUserCount: number;
  totalConnections: number;
  waitingUsers: {
    text: number;
    video: number;
  };
  totalRooms: number;
  databases: {
    xata: boolean;
    supabase: boolean;
    primary: 'xata' | 'supabase' | 'none';
  };
  authentication: {
    clerk: boolean;
    cacheStats: any;
  };
  performance: {
    avgResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
  };
  redisEnabled: boolean;
  profileApiEnabled: boolean;
  friendsChat: {
    activeRooms: number;
    activeTyping: number;
    redisEnabled: boolean;
    cacheEnabled: boolean;
    retention24h: boolean;
  };
}

// ==================== TYPE GUARDS ====================

/**
 * Type guard to check if a user status is valid
 */
export function isValidUserStatus(status: any): status is UserStatus {
  return ['online', 'idle', 'dnd', 'offline'].includes(status);
}

/**
 * Type guard to check if a chat type is valid
 */
export function isValidChatType(chatType: any): chatType is ChatType {
  return ['text', 'video'].includes(chatType);
}

/**
 * Type guard to check if a message type is valid
 */
export function isValidMessageType(messageType: any): messageType is MessageType {
  return ['text', 'image', 'file'].includes(messageType);
}

/**
 * Type guard to check if a friendship status is valid
 */
export function isValidFriendshipStatus(status: any): status is FriendshipStatus {
  return ['none', 'friends', 'pending_sent', 'pending_received', 'blocked', 'blocked_by'].includes(status);
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Create a public user info object from a full user profile
 */
export function createPublicUserInfo(profile: UserProfile): PublicUserInfo {
  return {
    id: profile.id,
    username: profile.username,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    status: profile.status,
    is_online: profile.is_online,
    badges: profile.badges,
  };
}

/**
 * Create a user object for Socket.IO from a profile
 */
export function createSocketUser(
  profile: UserProfile,
  interests: string[],
  chatType: ChatType,
  connectionStartTime: number = Date.now()
): User {
  return {
    id: profile.id,
    authId: profile.id,
    interests,
    chatType,
    username: profile.username,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    bannerUrl: profile.banner_url,
    pronouns: profile.pronouns,
    status: profile.status,
    displayNameColor: profile.display_name_color,
    displayNameAnimation: profile.display_name_animation,
    rainbowSpeed: profile.rainbow_speed,
    badges: profile.badges,
    connectionStartTime,
  };
}

/**
 * Sanitize user profile for public display
 */
export function sanitizeProfileForPublic(profile: UserProfile): CleanedProfile {
  const sanitized: CleanedProfile = {
    id: profile.id,
    username: profile.username,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    banner_url: profile.banner_url,
    status: profile.status,
    is_online: profile.is_online,
    badges: profile.badges,
  };

  // Add truncated bio if present
  if (profile.bio && profile.bio.length > 200) {
    sanitized.bio = profile.bio.substring(0, 200) + '...';
  } else if (profile.bio) {
    sanitized.bio = profile.bio;
  }

  return sanitized;
}