
// src/app/chat/hooks/useSocketEvents.ts - Event Management
import { useCallback, useRef } from 'react';
import type { Socket } from 'socket.io-client';

interface SocketHandlers {
  onMessage: (data: any) => void;
  onPartnerFound: (data: any) => void;
  onPartnerLeft: () => void;
  onStatusChange: (status: string) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  onWaiting: () => void;
  onCooldown: () => void;
  onWebRTCSignal?: (data: any) => void;
}

export const useSocketEvents = (handlers: SocketHandlers) => {
  const handlersRef = useRef(handlers);
  
  // Update handlers without recreating socket
  handlersRef.current = handlers;

  const setupEvents = useCallback((socket: Socket, roomIdRef: React.MutableRefObject<string | null>) => {
    // Chat events
    const handlePartnerFound = (data: any) => {
      console.log('[SocketEvents] Partner found:', data.partnerId);
      roomIdRef.current = data.roomId;
      handlersRef.current.onPartnerFound(data);
    };

    const handleReceiveMessage = (data: any) => {
      console.log('[SocketEvents] Message received');
      handlersRef.current.onMessage(data);
    };

    const handlePartnerLeft = () => {
      console.log('[SocketEvents] Partner left');
      roomIdRef.current = null;
      handlersRef.current.onPartnerLeft();
    };

    const handlePartnerStatusChanged = (data: any) => {
      handlersRef.current.onStatusChange(data.status);
    };

    const handleWebRTCSignal = (data: any) => {
      handlersRef.current.onWebRTCSignal?.(data.signalData);
    };

    const handleTypingStart = () => handlersRef.current.onTypingStart();
    const handleTypingStop = () => handlersRef.current.onTypingStop();
    const handleWaitingForPartner = () => handlersRef.current.onWaiting();
    const handleFindPartnerCooldown = () => handlersRef.current.onCooldown();

    const handleBatchedMessages = (messages: Array<{ event: string; data: any }>) => {
      messages.forEach(({ event, data }) => {
        switch (event) {
          case 'receiveMessage':
            handleReceiveMessage(data);
            break;
          case 'partnerStatusChanged':
            handlePartnerStatusChanged(data);
            break;
          case 'partner_typing_start':
            handleTypingStart();
            break;
          case 'partner_typing_stop':
            handleTypingStop();
            break;
        }
      });
    };

    const handleHeartbeat = (data: any) => {
      socket.emit('heartbeat_response', {
        clientTime: Date.now(),
        received: data.timestamp
      });
    };

    const handleConnectionWarning = (data: any) => {
      console.warn('[SocketEvents] Connection warning:', data);
      if (data.type === 'stale_connection') {
        socket.emit('connection_health', {
          latency: Date.now() - data.timestamp,
          clientTime: Date.now()
        });
      }
    };

    // Attach all events
    socket.on('partnerFound', handlePartnerFound);
    socket.on('receiveMessage', handleReceiveMessage);
    socket.on('partnerLeft', handlePartnerLeft);
    socket.on('partnerStatusChanged', handlePartnerStatusChanged);
    socket.on('partner_typing_start', handleTypingStart);
    socket.on('partner_typing_stop', handleTypingStop);
    socket.on('waitingForPartner', handleWaitingForPartner);
    socket.on('findPartnerCooldown', handleFindPartnerCooldown);
    socket.on('batchedMessages', handleBatchedMessages);
    socket.on('heartbeat', handleHeartbeat);
    socket.on('connection_warning', handleConnectionWarning);

    if (handlersRef.current.onWebRTCSignal) {
      socket.on('webrtcSignal', handleWebRTCSignal);
    }

    return () => {
      socket.off('partnerFound', handlePartnerFound);
      socket.off('receiveMessage', handleReceiveMessage);
      socket.off('partnerLeft', handlePartnerLeft);
      socket.off('partnerStatusChanged', handlePartnerStatusChanged);
      socket.off('partner_typing_start', handleTypingStart);
      socket.off('partner_typing_stop', handleTypingStop);
      socket.off('waitingForPartner', handleWaitingForPartner);
      socket.off('findPartnerCooldown', handleFindPartnerCooldown);
      socket.off('batchedMessages', handleBatchedMessages);
      socket.off('heartbeat', handleHeartbeat);
      socket.off('connection_warning', handleConnectionWarning);
      if (handlersRef.current.onWebRTCSignal) {
        socket.off('webrtcSignal', handleWebRTCSignal);
      }
    };
  }, []);

  return { setupEvents };
};