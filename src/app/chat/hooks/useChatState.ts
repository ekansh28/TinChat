// src/app/chat/hooks/useChatState.ts
import { useState, useCallback } from 'react';
import { Message, PartnerInfo } from '../utils/ChatHelpers';

export function useChatState() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isPartnerConnected, setIsPartnerConnected] = useState<boolean>(false);
  const [isFindingPartner, setIsFindingPartner] = useState<boolean>(false);
  const [partnerInfo, setPartnerInfo] = useState<PartnerInfo | null>(null);
  const [isPartnerTyping, setIsPartnerTyping] = useState<boolean>(false);
  const [currentMessage, setCurrentMessage] = useState<string>('');

  const addMessage = useCallback((message: Partial<Message>) => {
    setMessages(prev => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      sender: 'system',
      text: '',
      ...message
    } as Message]);
  }, []);

  const addSystemMessage = useCallback((text: string) => {
    addMessage({
      text,
      sender: 'system'
    });
  }, [addMessage]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const resetChatState = useCallback(() => {
    setMessages([]);
    setIsPartnerConnected(false);
    setIsFindingPartner(false);
    setPartnerInfo(null);
    setIsPartnerTyping(false);
    setCurrentMessage('');
  }, []);

  return {
    messages,
    setMessages,
    isPartnerConnected,
    setIsPartnerConnected,
    isFindingPartner,
    setIsFindingPartner,
    partnerInfo,
    setPartnerInfo,
    isPartnerTyping,
    setIsPartnerTyping,
    currentMessage,
    setCurrentMessage,
    addMessage,
    addSystemMessage,
    clearMessages,
    resetChatState
  };
}