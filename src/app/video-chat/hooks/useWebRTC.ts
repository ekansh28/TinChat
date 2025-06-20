// src/app/video-chat/hooks/useWebRTC.ts - FIXED VERSION WITH NULL SAFETY
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

  // ✅ ENHANCED: ICE servers configuration with fallbacks
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' }
  ];

  // ✅ ENHANCED: Initialize camera with better error handling
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
      console.log('[WebRTC] Requesting camera and microphone access...');
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
      
      console.log('[WebRTC] Camera and microphone access granted');
      return stream;
    } catch (error) {
      console.error('[WebRTC] Error accessing camera:', error);
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

  // ✅ ENHANCED: Clean up WebRTC connections with better error handling
  const cleanupConnections = useCallback((stopLocalStream = true) => {
    console.log('[WebRTC] Cleaning up connections. Stop local stream:', stopLocalStream);
    
    // Close peer connection
    if (peerConnectionRef.current) {
      try {
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
            console.warn('[WebRTC] Error removing track:', e);
          }
        });
        
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
        setConnectionState('closed');
        console.log('[WebRTC] PeerConnection closed');
      } catch (error) {
        console.error('[WebRTC] Error during peer connection cleanup:', error);
      }
    }
    
    // Stop local stream if requested
    if (stopLocalStream && localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
        }
        setHasCameraPermission(undefined);
        console.log('[WebRTC] Local stream stopped');
      } catch (error) {
        console.error('[WebRTC] Error stopping local stream:', error);
      }
    } else if (localStreamRef.current && localVideoRef.current && !localVideoRef.current.srcObject && !stopLocalStream) {
      // Re-attach local stream if not stopping it
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    
    // Clear remote video
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }, []);

  // ✅ ENHANCED: Setup peer connection with better error handling and null safety
  const setupPeerConnection = useCallback(async (roomId: string, isInitiator: boolean): Promise<RTCPeerConnection | null> => {
    console.log(`[WebRTC] Setting up peer connection. Room: ${roomId}, Initiator: ${isInitiator}`);
    
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
      console.warn('[WebRTC] PeerConnection already exists. Closing before creating new one.');
      cleanupConnections(false);
    }

    try {
      // Create new peer connection
      const pc = new RTCPeerConnection({ iceServers });
      peerConnectionRef.current = pc;

      // Add local stream tracks to peer connection
      stream.getTracks().forEach(track => {
        console.log('[WebRTC] Adding local track:', track.kind);
        pc.addTrack(track, stream);
      });

      // ✅ ENHANCED: Handle ICE candidates with better null safety
      pc.onicecandidate = (event) => {
        console.log('[WebRTC] ICE candidate event:', event.candidate ? 'candidate' : 'end-of-candidates');
        
        if (event.candidate) {
          console.log('[WebRTC] Sending ICE candidate');
          // ✅ CRITICAL FIX: Ensure we have the global function before calling
          if (typeof window !== 'undefined' && window.videoChatEmitWebRTCSignal) {
            try {
              window.videoChatEmitWebRTCSignal({
                signalData: { candidate: event.candidate }
              });
            } catch (error) {
              console.error('[WebRTC] Error sending ICE candidate:', error);
            }
          } else {
            console.warn('[WebRTC] videoChatEmitWebRTCSignal not available');
          }
        }
      };

      // ✅ ENHANCED: Handle remote stream with better error handling
      pc.ontrack = (event) => {
        console.log('[WebRTC] Received remote track:', event.track.kind);
        if (remoteVideoRef.current && event.streams?.[0]) {
          try {
            remoteVideoRef.current.srcObject = event.streams[0];
            remoteVideoRef.current.play().catch(error => {
              console.warn('[WebRTC] Error playing remote video:', error);
            });
          } catch (error) {
            console.error('[WebRTC] Error setting remote stream:', error);
          }
        }
      };

      // ✅ ENHANCED: Handle connection state changes with better logging
      pc.onconnectionstatechange = () => {
        if (peerConnectionRef.current) {
          const state = peerConnectionRef.current.connectionState;
          setConnectionState(state);
          console.log('[WebRTC] Connection state changed:', state);
          
          switch (state) {
            case 'connected':
              toast({
                title: "Video Connected",
                description: "Video call established successfully!",
              });
              break;
            case 'failed':
              toast({
                title: "Connection Failed",
                description: "Video connection failed. Trying to reconnect...",
                variant: "destructive"
              });
              break;
            case 'disconnected':
              console.log('[WebRTC] Peer connection disconnected');
              break;
            case 'closed':
              console.log('[WebRTC] Peer connection closed');
              break;
            default:
              console.log('[WebRTC] Connection state:', state);
          }
        }
      };

      // ✅ ENHANCED: Handle ICE connection state changes
      pc.oniceconnectionstatechange = () => {
        if (peerConnectionRef.current) {
          const iceState = peerConnectionRef.current.iceConnectionState;
          console.log('[WebRTC] ICE connection state:', iceState);
          
          if (iceState === 'failed') {
            console.warn('[WebRTC] ICE connection failed - attempting restart');
            // Attempt ICE restart
            pc.restartIce();
          }
        }
      };

      // ✅ ENHANCED: Create offer if initiator with better error handling
      if (isInitiator) {
        try {
          console.log('[WebRTC] Creating offer as initiator');
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
          });
          
          await pc.setLocalDescription(offer);
          console.log('[WebRTC] Local description set, sending offer');
          
          // ✅ CRITICAL FIX: Ensure signal data is valid before sending
          if (offer && typeof window !== 'undefined' && window.videoChatEmitWebRTCSignal) {
            try {
              window.videoChatEmitWebRTCSignal({
                signalData: offer
              });
            } catch (error) {
              console.error('[WebRTC] Error sending offer:', error);
              throw error;
            }
          } else {
            throw new Error('Cannot send offer - signal function not available');
          }
        } catch (error) {
          console.error('[WebRTC] Error creating offer:', error);
          toast({
            title: "WebRTC Error",
            description: "Failed to create video call offer.",
            variant: "destructive"
          });
          // Clean up failed connection
          cleanupConnections(false);
          return null;
        }
      }

      return pc;
    } catch (error) {
      console.error('[WebRTC] Error setting up peer connection:', error);
      toast({
        title: "WebRTC Setup Error",
        description: "Failed to initialize video connection.",
        variant: "destructive"
      });
      return null;
    }
  }, [initializeCamera, cleanupConnections, toast]);

  // ✅ CRITICAL FIX: Handle incoming WebRTC signals with comprehensive null safety
  const handleWebRTCSignal = useCallback(async (signalData: any) => {
    console.log('[WebRTC] Handling signal:', signalData?.type || 'candidate');
    
    // ✅ CRITICAL: Validate signalData first
    if (!signalData) {
      console.warn('[WebRTC] Received null/undefined signal data');
      return;
    }

    if (!peerConnectionRef.current) {
      console.warn('[WebRTC] Received signal but no peer connection exists');
      return;
    }

    try {
      if (signalData.candidate) {
        // ✅ Handle ICE candidate
        console.log('[WebRTC] Adding ICE candidate');
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(signalData.candidate));
      } else if (signalData.type === 'offer') {
        // ✅ Handle offer
        console.log('[WebRTC] Handling offer');
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signalData));
        
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        
        // ✅ Send answer back
        if (typeof window !== 'undefined' && window.videoChatEmitWebRTCSignal) {
          try {
            window.videoChatEmitWebRTCSignal({
              signalData: answer
            });
            console.log('[WebRTC] Answer sent');
          } catch (error) {
            console.error('[WebRTC] Error sending answer:', error);
          }
        }
      } else if (signalData.type === 'answer') {
        // ✅ Handle answer
        console.log('[WebRTC] Handling answer');
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signalData));
      } else {
        console.warn('[WebRTC] Unknown signal type:', signalData.type);
      }
    } catch (error) {
      console.error('[WebRTC] Error handling signal:', error);
      
      // ✅ More specific error handling
      if (error instanceof Error) {
        if (error.name === 'InvalidStateError') {
          console.warn('[WebRTC] Invalid state error - connection may be closed');
        } else if (error.name === 'TypeError') {
          console.warn('[WebRTC] Type error - malformed signal data');
        } else {
          toast({
            title: "WebRTC Signal Error",
            description: `Failed to process video signal: ${error.message}`,
            variant: "destructive"
          });
        }
      }
    }
  }, [toast]);

  // ✅ ENHANCED: Cleanup on unmount with error handling
  useEffect(() => {
    return () => {
      try {
        cleanupConnections(true);
      } catch (error) {
        console.error('[WebRTC] Error during cleanup on unmount:', error);
      }
    };
  }, [cleanupConnections]);

  // ✅ NEW: Connection health monitoring
  const getConnectionStats = useCallback(async () => {
    if (!peerConnectionRef.current) return null;
    
    try {
      const stats = await peerConnectionRef.current.getStats();
      const statsReport: any = {};
      
      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          statsReport.candidatePair = report;
        }
      });
      
      return statsReport;
    } catch (error) {
      console.warn('[WebRTC] Error getting connection stats:', error);
      return null;
    }
  }, []);

  // ✅ NEW: Force reconnection method
  const forceReconnect = useCallback(async (roomId: string) => {
    console.log('[WebRTC] Force reconnecting...');
    
    try {
      cleanupConnections(false);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      return await setupPeerConnection(roomId, true);
    } catch (error) {
      console.error('[WebRTC] Error during force reconnect:', error);
      return null;
    }
  }, [cleanupConnections, setupPeerConnection]);

  return {
    // Refs
    localVideoRef,
    remoteVideoRef,
    
    // State
    localStream: localStreamRef.current,
    peerConnection: peerConnectionRef.current,
    hasCameraPermission,
    connectionState,
    
    // Methods
    initializeCamera,
    cleanupConnections,
    setupPeerConnection,
    handleWebRTCSignal,
    getConnectionStats,
    forceReconnect
  };
};

// ✅ Extend window interface for WebRTC signal emissions
declare global {
  interface Window {
    videoChatEmitWebRTCSignal?: (data: { signalData: any }) => void;
  }
}