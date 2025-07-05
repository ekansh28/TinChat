// ===============================
// 3. Hook: src/components/ProfileCustomizer/hooks/useProfileCustomizer.ts
// ===============================

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { UserProfile, Badge } from '../types';

// Helper function to safely get error message
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
};

// Helper function to check if error is a TypeError
const isTypeError = (error: unknown): error is TypeError => {
  return error instanceof TypeError;
};

// Helper function to deep compare objects for change detection
const isEqual = (obj1: any, obj2: any): boolean => {
  if (obj1 === obj2) return true;
  
  if (obj1 == null || obj2 == null) return obj1 === obj2;
  
  if (typeof obj1 !== typeof obj2) return false;
  
  if (typeof obj1 !== 'object') return obj1 === obj2;
  
  if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;
  
  if (Array.isArray(obj1)) {
    if (obj1.length !== obj2.length) return false;
    for (let i = 0; i < obj1.length; i++) {
      if (!isEqual(obj1[i], obj2[i])) return false;
    }
    return true;
  }
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!isEqual(obj1[key], obj2[key])) return false;
  }
  
  return true;
};

interface UseProfileCustomizerReturn {
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  badges: Badge[];
  setBadges: React.Dispatch<React.SetStateAction<Badge[]>>;
  customCSS: string;
  setCustomCSS: React.Dispatch<React.SetStateAction<string>>;
  saving: boolean;
  loading: boolean;
  error: string | null;
  loadingProgress: number;
  hasChanges: boolean;
  saveProfile: (userId: string) => Promise<void>;
  loadProfile: (userId: string) => Promise<void>;
  resetToDefaults: () => void;
  discardChanges: () => void;
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
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // Track original state for change detection
  const [originalProfile, setOriginalProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [originalBadges, setOriginalBadges] = useState<Badge[]>([]);
  const [originalCustomCSS, setOriginalCustomCSS] = useState<string>('');
  
  // Track mount state to prevent memory leaks
  const mountedRef = useRef(true);
  
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Simple progress update function with delays
  const updateProgressWithDelay = useCallback(async (targetProgress: number, delay: number = 500) => {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        if (mountedRef.current) {
          setLoadingProgress(targetProgress);
        }
        resolve();
      }, delay);
    });
  }, []);

  // Check if any changes have been made
  const hasChanges = useMemo(() => {
    const profileChanged = !isEqual(profile, originalProfile);
    const badgesChanged = !isEqual(badges, originalBadges);
    const cssChanged = customCSS.trim() !== originalCustomCSS.trim();
    
    return profileChanged || badgesChanged || cssChanged;
  }, [profile, originalProfile, badges, originalBadges, customCSS, originalCustomCSS]);

  // Load profile using API route
  const loadProfile = useCallback(async (clerkUserId: string) => {
    if (!clerkUserId || !mountedRef.current) {
      console.warn('No Clerk user ID provided to loadProfile or component unmounted');
      return;
    }

    setLoading(true);
    setError(null);
    setLoadingProgress(0);

    try {
      console.log(`ProfileCustomizer: Loading profile for Clerk user ${clerkUserId}`);
      
      await updateProgressWithDelay(15, 200);
      await updateProgressWithDelay(30, 300);
      await updateProgressWithDelay(50, 200);
      
      // Call API route with enhanced error handling
      let response: Response;
      try {
        response = await fetch('/api/profile/save', {
          method: 'GET',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });
        
        console.log('ProfileCustomizer: Load response status:', response.status);
        
      } catch (fetchError: unknown) {
        console.error('ProfileCustomizer: Load fetch error:', fetchError);
        
        const errorMessage = getErrorMessage(fetchError);
        
        if (isTypeError(fetchError) && errorMessage === 'fetch failed') {
          throw new Error('Network error: Unable to connect to server. Please check your internet connection and try again.');
        }
        
        throw new Error(`Network request failed: ${errorMessage}`);
      }

      if (!mountedRef.current) {
        console.log('ProfileCustomizer: Component unmounted during fetch');
        return;
      }

      await updateProgressWithDelay(70, 300);

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Server error: ${response.status} ${response.statusText}`);
        } else {
          const errorText = await response.text();
          console.error('ProfileCustomizer: Non-JSON error response:', errorText);
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
      }

      const result = await response.json();
      await updateProgressWithDelay(85, 250);

      if (result.success && result.data) {
        console.log(`ProfileCustomizer: Profile loaded:`, result.data);
        
        let parsedBadges: Badge[] = [];
        if (result.data.badges) {
          try {
            parsedBadges = Array.isArray(result.data.badges) 
              ? result.data.badges 
              : JSON.parse(result.data.badges);
            parsedBadges = parsedBadges.filter(badge => 
              badge && typeof badge === 'object' && badge.id && badge.url
            );
          } catch (e) {
            console.warn('Failed to parse badges, using empty array:', e);
            parsedBadges = [];
          }
        }

        const loadedProfile = {
          ...result.data,
          clerk_id: undefined,
          badges: undefined
        };
        const loadedCSS = result.data.profile_card_css || '';

        // Set both current and original state
        setProfile(loadedProfile);
        setBadges(parsedBadges);
        setCustomCSS(loadedCSS);
        
        // Set original state for change detection
        setOriginalProfile(loadedProfile);
        setOriginalBadges(parsedBadges);
        setOriginalCustomCSS(loadedCSS);
        
        setError(null);
      } else {
        console.log('ProfileCustomizer: No profile found, using defaults');
        const defaultProfileWithClerk = { 
          ...DEFAULT_PROFILE, 
          username: '',
          display_name: '',
          avatar_url: ''
        };
        
        setProfile(defaultProfileWithClerk);
        setBadges([]);
        setCustomCSS('');
        
        setOriginalProfile(defaultProfileWithClerk);
        setOriginalBadges([]);
        setOriginalCustomCSS('');
        
        setError(null);
      }

      await updateProgressWithDelay(100, 400);
      
      setTimeout(() => {
        if (mountedRef.current) {
          setLoading(false);
          setLoadingProgress(0);
        }
      }, 600);

    } catch (error: unknown) {
      console.error('ProfileCustomizer: Load error:', error);
      const errorMessage = getErrorMessage(error);
      
      if (mountedRef.current) {
        setError(errorMessage || 'Failed to load profile');
        
        const defaultProfileWithClerk = { ...DEFAULT_PROFILE };
        setProfile(defaultProfileWithClerk);
        setBadges([]);
        setCustomCSS('');
        
        setOriginalProfile(defaultProfileWithClerk);
        setOriginalBadges([]);
        setOriginalCustomCSS('');
        
        setLoading(false);
        setLoadingProgress(0);
      }
    }
  }, [updateProgressWithDelay]);

  // Enhanced save profile with better error handling
  const saveProfile = useCallback(async (clerkUserId: string) => {
    if (!clerkUserId || !mountedRef.current) {
      throw new Error('Clerk User ID is required');
    }

    setSaving(true);
    setError(null);
    
    try {
      console.log('ProfileCustomizer: Saving profile for Clerk user:', clerkUserId);
      
      // Client-side validation
      if (!profile.username?.trim()) {
        throw new Error('Username is required');
      }

      if (profile.username.trim().length < 3) {
        throw new Error('Username must be at least 3 characters');
      }

      if (profile.username.trim().length > 20) {
        throw new Error('Username must be less than 20 characters');
      }

      if (!/^[a-zA-Z0-9_-]+$/.test(profile.username.trim())) {
        throw new Error('Username can only contain letters, numbers, underscores, and dashes');
      }

      if (profile.display_name && profile.display_name.length > 32) {
        throw new Error('Display name must be less than 32 characters');
      }

      if (profile.bio && profile.bio.length > 500) {
        throw new Error('Bio must be less than 500 characters');
      }

      if (badges.length > 10) {
        throw new Error('Maximum 10 badges allowed');
      }

      // Prepare data for API
      const profileData = {
        username: profile.username.trim(),
        display_name: profile.display_name?.trim() || null,
        avatar_url: profile.avatar_url?.trim() || null,
        banner_url: profile.banner_url?.trim() || null,
        pronouns: profile.pronouns?.trim() || null,
        bio: profile.bio?.trim() || null,
        status: profile.status || 'online',
        display_name_color: profile.display_name_color || '#000000',
        display_name_animation: profile.display_name_animation || 'none',
        rainbow_speed: Math.max(1, Math.min(10, profile.rainbow_speed || 3)),
        profile_card_css: customCSS.trim() || null,
        badges: badges.length > 0 ? JSON.stringify(badges) : null,
      };

      console.log('ProfileCustomizer: Sending to API:', profileData);

      // Enhanced fetch with better error handling
      let response: Response;
      try {
        response = await fetch('/api/profile/save', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(profileData)
        });
        
        console.log('ProfileCustomizer: Response status:', response.status);
        console.log('ProfileCustomizer: Response headers:', Object.fromEntries(response.headers.entries()));
        
      } catch (fetchError: unknown) {
        console.error('ProfileCustomizer: Fetch error details:', fetchError);
        
        const errorMessage = getErrorMessage(fetchError);
        
        // Check if it's a network error
        if (isTypeError(fetchError) && errorMessage === 'fetch failed') {
          throw new Error('Network error: Unable to connect to server. Please check your internet connection and try again.');
        }
        
        // Check if it's a CORS error
        if (errorMessage.includes('CORS')) {
          throw new Error('CORS error: Cross-origin request blocked. Please check your server configuration.');
        }
        
        throw new Error(`Network request failed: ${errorMessage}`);
      }

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server error: ${response.status} ${response.statusText}`);
          } catch (jsonError: unknown) {
            console.error('ProfileCustomizer: Failed to parse error response as JSON:', jsonError);
            throw new Error(`Server error: ${response.status} ${response.statusText}`);
          }
        } else {
          // Non-JSON response
          const errorText = await response.text();
          console.error('ProfileCustomizer: Non-JSON error response:', errorText);
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
      }

      let result: any;
      try {
        result = await response.json();
        console.log('ProfileCustomizer: Save response:', result);
      } catch (jsonError: unknown) {
        console.error('ProfileCustomizer: Failed to parse success response as JSON:', jsonError);
        throw new Error('Server returned invalid response format');
      }

      if (!result.success) {
        throw new Error(result.error || 'Save operation failed');
      }

      console.log('ProfileCustomizer: Profile saved successfully');
      
      // Update original state after successful save
      setOriginalProfile(profile);
      setOriginalBadges([...badges]);
      setOriginalCustomCSS(customCSS);
      
      setError(null);
      
    } catch (error: unknown) {
      console.error('ProfileCustomizer: Save exception:', error);
      const errorMessage = getErrorMessage(error);
      
      if (mountedRef.current) {
        setError(errorMessage || 'Failed to save profile');
      }
      throw new Error(errorMessage);
    } finally {
      if (mountedRef.current) {
        setSaving(false);
      }
    }
  }, [profile, badges, customCSS]);

  const resetToDefaults = useCallback(() => {
    setProfile(DEFAULT_PROFILE);
    setBadges([]);
    setCustomCSS('');
    setOriginalProfile(DEFAULT_PROFILE);
    setOriginalBadges([]);
    setOriginalCustomCSS('');
    setError(null);
    setLoadingProgress(0);
  }, []);

  // Discard changes function
  const discardChanges = useCallback(() => {
    setProfile(originalProfile);
    setBadges([...originalBadges]);
    setCustomCSS(originalCustomCSS);
  }, [originalProfile, originalBadges, originalCustomCSS]);

  return {
    profile,
    setProfile,
    badges,
    setBadges,
    customCSS,
    setCustomCSS,
    saving,
    loading,
    error,
    loadingProgress,
    hasChanges,
    saveProfile,
    loadProfile,
    resetToDefaults,
    discardChanges
  };
};