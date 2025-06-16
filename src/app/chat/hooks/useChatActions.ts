// src/app/chat/hooks/useChatActions.ts
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

  const handleFindOrDisconnect = useCallback(() => {
    if (isProcessingFindOrDisconnect.current) return;
    if (!props.isConnected) {
      toast({ 
        title: "Not Connected", 
        description: "Chat server connection not yet established.", 
        variant: "destructive" 
      });
      return;
    }

    isProcessingFindOrDisconnect.current = true;

    if (props.isPartnerConnected) {
      // Disconnect and find new partner
      props.addSystemMessage('You have disconnected.');
      props.setIsPartnerConnected(false);
      props.setPartnerInfo(null);
      props.setIsPartnerTyping(false);
      props.setPartnerInterests([]);
      props.emitLeaveChat();
      
      props.setIsFindingPartner(true);
      props.setIsSelfDisconnectedRecently(true);
      props.setIsPartnerLeftRecently(false);
      
      props.emitFindPartner({
        chatType: 'text',
        interests: props.interests,
        authId: props.authId
      });
    } else if (props.isFindingPartner) {
      // Stop searching
      props.setIsFindingPartner(false);
      props.setIsSelfDisconnectedRecently(false);
      props.setIsPartnerLeftRecently(false);
    } else {
      // Start searching
      props.setIsFindingPartner(true);
      props.setIsSelfDisconnectedRecently(false);
      props.setIsPartnerLeftRecently(false);
      props.addSystemMessage('Searching for a partner...');
      
      props.emitFindPartner({
        chatType: 'text',
        interests: props.interests,
        authId: props.authId
      });
    }
    
    setTimeout(() => {
      isProcessingFindOrDisconnect.current = false;
    }, 200);
  }, [props, toast]);

  const handleSendMessage = useCallback((message: string) => {
    if (!props.isPartnerConnected) return;

    props.addMessage({
      text: message,
      sender: 'me'
    });

    props.emitMessage({
      roomId: '',
      message: message,
      username: props.username,
      authId: props.authId
    });

    props.emitTypingStop();
  }, [props]);

  const handleInputChange = useCallback((value: string) => {
    props.setCurrentMessage(value);
    
    if (value.trim() && props.isPartnerConnected) {
      props.emitTypingStart();
    } else {
      props.emitTypingStop();
    }
  }, [props]);

  return {
    handleFindOrDisconnect,
    handleSendMessage,
    handleInputChange
  };
};