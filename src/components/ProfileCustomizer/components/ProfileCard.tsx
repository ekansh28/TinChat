// src/components/ProfileCard/ProfileCard.tsx
'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Badge, UserProfile } from '../types';

const STATUS_CONFIG = {
  online: { icon: '🟢', text: 'Online', color: '#43b581' },
  idle: { icon: '🟡', text: 'Idle', color: '#faa61a' },
  dnd: { icon: '🔴', text: 'Do Not Disturb', color: '#f04747' },
  offline: { icon: '⚫', text: 'Offline', color: '#747f8d' }
} as const;

interface BaseProfileCardProps {
  profile: UserProfile;
  badges?: Badge[];
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function BaseProfileCard({ 
  profile, 
  badges = [], 
  className = '',
  size = 'md'
}: BaseProfileCardProps) {
  const sizeConfig = {
    sm: { avatar: 'w-10 h-10', name: 'text-md', status: 'text-xs', badgeSize: 'w-5 h-5' },
    md: { avatar: 'w-16 h-16', name: 'text-lg', status: 'text-sm', badgeSize: 'w-6 h-6' },
    lg: { avatar: 'w-24 h-24', name: 'text-xl', status: 'text-md', badgeSize: 'w-8 h-8' }
  }[size];
  
  return (
    <div className={cn(
      "bg-white dark:bg-gray-700 rounded-lg overflow-hidden shadow",
      className
    )}>
      <div className="p-4">
        <div className="flex items-center space-x-4">
          <img
            src={profile.avatar_url || getDefaultAvatar()}
            alt="Profile"
            className={cn(
              "rounded-full object-cover",
              sizeConfig.avatar
            )}
            onError={(e) => {
              (e.target as HTMLImageElement).src = getDefaultAvatar();
            }}
          />
          <div>
            <div 
              className={cn("font-semibold", sizeConfig.name)}
              style={{ 
                color: profile.display_name_color || '#ffffff',
                animation: profile.display_name_animation === 'rainbow' ? 
                  `rainbow ${profile.rainbow_speed || 3}s infinite` : 'none'
              }}
            >
              {profile.display_name || profile.username || 'Unknown User'}
            </div>
            {profile.status && (
              <div className={cn(
                "text-gray-500 dark:text-gray-400",
                sizeConfig.status
              )}>
                {STATUS_CONFIG[profile.status as keyof typeof STATUS_CONFIG]?.text || 'Offline'}
              </div>
            )}
          </div>
        </div>

        {badges.length > 0 && (
          <div className="mt-4 overflow-x-auto no-scrollbar" style={{ maxWidth: '100%' }}>
            <div className="flex gap-2 w-max">
              {badges.map(badge => (
                <img
                  key={badge.id}
                  src={badge.url}
                  alt={badge.name || 'Badge'}
                  className={sizeConfig.badgeSize}
                  title={badge.name}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getDefaultAvatar() {
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjNTg2NUY0Ii8+CjxjaXJjbGUgY3g9IjQwIiBjeT0iMzAiIHI9IjE0IiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMjAgNjBDMjAgNTIuMjY4IDI2LjI2OCA0NiAzNCA0NkM0MS43MzIgNDYgNDggNTIuMjY4IDQ4IDYwVjgwSDIwVjYwWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+';
}