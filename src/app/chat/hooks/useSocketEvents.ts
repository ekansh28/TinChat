// src/app/chat/hooks/useSocketEvents.ts - COMPLETELY FIXED WITH ALL SERVER EVENTS

import { useCallback, useRef } from 'react';
import type { Socket } from 'socket.io-client';

interface SocketHandlers {
  onMessage: (data: any) => void;
  onPartnerFound: (data: any) => void;
  onPartnerLeft: () => void;
  onPartnerSkipped: (data: any) => void;
  onSkipConfirmed: (data: any) => void;
  onSearchStarted: (data: any) => void;
  onSearchStopped: (data: any) => void;
  onStatusChange: (status: string) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  onWaiting: (data: any) => void;
  onCooldown: (data: any) => void;
  onAlreadySearching: (data: any) => void;
  onSearchError: (data: any) => void;
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

    // ===== CHAT & MATCHING EVENTS =====
    
    const handlePartnerFound = (data: any) => {
      console.log('[SocketEvents] 🎉 Partner found:', data.partnerId);
      if (data?.roomId) {
        roomIdRef.current = data.roomId;
      }
      handlersRef.current.onPartnerFound(data);
    };

    const handleReceiveMessage = (data: any) => {
      console.log('[SocketEvents] 📨 Message received from partner');
      handlersRef.current.onMessage(data);
    };

    const handlePartnerLeft = () => {
      console.log('[SocketEvents] 👋 Partner left normally');
      roomIdRef.current = null;
      handlersRef.current.onPartnerLeft();
    };

    // ✅ CRITICAL: Handle being skipped by partner (NO AUTO-SEARCH)
    const handlePartnerSkippedYou = (data: any) => {
      console.log('[SocketEvents] 😞 You were skipped by partner:', data);
      roomIdRef.current = null;
      handlersRef.current.onPartnerSkipped(data);
    };

    // ✅ CRITICAL: Handle skip confirmation when YOU skip someone
    const handlePartnerSkipped = (data: any) => {
      console.log('[SocketEvents] ✅ You skipped someone - server response:', data);
      roomIdRef.current = null;
      handlersRef.current.onSkipConfirmed(data);
    };

    // ===== SEARCH STATE EVENTS =====
    
    const handleSearchStarted = (data: any) => {
      console.log('[SocketEvents] 🔍 Search started confirmed:', data);
      handlersRef.current.onSearchStarted(data);
    };

    const handleSearchStopped = (data: any) => {
      console.log('[SocketEvents] 🛑 Search stopped confirmed:', data);
      handlersRef.current.onSearchStopped(data);
    };

    const handleWaitingForPartner = (data: any) => {
      console.log('[SocketEvents] ⏳ Waiting for partner:', data);
      handlersRef.current.onWaiting(data);
    };

    const handleAlreadySearching = (data: any) => {
      console.log('[SocketEvents] ⚠️ Already searching:', data);
      handlersRef.current.onAlreadySearching(data);
    };

    const handleSearchError = (data: any) => {
      console.log('[SocketEvents] ❌ Search error:', data);
      handlersRef.current.onSearchError(data);
    };

    const handleFindPartnerCooldown = (data: any) => {
      console.log('[SocketEvents] ⏰ Find partner cooldown:', data);
      handlersRef.current.onCooldown(data);
    };

    // ===== PARTNER STATUS & INTERACTION EVENTS =====
    
    const handlePartnerStatusChanged = (data: any) => {
      if (data?.status) {
        console.log('[SocketEvents] 📊 Partner status changed:', data.status);
        handlersRef.current.onStatusChange(data.status);
      }
    };

    const handleTypingStart = () => {
      console.log('[SocketEvents] ⌨️ Partner started typing');
      handlersRef.current.onTypingStart();
    };

    const handleTypingStop = () => {
      console.log('[SocketEvents] ⌨️ Partner stopped typing');
      handlersRef.current.onTypingStop();
    };

    // ===== WEBRTC EVENTS =====
    
    const handleWebRTCSignal = (data: any) => {
      if (handlersRef.current.onWebRTCSignal && data?.signalData) {
        console.log('[SocketEvents] 🎥 WebRTC signal received');
        handlersRef.current.onWebRTCSignal(data.signalData);
      }
    };

    // ===== BATCH MESSAGE PROCESSING =====
    
    const handleBatchedMessages = (messages: Array<{ event: string; data: any }>) => {
      if (!Array.isArray(messages)) return;

      console.log('[SocketEvents] 📦 Processing batched messages:', messages.length);
      
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
            case 'partnerSkippedYou':
              handlePartnerSkippedYou(data);
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
              console.log('[SocketEvents] 🤷 Unknown batched event:', event);
          }
        } catch (error) {
          console.error('[SocketEvents] ❌ Error processing batched message:', error);
        }
      });
    };

    // ===== CONNECTION & HEALTH EVENTS =====
    
    const handleHeartbeat = (data: any) => {
      if (data?.timestamp) {
        socket.emit('heartbeat_response', {
          clientTime: Date.now(),
          received: data.timestamp
        });
      }
    };

    const handleConnectionWarning = (data: any) => {
      console.warn('[SocketEvents] ⚠️ Connection warning:', data);
      if (data?.type === 'stale_connection') {
        socket.emit('connection_health', {
          latency: Date.now() - (data.timestamp || Date.now()),
          clientTime: Date.now()
        });
      }
    };

    const handleConnect = () => {
      console.log('[SocketEvents] 🔌 Socket connected successfully');
    };

    const handleDisconnect = (reason: string) => {
      console.log('[SocketEvents] 🔌 Socket disconnected:', reason);
      roomIdRef.current = null;
    };

    const handleConnected = (data: any) => {
      console.log('[SocketEvents] ✅ Connected event received:', data);
    };

    // ===== ERROR HANDLING =====
    
    const handleError = (error: any) => {
      console.error('[SocketEvents] ❌ Socket error:', error);
    };

    const handleSkipError = (error: any) => {
      console.error('[SocketEvents] ❌ Skip error:', error);
    };

    // ===== ROOM MANAGEMENT =====
    
    const handleRoomJoined = (data: any) => {
      console.log('[SocketEvents] 🏠 Joined room:', data.roomId);
      if (data?.roomId) {
        roomIdRef.current = data.roomId;
      }
    };

    const handleRoomLeft = (data: any) => {
      console.log('[SocketEvents] 🏠 Left room:', data.roomId);
      roomIdRef.current = null;
    };

    // ===== MATCHMAKING & QUEUE EVENTS =====
    
    const handleMatchmakingUpdate = (data: any) => {
      console.log('[SocketEvents] 🎯 Matchmaking update:', data);
      if (data?.status === 'searching') {
        handlersRef.current.onWaiting(data);
      }
    };

    const handleQueueStatsUpdate = (data: any) => {
      console.log('[SocketEvents] 📊 Queue stats updated:', data);
    };

    const handleOnlineUserCountUpdate = (count: number) => {
      console.log('[SocketEvents] 👥 Online users count:', count);
    };

    // ===== STATUS UPDATE EVENTS =====
    
    const handleStatusUpdate = (data: any) => {
      console.log('[SocketEvents] 📊 Status update:', data);
      
      // Handle different status updates
      if (data.status === 'in_chat' && data.roomId) {
        roomIdRef.current = data.roomId;
      } else if (data.status === 'idle') {
        roomIdRef.current = null;
      }
    };

    const handleDisconnectConfirmed = (data: any) => {
      console.log('[SocketEvents] ✅ Disconnect confirmed:', data);
      roomIdRef.current = null;
    };

    const handleAutoSearchFailed = (data: any) => {
      console.log('[SocketEvents] ❌ Auto-search failed:', data);
      handlersRef.current.onSearchError(data);
    };

    const handleCleanupComplete = (data: any) => {
      console.log('[SocketEvents] 🧹 Cleanup complete:', data);
      roomIdRef.current = null;
    };

    // ===== EVENT REGISTRATION =====
    
    const eventHandlers = [
      // Connection events
      { event: 'connect', handler: handleConnect },
      { event: 'connected', handler: handleConnected },
      { event: 'disconnect', handler: handleDisconnect },
      
      // Chat and matching events
      { event: 'partnerFound', handler: handlePartnerFound },
      { event: 'receiveMessage', handler: handleReceiveMessage },
      { event: 'partnerLeft', handler: handlePartnerLeft },
      
      // Skip events (CRITICAL FOR SKIP LOGIC)
      { event: 'partnerSkippedYou', handler: handlePartnerSkippedYou }, // You got skipped (no auto-search)
      { event: 'partnerSkipped', handler: handlePartnerSkipped }, // You skipped someone (auto-search)
      
      // Search state events
      { event: 'searchStarted', handler: handleSearchStarted },
      { event: 'searchStopped', handler: handleSearchStopped },
      { event: 'waitingForPartner', handler: handleWaitingForPartner },
      { event: 'alreadySearching', handler: handleAlreadySearching },
      { event: 'searchError', handler: handleSearchError },
      { event: 'findPartnerCooldown', handler: handleFindPartnerCooldown },
      { event: 'autoSearchFailed', handler: handleAutoSearchFailed },
      
      // Partner interaction events
      { event: 'partnerStatusChanged', handler: handlePartnerStatusChanged },
      { event: 'partner_typing_start', handler: handleTypingStart },
      { event: 'partner_typing_stop', handler: handleTypingStop },
      
      // WebRTC events
      { event: 'webrtcSignal', handler: handleWebRTCSignal },
      
      // System events
      { event: 'heartbeat', handler: handleHeartbeat },
      { event: 'connectionWarning', handler: handleConnectionWarning },
      { event: 'batchedMessages', handler: handleBatchedMessages },
      
      // Room events
      { event: 'roomJoined', handler: handleRoomJoined },
      { event: 'roomLeft', handler: handleRoomLeft },
      
      // Status events
      { event: 'statusUpdate', handler: handleStatusUpdate },
      { event: 'disconnectConfirmed', handler: handleDisconnectConfirmed },
      { event: 'cleanupComplete', handler: handleCleanupComplete },
      
      // Matchmaking events
      { event: 'matchmakingUpdate', handler: handleMatchmakingUpdate },
      { event: 'queueStatsUpdate', handler: handleQueueStatsUpdate },
      { event: 'onlineUserCountUpdate', handler: handleOnlineUserCountUpdate },
      
      // Error events
      { event: 'error', handler: handleError },
      { event: 'skipError', handler: handleSkipError }
    ];

    // Register all event handlers
    eventHandlers.forEach(({ event, handler }) => {
      socket.on(event, handler);
      eventListenersRef.current.push({ event, handler });
    });

    console.log('[SocketEvents] ✅ All event handlers registered:', eventHandlers.length);

  }, []);

  const cleanupEvents = useCallback((socket: Socket) => {
    eventListenersRef.current.forEach(({ event, handler }) => {
      socket.off(event, handler);
    });
    eventListenersRef.current = [];
    console.log('[SocketEvents] 🧹 Event handlers cleaned up');
  }, []);

  return {
    setupEvents,
    cleanupEvents
  };
};