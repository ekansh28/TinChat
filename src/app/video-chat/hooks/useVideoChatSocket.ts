// src/app/video-chat/hooks/useVideoChatSocket.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { showChatToast } from '../../chat/utils/ChatHelpers';

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
  setRoomId: (roomId: string | null) => void;
}

export function useVideoChatSocket({
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
  onConnectErrorHandler,
  authId,
  roomId,
  setRoomId
}: UseVideoChatSocketParams) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const roomIdRef = useRef<string | null>(null);

  // Update room ID ref when it changes
  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    const socketServerUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL;
    
    if (!socketServerUrl) {
      const error = 'Socket server URL not configured';
      console.error(error);
      setConnectionError(error);
      return;
    }

    console.log('Connecting to video chat socket server:', socketServerUrl);
    
    const socket = io(socketServerUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000
    });
    
    socketRef.current = socket;

    // Set up WebRTC signal emission function on window
    window.videoChatEmitWebRTCSignal = (data) => {
      if (socket.connected) {
        socket.emit('webrtcSignal', data);
      }
    };

    // Connection events
    socket.on('connect', () => {
      console.log('Video chat socket connected:', socket.id);
      setIsConnected(true);
      setConnectionError(null);
    });

    socket.on('disconnect', (reason) => {
      console.log('Video chat socket disconnected:', reason);
      setIsConnected(false);
      setRoomId(null);
      onDisconnectHandler(reason);
    });

    socket.on('connect_error', (err) => {
      console.error('Video chat socket connection error:', err);
      setIsConnected(false);
      setConnectionError(err.message);
      onConnectErrorHandler(err);
    });

    // Video chat events
    socket.on('partnerFound', ({ 
      partnerId, 
      roomId: newRoomId, 
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
      console.log('Video chat partner found:', { partnerId, roomId: newRoomId });
      setRoomId(newRoomId);
      onPartnerFound({
        partnerId,
        roomId: newRoomId,
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
      console.log('Video chat message received:', { senderId, message });
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
      console.log('Video chat partner left');
      setRoomId(null);
      onPartnerLeft();
    });

    socket.on('partnerStatusChanged', ({ status }) => {
      console.log('Video chat partner status changed:', status);
      onStatusChange(status);
    });

    // WebRTC signaling
    socket.on('webrtcSignal', (signalData) => {
      console.log('Video chat WebRTC signal received:', signalData.type || 'candidate');
      onWebRTCSignal(signalData);
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
      console.log('Cleaning up video chat socket connection');
      if (roomIdRef.current && socket.connected) {
        socket.emit('leaveChat', { roomId: roomIdRef.current });
      }
      delete window.videoChatEmitWebRTCSignal;
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
    onWebRTCSignal,
    onWaiting,
    onCooldown,
    onDisconnectHandler,
    onConnectErrorHandler,
    setRoomId
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
    
    console.log('Finding video chat partner with payload:', payload);
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
      showChatToast.messageError('Not in a video chat room');
      return false;
    }
    
    console.log('Sending video chat message:', payload);
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
      console.log('Leaving video chat room:', roomIdRef.current);
      socketRef.current.emit('leaveChat', { roomId: roomIdRef.current });
      setRoomId(null);
      return true;
    }
    return false;
  }, [setRoomId]);

  const emitWebRTCSignal = useCallback((payload: {
    roomId: string;
    signalData: any;
  }) => {
    if (socketRef.current?.connected) {
      console.log('Emitting WebRTC signal:', payload.signalData.type || 'candidate');
      socketRef.current.emit('webrtcSignal', payload);
      return true;
    }
    return false;
  }, []);

  const emitUpdateStatus = useCallback((status: 'online' | 'idle' | 'dnd' | 'offline') => {
    if (socketRef.current?.connected && authId) {
      console.log('Updating video chat status:', status);
      socketRef.current.emit('updateStatus', { status });
      return true;
    }
    return false;
  }, [authId]);

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
    emitWebRTCSignal,
    emitUpdateStatus
  };
}