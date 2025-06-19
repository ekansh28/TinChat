// src/components/ProfileCardPreview.tsx
'use client';

import React from 'react';
import { cn } from '@/lib/utils';
// import { STATUS_CONFIG } from './ProfileCard'; // If it's exported
import type { UserProfile, Badge } from '../types'; // Adjust if needed

interface ProfileCardPreviewProps {
  profile: UserProfile;
  badges: Badge[];
  customCSS: string;
  isPreview?: boolean;
}

const ProfileCardPreview: React.FC<ProfileCardPreviewProps> = ({ profile, badges, customCSS, isPreview }) => {
  return (
    <div
      className={cn(
        "preview-profile-card relative bg-white dark:bg-gray-800 rounded-lg shadow-md p-4",
        isPreview && "ring-2 ring-blue-400"
      )}
      style={{ maxWidth: 320 }}
    >
      {/* Display name */}
      <h2
        className="text-lg font-bold"
        style={{
          color: profile.display_name_color || undefined,
        }}
      >
        {profile.display_name || profile.username || 'User'}
      </h2>

      {/* Pronouns */}
      {profile.pronouns && (
        <p className="text-xs text-gray-500 mb-1">{profile.pronouns}</p>
      )}

      {/* Bio */}
      {profile.bio && (
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
          {profile.bio}
        </p>
      )}

      {/* Badges */}
      <div className="flex flex-wrap gap-1">
        {badges.map((badge) => (
          <img
            key={badge.id}
            src={badge.url}
            alt={badge.name || 'Badge'}
            className="w-6 h-6 rounded"
          />
        ))}
      </div>

      {/* Custom CSS preview */}
      {customCSS && (
        <style>{customCSS}</style>
      )}
    </div>
  );
};

export default ProfileCardPreview;
