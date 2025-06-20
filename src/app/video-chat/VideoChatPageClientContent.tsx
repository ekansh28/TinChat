// src/app/video-chat/VideoChatPageClientContent.tsx - DEVELOPMENT MODE FIX
'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import HomeButton from '@/components/HomeButton';
import { TopBar } from '@/components/top-bar';
import { ProfilePopupProvider, ProfilePopup } from '@/components/ProfilePopup';

// Import text chat components for reuse
import ChatWindow from '../chat/components/ChatWindow';
// Video-specific components
import VideoControls from './components/VideoControls';
// Main consolidated hook
import { useVideoChat } from './hooks/useVideoChat';

// Display name animations CSS
const displayNameAnimationCSS = `
  .display-name-rainbow {
    background: linear-gradient(45deg, #ff0000, #ff8000, #ffff00, #80ff00, #00ff00, #00ff80, #00ffff, #0080ff, #0000ff, #8000ff, #ff00ff, #ff0080);
    background-size: 400% 400%;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: rainbow 3s ease-in-out infinite;
  }
  @keyframes rainbow {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  .display-name-gradient {
    background: linear-gradient(45deg, #667eea, #764ba2, #f093fb, #f5576c);
    background-size: 300% 300%;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: gradientShift 4s ease-in-out infinite;
  }
  @keyframes gradientShift {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }
  .display-name-pulse {
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.8; transform: scale(1.05); }
  }
  .display-name-glow {
    text-shadow: 0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor;
    animation: glow 2s ease-in-out infinite alternate;
  }
  @keyframes glow {
    from { text-shadow: 0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor; }
    to { text-shadow: 0 0 20px currentColor, 0 0 30px currentColor, 0 0 40px currentColor; }
  }
`;

// ✅ CRITICAL: Development mode stability wrapper
const DevModeStabilityWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isStable, setIsStable] = useState(false);
  const [stabilityCount, setStabilityCount] = useState(0);

  useEffect(() => {
    console.log('[DevModeStabilityWrapper] Mount detected, count:', stabilityCount + 1);
    
    // Track mount count
    setStabilityCount(prev => prev + 1);
    
    // Set stability timer
    const stabilityTimer = setTimeout(() => {
      console.log('[DevModeStabilityWrapper] Stability achieved');
      setIsStable(true);
    }, 1000); // 1 second stability period

    return () => {
      console.log('[DevModeStabilityWrapper] Unmount detected');
      clearTimeout(stabilityTimer);
      setIsStable(false);
    };
  }, []);

  // Show loading until stable to prevent rapid re-renders
  if (!isStable) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            Initializing video chat...
            {process.env.NODE_ENV === 'development' && (
              <span className="block text-xs text-gray-400 mt-1">
                Dev Mode: Waiting for stability (mount #{stabilityCount})
              </span>
            )}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const VideoChatPageClientContent: React.FC = () => {
  return (
    <DevModeStabilityWrapper>
      <VideoChatPageContent />
    </DevModeStabilityWrapper>
  );
};

const VideoChatPageContent: React.FC = () => {
  // ✅ All logic consolidated into one hook
  const {
    // Loading states
    isLoading,
    hasConnectionError,
    
    // Layout and theme
    isMobile,
    pinkThemeActive,
    effectivePageTheme,
    videoWindowStyle,
    chatWindowStyleAdjusted,
    
    // Chat state and data
    chatState,
    auth,
    mappedMessages,
    memoizedPartnerInfo,
    memoizedOwnInfo,
    
    // WebRTC state
    webrtc,
    
    // Socket state
    socket,
    
    // Actions
    chatActions,
    handleUsernameClick,
    
    // Debug info
    debugInfo
  } = useVideoChat();

  // ✅ LOADING SCREEN: Clean and simple with development info
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading video chat...</p>
          {process.env.NODE_ENV === 'development' && debugInfo && (
            <div className="mt-2 text-xs text-gray-400 space-y-1">
              <div>Session: {debugInfo.sessionId?.substring(0, 16)}...</div>
              <div>Mounts: {debugInfo.mountCount}, Search Attempts: {debugInfo.searchAttempts}</div>
              <div>Stable: {debugInfo.hasStabilityTimer ? 'No' : 'Yes'}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ✅ CONNECTION ERROR SCREEN: Clean error handling
  if (hasConnectionError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold mb-2">Connection Error</h2>
          <p className="text-gray-600 mb-4">{socket.connectionError}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Reload Page
          </button>
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 text-xs text-gray-400">
              <p>Development Mode - Check server is running on port 3001</p>
              <p>This error is common during development due to fast refresh</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ✅ CAMERA PERMISSION ERROR: Specific error for video chat
  if (webrtc.hasCameraPermission === false) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-yellow-500 text-6xl mb-4">📷</div>
          <h2 className="text-xl font-bold mb-2">Camera Access Required</h2>
          <p className="text-gray-600 mb-4">
            Video chat requires camera and microphone permissions. 
            Please enable them and refresh the page.
          </p>
          <div className="space-x-2">
            <button 
              onClick={() => webrtc.initializeCamera()}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Try Again
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ✅ MAIN VIDEO CHAT INTERFACE: Clean and modular
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: displayNameAnimationCSS }} />
      
      <ProfilePopupProvider>
        {/* Top Bar */}
        <div className="fixed top-0 right-0 z-50">
          <TopBar />
        </div>
        
        {!isMobile && <HomeButton />}
        
        <div className={cn(
          "video-chat-page-container flex flex-col items-center justify-center gap-4",
          isMobile ? "h-screen w-screen p-2 overflow-hidden" : "h-full p-4"
        )}>
          
          {/* ✅ VIDEO CONTROLS WINDOW: Reusable component */}
          <div className={cn(
            'window flex flex-col relative',
            pinkThemeActive && 'biscuit-frame'
          )} style={videoWindowStyle}>
            
            <div className={cn(
              "title-bar flex-shrink-0",
              isMobile && "text-sm h-8 min-h-8"
            )}>
              <div className="flex items-center justify-between w-full">
                <div className="title-bar-text">
                  Video Chat
                  {process.env.NODE_ENV === 'development' && debugInfo && (
                    <span className="ml-2 text-xs opacity-60">
                      (Dev: {debugInfo.searchAttempts} attempts)
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 flex justify-center items-center min-h-0 overflow-hidden p-2">
              <VideoControls
                localVideoRef={webrtc.localVideoRef}
                remoteVideoRef={webrtc.remoteVideoRef}
                hasCameraPermission={webrtc.hasCameraPermission}
                isFindingPartner={chatState.isFindingPartner}
                isPartnerConnected={chatState.isPartnerConnected}
                connectionError={socket.connectionError}
                theme={effectivePageTheme}
                isMobile={isMobile}
              />
            </div>
          </div>

          {/* ✅ CHAT WINDOW: Reusing the exact same component as text chat */}
          <div className={cn(
            'window flex flex-col relative',
            pinkThemeActive && 'biscuit-frame'
          )} style={chatWindowStyleAdjusted}>
            
            <div className={cn(
              "title-bar flex-shrink-0",
              isMobile && "text-sm h-8 min-h-8"
            )}>
              <div className="flex items-center justify-between w-full">
                <div className="title-bar-text">
                  Chat
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <ChatWindow
                messages={mappedMessages}
                onSendMessage={chatActions.handleSendMessage}
                inputValue={chatState.currentMessage}
                onInputChange={chatActions.handleInputChange}
                isPartnerTyping={chatState.isPartnerTyping}
                partnerStatus={chatState.partnerInfo?.status || 'offline'}
                partnerInfo={memoizedPartnerInfo}
                ownInfo={memoizedOwnInfo}
                isConnected={socket.isConnected}
                isPartnerConnected={chatState.isPartnerConnected}
                theme={effectivePageTheme}
                onUsernameClick={handleUsernameClick}
                isMobile={isMobile}
                isScrollEnabled={true}
                onFindOrDisconnect={chatActions.handleFindOrDisconnect}                findOrDisconnectDisabled={
                  !socket.isConnected || 
                  !!socket.connectionError || 
                  !webrtc.hasCameraPermission
                }
                findOrDisconnectText={
                  chatState.isPartnerConnected 
                    ? (isMobile ? 'Skip' : 'Skip') 
                    : chatState.isFindingPartner 
                      ? (isMobile ? 'Stop' : 'Stop') 
                      : (isMobile ? 'Find' : 'Find')
                }
              />
            </div>
          </div>

          {/* ✅ STATUS INDICATORS: Clean and informative */}
          {socket.connectionError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 text-sm rounded window">
              Connection Error: {socket.connectionError}
              {process.env.NODE_ENV === 'development' && (
                <div className="text-xs mt-1 opacity-75">
                  This is common in development mode. Check if server is running.
                </div>
              )}
            </div>
          )}          {!webrtc.hasCameraPermission && (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-3 py-2 text-sm rounded window">
              Camera access required for video chat. Please enable camera permissions.
            </div>
          )}

          {/* ✅ DEVELOPMENT MODE DEBUG INFO */}
          {process.env.NODE_ENV === 'development' && debugInfo && (
            <div className="bg-blue-100 border border-blue-400 text-blue-700 px-3 py-2 text-sm rounded window">
              <div className="text-xs font-mono space-y-1">
                <div>🔧 Dev Mode Active</div>
                <div>Session: {debugInfo.sessionId?.substring(0, 20)}...</div>
                <div>
                  Searches: {debugInfo.searchAttempts}, 
                  Started: {debugInfo.autoSearchStarted ? 'Yes' : 'No'}, 
                  Initialized: {debugInfo.isInitialized ? 'Yes' : 'No'}
                </div>
                <div>Mounts: {debugInfo.mountCount}, Stable: {debugInfo.hasStabilityTimer ? 'No' : 'Yes'}</div>
                {debugInfo.hasStabilityTimer && (
                  <div className="text-orange-600">⏳ Waiting for stability...</div>
                )}
              </div>
            </div>
          )}

          {/* ✅ WebRTC CONNECTION STATUS: For debugging */}
          {process.env.NODE_ENV === 'development' && webrtc.peerConnection && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-2 text-sm rounded window">
              <div className="text-xs font-mono">
                WebRTC: {webrtc.connectionState}
                {webrtc.connectionState === 'connected' && ' 🎥'}
                {webrtc.connectionState === 'connecting' && ' ⏳'}
                {webrtc.connectionState === 'failed' && ' ❌'}
              </div>
            </div>
          )}
        </div>

      </ProfilePopupProvider>
    </>
  );
};

export default VideoChatPageClientContent;