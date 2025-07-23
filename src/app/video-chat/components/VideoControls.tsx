// src/app/video-chat/components/VideoControls.tsx - NO TITLE BAR VERSION
import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface VideoControlsProps {
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
  hasCameraPermission: boolean | undefined;
  isFindingPartner: boolean;
  isPartnerConnected: boolean;
  connectionError: string | null;
  theme: string;
  isMobile: boolean;
}

const VideoControls: React.FC<VideoControlsProps> = ({
  localVideoRef,
  remoteVideoRef,
  hasCameraPermission,
  isFindingPartner,
  isPartnerConnected,
  connectionError,
  theme,
  isMobile
}) => {
  const [isWindows7Theme, setIsWindows7Theme] = useState(false);
  const [isWinXPTheme, setIsWinXPTheme] = useState(false);

  // Check for theme variations
  useEffect(() => {
    const checkThemes = () => {
      if (typeof window === 'undefined') return;
      
      const win7Link = document.getElementById('win7-css-link') as HTMLLinkElement;
      const hasWin7CSS = win7Link && win7Link.href.includes('7.css');
      
      const winXPLink = document.getElementById('winxp-css-link') as HTMLLinkElement;
      const hasWinXPCSS = winXPLink && winXPLink.href.includes('xp.css');
      
      setIsWindows7Theme(hasWin7CSS);
      setIsWinXPTheme(hasWinXPCSS);
    };
    
    checkThemes();
    
    const observer = new MutationObserver(checkThemes);
    observer.observe(document.head, {
      childList: true,
      subtree: true
    });
    
    return () => observer.disconnect();
  }, []);

  const videoSize = isMobile ? 
    { width: '140px', height: '105px' } : 
    { width: '280px', height: '210px' };

  const containerClass = cn(
    'flex gap-2 items-center justify-center w-full h-full',
    isMobile && 'flex-row'
  );

  // Simplified video container without window chrome
  const videoContainerClass = cn(
    'relative overflow-hidden border-2 bg-black',
    isWindows7Theme ? 'border-gray-400 rounded-sm shadow-lg' : 'border-gray-600',
    isWinXPTheme ? 'border-blue-500 rounded-sm' : '',
    theme === 'theme-98' && !isWindows7Theme && !isWinXPTheme ? 'border-gray-500' : ''
  );

  const videoElementClass = cn(
    "w-full h-full object-cover border-0",
    theme === 'theme-98' && "bg-black",
    isWindows7Theme && "rounded-sm",
    isWinXPTheme && "rounded-sm"
  );

  return (
    <div className={containerClass}>
      {/* Local Video (Your Camera) - No title bar */}
      <div className={videoContainerClass} style={videoSize}>
        <video 
          ref={localVideoRef} 
          autoPlay 
          muted 
          className={videoElementClass}
          data-ai-hint="local camera"
          playsInline
          style={{ backgroundColor: '#000' }}
        />
        
        {/* Local video label overlay */}
        <div className="absolute top-1 left-1 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
          You
        </div>
        
        {/* Camera permission states */}
        {hasCameraPermission === false && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-90">
            <div className="text-center p-2">
              <div className="text-red-400 text-xs mb-1">📷 ❌</div>
              <p className="text-white text-xs">Camera Denied</p>
            </div>
          </div>
        )}
        
        {hasCameraPermission === undefined && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-90">
            <div className="text-center p-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-auto mb-1"></div>
              <p className="text-white text-xs">Requesting camera...</p>
            </div>
          </div>
        )}
      </div>

      {/* Remote Video (Partner's Camera) - No title bar */}
      <div className={videoContainerClass} style={videoSize}>
        <video 
          ref={remoteVideoRef} 
          autoPlay 
          className={videoElementClass}
          data-ai-hint="remote camera"
          playsInline
          style={{ backgroundColor: '#000' }}
        />
        
        {/* Remote video label overlay */}
        <div className="absolute top-1 left-1 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
          Partner
        </div>
        
        {/* Partner connection states */}
        {isFindingPartner && !isPartnerConnected && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-90">
            <div className="text-center p-2">
              <div className="animate-pulse text-xs mb-1">🔍</div>
              <p className="text-white text-xs">Searching...</p>
            </div>
          </div>
        )}
        
        {!isFindingPartner && !isPartnerConnected && !connectionError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-90">
            <div className="text-center p-2">
              <div className="text-gray-400 text-xs mb-1">📺</div>
              <p className="text-white text-xs">Partner video</p>
            </div>
          </div>
        )}
        
        {connectionError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-90">
            <div className="text-center p-2">
              <div className="text-red-400 text-xs mb-1">⚠️</div>
              <p className="text-white text-xs">Connection error</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoControls;