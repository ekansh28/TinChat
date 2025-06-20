// src/components/ProfilePopup/ProfilePopupProvider.tsx - FIXED SELF USERNAME CLICKS
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
  const isMountedRef = useRef(false);
  const lastClickTimeRef = useRef<number>(0);
  const preventHideRef = useRef<boolean>(false);

  // ✅ FIXED: Proper mount tracking
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
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
    if (!isMountedRef.current) {
      console.warn('[ProfilePopupProvider] Component not mounted, skipping showProfile');
      return;
    }

    // ✅ NEW: Record click time and prevent auto-hide
    lastClickTimeRef.current = Date.now();
    preventHideRef.current = true;

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

    // ✅ NEW: Allow hiding after a delay
    setTimeout(() => {
      preventHideRef.current = false;
    }, 500); // 500ms protection window

  }, []);

  const hideProfile = useCallback(() => {
    if (!isMountedRef.current) return;
    
    // ✅ NEW: Don't hide if in protection window
    if (preventHideRef.current) {
      console.log('[ProfilePopupProvider] In protection window, not hiding popup');
      return;
    }
    
    console.log('[ProfilePopupProvider] Hiding profile popup');
    
    if (isMountedRef.current) {
      setPopupState(prev => ({ ...prev, isVisible: false }));
    }
    
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = undefined;
    }
  }, []);

  // ✅ FIXED: Enhanced click outside detection with better username detection
  useEffect(() => {
    if (!isMountedRef.current || !popupState.isVisible) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!isMountedRef.current) return;

      const target = event.target as Element;
      
      // Check if click is inside popup
      if (popupRef.current && popupRef.current.contains(target)) {
        return;
      }

      // ✅ NEW: Check if this click is too recent (within protection window)
      const timeSinceLastClick = Date.now() - lastClickTimeRef.current;
      if (timeSinceLastClick < 500) {
        console.log('[ProfilePopupProvider] Recent click detected, not hiding popup');
        return;
      }

      // ✅ ENHANCED: Better detection for username/profile related clicks
      const isUsernameOrProfileClick = 
        // Direct username elements
        target.closest('.username-click') ||
        target.closest('[data-username]') ||
        target.closest('[role="button"]') ||
        target.closest('.cursor-pointer') ||
        
        // Message-related elements
        target.closest('.message-row') ||
        target.closest('.font-bold') ||
        
        // Style-based detection for usernames
        target.closest('span[style*="color"]') ||
        target.closest('[onclick]') ||
        target.closest('[title*="profile"]') ||
        
        // Check if the element itself looks like a username
        (target.tagName === 'SPAN' && (
          target.getAttribute('style')?.includes('color') ||
          target.classList.contains('font-bold') ||
          target.classList.contains('cursor-pointer')
        )) ||
        
        // ✅ NEW: Check parent elements for username characteristics
        (target.parentElement && (
          target.parentElement.classList.contains('font-bold') ||
          target.parentElement.classList.contains('cursor-pointer') ||
          target.parentElement.getAttribute('style')?.includes('color')
        ));

      if (isUsernameOrProfileClick) {
        console.log('[ProfilePopupProvider] Username/profile click detected, not hiding popup');
        return;
      }

      // ✅ NEW: Check for username-like text content more precisely
      const textContent = target.textContent?.trim() || '';
      const parentTextContent = target.parentElement?.textContent?.trim() || '';
      
      // Check if this looks like a username message format
      const looksLikeUsername = 
        (textContent.length > 0 && textContent.length < 50 && textContent.includes(':')) ||
        (parentTextContent.length > 0 && parentTextContent.length < 50 && parentTextContent.includes(':'));

      if (looksLikeUsername) {
        console.log('[ProfilePopupProvider] Username-like text detected, not hiding popup');
        return;
      }

      // ✅ NEW: Additional check for elements that might be part of a message
      const isPartOfMessage = 
        target.closest('div')?.textContent?.includes(':') ||
        target.closest('[class*="message"]') ||
        target.closest('[class*="chat"]');

      if (isPartOfMessage) {
        console.log('[ProfilePopupProvider] Part of message detected, not hiding popup');
        return;
      }

      console.log('[ProfilePopupProvider] Outside click detected, hiding popup');
      hideProfile();
    };

    // ✅ NEW: Longer delay to ensure username clicks are properly processed
    const timeoutId = setTimeout(() => {
      if (isMountedRef.current) {
        document.addEventListener('mousedown', handleClickOutside, { passive: true });
      }
    }, 300); // Increased delay

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [popupState.isVisible, hideProfile]);

  // Handle keyboard events
  useEffect(() => {
    if (!isMountedRef.current || !popupState.isVisible) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        hideProfile();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [popupState.isVisible, hideProfile]);

  // ✅ FIXED: Auto-hide with proper mounting checks and protection window
  useEffect(() => {
    if (!isMountedRef.current || !popupState.isVisible) return;

    // Auto-hide after 10 seconds of no interaction (but respect protection window)
    hideTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && !preventHideRef.current) {
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
  }, [popupState.isVisible, hideProfile]);

  // ✅ FIXED: Mouse enter/leave with mounting checks
  const handlePopupMouseEnter = useCallback(() => {
    if (!isMountedRef.current) return;
    
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = undefined;
    }
  }, []);

  const handlePopupMouseLeave = useCallback(() => {
    if (!isMountedRef.current) return;
    
    // Restart auto-hide timer when mouse leaves popup (but respect protection window)
    if (popupState.isVisible && !preventHideRef.current) {
      hideTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && !preventHideRef.current) {
          hideProfile();
        }
      }, 3000); // Shorter timeout when mouse leaves
    }
  }, [popupState.isVisible, hideProfile]);

  // Enhanced ProfilePopup with mouse events and mounting check
  const EnhancedProfilePopup = () => {
    if (!isMountedRef.current) return null;
    
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