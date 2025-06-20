// src/components/ProfilePopup/ProfilePopupProvider.tsx
'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Badge, UserProfile } from '../ProfileCustomizer/types';

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
  popupState: PopupState;
  showProfile: (profile: UserProfile, badges: Badge[], customCSS: string, clickEvent: React.MouseEvent | MouseEvent) => void;
  hideProfile: () => void;
}

const ProfilePopupContext = createContext<ProfilePopupContextType | undefined>(undefined);

interface ProfilePopupProviderProps {
  children: ReactNode;
  defaultCustomCSS?: string;
}

const calculatePopupPosition = (clickEvent: React.MouseEvent | MouseEvent) => {
  return {
    x: (clickEvent as MouseEvent).clientX,
    y: (clickEvent as MouseEvent).clientY
  };
};

export const ProfilePopupProvider: React.FC<ProfilePopupProviderProps> = ({ 
  children,
  defaultCustomCSS = ''
}) => {
  const [popupState, setPopupState] = useState<PopupState>({
    isVisible: false,
    profile: null,
    badges: [],
    customCSS: defaultCustomCSS,
    position: null
  });

  const showProfile = useCallback((
    profile: UserProfile,
    badges: Badge[] = [],
    customCSS: string = defaultCustomCSS,
    clickEvent: React.MouseEvent | MouseEvent
  ) => {
    const position = calculatePopupPosition(clickEvent);
    
    setPopupState({
      isVisible: true,
      profile,
      badges,
      customCSS,
      position
    });
  }, [defaultCustomCSS]);

  const hideProfile = useCallback(() => {
    setPopupState(prev => ({
      ...prev,
      isVisible: false
    }));
  }, []);

  return (
    <ProfilePopupContext.Provider value={{ 
      popupState, 
      showProfile, 
      hideProfile 
    }}>
      {children}
    </ProfilePopupContext.Provider>
  );
};

export const useProfilePopup = (): ProfilePopupContextType => {
  const context = useContext(ProfilePopupContext);
  if (context === undefined) {
    throw new Error('useProfilePopup must be used within a ProfilePopupProvider');
  }
  return context;
};