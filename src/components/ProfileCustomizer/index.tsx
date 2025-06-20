// ===============================================================================
// src/components/ProfileCustomizer/index.tsx - WITH FAST PROFILE FETCHING
// ===============================================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button-themed';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { CustomizerPanel } from './components/CustomizerPanel';
import { Modal } from './components/Modal';
import type { UserProfile, Badge } from './types';
import ProfileCardPreview from './components/ProfileCardPreview';
import { fastProfileFetcher, profileCache } from '@/lib/fastProfileFetcher';

// Default avatar helper function
function getDefaultAvatar() {
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjNTg2NUY0Ii8+CjxjaXJjbGUgY3g9IjQwIiBjeT0iMzAiIHI9IjE0IiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMjAgNjBDMjAgNTIuMjY4IDI2LjI2OCA0NiAzNCA0NkM0MS43MzIgNDYgNDggNTIuMjY4IDQ4IDYwVjgwSDIwVjYwWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+';
}

// Loading spinner component
const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className={cn("animate-spin rounded-full border-2 border-blue-600 border-t-transparent", sizeClasses[size])} />
  );
};

// Enhanced loading state component
const LoadingState: React.FC<{ 
  message: string; 
  progress?: number; 
  isFromCache?: boolean;
  onCancel?: () => void;
}> = ({ message, progress, isFromCache, onCancel }) => (
  <div className="flex flex-col items-center justify-center p-8 space-y-4">
    <LoadingSpinner size="lg" />
    <div className="text-center space-y-2">
      <h3 className="text-lg font-medium flex items-center gap-2">
        Loading Profile
        {isFromCache && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">⚡ Fast</span>}
      </h3>
      <p className="text-gray-600 dark:text-gray-400">{message}</p>
      {progress !== undefined && (
        <div className="w-64 bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
    {onCancel && (
      <Button variant="outline" onClick={onCancel} size="sm">
        Cancel
      </Button>
    )}
  </div>
);

// Enhanced error state component
const ErrorState: React.FC<{
  error: string;
  onRetry: () => void;
  onClose: () => void;
  canRetry: boolean;
}> = ({ error, onRetry, onClose, canRetry }) => (
  <div className="flex flex-col items-center justify-center p-8 space-y-4">
    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
      <span className="text-2xl">⚠️</span>
    </div>
    <div className="text-center space-y-2">
      <h3 className="text-lg font-medium text-red-700 dark:text-red-300">
        Failed to Load Profile
      </h3>
      <p className="text-gray-600 dark:text-gray-400 max-w-md">
        {error}
      </p>
    </div>
    <div className="flex gap-3">
      {canRetry && (
        <Button 
          onClick={onRetry} 
          className="flex items-center gap-2"
        >
          🔄 Try Again
        </Button>
      )}
      <Button variant="outline" onClick={onClose}>
        Close
      </Button>
    </div>
  </div>
);

// Enhanced auth hook
const useAuth = () => {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const getUser = async () => {
      try {
        setLoading(true);
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Auth session error:', error);
          setError(error.message);
        } else {
          setUser(session?.user || null);
          setError(null);
        }
      } catch (error: any) {
        console.error('Auth session exception:', error);
        setError(error.message || 'Authentication error');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    
    getUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, !!session);
      setUser(session?.user || null);
      setError(null);
      setLoading(false);
    });
    
    return () => subscription.unsubscribe();
  }, []);
  
  return { user, loading, error };
};

// Enhanced profile hook with fast fetching
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
  const [isFromCache, setIsFromCache] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Fast profile loading with cache
  const loadProfile = useCallback(async (userId: string, forceRefresh: boolean = false) => {
    if (!userId) {
      console.warn('No user ID provided to loadProfile');
      setError('No user ID provided');
      return;
    }

    const startTime = Date.now();
    setLoading(true);
    setError(null);
    setLoadingProgress(0);

    try {
      console.log(`ProfileCustomizer: Fast loading profile for ${userId}${forceRefresh ? ' (force refresh)' : ''}`);
      
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
          const next = prev + 15;
          return next >= 90 ? 90 : next;
        });
      }, 100);

      const profileData = await fastProfileFetcher.fetchFullProfile(userId, forceRefresh);

      clearInterval(progressInterval);
      setLoadingProgress(100);

      const fetchTime = Date.now() - startTime;
      setIsFromCache(fetchTime < 200); // Likely from cache if very fast

      if (profileData) {
        console.log(`ProfileCustomizer: Profile loaded in ${fetchTime}ms:`, profileData);
        
        // Parse badges safely
        let parsedBadges: Badge[] = [];
        if (profileData.badges) {
          try {
            parsedBadges = Array.isArray(profileData.badges) ? profileData.badges : [];
            // Filter out invalid badges
            parsedBadges = parsedBadges.filter(badge => 
              badge && typeof badge === 'object' && badge.id && badge.url
            );
          } catch (e) {
            console.warn('Failed to parse badges, using empty array:', e);
            parsedBadges = [];
          }
        }

        setProfile({
          ...profileData,
          badges: undefined // Remove badges from profile object
        });
        setBadges(parsedBadges);
        setCustomCSS(profileData.profile_card_css || '');
        setError(null);
      } else {
        console.log('ProfileCustomizer: No profile data returned, using defaults');
        setProfile({ ...DEFAULT_PROFILE, id: userId });
        setBadges([]);
        setCustomCSS('');
        setError(null);
      }
    } catch (error: any) {
      console.error('ProfileCustomizer: Load error:', error);
      setError(error.message || 'Failed to load profile');
      
      // Set defaults even on error so the form is usable
      setProfile({ ...DEFAULT_PROFILE, id: userId });
      setBadges([]);
      setCustomCSS('');
    } finally {
      setLoading(false);
      setLoadingProgress(0);
    }
  }, []);

  // Retry with cache invalidation
  const retryLoadProfile = useCallback((userId: string) => {
    // Invalidate cache for this user
    profileCache.invalidate(userId);
    loadProfile(userId, true);
  }, [loadProfile]);

  // Enhanced save with optimistic updates
  const saveProfile = useCallback(async (userId: string) => {
    if (!userId) {
      throw new Error('User ID is required');
    }

    setSaving(true);
    setError(null);
    
    try {
      console.log('ProfileCustomizer: Saving profile for user:', userId);
      
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
        rainbow_speed: Math.max(1, Math.min(10, profile.rainbow_speed || 3)),
        profile_card_css: customCSS.trim() || null,
        badges: badges.length > 0 ? JSON.stringify(badges) : null,
        profile_complete: true,
        updated_at: new Date().toISOString()
      };

      console.log('ProfileCustomizer: Saving profile data:', profileData);

      const { error } = await supabase
        .from('user_profiles')
        .upsert(profileData, {
          onConflict: 'id'
        });

      if (error) {
        console.error('ProfileCustomizer: Save error:', error);
        throw new Error(error.message || 'Failed to save profile');
      }

      console.log('ProfileCustomizer: Profile saved successfully');
      
      // Update cache with new data
      profileCache.set(userId, { ...profileData, badges });
      
      setError(null);
    } catch (error: any) {
      console.error('ProfileCustomizer: Save exception:', error);
      setError(error.message || 'Failed to save profile');
      throw error;
    } finally {
      setSaving(false);
    }
  }, [profile, badges, customCSS]);

  const resetToDefaults = useCallback(() => {
    setProfile(DEFAULT_PROFILE);
    setBadges([]);
    setCustomCSS('');
    setError(null);
    setLoadingProgress(0);
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
    error,
    isFromCache,
    loadingProgress,
    saveProfile,
    loadProfile,
    retryLoadProfile,
    resetToDefaults
  };
};

export interface ProfileCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileCustomizer({ isOpen, onClose }: ProfileCustomizerProps) {
  const { user, loading: authLoading, error: authError } = useAuth();
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
    isFromCache,
    loadingProgress,
    saveProfile,
    loadProfile,
    retryLoadProfile,
    resetToDefaults
  } = useProfileCustomizer();

  // Load profile when component opens
  useEffect(() => {
    if (isOpen && user?.id && !authLoading) {
      console.log('ProfileCustomizer: Fast loading profile for user:', user.id);
      loadProfile(user.id);
    }
  }, [isOpen, user?.id, authLoading, loadProfile]);

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
        description: "Your profile has been updated successfully and cached for fast loading!",
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

  const handleRetry = useCallback(() => {
    if (user?.id) {
      retryLoadProfile(user.id);
    }
  }, [user?.id, retryLoadProfile]);

  // Show loading state while auth is loading
  if (authLoading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Profile Customizer">
        <LoadingState 
          message="Authenticating..."
          progress={50}
        />
      </Modal>
    );
  }

  // Show auth error state
  if (authError) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Profile Customizer">
        <ErrorState
          error={authError}
          onRetry={() => window.location.reload()}
          onClose={onClose}
          canRetry={true}
        />
      </Modal>
    );
  }

  // Show auth required state
  if (!user) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Profile Customizer">
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🔐</span>
            </div>
            <h3 className="text-lg font-medium mb-2">Authentication Required</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Please sign in to customize your profile</p>
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </Modal>
    );
  }

  // Show loading state during profile fetch
  if (loading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Profile Customizer">
        <LoadingState 
          message={isFromCache ? "Loading from cache..." : "Fetching your profile data..."}
          progress={loadingProgress}
          isFromCache={isFromCache}
        />
      </Modal>
    );
  }

  // Show error state
  if (error && !loading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Profile Customizer">
        <ErrorState
          error={error}
          onRetry={handleRetry}
          onClose={onClose}
          canRetry={true}
        />
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Customize Your Profile ⚡" maxWidth="6xl">
      <div className="flex flex-col lg:flex-row gap-6 h-[80vh]">
        {/* Left Panel - Customization Controls */}
        <div className="flex-1 overflow-y-auto">
          {/* Performance indicator */}
          {isFromCache && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-green-600 dark:text-green-400">⚡</span>
                <span className="text-green-700 dark:text-green-300 text-sm font-medium">
                  Profile loaded instantly from cache
                </span>
              </div>
            </div>
          )}

          {/* Show saving overlay */}
          {saving && (
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center">
                <LoadingSpinner size="sm" />
                <span className="text-blue-700 dark:text-blue-300 ml-3 font-medium">Saving your profile...</span>
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
        <div className="flex-1 lg:max-w-md">
          <div className="sticky top-0">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-medium mb-4 text-center flex items-center justify-center gap-2">
                Live Preview
                {isFromCache && <span className="text-xs">⚡</span>}
              </h3>
              <div className="space-y-4">
                {/* Profile Card Preview */}
                <ProfileCardPreview
                  profile={profile}
                  badges={badges}
                  customCSS={customCSS}
                  isPreview={true}
                />
                
                {/* Chat Preview */}
                <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                  <div className="text-sm font-medium mb-2">Chat Preview:</div>
                  <div className="flex items-start gap-2 p-2 bg-gray-50 dark:bg-gray-600 rounded">
                    <img
                      src={profile.avatar_url || getDefaultAvatar()}
                      alt="Avatar"
                      className="w-8 h-8 rounded-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = getDefaultAvatar();
                      }}
                    />
                    <div>
                      <div 
                        className="text-sm font-medium"
                        style={{ 
                          color: profile.display_name_color || '#ffffff',
                          animation: profile.display_name_animation === 'rainbow' ? 
                            `rainbow ${profile.rainbow_speed || 3}s infinite` : 'none'
                        }}
                      >
                        {profile.display_name || profile.username || 'Unknown User'}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        Hello! This is how your name appears in chat.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="flex justify-between items-center pt-4 border-t">
        <div className="flex gap-2 items-center">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={saving || loading}
          >
            Reset to Defaults
          </Button>
          {error && (
            <Button
              variant="outline"
              onClick={handleRetry}
              disabled={loading}
              className="flex items-center gap-2"
            >
              🔄 Reload Profile
            </Button>
          )}
        </div>
        
        <div className="flex gap-2 items-center">
          {saving && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <LoadingSpinner size="sm" />
              Saving...
            </div>
          )}
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || loading || !profile.username?.trim()}
            className="flex items-center gap-2"
          >
            {saving && <LoadingSpinner size="sm" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* CSS for rainbow animation */}
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
      `}</style>
    </Modal>
  );
}