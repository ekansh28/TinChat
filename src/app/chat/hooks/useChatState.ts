// src/app/chat/hooks/useChatState.ts - FIXED VERSION
import { useState, useCallback, useRef } from 'react';
import { Message, PartnerInfo } from '../utils/ChatHelpers';

export function useChatState() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isPartnerConnected, setIsPartnerConnected] = useState<boolean>(false);
  const [isFindingPartner, setIsFindingPartner] = useState<boolean>(false);
  const [partnerInfo, setPartnerInfo] = useState<PartnerInfo | null>(null);
  const [isPartnerTyping, setIsPartnerTyping] = useState<boolean>(false);
  const [currentMessage, setCurrentMessage] = useState<string>('');

  // ✅ FIXED: Stable references to prevent infinite loops
  const stateRef = useRef({
    messages,
    isPartnerConnected,
    isFindingPartner,
    partnerInfo,
    isPartnerTyping,
    currentMessage
  });

  // Update ref on each render but don't cause re-renders
  stateRef.current = {
    messages,
    isPartnerConnected,
    isFindingPartner,
    partnerInfo,
    isPartnerTyping,
    currentMessage
  };

  // ✅ CRITICAL FIX: Stable callback - no dependencies that change every render
  const addMessage = useCallback((message: Partial<Message>) => {
    const newMessage: Message = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      sender: 'system',
      text: '',
      ...message
    };
    
    setMessages(prev => [...prev, newMessage]);
  }, []); // ✅ Empty deps - function is stable

  const addSystemMessage = useCallback((text: string) => {
    addMessage({
      text,
      sender: 'system'
    });
  }, [addMessage]); // ✅ addMessage is stable

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // ✅ FIXED: Reset function with proper state management
  const resetChatState = useCallback(() => {
    setMessages([]);
    setIsPartnerConnected(false);
    setIsFindingPartner(false);
    setPartnerInfo(null);
    setIsPartnerTyping(false);
    setCurrentMessage('');
  }, []); // ✅ No dependencies needed

  return {
    // State
    messages,
    isPartnerConnected,
    isFindingPartner,
    partnerInfo,
    isPartnerTyping,
    currentMessage,
    
    // Setters (direct - these are already stable from React)
    setMessages,
    setIsPartnerConnected,
    setIsFindingPartner,
    setPartnerInfo,
    setIsPartnerTyping,
    setCurrentMessage,
    
    // Stable methods
    addMessage,
    addSystemMessage,
    clearMessages,
    resetChatState
  };
}