// Create a shared types file: server/types/User.ts
export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';

export interface User {
  id: string;
  authId: string | null;
  interests: string[];
  chatType: 'text' | 'video';
  username?: string | undefined;
  displayName?: string | undefined;
  avatarUrl?: string | undefined;
  bannerUrl?: string | undefined;
  pronouns?: string | undefined;
  status?: UserStatus | undefined;
  displayNameColor?: string | undefined;
  displayNameAnimation?: string | undefined;
  rainbowSpeed?: number | undefined;
  badges?: any[] | undefined;
  connectionStartTime?: number | undefined;
}

