// server/managers/profile/types/FriendTypes.ts - COMPLETE TYPE DEFINITIONS
import { UserStatus } from '../../../types/User';

// ============ CORE FRIEND TYPES ============

export interface FriendData {
  id: string; // clerk_id for external identification
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  status: UserStatus;
  last_seen: string;
  is_online: boolean;
  friends_since?: string;
  // Optional extended fields
  badges?: string[];
  display_name_color?: string;
  profile_complete?: boolean;
  mutual_friends_count?: number;
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  message?: string | null;
  status: FriendRequestStatus;
  created_at: string;
  updated_at?: string;
  // Populated relations
  sender?: FriendProfile;
  receiver?: FriendProfile;
}

export interface FriendProfile {
  id: string;
  clerk_id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  is_online?: boolean;
  status?: string;
  badges?: string[];
}

export interface FriendshipStatus {
  status: FriendshipStatusType;
  since?: string;
  mutual_friends_count?: number;
}

// ============ ENUMS AND UNION TYPES ============

export type FriendshipStatusType = 
  | 'none' 
  | 'friends' 
  | 'pending_sent' 
  | 'pending_received' 
  | 'blocked' 
  | 'blocked_by';

export type FriendRequestStatus = 
  | 'pending' 
  | 'accepted' 
  | 'declined' 
  | 'expired';

export type FriendSortBy = 
  | 'name' 
  | 'status' 
  | 'recent_activity' 
  | 'friends_since' 
  | 'mutual_friends';

export type FriendFilterBy = 
  | 'all' 
  | 'online' 
  | 'offline' 
  | 'favorites' 
  | 'recent';

// ============ API RESPONSE TYPES ============

export interface FriendsListResponse {
  friends: FriendData[];
  total_count: number;
  online_count: number;
  has_more?: boolean;
  cursor?: string;
}

export interface FriendRequestsResponse {
  requests: FriendRequest[];
  total_count: number;
  type: 'received' | 'sent';
}

export interface FriendSearchResponse {
  users: FriendSearchResult[];
  total_count: number;
  search_term: string;
  has_more?: boolean;
}

export interface FriendSearchResult {
  id: string; // clerk_id
  username: string;
  display_name?: string;
  avatar_url?: string;
  status?: string;
  is_online?: boolean;
  mutual_friends_count?: number;
  friendship_status: FriendshipStatusType;
  badges?: string[];
}

export interface FriendStatsResponse {
  friend_count: number;
  online_friends_count: number;
  pending_sent_count: number;
  pending_received_count: number;
  blocked_users_count: number;
  mutual_friends_with_recent?: number;
}

export interface MutualFriendsResponse {
  mutual_friends: FriendData[];
  count: number;
  user1_id: string;
  user2_id: string;
}

// ============ OPERATION RESULT TYPES ============

export interface FriendOperationResult {
  success: boolean;
  message: string;
  data?: any;
  auto_accepted?: boolean;
}

export interface FriendRequestResult extends FriendOperationResult {
  request_id?: string;
  auto_accepted?: boolean;
}

export interface FriendshipResult extends FriendOperationResult {
  friendship_status?: FriendshipStatusType;
  mutual_friends_count?: number;
}

// ============ PAGINATION AND FILTERING ============

export interface FriendsPaginationOptions {
  limit?: number;
  offset?: number;
  cursor?: string;
  sort_by?: FriendSortBy;
  filter_by?: FriendFilterBy;
  search_query?: string;
}

export interface FriendsFilterOptions {
  status?: UserStatus | UserStatus[];
  is_online?: boolean;
  has_mutual_friends?: boolean;
  is_favorite?: boolean;
  last_seen_after?: string;
  last_seen_before?: string;
}

// ============ CACHE AND PERFORMANCE TYPES ============

export interface FriendsCacheData {
  friends: FriendData[];
  cached_at: number;
  expires_at: number;
  version: string;
}

export interface FriendsModuleStats {
  total_friendships: number;
  pending_requests: number;
  blocked_users: number;
  cache_hit_rate: number;
  avg_query_time: number;
  cache_enabled: boolean;
  last_cleanup: string;
}

export interface FriendsPerformanceMetrics {
  query_times: {
    get_friends_list: number;
    send_friend_request: number;
    accept_friend_request: number;
    search_users: number;
  };
  cache_metrics: {
    hit_rate: number;
    miss_rate: number;
    invalidations: number;
    size: number;
  };
  database_metrics: {
    connection_pool_size: number;
    active_connections: number;
    query_count: number;
    error_rate: number;
  };
}

// ============ WEBHOOK AND EVENT TYPES ============

export interface FriendEventData {
  event_type: FriendEventType;
  user_id: string;
  friend_id?: string;
  request_id?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export type FriendEventType = 
  | 'friend_request_sent'
  | 'friend_request_received'
  | 'friend_request_accepted'
  | 'friend_request_declined'
  | 'friendship_created'
  | 'friendship_removed'
  | 'user_blocked'
  | 'user_unblocked'
  | 'friend_status_changed'
  | 'friend_online'
  | 'friend_offline';

// ============ VALIDATION TYPES ============

export interface FriendRequestValidation {
  is_valid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface FriendshipValidation {
  can_send_request: boolean;
  can_accept_request: boolean;
  can_remove_friend: boolean;
  can_block_user: boolean;
  reasons: string[];
}

// ============ SETTINGS AND PREFERENCES ============

export interface FriendPrivacySettings {
  allow_friend_requests: boolean;
  allow_friend_requests_from: 'everyone' | 'mutual_friends' | 'none';
  show_online_status: boolean;
  show_last_seen: boolean;
  show_mutual_friends: boolean;
  auto_accept_from_mutual_friends: boolean;
}

export interface FriendNotificationSettings {
  friend_request_received: boolean;
  friend_request_accepted: boolean;
  friend_online: boolean;
  friend_offline: boolean;
  friend_message: boolean;
  push_notifications: boolean;
  email_notifications: boolean;
}

// ============ BULK OPERATIONS ============

export interface BulkFriendOperation {
  operation: 'add' | 'remove' | 'block' | 'unblock';
  user_ids: string[];
  message?: string;
  force?: boolean;
}

export interface BulkFriendOperationResult {
  success_count: number;
  failure_count: number;
  total_count: number;
  results: Array<{
    user_id: string;
    success: boolean;
    message: string;
  }>;
}

// ============ RECOMMENDATIONS AND SUGGESTIONS ============

export interface FriendSuggestion {
  user_id: string; // clerk_id
  username: string;
  display_name?: string;
  avatar_url?: string;
  mutual_friends_count: number;
  confidence_score: number;
  reason: FriendSuggestionReason;
  mutual_friends?: FriendData[];
}

export type FriendSuggestionReason = 
  | 'mutual_friends'
  | 'common_interests'
  | 'location_proximity'
  | 'activity_similarity'
  | 'contact_import'
  | 'social_graph';

export interface FriendRecommendationsResponse {
  suggestions: FriendSuggestion[];
  total_count: number;
  algorithm_version: string;
  refresh_interval: number;
}

// ============ ANALYTICS AND INSIGHTS ============

export interface FriendAnalytics {
  user_id: string;
  total_friends: number;
  active_friends: number; // friends active in last 30 days
  friend_growth_rate: number; // friends added per month
  mutual_connections: number;
  network_reach: number; // friends of friends
  interaction_frequency: Record<string, number>; // friend_id -> interaction count
  top_mutual_friends: Array<{
    friend_id: string;
    mutual_count: number;
  }>;
}

export interface FriendNetworkInsights {
  cluster_count: number;
  bridge_connections: string[]; // friend IDs that connect clusters
  network_density: number;
  avg_path_length: number;
  influential_friends: Array<{
    friend_id: string;
    influence_score: number;
  }>;
}

// ============ IMPORT/EXPORT TYPES ============

export interface FriendsImportData {
  source: 'contacts' | 'social_media' | 'csv' | 'manual';
  contacts: Array<{
    identifier: string; // email, phone, username
    display_name?: string;
    source_id?: string;
  }>;
  auto_send_requests: boolean;
  import_message?: string;
}

export interface FriendsExportData {
  format: 'json' | 'csv' | 'vcf';
  include_private_data: boolean;
  friends: Array<{
    username: string;
    display_name?: string;
    email?: string;
    phone?: string;
    friendship_date: string;
    interaction_count?: number;
  }>;
  export_timestamp: string;
  user_id: string;
}

// ============ REAL-TIME TYPES ============

export interface FriendPresenceUpdate {
  user_id: string;
  is_online: boolean;
  status: UserStatus;
  last_seen: string;
  device_type?: 'mobile' | 'desktop' | 'web';
  location?: string;
}

export interface FriendActivityUpdate {
  user_id: string;
  activity_type: 'typing' | 'viewing_profile' | 'playing_game' | 'listening_music';
  activity_data?: Record<string, any>;
  timestamp: string;
}

// ============ ERROR TYPES ============

export class FriendsModuleError extends Error {
  constructor(
    message: string,
    public code: FriendsErrorCode,
    public details?: any
  ) {
    super(message);
    this.name = 'FriendsModuleError';
  }
}

export type FriendsErrorCode = 
  | 'USER_NOT_FOUND'
  | 'ALREADY_FRIENDS'
  | 'REQUEST_ALREADY_SENT'
  | 'REQUEST_NOT_FOUND'
  | 'CANNOT_FRIEND_SELF'
  | 'USER_BLOCKED'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INVALID_PARAMETERS'
  | 'DATABASE_ERROR'
  | 'CACHE_ERROR'
  | 'NETWORK_ERROR';

// ============ CONFIGURATION TYPES ============

export interface FriendsModuleConfig {
  cache: {
    enabled: boolean;
    default_ttl: number;
    max_entries: number;
    invalidation_strategy: 'time_based' | 'manual' | 'hybrid';
  };
  limits: {
    max_friends_per_user: number;
    max_pending_requests: number;
    friend_request_rate_limit: number;
    search_results_limit: number;
  };
  features: {
    mutual_friends_enabled: boolean;
    friend_suggestions_enabled: boolean;
    bulk_operations_enabled: boolean;
    analytics_enabled: boolean;
    real_time_presence: boolean;
  };
  database: {
    connection_pool_size: number;
    query_timeout: number;
    retry_attempts: number;
    enable_read_replicas: boolean;
  };
  notifications: {
    enabled: boolean;
    delivery_methods: Array<'push' | 'email' | 'sms' | 'webhook'>;
    rate_limits: Record<string, number>;
  };
}

// ============ TESTING AND MOCKING TYPES ============

export interface MockFriendData extends Partial<FriendData> {
  _isMock: true;
  _mockId: string;
}

export interface FriendsTestScenario {
  name: string;
  description: string;
  initial_state: {
    users: MockFriendData[];
    friendships: Array<[string, string]>;
    requests: Partial<FriendRequest>[];
    blocked: Array<[string, string]>;
  };
  operations: Array<{
    type: string;
    parameters: Record<string, any>;
    expected_result: any;
  }>;
}

// ============ UTILITY TYPES ============

export type FriendDataOptional = Partial<FriendData>;
export type FriendRequestOptional = Partial<FriendRequest>;

export interface FriendsQueryBuilder {
  user_id(id: string): FriendsQueryBuilder;
  status(status: UserStatus): FriendsQueryBuilder;
  online(isOnline: boolean): FriendsQueryBuilder;
  limit(count: number): FriendsQueryBuilder;
  offset(count: number): FriendsQueryBuilder;
  sortBy(field: FriendSortBy): FriendsQueryBuilder;
  build(): string;
}

// ============ API REQUEST/RESPONSE WRAPPERS ============

export interface FriendsApiRequest<T = any> {
  user_id: string;
  auth_token?: string;
  parameters: T;
  metadata?: Record<string, any>;
}

export interface FriendsApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: FriendsErrorCode;
    message: string;
    details?: any;
  };
  metadata: {
    timestamp: string;
    request_id: string;
    processing_time: number;
    rate_limit?: {
      remaining: number;
      reset_time: string;
    };
  };
}

// ============ LEGACY COMPATIBILITY ============

/**
 * @deprecated Use FriendData instead
 */
export interface Friend extends FriendData {}

/**
 * @deprecated Use FriendRequest instead
 */
export interface PendingFriendRequest extends FriendRequest {}

/**
 * @deprecated Use FriendshipStatus instead
 */
export interface RelationshipStatus extends FriendshipStatus {}

// ============ EXPORTS ============

export default {
  FriendData,
  FriendRequest,
  FriendProfile,
  FriendshipStatus,
  FriendsListResponse,
  FriendRequestsResponse,
  FriendSearchResponse,
  FriendStatsResponse,
  FriendOperationResult,
  FriendsModuleError,
  FriendsModuleConfig
};

// ============ TYPE GUARDS ============

export function isFriendData(obj: any): obj is FriendData {
  return obj && 
    typeof obj.id === 'string' && 
    typeof obj.username === 'string' && 
    typeof obj.is_online === 'boolean' &&
    typeof obj.status === 'string';
}

export function isFriendRequest(obj: any): obj is FriendRequest {
  return obj && 
    typeof obj.id === 'string' && 
    typeof obj.sender_id === 'string' && 
    typeof obj.receiver_id === 'string' &&
    ['pending', 'accepted', 'declined', 'expired'].includes(obj.status);
}

export function isFriendshipStatus(obj: any): obj is FriendshipStatus {
  return obj && 
    ['none', 'friends', 'pending_sent', 'pending_received', 'blocked', 'blocked_by'].includes(obj.status);
}

export function isValidFriendEventType(type: string): type is FriendEventType {
  return [
    'friend_request_sent',
    'friend_request_received', 
    'friend_request_accepted',
    'friend_request_declined',
    'friendship_created',
    'friendship_removed',
    'user_blocked',
    'user_unblocked',
    'friend_status_changed',
    'friend_online',
    'friend_offline'
  ].includes(type);
}

// ============ CONSTANTS ============

export const FRIENDS_CONSTANTS = {
  MAX_FRIENDS_PER_USER: 5000,
  MAX_PENDING_REQUESTS: 100,
  MAX_SEARCH_RESULTS: 50,
  CACHE_TTL_SECONDS: 300,
  RATE_LIMIT_REQUESTS_PER_MINUTE: 60,
  REQUEST_EXPIRY_DAYS: 30,
  MAX_MESSAGE_LENGTH: 500,
  MAX_USERNAME_LENGTH: 30,
  MIN_USERNAME_LENGTH: 3,
  MUTUAL_FRIENDS_LIMIT: 50,
  SUGGESTIONS_LIMIT: 20
} as const;

export const FRIENDS_STATUS_COLORS = {
  online: '#00ff00',
  idle: '#ffff00', 
  dnd: '#ff0000',
  offline: '#808080'
} as const;

export const FRIENDS_RELATIONSHIP_LABELS = {
  none: 'No relationship',
  friends: 'Friends',
  pending_sent: 'Request sent',
  pending_received: 'Request received', 
  blocked: 'Blocked',
  blocked_by: 'Blocked by user'
} as const;