// src/components/ProfileCustomizer/hooks/useProfileData.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { sanitizeCSS } from '@/lib/SafeCSS';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '../../../hooks/use-debounce';
import { uploadFile } from '../utils/fileHandlers';
import type { EasyCustomization, Badge } from '../types';

interface UseProfileDataProps {
  username: string;
  originalUsername: string;
  currentUser: any;
  mountedRef: React.MutableRefObject<boolean>;
  onProfileLoaded: (data: { user: any; profile: any }) => void;
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
  
  // Track if profile has been loaded to prevent repeated loads
  const profileLoadedRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);
  const loadingRef = useRef(false); // Prevent concurrent loads
  
  const { toast } = useToast();
  const debouncedUsername = useDebounce(username, 500);

  // Username availability check - FIXED to prevent infinite loops
  useEffect(() => {
    const checkUsername = async () => {
      // Early returns to prevent unnecessary API calls
      if (!debouncedUsername || 
          debouncedUsername.length < 3 || 
          !currentUser || 
          !mountedRef.current ||
          saving || 
          loading ||
          loadingRef.current) {
        setUsernameAvailable(null);
        return;
      }

      // If username matches original, it's available (user's own username)
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
          .neq('id', currentUser.id)
          .limit(1); // Limit to 1 for performance

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

    // Only check if conditions are met and not currently loading
    if (currentUser && debouncedUsername && debouncedUsername.length >= 3 && !loadingRef.current) {
      checkUsername();
    }
  }, [debouncedUsername, currentUser?.id, originalUsername, mountedRef, saving, loading]);

  // FIXED: Stable loadCurrentProfile function that prevents infinite loops
  const loadCurrentProfile = useCallback(async () => {
    // Prevent multiple simultaneous loads
    if (!mountedRef.current || loading || saving || loadingRef.current) {
      console.log('ProfileCustomizer: Skipping load - component unmounted or already loading');
      return null;
    }
    
    loadingRef.current = true;
    setLoading(true);
    console.log('ProfileCustomizer: Starting profile load...');
    
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

      if (!mountedRef.current) {
        console.log('ProfileCustomizer: Component unmounted during auth check');
        return null;
      }

      // Check if we already loaded this user's profile
      if (profileLoadedRef.current && lastUserIdRef.current === user.id) {
        console.log('ProfileCustomizer: Profile already loaded for this user');
        setLoading(false);
        loadingRef.current = false;
        return { user, profile: null, alreadyLoaded: true };
      }

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
        .eq('id', user.id)
        .maybeSingle(); // Use maybeSingle instead of expecting array

      if (!mountedRef.current) {
        console.log('ProfileCustomizer: Component unmounted during profile fetch');
        return null;
      }

      if (error) {
        console.error('ProfileCustomizer: Error loading profile:', error);
        // Don't show error for missing profile (PGRST116)
        if (error.code !== 'PGRST116') {
          toast({
            title: "Error",
            description: "Failed to load profile data"
          });
        }
        // Still call onProfileLoaded for new profiles
        onProfileLoaded({ user, profile: null });
        profileLoadedRef.current = true;
        lastUserIdRef.current = user.id;
        return { user, profile: null };
      } else {
        const profile = data;
        console.log('ProfileCustomizer: Profile data loaded:', profile);
        onProfileLoaded({ user, profile });
        profileLoadedRef.current = true;
        lastUserIdRef.current = user.id;
        return { user, profile };
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
        loadingRef.current = false;
      }
    }
  }, [mountedRef, onProfileLoaded, toast]); // Minimal stable dependencies

  // Reset profile loaded state when user changes
  useEffect(() => {
    if (currentUser?.id && lastUserIdRef.current !== currentUser.id) {
      profileLoadedRef.current = false;
      lastUserIdRef.current = null;
      loadingRef.current = false;
    }
  }, [currentUser?.id]);

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
    if (saving || !mountedRef.current) {
      console.log('ProfileCustomizer: Save already in progress or component unmounted');
      return false;
    }

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
    console.log('ProfileCustomizer: Starting save process...');
    
    try {
      let finalAvatarUrl = profileData.avatarUrl;
      let finalBannerUrl = profileData.bannerUrl;

      // Upload files if present
      if (profileData.avatarFile) {
        console.log('ProfileCustomizer: Uploading avatar...');
        finalAvatarUrl = await uploadFile(profileData.avatarFile, 'avatars', currentUser.id);
      }

      if (profileData.bannerFile) {
        console.log('ProfileCustomizer: Uploading banner...');
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
        updated_at: new Date().toISOString(),
        last_seen: new Date().toISOString()
      };

      console.log('ProfileCustomizer: Checking if profile exists...');
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (existingProfile) {
        console.log('ProfileCustomizer: Updating existing profile...');
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update(saveData)
          .eq('id', currentUser.id);

        if (updateError) {
          throw new Error(`Failed to update profile: ${updateError.message}`);
        }
      } else {
        console.log('ProfileCustomizer: Creating new profile...');
        const insertData = {
          id: currentUser.id,
          ...saveData,
          profile_complete: true,
          created_at: new Date().toISOString()
        };

        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert(insertData);

        if (insertError) {
          throw new Error(`Failed to create profile: ${insertError.message}`);
        }
      }

      console.log('ProfileCustomizer: Save completed successfully');
      toast({
        title: "Success",
        description: "Profile customization saved!"
      });

      // Reset the profile loaded flag so next open will reload fresh data
      profileLoadedRef.current = false;
      loadingRef.current = false;

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