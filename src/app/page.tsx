// src/app/page.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import pkg from '../../package.json';
import styles from '@/styles/page.module.css';
import dynamic from 'next/dynamic';

// Components
import Header from '@/components/home/Header';
import MainCard from '@/components/home/MainCard';
import SideLinks from '@/components/home/SideLinks';
import SettingsPanel from '@/components/home/SettingsPanel';
import Footer from '@/components/home/Footer';
import ProfileCustomizer from '@/components/ProfileCustomizer';

import GoogleAd from "@/components/googleAd"; 
// Hooks
import { useOnlineUsers } from '@/hooks/useOnlineUsers';
import { useOnlineUsersData } from '@/hooks/useOnlineUsersData';
import { useMobileDetection } from '@/hooks/useMobileDetection';
import { useTheme } from '@/components/theme-provider';

// Dynamically import Webamp with no SSR
const Webamp = dynamic(
  () => import('@/components/home/Webamp'),
  { 
    ssr: false,
    loading: () => null
  }
);

declare global {
  interface Window {
    stopOriginalOneko?: () => void;
    startOriginalOneko?: () => void;
    stopAnimatedGifCursor?: () => boolean;
    startAnimatedGifCursor?: (url: string) => boolean;
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
  const onlineUsersData = useOnlineUsersData();
  const isMobile = useMobileDetection();
  const { currentTheme } = useTheme();

  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  const handleStartChat = (type: 'text' | 'video') => {
    if (!router) {
      console.error("Router not available in handleStartChat.");
      toast({ 
        variant: "destructive",
        title: "Navigation Error", 
        description: "Could not initiate chat. Router not available."
      });
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
        variant: "destructive",
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

  const handleOpenProfileCustomizer = () => {
    setIsProfileCustomizerOpen(true);
  };

  const handleCloseProfileCustomizer = () => {
    setIsProfileCustomizerOpen(false);
  };

  return (
    <div className={styles.homePageContainer}>
      <div className={styles.homeHeader}>
        <Header 
          version={version} 
          isMobile={isMobile}
          onOpenProfileCustomizer={handleOpenProfileCustomizer}
        />
      </div>

      {/* Logo Section - Below Header - No layout space taken, lowest z-index */}
      <div className="absolute left-1/2 transform -translate-x-1/2 z-0" style={{ top: isMobile ? '60px' : '80px' }}>
        <img
          src="https://cdn.sekansh21.workers.dev/logo.png"
          alt="TinChat Logo"
          className="max-w-full h-auto"
          style={{
            maxHeight: isMobile ? '56px' : '84px', // 30% smaller than original
            width: 'auto',
            objectFit: 'contain'
          }}
          onError={(e) => {
            console.warn('Logo failed to load, hiding element');
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>

      {/* Webamp Container - Absolute positioned */}
      <div className={styles.webampContainer}>
        {!isMobile && <Webamp key="webamp-instance" />}
      </div>

      <div className={styles.homeMainContent}>
        
        <div className={styles.homeCardWrapper}>
          
          <div className={styles.sideLinksContainer}>
            
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
            
            <div className="mt-4">
              <SideLinks isMobile={isMobile} />
            </div>
          </div>
          
{/* Sponsored Ad - Right Side */}
{!isMobile && (
  <div className="fixed top-20 right-4 z-10" id="google-ad-window">
    <div className="window" style={{ width: 300 }}>
      <div className="title-bar">
        <div className="title-bar-text">Sponsored Ad</div>
        <div className="title-bar-controls">
          <button aria-label="Minimize"></button>
          <button aria-label="Maximize"></button>
          <button
            aria-label="Close"
            onClick={() => {
              const adWindow = document.getElementById("google-ad-window");
              if (adWindow) {
                adWindow.style.display = "none";
              }
            }}
          ></button>
        </div>
      </div>
      <div className="window-body">
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client="ca-pub-5670235631357216"
          data-ad-slot="9984806773"
          data-ad-format="auto"
          data-full-width-responsive="true"
        ></ins>
      </div>
    </div>
  </div>
)}
        </div>
      </div>

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        position={panelPosition}
        setPanelPosition={setPanelPosition}
        cardWrapperRef={cardWrapperRef}
        currentTheme={currentTheme}
        isNavigating={isNavigating}
        isMobile={isMobile}
      />

      <Footer isMobile={isMobile} />

      <ProfileCustomizer
        isOpen={isProfileCustomizerOpen}
        onClose={handleCloseProfileCustomizer}
      />
    </div>
  );
}