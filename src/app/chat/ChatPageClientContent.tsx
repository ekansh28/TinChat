// src/app/chat/ChatPageClientContent.tsx - ULTIMATE FIX VERSION
'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import HomeButton from '@/components/HomeButton';
import { TopBar } from '@/components/top-bar';
import { ProfilePopupProvider, ProfilePopup } from '@/components/ProfilePopup';

// Import modular components and hooks
import ChatWindow from './components/ChatWindow';
import { useChatSocket } from './hooks/useChatSocket';
import { useChatState } from './hooks/useChatState';
import { useAuth } from './hooks/useAuth';
import { useThemeDetection } from './hooks/useThemeDetection';
import { useViewport } from './hooks/useViewport';
import { useFaviconManager } from './hooks/useFaviconManager';
import { useSystemMessages } from './hooks/useSystemMessages';
import { useChatActions } from './hooks/useChatActions';
import { playSound } from '@/lib/utils';

// Styles for display name animations
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

const ChatPageClientContent: React.FC = () => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  
  // ✅ ULTIMATE FIX: Use refs to prevent state re-renders
  const [isScrollEnabled] = useState(true);
  const [isSelfDisconnectedRecently, setIsSelfDisconnectedRecently] = useState(false);
  const [isPartnerLeftRecently, setIsPartnerLeftRecently] = useState(false);
  const [partnerInterests, setPartnerInterests] = useState<string[]>([]);
  
  // ✅ ULTIMATE FIX: Prevent socket recreation with refs
  const initializationRef = useRef<{
    isInitialized: boolean;
    autoSearchStarted: boolean;
  }>({ isInitialized: false, autoSearchStarted: false });

  // ✅ ULTIMATE FIX: Memoize interests to prevent recreation
  const interests = useMemo(() => {
    const interestsParam = searchParams.get('interests');
    if (!interestsParam) return [];
    return interestsParam.split(',').filter(i => i.trim() !== '');
  }, [searchParams]);

  // Use modular hooks
  const auth = useAuth();
  const { pinkThemeActive, effectivePageTheme } = useThemeDetection(isMounted);
  const { isMobile, chatWindowStyle } = useViewport();
  const chatState = useChatState();

  // ✅ ULTIMATE FIX: Completely stable event handlers with useCallback and empty deps
  const handleMessage = useCallback((data: any) => {
    console.log('[ChatClient] Handling message:', data);
    
    chatState.setPartnerInfo(prev => {
      if (!prev) return prev;
      
      const shouldUpdate = data.senderAuthId && 
        (data.senderDisplayNameColor || data.senderDisplayNameAnimation);
      
      if (!shouldUpdate) return prev;
      
      return {
        ...prev,
        displayNameColor: data.senderDisplayNameColor || prev.displayNameColor,
        displayNameAnimation: data.senderDisplayNameAnimation || prev.displayNameAnimation,
        rainbowSpeed: data.senderRainbowSpeed || prev.rainbowSpeed
      };
    });
    
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
  }, []); // ✅ EMPTY DEPS - handlers access current values via closure

  const handlePartnerFound = useCallback((data: any) => {
    console.log('[ChatClient] Partner found:', data);
    
    try {
      playSound('Match.wav');
    } catch (error) {
      console.warn('[ChatClient] Failed to play sound:', error);
    }
    
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
  }, []); // ✅ EMPTY DEPS

  const handlePartnerLeft = useCallback(() => {
    console.log('[ChatClient] Partner left');
    
    chatState.setIsPartnerConnected(false);
    chatState.setIsFindingPartner(false);
    chatState.setPartnerInfo(null);
    chatState.setIsPartnerTyping(false);
    setPartnerInterests([]);
    setIsPartnerLeftRecently(true);
    setIsSelfDisconnectedRecently(false);
  }, []); // ✅ EMPTY DEPS

  const handleStatusChange = useCallback((status: string) => {
    chatState.setPartnerInfo(prev => prev ? {...prev, status: status as any} : null);
  }, []);

  const handleTypingStart = useCallback(() => {
    chatState.setIsPartnerTyping(true);
  }, []);

  const handleTypingStop = useCallback(() => {
    chatState.setIsPartnerTyping(false);
  }, []);

  const handleDisconnectHandler = useCallback(() => {
    console.log('[ChatClient] Socket disconnected');
    chatState.setIsPartnerConnected(false);
    chatState.setIsFindingPartner(false);
    chatState.setIsPartnerTyping(false);
    chatState.setPartnerInfo(null);
  }, []);

  const handleConnectErrorHandler = useCallback(() => {
    console.log('[ChatClient] Socket connection error');
    chatState.setIsFindingPartner(false);
  }, []);

  // ✅ ULTIMATE FIX: Single stable socket handler object
  const socketHandlers = useMemo(() => ({
    onMessage: handleMessage,
    onPartnerFound: handlePartnerFound,
    onPartnerLeft: handlePartnerLeft,
    onStatusChange: handleStatusChange,
    onTypingStart: handleTypingStart,
    onTypingStop: handleTypingStop,
    onWaiting: () => {},
    onCooldown: () => chatState.setIsFindingPartner(false),
    onDisconnectHandler: handleDisconnectHandler,
    onConnectErrorHandler: handleConnectErrorHandler,
  }), [
    handleMessage,
    handlePartnerFound,
    handlePartnerLeft,
    handleStatusChange,
    handleTypingStart,
    handleTypingStop,
    handleDisconnectHandler,
    handleConnectErrorHandler
  ]);

  // ✅ ULTIMATE FIX: Initialize socket with completely stable dependencies
  const {
    isConnected,
    connectionError,
    emitFindPartner,
    emitMessage,
    emitTypingStart,
    emitTypingStop,
    emitLeaveChat
  } = useChatSocket({
    ...socketHandlers,
    authId: auth.authId
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

  const { handleFindOrDisconnect, handleSendMessage, handleInputChange } = useChatActions({
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
    username: auth.username
  });

  // ✅ ULTIMATE FIX: Auto-search with strict one-time execution
  useEffect(() => {
    // Prevent multiple executions
    if (initializationRef.current.autoSearchStarted) {
      console.log('[ChatClient] Auto-search already started, skipping');
      return;
    }

    // Check if conditions are met for auto-search
    const shouldStartSearch = 
      isConnected && 
      !auth.isLoading && 
      !chatState.isPartnerConnected && 
      !chatState.isFindingPartner &&
      auth.authId !== undefined; // Wait for auth to be fully loaded

    if (!shouldStartSearch) {
      console.log('[ChatClient] Auto-search conditions not met:', {
        isConnected,
        authLoading: auth.isLoading,
        isPartnerConnected: chatState.isPartnerConnected,
        isFindingPartner: chatState.isFindingPartner,
        authId: auth.authId
      });
      return;
    }

    console.log('[ChatClient] Starting auto-search for partner');
    
    // Mark as started to prevent re-execution
    initializationRef.current.autoSearchStarted = true;
    
    chatState.setIsFindingPartner(true);
    chatState.addSystemMessage('Searching for a partner...');
    setIsSelfDisconnectedRecently(false);
    setIsPartnerLeftRecently(false);
    
    // Use setTimeout to ensure this runs after the current render cycle
    const timeoutId = setTimeout(() => {
      emitFindPartner({
        chatType: 'text',
        interests,
        authId: auth.authId
      });
    }, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [
    isConnected, 
    auth.isLoading, 
    auth.authId,
    chatState.isPartnerConnected,
    chatState.isFindingPartner,
    interests,
    emitFindPartner,
    chatState.setIsFindingPartner,
    chatState.addSystemMessage
  ]);

  // ✅ ULTIMATE FIX: Reset auto-search flag when partner state changes
  useEffect(() => {
    if (chatState.isPartnerConnected || !isConnected) {
      initializationRef.current.autoSearchStarted = false;
    }
  }, [chatState.isPartnerConnected, isConnected]);

  // ✅ ULTIMATE FIX: Navigation cleanup - simplified
  useEffect(() => {
    if (pathname === '/chat') {
      console.log('[ChatClient] Navigation cleanup triggered');
      
      // Reset everything
      chatState.setIsFindingPartner(false);
      chatState.setIsPartnerConnected(false);
      chatState.setMessages([]);
      chatState.setPartnerInfo(null);
      setIsSelfDisconnectedRecently(false);
      setIsPartnerLeftRecently(false);
      
      // Reset initialization flag
      initializationRef.current.autoSearchStarted = false;
    }
  }, [pathname]); // ✅ Only pathname dependency

  // ✅ Mount effect - completely separate
  useEffect(() => { 
    console.log('[ChatClient] Component mounted');
    setIsMounted(true); 
  }, []);

  // ✅ ULTIMATE FIX: Stable username click handler
  const handleUsernameClick = useCallback((authId: string, clickPosition: { x: number; y: number }) => {
    console.log('[ChatClient] Username clicked:', authId, clickPosition);
  }, []);

  if (!isMounted || auth.isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading chat...</p>
        </div>
      </div>
    );
  }

  // ✅ ULTIMATE FIX: Memoize message mapping to prevent recreation
  const mappedMessages = useMemo(() => {
    return chatState.messages.map(msg => ({
      id: msg.id,
      content: msg.text,
      sender: msg.sender === 'me' ? 'self' : msg.sender,
      timestamp: msg.timestamp?.getTime(),
      senderUsername: msg.senderUsername,
      senderAuthId: msg.senderAuthId,
      senderDisplayNameColor: msg.senderDisplayNameColor,
      senderDisplayNameAnimation: msg.senderDisplayNameAnimation,
      senderRainbowSpeed: msg.senderRainbowSpeed
    }));
  }, [chatState.messages]);

  // ✅ ULTIMATE FIX: Memoize partner info to prevent recreation
  const memoizedPartnerInfo = useMemo(() => {
    if (!chatState.partnerInfo) return undefined;
    
    return {
      username: chatState.partnerInfo.username,
      displayName: chatState.partnerInfo.displayName,
      avatar: chatState.partnerInfo.avatarUrl || '/default-avatar.png',
      displayNameColor: chatState.partnerInfo.displayNameColor,
      displayNameAnimation: chatState.partnerInfo.displayNameAnimation,
      rainbowSpeed: chatState.partnerInfo.rainbowSpeed,
      authId: chatState.partnerInfo.authId
    };
  }, [chatState.partnerInfo]);

  // ✅ ULTIMATE FIX: Memoize own info to prevent recreation
  const memoizedOwnInfo = useMemo(() => ({
    username: auth.username || "You",
    authId: auth.authId,
    displayNameColor: auth.displayNameColor,
    displayNameAnimation: auth.displayNameAnimation
  }), [auth.username, auth.authId, auth.displayNameColor, auth.displayNameAnimation]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: displayNameAnimationCSS }} />
      
      <ProfilePopupProvider>
        <div className="fixed top-0 right-0 z-50">
          <TopBar />
        </div>
        
        {!isMobile && <HomeButton />}
        
        <div className={cn(
          "chat-page-container flex flex-col items-center justify-center",
          isMobile ? "h-screen w-screen p-0 overflow-hidden" : "h-full p-4"
        )}>
          <div className={cn(
            'window flex flex-col relative',
            pinkThemeActive && 'biscuit-frame',
            isMobile ? 'h-full w-full overflow-hidden' : ''
          )} style={chatWindowStyle}>
            
            <div className={cn(
              "title-bar flex-shrink-0",
              isMobile && "text-sm h-8 min-h-8"
            )}>
              <div className="flex items-center justify-between w-full">
                <div className="title-bar-text">
                  {isMobile ? 'TinChat' : 'Text Chat'}
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <ChatWindow
                messages={mappedMessages}
                onSendMessage={handleSendMessage}
                inputValue={chatState.currentMessage}
                onInputChange={handleInputChange}
                isPartnerTyping={chatState.isPartnerTyping}
                partnerStatus={chatState.partnerInfo?.status || 'offline'}
                partnerInfo={memoizedPartnerInfo}
                ownInfo={memoizedOwnInfo}
                isConnected={isConnected}
                isPartnerConnected={chatState.isPartnerConnected}
                theme={effectivePageTheme}
                onUsernameClick={handleUsernameClick}
                isMobile={isMobile}
                isScrollEnabled={isScrollEnabled}
                onFindOrDisconnect={handleFindOrDisconnect}
                findOrDisconnectDisabled={!isConnected || !!connectionError}
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
          </div>
        </div>

        <ProfilePopup />
      </ProfilePopupProvider>
    </>
  );
};

export default ChatPageClientContent;