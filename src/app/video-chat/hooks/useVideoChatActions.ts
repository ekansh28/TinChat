// src/app/video-chat/hooks/useVideoChatActions.ts
import { useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

interface VideoChatActionsProps {
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
  hasCameraPermission: boolean | undefined;
  initializeCamera: () => Promise<MediaStream | null>;
  cleanupConnections: (stopLocalStream: boolean) => void;
  setupPeerConnection: (roomId: string) => Promise<RTCPeerConnection | null>;
}

export const useVideoChatActions = (props: VideoChatActionsProps) => {
  const { toast } = useToast();
  const isProcessingFindOrDisconnect = useRef(false);

  const handleFindOrDisconnect = useCallback(async () => {
    if (isProcessingFindOrDisconnect.current) return;
    
    if (!props.isConnected) {
      toast({ 
        title: "Not Connected", 
        description: "Video chat server connection not yet established.", 
        variant: "destructive" 
      });
      return;
    }

    // Check camera permission for video chat
    if (props.hasCameraPermission === false) {
      toast({ 
        title: "Camera Required", 
        description: "Camera access is required for video chat.", 
        variant: "destructive" 
      });
      return;
    }

    isProcessingFindOrDisconnect.current = true;

    try {
      if (props.isPartnerConnected) {
        // Disconnect and find new partner
        props.addSystemMessage('You have disconnected from video chat.');
        props.setIsPartnerConnected(false);
        props.setPartnerInfo(null);
        props.setIsPartnerTyping(false);
        props.setPartnerInterests([]);
        props.emitLeaveChat();
        
        // Clean up WebRTC but keep local stream
        props.cleanupConnections(false);
        
        props.setIsFindingPartner(true);
        props.setIsSelfDisconnectedRecently(true);
        props.setIsPartnerLeftRecently(false);
        
        // Ensure camera is still active
        const stream = await props.initializeCamera();
        if (stream) {
          props.emitFindPartner({
            chatType: 'video',
            interests: props.interests,
            authId: props.authId
          });
        } else {
          toast({
            title: "Camera Error",
            description: "Cannot find new partner without camera access.",
            variant: "destructive"
          });
          props.setIsFindingPartner(false);
        }
      } else if (props.isFindingPartner) {
        // Stop searching
        props.setIsFindingPartner(false);
        props.setIsSelfDisconnectedRecently(false);
        props.setIsPartnerLeftRecently(false);
      } else {
        // Start searching - ensure camera access first
        const stream = await props.initializeCamera();
        if (!stream) {
          toast({
            title: "Camera Required",
            description: "Please enable camera access to start video chat.",
            variant: "destructive"
          });
          return;
        }
        
        props.setIsFindingPartner(true);
        props.setIsSelfDisconnectedRecently(false);
        props.setIsPartnerLeftRecently(false);
        props.addSystemMessage('Searching for a video chat partner...');
        
        props.emitFindPartner({
          chatType: 'video',
          interests: props.interests,
          authId: props.authId
        });
      }
    } finally {
      setTimeout(() => {
        isProcessingFindOrDisconnect.current = false;
      }, 200);
    }
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