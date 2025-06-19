// src/app/chat/hooks/useSocketEmitters.ts - ENHANCED WITH SKIP FUNCTIONALITY

import { useCallback } from 'react';
import type { Socket } from 'socket.io-client';

export const useSocketEmitters = (
  socket: Socket | null, 
  roomIdRef: React.MutableRefObject<string | null>
) => {
  const emitFindPartner = useCallback((payload: {
    chatType: 'text' | 'video';
    interests: string[];
    authId?: string | null;
  }) => {
    if (!socket?.connected) {
      console.warn('[SocketEmitters] Not connected to server');
      return false;
    }
    
    console.log('[SocketEmitters] Finding partner');
    try {
      socket.emit('findPartner', payload);
      return true;
    } catch (error) {
      console.error('[SocketEmitters] Error emitting findPartner:', error);
      return false;
    }
  }, [socket]);

  // ✅ NEW: Skip partner emit function
  const emitSkipPartner = useCallback((payload: {
    chatType: 'text' | 'video';
    interests: string[];
    authId?: string | null;
    reason?: string;
  }) => {
    if (!socket?.connected) {
      console.warn('[SocketEmitters] Not connected to server');
      return false;
    }
    
    if (!roomIdRef.current) {
      console.warn('[SocketEmitters] Not in a chat room');
      return false;
    }
    
    console.log('[SocketEmitters] Skipping partner and searching for new one');
    try {
      // ✅ CRITICAL: Emit skip event with auto-search
      socket.emit('skipPartner', {
        roomId: roomIdRef.current,
        ...payload,
        autoSearch: true, // ✅ Tell server to auto-search for this user
        skipperAuthId: payload.authId // ✅ Identify who initiated the skip
      });
      
      // Clear room ID since we're leaving
      roomIdRef.current = null;
      return true;
    } catch (error) {
      console.error('[SocketEmitters] Error emitting skipPartner:', error);
      return false;
    }
  }, [socket, roomIdRef]);

  const emitMessage = useCallback((payload: {
    roomId: string;
    message: string;
    username?: string | null;
    authId?: string | null;
  }) => {
    if (!socket?.connected) {
      console.warn('[SocketEmitters] Not connected to server');
      return false;
    }
    
    if (!roomIdRef.current) {
      console.warn('[SocketEmitters] Not in a chat room');
      return false;
    }
    
    try {
      socket.emit('sendMessage', {
        ...payload,
        roomId: roomIdRef.current
      });
      return true;
    } catch (error) {
      console.error('[SocketEmitters] Error emitting message:', error);
      return false;
    }
  }, [socket, roomIdRef]);

  const emitTypingStart = useCallback(() => {
    if (socket?.connected && roomIdRef.current) {
      try {
        socket.emit('typing_start', { roomId: roomIdRef.current });
        return true;
      } catch (error) {
        console.error('[SocketEmitters] Error emitting typing start:', error);
      }
    }
    return false;
  }, [socket, roomIdRef]);

  const emitTypingStop = useCallback(() => {
    if (socket?.connected && roomIdRef.current) {
      try {
        socket.emit('typing_stop', { roomId: roomIdRef.current });
        return true;
      } catch (error) {
        console.error('[SocketEmitters] Error emitting typing stop:', error);
      }
    }
    return false;
  }, [socket, roomIdRef]);

  const emitLeaveChat = useCallback(() => {
    if (socket?.connected && roomIdRef.current) {
      console.log('[SocketEmitters] Leaving chat room');
      try {
        socket.emit('leaveChat', { roomId: roomIdRef.current });
        roomIdRef.current = null;
        return true;
      } catch (error) {
        console.error('[SocketEmitters] Error emitting leave chat:', error);
      }
    }
    return false;
  }, [socket, roomIdRef]);

  // ✅ NEW: Disconnect without auto-search
  const emitDisconnectOnly = useCallback(() => {
    if (socket?.connected && roomIdRef.current) {
      console.log('[SocketEmitters] Disconnecting without auto-search');
      try {
        socket.emit('disconnectOnly', { 
          roomId: roomIdRef.current,
          reason: 'manual_disconnect'
        });
        roomIdRef.current = null;
        return true;
      } catch (error) {
        console.error('[SocketEmitters] Error emitting disconnect only:', error);
      }
    }
    return false;
  }, [socket, roomIdRef]);

  const emitWebRTCSignal = useCallback((payload: {
    roomId: string;
    signalData: any;
  }) => {
    if (socket?.connected && roomIdRef.current) {
      try {
        socket.emit('webrtcSignal', {
          roomId: roomIdRef.current,
          signalData: payload.signalData
        });
        return true;
      } catch (error) {
        console.error('[SocketEmitters] Error emitting WebRTC signal:', error);
      }
    }
    return false;
  }, [socket, roomIdRef]);

  const emitUpdateStatus = useCallback((status: 'online' | 'idle' | 'dnd' | 'offline') => {
    if (socket?.connected) {
      try {
        socket.emit('updateStatus', { status });
        return true;
      } catch (error) {
        console.error('[SocketEmitters] Error emitting status update:', error);
      }
    }
    return false;
  }, [socket]);

  // ✅ NEW: Report user functionality
  const emitReportUser = useCallback((payload: {
    reportedAuthId: string;
    reason: string;
    description?: string;
  }) => {
    if (socket?.connected) {
      try {
        socket.emit('reportUser', {
          ...payload,
          roomId: roomIdRef.current,
          timestamp: Date.now()
        });
        return true;
      } catch (error) {
        console.error('[SocketEmitters] Error emitting user report:', error);
      }
    }
    return false;
  }, [socket, roomIdRef]);

  return {
    emitFindPartner,
    emitSkipPartner,     // ✅ NEW: Skip with auto-search
    emitMessage,
    emitTypingStart,
    emitTypingStop,
    emitLeaveChat,
    emitDisconnectOnly,  // ✅ NEW: Disconnect without auto-search
    emitWebRTCSignal,
    emitUpdateStatus,
    emitReportUser       // ✅ NEW: Report functionality
  };
};