// src/app/chat/hooks/useAutoSearch.ts - EXTRACTED AUTO-SEARCH LOGIC
import { useEffect } from 'react';

interface UseAutoSearchProps {
  socket: any;
  auth: any;
  chatState: any;
  interests: string[];
  initRef: React.MutableRefObject<{
    isInitialized: boolean;
    autoSearchStarted: boolean;
    sessionId: string;
  }>;
  setIsSelfDisconnectedRecently: (value: boolean) => void;
  setIsPartnerLeftRecently: (value: boolean) => void;
}

export const useAutoSearch = ({
  socket,
  auth,
  chatState,
  interests,
  initRef,
  setIsSelfDisconnectedRecently,
  setIsPartnerLeftRecently
}: UseAutoSearchProps) => {
  
  // ✅ CRITICAL FIX: Controlled auto-search with proper dependency management
  useEffect(() => {
    console.log('[AutoSearch] Effect triggered:', {
      autoSearchStarted: initRef.current.autoSearchStarted,
      isConnected: socket.isConnected,
      authLoading: auth.isLoading,
      isPartnerConnected: chatState.isPartnerConnected,
      isFindingPartner: chatState.isFindingPartner,
      authId: auth.authId,
      connectionError: socket.connectionError,
      isConnecting: socket.isConnecting
    });

    if (initRef.current.autoSearchStarted) {
      console.log('[AutoSearch] Already started, skipping');
      return;
    }

    // ✅ CRITICAL FIX: Enhanced readiness checks with proper delays
    const isSocketReady = socket.isConnected && !socket.connectionError && !socket.isConnecting;
    const isAuthReady = !auth.isLoading && auth.authId !== undefined;
    const isChatReady = !chatState.isPartnerConnected && !chatState.isFindingPartner;

    console.log('[AutoSearch] Readiness check:', {
      isSocketReady,
      isAuthReady, 
      isChatReady,
      overall: isSocketReady && isAuthReady && isChatReady
    });

    if (!isSocketReady || !isAuthReady || !isChatReady) {
      console.log('[AutoSearch] Conditions not met - waiting...');
      return;
    }

    // ✅ CRITICAL FIX: Add delay to prevent race conditions
    const delayedStart = setTimeout(() => {
      if (!initRef.current.autoSearchStarted && socket.isConnected) {
        console.log('[AutoSearch] ✅ Starting delayed auto-search for partner');
        initRef.current.autoSearchStarted = true;
        
        chatState.setIsFindingPartner(true);
        chatState.addSystemMessage('Searching for a partner...');
        setIsSelfDisconnectedRecently(false);
        setIsPartnerLeftRecently(false);
        
        // ✅ ENHANCED: More robust partner search
        const success = socket.emitFindPartner({
          chatType: 'text',
          interests,
          authId: auth.authId,
          sessionId: initRef.current.sessionId,
          timestamp: Date.now()
        });
        
        if (!success) {
          console.error('[AutoSearch] Failed to emit findPartner');
          chatState.setIsFindingPartner(false);
          chatState.addSystemMessage('Failed to start partner search. Please try again.');
          initRef.current.autoSearchStarted = false;
        } else {
          console.log('[AutoSearch] ✅ findPartner emitted successfully');
        }
      }
    }, 1000); // ✅ 1 second delay to ensure everything is ready

    return () => {
      clearTimeout(delayedStart);
    };
  }, [
    socket.isConnected,
    socket.connectionError,
    socket.isConnecting,
    auth.isLoading,
    auth.authId,
    chatState.isPartnerConnected,
    chatState.isFindingPartner,
    interests
  ]);

  // ✅ IMPROVED: Reset auto-search flag when conditions change
  useEffect(() => {
    const shouldReset = chatState.isPartnerConnected || 
                       !socket.isConnected || 
                       socket.connectionError ||
                       socket.isConnecting;

    if (shouldReset && initRef.current.autoSearchStarted) {
      console.log('[AutoSearch] Resetting auto-search flag due to state change:', {
        isPartnerConnected: chatState.isPartnerConnected,
        isConnected: socket.isConnected,
        connectionError: socket.connectionError,
        isConnecting: socket.isConnecting
      });
      initRef.current.autoSearchStarted = false;
    }
  }, [chatState.isPartnerConnected, socket.isConnected, socket.connectionError, socket.isConnecting]);
};