// src/app/chat/hooks/useAutoSearch.ts - FIXED TO PREVENT AUTO-SEARCH AFTER MANUAL STOP

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
  wasSkippedByPartner?: boolean;
  didSkipPartner?: boolean;
  userManuallyStopped?: boolean; // ✅ NEW: Track if user manually stopped
}

export const useAutoSearch = ({
  socket,
  auth,
  chatState,
  interests,
  initRef,
  setIsSelfDisconnectedRecently,
  setIsPartnerLeftRecently,
  wasSkippedByPartner = false,
  didSkipPartner = false,
  userManuallyStopped = false // ✅ NEW: Default to false
}: UseAutoSearchProps) => {
  
  // ✅ CRITICAL FIX: Only auto-search on initial load, NOT after being skipped or manually stopped
  useEffect(() => {
    console.log('[AutoSearch] Effect triggered:', {
      autoSearchStarted: initRef.current.autoSearchStarted,
      isConnected: socket.isConnected,
      authLoading: auth.isLoading,
      isPartnerConnected: chatState.isPartnerConnected,
      isFindingPartner: chatState.isFindingPartner,
      authId: auth.authId,
      connectionError: socket.connectionError,
      isConnecting: socket.isConnecting,
      wasSkippedByPartner,
      didSkipPartner,
      userManuallyStopped // ✅ NEW: Log manual stop state
    });

    // ✅ CRITICAL: Prevent auto-search if user was skipped
    if (wasSkippedByPartner) {
      console.log('[AutoSearch] User was skipped, preventing auto-search');
      return;
    }

    // ✅ CRITICAL: Prevent auto-search if user manually stopped after skipping
    if (userManuallyStopped) {
      console.log('[AutoSearch] User manually stopped searching, preventing auto-search');
      return;
    }

    // ✅ CRITICAL: Prevent auto-search if user already skipped someone
    if (didSkipPartner) {
      console.log('[AutoSearch] User skipped someone, server should handle auto-search');
      return;
    }

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
      // ✅ TRIPLE-CHECK: Make sure conditions haven't changed during delay
      if (wasSkippedByPartner) {
        console.log('[AutoSearch] User was skipped during delay, cancelling auto-search');
        return;
      }

      if (userManuallyStopped) {
        console.log('[AutoSearch] User manually stopped during delay, cancelling auto-search');
        return;
      }

      if (didSkipPartner) {
        console.log('[AutoSearch] User skipped someone during delay, cancelling auto-search');
        return;
      }

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
    interests,
    wasSkippedByPartner,
    didSkipPartner,
    userManuallyStopped // ✅ NEW: Include manual stop state in dependencies
  ]);

  // ✅ IMPROVED: Reset auto-search flag when conditions change
  useEffect(() => {
    const shouldReset = chatState.isPartnerConnected || 
                       !socket.isConnected || 
                       socket.connectionError ||
                       socket.isConnecting ||
                       wasSkippedByPartner ||
                       userManuallyStopped; // ✅ NEW: Reset if user manually stopped

    if (shouldReset && initRef.current.autoSearchStarted) {
      console.log('[AutoSearch] Resetting auto-search flag due to state change:', {
        isPartnerConnected: chatState.isPartnerConnected,
        isConnected: socket.isConnected,
        connectionError: socket.connectionError,
        isConnecting: socket.isConnecting,
        wasSkippedByPartner,
        userManuallyStopped
      });
      initRef.current.autoSearchStarted = false;
    }
  }, [
    chatState.isPartnerConnected, 
    socket.isConnected, 
    socket.connectionError, 
    socket.isConnecting,
    wasSkippedByPartner,
    userManuallyStopped // ✅ NEW: Include manual stop state
  ]);
};