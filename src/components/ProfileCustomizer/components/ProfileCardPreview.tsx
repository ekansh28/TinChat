// src/components/ProfileCardPreview.tsx
'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { UserProfile, Badge } from '../types';

interface ProfileCardPreviewProps {
  profile: UserProfile;
  badges: Badge[];
  customCSS: string;
  isPreview?: boolean;
}

// Default avatar helper function
function getDefaultAvatar() {
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjNTg2NUY0Ii8+CjxjaXJjbGUgY3g9IjQwIiBjeT0iMzAiIHI9IjE0IiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMjAgNjBDMjAgNTIuMjY4IDI2LjI2OCA0NiAzNCA0NkM0MS43MzIgNDYgNDggNTIuMjY4IDQ4IDYwVjgwSDIwVjYwWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+';
}

const ProfileCardPreview: React.FC<ProfileCardPreviewProps> = ({ 
  profile, 
  badges, 
  customCSS, 
  isPreview = false 
}) => {
  return (
    <>
      {/* Inject custom CSS if provided */}
      {customCSS && (
        <style dangerouslySetInnerHTML={{ __html: customCSS }} />
      )}
      
      <div
        className={cn(
          "profile-card-custom relative bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700",
          isPreview && "ring-2 ring-blue-400 ring-opacity-50"
        )}
        style={{ maxWidth: 320, minHeight: 200 }}
      >
        {/* Banner area */}
        {profile.banner_url && (
          <div className="mb-4 -mx-4 -mt-4">
            <img
              src={profile.banner_url}
              alt="Profile Banner"
              className="w-full h-24 object-cover rounded-t-lg"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Avatar and basic info */}
        <div className="flex items-start gap-3 mb-3">
          <img
            src={profile.avatar_url || getDefaultAvatar()}
            alt="Profile Avatar"
            className="w-12 h-12 rounded-full object-cover border-2 border-white dark:border-gray-600"
            onError={(e) => {
              (e.target as HTMLImageElement).src = getDefaultAvatar();
            }}
          />
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
            
            {/* Username (if different from display name) */}
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

        {/* Badges */}
        {badges.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-semibold mb-2 text-gray-600 dark:text-gray-400">
              Badges ({badges.length}):
            </p>
            <div className="flex flex-wrap gap-1">
              {badges.map((badge) => (
                <img
                  key={badge.id}
                  src={badge.url}
                  alt={badge.name || 'Badge'}
                  title={badge.name || 'Badge'}
                  className="w-6 h-6 rounded object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ))}
            </div>
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
    </>
  );
};

// Helper function for status indicators
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