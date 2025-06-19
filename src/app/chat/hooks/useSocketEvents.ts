// src/app/chat/hooks/useSocketEvents.ts - ENHANCED WITH SKIP HANDLING

import { useCallback, useRef } from 'react';
import type { Socket } from 'socket.io-client';

interface SocketHandlers {
  onMessage: (data: any) => void;
  onPartnerFound: (data: any) => void;
  onPartnerLeft: () => void;
  onPartnerSkipped: (data: any) => void; // ✅ NEW: Handle being skipped
  onStatusChange: (status: string) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  onWaiting: () => void;
  onCooldown: () => void;
  onWebRTCSignal?: (data: any) => void;
}

export const useSocketEvents = (handlers: SocketHandlers) => {
  const handlersRef = useRef(handlers);
  const eventListenersRef = useRef<Array<{ event: string; handler: (...args: any[]) => void }>>([]);
  
  // Update handlers without recreating socket
  handlersRef.current = handlers;

  const setupEvents = useCallback((socket: Socket, roomIdRef: React.MutableRefObject<string | null>) => {
    // Clear any existing listeners
    eventListenersRef.current.forEach(({ event, handler }) => {
      socket.off(event, handler);
    });
    eventListenersRef.current = [];

    // Chat events
    const handlePartnerFound = (data: any) => {
      console.log('[SocketEvents] Partner found:', data.partnerId);
      if (data?.roomId) {
        roomIdRef.current = data.roomId;
      }
      handlersRef.current.onPartnerFound(data);
    };

    const handleReceiveMessage = (data: any) => {
      console.log('[SocketEvents] Message received');
      handlersRef.current.onMessage(data);
    };

    const handlePartnerLeft = () => {
      console.log('[SocketEvents] Partner left normally');
      roomIdRef.current = null;
      handlersRef.current.onPartnerLeft();
    };

    // ✅ NEW: Handle being skipped by partner
    const handlePartnerSkipped = (data: any) => {
      console.log('[SocketEvents] You were skipped by partner:', data);
      roomIdRef.current = null;
      
      // ✅ CRITICAL: Pass skip data to handler for different UI behavior
      handlersRef.current.onPartnerSkipped?.(data);
    };

    // ✅ NEW: Handle skip confirmation (when you skip someone)
    const handleSkipConfirmed = (data: any) => {
      console.log('[SocketEvents] Skip confirmed, searching for new partner:', data);
      
      // ✅ The server should automatically start finding a new partner for the skipper
      if (data?.searchingForNew) {
        console.log('[SocketEvents] Server is finding new partner after skip');
      }
    };

    const handlePartnerStatusChanged = (data: any) => {
      if (data?.status) {
        handlersRef.current.onStatusChange(data.status);
      }
    };

    const handleWebRTCSignal = (data: any) => {
      if (handlersRef.current.onWebRTCSignal && data?.signalData) {
        handlersRef.current.onWebRTCSignal(data.signalData);
      }
    };

    const handleTypingStart = () => handlersRef.current.onTypingStart();
    const handleTypingStop = () => handlersRef.current.onTypingStop();
    const handleWaitingForPartner = () => handlersRef.current.onWaiting();
    const handleFindPartnerCooldown = () => handlersRef.current.onCooldown();

    // ✅ NEW: Handle automatic partner search after skip
    const handleAutoSearchStarted = (data: any) => {
      console.log('[SocketEvents] Auto-search started after skip:', data);
      handlersRef.current.onWaiting?.();
    };

    const handleBatchedMessages = (messages: Array<{ event: string; data: any }>) => {
      if (!Array.isArray(messages)) return;

      messages.forEach(({ event, data }) => {
        try {
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
            case 'partnerSkipped':
              handlePartnerSkipped(data);
              break;
            case 'webrtcSignal':
              if (handlersRef.current.onWebRTCSignal) {
                handleWebRTCSignal(data);
              }
              break;
            default:
              console.log('[SocketEvents] Unknown batched event:', event);
          }
        } catch (error) {
          console.error('[SocketEvents] Error processing batched message:', error);
        }
      });
    };

    const handleHeartbeat = (data: any) => {
      if (data?.timestamp) {
        socket.emit('heartbeat_response', {
          clientTime: Date.now(),
          received: data.timestamp
        });
      }
    };

    const handleConnectionWarning = (data: any) => {
      console.warn('[SocketEvents] Connection warning:', data);
      if (data?.type === 'stale_connection') {
        socket.emit('connection_health', {
          latency: Date.now() - (data.timestamp || Date.now()),
          clientTime: Date.now()
        });
      }
    };

    const handleError = (error: any) => {
      console.error('[SocketEvents] Socket error:', error);
    };

    // ✅ NEW: Handle skip-related errors
    const handleSkipError = (error: any) => {
      console.error('[SocketEvents] Skip error:', error);
      // Could show toast notification about skip failure
    };

    // ✅ NEW: Handle room management events
    const handleRoomJoined = (data: any) => {
      console.log('[SocketEvents] Joined room:', data.roomId);
      if (data?.roomId) {
        roomIdRef.current = data.roomId;
      }
    };

    const handleRoomLeft = (data: any) => {
      console.log('[SocketEvents] Left room:', data.roomId);
      roomIdRef.current = null;
    };

    // Store event handlers for cleanup
    const eventHandlers = [
      { event: 'partnerFound', handler: handlePartnerFound },
      { event: 'receiveMessage', handler: handleReceiveMessage },
      { event: 'partnerLeft', handler: handlePartnerLeft },
      { event: 'partnerSkipped', handler: handlePartnerSkipped }, // ✅ NEW
      { event: 'skipConfirmed', handler: handleSkipConfirmed }, // ✅ NEW
      { event: 'autoSearchStarted', handler: handleAutoSearchStarted }, // ✅ NEW
      { event: 'partnerStatusChanged', handler: handlePartnerStatusChanged },
      { event: 'partner_typing_start', handler: handleTypingStart },
      { event: 'partner_typing_stop', handler: handleTypingStop },
      { event: 'waitingForPartner', handler: handleWaitingForPartner },
      { event: 'findPartnerCooldown', handler: handleFindPartnerCooldown },
      { event: 'batchedMessages', handler: handleBatchedMessages },
      { event: 'heartbeat', handler: handleHeartbeat },
      { event: 'connection_warning', handler: handleConnectionWarning },
      { event: 'skipError', handler: handleSkipError }, // ✅ NEW
      { event: 'roomJoined', handler: handleRoomJoined }, // ✅ NEW
      { event: 'roomLeft', handler: handleRoomLeft }, // ✅ NEW
      { event: 'error', handler: handleError }
    ];

    // Add WebRTC signal handler if needed
    if (handlersRef.current.onWebRTCSignal) {
      eventHandlers.push({ event: 'webrtcSignal', handler: handleWebRTCSignal });
    }

    // Attach all event listeners
    eventHandlers.forEach(({ event, handler }) => {
      socket.on(event, handler);
      eventListenersRef.current.push({ event, handler });
    });

    console.log('[SocketEvents] Registered', eventHandlers.length, 'event handlers');

    // Return cleanup function
    return () => {
      eventListenersRef.current.forEach(({ event, handler }) => {
        socket.off(event, handler);
      });
      eventListenersRef.current = [];
      console.log('[SocketEvents] Cleaned up all event handlers');
    };
  }, []);

  return { setupEvents };
};