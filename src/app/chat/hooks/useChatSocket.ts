// src/app/chat/hooks/useChatSocket.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { showChatToast } from '../utils/chatHelpers';

interface UseChatSocketParams {
  onMessage: (msg: any) => void;
  onPartnerFound: (partner: any) => void;
  onPartnerLeft: () => void;
  onStatusChange: (status: string) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  onWaiting: () => void;
  onCooldown: () => void;
  onDisconnectHandler: (reason: string) => void;
  onConnectErrorHandler: (err: Error) => void;
  authId?: string | null;
}

export function useChatSocket({
  onMessage,
  onPartnerFound,
  onPartnerLeft,
  onStatusChange,
  onTypingStart,
  onTypingStop,
  onWaiting,
  onCooldown,
  onDisconnectHandler,
  onConnectErrorHandler,
  authId
}: UseChatSocketParams) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const roomIdRef = useRef<string | null>(null);

  useEffect(() => {
    const socketServerUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL;
    
    if (!socketServerUrl) {
      const error = 'Socket server URL not configured';
      console.error(error);
      setConnectionError(error);
      return;
    }

    console.log('Connecting to socket server:', socketServerUrl);
    
    const socket = io(socketServerUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000
    });
    
    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setIsConnected(true);
      setConnectionError(null);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
      roomIdRef.current = null;
      onDisconnectHandler(reason);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setIsConnected(false);
      setConnectionError(err.message);
      onConnectErrorHandler(err);
    });

    // Chat events
    socket.on('partnerFound', ({ 
      partnerId, 
      roomId, 
      interests, 
      partnerUsername,
      partnerDisplayName,
      partnerAvatarUrl,
      partnerBannerUrl,
      partnerPronouns,
      partnerStatus,
      partnerDisplayNameColor,
      partnerDisplayNameAnimation,
      partnerRainbowSpeed,
      partnerAuthId,
      partnerBadges
    }) => {
      console.log('Partner found:', { partnerId, roomId });
      roomIdRef.current = roomId;
      onPartnerFound({
        partnerId,
        roomId,
        interests,
        partnerUsername,
        partnerDisplayName,
        partnerAvatarUrl,
        partnerBannerUrl,
        partnerPronouns,
        partnerStatus,
        partnerDisplayNameColor,
        partnerDisplayNameAnimation,
        partnerRainbowSpeed,
        partnerAuthId,
        partnerBadges
      });
    });

    socket.on('receiveMessage', ({
      senderId,
      message,
      senderUsername,
      senderAuthId,
      senderDisplayNameColor,
      senderDisplayNameAnimation,
      senderRainbowSpeed
    }) => {
      console.log('Message received:', { senderId, message });
      onMessage({
        senderId,
        message,
        senderUsername,
        senderAuthId,
        senderDisplayNameColor,
        senderDisplayNameAnimation,
        senderRainbowSpeed
      });
    });

    socket.on('partnerLeft', () => {
      console.log('Partner left');
      roomIdRef.current = null;
      onPartnerLeft();
    });

    socket.on('partnerStatusChanged', ({ status }) => {
      console.log('Partner status changed:', status);
      onStatusChange(status);
    });

    socket.on('partner_typing_start', onTypingStart);
    socket.on('partner_typing_stop', onTypingStop);
    socket.on('waitingForPartner', onWaiting);
    socket.on('findPartnerCooldown', onCooldown);

    // Online user count updates
    socket.on('onlineUserCountUpdate', (count) => {
      console.log('Online users:', count);
    });

    return () => {
      console.log('Cleaning up socket connection');
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [
    onMessage,
    onPartnerFound,
    onPartnerLeft,
    onStatusChange,
    onTypingStart,
    onTypingStop,
    onWaiting,
    onCooldown,
    onDisconnectHandler,
    onConnectErrorHandler
  ]);

  const emitFindPartner = useCallback((payload: {
    chatType: 'text' | 'video';
    interests: string[];
    authId?: string | null;
  }) => {
    if (!socketRef.current?.connected) {
      showChatToast.connectionError('Not connected to server');
      return false;
    }
    
    console.log('Finding partner with payload:', payload);
    socketRef.current.emit('findPartner', payload);
    return true;
  }, []);

  const emitMessage = useCallback((payload: {
    roomId: string;
    message: string;
    username?: string | null;
    authId?: string | null;
  }) => {
    if (!socketRef.current?.connected) {
      showChatToast.connectionError('Not connected to server');
      return false;
    }
    
    if (!roomIdRef.current) {
      showChatToast.messageError('Not in a chat room');
      return false;
    }
    
    console.log('Sending message:', payload);
    socketRef.current.emit('sendMessage', {
      ...payload,
      roomId: roomIdRef.current
    });
    return true;
  }, []);

  const emitTypingStart = useCallback(() => {
    if (socketRef.current?.connected && roomIdRef.current) {
      socketRef.current.emit('typing_start', { roomId: roomIdRef.current });
    }
  }, []);

  const emitTypingStop = useCallback(() => {
    if (socketRef.current?.connected && roomIdRef.current) {
      socketRef.current.emit('typing_stop', { roomId: roomIdRef.current });
    }
  }, []);

  const emitLeaveChat = useCallback(() => {
    if (socketRef.current?.connected && roomIdRef.current) {
      console.log('Leaving chat room:', roomIdRef.current);
      socketRef.current.emit('leaveChat', { roomId: roomIdRef.current });
      roomIdRef.current = null;
      return true;
    }
    return false;
  }, []);

  const emitUpdateStatus = useCallback((status: 'online' | 'idle' | 'dnd' | 'offline') => {
    if (socketRef.current?.connected && authId) {
      console.log('Updating status:', status);
      socketRef.current.emit('updateStatus', { status });
      return true;
    }
    return false;
  }, [authId]);

  const getOnlineUserCount = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('getOnlineUserCount');
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    connectionError,
    roomId: roomIdRef.current,
    emitFindPartner,
    emitMessage,
    emitTypingStart,
    emitTypingStop,
    emitLeaveChat,
    emitUpdateStatus,
    getOnlineUserCount
  };
}

// Additional hook for chat state management
export function useChatState() {
  const [messages, setMessages] = useState<any[]>([]);
  const [isPartnerConnected, setIsPartnerConnected] = useState(false);
  const [isFindingPartner, setIsFindingPartner] = useState(false);
  const [partnerInfo, setPartnerInfo] = useState<any>(null);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');

  const addMessage = useCallback((message: any) => {
    setMessages(prev => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      ...message
    }]);
  }, []);

  const addSystemMessage = useCallback((text: string) => {
    addMessage({
      text,
      sender: 'system'
    });
  }, [addMessage]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const resetChatState = useCallback(() => {
    setMessages([]);
    setIsPartnerConnected(false);
    setIsFindingPartner(false);
    setPartnerInfo(null);
    setIsPartnerTyping(false);
  }, []);

  return {
    messages,
    setMessages,
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
    clearMessages,
    resetChatState
  };
}