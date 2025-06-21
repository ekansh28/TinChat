// server/managers/profile/types/FriendTypes.ts
import { UserStatus } from '../../../types/User';
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

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  message?: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  updated_at: string;
}

export interface FriendshipStatus {
  status: 'none' | 'friends' | 'pending_sent' | 'pending_received' | 'blocked' | 'blocked_by';
  since?: string;
}