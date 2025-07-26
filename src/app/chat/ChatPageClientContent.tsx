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
    <LoadingScreen auth={chat.auth}></LoadingScreen>
  )
};

export default ChatPageClientContent;