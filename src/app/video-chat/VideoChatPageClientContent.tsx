// src/app/video-chat/VideoChatPageClientContent.tsx - Enhanced modular version
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import HomeButton from '@/components/HomeButton';
import { TopBar } from '@/components/top-bar';
import { ProfilePopupProvider, ProfilePopup } from '@/components/ProfilePopup';

// Import modular components and hooks
import VideoChatWindow from './components/VideoChatWindow';
import VideoControls from './components/VideoControls';
import { useVideoChatSocket, useVideoChatState } from './hooks/useVideoChatSocket';
import { useAuth } from '../chat/hooks/useAuth';
import { useThemeDetection } from '../chat/hooks/useThemeDetection';
import { useViewport } from '../chat/hooks/useViewport';
import { useFaviconManager } from '../chat/hooks/useFaviconManager';
import { useSystemMessages } from '../chat/hooks/useSystemMessages';
import { useVideoChatActions } from './hooks/useVideoChatActions';
import { useWebRTC } from './hooks/useWebRTC';
import { playSound } from '@/lib/utils';

// Styles for display name animations (reuse from text chat)
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

const VideoChatPageClientContent: React.FC = () => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  
  // Additional video chat state
  const [isSelfDisconnectedRecently, setIsSelfDisconnectedRecently] = useState(false);
  const [isPartnerLeftRecently, setIsPartnerLeftRecently] = useState(false);
  const [partnerInterests, setPartnerInterests] = useState<string[]>([]);

  const interests = useMemo(() => 
    searchParams.get('interests')?.split(',').filter(i => i.trim() !== '') || [], 
    [searchParams]
  );

  // Use modular hooks
  const auth = useAuth();
  const { pinkThemeActive, effectivePageTheme } = useThemeDetection(isMounted);
  const { isMobile, chatWindowStyle } = useViewport();
  const chatState = useVideoChatState();

  // WebRTC hook for video functionality
  const {
    localVideoRef,
    remoteVideoRef,
    localStream,
    peerConnection,
    hasCameraPermission,
    initializeCamera,
    cleanupConnections,
    setupPeerConnection
  } = useWebRTC();

  // Socket event handlers
  const handleMessage = (data: any) => {
    if (data.senderAuthId && (data.senderDisplayNameColor || data.senderDisplayNameAnimation)) {
      chatState.setPartnerInfo(prev => prev ? {
        ...prev,
        displayNameColor: data.senderDisplayNameColor || prev.displayNameColor,
        displayNameAnimation: data.senderDisplayNameAnimation || prev.displayNameAnimation,
        rainbowSpeed: data.senderRainbowSpeed || prev.rainbowSpeed
      } : null);
    }
    
    chatState.addMessage({
      text: data.message,
      sender: 'partner',
      senderUsername: data.senderUsername,
      senderAuthId: data.senderAuthId,
      senderDisplayNameColor: data.senderDisplayNameColor,
      senderDisplayNameAnimation: data.senderDisplayNameAnimation,
      senderRainbowSpeed: data.senderRainbowSpeed
    });
    chatState.setIsPartnerTyping(false);
  };

  const handlePartnerFound = async (data: any) => {
    playSound('Match.wav');
    
    // Set partner info
    chatState.setPartnerInfo({
      id: data.partnerId,
      username: data.partnerUsername || 'Stranger',
      displayName: data.partnerDisplayName,
      avatarUrl: data.partnerAvatarUrl,
      bannerUrl: data.partnerBannerUrl,
      pronouns: data.partnerPronouns,
      status: data.partnerStatus || 'online',
      displayNameColor: data.partnerDisplayNameColor || '#ff0000',
      displayNameAnimation: data.partnerDisplayNameAnimation || 'none',
      rainbowSpeed: data.partnerRainbowSpeed || 3,
      authId: data.partnerAuthId,
      badges: data.partnerBadges || []
    });
    
    setPartnerInterests(data.interests || []);
    chatState.setIsFindingPartner(false);
    chatState.setIsPartnerConnected(true);
    setIsSelfDisconnectedRecently(false);
    setIsPartnerLeftRecently(false);
    chatState.setMessages([]);

    // Setup WebRTC connection as initiator
    if (localStream && isMounted) {
      await setupPeerConnection(data.roomId, true);
    }
  };

  const handlePartnerLeft = () => {
    chatState.setIsPartnerConnected(false);
    chatState.setIsFindingPartner(false);
    chatState.setPartnerInfo(null);
    chatState.setIsPartnerTyping(false);
    setPartnerInterests([]);
    setIsPartnerLeftRecently(true);
    setIsSelfDisconnectedRecently(false);
    
    // Clean up WebRTC connections but keep local stream
    cleanupConnections(false);
  };

  const handleWebRTCSignal = async (signalData: any) => {
    if (peerConnection && chatState.roomId) {
      try {
        if (signalData.candidate) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(signalData.candidate));
        } else if (signalData.type === 'offer') {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(signalData));
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          // Emit answer back through socket
          emitWebRTCSignal({ roomId: chatState.roomId, signalData: answer });
        } else if (signalData.type === 'answer') {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(signalData));
        }
      } catch (error) {
        console.error('WebRTC signal handling error:', error);
      }
    }
  };

  // Initialize socket
  const {
    isConnected,
    connectionError,
    emitFindPartner,
    emitMessage,
    emitTypingStart,
    emitTypingStop,
    emitLeaveChat,
    emitWebRTCSignal
  } = useVideoChatSocket({
    onMessage: handleMessage,
    onPartnerFound: handlePartnerFound,
    onPartnerLeft: handlePartnerLeft,
    onStatusChange: (status) => chatState.setPartnerInfo(prev => prev ? {...prev, status: status as any} : null),
    onTypingStart: () => chatState.setIsPartnerTyping(true),
    onTypingStop: () => chatState.setIsPartnerTyping(false),
    onWebRTCSignal: handleWebRTCSignal,
    onWaiting: () => {},
    onCooldown: () => chatState.setIsFindingPartner(false),
    onDisconnectHandler: () => {
      chatState.setIsPartnerConnected(false);
      chatState.setIsFindingPartner(false);
      chatState.setIsPartnerTyping(false);
      chatState.setPartnerInfo(null);
      cleanupConnections(false);
    },
    onConnectErrorHandler: () => chatState.setIsFindingPartner(false),
    authId: auth.authId,
    roomId: chatState.roomId,
    setRoomId: chatState.setRoomId
  });

  // Use modular hooks for side effects
  useFaviconManager({
    isPartnerConnected: chatState.isPartnerConnected,
    isFindingPartner: chatState.isFindingPartner,
    connectionError,
    isSelfDisconnectedRecently,
    isPartnerLeftRecently
  });

  useSystemMessages({
    isPartnerConnected: chatState.isPartnerConnected,
    isFindingPartner: chatState.isFindingPartner,
    connectionError,
    isSelfDisconnectedRecently,
    isPartnerLeftRecently,
    partnerInterests,
    interests,
    messages: chatState.messages,
    setMessages: chatState.setMessages
  });

  const { handleFindOrDisconnect, handleSendMessage, handleInputChange } = useVideoChatActions({
    isConnected,
    isPartnerConnected: chatState.isPartnerConnected,
    isFindingPartner: chatState.isFindingPartner,
    setIsFindingPartner: chatState.setIsFindingPartner,
    setIsPartnerConnected: chatState.setIsPartnerConnected,
    setPartnerInfo: chatState.setPartnerInfo,
    setIsPartnerTyping: chatState.setIsPartnerTyping,
    setPartnerInterests,
    setIsSelfDisconnectedRecently,
    setIsPartnerLeftRecently,
    addMessage: chatState.addMessage,
    addSystemMessage: chatState.addSystemMessage,
    emitLeaveChat,
    emitFindPartner,
    emitMessage,
    emitTypingStart,
    emitTypingStop,
    setCurrentMessage: chatState.setCurrentMessage,
    interests,
    authId: auth.authId,
    username: auth.username,
    hasCameraPermission,
    initializeCamera,
    cleanupConnections,
    setupPeerConnection: (roomId: string) => setupPeerConnection(roomId, true)
  });

  // Auto-search for partner when connected and camera is ready
  useEffect(() => {
    if (isConnected && !auth.isLoading && !chatState.isPartnerConnected && !chatState.isFindingPartner && hasCameraPermission !== undefined) {
      if (hasCameraPermission === false) {
        chatState.addSystemMessage('Camera access required for video chat.');
        return;
      }
      
      if (!localStream) {
        initializeCamera().then((stream) => {
          if (stream) {
            chatState.setIsFindingPartner(true);
            chatState.addSystemMessage('Searching for a video chat partner...');
            setIsSelfDisconnectedRecently(false);
            setIsPartnerLeftRecently(false);
            
            emitFindPartner({
              chatType: 'video',
              interests,
              authId: auth.authId
            });
          }
        });
      } else {
        chatState.setIsFindingPartner(true);
        chatState.addSystemMessage('Searching for a video chat partner...');
        setIsSelfDisconnectedRecently(false);
        setIsPartnerLeftRecently(false);
        
        emitFindPartner({
          chatType: 'video',
          interests,
          authId: auth.authId
        });
      }
    }
  }, [isConnected, auth.isLoading, chatState.isPartnerConnected, chatState.isFindingPartner, interests, auth.authId, emitFindPartner, hasCameraPermission, localStream, initializeCamera, chatState.setIsFindingPartner, chatState.addSystemMessage]);

  // Navigation cleanup effect
  useEffect(() => {
    if (pathname === '/video-chat') {
      chatState.setIsFindingPartner(false);
      chatState.setIsPartnerConnected(false);
      chatState.setMessages([]);
      chatState.setPartnerInfo(null);
      setIsSelfDisconnectedRecently(false);
      setIsPartnerLeftRecently(false);
    }
  }, [pathname, chatState]);

  // Initialize camera on mount
  useEffect(() => {
    setIsMounted(true);
    if (hasCameraPermission === undefined) {
      initializeCamera();
    }
  }, [initializeCamera, hasCameraPermission]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupConnections(true);
    };
  }, [cleanupConnections]);

  if (!isMounted || auth.isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading video chat...</p>
        </div>
      </div>
    );
  }

  const handleUsernameClick = (authId: string, clickPosition: { x: number; y: number }) => {
    console.log('Username clicked for authId:', authId, clickPosition);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: displayNameAnimationCSS }} />
      
      <ProfilePopupProvider>
        <div className="fixed top-0 right-0 z-50">
          <TopBar />
        </div>
        
        {!isMobile && <HomeButton />}
        
        <div className={cn(
          "video-chat-page-container flex flex-col items-center justify-center",
          isMobile ? "h-screen w-screen p-0 overflow-hidden" : "h-full p-4"
        )}>
          {/* Video Feeds */}
          <div className="flex justify-center gap-4 mb-4 mx-auto">
            <VideoControls
              localVideoRef={localVideoRef}
              remoteVideoRef={remoteVideoRef}
              hasCameraPermission={hasCameraPermission}
              isFindingPartner={chatState.isFindingPartner}
              isPartnerConnected={chatState.isPartnerConnected}
              connectionError={connectionError}
              theme={effectivePageTheme}
              isMobile={isMobile}
            />
          </div>

          {/* Chat Window */}
          <div className={cn(
            'window flex flex-col relative',
            pinkThemeActive && 'biscuit-frame',
            isMobile ? 'h-full w-full overflow-hidden' : ''
          )} style={isMobile ? { 
            width: '100vw', 
            height: '300px',
            maxWidth: '100vw',
            maxHeight: '300px'
          } : { 
            width: '600px', 
            height: '300px',
            minHeight: '300px',
            maxHeight: '300px'
          }}>
            
            <div className={cn(
              "title-bar flex-shrink-0",
              isMobile && "text-sm h-8 min-h-8"
            )}>
              <div className="flex items-center justify-between w-full">
                <div className="title-bar-text">
                  {isMobile ? 'Video Chat' : 'Video Chat'}
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <VideoChatWindow
                messages={chatState.messages.map(msg => ({
                  id: msg.id,
                  content: msg.text,
                  sender: msg.sender === 'me' ? 'self' : msg.sender,
                  timestamp: msg.timestamp?.getTime(),
                  senderUsername: msg.senderUsername,
                  senderAuthId: msg.senderAuthId,
                  senderDisplayNameColor: msg.senderDisplayNameColor,
                  senderDisplayNameAnimation: msg.senderDisplayNameAnimation,
                  senderRainbowSpeed: msg.senderRainbowSpeed
                }))}
                onSendMessage={handleSendMessage}
                inputValue={chatState.currentMessage}
                onInputChange={handleInputChange}
                isPartnerTyping={chatState.isPartnerTyping}
                partnerStatus={chatState.partnerInfo?.status || 'offline'}
                partnerInfo={chatState.partnerInfo ? {
                  username: chatState.partnerInfo.username,
                  displayName: chatState.partnerInfo.displayName,
                  avatar: chatState.partnerInfo.avatarUrl || '/default-avatar.png',
                  displayNameColor: chatState.partnerInfo.displayNameColor,
                  displayNameAnimation: chatState.partnerInfo.displayNameAnimation,
                  rainbowSpeed: chatState.partnerInfo.rainbowSpeed,
                  authId: chatState.partnerInfo.authId
                } : undefined}
                ownInfo={{
                  username: auth.username || "You",
                  authId: auth.authId,
                  displayNameColor: auth.displayNameColor,
                  displayNameAnimation: auth.displayNameAnimation
                }}
                isConnected={isConnected}
                isPartnerConnected={chatState.isPartnerConnected}
                theme={effectivePageTheme}
                onUsernameClick={handleUsernameClick}
                isMobile={isMobile}
                onFindOrDisconnect={handleFindOrDisconnect}
                findOrDisconnectDisabled={!isConnected || !!connectionError || hasCameraPermission === false}
                findOrDisconnectText={
                  chatState.isPartnerConnected 
                    ? (isMobile ? 'Skip' : 'Skip') 
                    : chatState.isFindingPartner 
                      ? (isMobile ? 'Stop' : 'Stop') 
                      : (isMobile ? 'Find' : 'Find')
                }
              />
            </div>

            {connectionError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 text-sm flex-shrink-0">
                Connection Error: {connectionError}
              </div>
            )}

            {hasCameraPermission === false && (
              <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-3 py-2 text-sm flex-shrink-0">
                Camera access required for video chat. Please enable camera permissions.
              </div>
            )}
          </div>
        </div>

        <ProfilePopup />
      </ProfilePopupProvider>
    </>
  );
};

export default VideoChatPageClientContent;