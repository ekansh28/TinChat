// src/components/ProfileCustomizer/components/ProfilePopup.tsx
'use client';

import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useProfilePopup } from '../ProfilePopup/ProfilePopupProvider';

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
        <div className="p-4">
          <div className="flex items-center space-x-4">
            <img
              src={popupState.profile.avatar_url || getDefaultAvatar()}
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
                  color: popupState.profile.display_name_color || '#ffffff',
                  animation: popupState.profile.display_name_animation === 'rainbow' ? 
                    `rainbow ${popupState.profile.rainbow_speed || 3}s infinite` : 'none'
                }}
              >
                {popupState.profile.display_name || popupState.profile.username || 'Unknown User'}
              </div>
              {popupState.profile.status && (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {STATUS_CONFIG[popupState.profile.status as keyof typeof STATUS_CONFIG]?.text || 'Offline'}
                </div>
              )}
            </div>
          </div>

          {popupState.badges?.length > 0 && (
            <div 
              className="mt-4 overflow-x-auto no-scrollbar"
              style={{ maxWidth: '100%' }}
              onWheel={(e) => {
                const container = e.currentTarget as HTMLElement;
                if (e.deltaY !== 0) {
                  e.preventDefault();
                  container.scrollLeft += e.deltaY;
                }
              }}
            >
              <div className="flex gap-2 w-max">
                {popupState.badges.map(badge => (
                  <img
                    key={badge.id}
                    src={badge.url}
                    alt={badge.name || 'Badge'}
                    className="w-6 h-6"
                    title={badge.name}
                  />
                ))}
              </div>
            </div>
          )}
          
          {popupState.customCSS && (
            <style dangerouslySetInnerHTML={{ __html: popupState.customCSS }} />
          )}
        </div>
      </div>
    </div>
  );
}

function getDefaultAvatar() {
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjNTg2NUY0Ii8+CjxjaXJjbGUgY3g9IjQwIiBjeT0iMzAiIHI9IjE0IiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMjAgNjBDMjAgNTIuMjY4IDI2LjI2OCA0NiAzNCA0NkM0MS43MzIgNDYgNDggNTIuMjY4IDQ4IDYwVjgwSDIwVjYwWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+';
}