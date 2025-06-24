// src/components/ProfilePopup/ProfilePopupProvider.tsx - FIXED VERSION WITH PROPER PROPS

'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import { UserProfile, Badge } from '../ProfileCustomizer/types';
import { ProfilePopup } from './ProfilePopup';
import { useAuth } from '@/app/chat/hooks/useAuth'; // Import auth hook for currentUserAuthId

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
  
  // ✅ Get current user's auth ID for friendship operations
  const auth = useAuth();

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

  // ✅ SIMPLIFIED: Only close when clicking outside popup
  useEffect(() => {
    if (!isMountedRef.current || !popupState.isVisible) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!isMountedRef.current) return;

      const target = event.target as Element;
      
      // ✅ Check if click is inside the popup
      if (popupRef.current && popupRef.current.contains(target)) {
        console.log('[ProfilePopupProvider] Click inside popup, keeping open');
        return;
      }

      // ✅ If click is outside popup, close it
      console.log('[ProfilePopupProvider] Click outside popup, closing');
      hideProfile();
    };

    document.addEventListener('mousedown', handleClickOutside, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [popupState.isVisible, hideProfile]);

  // Handle ESC key
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

  return (
    <ProfilePopupContext.Provider value={{ 
      showProfile, 
      hideProfile, 
      isVisible: popupState.isVisible 
    }}>
      {children}
      
      {/* ✅ FIXED: Only render ProfilePopup with all required props when visible */}
      {popupState.isVisible && popupState.profile && (
        <div ref={popupRef}>
          <ProfilePopup 
            isVisible={popupState.isVisible}
            profile={popupState.profile}
            badges={popupState.badges}
            customCSS={popupState.customCSS}
            position={popupState.position}
            currentUserAuthId={auth.authId || undefined}
          />
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