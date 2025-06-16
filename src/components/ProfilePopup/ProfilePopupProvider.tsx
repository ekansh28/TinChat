// src/components/ProfilePopup/ProfilePopupProvider.tsx
'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface PopupPosition {
  x: number;
  y: number;
}

interface PopupState {
  isVisible: boolean;
  userId: string | null;
  position: PopupPosition | null;
  anchorRect: DOMRect | null;
}

interface ProfilePopupContextType {
  popupState: PopupState;
  showProfile: (userId: string, clickEvent: React.MouseEvent | MouseEvent) => void;
  hideProfile: () => void;
}

const ProfilePopupContext = createContext<ProfilePopupContextType | undefined>(undefined);

interface ProfilePopupProviderProps {
  children: ReactNode;
}

// Smart positioning algorithm
const calculatePopupPosition = (
  anchorRect: DOMRect, 
  popupDimensions = { width: 320, height: 400 }
): PopupPosition => {
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight
  };
  
  const padding = 16; // Minimum distance from viewport edges
  
  // Default position: bottom-right of anchor element
  let x = anchorRect.left;
  let y = anchorRect.bottom + 8;
  
  // Horizontal boundary checks
  if (x + popupDimensions.width > viewport.width - padding) {
    // Flip to left side of anchor
    x = anchorRect.right - popupDimensions.width;
  }
  
  // Vertical boundary checks  
  if (y + popupDimensions.height > viewport.height - padding) {
    // Flip to top of anchor
    y = anchorRect.top - popupDimensions.height - 8;
  }
  
  // Ensure minimum padding from edges
  x = Math.max(padding, Math.min(x, viewport.width - popupDimensions.width - padding));
  y = Math.max(padding, Math.min(y, viewport.height - popupDimensions.height - padding));
  
  return { x, y };
};

export const ProfilePopupProvider: React.FC<ProfilePopupProviderProps> = ({ children }) => {
  const [popupState, setPopupState] = useState<PopupState>({
    isVisible: false,
    userId: null,
    position: null,
    anchorRect: null
  });

  const showProfile = useCallback((userId: string, clickEvent: React.MouseEvent | MouseEvent) => {
    if (!userId || userId === 'anonymous') return;
    
    const target = clickEvent.target as HTMLElement;
    const rect = target.getBoundingClientRect();
    const position = calculatePopupPosition(rect);
    
    setPopupState({
      isVisible: true,
      userId,
      position,
      anchorRect: rect
    });
  }, []);

  const hideProfile = useCallback(() => {
    setPopupState({
      isVisible: false,
      userId: null,
      position: null,
      anchorRect: null
    });
  }, []);

  return (
    <ProfilePopupContext.Provider value={{ popupState, showProfile, hideProfile }}>
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