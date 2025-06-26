// src/app/chat/ChatPageClientContent.tsx - FIXED TO WORK WITH UPDATED HOOKS

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
import { initializeAudioSystem } from './utils/ChatHelpers';

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

  // ✅ Initialize audio system on mount
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

  console.log('[ChatPageClientContent] Render state:', {
    isMounted: chat.isMounted,
    authLoading: chat.auth.isLoading,
    socketConnected: chat.socket.isConnected,
    socketConnecting: chat.socket.isConnecting,
    socketError: chat.socket.connectionError,
    isLoading: chat.isLoading,
    hasConnectionError: chat.hasConnectionError,
    wasSkippedByPartner: chat.wasSkippedByPartner,
    didSkipPartner: chat.didSkipPartner,
    isPartnerConnected: chat.chatState.isPartnerConnected,
    isFindingPartner: chat.chatState.isFindingPartner
  });

  // ✅ FIXED: Use the computed loading and error states from useChat
  if (chat.isLoading) {
    return <LoadingScreen auth={chat.auth} />;
  }

  if (chat.hasConnectionError) {
    return <ConnectionErrorScreen 
      error={chat.socket.connectionError} 
      onRetry={chat.socket.forceReconnect}
    />;
  }

  // ✅ FIXED: Enhanced button text logic based on actual state
  const getButtonText = () => {
    if (chat.chatState.isPartnerConnected) {
      return chat.isMobile ? 'Skip' : 'Skip Partner';
    } else if (chat.chatState.isFindingPartner) {
      return chat.isMobile ? 'Stop' : 'Stop Search';
    } else if (chat.wasSkippedByPartner) {
      return chat.isMobile ? 'Find' : 'Find Partner';
    } else {
      return chat.isMobile ? 'Find' : 'New Chat';
    }
  };

  // ✅ FIXED: Better button disabled state
  const isButtonDisabled = !chat.socket.isConnected || !!chat.socket.connectionError;

  // ✅ FIXED: Enhanced button action handler
  const handleFindOrDisconnect = () => {
    if (isButtonDisabled) return;
    
    // Use the chatActions method which handles all the logic
    chat.chatActions.handleFindOrDisconnect();
  };

  const handleSendMessage = (message: string) => {
    chat.chatActions.handleSendMessage(message);
  };

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
          paddingBottom: chat.isMobile ? '0px' : '50px'
        }}>
          <div className={cn(
            'window flex flex-col relative',
            chat.pinkThemeActive && 'biscuit-frame',
            chat.isMobile ? 'h-full w-full overflow-hidden' : ''
          )} style={{
            ...chat.chatWindowStyle,
            ...(chat.isMobile && {
              height: '100vh',
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
                messages={chat.mappedMessages || []}
                onSendMessage={handleSendMessage}
                inputValue={chat.chatState.currentMessage || ''}
                onInputChange={chat.chatActions.handleInputChange}
                isPartnerTyping={chat.chatState.isPartnerTyping || false}
                partnerStatus={chat.chatState.partnerInfo?.status || 'offline'}
                partnerInfo={chat.memoizedPartnerInfo}
                ownInfo={chat.memoizedOwnInfo}
                isConnected={chat.socket.isConnected || false}
                isPartnerConnected={chat.chatState.isPartnerConnected || false}
                theme={chat.effectivePageTheme}
                onUsernameClick={chat.handleUsernameClick}
                isMobile={chat.isMobile}
                isScrollEnabled={chat.isScrollEnabled}
                onFindOrDisconnect={handleFindOrDisconnect}
                findOrDisconnectDisabled={isButtonDisabled}
                findOrDisconnectText={getButtonText()}
              />
            </div>

            {/* ✅ FIXED: Enhanced connection error display */}
            {chat.socket.connectionError && (
              <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 px-3 py-2 text-sm flex-shrink-0 flex items-center justify-between">
                <span>Connection Error: {chat.socket.connectionError}</span>
                <button 
                  onClick={chat.socket.forceReconnect}
                  className="ml-2 px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {/* ✅ ENHANCED: Skip notification display with better messaging */}
            {chat.wasSkippedByPartner && (
              <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-600 text-yellow-700 dark:text-yellow-300 px-3 py-2 text-sm flex-shrink-0 flex items-center justify-between">
                <span>Your chat partner skipped you</span>
                <button 
                  onClick={() => chat.chatActions.handleFindOrDisconnect()}
                  className="ml-2 px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition-colors"
                  disabled={isButtonDisabled}
                >
                  Find New Partner
                </button>
              </div>
            )}

            {/* ✅ NEW: Show when you recently skipped someone */}
            {chat.didSkipPartner && chat.chatState.isFindingPartner && (
              <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300 px-3 py-2 text-sm flex-shrink-0">
                <span>Looking for a new partner...</span>
              </div>
            )}

            {/* ✅ NEW: Show when manually disconnected recently */}
            {chat.isSelfDisconnectedRecently && !chat.chatState.isFindingPartner && !chat.wasSkippedByPartner && (
              <div className="bg-gray-100 dark:bg-gray-800/30 border border-gray-400 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-3 py-2 text-sm flex-shrink-0 flex items-center justify-between">
                <span>You disconnected from the chat</span>
                <button 
                  onClick={() => chat.chatActions.handleFindOrDisconnect()}
                  className="ml-2 px-2 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded transition-colors"
                  disabled={isButtonDisabled}
                >
                  Find Partner
                </button>
              </div>
            )}

            {/* ✅ NEW: Show when partner left recently */}
            {chat.isPartnerLeftRecently && !chat.chatState.isFindingPartner && !chat.wasSkippedByPartner && (
              <div className="bg-orange-100 dark:bg-orange-900/30 border border-orange-400 dark:border-orange-600 text-orange-700 dark:text-orange-300 px-3 py-2 text-sm flex-shrink-0 flex items-center justify-between">
                <span>Your partner left the chat</span>
                <button 
                  onClick={() => chat.chatActions.handleFindOrDisconnect()}
                  className="ml-2 px-2 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded transition-colors"
                  disabled={isButtonDisabled}
                >
                  Find New Partner
                </button>
              </div>
            )}

          </div>
        </div>
        
        {/* ✅ TaskBar with audio controls */}
        <TaskBar />
      </ProfilePopupProvider>
    </>
  );
};

export default ChatPageClientContent;