// src/components/ProfileCustomizer/types.ts

export interface Badge {
  id: string;
  url: string;
  name?: string;
}

export interface UserProfile {
  id?: string;
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
  profile_complete?: boolean;
  created_at?: string;
  updated_at?: string;
  is_online?: boolean;
  last_seen?: string;
  blocked_users?: string[];
  profile_card_css?: string;
  easy_customization_data?: any;
  badges?: Badge[];
}

export interface ProfileCustomizerState {
  profile: UserProfile;
  badges: Badge[];
  customCSS: string;
  saving: boolean;
  loading: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ProfileCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
}