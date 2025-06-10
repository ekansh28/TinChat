// Create a shared types file: server/types/User.ts
export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';

export interface User {
  id: string; // Socket ID
  authId: string | null;
  interests: string[];
  chatType: 'text' | 'video';
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  pronouns?: string;
  status?: UserStatus;
  displayNameColor?: string;
  displayNameAnimation?: string;
  rainbowSpeed?: number;
  badges?: any[];
}
