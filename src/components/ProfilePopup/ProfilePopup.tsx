// src/components/ProfileCustomizer/components/ProfilePopup.tsx
'use client';

import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useProfilePopup } from '../ProfilePopup/ProfilePopupProvider';
import { ProfileCard } from '../ProfileCustomizer/components/ProfileCard';  // Adjust path as needed

const STATUS_CONFIG = {
  online: { icon: '🟢', text: 'Online', color: '#43b581' },
  idle: { icon: '🟡', text: 'Idle', color: '#faa61a' },
  dnd: { icon: '🔴', text: 'Do Not Disturb', color: '#f04747' },
  offline: { icon: '⚫', text: 'Offline', color: '#747f8d' }
} as const;

export function ProfilePopup() {
  const { popupState, hideProfile } = useProfilePopup();
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        hideProfile();
      }
    };

    if (popupState.isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [popupState.isVisible, hideProfile]);

  if (!popupState.isVisible || !popupState.profile) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div 
        ref={popupRef}
        className="bg-white dark:bg-gray-700 rounded-lg overflow-hidden"
        style={{
          position: 'absolute',
          left: popupState.position?.x ? `${popupState.position.x}px` : 'auto',
          top: popupState.position?.y ? `${popupState.position.y}px` : 'auto',
          transform: popupState.position ? 'translate(-50%, 0)' : 'none'
        }}
      >
        <ProfileCard 
          profile={popupState.profile} 
          badges={popupState.badges} 
          customCSS={popupState.customCSS} 
          isPreview={false}  // Disable preview-specific features
        />
      </div>
    </div>
  );
}

function getDefaultAvatar() {
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjNTg2NUY0Ii8+CjxjaXJjbGUgY3g9IjQwIiBjeT0iMzAiIHI9IjE0IiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMjAgNjBDMjAgNTIuMjY4IDI2LjI2OCA0NiAzNCA0NkM0MS43MzIgNDYgNDggNTIuMjY4IDQ4IDYwVjgwSDIwVjYwWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+';
}