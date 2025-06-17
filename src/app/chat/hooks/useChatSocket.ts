// src/app/chat/hooks/useChatSocket.ts - SIMPLIFIED MODULAR VERSION
import { useEffect, useRef } from 'react';
import { useSocketCore } from './useSocketCore';
import { useSocketEvents } from './useSocketEvents';
import { useSocketEmitters } from './useSocketEmitters';

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
  onWebRTCSignal?: (signalData: any) => void;
}

export function useChatSocket(params: UseChatSocketParams) {
  const roomIdRef = useRef<string | null>(params.roomId || null);
  
  // ✅ MODULAR: Core socket management
  const socketCore = useSocketCore({
    socketServerUrl: process.env.NEXT_PUBLIC_SOCKET_SERVER_URL,
    onConnect: () => {
      console.log('[ChatSocket] Connected successfully');
    },
    onDisconnect: (reason: string) => {
      roomIdRef.current = null;
      params.onDisconnectHandler(reason);
    },
    onConnectError: (error: Error) => {
      params.onConnectErrorHandler(error);
    }
  });

  // ✅ MODULAR: Event management
  const { setupEvents } = useSocketEvents({
    onMessage: params.onMessage,
    onPartnerFound: params.onPartnerFound,
    onPartnerLeft: params.onPartnerLeft,
    onStatusChange: params.onStatusChange,
    onTypingStart: params.onTypingStart,
    onTypingStop: params.onTypingStop,
    onWaiting: params.onWaiting,
    onCooldown: params.onCooldown,
    onWebRTCSignal: params.onWebRTCSignal
  });

  // ✅ MODULAR: Emit functions
  const emitters = useSocketEmitters(socketCore.socket, roomIdRef);

  // ✅ Update room ID reference
  useEffect(() => {
    roomIdRef.current = params.roomId || null;
  }, [params.roomId]);

  // ✅ SIMPLIFIED: Single initialization effect
  useEffect(() => {
    console.log('[ChatSocket] Initializing socket');
    
    const cleanup = socketCore.initializeSocket();
    
    return () => {
      if (cleanup) cleanup();
      socketCore.destroySocket();
    };
  }, []); // Empty deps - initialize once

  // ✅ SIMPLIFIED: Setup events when socket is available
  useEffect(() => {
    if (socketCore.socket) {
      console.log('[ChatSocket] Setting up socket events');
      
      // Setup WebRTC global function if needed
      if (params.onWebRTCSignal) {
        (window as any).videoChatEmitWebRTCSignal = (data: any) => {
          if (socketCore.socket?.connected && roomIdRef.current) {
            socketCore.socket.emit('webrtcSignal', {
              roomId: roomIdRef.current,
              signalData: data.signalData
            });
          }
        };
      }

      const cleanup = setupEvents(socketCore.socket, roomIdRef);
      
      return () => {
        cleanup();
        delete (window as any).videoChatEmitWebRTCSignal;
      };
    }
  }, [socketCore.socket, setupEvents, params.onWebRTCSignal]);

  // ✅ Enhanced emit functions with room ID validation
  const enhancedEmitters = {
    ...emitters,
    emitWebRTCSignal: params.onWebRTCSignal ? emitters.emitWebRTCSignal : undefined,
    
    // Additional utility functions
    getOnlineUserCount: () => {
      if (socketCore.socket?.connected) {
        socketCore.socket.emit('getOnlineUserCount');
        return true;
      }
      return false;
    },
    
    emitDebugRequest: () => {
      if (socketCore.socket?.connected) {
        socketCore.socket.emit('getDebugInfo');
        return true;
      }
      return false;
    },
    
    checkConnectionHealth: () => {
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
    },
    
    getConnectionInfo: () => ({
      isConnected: socketCore.isConnected,
      isConnecting: socketCore.isConnecting,
      connectionError: socketCore.connectionError,
      socketId: socketCore.socket?.id || null,
      roomId: roomIdRef.current,
      transport: socketCore.socket?.io.engine.transport.name || null
    })
  };

  return {
    // Core state
    socket: socketCore.socket,
    isConnected: socketCore.isConnected,
    connectionError: socketCore.connectionError,
    isConnecting: socketCore.isConnecting,
    roomId: roomIdRef.current,
    
    // Enhanced emitters
    ...enhancedEmitters,
    
    // Core functions
    forceReconnect: socketCore.forceReconnect,
    destroySocket: socketCore.destroySocket
  };
}