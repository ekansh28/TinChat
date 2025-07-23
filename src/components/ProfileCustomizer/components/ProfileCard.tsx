// src/components/ProfileCustomizer/components/ProfileCard.tsx
'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { UserProfile, Badge } from '../types';

export interface ProfileCardProps {
  profile: UserProfile;
  badges?: Badge[];
  customCSS?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const STATUS_CONFIG = {
  online: { color: 'bg-green-500' },
  idle: { color: 'bg-yellow-500' },
  dnd: { color: 'bg-red-500' },
  offline: { color: 'bg-gray-500' }
} as const;

export function ProfileCard({ 
  profile, 
  badges = [], 
  customCSS = '', 
  className = '',
  size = 'md'
}: ProfileCardProps) {
  const sizeClasses = {
    sm: { avatar: 'w-10 h-10', name: 'text-md', badge: 'w-5 h-5' },
    md: { avatar: 'w-16 h-16', name: 'text-lg', badge: 'w-6 h-6' },
    lg: { avatar: 'w-24 h-24', name: 'text-xl', badge: 'w-8 h-8' }
  }[size];

  return (
    <div className={cn(
      "bg-white dark:bg-gray-800 rounded-lg p-4",
      className
    )}>
      {customCSS && <style dangerouslySetInnerHTML={{ __html: customCSS }} />}
      
      <div className="flex items-center gap-4">
        <img
          src={profile.avatar_url || getDefaultAvatar()}
          alt="Profile"
          className={cn(
            "rounded-full object-cover border-2 border-white dark:border-gray-600",
            sizeClasses.avatar
          )}
          onError={(e) => {
            (e.target as HTMLImageElement).src = getDefaultAvatar();
          }}
        />
        
        <div>
          <div 
            className={cn("font-bold", sizeClasses.name)}
            style={{ 
              color: profile.display_name_color || undefined,
              animation: profile.display_name_animation === 'rainbow' ? 
                'rainbow 3s infinite' : 'none'
            }}
          >
            {profile.display_name || profile.username || 'User'}
          </div>
          
          {profile.status && (
            <div className="flex items-center gap-2 mt-1">
              <span className={cn(
                "w-2 h-2 rounded-full",
                STATUS_CONFIG[profile.status]?.color
              )} />
              <span className="text-sm text-gray-600 dark:text-gray-300 capitalize">
                {profile.status}
              </span>
            </div>
          )}
        </div>
      </div>

      {badges.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {badges.map(badge => (
            <img
              key={badge.id}
              src={badge.url}
              alt={badge.name || 'Badge'}
              className={sizeClasses.badge}
              title={badge.name}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getDefaultAvatar() {
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjNTg2NUY0Ii8+CjxjaXJjbGUgY3g9IjQwIiBjeT0iMzAiIHI9IjE0IiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMjAgNjBDMjAgNTIuMjY4IDI2LjI2OCA0NiAzNCA0NkM0MS43MzIgNDYgNDggNTIuMjY4IDQ4IDYwVjgwSDIwVjYwWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+';
}