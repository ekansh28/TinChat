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
  const [showAdPopup, setShowAdPopup] = useState(false);
  const [showAdPopup2, setShowAdPopup2] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const cardWrapperRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Custom hooks
  const { usersOnline } = useOnlineUsers();
  const onlineUsersData = useOnlineUsersData();
  const isMobile = useMobileDetection();
  const { currentTheme } = useTheme();

  // Sound functions
  const playClickSound = () => {
    try {
      const audio = new Audio('/sounds/click.wav');
      audio.volume = 0.3;
      audio.play().catch(err => console.log('Click sound failed:', err));
    } catch (err) {
      console.log('Click sound error:', err);
    }
  };

  const playDingSound = () => {
    try {
      const audio = new Audio('/sounds/ding.wav');
      audio.volume = 0.5;
      audio.play().catch(err => console.log('Ding sound failed:', err));
    } catch (err) {
      console.log('Ding sound error:', err);
    }
  };

  // Global click handler for homepage sounds
  const handleGlobalClick = (e: MouseEvent) => {
    playClickSound();
  };

  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  // Effect to show popup and play ding sound on page load
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isMobile) {
        setShowAdPopup(true);
        setShowAdPopup2(true);
        playDingSound();
      }
    }, 1000); // Show popup after 1 second

    return () => clearTimeout(timer);
  }, [isMobile]);

  // Effect to add global click listener
  useEffect(() => {
    document.addEventListener('click', handleGlobalClick);
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, []);

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
    {/* Sponsored Ad - Popup Window 1 */}
    {!isMobile && showAdPopup && (
      <div className="fixed top-20 right-4 z-10" id="ad-popup-window">
        <div className="window" style={{ width: 'auto', maxWidth: '400px' }}>
          <div className="title-bar">
            <div className="title-bar-text">Sponsored Ad</div>
            <div className="title-bar-controls">
              <button
                aria-label="Close"
                onClick={() => {
                  setShowAdPopup(false);
                }}
              ></button>
            </div>
          </div>
          <div className="window-body" style={{ padding: '0', overflow: 'hidden' }}>
            <div 
              style={{ width: 'auto', height: 'auto', minWidth: '300px', minHeight: '250px' }}
              dangerouslySetInnerHTML={{
                __html: `
                  <script type="text/javascript">
                    atOptions = {
                        'key' : '44ea4cf222b70f16c583d6278a35381b',
                        'format' : 'iframe',
                        'height' : 250,
                        'width' : 300,
                        'params' : {}
                    };
                  </script>
                  <script type="text/javascript" src="//www.highperformanceformat.com/44ea4cf222b70f16c583d6278a35381b/invoke.js"></script>
                `
              }}
            />
          </div>
        </div>
      </div>
    )}

    {/* Sponsored Ad - Popup Window 2 */}
    {!isMobile && showAdPopup2 && (
      <div className="fixed right-4 z-10" id="ad-popup-window-2" style={{ top: 'calc(80px + 290px + 20px)' }}>
        <div className="window" style={{ width: 'auto', maxWidth: '400px' }}>
          <div className="title-bar">
            <div className="title-bar-text">Sponsored Ad</div>
            <div className="title-bar-controls">
              <button
                aria-label="Close"
                onClick={() => {
                  setShowAdPopup2(false);
                }}
              ></button>
            </div>
          </div>
          <div className="window-body" style={{ padding: '0', overflow: 'hidden' }}>
            <div 
              style={{ width: 'auto', height: 'auto', minWidth: '300px', minHeight: '250px' }}
              dangerouslySetInnerHTML={{
                __html: `<script type='text/javascript' src='//pl27547376.revenuecpmgate.com/4c/a2/7d/4ca27d1d04ade519fca9bebebff1b4d9.js'></script>`
              }}
            />
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