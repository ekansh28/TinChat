// src/components/ProfilePopup/ProfilePopupProvider.tsx - FIXED STATE UPDATES
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
  const [isMounted, setIsMounted] = useState(false);

  // ✅ FIXED: Ensure mounted state is tracked
  useEffect(() => {
    setIsMounted(true);
    return () => {
      setIsMounted(false);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  const showProfile = useCallback((
    profile: UserProfile,
    badges: Badge[] = [],
    customCSS: string = '',
    clickEvent: React.MouseEvent
  ) => {
    if (!isMounted) {
      console.warn('[ProfilePopupProvider] Component not mounted, skipping showProfile');
      return;
    }

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
  }, [isMounted]);

  const hideProfile = useCallback(() => {
    if (!isMounted) return;
    
    console.log('[ProfilePopupProvider] Hiding profile popup');
    setPopupState(prev => ({ ...prev, isVisible: false }));
    
    // Clear any existing hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = undefined;
    }
  }, [isMounted]);

  // ✅ FIXED: Handle clicks outside the popup but prevent closing on username clicks
  useEffect(() => {
    if (!isMounted || !popupState.isVisible) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Check if click is inside popup
      if (popupRef.current && popupRef.current.contains(target)) {
        return;
      }

      // ✅ FIXED: More specific check for username clicks
      const clickedElement = event.target as Element;
      
      // Don't close if clicking on usernames or clickable message elements
      const isUsernameClick = 
        clickedElement.closest('[role="button"]') || 
        clickedElement.closest('.cursor-pointer') ||
        clickedElement.matches('span[style*="color"]') || // Username spans with color
        clickedElement.closest('.font-bold') || // Username elements are usually bold
        clickedElement.closest('.message-row'); // Don't close when clicking in message area

      if (isUsernameClick) {
        // Don't hide immediately, let the new profile show
        console.log('[ProfilePopupProvider] Username click detected, not hiding popup');
        return;
      }

      // Hide popup for other clicks
      console.log('[ProfilePopupProvider] Outside click detected, hiding popup');
      hideProfile();
    };

    // Add small delay to prevent immediate closing
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        document.addEventListener('mousedown', handleClickOutside);
      }
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMounted, popupState.isVisible, hideProfile]);

  // Handle keyboard events
  useEffect(() => {
    if (!isMounted || !popupState.isVisible) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        hideProfile();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMounted, popupState.isVisible, hideProfile]);

  // ✅ REMOVED: Custom close event handler since there's no close button

  // ✅ FIXED: Auto-hide after inactivity with proper mounting check
  useEffect(() => {
    if (!isMounted || !popupState.isVisible) return;

    // Auto-hide after 10 seconds of no interaction
    hideTimeoutRef.current = setTimeout(() => {
      if (isMounted) {
        console.log('[ProfilePopupProvider] Auto-hiding popup after inactivity');
        hideProfile();
      }
    }, 10000);

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = undefined;
      }
    };
  }, [isMounted, popupState.isVisible, hideProfile]);

  // ✅ FIXED: Handle mouse enter/leave with mounting checks
  const handlePopupMouseEnter = useCallback(() => {
    if (!isMounted) return;
    
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = undefined;
    }
  }, [isMounted]);

  const handlePopupMouseLeave = useCallback(() => {
    if (!isMounted) return;
    
    // Restart auto-hide timer when mouse leaves popup
    if (popupState.isVisible) {
      hideTimeoutRef.current = setTimeout(() => {
        if (isMounted) {
          hideProfile();
        }
      }, 3000); // Shorter timeout when mouse leaves
    }
  }, [isMounted, popupState.isVisible, hideProfile]);

  // Enhanced ProfilePopup with mouse events and mounting check
  const EnhancedProfilePopup = () => {
    if (!isMounted) return null;
    
    return (
      <div
        ref={popupRef}
        onMouseEnter={handlePopupMouseEnter}
        onMouseLeave={handlePopupMouseLeave}
      >
        <ProfilePopup {...popupState} />
      </div>
    );
  };

  return (
    <ProfilePopupContext.Provider value={{ 
      showProfile, 
      hideProfile, 
      isVisible: popupState.isVisible 
    }}>
      {children}
      {isMounted && popupState.isVisible && <EnhancedProfilePopup />}
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