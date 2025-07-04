// src/components/ProfileCardPreview.tsx
'use client';

import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { UserProfile, Badge } from '../types';

interface ProfileCardPreviewProps {
  profile: UserProfile;
  badges: Badge[];
  customCSS: string;
  isPreview?: boolean;
  onAvatarUpload?: (file: File) => void;
  onBannerUpload?: (file: File) => void;
}

function getDefaultAvatar() {
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjNTg2NUY0Ii8+CjxjaXJjbGUgY3g9IjQwIiBjeT0iMzAiIHI9IjE0IiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMjAgNjBDMjAgNTIuMjY4IDI2LjI2OCA0NiAzNCA0NkM0MS43MzIgNDYgNDggNTIuMjY4IDQ4IDYwVjgwSDIwVjYwWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+';
}

const ProfileCardPreview: React.FC<ProfileCardPreviewProps> = ({ 
  profile, 
  badges, 
  customCSS, 
  isPreview = false,
  onAvatarUpload,
  onBannerUpload
}) => {
  const [avatarHover, setAvatarHover] = useState(false);
  const [bannerHover, setBannerHover] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => {
    if (onAvatarUpload) {
      avatarInputRef.current?.click();
    }
  };

  const handleBannerClick = () => {
    if (onBannerUpload) {
      bannerInputRef.current?.click();
    }
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onAvatarUpload) {
      onAvatarUpload(file);
    }
  };

  const handleBannerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onBannerUpload) {
      onBannerUpload(file);
    }
  };

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarFileChange}
        style={{ display: 'none' }}
      />
      <input
        ref={bannerInputRef}
        type="file"
        accept="image/*"
        onChange={handleBannerFileChange}
        style={{ display: 'none' }}
      />

      {/* Inject custom CSS if provided */}
      {customCSS && (
        <style dangerouslySetInnerHTML={{ __html: customCSS }} />
      )}
      
      <div
        className={cn(
          "profile-card-custom relative bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700",
          isPreview && "ring-2 ring-blue-400 ring-opacity-50"
        )}
        style={{ maxWidth: 320, minHeight: 200, overflow: 'hidden' }}
      >
        {/* Banner area with upload hover */}
        <div 
          className="relative mb-4 -mx-4 -mt-4 h-24 cursor-pointer group"
          onClick={handleBannerClick}
          onMouseEnter={() => setBannerHover(true)}
          onMouseLeave={() => setBannerHover(false)}
        >
          {profile.banner_url ? (
            <img
              src={profile.banner_url}
              alt="Profile Banner"
              className="w-full h-full object-cover rounded-t-lg"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-blue-400 to-purple-500 rounded-t-lg" />
          )}
          
          {/* Banner upload overlay */}
          {(bannerHover || !profile.banner_url) && onBannerUpload && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-t-lg transition-opacity">
              <div className="text-white text-center">
                <div className="text-2xl mb-1">📝</div>
                <div className="text-xs">
                  {profile.banner_url ? 'Change Banner' : 'Add Banner'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="px-4 pb-4">
          {/* Avatar and basic info */}
          <div className="flex items-start gap-3 mb-3">
            {/* Avatar with upload hover */}
            <div 
              className="relative cursor-pointer group"
              onClick={handleAvatarClick}
              onMouseEnter={() => setAvatarHover(true)}
              onMouseLeave={() => setAvatarHover(false)}
            >
              <img
                src={profile.avatar_url || getDefaultAvatar()}
                alt="Profile Avatar"
                className="w-12 h-12 rounded-full object-cover border-2 border-white dark:border-gray-600"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = getDefaultAvatar();
                }}
              />
              
              {/* Avatar upload overlay */}
              {avatarHover && onAvatarUpload && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-full transition-opacity">
                  <div className="text-white text-xs">📝</div>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              {/* Display name */}
              <h2
                className="text-lg font-bold truncate"
                style={{
                  color: profile.display_name_color || undefined,
                  animation: profile.display_name_animation === 'rainbow' ? 
                    `rainbow ${profile.rainbow_speed || 3}s infinite` : 'none'
                }}
              >
                {profile.display_name || profile.username || 'User'}
              </h2>
              
              {/* Username */}
              {profile.display_name && profile.username && profile.display_name !== profile.username && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  @{profile.username}
                </p>
              )}

              {/* Pronouns */}
              {profile.pronouns && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {profile.pronouns}
                </p>
              )}

              {/* Status */}
              {profile.status && (
                <div className="flex items-center gap-1 text-xs">
                  <span className={getStatusIndicator(profile.status)}>●</span>
                  <span className="capitalize text-gray-600 dark:text-gray-300">
                    {profile.status}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <div className="mb-3">
              <p className="text-sm text-gray-700 dark:text-gray-300 p-2 bg-gray-50 dark:bg-gray-700 rounded border-l-4 border-blue-500">
                {profile.bio}
              </p>
            </div>
          )}

          {/* Badges - Scrollable container */}
          {badges.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold mb-2 text-gray-600 dark:text-gray-400">
                Badges ({badges.length}):
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {badges.map((badge) => (
                  <div key={badge.id} className="flex-shrink-0">
                    <img
                      src={badge.url}
                      alt={badge.name || 'Badge'}
                      title={badge.name || 'Badge'}
                      className="h-6 rounded object-contain"
                      style={{ 
                        minWidth: '24px',
                        maxWidth: '48px',
                        width: 'auto'
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                ))}
              </div>
              {badges.length > 4 && (
                <div className="text-xs text-gray-500 mt-1">
                  ← Scroll to see more badges →
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
            <div className="flex items-center justify-between">
              <span>Profile Preview</span>
              {isPreview && (
                <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded text-xs">
                  Live Preview
                </span>
              )}
            </div>
          </div>
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

        /* Upload hover transitions */
        .group .transition-opacity {
          transition: opacity 0.2s ease-in-out;
        }
      `}</style>
    </>
  );
};

function getStatusIndicator(status: string): string {
  switch (status) {
    case 'online': return 'text-green-500';
    case 'idle': return 'text-yellow-500';
    case 'dnd': return 'text-red-500';
    case 'offline': return 'text-gray-500';
    default: return 'text-gray-500';
  }
}

export default ProfileCardPreview;