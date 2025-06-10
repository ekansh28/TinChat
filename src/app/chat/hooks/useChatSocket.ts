import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

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
  onConnectErrorHandler
}: UseChatSocketParams) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
      transports: ['websocket'],
      withCredentials: true,
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('partnerFound', onPartnerFound);
    socket.on('receiveMessage', onMessage);
    socket.on('partnerLeft', onPartnerLeft);
    socket.on('partnerStatusChanged', ({ status }) => onStatusChange(status));
    socket.on('partner_typing_start', onTypingStart);
    socket.on('partner_typing_stop', onTypingStop);
    socket.on('waitingForPartner', onWaiting);
    socket.on('findPartnerCooldown', onCooldown);
    socket.on('disconnect', (reason) => {
      setConnected(false);
      onDisconnectHandler(reason);
    });
    socket.on('connect_error', onConnectErrorHandler);

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);

  const emitFindPartner = useCallback((payload: any) => {
    socketRef.current?.emit('findPartner', payload);
  }, []);

  const emitMessage = useCallback((msg: any) => {
    socketRef.current?.emit('sendMessage', msg);
  }, []);

  const emitTypingStart = () => socketRef.current?.emit('typing_start');
  const emitTypingStop = () => socketRef.current?.emit('typing_stop');
  const emitLeaveChat = (roomId: string) => socketRef.current?.emit('leaveChat', { roomId });

  return {
    socket: socketRef.current,
    isConnected,
    emitFindPartner,
    emitMessage,
    emitTypingStart,
    emitTypingStop,
    emitLeaveChat
  };
}
