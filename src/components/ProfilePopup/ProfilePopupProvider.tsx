// src/components/ProfilePopup/ProfilePopupProvider.tsx - ENHANCED WITH AUTO-HIDE
'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import { UserProfile, Badge } from '../ProfileCustomizer/types';
import { ProfilePopup } from './ProfilePopup';

interface PopupPosition {
  x: number;
  y: number;
}

interface PopupState {
  isVisible: boolean;
  profile: UserProfile | null;
  badges: Badge[];
  customCSS: string;
  position: PopupPosition | null;
}

interface ProfilePopupContextType {
  showProfile: (profile: UserProfile, badges: Badge[], customCSS: string, clickEvent: React.MouseEvent) => void;
  hideProfile: () => void;
  isVisible: boolean;
}

const ProfilePopupContext = createContext<ProfilePopupContextType | undefined>(undefined);

export const ProfilePopupProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [popupState, setPopupState] = useState<PopupState>({
    isVisible: false,
    profile: null,
    badges: [],
    customCSS: '',
    position: null
  });

  const hideTimeoutRef = useRef<NodeJS.Timeout>();
  const popupRef = useRef<HTMLDivElement>(null);

  const showProfile = useCallback((
    profile: UserProfile,
    badges: Badge[] = [],
    customCSS: string = '',
    clickEvent: React.MouseEvent
  ) => {
    // Clear any existing hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = undefined;
    }

    console.log('[ProfilePopupProvider] Showing profile popup:', {
      username: profile.username,
      badgeCount: badges.length,
      hasCustomCSS: !!customCSS.trim(),
      position: { x: clickEvent.clientX, y: clickEvent.clientY }
    });

    setPopupState({
      isVisible: true,
      profile,
      badges,
      customCSS,
      position: {
        x: clickEvent.clientX,
        y: clickEvent.clientY
      }
    });
  }, []);

  const hideProfile = useCallback(() => {
    console.log('[ProfilePopupProvider] Hiding profile popup');
    setPopupState(prev => ({ ...prev, isVisible: false }));
    
    // Clear any existing hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = undefined;
    }
  }, []);

  // Handle clicks outside the popup
  useEffect(() => {
    if (!popupState.isVisible) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Check if click is inside popup
      if (popupRef.current && popupRef.current.contains(target)) {
        return;
      }

      // Check if click is on a username (to allow switching between profiles)
      const clickedElement = event.target as Element;
      const isUsernameClick = clickedElement.closest('[role="button"]') || 
                            clickedElement.closest('.cursor-pointer') ||
                            clickedElement.matches('span[style*="color"]'); // Username spans often have color styling

      if (isUsernameClick) {
        // Don't hide immediately, let the new profile show
        return;
      }

      // Hide popup for other clicks
      hideProfile();
    };

    // Add small delay to prevent immediate closing
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [popupState.isVisible, hideProfile]);

  // Handle keyboard events
  useEffect(() => {
    if (!popupState.isVisible) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        hideProfile();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [popupState.isVisible, hideProfile]);

  // Handle custom close event (from close button)
  useEffect(() => {
    const handleCustomClose = () => {
      hideProfile();
    };

    window.addEventListener('closeProfilePopup', handleCustomClose);
    return () => window.removeEventListener('closeProfilePopup', handleCustomClose);
  }, [hideProfile]);

  // Auto-hide after inactivity (optional)
  useEffect(() => {
    if (!popupState.isVisible) return;

    // Auto-hide after 10 seconds of no interaction
    hideTimeoutRef.current = setTimeout(() => {
      console.log('[ProfilePopupProvider] Auto-hiding popup after inactivity');
      hideProfile();
    }, 10000);

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = undefined;
      }
    };
  }, [popupState.isVisible, hideProfile]);

  // Handle mouse enter/leave on popup to prevent auto-hide
  const handlePopupMouseEnter = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = undefined;
    }
  }, []);

  const handlePopupMouseLeave = useCallback(() => {
    // Restart auto-hide timer when mouse leaves popup
    if (popupState.isVisible) {
      hideTimeoutRef.current = setTimeout(() => {
        hideProfile();
      }, 3000); // Shorter timeout when mouse leaves
    }
  }, [popupState.isVisible, hideProfile]);

  // Enhanced ProfilePopup with mouse events
  const EnhancedProfilePopup = () => (
    <div
      ref={popupRef}
      onMouseEnter={handlePopupMouseEnter}
      onMouseLeave={handlePopupMouseLeave}
    >
      <ProfilePopup {...popupState} />
    </div>
  );

  return (
    <ProfilePopupContext.Provider value={{ 
      showProfile, 
      hideProfile, 
      isVisible: popupState.isVisible 
    }}>
      {children}
      {popupState.isVisible && <EnhancedProfilePopup />}
    </ProfilePopupContext.Provider>
  );
};

export const useProfilePopup = (): ProfilePopupContextType => {
  const context = useContext(ProfilePopupContext);
  if (!context) {
    throw new Error('useProfilePopup must be used within a ProfilePopupProvider');
  }
  return context;
};