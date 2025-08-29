// src/app/chat/hooks/useChatActions.ts - WITH MESSAGE SOUNDS

import { useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getAudioManager } from '../components/TaskBar'; // ✅ NEW: Import audio manager

interface ChatActionsProps {
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
  addMessage: (message: any) => void;
  addSystemMessage: (text: string) => void;
  emitLeaveChat: () => void;
  emitSkipPartner: (data: any) => void;
  emitStopSearching: (data?: any) => void;
  emitFindPartner: (data: any) => void;
  emitMessage: (data: any) => void;
  emitTypingStart: () => void;
  emitTypingStop: () => void;
  setCurrentMessage: (value: string) => void;
  interests: string[];
  authId: string | null;
  username: string | null;
}

export const useChatActions = (props: ChatActionsProps) => {
  const { toast } = useToast();
  const isProcessingFindOrDisconnect = useRef(false);
  
  // Store props in ref to prevent callback recreation
  const propsRef = useRef(props);
  propsRef.current = props;

  // Skip function with auto-search for skipper
  const handleSkipPartner = useCallback(() => {
    const currentProps = propsRef.current;
    
    if (isProcessingFindOrDisconnect.current) return;
    if (!currentProps.isConnected) {
      toast({ 
        title: "Not Connected", 
        description: "Chat server connection not yet established.", 
        variant: "destructive" 
      });
      return;
    }

    if (!currentProps.isPartnerConnected) {
      toast({ 
        title: "No Partner", 
        description: "No partner to skip.", 
        variant: "destructive" 
      });
      return;
    }

    isProcessingFindOrDisconnect.current = true;

    console.log('[ChatActions] Skipping partner and auto-searching');
    
    // Set skip state immediately and reset manual stop
    currentProps.setDidSkipPartner(true);
    currentProps.setUserManuallyStopped(false);
    
    // Emit skip event
    currentProps.emitSkipPartner({
      chatType: 'text',
      interests: currentProps.interests,
      authId: currentProps.authId,
      reason: 'skip'
    });

    // Update local state immediately (server will handle auto-search)
    currentProps.setIsPartnerConnected(false);
    currentProps.setPartnerInfo(null);
    currentProps.setIsPartnerTyping(false);
    currentProps.setPartnerInterests([]);
    
    // Clear other states but set skip state
    currentProps.setIsSelfDisconnectedRecently(false);
    currentProps.setIsPartnerLeftRecently(false);
    
    // The server should handle the auto-search and send skipConfirmed
    // Don't manually set isFindingPartner here - wait for server response

    setTimeout(() => {
      isProcessingFindOrDisconnect.current = false;
    }, 200);
  }, [toast]);

  // Disconnect function for manual disconnects (no auto-search)
  const handleDisconnectPartner = useCallback(() => {
    const currentProps = propsRef.current;
    
    if (isProcessingFindOrDisconnect.current) return;
    if (!currentProps.isConnected) return;

    if (!currentProps.isPartnerConnected) return;

    isProcessingFindOrDisconnect.current = true;

    console.log('[ChatActions] Manually disconnecting from partner');
    
    // Regular leave chat (no auto-search)
    currentProps.emitLeaveChat();
    
    currentProps.addSystemMessage('You have disconnected.');
    currentProps.setIsPartnerConnected(false);
    currentProps.setPartnerInfo(null);
    currentProps.setIsPartnerTyping(false);
    currentProps.setPartnerInterests([]);
    currentProps.setIsSelfDisconnectedRecently(true);
    currentProps.setIsPartnerLeftRecently(false);
    currentProps.setDidSkipPartner(false);
    currentProps.setUserManuallyStopped(false);
    currentProps.setIsFindingPartner(false); // Do NOT auto-search

    setTimeout(() => {
      isProcessingFindOrDisconnect.current = false;
    }, 200);
  }, []);

  // Main find/disconnect handler with skip logic and manual stop tracking
  const handleFindOrDisconnect = useCallback(() => {
    const currentProps = propsRef.current;
    
    if (isProcessingFindOrDisconnect.current) return;
    if (!currentProps.isConnected) {
      toast({ 
        title: "Not Connected", 
        description: "Chat server connection not yet established.", 
        variant: "destructive" 
      });
      return;
    }

    isProcessingFindOrDisconnect.current = true;

    if (currentProps.isPartnerConnected) {
      // Use skip function when connected to a partner
      console.log('[ChatActions] Skipping current partner via find/disconnect button');
      
      // Set skip state immediately and reset manual stop
      currentProps.setDidSkipPartner(true);
      currentProps.setUserManuallyStopped(false);
      
      currentProps.emitSkipPartner({
        chatType: 'text',
        interests: currentProps.interests,
        authId: currentProps.authId,
        reason: 'skip'
      });

      // Update local state - server will handle auto-search
      currentProps.setIsPartnerConnected(false);
      currentProps.setPartnerInfo(null);
      currentProps.setIsPartnerTyping(false);
      currentProps.setPartnerInterests([]);
      
      currentProps.setIsSelfDisconnectedRecently(false);
      currentProps.setIsPartnerLeftRecently(false);
      
      // Don't manually set isFindingPartner - wait for server response
      
    } else if (currentProps.isFindingPartner) {
      // ✅ CRITICAL: User manually stopped searching - mark it and notify server!
      console.log('[ChatActions] User manually stopped searching');
      
      // ✅ CRITICAL: Notify server to remove from queue
      currentProps.emitStopSearching({
        authId: currentProps.authId,
        reason: 'manual_stop'
      });
      
      currentProps.setIsFindingPartner(false);
      currentProps.setUserManuallyStopped(true);
      currentProps.setIsSelfDisconnectedRecently(false);
      currentProps.setIsPartnerLeftRecently(false);
      currentProps.setDidSkipPartner(false);
      currentProps.addSystemMessage('Stopped searching for a partner.');
    } else {
      // Start searching - reset manual stop flag
      console.log('[ChatActions] User manually started searching');
      currentProps.setIsFindingPartner(true);
      currentProps.setUserManuallyStopped(false);
      currentProps.setIsSelfDisconnectedRecently(false);
      currentProps.setIsPartnerLeftRecently(false);
      currentProps.setDidSkipPartner(false);
      currentProps.addSystemMessage('Searching for a partner...');
      
      currentProps.emitFindPartner({
        chatType: 'text',
        interests: currentProps.interests,
        authId: currentProps.authId
      });
    }
    
    setTimeout(() => {
      isProcessingFindOrDisconnect.current = false;
    }, 200);
  }, [toast]);

  // ✅ CRITICAL FIX: Message deduplication to prevent spam - AGGRESSIVE MODE
  const lastMessageRef = useRef<{ text: string; timestamp: number } | null>(null);
  const DUPLICATE_THRESHOLD = 3000; // 3 seconds minimum between identical messages - AGGRESSIVE

  // ✅ UPDATED: Message handler with send sound and deduplication
  const handleSendMessage = useCallback((message: string) => {
    const currentProps = propsRef.current;
    
    if (!currentProps.isPartnerConnected) return;

    // ✅ CRITICAL FIX: Prevent duplicate message spam
    const now = Date.now();
    const lastMessage = lastMessageRef.current;
    
    if (lastMessage && 
        lastMessage.text === message && 
        now - lastMessage.timestamp < DUPLICATE_THRESHOLD) {
      console.warn('[ChatActions] Duplicate message blocked:', message);
      return;
    }
    
    // Update last message tracking
    lastMessageRef.current = { text: message, timestamp: now };

    currentProps.addMessage({
      text: message,
      sender: 'me'
    });

    currentProps.emitMessage({
      roomId: '',
      message: message,
      username: currentProps.username,
      authId: currentProps.authId
    });

    currentProps.emitTypingStop();

    // ✅ NEW: Play send sound
    try {
      const audioManager = getAudioManager();
      audioManager.playMessageSent();
    } catch (error) {
      console.warn('[ChatActions] Failed to play send sound:', error);
    }
  }, []);

  // Input change handler with typing management
  const handleInputChange = useCallback((value: string) => {
    const currentProps = propsRef.current;
    
    currentProps.setCurrentMessage(value);
    
    if (value.trim() && currentProps.isPartnerConnected) {
      currentProps.emitTypingStart();
    } else {
      currentProps.emitTypingStop();
    }
  }, []);

  return {
    handleFindOrDisconnect,
    handleSkipPartner,      // Skip with auto-search
    handleDisconnectPartner, // Disconnect without auto-search
    handleSendMessage,
    handleInputChange
  };
};