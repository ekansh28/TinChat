// src/components/ProfileCustomizer/index.tsx - COMPLETE VERSION
'use client';
import './ProfileCustomizer.css';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button-themed';
import { supabase } from '@/lib/supabase';
import { useUser } from '@clerk/nextjs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { CustomizerPanel } from './components/CustomizerPanel';
import type { UserProfile, Badge } from './types';
import ProfileCardPreview from './components/ProfileCardPreview';

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

// Default avatar helper function
function getDefaultAvatar() {
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjNTg2NUY0Ii8+CjxjaXJjbGUgY3g9IjQwIiBjeT0iMzAiIHI9IjE0IiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMjAgNjBDMjAgNTIuMjY4IDI2LjI2OCA0NiAzNCA0NkM0MS43MzIgNDYgNDggNTIuMjY4IDQ4IDYwVjgwSDIwVjYwWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+';
}

// 98.css themed loading spinner
const LoadingSpinner98: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className={cn("animate-spin border-2 border-gray-600 border-t-transparent", sizeClasses[size])} 
         style={{ borderStyle: 'inset' }} />
  );
};

// 98.css styled loading state
const LoadingState98: React.FC<{ 
  message: string; 
  progress?: number; 
  onCancel?: () => void;
}> = ({ message, progress, onCancel }) => (
  <div className="window-body">
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <LoadingSpinner98 size="lg" />
      <div className="text-center space-y-2">
        <h3 className="text-lg font-bold flex items-center gap-2">
          Loading Profile
        </h3>
        <p className="text-gray-700">{message}</p>
        {progress !== undefined && (
          <div className="w-64">
            <div className="sunken border-2 border-gray-400 h-4 bg-gray-200">
              <div 
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
      {onCancel && (
        <button className="btn" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  </div>
);

// Enhanced profile hook with change detection and Clerk integration
const useProfileCustomizer = () => {
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

  // Check if any changes have been made
  const hasChanges = useMemo(() => {
    const profileChanged = !isEqual(profile, originalProfile);
    const badgesChanged = !isEqual(badges, originalBadges);
    const cssChanged = customCSS.trim() !== originalCustomCSS.trim();
    
    console.log('Change detection:', {
      profileChanged,
      badgesChanged,
      cssChanged,
      overall: profileChanged || badgesChanged || cssChanged
    });
    
    return profileChanged || badgesChanged || cssChanged;
  }, [profile, originalProfile, badges, originalBadges, customCSS, originalCustomCSS]);

  // Load profile using clerk_id instead of Supabase user.id
  const loadProfile = useCallback(async (clerkUserId: string) => {
    if (!clerkUserId || !mountedRef.current) {
      console.warn('No Clerk user ID provided to loadProfile or component unmounted');
      return;
    }

    const startTime = Date.now();
    setLoading(true);
    setError(null);
    setLoadingProgress(10);

    try {
      console.log(`ProfileCustomizer: Loading profile for Clerk user ${clerkUserId}`);
      
      // Query by clerk_id instead of id
      const { data: profileData, error: fetchError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('clerk_id', clerkUserId)
        .single();

      if (!mountedRef.current) {
        console.log('ProfileCustomizer: Component unmounted during fetch');
        return;
      }

      setLoadingProgress(60);

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('ProfileCustomizer: Fetch error:', fetchError);
        throw new Error(fetchError.message || 'Failed to load profile');
      }

      setLoadingProgress(90);

      if (profileData) {
        console.log(`ProfileCustomizer: Profile loaded:`, profileData);
        
        let parsedBadges: Badge[] = [];
        if (profileData.badges) {
          try {
            parsedBadges = Array.isArray(profileData.badges) 
              ? profileData.badges 
              : JSON.parse(profileData.badges);
            parsedBadges = parsedBadges.filter(badge => 
              badge && typeof badge === 'object' && badge.id && badge.url
            );
          } catch (e) {
            console.warn('Failed to parse badges, using empty array:', e);
            parsedBadges = [];
          }
        }

        const loadedProfile = {
          ...profileData,
          clerk_id: undefined,
          badges: undefined
        };
        const loadedCSS = profileData.profile_card_css || '';

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

      setLoadingProgress(100);
    } catch (error: any) {
      console.error('ProfileCustomizer: Load error:', error);
      if (mountedRef.current) {
        setError(error.message || 'Failed to load profile');
        
        const defaultProfileWithClerk = { ...DEFAULT_PROFILE };
        setProfile(defaultProfileWithClerk);
        setBadges([]);
        setCustomCSS('');
        
        setOriginalProfile(defaultProfileWithClerk);
        setOriginalBadges([]);
        setOriginalCustomCSS('');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setLoadingProgress(0);
      }
    }
  }, []);

  // Save profile using clerk_id and proper ID handling
  const saveProfile = useCallback(async (clerkUserId: string) => {
    if (!clerkUserId || !mountedRef.current) {
      throw new Error('Clerk User ID is required');
    }

    setSaving(true);
    setError(null);
    
    try {
      console.log('ProfileCustomizer: Saving profile for Clerk user:', clerkUserId);
      
      // Enhanced validation
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

      // First, check if profile exists to get the internal ID
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('clerk_id', clerkUserId)
        .single();

      const profileData = {
        // Only include id if updating existing profile
        ...(existingProfile ? { id: existingProfile.id } : {}),
        clerk_id: clerkUserId,
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
        profile_complete: true,
        updated_at: new Date().toISOString()
      };

      console.log('ProfileCustomizer: Saving profile data:', profileData);

      // Use upsert with clerk_id conflict resolution
      const { error } = await supabase
        .from('user_profiles')
        .upsert(profileData, {
          onConflict: 'clerk_id'
        });

      if (error) {
        console.error('ProfileCustomizer: Save error:', error);
        throw new Error(error.message || 'Failed to save profile');
      }

      console.log('ProfileCustomizer: Profile saved successfully');
      
      // Update original state after successful save
      setOriginalProfile(profile);
      setOriginalBadges([...badges]);
      setOriginalCustomCSS(customCSS);
      
      setError(null);
    } catch (error: any) {
      console.error('ProfileCustomizer: Save exception:', error);
      if (mountedRef.current) {
        setError(error.message || 'Failed to save profile');
      }
      throw error;
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

export interface ProfileCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileCustomizer({ isOpen, onClose }: ProfileCustomizerProps) {
  // Use Clerk's useUser hook instead of Supabase auth
  const { user, isLoaded, isSignedIn } = useUser();
  const { toast } = useToast();
  
  const {
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
  } = useProfileCustomizer();

  // Handle avatar upload
  const handleAvatarUpload = useCallback(async (file: File) => {
    try {
      const validation = await validateImageFile(file);
      
      if (!validation.valid) {
        toast({
          title: "Invalid File",
          description: validation.error,
          variant: "destructive"
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setProfile(prev => ({ ...prev, avatar_url: dataUrl }));
        toast({
          title: "Avatar Uploaded",
          description: "Profile picture updated successfully",
          variant: "default"
        });
      };
      reader.onerror = () => {
        toast({
          title: "Upload Error",
          description: "Failed to read the image file",
          variant: "destructive"
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast({
        title: "Upload Error",
        description: "Failed to process the uploaded file",
        variant: "destructive"
      });
    }
  }, [setProfile, toast]);

  // Handle banner upload
  const handleBannerUpload = useCallback(async (file: File) => {
    try {
      const validation = await validateImageFile(file);
      
      if (!validation.valid) {
        toast({
          title: "Invalid File",
          description: validation.error,
          variant: "destructive"
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setProfile(prev => ({ ...prev, banner_url: dataUrl }));
        toast({
          title: "Banner Uploaded",
          description: "Banner image updated successfully",
          variant: "default"
        });
      };
      reader.onerror = () => {
        toast({
          title: "Upload Error",
          description: "Failed to read the image file",
          variant: "destructive"
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Banner upload error:', error);
      toast({
        title: "Upload Error",
        description: "Failed to process the uploaded file",
        variant: "destructive"
      });
    }
  }, [setProfile, toast]);

  // Enhanced image validation
  const validateImageFile = (file: File): Promise<{valid: boolean, error?: string}> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        resolve({ valid: false, error: 'File must be an image' });
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        resolve({ valid: false, error: 'File size must be under 10MB' });
        return;
      }

      const img = new Image();
      const url = URL.createObjectURL(file);
      
      const cleanup = () => URL.revokeObjectURL(url);
      
      const timeout = setTimeout(() => {
        cleanup();
        resolve({ valid: false, error: 'Image validation timeout' });
      }, 5000);
      
      img.onload = () => {
        clearTimeout(timeout);
        cleanup();
        
        if (img.width < 32 || img.height < 32) {
          resolve({ valid: false, error: 'Image must be at least 32x32 pixels' });
          return;
        }
        
        if (img.width > 4096 || img.height > 4096) {
          resolve({ valid: false, error: 'Image must be smaller than 4096x4096 pixels' });
          return;
        }
        
        resolve({ valid: true });
      };
      
      img.onerror = () => {
        clearTimeout(timeout);
        cleanup();
        resolve({ valid: false, error: 'Invalid or corrupted image file' });
      };
      
      img.src = url;
    });
  };

  // Load profile when component opens with Clerk user ID
  useEffect(() => {
    if (isOpen && user?.id && isLoaded && isSignedIn) {
      console.log('ProfileCustomizer: Loading profile for Clerk user:', user.id);
      
      // Pre-populate with Clerk user data
      setProfile(prev => ({
        ...prev,
        username: prev.username || user.username || '',
        display_name: prev.display_name || user.firstName || user.username || '',
        avatar_url: prev.avatar_url || user.imageUrl || '',
      }));
      
      loadProfile(user.id);
    }
  }, [isOpen, user?.id, isLoaded, isSignedIn, loadProfile, setProfile]);

  // Warn user about unsaved changes when closing
  const handleClose = useCallback(() => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close without saving?')) {
        onClose();
      }
    } else {
      onClose();
    }
  }, [hasChanges, onClose]);

  // Handle save with better error reporting
  const handleSave = useCallback(async () => {
    if (!user?.id) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to save your profile",
        variant: "destructive"
      });
      return;
    }

    try {
      await saveProfile(user.id);
      toast({
        title: "Profile Saved! ⚡",
        description: "Your profile has been updated successfully!",
        variant: "default"
      });
    } catch (error: any) {
      console.error('Save error:', error);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save your profile. Please try again.",
        variant: "destructive"
      });
    }
  }, [user?.id, saveProfile, toast]);

  const handleReset = useCallback(() => {
    resetToDefaults();
    toast({
      title: "Profile Reset",
      description: "Profile has been reset to default settings",
      variant: "default"
    });
  }, [resetToDefaults, toast]);

  // Handle discard changes
  const handleDiscardChanges = useCallback(() => {
    if (window.confirm('Are you sure you want to discard all your changes?')) {
      discardChanges();
      toast({
        title: "Changes Discarded",
        description: "All changes have been reverted to the last saved state",
        variant: "default"
      });
    }
  }, [discardChanges, toast]);

  const handleRetry = useCallback(() => {
    if (user?.id) {
      loadProfile(user.id);
    }
  }, [user?.id, loadProfile]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="window" style={{ width: '90vw', maxWidth: '1200px', height: '90vh', maxHeight: '800px' }}>
        {/* Title Bar */}
        <div className="title-bar">
          <div className="title-bar-text">
            Customize Your Profile ⚡
            {hasChanges && <span className="text-xs text-red-600"> - Unsaved Changes</span>}
          </div>
          <div className="title-bar-controls">
            <button aria-label="Close" onClick={handleClose}></button>
          </div>
        </div>

        {/* Window Body */}
        <div className="window-body" style={{ height: 'calc(100% - 33px)', overflow: 'hidden' }}>
          {/* Show loading state while Clerk is loading */}
          {!isLoaded && (
            <LoadingState98 
              message="Loading authentication..."
              progress={50}
            />
          )}

          {/* Show auth required state */}
          {isLoaded && !isSignedIn && (
            <div className="window-body">
              <div className="flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="w-16 h-16 sunken border-2 border-gray-400 bg-blue-100 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🔐</span>
                  </div>
                  <h3 className="text-lg font-bold mb-2">Authentication Required</h3>
                  <p className="text-gray-700 mb-4">Please sign in to customize your profile</p>
                  <button className="btn" onClick={handleClose}>Close</button>
                </div>
              </div>
            </div>
          )}

          {/* Show loading state during profile fetch */}
          {isLoaded && isSignedIn && user && loading && (
            <LoadingState98 
              message="Fetching your profile data..."
              progress={loadingProgress}
            />
          )}

          {/* Show error state */}
          {isLoaded && isSignedIn && user && !loading && error && (
            <div className="window-body">
              <div className="flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="w-16 h-16 sunken border-2 border-gray-400 bg-red-100 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">⚠️</span>
                  </div>
                  <h3 className="text-lg font-bold text-red-700 mb-2">Failed to Load Profile</h3>
                  <p className="text-gray-700 mb-4">{error}</p>
                  <div className="flex gap-2 justify-center">
                    <button className="btn" onClick={handleRetry}>🔄 Try Again</button>
                    <button className="btn" onClick={handleClose}>Close</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          {isLoaded && isSignedIn && user && !loading && !error && (
            <div className="flex h-full">
              {/* Left Panel - Customization Controls */}
              <div className="flex-1 p-4 overflow-y-auto border-r border-gray-400" style={{ 
                borderStyle: 'inset',
                width: '60%',
                maxWidth: '60%'
              }}>
                {/* Welcome message for new users */}
                {!profile.profile_complete && (
                  <div className="mb-4 p-3 field-row sunken border border-gray-400 bg-green-50">
                    <div className="flex items-center gap-2">
                      <span className="text-green-700">🎉</span>
                      <span className="text-green-800 text-sm font-bold">
                        Welcome {user.firstName || user.username}! Let's set up your profile.
                      </span>
                    </div>
                  </div>
                )}

                {/* Changes indicator */}
                {hasChanges && (
                  <div className="mb-4 p-3 field-row sunken border border-gray-400 bg-yellow-50">
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-700">⚠️</span>
                      <span className="text-yellow-800 text-sm font-bold">
                        You have unsaved changes
                      </span>
                    </div>
                  </div>
                )}

                {/* Show saving overlay */}
                {saving && (
                  <div className="mb-4 p-4 field-row sunken border border-gray-400 bg-blue-50">
                    <div className="flex items-center">
                      <LoadingSpinner98 size="sm" />
                      <span className="text-blue-800 ml-3 font-bold">Saving your profile...</span>
                    </div>
                  </div>
                )}

                <CustomizerPanel
                  profile={profile}
                  setProfile={setProfile}
                  badges={badges}
                  setBadges={setBadges}
                  customCSS={customCSS}
                  setCustomCSS={setCustomCSS}
                  saving={saving}
                  loading={loading}
                />
              </div>

              {/* Right Panel - Live Preview */}
              <div className="w-80 p-4 overflow-y-auto bg-gray-100" style={{ width: '40%' }}>
                <div className="window">
                  <div className="title-bar">
                    <div className="title-bar-text">
                      Live Preview
                    </div>
                  </div>
                  <div className="window-body">
                    <div className="space-y-4">
                      {/* Profile Card Preview with upload hover */}
                      <div className="field-row">
                        <ProfileCardPreview
                          profile={profile}
                          badges={badges}
                          customCSS={customCSS}
                          isPreview={true}
                          onAvatarUpload={handleAvatarUpload}
                          onBannerUpload={handleBannerUpload}
                        />
                      </div>
                      
                      {/* Chat Preview */}
                      <div className="field-row">
                        <label className="font-bold text-sm mb-2 block">Chat Preview:</label>
                        <div className="sunken border border-gray-400 p-2 bg-white">
                          <div className="flex items-start gap-2">
                            <img
                              src={profile.avatar_url || getDefaultAvatar()}
                              alt="Avatar"
                              className="w-6 h-6 border border-gray-400"
                              style={{ imageRendering: 'pixelated' }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = getDefaultAvatar();
                              }}
                            />
                            <div>
                              <div 
                                className="text-sm font-bold cursor-pointer hover:underline"
                                style={{ 
                                  color: profile.display_name_color || '#000000',
                                  animation: profile.display_name_animation === 'rainbow' ? 
                                    `rainbow ${profile.rainbow_speed || 3}s infinite` : 'none'
                                }}
                                onClick={(e) => {
                                  // Show profile popup preview
                                  e.preventDefault();
                                  alert(`In the actual chat, clicking "${profile.display_name || profile.username || 'Unknown User'}" would show your profile popup with all your customizations, badges, and CSS styling - just like Discord!`);
                                }}
                                title="Click to preview profile popup"
                              >
                                {profile.display_name || profile.username || 'Unknown User'}
                              </div>
                              <div className="text-sm text-gray-700">
                                Hello! This is how your name appears in chat. Click it to see the profile popup!
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Profile popup preview note */}
                      <div className="field-row">
                        <div className="sunken border border-gray-400 p-2 bg-blue-50">
                          <div className="text-xs text-blue-800">
                            <div className="font-bold mb-1">💡 Profile Popup Feature:</div>
                            <div>When others click your username in chat, they'll see a popup with:</div>
                            <ul className="mt-1 ml-3 list-disc">
                              <li>Your profile card with custom styling</li>
                              <li>All your badges</li>
                              <li>Bio and status</li>
                              <li>Custom CSS effects</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* User info display */}
                      <div className="field-row">
                        <div className="sunken border border-gray-400 p-2 bg-gray-50">
                          <div className="text-xs text-gray-600">
                            <div className="font-bold mb-1">👤 Account Info:</div>
                            <div>Clerk ID: {user.id}</div>
                            <div>Email: {user.emailAddresses?.[0]?.emailAddress}</div>
                            <div>Joined: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer Controls with change detection */}
          {isLoaded && isSignedIn && user && !loading && !error && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gray-200 border-t border-gray-400" style={{ borderStyle: 'inset' }}>
              <div className="flex justify-between items-center">
                <div className="flex gap-2 items-center">
                  <button
                    className="btn"
                    onClick={handleReset}
                    disabled={saving || loading}
                  >
                    Reset to Defaults
                  </button>
                  
                  {/* Discard changes button (only show when there are changes) */}
                  {hasChanges && (
                    <button
                      className="btn"
                      onClick={handleDiscardChanges}
                      disabled={saving || loading}
                      style={{ color: '#d97706' }}
                    >
                      Discard Changes
                    </button>
                  )}
                  
                  {error && (
                    <button
                      className="btn"
                      onClick={handleRetry}
                      disabled={loading}
                    >
                      🔄 Reload Profile
                    </button>
                  )}
                </div>
                
                <div className="flex gap-2 items-center">
                  {saving && (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <LoadingSpinner98 size="sm" />
                      Saving...
                    </div>
                  )}
                  
                  {/* Changes indicator in footer */}
                  {hasChanges && !saving && (
                    <div className="flex items-center gap-1 text-sm text-yellow-700 bg-yellow-100 px-2 py-1 border border-yellow-400">
                      <span>⚠️</span>
                      <span>Unsaved changes</span>
                    </div>
                  )}
                  
                  <button
                    className="btn"
                    onClick={handleClose}
                    disabled={saving}
                  >
                    {hasChanges ? 'Cancel' : 'Close'}
                  </button>
                  
                  {/* Save button only visible when there are changes */}
                  {hasChanges && (
                    <button
                      className="btn"
                      onClick={handleSave}
                      disabled={saving || loading || !profile.username?.trim()}
                      style={{ fontWeight: 'bold', backgroundColor: hasChanges ? '#4ade80' : undefined }}
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CSS for rainbow animation and new styles */}
      <style jsx>{`
        @keyframes rainbow {
          0% { color: #ff0000; }
          16.66% { color: #ff8000; }
          33.33% { color: #ffff00; }
          50% { color: #00ff00; }
          66.66% { color: #0080ff; }
          83.33% { color: #8000ff; }
          100% { color: #ff0000; }
        }
        
        /* 98.css enhancements */
        .btn:disabled {
          color: #808080;
          background: #c0c0c0;
          border-color: #808080;
        }
        
        .field-row {
          margin-bottom: 8px;
        }
        
        .sunken {
          border-style: inset;
        }
        
        .window-body {
          position: relative;
        }

        /* Highlight unsaved changes */
        .unsaved-changes {
          box-shadow: 0 0 0 2px #fbbf24;
          animation: pulse-warning 2s infinite;
        }

        @keyframes pulse-warning {
          0%, 100% { box-shadow: 0 0 0 2px #fbbf24; }
          50% { box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.5); }
        }

        /* Custom scrollbar styles */
        .overflow-y-auto::-webkit-scrollbar {
          width: 16px;
        }

        .overflow-y-auto::-webkit-scrollbar-track {
          background: #c0c0c0;
          border: 1px inset #c0c0c0;
        }

        .overflow-y-auto::-webkit-scrollbar-thumb {
          background: #808080;
          border: 1px outset #808080;
        }

        .overflow-y-auto::-webkit-scrollbar-thumb:hover {
          background: #606060;
        }

        /* Space utility classes */
        .space-y-4 > * + * {
          margin-top: 16px;
        }

        /* Text utility classes */
        .text-xs {
          font-size: 10px;
        }

        .text-sm {
          font-size: 11px;
        }

        .text-lg {
          font-size: 14px;
        }

        .font-bold {
          font-weight: bold;
        }

        /* Color utility classes */
        .text-gray-600 {
          color: #666;
        }

        .text-gray-700 {
          color: #555;
        }

        .text-red-600 {
          color: #dc2626;
        }

        .text-red-700 {
          color: #b91c1c;
        }

        .text-green-700 {
          color: #15803d;
        }

        .text-green-800 {
          color: #166534;
        }

        .text-yellow-700 {
          color: #a16207;
        }

        .text-yellow-800 {
          color: #92400e;
        }

        .text-blue-800 {
          color: #1e40af;
        }

        /* Background utility classes */
        .bg-gray-50 {
          background-color: #f9fafb;
        }

        .bg-gray-100 {
          background-color: #f3f4f6;
        }

        .bg-gray-200 {
          background-color: #e5e7eb;
        }

        .bg-red-100 {
          background-color: #fee2e2;
        }

        .bg-green-50 {
          background-color: #f0fdf4;
        }

        .bg-yellow-50 {
          background-color: #fefce8;
        }

        .bg-yellow-100 {
          background-color: #fef3c7;
        }

        .bg-blue-50 {
          background-color: #eff6ff;
        }

        .bg-blue-100 {
          background-color: #dbeafe;
        }

        /* Border utility classes */
        .border {
          border-width: 1px;
        }

        .border-2 {
          border-width: 2px;
        }

        .border-t {
          border-top-width: 1px;
        }

        .border-r {
          border-right-width: 1px;
        }

        .border-gray-400 {
          border-color: #9ca3af;
        }

        .border-yellow-400 {
          border-color: #fbbf24;
        }

        /* Flexbox utility classes */
        .flex {
          display: flex;
        }

        .items-center {
          align-items: center;
        }

        .items-start {
          align-items: flex-start;
        }

        .justify-center {
          justify-content: center;
        }

        .justify-between {
          justify-content: space-between;
        }

        .gap-1 {
          gap: 4px;
        }

        .gap-2 {
          gap: 8px;
        }

        .gap-4 {
          gap: 16px;
        }

        /* Sizing utility classes */
        .w-6 {
          width: 24px;
        }

        .h-6 {
          height: 24px;
        }

        .w-16 {
          width: 64px;
        }

        .h-16 {
          height: 64px;
        }

        .w-80 {
          width: 320px;
        }

        /* Spacing utility classes */
        .p-2 {
          padding: 8px;
        }

        .p-3 {
          padding: 12px;
        }

        .p-4 {
          padding: 16px;
        }

        .p-8 {
          padding: 32px;
        }

        .px-2 {
          padding-left: 8px;
          padding-right: 8px;
        }

        .py-1 {
          padding-top: 4px;
          padding-bottom: 4px;
        }

        .mb-1 {
          margin-bottom: 4px;
        }

        .mb-2 {
          margin-bottom: 8px;
        }

        .mb-4 {
          margin-bottom: 16px;
        }

        .ml-3 {
          margin-left: 12px;
        }

        .mt-1 {
          margin-top: 4px;
        }

        .mx-auto {
          margin-left: auto;
          margin-right: auto;
        }

        /* Position utility classes */
        .absolute {
          position: absolute;
        }

        .relative {
          position: relative;
        }

        .fixed {
          position: fixed;
        }

        .inset-0 {
          inset: 0;
        }

        .bottom-0 {
          bottom: 0;
        }

        .left-0 {
          left: 0;
        }

        .right-0 {
          right: 0;
        }

        /* Z-index utility classes */
        .z-50 {
          z-index: 50;
        }

        /* Text alignment utility classes */
        .text-center {
          text-align: center;
        }

        /* Display utility classes */
        .block {
          display: block;
        }

        /* List utility classes */
        .list-disc {
          list-style-type: disc;
        }

        /* Misc utility classes */
        .cursor-pointer {
          cursor: pointer;
        }

        .hover\\:underline:hover {
          text-decoration: underline;
        }

        .overflow-hidden {
          overflow: hidden;
        }

        .overflow-y-auto {
          overflow-y: auto;
        }

        .flex-1 {
          flex: 1 1 0%;
        }

        .flex-col {
          flex-direction: column;
        }

        /* Animation utility classes */
        .animate-spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .transition-all {
          transition-property: all;
          transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          transition-duration: 150ms;
        }

        .duration-300 {
          transition-duration: 300ms;
        }
      `}</style>
    </div>
  );
}