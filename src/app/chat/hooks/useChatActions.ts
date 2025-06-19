// src/app/chat/hooks/useChatActions.ts - ENHANCED VERSION WITH SKIP LOGIC

import { useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

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
  addMessage: (message: any) => void;
  addSystemMessage: (text: string) => void;
  emitLeaveChat: () => void;
  emitSkipPartner: (data: any) => void; // ✅ NEW: Skip-specific emit function
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
  
  // ✅ CRITICAL FIX: Store props in ref to prevent callback recreation
  const propsRef = useRef(props);
  
  // Update props ref without causing re-renders
  propsRef.current = props;

  // ✅ NEW: Separate skip function that auto-searches for the skipper only
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
    
    // ✅ CRITICAL: Emit skip event instead of regular leave
    // This tells the server that this user initiated the skip
    currentProps.emitSkipPartner?.({
      chatType: 'text',
      interests: currentProps.interests,
      authId: currentProps.authId,
      reason: 'skip'
    });

    // Update local state immediately
    currentProps.addSystemMessage('You skipped the partner. Searching for a new one...');
    currentProps.setIsPartnerConnected(false);
    currentProps.setPartnerInfo(null);
    currentProps.setIsPartnerTyping(false);
    currentProps.setPartnerInterests([]);
    
    // ✅ CRITICAL: Mark as self-disconnected and immediately start searching
    currentProps.setIsSelfDisconnectedRecently(true);
    currentProps.setIsPartnerLeftRecently(false);
    currentProps.setIsFindingPartner(true);

    setTimeout(() => {
      isProcessingFindOrDisconnect.current = false;
    }, 200);
  }, [toast]);

  // ✅ NEW: Separate disconnect function for manual disconnects (no auto-search)
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
    currentProps.setIsFindingPartner(false); // ✅ Do NOT auto-search

    setTimeout(() => {
      isProcessingFindOrDisconnect.current = false;
    }, 200);
  }, []);

  // ✅ ENHANCED: Updated find/disconnect handler with skip logic
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
      // ✅ CRITICAL: Use skip function when connected to a partner
      // This will auto-search for a new partner
      console.log('[ChatActions] Skipping current partner');
      
      currentProps.emitSkipPartner?.({
        chatType: 'text',
        interests: currentProps.interests,
        authId: currentProps.authId,
        reason: 'skip'
      });

      currentProps.addSystemMessage('You skipped the partner. Searching for a new one...');
      currentProps.setIsPartnerConnected(false);
      currentProps.setPartnerInfo(null);
      currentProps.setIsPartnerTyping(false);
      currentProps.setPartnerInterests([]);
      
      currentProps.setIsFindingPartner(true);
      currentProps.setIsSelfDisconnectedRecently(true);
      currentProps.setIsPartnerLeftRecently(false);
      
    } else if (currentProps.isFindingPartner) {
      // Stop searching
      currentProps.setIsFindingPartner(false);
      currentProps.setIsSelfDisconnectedRecently(false);
      currentProps.setIsPartnerLeftRecently(false);
      currentProps.addSystemMessage('Stopped searching for a partner.');
    } else {
      // Start searching
      currentProps.setIsFindingPartner(true);
      currentProps.setIsSelfDisconnectedRecently(false);
      currentProps.setIsPartnerLeftRecently(false);
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

  // ✅ FIXED: Stable message handler
  const handleSendMessage = useCallback((message: string) => {
    const currentProps = propsRef.current;
    
    if (!currentProps.isPartnerConnected) return;

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
  }, []);

  // ✅ FIXED: Stable input change handler with typing management
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
    handleSkipPartner,      // ✅ NEW: Skip with auto-search
    handleDisconnectPartner, // ✅ NEW: Disconnect without auto-search
    handleSendMessage,
    handleInputChange
  };
};