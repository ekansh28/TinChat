// src/components/ProfilePopup/ProfilePopup.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { useProfilePopup } from './ProfilePopupProvider';
import { ProfileCard } from '@/components/ProfileCustomizer/components/ProfileCard';

export const ProfilePopup: React.FC = () => {
  const { popupState, hideProfile } = useProfilePopup();
  const popupRef = useRef<HTMLDivElement>(null);
  
  // Click outside detection and keyboard handling
  useEffect(() => {
    if (!popupState.isVisible) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        hideProfile();
      }
    };
    
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        hideProfile();
      }
    };
    
    // Use capture phase for better performance
    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('keydown', handleEscKey);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [popupState.isVisible, hideProfile]);

  // Focus management for accessibility
  useEffect(() => {
    if (popupState.isVisible && popupRef.current) {
      // Focus the popup for screen readers
      popupRef.current.focus();
    }
  }, [popupState.isVisible]);
  
  if (!popupState.isVisible || !popupState.userId || !popupState.position) {
    return null;
  }

  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return null;
  }
  
  return createPortal(
    <div className="profile-popup-overlay">
      <div 
        ref={popupRef}
        className={cn(
          "profile-popup",
          "fixed bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden",
          "max-w-[320px] max-h-[400px] z-[1050]",
          "animate-in fade-in-0 zoom-in-95 duration-200",
          // Mobile responsive - bottom sheet on small screens
          "md:max-w-[320px] md:max-h-[400px]",
          "max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:top-auto",
          "max-md:max-w-none max-md:max-h-[70vh] max-md:rounded-t-2xl max-md:rounded-b-none"
        )}
        style={{
          left: window.innerWidth < 768 ? undefined : popupState.position.x,
          top: window.innerWidth < 768 ? undefined : popupState.position.y,
        }}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="User profile popup"
      >
        {/* Close button for mobile */}
        <div className="md:hidden flex justify-center pt-2 pb-1">
          <div className="w-8 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
        </div>
        
        <ProfileCard 
          userId={popupState.userId}
          isOpen={true}
          onClose={hideProfile}
          onScrollToggle={() => {}} // Not needed for popup
          clickPosition={popupState.position}
          variant="popup"
        />
      </div>
    </div>,
    document.body
  );
};