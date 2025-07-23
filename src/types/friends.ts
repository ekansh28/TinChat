// src/types/friends.ts - UNIFIED FRIENDS SYSTEM TYPES
export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';

// ===== CORE FRIEND INTERFACE =====

export interface Friend {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  status: UserStatus;
  last_seen: string;
  is_online: boolean;
  friends_since?: string;
  unreadCount?: number;
  lastMessage?: {
    text: string;
    timestamp: Date;
    isFromSelf: boolean;
    messageId: string;
  };
  mutualFriends?: number;
  authId: string;
  
  // ✅ MISSING PROPERTIES FROM FRIENDSWINDOW
  displayName?: string;        // Alternative to display_name
  avatarUrl?: string;          // Alternative to avatar_url  
  lastSeen?: Date;             // Alternative to last_seen (as Date)
  isFavorite?: boolean;        // Favorite status
  badges?: string[];           // User badges
}

// ✅ MISSING FRIEND REQUEST INTERFACE
export interface FriendRequest {
  id: string;
  from: Friend;
  to: Friend;
  timestamp: Date;
  type: 'incoming' | 'outgoing';
  message?: string;
}


export interface FriendRequestApiData {
  id: string;
  message?: string;
  created_at: string;
  sender?: {
    id: string;
    clerk_id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
    is_online?: boolean;
  };
  receiver?: {
    id: string;
    clerk_id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
    is_online?: boolean;
  };
}

export interface FriendRequestsApiResponse {
  success: boolean;
  requests: {
    received: FriendRequestApiData[];
    sent: FriendRequestApiData[];
  };
}

// ✅ MISSING FRIENDS WINDOW PROPS INTERFACE  
export interface FriendsWindowProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

// ✅ MISSING FRIENDS STATE INTERFACE
export interface FriendsState {
  friends: Friend[];
  pendingRequests: FriendRequest[];
  blockedUsers: Friend[];
  isLoading: boolean;
  error: string | null;
}

// ===== BLOCKED USER INTERFACE =====
export interface BlockedUser {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
}

export interface BlockedUsersApiResponse {
  success: boolean;
  blocked: BlockedUser[];
}

// ===== CHAT MESSAGE INTERFACE =====
export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  message: string;
  timestamp: number;
  read: boolean;
  senderProfile?: {
    username: string;
    displayName?: string;
    avatarUrl?: string;
    displayNameColor?: string;
  };
}

// ===== LEGACY SUPPORT - For backward compatibility =====
export interface LegacyFriend {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  isOnline: boolean;
  lastMessage?: {
    text: string;
    timestamp: Date;
    isFromSelf: boolean;
  };
}

// ===== LEGACY CHAT MESSAGE - For backward compatibility =====
export interface LegacyChatMessage {
  id: string;
  friendId: string;
  text: string;
  isFromSelf: boolean;
  timestamp: Date;
}

// ===== TRANSFORMATION UTILITIES =====
export const transformToModernFriend = (legacy: LegacyFriend): Friend => ({
  id: legacy.id,
  username: legacy.username,
  display_name: legacy.displayName,
  avatar_url: legacy.avatar,
  status: legacy.isOnline ? 'online' : 'offline',
  last_seen: new Date().toISOString(),
  is_online: legacy.isOnline,
  authId: legacy.id, // ✅ FIXED: Add missing authId property
  unreadCount: 0,
  lastMessage: legacy.lastMessage ? {
    text: legacy.lastMessage.text,
    timestamp: legacy.lastMessage.timestamp,
    isFromSelf: legacy.lastMessage.isFromSelf,
    messageId: `legacy-${Date.now()}`
  } : undefined
});


export const transformToLegacyFriend = (modern: Friend): LegacyFriend => ({
  id: modern.id,
  username: modern.username,
  displayName: modern.display_name || modern.username,
  avatar: modern.avatar_url,
  isOnline: modern.is_online,
  lastMessage: modern.lastMessage ? {
    text: modern.lastMessage.text,
    timestamp: modern.lastMessage.timestamp,
    isFromSelf: modern.lastMessage.isFromSelf
  } : undefined
});

export const transformToChatMessage = (legacy: LegacyChatMessage): ChatMessage => ({
  id: legacy.id,
  senderId: legacy.isFromSelf ? 'current-user' : legacy.friendId,
  receiverId: legacy.isFromSelf ? legacy.friendId : 'current-user',
  message: legacy.text,
  timestamp: legacy.timestamp.getTime(),
  read: false
});

export const transformToLegacyChatMessage = (modern: ChatMessage, currentUserId: string): LegacyChatMessage => ({
  id: modern.id,
  friendId: modern.senderId === currentUserId ? modern.receiverId : modern.senderId,
  text: modern.message,
  isFromSelf: modern.senderId === currentUserId,
  timestamp: new Date(modern.timestamp)
});

// ===== COMPONENT PROP INTERFACES =====
export interface FriendsWindowProps {
  onOpenChat: (friend: Friend) => void;
  onClose: () => void;
  theme: 'win98' | 'win7' | 'winxp';
  currentUserId?: string;
}

export interface FriendsChatWindowProps {
  friend: Friend;
  messages: ChatMessage[];
  onSendMessage: (friendId: string, message: string) => void;
  onClose: () => void;
  position: number;
  theme: 'win98' | 'win7' | 'winxp';
}

// ===== TYPING STATUS INTERFACE =====
export interface TypingStatus {
  userId: string;
  friendId: string;
  isTyping: boolean;
  timestamp?: number;
}

// ===== OPEN CHAT INTERFACE =====
export interface OpenChat {
  friendId: string;
  friend: Friend;
  messages: ChatMessage[];
  position: number;
}

// ===== API RESPONSE INTERFACES =====
export interface FriendsApiResponse {
  success: boolean;
  friends: Friend[];
  count: number;
  cached?: boolean;
  timestamp: string;
}

export interface ChatHistoryResponse {
  success: boolean;
  messages: ChatMessage[];
  hasMore: boolean;
  totalCount: number;
}

export interface UnreadCountsResponse {
  success: boolean;
  unreadCounts: Record<string, number>;
  timestamp: string;
}

// ===== UTILITY TYPES =====
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'reconnecting';

export type FriendshipStatus = 
  | 'none' 
  | 'friends' 
  | 'pending_sent' 
  | 'pending_received' 
  | 'blocked' 
  | 'blocked_by';

// ===== CONSTANTS =====
export const CHAT_CONSTANTS = {
  MAX_MESSAGE_LENGTH: 2000,
  MAX_OPEN_CHATS: 3,
  MESSAGE_RETENTION_HOURS: 24,
  TYPING_TIMEOUT_MS: 5000,
  RECONNECT_DELAY_MS: 3000,
  HEARTBEAT_INTERVAL_MS: 30000,
  MAX_SEARCH_RESULTS: 50,
  MAX_CHAT_HISTORY_LOAD: 100,
  NOTIFICATION_DURATION_MS: 5000,
} as const;

export const STATUS_COLORS = {
  online: '#4CAF50',
  idle: '#FFC107',
  dnd: '#F44336',
  offline: '#9E9E9E',
} as const;

// ===== TYPE GUARDS =====
export const isFriend = (obj: any): obj is Friend => {
  return obj && 
    typeof obj.id === 'string' &&
    typeof obj.username === 'string' &&
    typeof obj.is_online === 'boolean' &&
    typeof obj.last_seen === 'string';
};

export const isChatMessage = (obj: any): obj is ChatMessage => {
  return obj &&
    typeof obj.id === 'string' &&
    typeof obj.senderId === 'string' &&
    typeof obj.receiverId === 'string' &&
    typeof obj.message === 'string' &&
    typeof obj.timestamp === 'number';
};

// ===== ERROR TYPES =====
export class FriendsChatError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'FriendsChatError';
  }
}

export class ConnectionError extends FriendsChatError {
  constructor(message: string, details?: any) {
    super(message, 'CONNECTION_ERROR', details);
    this.name = 'ConnectionError';
  }
}

export class ValidationError extends FriendsChatError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}