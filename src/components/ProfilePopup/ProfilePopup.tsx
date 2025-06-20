// src/components/ProfilePopup/ProfilePopup.tsx
'use client';

import { ProfileCard } from '../ProfileCustomizer/components/ProfileCard';
import { UserProfile, Badge } from '../ProfileCustomizer/types';

interface ProfilePopupProps {
  isVisible: boolean;
  profile: UserProfile | null;
  badges: Badge[];
  customCSS: string;
  position: { x: number; y: number } | null;
}

export function ProfilePopup({
  isVisible,
  profile,
  badges,
  customCSS,
  position
}: ProfilePopupProps) {
  if (!isVisible || !profile || !position) return null;

  return (
    <div 
      className="fixed z-[1050]"
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
        transform: 'translateY(10px)' // Small offset from click position
      }}
    >
      <ProfileCard 
        profile={profile}
        badges={badges}
        customCSS={customCSS}
        size="md"
        className="shadow-lg border border-gray-200 dark:border-gray-600"
      />
    </div>
  );
}