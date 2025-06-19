// src/components/ProfileCustomizer/components/ProfileCard.tsx
'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Badge, UserProfile } from '../types';

export interface ProfileCardProps {
  profile: UserProfile;
  badges: Badge[];
  customCSS: string;
  isPreview: boolean;
}

const STATUS_CONFIG = {
  online: { icon: '🟢', text: 'Online', color: '#43b581' },
  idle: { icon: '🟡', text: 'Idle', color: '#faa61a' },
  dnd: { icon: '🔴', text: 'Do Not Disturb', color: '#f04747' },
  offline: { icon: '⚫', text: 'Offline', color: '#747f8d' }
} as const;

export function ProfileCard({ profile, badges, customCSS, isPreview }: ProfileCardProps) {
  return (
    <div className="bg-white dark:bg-gray-700 rounded-lg overflow-hidden">
      <div className="p-4">
        <div className="flex items-center space-x-4">
          <img
            src={profile.avatar_url || getDefaultAvatar()}
            alt="Profile"
            className="w-16 h-16 rounded-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = getDefaultAvatar();
            }}
          />
          <div>
            <div 
              className="text-lg font-semibold"
              style={{ 
                color: profile.display_name_color || '#ffffff',
                animation: profile.display_name_animation === 'rainbow' ? 
                  `rainbow ${profile.rainbow_speed || 3}s infinite` : 'none'
              }}
            >
              {profile.display_name || profile.username || 'Unknown User'}
            </div>
            {profile.status && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {STATUS_CONFIG[profile.status as keyof typeof STATUS_CONFIG]?.text || 'Offline'}
              </div>
            )}
          </div>
        </div>

        {badges?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {badges.map(badge => (
              <img
                key={badge.id}
                src={badge.url}
                alt={badge.name || 'Badge'}
                className="w-6 h-6"
                title={badge.name}
              />
            ))}
          </div>
        )}
        
        {customCSS && isPreview && (
          <style dangerouslySetInnerHTML={{ __html: customCSS }} />
        )}
      </div>
    </div>
  );
}

function getDefaultAvatar() {
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjNTg2NUY0Ii8+CjxjaXJjbGUgY3g9IjQwIiBjeT0iMzAiIHI9IjE0IiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMjAgNjBDMjAgNTIuMjY4IDI2LjI2OCA0NiAzNCA0NkM0MS43MzIgNDYgNDggNTIuMjY4IDQ4IDYwVjgwSDIwVjYwWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+';
}
