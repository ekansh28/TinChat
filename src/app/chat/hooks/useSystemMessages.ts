// src/app/chat/hooks/useSystemMessages.ts
import { useEffect, useRef } from 'react';
import { Message } from '../utils/ChatHelpers';

const SYS_MSG_SEARCHING_PARTNER = 'Searching for a partner...';
const SYS_MSG_STOPPED_SEARCHING = 'Stopped searching for a partner.';
const SYS_MSG_CONNECTED_PARTNER = 'Connected with a partner. You can start chatting!';
const SYS_MSG_YOU_DISCONNECTED = 'You have disconnected.';
const SYS_MSG_PARTNER_DISCONNECTED = 'Your partner has disconnected.';
const SYS_MSG_COMMON_INTERESTS_PREFIX = 'You both like ';

interface SystemMessageState {
  isPartnerConnected: boolean;
  isFindingPartner: boolean;
  connectionError: string | null;
  isSelfDisconnectedRecently: boolean;
  isPartnerLeftRecently: boolean;
  partnerInterests: string[];
  interests: string[];
  messages: Message[];
  setMessages: (messages: Message[]) => void;
}

export const useSystemMessages = (state: SystemMessageState) => {
  const prevIsFindingPartnerRef = useRef(false);
  const prevIsPartnerConnectedRef = useRef(false);
  const prevIsSelfDisconnectedRecentlyRef = useRef(false);
  const prevIsPartnerLeftRecentlyRef = useRef(false);

  useEffect(() => {
    const {
      isPartnerConnected,
      isFindingPartner,
      connectionError,
      isSelfDisconnectedRecently,
      isPartnerLeftRecently,
      partnerInterests,
      interests,
      messages,
      setMessages
    } = state;

    let updatedMessages = [...messages];
    
    const filterSystemMessagesFrom = (msgs: Message[], textPattern: string): Message[] => 
      msgs.filter(msg => !(msg.sender === 'system' && msg.text.toLowerCase().includes(textPattern.toLowerCase())));
    
    const addSystemMessageIfNotPresentIn = (msgs: Message[], text: string, idSuffix: string): Message[] => {
      const lowerText = text.toLowerCase();
      if (!msgs.some(msg => msg.sender === 'system' && msg.text.toLowerCase().includes(lowerText))) {
        return [...msgs, { 
          id: `${Date.now()}-${idSuffix}`, 
          text, 
          sender: 'system', 
          timestamp: new Date() 
        }];
      }
      return msgs;
    };

    // System message logic (simplified)
    if (isSelfDisconnectedRecently && isFindingPartner) { 
      updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_PARTNER_DISCONNECTED.toLowerCase());
      updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_STOPPED_SEARCHING.toLowerCase());
      updatedMessages = addSystemMessageIfNotPresentIn(updatedMessages, SYS_MSG_SEARCHING_PARTNER, 'search-after-skip');
    } else if (isPartnerLeftRecently) { 
      updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_SEARCHING_PARTNER.toLowerCase());
      updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_STOPPED_SEARCHING.toLowerCase());
      updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_YOU_DISCONNECTED.toLowerCase());
      updatedMessages = addSystemMessageIfNotPresentIn(updatedMessages, SYS_MSG_PARTNER_DISCONNECTED, 'partner-left');
    } else if (isFindingPartner) { 
      if (!prevIsFindingPartnerRef.current || prevIsSelfDisconnectedRecentlyRef.current || prevIsPartnerLeftRecentlyRef.current) {
        updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_PARTNER_DISCONNECTED.toLowerCase());
        updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_STOPPED_SEARCHING.toLowerCase());
        updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_YOU_DISCONNECTED.toLowerCase());
        updatedMessages = addSystemMessageIfNotPresentIn(updatedMessages, SYS_MSG_SEARCHING_PARTNER, 'search');
      }
    } else if (isPartnerConnected) { 
      if (!prevIsPartnerConnectedRef.current) { 
        updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_SEARCHING_PARTNER.toLowerCase());
        updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_PARTNER_DISCONNECTED.toLowerCase());
        updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_STOPPED_SEARCHING.toLowerCase());
        updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_YOU_DISCONNECTED.toLowerCase());
        updatedMessages = addSystemMessageIfNotPresentIn(updatedMessages, SYS_MSG_CONNECTED_PARTNER, 'connect');
        
        if (interests.length > 0 && partnerInterests.length > 0) {
          const common = interests.filter(i => partnerInterests.includes(i));
          if (common.length > 0) {
            updatedMessages = addSystemMessageIfNotPresentIn(updatedMessages, `${SYS_MSG_COMMON_INTERESTS_PREFIX}${common.join(', ')}.`, 'common');
          }
        }
      }
    } else if (prevIsFindingPartnerRef.current && !isFindingPartner && !isPartnerConnected && !connectionError && !isPartnerLeftRecently && !isSelfDisconnectedRecently) {
      if (updatedMessages.some(msg => msg.sender === 'system' && msg.text.toLowerCase().includes(SYS_MSG_SEARCHING_PARTNER.toLowerCase()))) {
        updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_SEARCHING_PARTNER.toLowerCase());
        updatedMessages = addSystemMessageIfNotPresentIn(updatedMessages, SYS_MSG_STOPPED_SEARCHING, 'stopsearch');
      }
    }

    if (updatedMessages.length !== messages.length || !updatedMessages.every((v, i) => v.id === messages[i]?.id && v.text === messages[i]?.text)) {
      setMessages(updatedMessages);
    }

    prevIsFindingPartnerRef.current = isFindingPartner;
    prevIsPartnerConnectedRef.current = isPartnerConnected;
    prevIsSelfDisconnectedRecentlyRef.current = isSelfDisconnectedRecently;
    prevIsPartnerLeftRecentlyRef.current = isPartnerLeftRecently;
  }, [state]);
};