// src/app/chat/hooks/useChatActions.ts - FIXED VERSION
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

  // ✅ FIXED: Stable callback with ref-based access to current props
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
      // Disconnect and find new partner
      currentProps.addSystemMessage('You have disconnected.');
      currentProps.setIsPartnerConnected(false);
      currentProps.setPartnerInfo(null);
      currentProps.setIsPartnerTyping(false);
      currentProps.setPartnerInterests([]);
      currentProps.emitLeaveChat();
      
      currentProps.setIsFindingPartner(true);
      currentProps.setIsSelfDisconnectedRecently(true);
      currentProps.setIsPartnerLeftRecently(false);
      
      currentProps.emitFindPartner({
        chatType: 'text',
        interests: currentProps.interests,
        authId: currentProps.authId
      });
    } else if (currentProps.isFindingPartner) {
      // Stop searching
      currentProps.setIsFindingPartner(false);
      currentProps.setIsSelfDisconnectedRecently(false);
      currentProps.setIsPartnerLeftRecently(false);
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
  }, [toast]); // ✅ Only depend on stable toast function

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
  }, []); // ✅ No dependencies - all accessed via ref

  // ✅ FIXED: Stable input change handler with typing management
  const handleInputChange = useCallback((value: string) => {
    const currentProps = propsRef.current;
    
    currentProps.setCurrentMessage(value);
    
    if (value.trim() && currentProps.isPartnerConnected) {
      currentProps.emitTypingStart();
    } else {
      currentProps.emitTypingStop();
    }
  }, []); // ✅ No dependencies - all accessed via ref

  return {
    handleFindOrDisconnect,
    handleSendMessage,
    handleInputChange
  };
};