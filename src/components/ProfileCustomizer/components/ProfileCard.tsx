// src/components/ProfileCustomizer/components/ProfileCard.tsx
import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { UserProfile, Badge } from '../types';

interface ProfileCardProps {
  profile: UserProfile;
  badges: Badge[];
  customCSS?: string;
  isPreview?: boolean;
  className?: string;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  badges,
  customCSS = '',
  isPreview = false,
  className
}) => {
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  
  const handleImageError = useCallback((imageId: string) => {
    setImageErrors(prev => new Set(prev).add(imageId));
  }, []);

  const getBrokenImageSrc = () => {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCAxNFYyNk0xNCAyMEgyNiIgc3Ryb2tlPSIjOTRBM0I4IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4=';
  };

  const getDefaultAvatar = () => {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjNTg2NUY0Ii8+CjxjaXJjbGUgY3g9IjQwIiBjeT0iMzAiIHI9IjE0IiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMjAgNjBDMjAgNTIuMjY4IDI2LjI2OCA0NiAzNCA0NkM0MS43MzIgNDYgNDggNTIuMjY4IDQ4IDYwVjgwSDIwVjYwWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+';
  };

  const getDefaultBanner = () => {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDMyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxkZWZzPgo8bGluZWFyR3JhZGllbnQgaWQ9ImdyYWRpZW50IiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj4KPHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6IzU4NjVGNDtzdG9wLW9wYWNpdHk6MSIgLz4KPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojN0M0REZGO3N0b3Atb3BhY2l0eToxIiAvPgo8L2xpbmVhckdyYWRpZW50Pgo8L2RlZnM+CjxyZWN0IHdpZHRoPSIzMjAiIGhlaWdodD0iMTIwIiBmaWxsPSJ1cmwoI2dyYWRpZW50KSIvPgo8L3N2Zz4=';
  };

  // Custom styles with user CSS
  const customStyles = customCSS ? `
    .profile-card-custom {
      ${customCSS}
    }
  ` : '';

  return (
    <>
      {customStyles && <style dangerouslySetInnerHTML={{ __html: customStyles }} />}
      
      <div 
        className={cn(
          "profile-card-custom relative bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden max-w-sm mx-auto",
          isPreview && "transform scale-90",
          className
        )}
        style={{
          minHeight: '400px',
          maxWidth: '320px'
        }}
      >
        {/* Banner */}
        <div className="relative h-24 bg-gradient-to-r from-blue-500 to-purple-600 overflow-hidden">
          {profile.banner_url && !imageErrors.has('banner') ? (
            <img
              src={profile.banner_url}
              alt="Profile Banner"
              className="w-full h-full object-cover"
              onError={() => handleImageError('banner')}
            />
          ) : (
            <img
              src={getDefaultBanner()}
              alt="Default Banner"
              className="w-full h-full object-cover"
            />
          )}
          
          {/* Banner overlay for better text readability */}
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
              style={{ 
                color: profile.display_name_color || '#000000',
                animation: profile.display_name_animation === 'rainbow' ? 
                  `rainbow ${profile.rainbow_speed || 3}s infinite` : 'none'
              }}
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
          {badges.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                BADGES
              </div>
              <div className="grid grid-cols-6 gap-2">
                {badges.slice(0, 12).map((badge, index) => (
                  <div 
                    key={badge.id} 
                    className="aspect-square group relative"
                    title={badge.name || `Badge ${index + 1}`}
                  >
                    <img
                      src={imageErrors.has(badge.id) ? getBrokenImageSrc() : badge.url}
                      alt={badge.name || `Badge ${index + 1}`}
                      className="w-full h-full object-cover rounded hover:scale-110 transition-transform duration-200 cursor-pointer"
                      onError={() => handleImageError(badge.id)}
                    />
                    {imageErrors.has(badge.id) && (
                      <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></div>
                    )}
                  </div>
                ))}
              </div>
              {badges.length > 12 && (
                <div className="text-xs text-gray-500 mt-1">
                  +{badges.length - 12} more
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
                {profile.bio}
              </div>
            </div>
          )}

          {/* Profile Stats */}
          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {badges.length}
                </div>
                <div className="text-xs text-gray-500">
                  Badges
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {profile.status || 'offline'}
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
        </div>

        {/* Preview watermark */}
        {isPreview && (
          <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
            Preview
          </div>
        )}
      </div>

      {/* CSS for animations */}
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