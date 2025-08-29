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
  const [shouldHideWebamp, setShouldHideWebamp] = useState(false);

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

  // Effect to check window size and hide Webamp at 1240px width or less, or mobile
  useEffect(() => {
    const checkWindowSize = () => {
      const width = window.innerWidth;
      
      // Hide Webamp if window width is 1240px or less, or mobile
      const shouldHide = isMobile || width <= 1240;
      setShouldHideWebamp(shouldHide);
    };

    // Initial check
    checkWindowSize();

    // Add resize listener
    window.addEventListener('resize', checkWindowSize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', checkWindowSize);
    };
  }, [isMobile]);

  const handleStartChat = (type: 'text' | 'video') => {
    if (!router) {
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

{/* Logo Section - Below Header - Left aligned with subtle animation */}
{!isMobile && (
  <div className="absolute left-4 z-0" style={{ top: '80px' }}>
    <img
      src="https://cdn.tinchat.online/logo.png"
      alt="TinChat Logo"
      className="max-w-full h-auto"
      style={{
        maxHeight: '84px',
        width: 'auto',
        objectFit: 'contain',
        animation: 'subtleFloat 15s ease-in-out infinite',
        transformOrigin: 'center center'
      }}
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
    <style jsx>{`
      @keyframes subtleFloat {
        0% {
          transform: rotate(-1.5deg) scale(1.02);
        }
        50% {
          transform: rotate(1.5deg) scale(0.98);
        }
        100% {
          transform: rotate(-1.5deg) scale(1.02);
        }
      }
    `}</style>
  </div>
)}

      {/* Webamp Container - Absolute positioned */}
      <div className={styles.webampContainer}>
        {!shouldHideWebamp && <Webamp key="webamp-instance" />}
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
{/*
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
*/}
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