// src/app/video-chat/components/VideoControls.tsx
import React from 'react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
  const videoSize = isMobile ? { width: '160px', height: '120px' } : { width: '320px', height: '240px' };

  return (
    <>
      {/* Local Video (Your Camera) */}
      <div className={cn(
        'window flex flex-col m-2',
        theme === 'theme-7' ? 'glass' : ''
      )} style={videoSize}>
        <div className={cn(
          "title-bar text-sm video-feed-title-bar",
          theme === 'theme-98' ? '' : 'theme-7'
        )}>
          <div className="title-bar-text">You</div>
        </div>
        <div className={cn(
          'window-body flex-grow overflow-hidden relative p-0',
          theme === 'theme-7' && 'bg-white/30'
        )}>
          <video 
            ref={localVideoRef} 
            autoPlay 
            muted 
            className="w-full h-full object-cover bg-black" 
            data-ai-hint="local camera"
            playsInline
          />
          
          {hasCameraPermission === false && (
            <Alert variant="destructive" className="m-1 absolute bottom-0 left-0 right-0 text-xs p-1">
              <AlertTitle className="text-xs">Camera Denied</AlertTitle>
            </Alert>
          )}
          
          {hasCameraPermission === undefined && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
              <p className="text-white text-center p-2 text-sm">Requesting camera...</p>
            </div>
          )}
        </div>
      </div>

      {/* Remote Video (Partner's Camera) */}
      <div className={cn(
        'window flex flex-col m-2',
        theme === 'theme-7' ? 'glass' : ''
      )} style={videoSize}>
        <div className={cn(
          "title-bar text-sm video-feed-title-bar",
          theme === 'theme-98' ? '' : 'theme-7'
        )}>
          <div className="title-bar-text">Partner</div>
        </div>
        <div className={cn(
          'window-body flex-grow overflow-hidden relative p-0',
          theme === 'theme-7' && 'bg-white/30'
        )}>
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            className="w-full h-full object-cover bg-black" 
            data-ai-hint="remote camera"
            playsInline
          />
          
          {isFindingPartner && !isPartnerConnected && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
              <p className="text-white text-center p-2 text-sm">Searching for partner...</p>
            </div>
          )}
          
          {!isFindingPartner && !isPartnerConnected && !connectionError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
              <p className="text-white text-center p-2 text-sm">Partner video will appear here</p>
            </div>
          )}
          
          {connectionError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
              <p className="text-white text-center p-2 text-sm">Connection error</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default VideoControls;
