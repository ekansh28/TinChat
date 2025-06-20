// ===============================================================================
// src/components/ProfileCustomizer/index.tsx - WITH 98.CSS STYLING
// ===============================================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button-themed';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { CustomizerPanel } from './components/CustomizerPanel';
import type { UserProfile, Badge } from './types';
import ProfileCardPreview from './components/ProfileCardPreview';
import { fastProfileFetcher, profileCache } from '@/lib/fastProfileFetcher';

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
  isFromCache?: boolean;
  onCancel?: () => void;
}> = ({ message, progress, isFromCache, onCancel }) => (
  <div className="window-body">
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <LoadingSpinner98 size="lg" />
      <div className="text-center space-y-2">
        <h3 className="text-lg font-bold flex items-center gap-2">
          Loading Profile
          {isFromCache && <span className="text-xs bg-green-100 px-2 py-1 border border-gray-400 sunken">⚡ Fast</span>}
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

// 98.css styled error state
const ErrorState98: React.FC<{
  error: string;
  onRetry: () => void;
  onClose: () => void;
  canRetry: boolean;
}> = ({ error, onRetry, onClose, canRetry }) => (
  <div className="window-body">
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <div className="w-16 h-16 sunken border-2 border-gray-400 bg-red-100 flex items-center justify-center">
        <span className="text-2xl">⚠️</span>
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-bold text-red-700">
          Failed to Load Profile
        </h3>
        <p className="text-gray-700 max-w-md">
          {error}
        </p>
      </div>
      <div className="flex gap-3">
        {canRetry && (
          <button 
            className="btn"
            onClick={onRetry}
          >
            🔄 Try Again
          </button>
        )}
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="window" style={{ width: '90vw', maxWidth: '1200px', height: '90vh', maxHeight: '800px' }}>
        {/* Title Bar */}
        <div className="title-bar">
          <div className="title-bar-text">
            Customize Your Profile ⚡ {isFromCache && <span className="text-xs">- Fast Cache</span>}
          </div>
          <div className="title-bar-controls">
            <button aria-label="Close" onClick={onClose}></button>
          </div>
        </div>

        {/* Window Body */}
        <div className="window-body" style={{ height: 'calc(100% - 33px)', overflow: 'hidden' }}>
          {/* Show loading state while auth is loading */}
          {authLoading && (
            <LoadingState98 
              message="Authenticating..."
              progress={50}
            />
          )}

          {/* Show auth error state */}
          {authError && !authLoading && (
            <ErrorState98
              error={authError}
              onRetry={() => window.location.reload()}
              onClose={onClose}
              canRetry={true}
            />
          )}

          {/* Show auth required state */}
          {!user && !authLoading && !authError && (
            <div className="window-body">
              <div className="flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="w-16 h-16 sunken border-2 border-gray-400 bg-blue-100 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🔐</span>
                  </div>
                  <h3 className="text-lg font-bold mb-2">Authentication Required</h3>
                  <p className="text-gray-700 mb-4">Please sign in to customize your profile</p>
                  <button className="btn" onClick={onClose}>Close</button>
                </div>
              </div>
            </div>
          )}

          {/* Show loading state during profile fetch */}
          {user && !authLoading && loading && (
            <LoadingState98 
              message={isFromCache ? "Loading from cache..." : "Fetching your profile data..."}
              progress={loadingProgress}
              isFromCache={isFromCache}
            />
          )}

          {/* Show error state */}
          {user && !authLoading && !loading && error && (
            <ErrorState98
              error={error}
              onRetry={handleRetry}
              onClose={onClose}
              canRetry={true}
            />
          )}

          {/* Main Content */}
          {user && !authLoading && !loading && !error && (
            <div className="flex h-full">
              {/* Left Panel - Customization Controls */}
              <div className="flex-1 p-4 overflow-y-auto border-r border-gray-400" style={{ borderStyle: 'inset' }}>
                {/* Performance indicator */}
                {isFromCache && (
                  <div className="mb-4 p-3 field-row sunken border border-gray-400 bg-green-50">
                    <div className="flex items-center gap-2">
                      <span className="text-green-700">⚡</span>
                      <span className="text-green-800 text-sm font-bold">
                        Profile loaded instantly from cache
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
              <div className="w-80 p-4 overflow-y-auto bg-gray-100">
                <div className="window">
                  <div className="title-bar">
                    <div className="title-bar-text">
                      Live Preview {isFromCache && <span className="text-xs">⚡</span>}
                    </div>
                  </div>
                  <div className="window-body">
                    <div className="space-y-4">
                      {/* Profile Card Preview */}
                      <div className="field-row">
                        <ProfileCardPreview
                          profile={profile}
                          badges={badges}
                          customCSS={customCSS}
                          isPreview={true}
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
                                className="text-sm font-bold"
                                style={{ 
                                  color: profile.display_name_color || '#000000',
                                  animation: profile.display_name_animation === 'rainbow' ? 
                                    `rainbow ${profile.rainbow_speed || 3}s infinite` : 'none'
                                }}
                              >
                                {profile.display_name || profile.username || 'Unknown User'}
                              </div>
                              <div className="text-sm text-gray-700">
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
            </div>
          )}

          {/* Footer Controls (only show when main content is visible) */}
          {user && !authLoading && !loading && !error && (
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
                  <button
                    className="btn"
                    onClick={onClose}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn"
                    onClick={handleSave}
                    disabled={saving || loading || !profile.username?.trim()}
                    style={{ fontWeight: 'bold' }}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}
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
      `}</style>
    </div>
  );
}