// src/app/chat/hooks/useChatSocket.ts - COMPLETE FIXED VERSION

import { useEffect, useRef, useCallback } from 'react';
import { useSocketCore } from './useSocketCore';
import { useSocketEvents } from './useSocketEvents';
import { useSocketEmitters } from './useSocketEmitters';

interface UseChatSocketParams {
  onMessage: (msg: any) => void;
  onPartnerFound: (partner: any) => void;
  onPartnerLeft: () => void;
  onPartnerSkipped: (data: any) => void;
  onSkipConfirmed: (data: any) => void;
  onStatusChange: (status: string) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  onWaiting: () => void;
  onCooldown: () => void;
  onDisconnectHandler: (reason: string) => void;
  onConnectErrorHandler: (err: Error) => void;
  authId?: string | null;
  roomId?: string | null;
  onWebRTCSignal?: (signalData: any) => void;
}

export function useChatSocket(params: UseChatSocketParams) {
  const roomIdRef = useRef<string | null>(params.roomId || null);
  const isInitializedRef = useRef(false);
  
  // Core socket management with proper server URL
  const socketCore = useSocketCore({
    socketServerUrl: process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:3001',
    onConnect: () => {
      console.log('[ChatSocket] Connected successfully');
    },
    onDisconnect: (reason: string) => {
      roomIdRef.current = null;
      params.onDisconnectHandler(reason);
    },
    onConnectError: (error: Error) => {
      params.onConnectErrorHandler(error);
    },
    debug: process.env.NODE_ENV === 'development'
  });

  // Event management with stable handlers including onSkipConfirmed
  const socketEvents = useSocketEvents({
    onMessage: params.onMessage,
    onPartnerFound: params.onPartnerFound,
    onPartnerLeft: params.onPartnerLeft,
    onPartnerSkipped: params.onPartnerSkipped,
    onSkipConfirmed: params.onSkipConfirmed,
    onStatusChange: params.onStatusChange,
    onTypingStart: params.onTypingStart,
    onTypingStop: params.onTypingStop,
    onWaiting: params.onWaiting,
    onCooldown: params.onCooldown,
    onWebRTCSignal: params.onWebRTCSignal
  });

  // Event management with stable handlers
  const setupEventsCallback = useCallback((socket: any, roomIdRef: any) => {
    return socketEvents.setupEvents(socket, roomIdRef);
  }, [socketEvents]);

  // Emit functions
  const emitters = useSocketEmitters(socketCore.socket, roomIdRef);

  // Update room ID reference
  useEffect(() => {
    roomIdRef.current = params.roomId || null;
  }, [params.roomId]);

  // Single initialization effect with proper cleanup
  useEffect(() => {
    if (isInitializedRef.current) return;
    
    console.log('[ChatSocket] Initializing socket connection');
    isInitializedRef.current = true;
    
    // Initialize socket connection
    const cleanup = socketCore.initializeSocket();
    
    return () => {
      isInitializedRef.current = false;
      if (cleanup) cleanup();
    };
  }, []); // Empty deps - initialize once

  // Setup events when socket is available
  useEffect(() => {
    if (socketCore.socket && socketCore.isInitialized) {
      console.log('[ChatSocket] Setting up socket events');
      
      // Setup WebRTC global function if needed
      if (params.onWebRTCSignal) {
        (window as any).videoChatEmitWebRTCSignal = (data: any) => {
          if (socketCore.socket?.connected && roomIdRef.current && data?.signalData) {
            socketCore.socket.emit('webrtcSignal', {
              roomId: roomIdRef.current,
              signalData: data.signalData
            });
          }
        };
      }

      const cleanup = setupEventsCallback(socketCore.socket, roomIdRef);
      
      return () => {
        cleanup();
        if (params.onWebRTCSignal) {
          delete (window as any).videoChatEmitWebRTCSignal;
        }
      };
    }
  }, [socketCore.socket, socketCore.isInitialized, setupEventsCallback, params.onWebRTCSignal]);

  // Utility functions
  const getOnlineUserCount = useCallback(() => {
    if (socketCore.socket?.connected) {
      socketCore.socket.emit('getOnlineUserCount');
      return true;
    }
    return false;
  }, [socketCore.socket]);
  
  const emitDebugRequest = useCallback(() => {
    if (socketCore.socket?.connected) {
      socketCore.socket.emit('getDebugInfo');
      return true;
    }
    return false;
  }, [socketCore.socket]);
  
  const checkConnectionHealth = useCallback(() => {
    if (!socketCore.socket?.connected) {
      return { healthy: false, reason: 'not_connected' };
    }

    const lastPong = (socketCore.socket as any).conn?.lastPong;
    const now = Date.now();
    const timeSinceLastPong = lastPong ? now - lastPong : 0;

    if (timeSinceLastPong > 90000) { // 90 seconds
      return { healthy: false, reason: 'stale_connection', timeSinceLastPong };
    }

    return { healthy: true, timeSinceLastPong };
  }, [socketCore.socket]);
  
  const getConnectionInfo = useCallback(() => ({
    isConnected: socketCore.isConnected,
    isConnecting: socketCore.isConnecting,
    connectionError: socketCore.connectionError,
    socketId: socketCore.socket?.id || null,
    roomId: roomIdRef.current,
    transport: socketCore.socket?.io?.engine?.transport?.name || null
  }), [socketCore.isConnected, socketCore.isConnecting, socketCore.connectionError, socketCore.socket]);

  return {
    // Core state
    socket: socketCore.socket,
    isConnected: socketCore.isConnected,
    connectionError: socketCore.connectionError,
    isConnecting: socketCore.isConnecting,
    roomId: roomIdRef.current,
    
    // Emitters
    ...emitters,
    
    // Utility functions
    getOnlineUserCount,
    emitDebugRequest,
    checkConnectionHealth,
    getConnectionInfo,
    
    // Core functions
    forceReconnect: socketCore.forceReconnect,
    destroySocket: socketCore.destroySocket
  };
}