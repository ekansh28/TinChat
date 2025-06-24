// src/app/chat/hooks/useChatActions.ts - COMPLETELY FIXED CHAT ACTIONS

import { useCallback, useRef, useEffect } from 'react';

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'partner' | 'system';
  timestamp: Date;
  senderUsername?: string;
  senderAuthId?: string;
  senderDisplayNameColor?: string;
  senderDisplayNameAnimation?: string;
  senderRainbowSpeed?: number;
}

interface UseChatActionsProps {
  isConnected: boolean;
  isPartnerConnected: boolean;
  isFindingPartner: boolean;
  setIsFindingPartner: (value: boolean) => void;
  setIsPartnerConnected: (value: boolean) => void;
  setPartnerInfo: (value: any) => void;
  setIsPartnerTyping: (value: boolean) => void;
  setPartnerInterests: (value: string[]) => void;
  setIsSelfDisconnectedRecently: (value: boolean) => void;
  setIsPartnerLeftRecently: (value: boolean) => void;
  setDidSkipPartner: (value: boolean) => void;
  setUserManuallyStopped: (value: boolean) => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  addSystemMessage: (text: string, type?: 'info' | 'warning' | 'error' | 'success') => void;
  emitLeaveChat: () => void;
  emitSkipPartner: () => void;
  emitStopSearching: () => void;
  emitFindPartner: (data: any) => void;
  emitMessage: (data: any) => void;
  emitTypingStart: () => void;
  emitTypingStop: () => void;
  setCurrentMessage: (message: string) => void;
  interests: string[];
  authId: string | null;
  username: string | null;
}

export const useChatActions = ({
  isConnected,
  isPartnerConnected,
  isFindingPartner,
  setIsFindingPartner,
  setIsPartnerConnected,
  setPartnerInfo,
  setIsPartnerTyping,
  setPartnerInterests,
  setIsSelfDisconnectedRecently,
  setIsPartnerLeftRecently,
  setDidSkipPartner,
  setUserManuallyStopped,
  addMessage,
  addSystemMessage,
  emitLeaveChat,
  emitSkipPartner,
  emitStopSearching,
  emitFindPartner,
  emitMessage,
  emitTypingStart,
  emitTypingStop,
  setCurrentMessage,
  interests,
  authId,
  username
}: UseChatActionsProps) => {

  const lastActionRef = useRef<number>(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // ✅ CRITICAL: Fixed skip partner logic
  const skipPartner = useCallback(() => {
    const now = Date.now();
    
    // Prevent spam clicking
    if (now - lastActionRef.current < 1000) {
      console.log('[ChatActions] 🚫 Skip action throttled');
      return;
    }

    if (!isConnected) {
      console.log('[ChatActions] 🚫 Cannot skip - not connected to server');
      addSystemMessage('Not connected to server', 'error');
      return;
    }

    if (!isPartnerConnected) {
      console.log('[ChatActions] 🚫 No partner to skip');
      addSystemMessage('No partner to skip', 'warning');
      return;
    }

    console.log('[ChatActions] ⏭️ Skipping partner...');
    lastActionRef.current = now;

    try {
      // ✅ CRITICAL: Emit skip and let server handle the logic
      emitSkipPartner();
      
      // ✅ IMPORTANT: Immediately update local state
      setIsPartnerConnected(false);
      setPartnerInfo(null);
      setIsPartnerTyping(false);
      setPartnerInterests([]);
      
      // ✅ CRITICAL: Mark as "did skip" but don't set "finding partner" yet
      // Let the server response handle auto-search state
      setDidSkipPartner(true);
      setIsPartnerLeftRecently(false);
      setIsSelfDisconnectedRecently(false);
      setUserManuallyStopped(false);
      
      console.log('[ChatActions] ✅ Skip request sent, waiting for server response');
      
    } catch (error) {
      console.error('[ChatActions] ❌ Skip partner failed:', error);
      addSystemMessage('Failed to skip partner', 'error');
    }
  }, [
    isConnected,
    isPartnerConnected,
    emitSkipPartner,
    setIsPartnerConnected,
    setPartnerInfo,
    setIsPartnerTyping,
    setPartnerInterests,
    setDidSkipPartner,
    setIsPartnerLeftRecently,
    setIsSelfDisconnectedRecently,
    setUserManuallyStopped,
    addSystemMessage
  ]);

  // ✅ CRITICAL: Fixed leave chat logic
  const leaveChat = useCallback(() => {
    const now = Date.now();
    
    if (now - lastActionRef.current < 1000) {
      console.log('[ChatActions] 🚫 Leave action throttled');
      return;
    }

    if (!isConnected) {
      console.log('[ChatActions] 🚫 Cannot leave - not connected to server');
      return;
    }

    console.log('[ChatActions] 👋 Leaving chat...');
    lastActionRef.current = now;

    try {
      // Update state immediately
      setIsPartnerConnected(false);
      setPartnerInfo(null);
      setIsPartnerTyping(false);
      setPartnerInterests([]);
      setIsFindingPartner(false);
      
      // Mark as self-disconnected
      setIsSelfDisconnectedRecently(true);
      setIsPartnerLeftRecently(false);
      setDidSkipPartner(false);
      setUserManuallyStopped(true);
      
      // Emit leave event
      emitLeaveChat();
      
      console.log('[ChatActions] ✅ Left chat successfully');
      
    } catch (error) {
      console.error('[ChatActions] ❌ Leave chat failed:', error);
      addSystemMessage('Failed to leave chat', 'error');
    }
  }, [
    isConnected,
    emitLeaveChat,
    setIsPartnerConnected,
    setPartnerInfo,
    setIsPartnerTyping,
    setPartnerInterests,
    setIsFindingPartner,
    setIsSelfDisconnectedRecently,
    setIsPartnerLeftRecently,
    setDidSkipPartner,
    setUserManuallyStopped,
    addSystemMessage
  ]);

  // ✅ CRITICAL: Fixed new chat logic
  const startNewChat = useCallback(() => {
    const now = Date.now();
    
    if (now - lastActionRef.current < 1000) {
      console.log('[ChatActions] 🚫 New chat action throttled');
      return;
    }

    if (!isConnected) {
      console.log('[ChatActions] 🚫 Cannot start new chat - not connected to server');
      addSystemMessage('Not connected to server', 'error');
      return;
    }

    if (isFindingPartner) {
      console.log('[ChatActions] 🚫 Already searching for a partner');
      addSystemMessage('Already searching for a partner', 'warning');
      return;
    }

    if (isPartnerConnected) {
      console.log('[ChatActions] 🚫 Already connected to a partner');
      addSystemMessage('Already connected to a partner', 'warning');
      return;
    }

    console.log('[ChatActions] 🔍 Starting new chat search...');
    lastActionRef.current = now;

    try {
      // Clear all previous states
      setIsPartnerConnected(false);
      setPartnerInfo(null);
      setIsPartnerTyping(false);
      setPartnerInterests([]);
      setIsSelfDisconnectedRecently(false);
      setIsPartnerLeftRecently(false);
      setDidSkipPartner(false);
      setUserManuallyStopped(false);
      
      // Start finding partner
      setIsFindingPartner(true);
      
      emitFindPartner({
        interests: interests || [],
        authId: authId,
        username: username,
        manualSearch: true
      });
      
      console.log('[ChatActions] ✅ New chat search started');
      
    } catch (error) {
      console.error('[ChatActions] ❌ Start new chat failed:', error);
      setIsFindingPartner(false);
      addSystemMessage('Failed to start new chat', 'error');
    }
  }, [
    isConnected,
    isFindingPartner,
    isPartnerConnected,
    emitFindPartner,
    setIsFindingPartner,
    setIsPartnerConnected,
    setPartnerInfo,
    setIsPartnerTyping,
    setPartnerInterests,
    setIsSelfDisconnectedRecently,
    setIsPartnerLeftRecently,
    setDidSkipPartner,
    setUserManuallyStopped,
    addSystemMessage,
    interests,
    authId,
    username
  ]);

  // ✅ CRITICAL: Fixed stop searching logic
  const stopSearching = useCallback(() => {
    const now = Date.now();
    
    if (now - lastActionRef.current < 500) {
      console.log('[ChatActions] 🚫 Stop search action throttled');
      return;
    }

    if (!isConnected) {
      console.log('[ChatActions] 🚫 Cannot stop search - not connected to server');
      return;
    }

    if (!isFindingPartner) {
      console.log('[ChatActions] 🚫 Not currently searching');
      return;
    }

    console.log('[ChatActions] 🛑 Stopping search...');
    lastActionRef.current = now;

    try {
      // Update state immediately
      setIsFindingPartner(false);
      setUserManuallyStopped(true);
      
      // Clear any partner-related states
      setIsPartnerConnected(false);
      setPartnerInfo(null);
      setIsPartnerTyping(false);
      setPartnerInterests([]);
      
      // Emit stop searching
      emitStopSearching();
      
      console.log('[ChatActions] ✅ Search stopped successfully');
      
    } catch (error) {
      console.error('[ChatActions] ❌ Stop searching failed:', error);
      addSystemMessage('Failed to stop search', 'error');
    }
  }, [
    isConnected,
    isFindingPartner,
    emitStopSearching,
    setIsFindingPartner,
    setUserManuallyStopped,
    setIsPartnerConnected,
    setPartnerInfo,
    setIsPartnerTyping,
    setPartnerInterests,
    addSystemMessage
  ]);

  // ✅ CRITICAL: Fixed send message logic
  const sendMessage = useCallback((messageText: string) => {
    if (!messageText.trim()) {
      console.log('[ChatActions] 🚫 Empty message');
      return;
    }

    if (!isConnected) {
      console.log('[ChatActions] 🚫 Cannot send message - not connected to server');
      addSystemMessage('Not connected to server', 'error');
      return;
    }

    if (!isPartnerConnected) {
      console.log('[ChatActions] 🚫 Cannot send message - no partner connected');
      addSystemMessage('No partner connected', 'warning');
      return;
    }

    console.log('[ChatActions] 📤 Sending message...');

    try {
      // Add message to local state immediately
      addMessage({
        text: messageText.trim(),
        sender: 'me',
        senderUsername: username || 'You',
        senderAuthId: authId || undefined
      });

      // Emit message to server
      emitMessage({
        message: messageText.trim(),
        authId: authId,
        username: username
      });

      // Clear current message
      setCurrentMessage('');

      // Stop typing indicator
      if (isTypingRef.current) {
        emitTypingStop();
        isTypingRef.current = false;
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
      }

      console.log('[ChatActions] ✅ Message sent successfully');

    } catch (error) {
      console.error('[ChatActions] ❌ Send message failed:', error);
      addSystemMessage('Failed to send message', 'error');
    }
  }, [
    isConnected,
    isPartnerConnected,
    addMessage,
    emitMessage,
    emitTypingStop,
    setCurrentMessage,
    addSystemMessage,
    authId,
    username
  ]);

  // ✅ CRITICAL: Fixed typing indicators
  const handleTypingStart = useCallback(() => {
    if (!isConnected || !isPartnerConnected || isTypingRef.current) {
      return;
    }

    console.log('[ChatActions] ⌨️ Started typing');
    
    isTypingRef.current = true;
    emitTypingStart();

    // Auto-stop typing after 3 seconds of no activity
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        handleTypingStop();
      }
    }, 3000);
  }, [isConnected, isPartnerConnected, emitTypingStart]);

  const handleTypingStop = useCallback(() => {
    if (!isTypingRef.current) {
      return;
    }

    console.log('[ChatActions] ⌨️ Stopped typing');
    
    isTypingRef.current = false;
    emitTypingStop();

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [emitTypingStop]);

  // ✅ Handle input change with typing indicators
  const handleInputChange = useCallback((value: string) => {
    setCurrentMessage(value);

    if (value.trim() && isPartnerConnected) {
      handleTypingStart();
    } else {
      handleTypingStop();
    }
  }, [setCurrentMessage, isPartnerConnected, handleTypingStart, handleTypingStop]);

  // ✅ Cleanup typing on unmount
  const cleanup = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    
    if (isTypingRef.current) {
      isTypingRef.current = false;
      try {
        emitTypingStop();
      } catch (error) {
        console.warn('[ChatActions] Failed to stop typing on cleanup:', error);
      }
    }
  }, [emitTypingStop]);

  // ✅ Auto-cleanup on component unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    // Core actions
    skipPartner,
    leaveChat,
    startNewChat,
    stopSearching,
    sendMessage,
    
    // Typing actions
    handleTypingStart,
    handleTypingStop,
    handleInputChange,
    
    // Utility
    cleanup
  };
};