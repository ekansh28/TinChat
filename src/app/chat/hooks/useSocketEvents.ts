// src/app/chat/hooks/useSocketEvents.ts - FIXED SKIP EVENT HANDLING

import { useCallback, useRef } from 'react';
import type { Socket } from 'socket.io-client';

interface SocketHandlers {
  onMessage: (data: any) => void;
  onPartnerFound: (data: any) => void;
  onPartnerLeft: () => void;
  onPartnerSkipped: (data: any) => void;
  onSkipConfirmed: (data: any) => void; // ✅ NEW: Handle skip confirmation
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

    // ✅ CRITICAL: Handle being skipped by partner (NO AUTO-SEARCH)
    const handlePartnerSkipped = (data: any) => {
      console.log('[SocketEvents] You were skipped by partner:', data);
      roomIdRef.current = null;
      
      // ✅ CRITICAL: The skipped user should NOT auto-search
      // They must manually click "Find" to search again
      handlersRef.current.onPartnerSkipped?.(data);
    };

    // ✅ NEW: Handle skip confirmation when YOU skip someone (AUTO-SEARCH)
    const handleSkipConfirmed = (data: any) => {
      console.log('[SocketEvents] Skip confirmed - you skipped someone:', data);
      
      // ✅ CRITICAL: When you skip someone, the server should auto-search for you
      if (data?.autoSearchStarted) {
        console.log('[SocketEvents] Auto-search started after you skipped someone');
        handlersRef.current.onWaiting?.(); // Trigger "waiting" state
      }
      
      // ✅ NEW: If server found immediate match after skip
      if (data?.immediateMatch) {
        console.log('[SocketEvents] Immediate match found after skip');
        handlePartnerFound(data.immediateMatch);
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
    const handleWaitingForPartner = () => {
      console.log('[SocketEvents] Waiting for partner');
      handlersRef.current.onWaiting();
    };
    const handleFindPartnerCooldown = () => {
      console.log('[SocketEvents] Find partner cooldown');
      handlersRef.current.onCooldown();
    };

    // ✅ NEW: Handle automatic partner search events
    const handleAutoSearchStarted = (data: any) => {
      console.log('[SocketEvents] Auto-search started:', data);
      handlersRef.current.onWaiting?.();
    };

    const handleAutoSearchFailed = (data: any) => {
      console.log('[SocketEvents] Auto-search failed:', data);
      // Could show error message or allow manual retry
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
            case 'skipConfirmed':
              handleSkipConfirmed(data);
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

    // ✅ NEW: Handle connection status events that might help with "Connecting..." issue
    const handleConnected = () => {
      console.log('[SocketEvents] Socket connected successfully');
    };

    const handleConnect = () => {
      console.log('[SocketEvents] Socket connect event');
    };

    const handleDisconnect = (reason: string) => {
      console.log('[SocketEvents] Socket disconnected:', reason);
      roomIdRef.current = null;
    };

    // ✅ NEW: Handle server-side matchmaking updates
    const handleMatchmakingUpdate = (data: any) => {
      console.log('[SocketEvents] Matchmaking update:', data);
      if (data?.status === 'searching') {
        handlersRef.current.onWaiting?.();
      }
    };

    // Store event handlers for cleanup
    const eventHandlers = [
      { event: 'connect', handler: handleConnect }, // ✅ NEW
      { event: 'connected', handler: handleConnected }, // ✅ NEW
      { event: 'disconnect', handler: handleDisconnect }, // ✅ NEW
      { event: 'partnerFound', handler: handlePartnerFound },
      { event: 'receiveMessage', handler: handleReceiveMessage },
      { event: 'partnerLeft', handler: handlePartnerLeft },
      { event: 'partnerSkipped', handler: handlePartnerSkipped }, // ✅ Being skipped (no auto-search)
      { event: 'skipConfirmed', handler: handleSkipConfirmed }, // ✅ You skipped someone (auto-search)
      { event: 'autoSearchStarted', handler: handleAutoSearchStarted }, // ✅ NEW
      { event: 'autoSearchFailed', handler: handleAutoSearchFailed }, // ✅ NEW
      { event: 'matchmakingUpdate', handler: handleMatchmakingUpdate }, // ✅ NEW
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