// src/components/ProfileCustomizer/index.tsx - ENHANCED VERSION WITH LOADING & RETRY
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

// ✅ Loading spinner component
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

// ✅ Enhanced loading state component
const LoadingState: React.FC<{ 
  message: string; 
  progress?: number; 
  isRetrying?: boolean; 
  retryCount?: number;
  onCancel?: () => void;
}> = ({ message, progress, isRetrying, retryCount, onCancel }) => (
  <div className="flex flex-col items-center justify-center p-8 space-y-4">
    <LoadingSpinner size="lg" />
    <div className="text-center space-y-2">
      <h3 className="text-lg font-medium">
        {isRetrying ? `Retrying... (${retryCount}/3)` : 'Loading Profile'}
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
      {isRetrying && (
        <p className="text-sm text-yellow-600 dark:text-yellow-400">
          This is taking longer than usual. Please wait...
        </p>
      )}
    </div>
    {onCancel && (
      <Button variant="outline" onClick={onCancel} size="sm">
        Cancel
      </Button>
    )}
  </div>
);

// ✅ Enhanced error state component with retry options
const ErrorState: React.FC<{
  error: string;
  onRetry: () => void;
  onClose: () => void;
  retryCount: number;
  isRetrying: boolean;
  canRetry: boolean;
}> = ({ error, onRetry, onClose, retryCount, isRetrying, canRetry }) => (
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
      {retryCount > 0 && (
        <p className="text-sm text-gray-500">
          {retryCount} attempt(s) made
        </p>
      )}
    </div>
    <div className="flex gap-3">
      {canRetry && (
        <Button 
          onClick={onRetry} 
          disabled={isRetrying}
          className="flex items-center gap-2"
        >
          {isRetrying ? <LoadingSpinner size="sm" /> : '🔄'}
          {isRetrying ? 'Retrying...' : 'Try Again'}
        </Button>
      )}
      <Button variant="outline" onClick={onClose}>
        Close
      </Button>
    </div>
    {!canRetry && (
      <p className="text-xs text-gray-500 max-w-md text-center">
        Maximum retry attempts reached. Please check your internet connection and try again later.
      </p>
    )}
  </div>
);

// ✅ Enhanced auth hook with better loading states
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

// ✅ Enhanced profile hook with comprehensive retry logic
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
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s

  // ✅ Enhanced profile loading with progress tracking and retry logic
  const loadProfile = useCallback(async (userId: string, isRetry: boolean = false) => {
    if (!userId) {
      console.warn('No user ID provided to loadProfile');
      setError('No user ID provided');
      return;
    }

    // Cancel any existing request
    if (abortController) {
      abortController.abort();
    }

    const newAbortController = new AbortController();
    setAbortController(newAbortController);

    setLoading(true);
    setError(null);
    setLoadingProgress(0);
    
    if (isRetry) {
      setIsRetrying(true);
    }

    try {
      console.log(`Loading profile for user: ${userId} ${isRetry ? `(retry ${retryCount + 1}/${MAX_RETRIES})` : ''}`);
      
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
          const next = prev + 10;
          return next >= 90 ? 90 : next; // Stop at 90%, complete when done
        });
      }, 200);

      const { data, error: fetchError, signal } = await Promise.race([
        supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .abortSignal(newAbortController.signal)
          .single(),
        new Promise<never>((_, reject) => {
          newAbortController.signal.addEventListener('abort', () => {
            reject(new Error('Request was cancelled'));
          });
        })
      ]) as any;

      clearInterval(progressInterval);
      setLoadingProgress(100);

      if (newAbortController.signal.aborted) {
        console.log('Profile fetch was cancelled');
        return;
      }

      if (fetchError) {
        // PGRST116 means no profile found - this is OK for new users
        if (fetchError.code === 'PGRST116') {
          console.log('No existing profile found, using defaults for new user');
          setProfile({ ...DEFAULT_PROFILE, id: userId });
          setBadges([]);
          setCustomCSS('');
          setError(null);
          setRetryCount(0);
          return;
        }
        
        throw new Error(fetchError.message || 'Failed to fetch profile');
      }

      if (data) {
        console.log('Profile loaded successfully:', data);
        
        // Parse badges safely
        let parsedBadges: Badge[] = [];
        if (data.badges) {
          try {
            parsedBadges = typeof data.badges === 'string' 
              ? JSON.parse(data.badges) 
              : data.badges;
            
            if (!Array.isArray(parsedBadges)) {
              console.warn('Badges data is not an array, resetting to empty');
              parsedBadges = [];
            } else {
              // Filter out invalid badges
              parsedBadges = parsedBadges.filter(badge => 
                badge && typeof badge === 'object' && badge.id && badge.url
              );
            }
          } catch (e) {
            console.warn('Failed to parse badges, using empty array:', e);
            parsedBadges = [];
          }
        }

        setProfile({
          ...data,
          badges: undefined // Remove badges from profile object
        });
        setBadges(parsedBadges);
        setCustomCSS(data.profile_card_css || '');
        setError(null);
        setRetryCount(0);
      } else {
        console.log('No profile data returned, using defaults');
        setProfile({ ...DEFAULT_PROFILE, id: userId });
        setBadges([]);
        setCustomCSS('');
        setError(null);
        setRetryCount(0);
      }
    } catch (error: any) {
      if (newAbortController.signal.aborted) {
        console.log('Profile fetch was cancelled, ignoring error');
        return;
      }

      console.error('Exception loading profile:', error);
      
      const errorMessage = error.message || 'Failed to load profile';
      setError(errorMessage);
      
      // Auto-retry logic
      if (retryCount < MAX_RETRIES && !error.message?.includes('cancelled')) {
        const delay = RETRY_DELAYS[retryCount] || 4000;
        console.log(`Auto-retrying in ${delay}ms... (${retryCount + 1}/${MAX_RETRIES})`);
        
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          loadProfile(userId, true);
        }, delay);
      } else {
        // Set defaults even on final error so the form is usable
        setProfile({ ...DEFAULT_PROFILE, id: userId });
        setBadges([]);
        setCustomCSS('');
      }
    } finally {
      setLoading(false);
      setIsRetrying(false);
      setLoadingProgress(0);
    }
  }, [retryCount, abortController]);

  // ✅ Manual retry function
  const retryLoadProfile = useCallback((userId: string) => {
    setRetryCount(0);
    loadProfile(userId, false);
  }, [loadProfile]);

  // ✅ Cancel loading function
  const cancelLoading = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setLoading(false);
      setIsRetrying(false);
      setLoadingProgress(0);
      setError('Loading was cancelled');
    }
  }, [abortController]);

  // ✅ Enhanced save function with loading states
  const saveProfile = useCallback(async (userId: string) => {
    if (!userId) {
      throw new Error('User ID is required');
    }

    setSaving(true);
    setError(null);
    
    try {
      console.log('Saving profile for user:', userId);
      
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

      console.log('Saving profile data:', profileData);

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
      setError(null);
    } catch (error: any) {
      console.error('Exception saving profile:', error);
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
    setRetryCount(0);
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
    retryCount,
    isRetrying,
    loadingProgress,
    saveProfile,
    loadProfile,
    retryLoadProfile,
    cancelLoading,
    resetToDefaults,
    canRetry: retryCount < MAX_RETRIES
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
    retryCount,
    isRetrying,
    loadingProgress,
    saveProfile,
    loadProfile,
    retryLoadProfile,
    cancelLoading,
    resetToDefaults,
    canRetry
  } = useProfileCustomizer();

  // Load profile when component opens
  useEffect(() => {
    if (isOpen && user?.id && !authLoading) {
      console.log('ProfileCustomizer: Loading profile for user:', user.id);
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
        title: "Profile Saved",
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
          retryCount={0}
          isRetrying={false}
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
          message={
            isRetrying 
              ? "The server is taking longer than usual. Please wait while we retry..."
              : "Loading your profile data..."
          }
          progress={loadingProgress}
          isRetrying={isRetrying}
          retryCount={retryCount}
          onCancel={cancelLoading}
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
          retryCount={retryCount}
          isRetrying={isRetrying}
          canRetry={canRetry}
        />
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Customize Your Profile" maxWidth="6xl">
      <div className="flex flex-col lg:flex-row gap-6 h-[80vh]">
        {/* Left Panel - Customization Controls */}
        <div className="flex-1 overflow-y-auto">
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
              <h3 className="text-lg font-medium mb-4 text-center">Live Preview</h3>
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
              disabled={loading || isRetrying || !canRetry}
              className="flex items-center gap-2"
            >
              {isRetrying ? <LoadingSpinner size="sm" /> : '🔄'}
              {isRetrying ? 'Retrying...' : 'Reload Profile'}
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

// Helper function for default avatar
function getDefaultAvatar() {
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjNTg2NUY0Ii8+CjxjaXJjbGUgY3g9IjQwIiBjeT0iMzAiIHI9IjE0IiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMjAgNjBDMjAgNTIuMjY4IDI2LjI2OCA0NiAzNCA0NkM0MS43MzIgNDYgNDggNTIuMjY4IDQ4IDYwVjgwSDIwVjYwWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+';
}