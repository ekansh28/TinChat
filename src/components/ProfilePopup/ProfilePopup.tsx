// src/components/ProfilePopup.tsx
'use client';

import { BaseProfileCard } from '../ProfileCustomizer/components/ProfileCard';
import { Badge, UserProfile } from '../ProfileCustomizer/types';

interface ProfilePopupProps {
  profile: UserProfile;
  badges?: Badge[];
  onClose: () => void;
}

export function ProfilePopup({ profile, badges = [], onClose }: ProfilePopupProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-end">
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>
        <BaseProfileCard 
          profile={profile} 
          badges={badges} 
          size="lg"
        />
        {/* Additional profile info can go here */}
      </div>
    </div>
  );
}