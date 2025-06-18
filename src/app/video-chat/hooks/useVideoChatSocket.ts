// src/app/video-chat/hooks/useVideoChatSocket.ts - FIXED VERSION

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { generateDeviceFingerprint } from '@/lib/fingerprint';

interface UseVideoChatSocketParams {
  onMessage: (msg: any) => void;
  onPartnerFound: (partner: any) => void;
  onPartnerLeft: () => void;
  onStatusChange: (status: string) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  onWebRTCSignal: (signalData: any) => void;
  onWaiting: () => void;
  onCooldown: () => void;
  onDisconnectHandler: (reason: string) => void;
  onConnectErrorHandler: (err: Error) => void;
  authId?: string | null;
  roomId?: string | null;
}

export function useVideoChatSocket(params: UseVideoChatSocketParams) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const roomIdRef = useRef<string | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const tabIdRef = useRef<string | null>(null);
  const maxReconnectAttempts = 3;
  const isInitializedRef = useRef(false);
  const isDestroyedRef = useRef(false);

  // ✅ FIXED: Stable params reference to prevent dependency loops
  const stableParamsRef = useRef(params);
  stableParamsRef.current = params;

  // Update room ID ref when it changes
  useEffect(() => {
    roomIdRef.current = params.roomId || null;
  }, [params.roomId]);

  // ✅ FIXED: Socket initialization with proper cleanup
  const initializeConnection = useCallback(() => {
    if (isInitializedRef.current || isDestroyedRef.current) {
      console.log('[VideoChatSocket] Skipping initialization - already initialized or destroyed');
      return;
    }

    const socketServerUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL;
    
    if (!socketServerUrl) {
      const error = 'Socket server URL not configured';
      console.error('[VideoChatSocket]', error);
      setConnectionError(error);
      return;
    }

    console.log('[VideoChatSocket] Connecting to server:', socketServerUrl);
    setIsConnecting(true);
    
    // Generate unique tab ID
    const tabId = `video-tab-${Date.now()}-${Math.random().toString(36).substr(2, 12)}`;
    tabIdRef.current = tabId;
    
    const socket = io(socketServerUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 8000,
      timeout: 20000,
      forceNew: true,
      query: {
        tabId: tabId,
        timestamp: Date.now(),
        chatType: 'video',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 100) : 'unknown',
        clientId: generateDeviceFingerprint()
      }
    });
    
    socketRef.current = socket;
    isInitializedRef.current = true;

    // Setup WebRTC signal emission
    if (typeof window !== 'undefined') {
      window.videoChatEmitWebRTCSignal = (data) => {
        if (!data || !data.signalData) {
          console.error('[VideoChatSocket] Invalid WebRTC signal data:', data);
          return false;
        }
        
        if (!socket.connected || !roomIdRef.current) {
          console.warn('[VideoChatSocket] Cannot emit WebRTC signal - not connected or no room');
          return false;
        }
        
        console.log('[VideoChatSocket] Emitting WebRTC signal:', data.signalData.type || 'candidate');
        try {
          socket.emit('webrtcSignal', {
            roomId: roomIdRef.current,
            signalData: data.signalData,
            fromTabId: tabIdRef.current,
            timestamp: Date.now()
          });
          return true;
        } catch (error) {
          console.error('[VideoChatSocket] Error emitting WebRTC signal:', error);
          return false;
        }
      };
    }

    // Enhanced connection event handlers
    const handleConnect = () => {
      console.log('[VideoChatSocket] Connected:', socket.id);
      setIsConnected(true);
      setIsConnecting(false);
      setConnectionError(null);
      reconnectAttemptsRef.current = 0;
      
      // Identify tab immediately
      socket.emit('identify_tab', { 
        tabId,
        chatType: 'video',
        authId: stableParamsRef.current.authId,
        isReconnect: reconnectAttemptsRef.current > 0,
        timestamp: Date.now()
      });
    };

    const handleDisconnect = (reason: string) => {
      console.log('[VideoChatSocket] Disconnected:', reason);
      setIsConnected(false);
      setIsConnecting(false);
      roomIdRef.current = null;
      stableParamsRef.current.onDisconnectHandler(reason);
      
      if (reason === 'io server disconnect') {
        setConnectionError('Disconnected by server');
      } else if (reason === 'transport close' || reason === 'ping timeout') {
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          setConnectionError('Connection lost - reconnecting...');
          reconnectAttemptsRef.current++;
        } else {
          setConnectionError('Connection lost - please refresh page');
        }
      }
    };

    const handleConnectError = (err: Error) => {
      console.error('[VideoChatSocket] Connection error:', err);
      setIsConnected(false);
      setIsConnecting(false);
      reconnectAttemptsRef.current++;
      
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        setConnectionError('Failed to connect - please refresh page');
      } else {
        setConnectionError(`Connection error - retrying... (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
      }
      
      stableParamsRef.current.onConnectErrorHandler(err);
    };

    // Enhanced partner found handling
    const handlePartnerFound = (data: any) => {
      console.log('[VideoChatSocket] Partner found:', data?.partnerId);
      
      if (!data || !data.partnerId || !data.roomId) {
        console.error('[VideoChatSocket] Invalid partner found data:', data);
        return;
      }
      
      // Self-match prevention
      if (data.partnerId === socket.id || 
          (data.partnerAuthId && stableParamsRef.current.authId && data.partnerAuthId === stableParamsRef.current.authId)) {
        console.error('[VideoChatSocket] Self-match detected!', data);
        socket.emit('leaveChat', { roomId: data.roomId });
        return;
      }
      
      roomIdRef.current = data.roomId;
      stableParamsRef.current.onPartnerFound(data);
    };

    const handleReceiveMessage = (data: any) => {
      if (!data || !data.message || data.senderId === socket.id) {
        return;
      }
      stableParamsRef.current.onMessage(data);
    };

    const handlePartnerLeft = () => {
      console.log('[VideoChatSocket] Partner left');
      roomIdRef.current = null;
      stableParamsRef.current.onPartnerLeft();
    };

    const handleWebRTCSignal = (data: any) => {
      if (!data || !data.signalData || data.fromUser === socket.id) {
        return;
      }
      
      try {
        stableParamsRef.current.onWebRTCSignal(data.signalData);
      } catch (error) {
        console.error('[VideoChatSocket] Error in WebRTC signal handler:', error);
      }
    };

    const handleBatchedMessages = (messages: Array<{ event: string; data: any }>) => {
      if (!Array.isArray(messages)) return;
      
      messages.forEach(({ event, data }) => {
        try {
          // Prevent self-messages
          if ((event === 'receiveMessage' || event === 'webrtcSignal') && 
              (data?.senderId === socket.id || data?.fromUser === socket.id)) {
            return;
          }
          
          switch (event) {
            case 'receiveMessage':
              handleReceiveMessage(data);
              break;
            case 'partner_typing_start':
              stableParamsRef.current.onTypingStart();
              break;
            case 'partner_typing_stop':
              stableParamsRef.current.onTypingStop();
              break;
            case 'webrtcSignal':
              handleWebRTCSignal(data);
              break;
            case 'partnerStatusChanged':
              if (data?.status) {
                stableParamsRef.current.onStatusChange(data.status);
              }
              break;
          }
        } catch (error) {
          console.error('[VideoChatSocket] Error processing batched message:', error);
        }
      });
    };

    const handleHeartbeat = (data: any) => {
      if (data?.timestamp) {
        socket.emit('heartbeat_response', {
          clientTime: Date.now(),
          received: data.timestamp,
          chatType: 'video',
          tabId: tabIdRef.current
        });
      }
    };

    // Attach all event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('partnerFound', handlePartnerFound);
    socket.on('receiveMessage', handleReceiveMessage);
    socket.on('partnerLeft', handlePartnerLeft);
    socket.on('webrtcSignal', handleWebRTCSignal);
    socket.on('partner_typing_start', stableParamsRef.current.onTypingStart);
    socket.on('partner_typing_stop', stableParamsRef.current.onTypingStop);
    socket.on('waitingForPartner', stableParamsRef.current.onWaiting);
    socket.on('findPartnerCooldown', stableParamsRef.current.onCooldown);
    socket.on('batchedMessages', handleBatchedMessages);
    socket.on('heartbeat', handleHeartbeat);
  }, []);

  // ✅ FIXED: Initialize connection once
  useEffect(() => {
    if (isDestroyedRef.current) return;
    
    initializeConnection();

    return () => {
      isDestroyedRef.current = true;
      cleanup();
    };
  }, []); // Empty deps - initialize once

  const cleanup = useCallback(() => {
    console.log('[VideoChatSocket] Cleaning up connection');
    
    isDestroyedRef.current = true;
    isInitializedRef.current = false;
    
    // Leave room if connected
    if (roomIdRef.current && socketRef.current?.connected) {
      try {
        socketRef.current.emit('leaveChat', { 
          roomId: roomIdRef.current,
          tabId: tabIdRef.current,
          reason: 'component_cleanup'
        });
      } catch (error) {
        console.warn('[VideoChatSocket] Error leaving chat:', error);
      }
    }
    
    // Remove global function
    if (typeof window !== 'undefined') {
      delete window.videoChatEmitWebRTCSignal;
    }
    
    // Clean up socket
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    roomIdRef.current = null;
    tabIdRef.current = null;
    setIsConnected(false);
    setIsConnecting(false);
    setConnectionError(null);
  }, []);

  // ✅ Emit functions with validation
  const emitFindPartner = useCallback((payload: {
    chatType: 'text' | 'video';
    interests: string[];
    authId?: string | null;
  }) => {
    if (!socketRef.current?.connected || payload.chatType !== 'video') {
      return false;
    }
    
    try {
      socketRef.current.emit('findPartner', {
        ...payload,
        tabId: tabIdRef.current,
        socketId: socketRef.current.id,
        timestamp: Date.now()
      });
      return true;
    } catch (error) {
      console.error('[VideoChatSocket] Error emitting findPartner:', error);
      return false;
    }
  }, []);

  const emitMessage = useCallback((payload: {
    roomId: string;
    message: string;
    username?: string | null;
    authId?: string | null;
  }) => {
    if (!socketRef.current?.connected || !roomIdRef.current || !payload?.message?.trim()) {
      return false;
    }
    
    try {
      socketRef.current.emit('sendMessage', {
        ...payload,
        roomId: roomIdRef.current,
        tabId: tabIdRef.current,
        socketId: socketRef.current.id
      });
      return true;
    } catch (error) {
      console.error('[VideoChatSocket] Error sending message:', error);
      return false;
    }
  }, []);

  const emitTypingStart = useCallback(() => {
    if (socketRef.current?.connected && roomIdRef.current) {
      try {
        socketRef.current.emit('typing_start', { 
          roomId: roomIdRef.current,
          tabId: tabIdRef.current
        });
        return true;
      } catch (error) {
        console.error('[VideoChatSocket] Error starting typing:', error);
      }
    }
    return false;
  }, []);

  const emitTypingStop = useCallback(() => {
    if (socketRef.current?.connected && roomIdRef.current) {
      try {
        socketRef.current.emit('typing_stop', { 
          roomId: roomIdRef.current,
          tabId: tabIdRef.current
        });
        return true;
      } catch (error) {
        console.error('[VideoChatSocket] Error stopping typing:', error);
      }
    }
    return false;
  }, []);

  const emitLeaveChat = useCallback(() => {
    if (socketRef.current?.connected && roomIdRef.current) {
      try {
        socketRef.current.emit('leaveChat', { 
          roomId: roomIdRef.current,
          tabId: tabIdRef.current,
          reason: 'user_requested'
        });
        roomIdRef.current = null;
        return true;
      } catch (error) {
        console.error('[VideoChatSocket] Error leaving chat:', error);
      }
    }
    return false;
  }, []);

  const getConnectionHealth = useCallback(() => {
    return {
      isConnected,
      connectionError,
      isConnecting,
      socketId: socketRef.current?.id || null,
      tabId: tabIdRef.current,
      roomId: roomIdRef.current,
      reconnectAttempts: reconnectAttemptsRef.current,
      transport: socketRef.current?.io?.engine?.transport?.name || null
    };
  }, [isConnected, connectionError, isConnecting]);

  return {
    // State
    socket: socketRef.current,
    isConnected,
    connectionError,
    isConnecting,
    roomId: roomIdRef.current,
    tabId: tabIdRef.current,
    
    // Emit functions
    emitFindPartner,
    emitMessage,
    emitTypingStart,
    emitTypingStop,
    emitLeaveChat,
    
    // Utilities
    getConnectionHealth
  };
}