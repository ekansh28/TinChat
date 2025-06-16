// src/components/ProfileCustomizer/hooks/useProfileCustomizer.ts
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { UserProfile, Badge } from '../types';

interface UseProfileCustomizerReturn {
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  badges: Badge[];
  setBadges: React.Dispatch<React.SetStateAction<Badge[]>>;
  customCSS: string;
  setCustomCSS: React.Dispatch<React.SetStateAction<string>>;
  saving: boolean;
  loading: boolean;
  saveProfile: (userId: string) => Promise<void>;
  loadProfile: (userId: string) => Promise<void>;
  resetToDefaults: () => void;
}

const DEFAULT_PROFILE: UserProfile = {
  username: '',
  display_name: '',
  avatar_url: '',
  banner_url: '',
  pronouns: '',
  bio: '',
  status: 'online',
  display_name_color: '#000000',
  display_name_animation: 'none',
  rainbow_speed: 3,
  profile_complete: false,
  badges: []
};

export const useProfileCustomizer = (): UseProfileCustomizerReturn => {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [customCSS, setCustomCSS] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadProfile = useCallback(async (userId: string) => {
    if (!userId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading profile:', error);
        return;
      }

      if (data) {
        // Parse badges safely
        let parsedBadges: Badge[] = [];
        if (data.badges) {
          try {
            parsedBadges = typeof data.badges === 'string' 
              ? JSON.parse(data.badges) 
              : data.badges;
            if (!Array.isArray(parsedBadges)) parsedBadges = [];
          } catch (e) {
            console.warn('Failed to parse badges:', e);
            parsedBadges = [];
          }
        }

        setProfile({
          ...data,
          badges: undefined // Remove badges from profile object
        });
        setBadges(parsedBadges);
        setCustomCSS(data.profile_card_css || '');
      } else {
        // No profile found, use defaults but keep the userId
        setProfile({ ...DEFAULT_PROFILE, id: userId });
        setBadges([]);
        setCustomCSS('');
      }
    } catch (error) {
      console.error('Exception loading profile:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveProfile = useCallback(async (userId: string) => {
    if (!userId) throw new Error('User ID is required');

    setSaving(true);
    try {
      // Validate required fields
      if (!profile.username?.trim()) {
        throw new Error('Username is required');
      }

      if (profile.username.length < 3) {
        throw new Error('Username must be at least 3 characters');
      }

      if (profile.username.length > 20) {
        throw new Error('Username must be less than 20 characters');
      }

      // Prepare the profile data
      const profileData = {
        id: userId,
        username: profile.username.trim(),
        display_name: profile.display_name?.trim() || null,
        avatar_url: profile.avatar_url?.trim() || null,
        banner_url: profile.banner_url?.trim() || null,
        pronouns: profile.pronouns?.trim() || null,
        bio: profile.bio?.trim() || null,
        status: profile.status || 'online',
        display_name_color: profile.display_name_color || '#000000',
        display_name_animation: profile.display_name_animation || 'none',
        rainbow_speed: profile.rainbow_speed || 3,
        profile_card_css: customCSS.trim() || null,
        badges: badges.length > 0 ? JSON.stringify(badges) : null,
        profile_complete: true,
        updated_at: new Date().toISOString()
      };

      // Use upsert to handle both insert and update
      const { error } = await supabase
        .from('user_profiles')
        .upsert(profileData, {
          onConflict: 'id'
        });

      if (error) {
        console.error('Error saving profile:', error);
        throw new Error(error.message || 'Failed to save profile');
      }

      console.log('Profile saved successfully');
    } catch (error) {
      console.error('Exception saving profile:', error);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [profile, badges, customCSS]);

  const resetToDefaults = useCallback(() => {
    setProfile(DEFAULT_PROFILE);
    setBadges([]);
    setCustomCSS('');
  }, []);

  return {
    profile,
    setProfile,
    badges,
    setBadges,
    customCSS,
    setCustomCSS,
    saving,
    loading,
    saveProfile,
    loadProfile,
    resetToDefaults
  };
};