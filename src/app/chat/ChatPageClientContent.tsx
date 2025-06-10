'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useChatSocket, useChatState } from './hooks/useChatSocket';
import { playSound } from '@/lib/utils';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';
import HomeButton from '@/components/HomeButton';

// Import your modular components
import ChatWindow from './components/ChatWindow';
import PartnerProfile from './components/PartnerProfile';
import MatchStatus from './components/MatchStatus';
import { PartnerInfo } from './utils/ChatHelpers';

const ChatPageClientContent: React.FC = () => {
  const searchParams = useSearchParams();
  const { currentTheme } = useTheme();
  const [authId, setAuthId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  const {
    messages,
    isPartnerConnected,
    setIsPartnerConnected,
    isFindingPartner,
    setIsFindingPartner,
    partnerInfo,
    setPartnerInfo,
    isPartnerTyping,
    setIsPartnerTyping,
    currentMessage,
    setCurrentMessage,
    addMessage,
    addSystemMessage,
    resetChatState
  } = useChatState();

  // Socket event handlers
  const handleMessage = useCallback((data: any) => {
    addMessage({
      text: data.message,
      sender: 'partner',
      senderUsername: data.senderUsername,
      senderAuthId: data.senderAuthId,
      senderDisplayNameColor: data.senderDisplayNameColor,
      senderDisplayNameAnimation: data.senderDisplayNameAnimation,
      senderRainbowSpeed: data.senderRainbowSpeed
    });
    setIsPartnerTyping(false);
  }, [addMessage, setIsPartnerTyping]);

  const handlePartnerFound = useCallback((data: any) => {
    console.log('Partner found:', data);
    playSound('Match.wav');
    
    setPartnerInfo({
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
    
    setIsFindingPartner(false);
    setIsPartnerConnected(true);
    addSystemMessage('Connected with a partner. You can start chatting!');
    
    // Add common interests message if any
    const interests = searchParams.get('interests')?.split(',').filter(i => i.trim()) || [];
    if (interests.length > 0 && data.interests && data.interests.length > 0) {
      const common = interests.filter(i => data.interests.includes(i));
      if (common.length > 0) {
        addSystemMessage(`You both like ${common.join(', ')}.`);
      }
    }
  }, [setPartnerInfo, setIsFindingPartner, setIsPartnerConnected, addSystemMessage, searchParams]);

  const handlePartnerLeft = useCallback(() => {
    console.log('Partner left');
    setIsPartnerConnected(false);
    setIsFindingPartner(false);
    setPartnerInfo(null);
    setIsPartnerTyping(false);
    addSystemMessage('Your partner has disconnected.');
  }, [setIsPartnerConnected, setIsFindingPartner, setPartnerInfo, setIsPartnerTyping, addSystemMessage]);

  // Then fix the callback
const handleStatusChange = useCallback((status: string) => {
  const validStatuses: Array<'online' | 'idle' | 'dnd' | 'offline'> = ['online', 'idle', 'dnd', 'offline'];
  const validStatus = validStatuses.includes(status as any) ? status as 'online' | 'idle' | 'dnd' | 'offline' : 'offline';
  
  setPartnerInfo(prev => {
    if (!prev) return null;
    return { ...prev, status: validStatus };
  });
}, [setPartnerInfo]);

  const handleTypingStart = useCallback(() => {
    setIsPartnerTyping(true);
  }, [setIsPartnerTyping]);

  const handleTypingStop = useCallback(() => {
    setIsPartnerTyping(false);
  }, [setIsPartnerTyping]);

  const handleWaiting = useCallback(() => {
    console.log('Waiting for partner...');
  }, []);

  const handleCooldown = useCallback(() => {
    setIsFindingPartner(false);
  }, [setIsFindingPartner]);

  const handleDisconnect = useCallback((reason: string) => {
    console.log('Disconnected:', reason);
    resetChatState();
  }, [resetChatState]);

  const handleConnectError = useCallback((err: Error) => {
    console.error('Connection error:', err);
    setIsFindingPartner(false);
  }, [setIsFindingPartner]);

  // Initialize socket
  const {
    isConnected,
    connectionError,
    emitFindPartner,
    emitMessage,
    emitTypingStart,
    emitTypingStop,
    emitLeaveChat
  } = useChatSocket({
    onMessage: handleMessage,
    onPartnerFound: handlePartnerFound,
    onPartnerLeft: handlePartnerLeft,
    onStatusChange: handleStatusChange,
    onTypingStart: handleTypingStart,
    onTypingStop: handleTypingStop,
    onWaiting: handleWaiting,
    onCooldown: handleCooldown,
    onDisconnectHandler: handleDisconnect,
    onConnectErrorHandler: handleConnectError,
    authId
  });

  // Check mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setAuthId(user?.id || null);
        
        if (user) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('username, display_name')
            .eq('id', user.id)
            .single();
            
          setUsername(profile?.display_name || profile?.username || null);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setIsAuthLoading(false);
      }
    };
    
    initAuth();
  }, []);

  // Auto-search for partner when connected
  useEffect(() => {
    if (isConnected && !isAuthLoading && !isPartnerConnected && !isFindingPartner) {
      const interests = searchParams.get('interests')?.split(',').filter(i => i.trim()) || [];
      
      console.log('Auto-searching for partner with interests:', interests);
      setIsFindingPartner(true);
      addSystemMessage('Searching for a partner...');
      
      emitFindPartner({
        chatType: 'text',
        interests,
        authId
      });
    }
  }, [isConnected, isAuthLoading, isPartnerConnected, isFindingPartner, searchParams, authId, emitFindPartner, setIsFindingPartner, addSystemMessage]);

  // Handle find/disconnect partner
  const handleFindOrDisconnect = useCallback(() => {
    if (isPartnerConnected) {
      // Disconnect from current partner
      emitLeaveChat();
      addSystemMessage('You have disconnected.');
      
      // Start searching again
      setTimeout(() => {
        const interests = searchParams.get('interests')?.split(',').filter(i => i.trim()) || [];
        setIsFindingPartner(true);
        addSystemMessage('Searching for a partner...');
        
        emitFindPartner({
          chatType: 'text',
          interests,
          authId
        });
      }, 500);
    } else if (isFindingPartner) {
      // Stop searching
      setIsFindingPartner(false);
      addSystemMessage('Stopped searching for a partner.');
    } else {
      // Start searching
      const interests = searchParams.get('interests')?.split(',').filter(i => i.trim()) || [];
      setIsFindingPartner(true);
      addSystemMessage('Searching for a partner...');
      
      emitFindPartner({
        chatType: 'text',
        interests,
        authId
      });
    }
  }, [isPartnerConnected, isFindingPartner, emitLeaveChat, emitFindPartner, addSystemMessage, searchParams, authId, setIsFindingPartner]);

  // Handle send message
  const handleSendMessage = useCallback((message: string) => {
    if (!isPartnerConnected) return;

    // Add to local messages immediately
    addMessage({
      text: message,
      sender: 'me'
    });

    // Send to server
    emitMessage({
      roomId: '', // Server will use the current room
      message: message,
      username,
      authId
    });

    emitTypingStop();
  }, [isPartnerConnected, addMessage, emitMessage, username, authId, emitTypingStop]);

  // Handle input change with typing indicators
  const handleInputChange = useCallback((value: string) => {
    setCurrentMessage(value);
    
    if (value.trim() && isPartnerConnected) {
      emitTypingStart();
    } else {
      emitTypingStop();
    }
  }, [setCurrentMessage, isPartnerConnected, emitTypingStart, emitTypingStop]);

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading chat...</p>
        </div>
      </div>
    );
  }

  // Chat window style
  const chatWindowStyle = {
    width: isMobile ? '100vw' : '600px',
    height: isMobile ? '100vh' : '600px',
    maxWidth: isMobile ? '100vw' : undefined,
    maxHeight: isMobile ? '100vh' : undefined
  };

  return (
    <div className={cn(
      "flex flex-col items-center justify-center",
      isMobile ? "h-screen w-screen p-0" : "h-full p-4"
    )}>
      {!isMobile && <HomeButton />}
      
      <div className={cn(
        'window flex flex-col relative',
        currentTheme === 'theme-7' ? 'glass' : '',
        isMobile ? 'h-full w-full' : ''
      )} style={chatWindowStyle}>
        
        {/* Header */}
        <div className={cn(
          "title-bar",
          currentTheme === 'theme-7' ? 'text-black' : '',
          isMobile && "text-sm h-8 min-h-8"
        )}>
          <div className="flex items-center justify-between w-full">
            <div className="title-bar-text">
              {isMobile ? 'TinChat' : 'Text Chat'}
            </div>
            
            {/* Partner info and status */}
            <div className="flex items-center space-x-2">
              {partnerInfo && isPartnerConnected && (
                <PartnerProfile
                  username={partnerInfo.username}
                  displayName={partnerInfo.displayName}
                  avatarUrl={partnerInfo.avatarUrl}
                  status={partnerInfo.status}
                  displayNameColor={partnerInfo.displayNameColor}
                  displayNameAnimation={partnerInfo.displayNameAnimation}
                  badges={partnerInfo.badges}
                  className="max-w-xs scale-75"
                />
              )}
              
              <MatchStatus
                isSearching={isFindingPartner}
                isConnected={isPartnerConnected}
                onFindPartner={handleFindOrDisconnect}
                onDisconnect={handleFindOrDisconnect}
                disabled={!isConnected || !!connectionError}
                className="scale-75"
              />
            </div>
          </div>
        </div>

        {/* Chat Window */}
        <div className="flex-1 flex flex-col">
          <ChatWindow
            messages={messages.map(msg => ({
              id: msg.id,
              content: msg.text,
              sender: msg.sender === 'me' ? 'self' : msg.sender,
              timestamp: msg.timestamp?.getTime()
            }))}
            onSendMessage={handleSendMessage}
            inputValue={currentMessage}
            onInputChange={handleInputChange}
            isPartnerTyping={isPartnerTyping}
            partnerStatus={partnerInfo?.status || 'offline'}
            partnerInfo={partnerInfo ? {
              username: partnerInfo.username,
              avatar: partnerInfo.avatarUrl || '/default-avatar.png'
            } : undefined}
            isConnected={isConnected}
            isPartnerConnected={isPartnerConnected}
          />
        </div>

        {/* Connection status */}
        {connectionError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 text-sm">
            Connection Error: {connectionError}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPageClientContent;