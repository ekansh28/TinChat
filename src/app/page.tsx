// src/app/page.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/components/theme-provider';
import pkg from '../../package.json';

// Import modular components
import Header from '@/components/home/Header';
import MainCard from '@/components/home/MainCard';
import SideLinks from '@/components/home/SideLinks';
import SettingsPanel from '@/components/home/SettingsPanel';
import Footer from '@/components/home/Footer';
import { ProfileCustomizer } from '@/components/ProfileCustomizer';
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
  const { currentTheme } = useTheme();

  // Custom hooks
  const usersOnline = useOnlineUsers();
  const isMobile = useMobileDetection();

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
    <div className={cn(
      "flex flex-1 flex-col relative min-h-screen",
      isMobile ? "px-3 pt-3 pb-safe" : "px-4 pt-4"
    )}>
      <Header 
        version={version} 
        isMobile={isMobile}
        onOpenProfileCustomizer={() => setIsProfileCustomizerOpen(true)}
      />

      <div className={cn(
        "flex-grow flex items-center justify-center",
        isMobile ? "min-h-[calc(100vh-2rem)] py-4" : "min-h-screen"
      )}>
        <div className={cn(
          "flex flex-col items-center w-full relative",
          isMobile ? "space-y-4" : "space-y-6"
        )}>
          <SideLinks isMobile={isMobile} />

          <div ref={cardWrapperRef} className={cn(
            "relative z-10 w-full",
            isMobile ? "max-w-sm px-1" : "max-w-md"
          )}>
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

      {/* Profile Customizer Modal */}
      <ProfileCustomizer
        isOpen={isProfileCustomizerOpen}
        onClose={() => setIsProfileCustomizerOpen(false)}
      />
    </div>
  );
}