// src/components/ProfilePopup/ProfilePopupProvider.tsx
'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
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

  const showProfile = useCallback((
    profile: UserProfile,
    badges: Badge[] = [],
    customCSS: string = '',
    clickEvent: React.MouseEvent
  ) => {
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
    setPopupState(prev => ({ ...prev, isVisible: false }));
  }, []);

  return (
    <ProfilePopupContext.Provider value={{ showProfile, hideProfile }}>
      {children}
      <ProfilePopup {...popupState} />
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