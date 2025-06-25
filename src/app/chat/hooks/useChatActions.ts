// src/app/chat/hooks/useAutoSearch.ts - COMPLETELY FIXED WITH CHATTYPE

import { useEffect, useRef, useCallback } from 'react';

interface UseAutoSearchProps {
  socket: {
    isConnected: boolean;
    emitFindPartner: (data: any) => void;
  };
  auth: {
    authId: string | null;
    username: string | null;
  };
  chatState: {
    isPartnerConnected: boolean;
    isFindingPartner: boolean;
  };
  interests: string[];
  initRef: React.MutableRefObject<{
    isInitialized: boolean;
    autoSearchStarted: boolean;
    sessionId: string;
  }>;
  setIsSelfDisconnectedRecently: (value: boolean) => void;
  setIsPartnerLeftRecently: (value: boolean) => void;
  wasSkippedByPartner: boolean;
  didSkipPartner: boolean;
  userManuallyStopped: boolean;
}

export const useAutoSearch = ({
  socket,
  auth,
  chatState,
  interests,
  initRef,
  setIsSelfDisconnectedRecently,
  setIsPartnerLeftRecently,
  wasSkippedByPartner,
  didSkipPartner,
  userManuallyStopped
}: UseAutoSearchProps) => {
  
  const lastAutoSearchRef = useRef<number>(0);
  const autoSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isAutoSearchingRef = useRef(false);

  // ✅ CRITICAL: Auto-search logic with chatType that respects all user states
  const performAutoSearch = useCallback(() => {
    const now = Date.now();
    
    // Prevent spam
    if (now - lastAutoSearchRef.current < 500) {
      console.log('[AutoSearch] 🚫 Auto-search throttled');
      return;
    }

    // Don't auto-search if user manually stopped or was skipped
    if (userManuallyStopped) {
      console.log('[AutoSearch] 🚫 User manually stopped - no auto-search');
      return;
    }

    if (wasSkippedByPartner) {
      console.log('[AutoSearch] 🚫 Was skipped by partner - no auto-search');
      return;
    }

    // Don't auto-search if already connected or searching
    if (chatState.isPartnerConnected) {
      console.log('[AutoSearch] 🚫 Already connected to partner');
      return;
    }

    if (chatState.isFindingPartner) {
      console.log('[AutoSearch] 🚫 Already searching for partner');
      return;
    }

    // Don't auto-search if socket not ready
    if (!socket.isConnected) {
      console.log('[AutoSearch] 🚫 Socket not connected');
      return;
    }

    // Don't auto-search if not initialized
    if (!initRef.current.isInitialized) {
      console.log('[AutoSearch] 🚫 Not initialized yet');
      return;
    }

    console.log('[AutoSearch] 🔍 Starting auto-search...');
    
    isAutoSearchingRef.current = true;
    lastAutoSearchRef.current = now;
    
    // Clear any previous states
    setIsSelfDisconnectedRecently(false);
    setIsPartnerLeftRecently(false);
    
    // ✅ CRITICAL FIX: Include chatType in auto-search
    socket.emitFindPartner({
      chatType: 'text', // ✅ REQUIRED: Add chatType field
      interests: interests || [],
      authId: auth.authId,
      username: auth.username,
      autoSearch: true,
      sessionId: initRef.current.sessionId
    });

  }, [
    socket,
    auth,
    chatState,
    interests,
    initRef,
    setIsSelfDisconnectedRecently,
    setIsPartnerLeftRecently,
    userManuallyStopped,
    wasSkippedByPartner
  ]);

  // ✅ CRITICAL: Initial auto-search when component loads
  useEffect(() => {
    if (!socket.isConnected || !initRef.current.isInitialized) {
      return;
    }

    // Only auto-search once on initial load
    if (initRef.current.autoSearchStarted) {
      return;
    }

    // Don't auto-search if already connected or searching
    if (chatState.isPartnerConnected || chatState.isFindingPartner) {
      return;
    }

    // Don't auto-search if user manually stopped
    if (userManuallyStopped) {
      return;
    }

    console.log('[AutoSearch] 🚀 Initial auto-search trigger');
    
    // Add small delay to ensure everything is ready
    autoSearchTimeoutRef.current = setTimeout(() => {
      initRef.current.autoSearchStarted = true;
      performAutoSearch();
    }, 100);

    return () => {
      if (autoSearchTimeoutRef.current) {
        clearTimeout(autoSearchTimeoutRef.current);
        autoSearchTimeoutRef.current = null;
      }
    };
  }, [
    socket.isConnected,
    initRef.current.isInitialized,
    chatState.isPartnerConnected,
    chatState.isFindingPartner,
    performAutoSearch,
    userManuallyStopped
  ]);

  // ✅ CRITICAL: Auto-search after YOU skip someone (server should handle this but backup)
  useEffect(() => {
    if (!didSkipPartner) return;
    if (wasSkippedByPartner) return; // Don't auto-search if we were skipped
    if (userManuallyStopped) return;
    if (!socket.isConnected) return;
    if (chatState.isPartnerConnected) return;
    if (chatState.isFindingPartner) return; // Server should already be searching

    console.log('[AutoSearch] 🔄 Auto-search after skipping partner');
    
    // Small delay to let server start auto-search first
    autoSearchTimeoutRef.current = setTimeout(() => {
      if (!chatState.isFindingPartner && !chatState.isPartnerConnected) {
        console.log('[AutoSearch] 🔄 Server didnt start auto-search, starting manually');
        performAutoSearch();
      }
    }, 1000);

    return () => {
      if (autoSearchTimeoutRef.current) {
        clearTimeout(autoSearchTimeoutRef.current);
        autoSearchTimeoutRef.current = null;
      }
    };
  }, [
    didSkipPartner,
    wasSkippedByPartner,
    userManuallyStopped,
    socket.isConnected,
    chatState.isPartnerConnected,
    chatState.isFindingPartner,
    performAutoSearch
  ]);

  // ✅ Reset auto-search state when partner found
  useEffect(() => {
    if (chatState.isPartnerConnected) {
      isAutoSearchingRef.current = false;
      if (autoSearchTimeoutRef.current) {
        clearTimeout(autoSearchTimeoutRef.current);
        autoSearchTimeoutRef.current = null;
      }
    }
  }, [chatState.isPartnerConnected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSearchTimeoutRef.current) {
        clearTimeout(autoSearchTimeoutRef.current);
      }
      isAutoSearchingRef.current = false;
    };
  }, []);

  return {
    performAutoSearch,
    isAutoSearching: isAutoSearchingRef.current
  };
};