// src/app/page.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import pkg from '../../package.json';
import styles from '@/styles/page.module.css';

// Import modular components
import Header from '@/components/home/Header';
import MainCard from '@/components/home/MainCard';
import SideLinks from '@/components/home/SideLinks';
import SettingsPanel from '@/components/home/SettingsPanel';
import Footer from '@/components/home/Footer';
import ProfileCustomizer from '@/components/ProfileCustomizer';
import { useOnlineUsers } from '@/hooks/useOnlineUsers';
import { useMobileDetection } from '@/hooks/useMobileDetection';

// Declare global types for TypeScript
declare global {
  interface Window {
    stopOriginalOneko?: () => void;
    startOriginalOneko?: () => void;
    stopAnimatedGifCursor?: () => void;
    startAnimatedGifCursor?: (url: string) => void;
  }
}

const version = pkg.version;

export default function SelectionLobby() {
  const [currentInterest, setCurrentInterest] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [panelPosition, setPanelPosition] = useState({ top: 0, left: 0 });
  const [isProfileCustomizerOpen, setIsProfileCustomizerOpen] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const cardWrapperRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Custom hooks
  const usersOnline = useOnlineUsers();
  const isMobile = useMobileDetection();

  // Load 98.css and apply theme-98 class on mount
  useEffect(() => {
    // Apply theme-98 class to html element
    document.documentElement.classList.add('theme-98');
    
    // Check if 98.css is already loaded
    const existing98CSS = document.getElementById('css-98-home');
    
    if (!existing98CSS) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/98.css';
      link.id = 'css-98-home';
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
      
      console.log('98.css loaded for home page');
    }

    // Cleanup function to remove the CSS when component unmounts (when navigating away)
    return () => {
      const existingLink = document.getElementById('css-98-home');
      if (existingLink && pathname !== '/') {
        document.head.removeChild(existingLink);
        console.log('98.css removed when leaving home page');
      }
      // Keep theme-98 class since it's used by globals.css
    };
  }, [pathname]);

  // Reset navigation state when pathname changes
  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  const handleStartChat = (type: 'text' | 'video') => {
    if (!router) {
      console.error("SelectionLobby: Router is not available in handleStartChat.");
      toast({ 
        title: "Navigation Error", 
        description: "Could not initiate chat. Router not available."
      });
      setIsNavigating(false);
      return;
    }

    setIsNavigating(true);
    const interestsString = selectedInterests.join(',');
    const params = new URLSearchParams();
    if (interestsString) {
      params.append('interests', interestsString);
    }

    const queryString = params.toString();
    const path = type === 'video' 
      ? `/video-chat${queryString ? `?${queryString}` : ''}` 
      : `/chat${queryString ? `?${queryString}` : ''}`;
    
    try {
      router.push(path);
    } catch (err) {
      console.error("Navigation failed:", err);
      toast({ 
        title: "Navigation Error", 
        description: "Could not start chat session."
      });
      setIsNavigating(false);
    }
  };

  const handleToggleSettings = () => {
    const opening = !isSettingsOpen;
    setIsSettingsOpen(opening);

    if (opening && cardWrapperRef.current) {
      const cardRect = cardWrapperRef.current.getBoundingClientRect();
      
      if (isMobile) {
        setPanelPosition({
          top: cardRect.bottom + window.scrollY + 8,
          left: Math.max(8, (window.innerWidth - 250) / 2)
        });
      } else {
        setPanelPosition({
          top: cardRect.top + window.scrollY,
          left: cardRect.right + window.scrollX + 16
        });
      }
    }
  };

  return (
    <div className={styles.homePageContainer}>
      {/* Header with AuthButtons and Profile Customizer in top-right */}
      <div className={styles.homeHeader}>
        <Header 
          version={version} 
          isMobile={isMobile}
          onOpenProfileCustomizer={() => setIsProfileCustomizerOpen(true)}
        />
      </div>

      {/* Main content area - centered */}
      <div className={styles.homeMainContent}>
        <div className={styles.homeCardWrapper}>
          <div className={styles.sideLinksContainer}>
            {/* Side Links positioned relative to the card */}
            <SideLinks isMobile={isMobile} />

            {/* Main Card using 98.css window */}
            <div ref={cardWrapperRef} className={styles.cardZIndex}>
              <MainCard
                currentInterest={currentInterest}
                setCurrentInterest={setCurrentInterest}
                selectedInterests={selectedInterests}
                setSelectedInterests={setSelectedInterests}
                usersOnline={usersOnline}
                inputRef={inputRef}
                onStartChat={handleStartChat}
                onToggleSettings={handleToggleSettings}
                isNavigating={isNavigating}
                isMobile={isMobile}
                toast={toast}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Settings Panel - using 98.css window styling */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        position={panelPosition}
        setPanelPosition={setPanelPosition}
        cardWrapperRef={cardWrapperRef}
        currentTheme="theme-98" // Force Windows 98 theme
        isNavigating={isNavigating}
        isMobile={isMobile}
      />

      {/* Footer */}
      <Footer isMobile={isMobile} />

      {/* Profile Customizer Modal */}
      <ProfileCustomizer
        isOpen={isProfileCustomizerOpen}
        onClose={() => setIsProfileCustomizerOpen(false)}
      />
    </div>
  );
}