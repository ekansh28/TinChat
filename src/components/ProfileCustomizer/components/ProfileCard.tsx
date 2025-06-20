
// ===============================================================================
// src/components/ProfileCard.tsx - WITH FAST PROFILE FETCHING
// ===============================================================================

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { fastProfileFetcher, ProfileData } from '@/lib/fastProfileFetcher';

interface ProfileCardProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onScrollToggle?: (enabled: boolean) => void;
  clickPosition?: { x: number; y: number } | null;
  variant?: 'default' | 'popup';
}

export const ProfileCard: React.FC<ProfileCardProps> = ({ userId, isOpen, onClose }) => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  
  const mountedRef = useRef(true);
  const fetchTimeRef = useRef<number>(0);

  // Fast profile fetch with cache-first strategy
  const fetchProfile = useCallback(async (forceRefresh: boolean = false) => {
    if (!userId || !mountedRef.current) return;

    const startTime = Date.now();
    fetchTimeRef.current = startTime;

    setLoading(true);
    setError(null);

    try {
      console.log(`ProfileCard: Fast fetching profile for ${userId}${forceRefresh ? ' (force refresh)' : ''}`);

      const profile = await fastProfileFetcher.fetchProfile(userId, {
        useCache: !forceRefresh,
        forceRefresh,
        timeout: 5000,
        retries: 2
      });

      // Only update if this is the most recent fetch
      if (fetchTimeRef.current === startTime && mountedRef.current) {
        const fetchTime = Date.now() - startTime;
        console.log(`ProfileCard: Profile fetched in ${fetchTime}ms for ${userId}`);
        
        setProfile(profile);
        setError(null);
        setIsFromCache(fetchTime < 100); // Likely from cache if very fast
      }

    } catch (err: any) {
      // Only update if this is the most recent fetch
      if (fetchTimeRef.current === startTime && mountedRef.current) {
        console.error('ProfileCard: Fast fetch error:', err);
        const errorMessage = err.message || 'Failed to load profile';
        
        if (errorMessage.includes('not found')) {
          setError('Profile not found');
        } else {
          setError(errorMessage);
        }
        setProfile(null);
        setIsFromCache(false);
      }
    } finally {
      if (fetchTimeRef.current === startTime && mountedRef.current) {
        setLoading(false);
      }
    }
  }, [userId]);

  // Refresh profile data
  const handleRefresh = useCallback(() => {
    fetchProfile(true);
  }, [fetchProfile]);

  // Load profile when component opens
  useEffect(() => {
    mountedRef.current = true;
    
    if (isOpen && userId) {
      fetchProfile(false);
    }

    return () => {
      mountedRef.current = false;
      // Cancel any pending requests
      if (userId) {
        fastProfileFetcher.cancelRequest(userId);
      }
    };
  }, [isOpen, userId, fetchProfile]);

  if (!isOpen) return null;

  const renderContent = () => {
    if (loading) {
      return (
        <div className="text-center p-4">
          <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-sm">Loading profile...</p>
          <div className="text-xs text-gray-500 mt-1">
            {isFromCache ? '⚡ From cache' : '🌐 From server'}
          </div>
        </div>
      );
    }

    if (error && !loading) {
      return (
        <div className="text-center p-4">
          <div className="text-red-600 mb-3">⚠️</div>
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <div className="flex gap-2 justify-center">
            {error !== 'Profile not found' && (
              <button className="button" onClick={handleRefresh}>
                🔄 Retry
              </button>
            )}
            <button className="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      );
    }

    if (profile) {
      return (
        <div className="profile-content p-4">
          {/* Header with cache indicator */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-lg">Profile</h2>
              {isFromCache && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded" title="Loaded from cache">
                  ⚡ Fast
                </span>
              )}
            </div>
            <button 
              className="text-xs text-blue-600 hover:underline" 
              onClick={handleRefresh}
              title="Refresh profile"
            >
              🔄
            </button>
          </div>

          {/* Profile content */}
          <div className="flex items-center gap-3 mb-3">
            <img
              src={profile.avatar_url || getDefaultAvatar()}
              alt="Profile"
              className="w-12 h-12 rounded-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = getDefaultAvatar();
              }}
            />
            <div>
              <h3 
                className="font-bold text-lg"
                style={{ 
                  color: profile.display_name_color || undefined,
                  animation: profile.display_name_animation === 'rainbow' ? 
                    `rainbow ${profile.rainbow_speed || 3}s infinite` : 'none'
                }}
              >
                {profile.display_name || profile.username || 'Anonymous User'}
              </h3>
              {profile.pronouns && (
                <p className="text-xs text-gray-600">{profile.pronouns}</p>
              )}
              {profile.status && (
                <div className="flex items-center gap-1 text-xs">
                  <span className={getStatusColor(profile.status)}>●</span>
                  <span className="capitalize">{profile.status}</span>
                </div>
              )}
            </div>
          </div>

          {profile.bio && (
            <div className="mb-3">
              <p className="text-sm p-2 bg-gray-50 rounded border-l-4 border-blue-500">
                {profile.bio}
              </p>
            </div>
          )}

          {profile.badges && profile.badges.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold mb-2">Badges ({profile.badges.length}):</p>
              <div className="flex flex-wrap gap-1">
                {profile.badges.map((badge, index) => (
                  <img
                    key={badge.id || index}
                    src={badge.url}
                    alt={badge.name || 'Badge'}
                    className="w-6 h-6 rounded"
                    title={badge.name}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-gray-500 border-t pt-2">
            <div>Member since: {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown'}</div>
            {profile.updated_at && (
              <div>Last updated: {new Date(profile.updated_at).toLocaleDateString()}</div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="text-center p-4">
        <p className="text-sm text-gray-600">No profile data available</p>
        <button className="button mt-2" onClick={onClose}>
          Close
        </button>
      </div>
    );
  };

  return (
    <div className="window profile-card">
      <div className="title-bar">
        <div className="title-bar-text">
          User Profile {isFromCache && <span className="text-xs">⚡</span>}
        </div>
        <div className="title-bar-controls">
          <button aria-label="Close" onClick={onClose}></button>
        </div>
      </div>
      <div className="window-body">
        {renderContent()}
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
    </div>
  );
};

// Helper functions
function getDefaultAvatar() {
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjNTg2NUY0Ii8+CjxjaXJjbGUgY3g9IjQwIiBjeT0iMzAiIHI9IjE0IiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMjAgNjBDMjAgNTIuMjY4IDI2LjI2OCA0NiAzNCA0NkM0MS43MzIgNDYgNDggNTIuMjY4IDQ4IDYwVjgwSDIwVjYwWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+';
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'online': return 'text-green-500';
    case 'idle': return 'text-yellow-500';
    case 'dnd': return 'text-red-500';
    case 'offline': return 'text-gray-500';
    default: return 'text-gray-500';
  }
}
