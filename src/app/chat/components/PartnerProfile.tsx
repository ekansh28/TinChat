// src/app/chat/components/PartnerProfile.tsx
import React from 'react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface Badge {
  id: string;
  url: string;
  name?: string;
}

interface PartnerProfileProps {
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  pronouns?: string;
  status?: 'online' | 'idle' | 'dnd' | 'offline';
  displayNameColor?: string;
  displayNameAnimation?: string;
  badges?: Badge[];
  isVisible?: boolean;
  className?: string;
}

const STATUS_CONFIG = {
  online: { icon: '/icons/online.png', color: '#43b581', text: 'Online' },
  idle: { icon: '/icons/idle.png', color: '#faa61a', text: 'Idle' },
  dnd: { icon: '/icons/dnd.png', color: '#f04747', text: 'Do Not Disturb' },
  offline: { icon: '/icons/offline.png', color: '#747f8d', text: 'Offline' }
} as const;

const getDisplayNameClass = (animation?: string) => {
  switch (animation) {
    case 'rainbow':
      return 'display-name-rainbow';
    case 'gradient':
      return 'display-name-gradient';
    case 'pulse':
      return 'display-name-pulse';
    case 'glow':
      return 'display-name-glow';
    default:
      return '';
  }
};

const PartnerProfile: React.FC<PartnerProfileProps> = ({
  username = 'Stranger',
  displayName,
  avatarUrl,
  bannerUrl,
  pronouns,
  status = 'online',
  displayNameColor = '#ffffff',
  displayNameAnimation = 'none',
  badges = [],
  isVisible = true,
  className
}) => {
  if (!isVisible) return null;

  const statusConfig = STATUS_CONFIG[status];
  const effectiveDisplayName = displayName || username;
  const displayNameClass = getDisplayNameClass(displayNameAnimation);

  return (
    <div className={cn(
      "bg-white dark:bg-gray-800 rounded-lg shadow-lg border p-4 max-w-sm",
      className
    )}>
      {/* Banner */}
      {bannerUrl && (
        <div className="relative h-20 -m-4 mb-2 rounded-t-lg overflow-hidden">
          <Image
            src={bannerUrl}
            alt="Partner banner"
            fill
            className="object-cover"
          />
        </div>
      )}

      {/* Avatar and basic info */}
      <div className="flex items-center space-x-3">
        <div className="relative">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={`${username}'s avatar`}
              width={48}
              height={48}
              className="rounded-full border-2 border-gray-200 dark:border-gray-600"
            />
          ) : (
            <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
              <span className="text-gray-500 text-lg font-bold">
                {username.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          
          {/* Status indicator */}
          <div 
            className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800"
            style={{ backgroundColor: statusConfig.color }}
            title={statusConfig.text}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <span 
              className={cn("font-semibold truncate", displayNameClass)}
              style={{ 
                color: displayNameAnimation === 'rainbow' || displayNameAnimation === 'gradient'
                  ? undefined 
                  : displayNameColor
              }}
            >
              {effectiveDisplayName}
            </span>
            
            {/* Badges */}
            {badges.length > 0 && (
              <div className="flex space-x-1">
                {badges.slice(0, 3).map((badge) => (
                  <Image
                    key={badge.id}
                    src={badge.url}
                    alt={badge.name || 'Badge'}
                    width={16}
                    height={16}
                    className="rounded"
                    title={badge.name}
                  />
                ))}
                {badges.length > 3 && (
                  <span className="text-xs text-gray-500">
                    +{badges.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
          
          <div className="text-sm text-gray-500 dark:text-gray-400">
            @{username}
          </div>
          
          {pronouns && (
            <div className="text-xs text-gray-400 dark:text-gray-500">
              {pronouns}
            </div>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="mt-3 flex items-center space-x-2">
        <div 
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: statusConfig.color }}
        />
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {statusConfig.text}
        </span>
      </div>
    </div>
  );
};

export default PartnerProfile;