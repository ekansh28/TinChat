
// src/app/chat/hooks/useSocketEmitters.ts - Emit Functions
import { useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import { showChatToast } from '../utils/ChatHelpers';

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
      showChatToast.connectionError('Not connected to server');
      return false;
    }
    
    console.log('[SocketEmitters] Finding partner');
    socket.emit('findPartner', payload);
    return true;
  }, [socket]);

  const emitMessage = useCallback((payload: {
    roomId: string;
    message: string;
    username?: string | null;
    authId?: string | null;
  }) => {
    if (!socket?.connected) {
      showChatToast.connectionError('Not connected to server');
      return false;
    }
    
    if (!roomIdRef.current) {
      showChatToast.messageError('Not in a chat room');
      return false;
    }
    
    socket.emit('sendMessage', {
      ...payload,
      roomId: roomIdRef.current
    });
    return true;
  }, [socket, roomIdRef]);

  const emitTypingStart = useCallback(() => {
    if (socket?.connected && roomIdRef.current) {
      socket.emit('typing_start', { roomId: roomIdRef.current });
      return true;
    }
    return false;
  }, [socket, roomIdRef]);

  const emitTypingStop = useCallback(() => {
    if (socket?.connected && roomIdRef.current) {
      socket.emit('typing_stop', { roomId: roomIdRef.current });
      return true;
    }
    return false;
  }, [socket, roomIdRef]);

  const emitLeaveChat = useCallback(() => {
    if (socket?.connected && roomIdRef.current) {
      console.log('[SocketEmitters] Leaving chat room');
      socket.emit('leaveChat', { roomId: roomIdRef.current });
      roomIdRef.current = null;
      return true;
    }
    return false;
  }, [socket, roomIdRef]);

  const emitWebRTCSignal = useCallback((payload: {
    roomId: string;
    signalData: any;
  }) => {
    if (socket?.connected && roomIdRef.current) {
      socket.emit('webrtcSignal', {
        roomId: roomIdRef.current,
        signalData: payload.signalData
      });
      return true;
    }
    return false;
  }, [socket, roomIdRef]);

  const emitUpdateStatus = useCallback((status: 'online' | 'idle' | 'dnd' | 'offline') => {
    if (socket?.connected) {
      socket.emit('updateStatus', { status });
      return true;
    }
    return false;
  }, [socket]);

  return {
    emitFindPartner,
    emitMessage,
    emitTypingStart,
    emitTypingStop,
    emitLeaveChat,
    emitWebRTCSignal,
    emitUpdateStatus
  };
};