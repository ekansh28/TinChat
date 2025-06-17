// src/app/chat/ChatPageClientContent.tsx - COMPLETELY FIXED VERSION
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

// ✅ CRITICAL FIX: Styles for display name animations
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
  
  // ✅ CRITICAL FIX: Stable state management with refs for non-reactive data
  const [isScrollEnabled] = useState(true);
  const [isSelfDisconnectedRecently, setIsSelfDisconnectedRecently] = useState(false);
  const [isPartnerLeftRecently, setIsPartnerLeftRecently] = useState(false);
  const [partnerInterests, setPartnerInterests] = useState<string[]>([]);
  
  // ✅ CRITICAL FIX: Prevent multiple socket initializations
  const initializationRef = useRef<{
    isInitialized: boolean;
    autoSearchStarted: boolean;
    socketInitialized: boolean;
  }>({ 
    isInitialized: false, 
    autoSearchStarted: false,
    socketInitialized: false
  });

  // ✅ CRITICAL FIX: Stable interests memoization
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

  // ✅ CRITICAL FIX: Completely stable socket event handlers
  const socketHandlers = useMemo(() => {
    return {
      onMessage: (data: any) => {
        console.log('[ChatClient] Handling message:', data);
        
        // Update partner info if we have display data
        if (data.senderAuthId && (data.senderDisplayNameColor || data.senderDisplayNameAnimation)) {
          chatState.setPartnerInfo(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              displayNameColor: data.senderDisplayNameColor || prev.displayNameColor,
              displayNameAnimation: data.senderDisplayNameAnimation || prev.displayNameAnimation,
              rainbowSpeed: data.senderRainbowSpeed || prev.rainbowSpeed
            };
          });
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
      },

      onPartnerFound: (data: any) => {
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
          displayNameColor: data.partnerDisplayNameColor || '#667eea',
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
      },

      onPartnerLeft: () => {
        console.log('[ChatClient] Partner left');
        
        chatState.setIsPartnerConnected(false);
        chatState.setIsFindingPartner(false);
        chatState.setPartnerInfo(null);
        chatState.setIsPartnerTyping(false);
        setPartnerInterests([]);
        setIsPartnerLeftRecently(true);
        setIsSelfDisconnectedRecently(false);
      },

      onStatusChange: (status: string) => {
        chatState.setPartnerInfo(prev => 
          prev ? {...prev, status: status as any} : null
        );
      },

      onTypingStart: () => {
        chatState.setIsPartnerTyping(true);
      },

      onTypingStop: () => {
        chatState.setIsPartnerTyping(false);
      },

      onWaiting: () => {
        console.log('[ChatClient] Waiting for partner');
      },

      onCooldown: () => {
        console.log('[ChatClient] Find partner cooldown');
        chatState.setIsFindingPartner(false);
      },

      onDisconnectHandler: () => {
        console.log('[ChatClient] Socket disconnected');
        chatState.setIsPartnerConnected(false);
        chatState.setIsFindingPartner(false);
        chatState.setIsPartnerTyping(false);
        chatState.setPartnerInfo(null);
      },

      onConnectErrorHandler: () => {
        console.log('[ChatClient] Socket connection error');
        chatState.setIsFindingPartner(false);
      }
    };
  }, []); // ✅ EMPTY DEPS - handlers use current state via closure

  // ✅ CRITICAL FIX: Initialize socket with completely stable dependencies
  const socket = useChatSocket({
    ...socketHandlers,
    authId: auth.authId
  });

  // ✅ CRITICAL FIX: Prevent socket recreation by tracking initialization
  useEffect(() => {
    if (!initializationRef.current.socketInitialized && socket.socket) {
      initializationRef.current.socketInitialized = true;
      console.log('[ChatClient] Socket initialized for the first time');
    }
  }, [socket.socket]);

  // Use modular hooks for side effects
  useFaviconManager({
    isPartnerConnected: chatState.isPartnerConnected,
    isFindingPartner: chatState.isFindingPartner,
    connectionError: socket.connectionError,
    isSelfDisconnectedRecently,
    isPartnerLeftRecently
  });

  useSystemMessages({
    isPartnerConnected: chatState.isPartnerConnected,
    isFindingPartner: chatState.isFindingPartner,
    connectionError: socket.connectionError,
    isSelfDisconnectedRecently,
    isPartnerLeftRecently,
    partnerInterests,
    interests,
    messages: chatState.messages,
    setMessages: chatState.setMessages
  });

  // ✅ CRITICAL FIX: Stable chat actions with proper dependency injection
  const chatActions = useChatActions({
    isConnected: socket.isConnected,
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
    emitLeaveChat: socket.emitLeaveChat,
    emitFindPartner: socket.emitFindPartner,
    emitMessage: socket.emitMessage,
    emitTypingStart: socket.emitTypingStart,
    emitTypingStop: socket.emitTypingStop,
    setCurrentMessage: chatState.setCurrentMessage,
    interests,
    authId: auth.authId,
    username: auth.username
  });

  // ✅ CRITICAL FIX: Auto-search with strict one-time execution and proper conditions
  useEffect(() => {
    // Prevent multiple executions
    if (initializationRef.current.autoSearchStarted) {
      console.log('[ChatClient] Auto-search already started, skipping');
      return;
    }

    // More comprehensive conditions check
    const shouldStartSearch = 
      socket.isConnected && 
      !auth.isLoading && 
      !chatState.isPartnerConnected && 
      !chatState.isFindingPartner &&
      auth.authId !== undefined && // Wait for auth to be fully loaded
      !socket.connectionError &&
      !socket.isConnecting;

    if (!shouldStartSearch) {
      console.log('[ChatClient] Auto-search conditions not met:', {
        isConnected: socket.isConnected,
        authLoading: auth.isLoading,
        isPartnerConnected: chatState.isPartnerConnected,
        isFindingPartner: chatState.isFindingPartner,
        authId: auth.authId,
        connectionError: socket.connectionError,
        isConnecting: socket.isConnecting
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
    
    // Small delay to ensure state is updated
    const timeoutId = setTimeout(() => {
      const searchPayload = {
        chatType: 'text' as const,
        interests,
        authId: auth.authId
      };
      
      console.log('[ChatClient] Emitting findPartner with payload:', searchPayload);
      const success = socket.emitFindPartner(searchPayload);
      
      if (!success) {
        console.error('[ChatClient] Failed to emit findPartner');
        chatState.setIsFindingPartner(false);
        chatState.addSystemMessage('Failed to start partner search. Please try again.');
        initializationRef.current.autoSearchStarted = false;
      }
    }, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [
    socket.isConnected,
    socket.connectionError,
    socket.isConnecting,
    auth.isLoading,
    auth.authId,
    chatState.isPartnerConnected,
    chatState.isFindingPartner,
    interests
  ]); // ✅ Complete dependencies for proper triggering

  // ✅ CRITICAL FIX: Reset auto-search flag when relevant state changes
  useEffect(() => {
    if (chatState.isPartnerConnected || !socket.isConnected || socket.connectionError) {
      if (initializationRef.current.autoSearchStarted) {
        console.log('[ChatClient] Resetting auto-search flag due to state change');
        initializationRef.current.autoSearchStarted = false;
      }
    }
  }, [chatState.isPartnerConnected, socket.isConnected, socket.connectionError]);

  // ✅ CRITICAL FIX: Navigation cleanup - simplified and more reliable
  useEffect(() => {
    const handleRouteChange = () => {
      if (pathname === '/chat') {
        console.log('[ChatClient] Route change cleanup triggered');
        
        // Reset chat state
        chatState.resetChatState();
        setIsSelfDisconnectedRecently(false);
        setIsPartnerLeftRecently(false);
        setPartnerInterests([]);
        
        // Reset initialization flags
        initializationRef.current.autoSearchStarted = false;
      }
    };

    handleRouteChange();
  }, [pathname]); // ✅ Only pathname dependency

  // ✅ Mount effect - completely separate from other effects
  useEffect(() => { 
    console.log('[ChatClient] Component mounted');
    setIsMounted(true);
    
    // Mark component as initialized
    initializationRef.current.isInitialized = true;
    
    return () => {
      console.log('[ChatClient] Component unmounting');
      initializationRef.current.isInitialized = false;
    };
  }, []);

  // ✅ CRITICAL FIX: Stable username click handler
  const handleUsernameClick = useCallback((authId: string, clickPosition: { x: number; y: number }) => {
    console.log('[ChatClient] Username clicked:', authId, clickPosition);
  }, []);

  // ✅ Loading state with better UX
  if (!isMounted || auth.isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {auth.isLoading ? 'Loading authentication...' : 'Loading chat...'}
          </p>
        </div>
      </div>
    );
  }

  // ✅ Connection error state
  if (socket.connectionError && !socket.isConnected && !socket.isConnecting) {
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
        </div>
      </div>
    );
  }

  // ✅ CRITICAL FIX: Memoize expensive computations
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

  const memoizedOwnInfo = useMemo(() => ({
    username: auth.username || "You",
    authId: auth.authId,
    displayNameColor: auth.displayNameColor,
    displayNameAnimation: auth.displayNameAnimation
  }), [auth.username, auth.authId, auth.displayNameColor, auth.displayNameAnimation]);

  // ✅ Debug info for development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const debugInfo = {
        isConnected: socket.isConnected,
        isPartnerConnected: chatState.isPartnerConnected,
        isFindingPartner: chatState.isFindingPartner,
        authId: auth.authId,
        messageCount: chatState.messages.length,
        autoSearchStarted: initializationRef.current.autoSearchStarted,
        socketInitialized: initializationRef.current.socketInitialized
      };
      
      console.log('[ChatClient] Debug Info:', debugInfo);
      
      // Make debug info available globally for debugging
      (window as any).chatDebugInfo = debugInfo;
    }
  });

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
                
                {/* ✅ Connection status indicator */}
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    socket.isConnected ? "bg-green-500" : 
                    socket.isConnecting ? "bg-yellow-500 animate-pulse" : "bg-red-500"
                  )} />
                  {process.env.NODE_ENV === 'development' && (
                    <span className="text-xs">
                      {socket.isConnected ? 'Connected' : 
                       socket.isConnecting ? 'Connecting...' : 'Disconnected'}
                    </span>
                  )}
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
                isScrollEnabled={isScrollEnabled}
                onFindOrDisconnect={chatActions.handleFindOrDisconnect}
                findOrDisconnectDisabled={!socket.isConnected || !!socket.connectionError}
                findOrDisconnectText={
                  chatState.isPartnerConnected 
                    ? (isMobile ? 'Skip' : 'Skip') 
                    : chatState.isFindingPartner 
                      ? (isMobile ? 'Stop' : 'Stop') 
                      : (isMobile ? 'Find' : 'Find')
                }
              />
            </div>

            {/* ✅ Enhanced connection error display */}
            {socket.connectionError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 text-sm flex-shrink-0 flex items-center justify-between">
                <span>Connection Error: {socket.connectionError}</span>
                <button 
                  onClick={() => socket.forceReconnect()}
                  className="ml-2 px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                >
                  Retry
                </button>
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