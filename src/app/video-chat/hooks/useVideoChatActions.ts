// ===== ENHANCED useVideoChatActions.ts =====
// src/app/video-chat/hooks/useVideoChatActions.ts - ENHANCED VERSION
import { useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

interface VideoChatActionsProps {
  // Base chat action props (same as text chat)
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
  emitFindPartner: (data: any) => boolean;
  emitMessage: (data: any) => boolean;
  emitTypingStart: () => void;
  emitTypingStop: () => void;
  setCurrentMessage: (value: string) => void;
  interests: string[];
  authId: string | null;
  username: string | null;
  
  // Video-specific props
  hasCameraPermission: boolean | undefined;
  initializeCamera: () => Promise<MediaStream | null>;
  cleanupConnections: (stopLocalStream: boolean) => void;
  setupPeerConnection: (roomId: string) => Promise<RTCPeerConnection | null>;
}

export const useVideoChatActions = (props: VideoChatActionsProps) => {
  const { toast } = useToast();
  const isProcessingFindOrDisconnect = useRef(false);
  
  // ✅ CRITICAL FIX: Store props in ref to prevent callback recreation
  const propsRef = useRef(props);
  
  // Update props ref without causing re-renders
  propsRef.current = props;

  // ✅ ENHANCED: Video chat specific find/disconnect handler
  const handleFindOrDisconnect = useCallback(async () => {
    const currentProps = propsRef.current;
    
    if (isProcessingFindOrDisconnect.current) {
      console.log('[VideoChatActions] Find/disconnect already in progress');
      return;
    }
    
    if (!currentProps.isConnected) {
      toast({ 
        title: "Not Connected", 
        description: "Video chat server connection not yet established.", 
        variant: "destructive" 
      });
      return;
    }

    // ✅ ENHANCED: Check camera permission for video chat
    if (currentProps.hasCameraPermission === false) {
      toast({ 
        title: "Camera Required", 
        description: "Camera access is required for video chat. Please enable camera permissions.", 
        variant: "destructive" 
      });
      return;
    }

    isProcessingFindOrDisconnect.current = true;

    try {
      if (currentProps.isPartnerConnected) {
        // ✅ ENHANCED: Disconnect and find new partner with WebRTC cleanup
        console.log('[VideoChatActions] Disconnecting from current partner');
        
        currentProps.addSystemMessage('You have disconnected from video chat.');
        currentProps.setIsPartnerConnected(false);
        currentProps.setPartnerInfo(null);
        currentProps.setIsPartnerTyping(false);
        currentProps.setPartnerInterests([]);
        currentProps.emitLeaveChat();
        
        // ✅ CRITICAL: Clean up WebRTC but keep local stream for next match
        currentProps.cleanupConnections(false);
        
        // Wait a moment for cleanup
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Start finding new partner
        currentProps.setIsFindingPartner(true);
        currentProps.setIsSelfDisconnectedRecently(true);
        currentProps.setIsPartnerLeftRecently(false);
        
        // Ensure camera is still active before searching
        const stream = await currentProps.initializeCamera();
        if (stream) {
          console.log('[VideoChatActions] Camera ready, searching for new partner');
          const success = currentProps.emitFindPartner({
            chatType: 'video',
            interests: currentProps.interests,
            authId: currentProps.authId
          });
          
          if (!success) {
            currentProps.setIsFindingPartner(false);
            currentProps.addSystemMessage('Failed to start partner search. Please try again.');
          }
        } else {
          console.error('[VideoChatActions] Camera not available for new search');
          toast({
            title: "Camera Error",
            description: "Cannot find new partner without camera access.",
            variant: "destructive"
          });
          currentProps.setIsFindingPartner(false);
        }
        
      } else if (currentProps.isFindingPartner) {
        // ✅ ENHANCED: Stop searching
        console.log('[VideoChatActions] Stopping partner search');
        
        currentProps.setIsFindingPartner(false);
        currentProps.setIsSelfDisconnectedRecently(false);
        currentProps.setIsPartnerLeftRecently(false);
        currentProps.addSystemMessage('Stopped searching for video chat partner.');
        
      } else {
        // ✅ ENHANCED: Start searching - ensure camera access first
        console.log('[VideoChatActions] Starting partner search');
        
        // Check camera permission first
        if (currentProps.hasCameraPermission === undefined) {
          toast({
            title: "Camera Initializing",
            description: "Please wait while we set up your camera...",
          });
          return;
        }
        
        const stream = await currentProps.initializeCamera();
        if (!stream) {
          toast({
            title: "Camera Required",
            description: "Please enable camera access to start video chat.",
            variant: "destructive"
          });
          return;
        }
        
        currentProps.setIsFindingPartner(true);
        currentProps.setIsSelfDisconnectedRecently(false);
        currentProps.setIsPartnerLeftRecently(false);
        currentProps.addSystemMessage('Searching for a video chat partner...');
        
        const success = currentProps.emitFindPartner({
          chatType: 'video',
          interests: currentProps.interests,
          authId: currentProps.authId
        });
        
        if (!success) {
          currentProps.setIsFindingPartner(false);
          currentProps.addSystemMessage('Failed to start partner search. Please try again.');
        }
      }
    } catch (error) {
      console.error('[VideoChatActions] Error in find/disconnect:', error);
      toast({
        title: "Video Chat Error",
        description: "An error occurred while managing video chat connection.",
        variant: "destructive"
      });
    } finally {
      setTimeout(() => {
        isProcessingFindOrDisconnect.current = false;
      }, 1000); // Longer timeout for video operations
    }
  }, [toast]);

  // ✅ CRITICAL FIX: Message deduplication to prevent spam - AGGRESSIVE MODE
  const lastMessageRef = useRef<{ text: string; timestamp: number } | null>(null);
  const DUPLICATE_THRESHOLD = 3000; // 3 seconds minimum between identical messages - AGGRESSIVE

  // ✅ ENHANCED: Send message handler with video chat context and deduplication
  const handleSendMessage = useCallback((message: string) => {
    const currentProps = propsRef.current;
    
    if (!currentProps.isPartnerConnected) {
      toast({
        title: "Not Connected",
        description: "You must be connected to a video chat partner to send messages.",
        variant: "destructive"
      });
      return;
    }

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return;
    }

    if (trimmedMessage.length > 2000) {
      toast({
        title: "Message Too Long",
        description: "Messages must be 2000 characters or less.",
        variant: "destructive"
      });
      return;
    }

    // ✅ CRITICAL FIX: Prevent duplicate message spam
    const now = Date.now();
    const lastMessage = lastMessageRef.current;
    
    if (lastMessage && 
        lastMessage.text === trimmedMessage && 
        now - lastMessage.timestamp < DUPLICATE_THRESHOLD) {
      console.warn('[VideoChatActions] Duplicate message blocked:', trimmedMessage);
      return;
    }
    
    // Update last message tracking
    lastMessageRef.current = { text: trimmedMessage, timestamp: now };

    try {
      // Add message to local state
      currentProps.addMessage({
        text: trimmedMessage,
        sender: 'me'
      });

      // Emit message through socket
      const success = currentProps.emitMessage({
        roomId: '', // Room ID is handled by the socket hook
        message: trimmedMessage,
        username: currentProps.username,
        authId: currentProps.authId
      });

      if (!success) {
        toast({
          title: "Message Failed",
          description: "Failed to send message. Please try again.",
          variant: "destructive"
        });
        return;
      }

      // Stop typing indicator
      currentProps.emitTypingStop();
      
      console.log('[VideoChatActions] Message sent successfully');
    } catch (error) {
      console.error('[VideoChatActions] Error sending message:', error);
      toast({
        title: "Send Error",
        description: "Failed to send message.",
        variant: "destructive"
      });
    }
  }, [toast]);

  // ✅ ENHANCED: Input change handler with video chat optimizations
  const handleInputChange = useCallback((value: string) => {
    const currentProps = propsRef.current;
    
    currentProps.setCurrentMessage(value);
    
    // Only send typing indicators if partner is connected
    if (currentProps.isPartnerConnected) {
      if (value.trim() && value.length <= 2000) {
        currentProps.emitTypingStart();
      } else {
        currentProps.emitTypingStop();
      }
    }
  }, []);

  return {
    handleFindOrDisconnect,
    handleSendMessage,
    handleInputChange
  };
};