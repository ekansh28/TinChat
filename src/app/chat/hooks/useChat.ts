// src/app/chat/hooks/useChat.ts - MAIN CHAT HOOK COMBINING ALL FUNCTIONALITY

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useChatSocket } from './useChatSocket';
import { useChatState } from './useChatState';
import { useAutoSearch } from './useAutoSearch';
import { useSystemMessages } from './useSystemMessages';
import { useFaviconManager } from './useFaviconManager';
import { useThemeDetection } from './useThemeDetection';
import { useViewport } from './useViewport';
import { Message, PartnerInfo } from '../utils/ChatHelpers';
import { getAudioManager } from '../components/TaskBar';

interface ChatActions {
  startNewChat: () => void;
  stopSearching: () => void;
  skipPartner: () => void;
  sendMessage: (message: string) => void;
  handleInputChange: (value: string) => void;
}

interface UseChat {
  // Auth state
  auth: {
    authId: string | null;
    username: string | null;
    displayNameColor: string;
    displayNameAnimation: string;
    isLoading: boolean;
  };
  
  // Socket state
  socket: {
    isConnected: boolean;
    isConnecting: boolean;
    connectionError: string | null;
    reconnect: () => void;
  };
  
  // Chat state
  chatState: {
    messages: Message[];
    isPartnerConnected: boolean;
    isFindingPartner: boolean;
    partnerInfo: PartnerInfo | null;
    isPartnerTyping: boolean;
    currentMessage: string;
  };
  
  // UI state
  isMobile: boolean;
  isScrollEnabled: boolean;
  chatWindowStyle: React.CSSProperties;
  pinkThemeActive: boolean;
  effectivePageTheme: string;
  
  // Loading states
  isLoading: boolean;
  hasConnectionError: boolean;
  isMounted: boolean;
  
  // Processed data
  mappedMessages: any[] | null;
  memoizedPartnerInfo: any;
  memoizedOwnInfo: any;
  interests: string[];
  
  // Actions
  chatActions: ChatActions;
  
  // Event handlers
  handleUsernameClick: (authId: string, clickPosition: { x: number; y: number }) => void;
  
  // Notification states
  wasSkippedByPartner: boolean;
  didSkipPartner: boolean;
  userManuallyStopped: boolean;
}

export const useChat = (): UseChat => {
  // ✅ Mount tracking
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // ✅ Core hooks
  const auth = useAuth();
  const chatState = useChatState();
  const { isMobile, chatWindowStyle } = useViewport();
  const { pinkThemeActive, effectivePageTheme } = useThemeDetection(isMounted);
  
  // ✅ State management
  const [interests] = useState<string[]>([]);
  const [isScrollEnabled] = useState(true);
  const [wasSkippedByPartner, setWasSkippedByPartner] = useState(false);
  const [didSkipPartner, setDidSkipPartner] = useState(false);
  const [userManuallyStopped, setUserManuallyStopped] = useState(false);
  const [isSelfDisconnectedRecently, setIsSelfDisconnectedRecently] = useState(false);
  const [isPartnerLeftRecently, setIsPartnerLeftRecently] = useState(false);

  // ✅ Initialization tracking
  const initRef = useRef({
    isInitialized: false,
    autoSearchStarted: false,
    sessionId: `session-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`
  });

  // ✅ Socket handlers
  const socketHandlers = useMemo(() => ({
    onMessage: (data: any) => {
      console.log('[useChat] 📨 Message received:', data);
      
      const newMessage: Message = {
        id: `msg-${Date.now()}-${Math.random()}`,
        text: data.message || data.text,
        sender: 'partner',
        timestamp: new Date(),
        senderUsername: data.username,
        senderAuthId: data.authId,
        senderDisplayNameColor: data.displayNameColor,
        senderDisplayNameAnimation: data.displayNameAnimation,
        senderRainbowSpeed: data.rainbowSpeed
      };
      
      chatState.addMessage(newMessage);
      
      // Play sound
      try {
        const audioManager = getAudioManager();
        audioManager.playMessageReceived();
      } catch (error) {
        console.warn('[useChat] Failed to play message sound:', error);
      }
    },

    onPartnerFound: (data: any) => {
      console.log('[useChat] 🎉 Partner found:', data);
      
      setWasSkippedByPartner(false);
      setDidSkipPartner(false);
      setUserManuallyStopped(false);
      
      chatState.setIsPartnerConnected(true);
      chatState.setIsFindingPartner(false);
      
      if (data.partnerInfo) {
        const partnerInfo: PartnerInfo = {
          id: data.partnerInfo.id || data.partnerId,
          username: data.partnerInfo.username || 'Stranger',
          displayName: data.partnerInfo.displayName,
          avatarUrl: data.partnerInfo.avatarUrl,
          displayNameColor: data.partnerInfo.displayNameColor,
          displayNameAnimation: data.partnerInfo.displayNameAnimation,
          rainbowSpeed: data.partnerInfo.rainbowSpeed,
          authId: data.partnerInfo.authId,
          status: data.partnerInfo.status || 'online'
        };
        chatState.setPartnerInfo(partnerInfo);
      }
      
      // Play match sound
      try {
        const audioManager = getAudioManager();
        audioManager.playMessageReceived(); // Using same sound for match
      } catch (error) {
        console.warn('[useChat] Failed to play match sound:', error);
      }
    },

    onPartnerLeft: () => {
      console.log('[useChat] 👋 Partner left normally');
      
      setIsPartnerLeftRecently(true);
      chatState.setIsPartnerConnected(false);
      chatState.setPartnerInfo(null);
      chatState.setIsPartnerTyping(false);
      
      setTimeout(() => setIsPartnerLeftRecently(false), 5000);
    },

    onPartnerSkipped: (data: any) => {
      console.log('[useChat] 😞 You were skipped by partner:', data);
      
      setWasSkippedByPartner(true);
      setDidSkipPartner(false);
      
      chatState.setIsPartnerConnected(false);
      chatState.setIsFindingPartner(false);
      chatState.setPartnerInfo(null);
      chatState.setIsPartnerTyping(false);
      
      setTimeout(() => setWasSkippedByPartner(false), 10000);
    },

    onSkipConfirmed: (data: any) => {
      console.log('[useChat] ✅ Skip confirmed, server will auto-search:', data);
      
      setDidSkipPartner(true);
      setWasSkippedByPartner(false);
      
      chatState.setIsPartnerConnected(false);
      chatState.setPartnerInfo(null);
      chatState.setIsPartnerTyping(false);
      
      // Server should start auto-search, so we set isFindingPartner to true
      if (data.autoSearchStarted) {
        chatState.setIsFindingPartner(true);
      }
      
      setTimeout(() => setDidSkipPartner(false), 5000);
    },

    onSearchStarted: (data: any) => {
      console.log('[useChat] 🔍 Search started:', data);
      
      setUserManuallyStopped(false);
      chatState.setIsFindingPartner(true);
      chatState.setIsPartnerConnected(false);
    },

    onSearchStopped: (data: any) => {
      console.log('[useChat] 🛑 Search stopped:', data);
      
      setUserManuallyStopped(true);
      chatState.setIsFindingPartner(false);
    },

    onStatusChange: (status: string) => {
      console.log('[useChat] 📊 Status change:', status);
    },

    onTypingStart: () => {
      console.log('[useChat] ⌨️ Partner started typing');
      chatState.setIsPartnerTyping(true);
    },

    onTypingStop: () => {
      console.log('[useChat] ⌨️ Partner stopped typing');
      chatState.setIsPartnerTyping(false);
    },

    onWaiting: (data: any) => {
      console.log('[useChat] ⏳ Waiting for partner:', data);
      chatState.setIsFindingPartner(true);
    },

    onCooldown: (data: any) => {
      console.log('[useChat] ⏰ Cooldown active:', data);
    },

    onAlreadySearching: (data: any) => {
      console.log('[useChat] ⚠️ Already searching:', data);
      chatState.setIsFindingPartner(true);
    },

    onSearchError: (data: any) => {
      console.log('[useChat] ❌ Search error:', data);
      chatState.setIsFindingPartner(false);
    },

    onDisconnectHandler: () => {
      console.log('[useChat] 🔌 Socket disconnected');
      setIsSelfDisconnectedRecently(true);
      setTimeout(() => setIsSelfDisconnectedRecently(false), 5000);
    },

    onConnectErrorHandler: () => {
      console.log('[useChat] ❌ Socket connection error');
    },

    authId: auth.authId
  }), [chatState, auth.authId]);

  // ✅ Initialize socket
  const socket = useChatSocket(socketHandlers);

  // ✅ Auto-search hook
  useAutoSearch({
    socket: {
      isConnected: socket.isConnected,
      emitFindPartner: socket.emitFindPartner
    },
    auth,
    chatState: {
      isPartnerConnected: chatState.isPartnerConnected,
      isFindingPartner: chatState.isFindingPartner
    },
    interests,
    initRef,
    setIsSelfDisconnectedRecently,
    setIsPartnerLeftRecently,
    wasSkippedByPartner,
    didSkipPartner,
    userManuallyStopped
  });

  // ✅ System messages hook
  useSystemMessages({
    isPartnerConnected: chatState.isPartnerConnected,
    isFindingPartner: chatState.isFindingPartner,
    connectionError: socket.connectionError,
    isSelfDisconnectedRecently,
    isPartnerLeftRecently,
    wasSkippedByPartner,
    didSkipPartner,
    partnerInterests: chatState.partnerInfo?.username ? [chatState.partnerInfo.username] : [],
    interests,
    messages: chatState.messages,
    setMessages: chatState.setMessages
  });

  // ✅ Favicon manager hook
  useFaviconManager({
    isPartnerConnected: chatState.isPartnerConnected,
    isFindingPartner: chatState.isFindingPartner,
    connectionError: socket.connectionError,
    isSelfDisconnectedRecently,
    isPartnerLeftRecently
  });

  // ✅ Initialize when socket connects
  useEffect(() => {
    if (socket.isConnected && !initRef.current.isInitialized) {
      console.log('[useChat] 🚀 Initializing chat system');
      initRef.current.isInitialized = true;
    }
  }, [socket.isConnected]);

  // ✅ Chat actions
  const chatActions: ChatActions = useMemo(() => ({
    startNewChat: () => {
      console.log('[useChat] 🔍 Starting new chat');
      
      setUserManuallyStopped(false);
      setWasSkippedByPartner(false);
      setDidSkipPartner(false);
      
      chatState.clearMessages();
      
      socket.emitFindPartner({
        chatType: 'text',
        interests,
        authId: auth.authId,
        username: auth.username,
        manualSearch: true,
        sessionId: initRef.current.sessionId
      });
    },

    stopSearching: () => {
      console.log('[useChat] 🛑 Stopping search manually');
      
      setUserManuallyStopped(true);
      socket.emitStopSearching();
    },

    skipPartner: () => {
      console.log('[useChat] ⏭️ Skipping current partner');
      
      if (!chatState.isPartnerConnected) {
        console.warn('[useChat] No partner to skip');
        return;
      }
      
      setDidSkipPartner(true);
      setWasSkippedByPartner(false);
      
      socket.emitSkipPartner({
        chatType: 'text',
        interests,
        authId: auth.authId,
        reason: 'skip'
      });
    },

    sendMessage: (message: string) => {
      console.log('[useChat] 📤 Sending message:', message);
      
      if (!message.trim()) {
        console.warn('[useChat] Empty message not sent');
        return;
      }
      
      const newMessage: Message = {
        id: `msg-${Date.now()}-${Math.random()}`,
        text: message.trim(),
        sender: 'me',
        timestamp: new Date(),
        senderUsername: auth.username ?? undefined,
        senderAuthId: auth.authId ?? undefined,
        senderDisplayNameColor: auth.displayNameColor,
        senderDisplayNameAnimation: auth.displayNameAnimation
      };
      
      chatState.addMessage(newMessage);
      
      socket.emitMessage({
        message: message.trim(),
        username: auth.username,
        authId: auth.authId
      });
      
      // Play send sound
      try {
        const audioManager = getAudioManager();
        audioManager.playMessageSent();
      } catch (error) {
        console.warn('[useChat] Failed to play send sound:', error);
      }
    },

    handleInputChange: (value: string) => {
      chatState.setCurrentMessage(value);
      
      // Handle typing indicators
      if (value.trim()) {
        socket.emitTypingStart();
      } else {
        socket.emitTypingStop();
      }
    }
  }), [socket, chatState, auth, interests]);

  // ✅ Processed data
  const mappedMessages = useMemo(() => {
    return chatState.messages.map(msg => ({
      id: msg.id,
      content: msg.text,
      sender: msg.sender,
      timestamp: msg.timestamp.getTime(),
      senderUsername: msg.senderUsername,
      senderAuthId: msg.senderAuthId,
      senderDisplayNameColor: msg.senderDisplayNameColor,
      senderDisplayNameAnimation: msg.senderDisplayNameAnimation,
      senderRainbowSpeed: msg.senderRainbowSpeed
    }));
  }, [chatState.messages]);

  const memoizedPartnerInfo = useMemo(() => ({
    username: chatState.partnerInfo?.username || 'Stranger',
    displayName: chatState.partnerInfo?.displayName,
    avatar: chatState.partnerInfo?.avatarUrl || '',
    displayNameColor: chatState.partnerInfo?.displayNameColor,
    displayNameAnimation: chatState.partnerInfo?.displayNameAnimation,
    rainbowSpeed: chatState.partnerInfo?.rainbowSpeed,
    authId: chatState.partnerInfo?.authId,
    status: chatState.partnerInfo?.status || 'offline'
  }), [chatState.partnerInfo]);

  const memoizedOwnInfo = useMemo(() => ({
    username: auth.username || 'You',
    authId: auth.authId,
    displayNameColor: auth.displayNameColor,
    displayNameAnimation: auth.displayNameAnimation
  }), [auth]);

  // ✅ Loading and error states
  const isLoading = auth.isLoading || (!socket.isConnected && !socket.connectionError);
  const hasConnectionError = !!socket.connectionError;

  // ✅ Username click handler
  const handleUsernameClick = useCallback((authId: string, clickPosition: { x: number; y: number }) => {
    console.log('[useChat] Username clicked:', authId, clickPosition);
    // This would integrate with profile popup system
  }, []);

  return {
    // Auth state
    auth,
    
    // Socket state
    socket: {
      isConnected: socket.isConnected,
      isConnecting: socket.isConnecting,
      connectionError: socket.connectionError,
      reconnect: socket.reconnect
    },
    
    // Chat state
    chatState: {
      messages: chatState.messages,
      isPartnerConnected: chatState.isPartnerConnected,
      isFindingPartner: chatState.isFindingPartner,
      partnerInfo: chatState.partnerInfo,
      isPartnerTyping: chatState.isPartnerTyping,
      currentMessage: chatState.currentMessage
    },
    
    // UI state
    isMobile,
    isScrollEnabled,
    chatWindowStyle,
    pinkThemeActive,
    effectivePageTheme,
    
    // Loading states
    isLoading,
    hasConnectionError,
    isMounted,
    
    // Processed data
    mappedMessages,
    memoizedPartnerInfo,
    memoizedOwnInfo,
    interests,
    
    // Actions
    chatActions,
    
    // Event handlers
    handleUsernameClick,
    
    // Notification states
    wasSkippedByPartner,
    didSkipPartner,
    userManuallyStopped
  };
};