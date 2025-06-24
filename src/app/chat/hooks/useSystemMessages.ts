// src/app/chat/hooks/useSystemMessages.ts - COMPLETELY FIXED SYSTEM MESSAGES

import { useEffect, useRef, useCallback } from 'react';

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'partner' | 'system';
  timestamp: Date;
  type?: 'info' | 'warning' | 'error' | 'success';
}

interface UseSystemMessagesProps {
  isPartnerConnected: boolean;
  isFindingPartner: boolean;
  connectionError: string | null;
  isSelfDisconnectedRecently: boolean;
  isPartnerLeftRecently: boolean;
  wasSkippedByPartner: boolean;
  didSkipPartner: boolean;
  partnerInterests: string[];
  interests: string[];
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

export const useSystemMessages = ({
  isPartnerConnected,
  isFindingPartner,
  connectionError,
  isSelfDisconnectedRecently,
  isPartnerLeftRecently,
  wasSkippedByPartner,
  didSkipPartner,
  partnerInterests,
  interests,
  messages,
  setMessages
}: UseSystemMessagesProps) => {
  
  const lastStateRef = useRef({
    isPartnerConnected: false,
    isFindingPartner: false,
    connectionError: null as string | null,
    wasSkippedByPartner: false,
    didSkipPartner: false,
    isPartnerLeftRecently: false,
    isSelfDisconnectedRecently: false
  });

  const addedMessagesRef = useRef(new Set<string>());

  const addSystemMessage = useCallback((text: string, type: 'info' | 'warning' | 'error' | 'success' = 'info') => {
    const messageKey = `${type}-${text}`;
    
    // Prevent duplicate system messages
    if (addedMessagesRef.current.has(messageKey)) {
      return;
    }
    
    addedMessagesRef.current.add(messageKey);
    
    const systemMessage: Message = {
      id: `system-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
      text,
      sender: 'system',
      timestamp: new Date(),
      type
    };

    setMessages(prev => [...prev, systemMessage]);
    
    // Clean up old message keys after a delay
    setTimeout(() => {
      addedMessagesRef.current.delete(messageKey);
    }, 5000);

    console.log('[SystemMessages] Added:', text);
  }, [setMessages]);

  // ✅ CRITICAL: Handle partner connection established
  useEffect(() => {
    if (isPartnerConnected && !lastStateRef.current.isPartnerConnected) {
      console.log('[SystemMessages] 🎉 Partner connected');
      
      // Show connection message with interests if available
      let connectionMessage = "You're now connected with a stranger!";
      
      if (partnerInterests.length > 0) {
        const commonInterests = interests.filter(interest => 
          partnerInterests.some(pInterest => 
            pInterest.toLowerCase() === interest.toLowerCase()
          )
        );
        
        if (commonInterests.length > 0) {
          connectionMessage += ` You both like: ${commonInterests.join(', ')}.`;
        } else {
          connectionMessage += ` They're interested in: ${partnerInterests.slice(0, 3).join(', ')}.`;
        }
      }
      
      addSystemMessage(connectionMessage, 'success');
    }
    
    lastStateRef.current.isPartnerConnected = isPartnerConnected;
  }, [isPartnerConnected, partnerInterests, interests, addSystemMessage]);

  // ✅ CRITICAL: Handle being skipped by partner (with clear message)
  useEffect(() => {
    if (wasSkippedByPartner && !lastStateRef.current.wasSkippedByPartner) {
      console.log('[SystemMessages] 😞 User was skipped by partner');
      
      addSystemMessage(
        "Your chat partner skipped you. Click 'New Chat' to find someone new!",
        'warning'
      );
    }
    
    lastStateRef.current.wasSkippedByPartner = wasSkippedByPartner;
  }, [wasSkippedByPartner, addSystemMessage]);

  // ✅ CRITICAL: Handle skipping a partner (with confirmation message)
  useEffect(() => {
    if (didSkipPartner && !lastStateRef.current.didSkipPartner) {
      console.log('[SystemMessages] ✅ User skipped partner');
      
      addSystemMessage(
        "Looking for your next chat partner...",
        'info'
      );
    }
    
    lastStateRef.current.didSkipPartner = didSkipPartner;
  }, [didSkipPartner, addSystemMessage]);

  // ✅ Handle partner leaving normally
  useEffect(() => {
    if (isPartnerLeftRecently && !lastStateRef.current.isPartnerLeftRecently) {
      console.log('[SystemMessages] 👋 Partner left normally');
      
      addSystemMessage(
        "Your chat partner has left the conversation.",
        'info'
      );
    }
    
    lastStateRef.current.isPartnerLeftRecently = isPartnerLeftRecently;
  }, [isPartnerLeftRecently, addSystemMessage]);

  // ✅ Handle self disconnection
  useEffect(() => {
    if (isSelfDisconnectedRecently && !lastStateRef.current.isSelfDisconnectedRecently) {
      console.log('[SystemMessages] 🔌 Self disconnected');
      
      addSystemMessage(
        "You left the conversation.",
        'info'
      );
    }
    
    lastStateRef.current.isSelfDisconnectedRecently = isSelfDisconnectedRecently;
  }, [isSelfDisconnectedRecently, addSystemMessage]);

  // ✅ Handle searching for partner
  useEffect(() => {
    if (isFindingPartner && !lastStateRef.current.isFindingPartner && !isPartnerConnected) {
      console.log('[SystemMessages] 🔍 Started searching for partner');
      
      let searchMessage = "Looking for someone to chat with...";
      
      if (interests.length > 0) {
        searchMessage += ` Matching based on your interests: ${interests.slice(0, 3).join(', ')}.`;
      }
      
      addSystemMessage(searchMessage, 'info');
    }
    
    lastStateRef.current.isFindingPartner = isFindingPartner;
  }, [isFindingPartner, isPartnerConnected, interests, addSystemMessage]);

  // ✅ Handle connection errors
  useEffect(() => {
    if (connectionError && connectionError !== lastStateRef.current.connectionError) {
      console.log('[SystemMessages] ❌ Connection error:', connectionError);
      
      let errorMessage = "Connection issue occurred.";
      
      if (connectionError.includes('timeout')) {
        errorMessage = "Connection timed out. Please check your internet and try again.";
      } else if (connectionError.includes('refused')) {
        errorMessage = "Unable to connect to chat servers. Please try again later.";
      } else if (connectionError.includes('network')) {
        errorMessage = "Network error. Please check your connection and refresh the page.";
      }
      
      addSystemMessage(errorMessage, 'error');
    }
    
    lastStateRef.current.connectionError = connectionError;
  }, [connectionError, addSystemMessage]);

  // ✅ Welcome message on first load (only if no messages exist)
  useEffect(() => {
    if (messages.length === 0 && !isFindingPartner && !isPartnerConnected) {
      console.log('[SystemMessages] 👋 Showing welcome message');
      
      let welcomeMessage = "Welcome to the chat! Click 'New Chat' to find someone to talk with.";
      
      if (interests.length > 0) {
        welcomeMessage += ` Your interests: ${interests.join(', ')}.`;
      }
      
      addSystemMessage(welcomeMessage, 'info');
    }
  }, [messages.length, isFindingPartner, isPartnerConnected, interests, addSystemMessage]);

  // ✅ Cleanup old system messages
  useEffect(() => {
    const interval = setInterval(() => {
      setMessages(prev => {
        const cutoffTime = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
        return prev.filter(msg => 
          msg.sender !== 'system' || msg.timestamp > cutoffTime
        );
      });
    }, 60000); // Clean every minute

    return () => clearInterval(interval);
  }, [setMessages]);

  // ✅ Reset message tracking when messages are cleared
  useEffect(() => {
    if (messages.length === 0) {
      addedMessagesRef.current.clear();
    }
  }, [messages.length]);

  return {
    addSystemMessage
  };
};