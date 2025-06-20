// src/app/chat/ChatPageClientContent.tsx - WITH AUDIO INITIALIZATION

'use client';

import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';
import HomeButton from '@/components/HomeButton';
import { TopBar } from '@/components/top-bar';
import { ProfilePopupProvider, ProfilePopup } from '@/components/ProfilePopup';
import ChatWindow from './components/ChatWindow';
import { TaskBar } from './components/TaskBar';
import { useChat } from './hooks/useChat';
import { LoadingScreen } from './components/LoadingScreen';
import { ConnectionErrorScreen } from './components/ConnectionErrorScreen';
import { ConnectionStatus } from './components/ConnectionStatus';
import { initializeAudioSystem } from './utils/ChatHelpers'; // ✅ NEW: Import audio initializer

// ✅ FIXED: Styles moved to separate component/file to avoid re-creating
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
  // ✅ FIXED: Single hook call with consistent order, no conditional hooks
  const chat = useChat();

  // ✅ NEW: Initialize audio system on mount
  useEffect(() => {
    if (chat.isMounted) {
      try {
        initializeAudioSystem();
        console.log('[ChatPageClientContent] Audio system initialized');
      } catch (error) {
        console.warn('[ChatPageClientContent] Failed to initialize audio system:', error);
      }
    }
  }, [chat.isMounted]);

  // ✅ CRITICAL FIX: Better loading state detection
  const isActuallyLoading = !chat.isMounted || 
                           chat.auth.isLoading || 
                           (chat.socket.isConnecting && !chat.socket.isConnected);

  // ✅ CRITICAL FIX: Better connection error detection
  const hasActualConnectionError = !!chat.socket.connectionError && 
                                  !chat.socket.isConnected && 
                                  !chat.socket.isConnecting;

  console.log('[ChatPageClientContent] Render state:', {
    isMounted: chat.isMounted,
    authLoading: chat.auth.isLoading,
    socketConnected: chat.socket.isConnected,
    socketConnecting: chat.socket.isConnecting,
    socketError: chat.socket.connectionError,
    isActuallyLoading,
    hasActualConnectionError
  });

  // ✅ FIXED: Early returns AFTER all hooks are called
  if (isActuallyLoading) {
    return <LoadingScreen auth={chat.auth} />;
  }

  if (hasActualConnectionError) {
    return <ConnectionErrorScreen 
      error={chat.socket.connectionError} 
      onRetry={() => window.location.reload()} 
    />;
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: displayNameAnimationCSS }} />
      
      <ProfilePopupProvider>
        <div className="fixed top-0 right-0 z-50">
          <TopBar />
        </div>
        
        {!chat.isMobile && <HomeButton />}
        
        <div className={cn(
          "chat-page-container flex flex-col items-center justify-center",
          chat.isMobile ? "h-screen w-screen p-0 overflow-hidden" : "h-full p-4"
        )} style={{
          // ✅ UPDATED: Only add taskbar padding on desktop (mobile has no taskbar)
          paddingBottom: chat.isMobile ? '0px' : '50px' // No taskbar on mobile
        }}>
          <div className={cn(
            'window flex flex-col relative',
            chat.pinkThemeActive && 'biscuit-frame',
            chat.isMobile ? 'h-full w-full overflow-hidden' : ''
          )} style={{
            ...chat.chatWindowStyle,
            // ✅ UPDATED: No height adjustment needed on mobile (no taskbar)
            ...(chat.isMobile && {
              height: '100vh', // Full height on mobile
              maxHeight: '100vh'
            })
          }}>
            
            <div className={cn(
              "title-bar flex-shrink-0",
              chat.isMobile && "text-sm h-8 min-h-8"
            )}>
              <div className="flex items-center justify-between w-full">
                <div className="title-bar-text">
                  {chat.isMobile ? 'TinChat' : 'Text Chat'}
                </div>
                
                <ConnectionStatus 
                  isConnected={chat.socket.isConnected}
                  isConnecting={chat.socket.isConnecting}
                  isDevelopment={process.env.NODE_ENV === 'development'}
                />
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <ChatWindow
                messages={chat.mappedMessages || []} // ✅ SAFETY: Ensure messages is always an array
                onSendMessage={chat.chatActions.handleSendMessage}
                inputValue={chat.chatState.currentMessage || ''} // ✅ SAFETY: Ensure string
                onInputChange={chat.chatActions.handleInputChange}
                isPartnerTyping={chat.chatState.isPartnerTyping || false} // ✅ SAFETY: Ensure boolean
                partnerStatus={chat.chatState.partnerInfo?.status || 'offline'}
                partnerInfo={chat.memoizedPartnerInfo}
                ownInfo={chat.memoizedOwnInfo}
                isConnected={chat.socket.isConnected || false} // ✅ SAFETY: Ensure boolean
                isPartnerConnected={chat.chatState.isPartnerConnected || false} // ✅ SAFETY: Ensure boolean
                theme={chat.effectivePageTheme}
                onUsernameClick={chat.handleUsernameClick}
                isMobile={chat.isMobile}
                isScrollEnabled={chat.isScrollEnabled}
                onFindOrDisconnect={chat.chatActions.handleFindOrDisconnect}
                findOrDisconnectDisabled={!chat.socket.isConnected || !!chat.socket.connectionError}
                findOrDisconnectText={
                  chat.chatState.isPartnerConnected 
                    ? (chat.isMobile ? 'Skip' : 'Skip') 
                    : chat.chatState.isFindingPartner 
                      ? (chat.isMobile ? 'Stop' : 'Stop') 
                      : (chat.isMobile ? 'Find' : 'Find')
                }
              />
            </div>

            {/* ✅ Enhanced connection error display */}
            {chat.socket.connectionError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 text-sm flex-shrink-0 flex items-center justify-between">
                <span>Connection Error: {chat.socket.connectionError}</span>
                <button 
                  onClick={() => chat.socket.forceReconnect()}
                  className="ml-2 px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        </div>

        <ProfilePopup />
        
        {/* ✅ TaskBar with audio controls */}
        <TaskBar />
      </ProfilePopupProvider>
    </>
  );
};

export default ChatPageClientContent;