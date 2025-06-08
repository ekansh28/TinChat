// src/components/ProfileCustomizer/hooks/useProfileData.ts
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { sanitizeCSS } from '@/lib/SafeCSS';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import { uploadFile } from '../utils/fileHandlers';
import type { EasyCustomization, Badge } from '../types';

interface UseProfileDataProps {
  username: string;
  originalUsername: string;
  currentUser: any;
  mountedRef: React.MutableRefObject<boolean>;
  onProfileLoaded: (profile: any) => void;
}

export const useProfileData = ({
  username,
  originalUsername,
  currentUser,
  mountedRef,
  onProfileLoaded
}: UseProfileDataProps) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null | 'checking'>(null);
  
  const { toast } = useToast();
  const debouncedUsername = useDebounce(username, 500);

  // Username availability check
  useEffect(() => {
    const checkUsername = async () => {
      if (!debouncedUsername || debouncedUsername.length < 3 || !currentUser || !mountedRef.current) {
        setUsernameAvailable(null);
        return;
      }

      if (debouncedUsername === originalUsername) {
        setUsernameAvailable(true);
        return;
      }

      setUsernameAvailable('checking');
      
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('username')
          .eq('username', debouncedUsername)
          .neq('id', currentUser.id);

        if (!mountedRef.current) return;

        if (error) {
          console.error('Error checking username availability:', error);
          setUsernameAvailable(null);
        } else {
          setUsernameAvailable(!data || data.length === 0);
        }
      } catch (error) {
        console.error('Exception checking username:', error);
        if (mountedRef.current) {
          setUsernameAvailable(null);
        }
      }
    };

    checkUsername();
  }, [debouncedUsername, currentUser, originalUsername, mountedRef]);

  const loadCurrentProfile = useCallback(async () => {
    if (!mountedRef.current) return;
    
    setLoading(true);
    try {
      console.log('ProfileCustomizer: Getting current user...');
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('ProfileCustomizer: Auth error:', userError);
        toast({
          title: "Authentication Error",
          description: "Please sign in to customize your profile"
        });
        return null;
      }

      if (!mountedRef.current) return null;

      console.log('ProfileCustomizer: Loading profile for user:', user.id);

      const { data, error } = await supabase
        .from('user_profiles')
        .select(`
          profile_card_css, 
          bio, 
          display_name, 
          username, 
          avatar_url, 
          banner_url,
          pronouns,
          status,
          display_name_color,
          display_name_animation,
          rainbow_speed,
          easy_customization_data,
          badges
        `)
        .eq('id', user.id);

      if (!mountedRef.current) return null;

      if (error) {
        console.error('ProfileCustomizer: Error loading profile:', error);
        return null;
      } else if (data && data.length > 0) {
        const profile = data[0];
        console.log('ProfileCustomizer: Profile data loaded:', profile);
        onProfileLoaded({ user, profile });
        return { user, profile };
      } else {
        // Initialize defaults for new profile
        onProfileLoaded({ user, profile: null });
        return { user, profile: null };
      }
    } catch (error) {
      console.error('ProfileCustomizer: Exception loading profile:', error);
      if (mountedRef.current) {
        toast({
          title: "Error",
          description: "Failed to load profile data"
        });
      }
      return null;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [mountedRef, onProfileLoaded, toast]);

  const handleSave = useCallback(async (profileData: {
    customCSS: string;
    bio: string;
    displayName: string;
    username: string;
    pronouns: string;
    status: string;
    displayNameColor: string;
    displayNameAnimation: string;
    rainbowSpeed: number;
    avatarFile: File | null;
    avatarUrl: string | null;
    bannerFile: File | null;
    bannerUrl: string | null;
    badges: Badge[];
    easyCustomization: EasyCustomization;
  }) => {
    if (saving || !mountedRef.current) return false;

    if (!currentUser) {
      toast({
        title: "Authentication Error",
        description: "No user found - please refresh and try again"
      });
      return false;
    }

    if (!profileData.username || profileData.username.length < 3) {
      toast({
        title: "Invalid Username",
        description: "Username must be at least 3 characters long"
      });
      return false;
    }

    if (usernameAvailable === false) {
      toast({
        title: "Username Taken",
        description: "Please choose a different username"
      });
      return false;
    }

    setSaving(true);
    
    try {
      let finalAvatarUrl = profileData.avatarUrl;
      let finalBannerUrl = profileData.bannerUrl;

      if (profileData.avatarFile) {
        finalAvatarUrl = await uploadFile(profileData.avatarFile, 'avatars', currentUser.id);
      }

      if (profileData.bannerFile) {
        finalBannerUrl = await uploadFile(profileData.bannerFile, 'banners', currentUser.id);
      }

      const finalCSS = sanitizeCSS(profileData.customCSS);

      const saveData = {
        profile_card_css: finalCSS,
        bio: profileData.bio.trim(),
        display_name: profileData.displayName.trim() || null,
        username: profileData.username.trim(),
        pronouns: profileData.pronouns.trim() || null,
        status: profileData.status,
        display_name_color: profileData.displayNameColor,
        display_name_animation: profileData.displayNameAnimation,
        rainbow_speed: profileData.rainbowSpeed,
        avatar_url: finalAvatarUrl,
        banner_url: finalBannerUrl,
        badges: JSON.stringify(profileData.badges),
        easy_customization_data: JSON.stringify(profileData.easyCustomization),
        last_seen: new Date().toISOString()
      };

      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', currentUser.id);

      if (existingProfile && existingProfile.length > 0) {
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update(saveData)
          .eq('id', currentUser.id);

        if (updateError) {
          throw new Error(`Failed to update profile: ${updateError.message}`);
        }
      } else {
        const insertData = {
          id: currentUser.id,
          ...saveData,
          profile_complete: true
        };

        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert(insertData);

        if (insertError) {
          throw new Error(`Failed to create profile: ${insertError.message}`);
        }
      }

      toast({
        title: "Success",
        description: "Profile customization saved!"
      });

      return true;

    } catch (error: any) {
      console.error('ProfileCustomizer: Save error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save profile customization"
      });
      return false;
    } finally {
      if (mountedRef.current) {
        setSaving(false);
      }
    }
  }, [saving, mountedRef, currentUser, usernameAvailable, toast]);

  return {
    loading,
    saving,
    usernameAvailable,
    loadCurrentProfile,
    handleSave,
  };
};