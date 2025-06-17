// src/app/video-chat/hooks/useWebRTC.ts
import { useRef, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export const useWebRTC = () => {
  const { toast } = useToast();
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | undefined>(undefined);

  // Initialize camera and microphone
  const initializeCamera = useCallback(async (): Promise<MediaStream | null> => {
    // Return existing stream if already active
    if (localStreamRef.current?.active) {
      if (localVideoRef.current && !localVideoRef.current.srcObject) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      setHasCameraPermission(true);
      return localStreamRef.current;
    }

    // Check if getUserMedia is supported
    if (typeof navigator.mediaDevices?.getUserMedia !== 'function') {
      setHasCameraPermission(false);
      toast({ 
        variant: 'destructive', 
        title: 'Unsupported Browser', 
        description: 'Camera access (getUserMedia) is not supported.' 
      });
      return null;
    }

    try {
      console.log('Requesting camera and microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      setHasCameraPermission(true);
      localStreamRef.current = stream;
      
      // Set up local video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      console.log('Camera and microphone access granted');
      return stream;
    } catch (error) {
      console.error('Error accessing camera:', error);
      setHasCameraPermission(false);
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          toast({ 
            variant: 'destructive', 
            title: 'Camera Access Denied', 
            description: 'Please enable camera and microphone permissions for video chat.' 
          });
        } else if (error.name === 'NotFoundError') {
          toast({ 
            variant: 'destructive', 
            title: 'No Camera Found', 
            description: 'No camera or microphone device found.' 
          });
        } else {
          toast({ 
            variant: 'destructive', 
            title: 'Camera Error', 
            description: `Failed to access camera: ${error.message}` 
          });
        }
      }
      
      return null;
    }
  }, [toast]);

  // Clean up WebRTC connections
  const cleanupConnections = useCallback((stopLocalStream = true) => {
    console.log('Cleaning up WebRTC connections. Stop local stream:', stopLocalStream);
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.oniceconnectionstatechange = null;
      
      // Remove all senders
      peerConnectionRef.current.getSenders().forEach(sender => {
        if (sender.track) {
          sender.track.stop();
        }
        try {
          peerConnectionRef.current?.removeTrack(sender);
        } catch (e) {
          console.warn('Error removing track:', e);
        }
      });
      
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
      console.log('PeerConnection closed');
    }
    
    // Stop local stream if requested
    if (stopLocalStream && localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      console.log('Local stream stopped');
    } else if (localStreamRef.current && localVideoRef.current && !localVideoRef.current.srcObject && !stopLocalStream) {
      // Re-attach local stream if not stopping it
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    
    // Clear remote video
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }, []);

  // Setup peer connection for WebRTC
  const setupPeerConnection = useCallback(async (roomId: string, isInitiator: boolean): Promise<RTCPeerConnection | null> => {
    console.log(`Setting up WebRTC peer connection. Room: ${roomId}, Initiator: ${isInitiator}`);
    
    // Ensure we have a local stream
    const stream = localStreamRef.current || await initializeCamera();
    if (!stream) {
      toast({ 
        title: "Camera Error", 
        description: "Cannot setup video call without camera access.", 
        variant: "destructive" 
      });
      return null;
    }

    // Clean up existing connection
    if (peerConnectionRef.current) {
      console.warn('PeerConnection already exists. Closing before creating new one.');
      cleanupConnections(false);
    }

    // Create new peer connection
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });
    
    peerConnectionRef.current = pc;

    // Add local stream tracks to peer connection
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate');
        // This should be handled by the parent component that has access to socket
        if (window.videoChatEmitWebRTCSignal) {
          window.videoChatEmitWebRTCSignal({
            roomId,
            signalData: { candidate: event.candidate }
          });
        }
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote track');
      if (remoteVideoRef.current && event.streams?.[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Handle connection state changes
    pc.oniceconnectionstatechange = () => {
      if (peerConnectionRef.current) {
        console.log('ICE connection state:', peerConnectionRef.current.iceConnectionState);
        
        if (peerConnectionRef.current.iceConnectionState === 'failed') {
          toast({
            title: "Connection Failed",
            description: "Video connection failed. Trying to reconnect...",
            variant: "destructive"
          });
        }
      }
    };

    // Create offer if initiator
    if (isInitiator) {
      try {
        console.log('Creating offer as initiator');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        // This should be handled by the parent component
        if (window.videoChatEmitWebRTCSignal) {
          window.videoChatEmitWebRTCSignal({
            roomId,
            signalData: offer
          });
        }
      } catch (error) {
        console.error('Error creating offer:', error);
        toast({
          title: "WebRTC Error",
          description: "Failed to create video call offer.",
          variant: "destructive"
        });
      }
    }

    return pc;
  }, [initializeCamera, cleanupConnections, toast]);

  return {
    localVideoRef,
    remoteVideoRef,
    localStream: localStreamRef.current,
    peerConnection: peerConnectionRef.current,
    hasCameraPermission,
    initializeCamera,
    cleanupConnections,
    setupPeerConnection
  };
};

// Extend window interface for WebRTC signal emission
declare global {
  interface Window {
    videoChatEmitWebRTCSignal?: (data: { roomId: string; signalData: any }) => void;
  }
}