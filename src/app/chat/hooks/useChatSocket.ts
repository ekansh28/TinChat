// src/app/chat/hooks/useChatSocket.ts - FIXED VERSION WITH STABLE DEPENDENCIES
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { showChatToast, PartnerInfo, Message } from '../utils/ChatHelpers';

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
  roomId?: string | null;
  onWebRTCSignal?: (signalData: any) => void; // Optional for video chat
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
  authId,
  roomId,
  onWebRTCSignal
}: UseChatSocketParams) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const roomIdRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionAttemptsRef = useRef(0);

  // ✅ CRITICAL FIX: Store callbacks in stable refs
  const stableCallbacks = useRef({
    onMessage,
    onPartnerFound,
    onPartnerLeft,
    onStatusChange,
    onTypingStart,
    onTypingStop,
    onWebRTCSignal,
    onWaiting,
    onCooldown,
    onDisconnectHandler,
    onConnectErrorHandler
  });

  // ✅ Update refs when callbacks change (but don't recreate socket)
  useEffect(() => {
    stableCallbacks.current = {
      onMessage,
      onPartnerFound,
      onPartnerLeft,
      onStatusChange,
      onTypingStart,
      onTypingStop,
      onWebRTCSignal,
      onWaiting,
      onCooldown,
      onDisconnectHandler,
      onConnectErrorHandler
    };
  }, [
    onMessage,
    onPartnerFound,
    onPartnerLeft,
    onStatusChange,
    onTypingStart,
    onTypingStop,
    onWebRTCSignal,
    onWaiting,
    onCooldown,
    onDisconnectHandler,
    onConnectErrorHandler
  ]);

  // Update room ID ref when it changes
  useEffect(() => {
    roomIdRef.current = roomId || null;
  }, [roomId]);

  // ✅ CRITICAL FIX: Socket connection with stable dependencies
  useEffect(() => {
    const socketServerUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL;
    
    if (!socketServerUrl) {
      const error = 'Socket server URL not configured';
      console.error(error);
      setConnectionError(error);
      return;
    }

    // Prevent multiple simultaneous connections
    if (isConnecting || socketRef.current?.connected) {
      console.log('Connection already in progress or established, skipping...');
      return;
    }

    setIsConnecting(true);
    connectionAttemptsRef.current += 1;

    console.log(`🔌 Connecting to socket server (attempt ${connectionAttemptsRef.current}):`, socketServerUrl);
    
    const socket = io(socketServerUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 3, // ✅ Limit reconnection attempts
      reconnectionDelay: 2000, // ✅ Wait 2 seconds between attempts
      reconnectionDelayMax: 10000, // ✅ Max 10 second delay
      timeout: 20000,
      forceNew: true, // ✅ Force new connection to prevent reuse issues
      upgrade: true,
      rememberUpgrade: false
    });
    
    socketRef.current = socket;

    // Set up WebRTC signal emission function for video chat
    if (stableCallbacks.current.onWebRTCSignal) {
      window.videoChatEmitWebRTCSignal = (data) => {
        if (socket.connected && roomIdRef.current) {
          socket.emit('webrtcSignal', {
            roomId: roomIdRef.current,
            signalData: data.signalData
          });
        }
      };
    }

    // ✅ Connection events with proper error handling
    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id);
      setIsConnected(true);
      setIsConnecting(false);
      setConnectionError(null);
      connectionAttemptsRef.current = 0; // Reset attempts on successful connection
      
      // Clear any pending reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      setIsConnected(false);
      setIsConnecting(false);
      roomIdRef.current = null;
      
      // Use stable callback reference
      stableCallbacks.current.onDisconnectHandler(reason);

      // ✅ Implement exponential backoff for reconnections
      if (reason === 'io server disconnect') {
        // Server disconnected us, don't auto-reconnect
        console.log('Server disconnected us, not attempting reconnect');
      } else if (connectionAttemptsRef.current < 5) {
        // Client disconnect, try to reconnect with delay
        const delay = Math.min(1000 * Math.pow(2, connectionAttemptsRef.current), 30000);
        console.log(`Scheduling reconnect in ${delay}ms...`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!socketRef.current?.connected) {
            console.log('Attempting manual reconnect...');
            socket.connect();
          }
        }, delay);
      }
    });

    socket.on('connect_error', (err) => {
      console.error('🚫 Socket connection error:', err);
      setIsConnected(false);
      setIsConnecting(false);
      setConnectionError(err.message);
      
      // Use stable callback reference
      stableCallbacks.current.onConnectErrorHandler(err);
    });

    // ✅ Chat events using stable callback references
    socket.on('partnerFound', (data: {
      partnerId: string;
      roomId: string;
      interests: string[];
      partnerUsername?: string;
      partnerDisplayName?: string;
      partnerAvatarUrl?: string;
      partnerBannerUrl?: string;
      partnerPronouns?: string;
      partnerStatus?: string;
      partnerDisplayNameColor?: string;
      partnerDisplayNameAnimation?: string;
      partnerRainbowSpeed?: number;
      partnerAuthId?: string;
      partnerBadges?: any[];
    }) => {
      console.log('🎯 Partner found:', { partnerId: data.partnerId, roomId: data.roomId });
      roomIdRef.current = data.roomId;
      stableCallbacks.current.onPartnerFound(data);
    });

    socket.on('receiveMessage', (data: {
      senderId: string;
      message: string;
      senderUsername?: string;
      senderAuthId?: string;
      senderDisplayNameColor?: string;
      senderDisplayNameAnimation?: string;
      senderRainbowSpeed?: number;
    }) => {
      console.log('💬 Message received:', { senderId: data.senderId, message: data.message });
      stableCallbacks.current.onMessage(data);
    });

    socket.on('partnerLeft', () => {
      console.log('👋 Partner left');
      roomIdRef.current = null;
      stableCallbacks.current.onPartnerLeft();
    });

    socket.on('partnerStatusChanged', (data: { status: string }) => {
      console.log('📊 Partner status changed:', data.status);
      stableCallbacks.current.onStatusChange(data.status);
    });

    // WebRTC signaling (only for video chat)
    if (stableCallbacks.current.onWebRTCSignal) {
      socket.on('webrtcSignal', (data: any) => {
        console.log('📹 WebRTC signal received:', data.signalData?.type || 'candidate');
        stableCallbacks.current.onWebRTCSignal!(data.signalData);
      });
    }

    socket.on('partner_typing_start', () => stableCallbacks.current.onTypingStart());
    socket.on('partner_typing_stop', () => stableCallbacks.current.onTypingStop());
    socket.on('waitingForPartner', () => stableCallbacks.current.onWaiting());
    socket.on('findPartnerCooldown', () => stableCallbacks.current.onCooldown());

    // Online user count updates
    socket.on('onlineUserCountUpdate', (count: number) => {
      console.log('👥 Online users:', count);
    });

    // ✅ Enhanced error handling for socket errors
    socket.on('error', (error: any) => {
      console.error('🚨 Socket error:', error);
      setConnectionError(error.message || 'Socket error occurred');
    });

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up socket connection...');
      
      // Clear reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Leave room if connected
      if (roomIdRef.current && socket.connected) {
        socket.emit('leaveChat', { roomId: roomIdRef.current });
      }
      
      // Clean up WebRTC function
      if (stableCallbacks.current.onWebRTCSignal) {
        delete window.videoChatEmitWebRTCSignal;
      }
      
      // Remove all listeners and disconnect
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setIsConnecting(false);
    };
  }, []); // ✅ EMPTY DEPENDENCY ARRAY - No changing dependencies!

  // ✅ Stable emit functions with better error handling
  const emitFindPartner = useCallback((payload: {
    chatType: 'text' | 'video';
    interests: string[];
    authId?: string | null;
  }) => {
    if (!socketRef.current?.connected) {
      showChatToast.connectionError('Not connected to server');
      return false;
    }
    
    console.log('🔍 Finding partner with payload:', payload);
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
    
    console.log('📤 Sending message:', payload);
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
      console.log('🚪 Leaving chat room:', roomIdRef.current);
      socketRef.current.emit('leaveChat', { roomId: roomIdRef.current });
      roomIdRef.current = null;
      return true;
    }
    return false;
  }, []);

  const emitWebRTCSignal = useCallback((payload: {
    roomId: string;
    signalData: any;
  }) => {
    if (socketRef.current?.connected && roomIdRef.current) {
      console.log('📹 Emitting WebRTC signal:', payload.signalData.type || 'candidate');
      socketRef.current.emit('webrtcSignal', {
        roomId: roomIdRef.current,
        signalData: payload.signalData
      });
      return true;
    }
    return false;
  }, []);

  const emitUpdateStatus = useCallback((status: 'online' | 'idle' | 'dnd' | 'offline') => {
    if (socketRef.current?.connected && authId) {
      console.log('📊 Updating status:', status);
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

  // ✅ Force reconnect function for manual recovery
  const forceReconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('🔄 Force reconnecting...');
      socketRef.current.disconnect();
      setTimeout(() => {
        socketRef.current?.connect();
      }, 1000);
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    connectionError,
    isConnecting,
    roomId: roomIdRef.current,
    emitFindPartner,
    emitMessage,
    emitTypingStart,
    emitTypingStop,
    emitLeaveChat,
    emitWebRTCSignal: stableCallbacks.current.onWebRTCSignal ? emitWebRTCSignal : undefined,
    emitUpdateStatus,
    getOnlineUserCount,
    forceReconnect
  };
}

// Chat state management (unchanged but with better TypeScript)
export function useChatState() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isPartnerConnected, setIsPartnerConnected] = useState<boolean>(false);
  const [isFindingPartner, setIsFindingPartner] = useState<boolean>(false);
  const [partnerInfo, setPartnerInfo] = useState<PartnerInfo | null>(null);
  const [isPartnerTyping, setIsPartnerTyping] = useState<boolean>(false);
  const [currentMessage, setCurrentMessage] = useState<string>('');

  const addMessage = useCallback((message: Partial<Message>) => {
    setMessages(prev => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      sender: 'system',
      text: '',
      ...message
    } as Message]);
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