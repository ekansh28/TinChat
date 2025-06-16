// src/components/ProfileCard.tsx - Updated to work with popup system
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface Badge {
  id: string;
  url: string;
  name?: string;
}

interface UserProfile {
  id: string;
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
  badges?: Badge[];
  created_at?: string;
}

interface ProfileCardProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onScrollToggle?: (enabled: boolean) => void;
  clickPosition?: { x: number; y: number } | null;
  variant?: 'default' | 'popup';
}

const STATUS_CONFIG = {
  online: { icon: '🟢', color: '#43b581', text: 'Online' },
  idle: { icon: '🟡', color: '#faa61a', text: 'Idle' },
  dnd: { icon: '🔴', color: '#f04747', text: 'Do Not Disturb' },
  offline: { icon: '⚫', color: '#747f8d', text: 'Offline' }
} as const;

export const ProfileCard: React.FC<ProfileCardProps> = ({
  userId,
  isOpen,
  onClose,
  onScrollToggle,
  clickPosition,
  variant = 'default'
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  
  const cardRef = useRef<HTMLDivElement>(null);
  const isPopup = variant === 'popup';

  // Fetch user profile data
  useEffect(() => {
    if (!userId || !isOpen) return;

    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select(`
            id,
            username, 
            display_name, 
            avatar_url, 
            banner_url, 
            pronouns, 
            bio,
            status,
            display_name_color, 
            display_name_animation, 
            rainbow_speed, 
            badges,
            created_at
          `)
          .eq('id', userId)
          .single();

        if (error) {
          console.error('Error fetching profile:', error);
          setError('Failed to load profile');
          return;
        }

        if (data) {
          // Parse badges safely
          let parsedBadges: Badge[] = [];
          if (data.badges) {
            try {
              parsedBadges = typeof data.badges === 'string' ? JSON.parse(data.badges) : data.badges;
              if (!Array.isArray(parsedBadges)) parsedBadges = [];
            } catch (e) {
              console.warn('Failed to parse badges:', e);
              parsedBadges = [];
            }
          }

          setProfile({
            ...data,
            badges: parsedBadges
          });
        } else {
          setError('Profile not found');
        }
      } catch (err) {
        console.error('Exception fetching profile:', err);
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId, isOpen]);

  // Handle image errors
  const handleImageError = useCallback((imageId: string) => {
    setImageErrors(prev => new Set(prev).add(imageId));
  }, []);

  const handleImageLoad = useCallback((imageId: string) => {
    setImageErrors(prev => {
      const newSet = new Set(prev);
      newSet.delete(imageId);
      return newSet;
    });
  }, []);

  // Default images
  const getDefaultAvatar = () => 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjNTg2NUY0Ii8+CjxjaXJjbGUgY3g9IjQwIiBjeT0iMzAiIHI9IjE0IiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMjAgNjBDMjAgNTIuMjY4IDI2LjI2OCA0NiAzNCA0NkM0MS43MzIgNDYgNDggNTIuMjY4IDQ4IDYwVjgwSDIwVjYwWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+';
  
  const getDefaultBanner = () => 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDMyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxkZWZzPgo8bGluZWFyR3JhZGllbnQgaWQ9ImdyYWRpZW50IiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj4KPHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6IzU4NjVGNDtzdG9wLW9wYWNpdHk6MSIgLz4KPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojN0M0REZGO3N0b3Atb3BhY2l0eToxIiAvPgo8L2xpbmVhckdyYWRpZW50Pgo8L2RlZnM+CjxyZWN0IHdpZHRoPSIzMjAiIGhlaWdodD0iMTIwIiBmaWxsPSJ1cmwoI2dyYWRpZW50KSIvPgo8L3N2Zz4=';

  // Truncate text for popup variant
  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  // Get display name styling
  const getDisplayNameStyle = () => {
    if (!profile) return {};
    
    const style: React.CSSProperties = {};
    
    if (profile.display_name_animation === 'rainbow') {
      style.animationDuration = `${profile.rainbow_speed || 3}s`;
      style.backgroundImage = 'linear-gradient(45deg, #ff0000, #ff8000, #ffff00, #80ff00, #00ff00, #00ff80, #00ffff, #0080ff, #0000ff, #8000ff, #ff00ff, #ff0080)';
      style.backgroundSize = '400% 400%';
      style.WebkitBackgroundClip = 'text';
      style.backgroundClip = 'text';
      style.WebkitTextFillColor = 'transparent';
      style.animation = 'rainbow 3s ease-in-out infinite';
    } else {
      style.color = profile.display_name_color || '#000000';
    }
    
    return style;
  };

  if (!isOpen) return null;

  return (
    <div
      ref={cardRef}
      className={cn(
        "profile-card relative bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden",
        isPopup ? "max-w-[320px]" : "max-w-sm mx-auto",
        "animate-in fade-in-0 zoom-in-95 duration-200"
      )}
      style={isPopup ? {
        minHeight: '300px',
        maxHeight: '400px'
      } : {
        minHeight: '400px',
        maxWidth: '320px'
      }}
    >
      {/* Loading State */}
      {loading && (
        <div className="profile-popup-loading">
          <div className="spinner"></div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="profile-popup-error">
          <p>Failed to load profile</p>
          <button 
            onClick={onClose}
            className="mt-2 px-3 py-1 bg-gray-200 dark:bg-gray-600 rounded text-sm"
          >
            Close
          </button>
        </div>
      )}

      {/* Profile Content */}
      {profile && !loading && !error && (
        <>
          {/* Close button for popup */}
          {isPopup && (
            <button
              onClick={onClose}
              className="absolute top-2 right-2 z-10 w-6 h-6 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full flex items-center justify-center text-sm transition-colors"
              aria-label="Close profile"
            >
              ×
            </button>
          )}

          {/* Banner */}
          <div className="relative h-20 bg-gradient-to-r from-blue-500 to-purple-600 overflow-hidden">
            {profile.banner_url && !imageErrors.has('banner') ? (
              <img
                src={profile.banner_url}
                alt="Profile Banner"
                className="w-full h-full object-cover"
                onError={() => handleImageError('banner')}
                onLoad={() => handleImageLoad('banner')}
              />
            ) : (
              <img
                src={getDefaultBanner()}
                alt="Default Banner"
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-black bg-opacity-10"></div>
          </div>

          {/* Avatar */}
          <div className="relative px-4">
            <div className="absolute -top-10 left-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-white dark:border-gray-800 bg-white dark:bg-gray-800 overflow-hidden">
                  <img
                    src={
                      profile.avatar_url && !imageErrors.has('avatar') 
                        ? profile.avatar_url 
                        : getDefaultAvatar()
                    }
                    alt="Profile Avatar"
                    className="w-full h-full object-cover"
                    onError={() => handleImageError('avatar')}
                    onLoad={() => handleImageLoad('avatar')}
                  />
                </div>
                
                {/* Status indicator */}
                <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800">
                  <div 
                    className={cn(
                      "w-full h-full rounded-full",
                      profile.status === 'online' && "bg-green-500",
                      profile.status === 'idle' && "bg-yellow-500", 
                      profile.status === 'dnd' && "bg-red-500",
                      profile.status === 'offline' && "bg-gray-500"
                    )}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Content */}
          <div className="pt-12 px-4 pb-4">
            {/* Username and Display Name */}
            <div className="mb-3">
              <div 
                className="text-lg font-bold leading-tight"
                style={getDisplayNameStyle()}
              >
                {profile.display_name || profile.username || 'Unknown User'}
              </div>
              {profile.display_name && profile.username && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  @{profile.username}
                </div>
              )}
            </div>

            {/* Pronouns */}
            {profile.pronouns && (
              <div className="mb-3">
                <span className="inline-block px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs rounded-full text-gray-700 dark:text-gray-300">
                  {profile.pronouns}
                </span>
              </div>
            )}

            {/* Badges */}
            {profile.badges && profile.badges.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  BADGES
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {profile.badges.slice(0, isPopup ? 6 : 12).map((badge, index) => (
                    <div 
                      key={badge.id} 
                      className="aspect-square group relative"
                      title={badge.name || `Badge ${index + 1}`}
                    >
                      <img
                        src={imageErrors.has(badge.id) ? getDefaultAvatar() : badge.url}
                        alt={badge.name || `Badge ${index + 1}`}
                        className="w-full h-full object-cover rounded hover:scale-110 transition-transform duration-200 cursor-pointer"
                        onError={() => handleImageError(badge.id)}
                        onLoad={() => handleImageLoad(badge.id)}
                      />
                      {imageErrors.has(badge.id) && (
                        <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></div>
                      )}
                    </div>
                  ))}
                </div>
                {profile.badges.length > (isPopup ? 6 : 12) && (
                  <div className="text-xs text-gray-500 mt-1">
                    +{profile.badges.length - (isPopup ? 6 : 12)} more
                  </div>
                )}
              </div>
            )}

            {/* Bio */}
            {profile.bio && (
              <div className="mb-3">
                <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  ABOUT ME
                </div>
                <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                  {isPopup ? truncateText(profile.bio, 120) : profile.bio}
                </div>
              </div>
            )}

            {/* Profile Stats */}
            <div className={cn(
              "pt-3 border-t border-gray-200 dark:border-gray-700",
              isPopup ? "mt-2" : "mt-4"
            )}>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {profile.badges?.length || 0}
                  </div>
                  <div className="text-xs text-gray-500">
                    Badges
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {STATUS_CONFIG[profile.status || 'offline'].text}
                  </div>
                  <div className="text-xs text-gray-500">
                    Status
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown'}
                  </div>
                  <div className="text-xs text-gray-500">
                    Joined
                  </div>
                </div>
              </div>
            </div>

            {/* View Full Profile button for popup */}
            {isPopup && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={onClose}
                  className="w-full py-2 px-3 bg-blue-500 hover:bg-blue-600 text-white rounded font-medium text-sm transition-colors"
                >
                  Close Profile
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes rainbow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
};