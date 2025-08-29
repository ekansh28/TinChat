// src/app/chat/hooks/useSocketEmitters.ts - FIXED WITH STOP SEARCH EMIT

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
    sessionId?: string;
    timestamp?: number;
  }) => {
    if (!socket?.connected) {
      console.warn('[SocketEmitters] Not connected to server');
      return false;
    }
    
    console.log('[SocketEmitters] Finding partner with payload:', payload);
    try {
      socket.emit('findPartner', payload);
      return true;
    } catch (error) {
      console.error('[SocketEmitters] Error emitting findPartner:', error);
      return false;
    }
  }, [socket]);

  // ✅ NEW: Stop searching function - removes user from server queue
  const emitStopSearching = useCallback((payload?: {
    authId?: string | null;
    reason?: string;
  }) => {
    if (!socket?.connected) {
      console.warn('[SocketEmitters] Not connected to server - cannot stop search');
      return false;
    }
    
    console.log('[SocketEmitters] Stopping search and removing from queue');
    try {
      socket.emit('stopSearching', {
        authId: payload?.authId,
        reason: payload?.reason || 'manual_stop',
        timestamp: Date.now()
      });
      return true;
    } catch (error) {
      console.error('[SocketEmitters] Error emitting stopSearching:', error);
      return false;
    }
  }, [socket]);

  // ✅ CRITICAL: Skip partner emit function - ONLY auto-searches for the skipper
  const emitSkipPartner = useCallback((payload: {
    chatType: 'text' | 'video';
    interests: string[];
    authId?: string | null;
    reason?: string;
  }) => {
    if (!socket?.connected) {
      console.warn('[SocketEmitters] Not connected to server - cannot skip');
      return false;
    }
    
    if (!roomIdRef.current) {
      console.warn('[SocketEmitters] Not in a chat room - cannot skip');
      return false;
    }
    
    console.log('[SocketEmitters] Skipping partner and auto-searching for new one');
    try {
      // ✅ CRITICAL: Emit skip event that auto-searches for the skipper only
      socket.emit('skipPartner', {
        roomId: roomIdRef.current,
        chatType: payload.chatType,
        interests: payload.interests,
        authId: payload.authId,
        reason: payload.reason || 'skip',
        autoSearchForSkipper: true, // ✅ Only auto-search for the person who skipped
        skipperAuthId: payload.authId, // ✅ Identify who initiated the skip
        timestamp: Date.now()
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
      // ✅ CRITICAL FIX: Add UUID to prevent duplicate message processing
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      socket.emit('sendMessage', {
        ...payload,
        roomId: roomIdRef.current,
        messageId // ✅ Unique ID for deduplication
      });
      
      console.log(`[SocketEmitters] Message sent with ID: ${messageId}`);
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

  // ✅ STANDARD: Leave chat without auto-search (for normal disconnects)
  const emitLeaveChat = useCallback(() => {
    if (socket?.connected && roomIdRef.current) {
      console.log('[SocketEmitters] Leaving chat room normally');
      try {
        socket.emit('leaveChat', { 
          roomId: roomIdRef.current,
          reason: 'normal_leave'
        });
        roomIdRef.current = null;
        return true;
      } catch (error) {
        console.error('[SocketEmitters] Error emitting leave chat:', error);
      }
    }
    return false;
  }, [socket, roomIdRef]);

  // ✅ NEW: Disconnect without auto-search (for manual disconnects)
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
    emitStopSearching,    // ✅ NEW: Stop searching and remove from queue
    emitSkipPartner,      // ✅ Skip with auto-search for skipper only
    emitMessage,
    emitTypingStart,
    emitTypingStop,
    emitLeaveChat,        // ✅ Normal leave without auto-search
    emitDisconnectOnly,   // ✅ Disconnect without auto-search
    emitWebRTCSignal,
    emitUpdateStatus,
    emitReportUser
  };
};