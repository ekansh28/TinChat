// src/components/ProfilePopup/ProfilePopupProvider.tsx - CLEAN VERSION - ONLY CLOSE OUTSIDE
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

  const popupRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(false);

  // Mount tracking
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const showProfile = useCallback((
    profile: UserProfile,
    badges: Badge[] = [],
    customCSS: string = '',
    clickEvent: React.MouseEvent
  ) => {
    if (!isMountedRef.current) {
      console.warn('[ProfilePopupProvider] Component not mounted, skipping showProfile');
      return;
    }

    console.log('[ProfilePopupProvider] Showing profile popup:', {
      username: profile.username,
      badgeCount: badges.length,
      hasCustomCSS: !!customCSS.trim(),
      position: { x: clickEvent.clientX, y: clickEvent.clientY }
    });

    if (isMountedRef.current) {
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
    }
  }, []);

  const hideProfile = useCallback(() => {
    if (!isMountedRef.current) return;
    
    console.log('[ProfilePopupProvider] Hiding profile popup');
    
    if (isMountedRef.current) {
      setPopupState(prev => ({ ...prev, isVisible: false }));
    }
  }, []);

  // ✅ SIMPLIFIED: Only close when clicking outside popup - no other rules
  useEffect(() => {
    if (!isMountedRef.current || !popupState.isVisible) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!isMountedRef.current) return;

      const target = event.target as Element;
      
      // ✅ SIMPLE RULE: Only check if click is inside the popup
      if (popupRef.current && popupRef.current.contains(target)) {
        console.log('[ProfilePopupProvider] Click inside popup, keeping open');
        return;
      }

      // ✅ SIMPLE RULE: If click is outside popup, close it
      console.log('[ProfilePopupProvider] Click outside popup, closing');
      hideProfile();
    };

    // Add event listener immediately (no delay)
    document.addEventListener('mousedown', handleClickOutside, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [popupState.isVisible, hideProfile]);

  // Handle ESC key only
  useEffect(() => {
    if (!isMountedRef.current || !popupState.isVisible) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        console.log('[ProfilePopupProvider] ESC key pressed, closing popup');
        hideProfile();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [popupState.isVisible, hideProfile]);

  // ✅ NO AUTO-HIDE TIMERS - popup stays open until manually closed

  return (
    <ProfilePopupContext.Provider value={{ 
      showProfile, 
      hideProfile, 
      isVisible: popupState.isVisible 
    }}>
      {children}
      {popupState.isVisible && (
        <div ref={popupRef}>
          <ProfilePopup {...popupState} />
        </div>
      )}
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