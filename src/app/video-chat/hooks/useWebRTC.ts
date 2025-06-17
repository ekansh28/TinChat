// src/app/video-chat/hooks/useWebRTC.ts - ENHANCED VERSION
import { useRef, useState, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export const useWebRTC = () => {
  const { toast } = useToast();
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | undefined>(undefined);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');

  // ICE servers configuration
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ];

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
        video: {
          width: { ideal: 640, min: 320 },
          height: { ideal: 480, min: 240 },
          frameRate: { ideal: 30, min: 15 }
        }, 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      setHasCameraPermission(true);
      localStreamRef.current = stream;
      
      // Set up local video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        // Ensure video starts playing
        localVideoRef.current.play().catch(console.warn);
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
        } else if (error.name === 'NotReadableError') {
          toast({ 
            variant: 'destructive', 
            title: 'Camera In Use', 
            description: 'Camera is already in use by another application.' 
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
      peerConnectionRef.current.onconnectionstatechange = null;
      
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
      setConnectionState('closed');
      console.log('PeerConnection closed');
    }
    
    // Stop local stream if requested
    if (stopLocalStream && localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      setHasCameraPermission(undefined);
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
    const pc = new RTCPeerConnection({ iceServers });
    peerConnectionRef.current = pc;

    // Add local stream tracks to peer connection
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate');
        if (window.videoChatEmitWebRTCSignal) {
          window.videoChatEmitWebRTCSignal({
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
        remoteVideoRef.current.play().catch(console.warn);
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      if (peerConnectionRef.current) {
        const state = peerConnectionRef.current.connectionState;
        setConnectionState(state);
        console.log('Connection state:', state);
        
        if (state === 'connected') {
          toast({
            title: "Video Connected",
            description: "Video call established successfully!",
          });
        } else if (state === 'failed') {
          toast({
            title: "Connection Failed",
            description: "Video connection failed. Trying to reconnect...",
            variant: "destructive"
          });
        } else if (state === 'disconnected') {
          console.log('Peer connection disconnected');
        }
      }
    };

    // Handle ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      if (peerConnectionRef.current) {
        console.log('ICE connection state:', peerConnectionRef.current.iceConnectionState);
      }
    };

    // Create offer if initiator
    if (isInitiator) {
      try {
        console.log('Creating offer as initiator');
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        await pc.setLocalDescription(offer);
        
        if (window.videoChatEmitWebRTCSignal) {
          window.videoChatEmitWebRTCSignal({
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

  // Handle incoming WebRTC signals
  const handleWebRTCSignal = useCallback(async (signalData: any) => {
    if (!peerConnectionRef.current) {
      console.warn('Received WebRTC signal but no peer connection exists');
      return;
    }

    try {
      if (signalData.candidate) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(signalData.candidate));
        console.log('Added ICE candidate');
      } else if (signalData.type === 'offer') {
        console.log('Handling offer');
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signalData));
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        
        if (window.videoChatEmitWebRTCSignal) {
          window.videoChatEmitWebRTCSignal({
            signalData: answer
          });
        }
      } else if (signalData.type === 'answer') {
        console.log('Handling answer');
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signalData));
      }
    } catch (error) {
      console.error('Error handling WebRTC signal:', error);
      toast({
        title: "WebRTC Signal Error",
        description: "Failed to process video call signal.",
        variant: "destructive"
      });
    }
  }, [toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupConnections(true);
    };
  }, [cleanupConnections]);

  return {
    localVideoRef,
    remoteVideoRef,
    localStream: localStreamRef.current,
    peerConnection: peerConnectionRef.current,
    hasCameraPermission,
    connectionState,
    initializeCamera,
    cleanupConnections,
    setupPeerConnection,
    handleWebRTCSignal
  };
};

// Extend window interface for WebRTC signal emission
declare global {
  interface Window {
    videoChatEmitWebRTCSignal?: (data: { signalData: any }) => void;
  }
}