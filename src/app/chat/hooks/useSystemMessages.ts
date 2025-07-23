// src/app/chat/hooks/useSystemMessages.ts - COMPLETE FIXED VERSION
import { useEffect, useRef } from 'react';
import { Message } from '../utils/ChatHelpers';

const SYS_MSG_SEARCHING_PARTNER = 'Searching for a partner...';
const SYS_MSG_STOPPED_SEARCHING = 'Stopped searching for a partner.';
const SYS_MSG_CONNECTED_PARTNER = 'Connected with a partner. You can start chatting!';
const SYS_MSG_YOU_DISCONNECTED = 'You have disconnected.';
const SYS_MSG_PARTNER_DISCONNECTED = 'Your partner has disconnected.';
const SYS_MSG_YOU_SKIPPED = 'You skipped the partner. Searching for a new one...';
const SYS_MSG_PARTNER_SKIPPED = 'Your partner skipped you. Click "Find" to search for a new partner.';
const SYS_MSG_COMMON_INTERESTS_PREFIX = 'You both like ';

interface SystemMessageState {
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
  setMessages: (messages: Message[]) => void;
}

export const useSystemMessages = (state: SystemMessageState) => {
  const prevIsFindingPartnerRef = useRef(false);
  const prevIsPartnerConnectedRef = useRef(false);
  const prevIsSelfDisconnectedRecentlyRef = useRef(false);
  const prevIsPartnerLeftRecentlyRef = useRef(false);
  const prevWasSkippedByPartnerRef = useRef(false);
  const prevDidSkipPartnerRef = useRef(false);

  useEffect(() => {
    const {
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

    // Handle skip scenarios properly
    if (wasSkippedByPartner && !prevWasSkippedByPartnerRef.current) {
      // User was just skipped by partner - NO auto-search
      updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_SEARCHING_PARTNER.toLowerCase());
      updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_PARTNER_DISCONNECTED.toLowerCase());
      updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_YOU_DISCONNECTED.toLowerCase());
      updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_YOU_SKIPPED.toLowerCase());
      updatedMessages = addSystemMessageIfNotPresentIn(updatedMessages, SYS_MSG_PARTNER_SKIPPED, 'partner-skipped');
    } else if (didSkipPartner && !prevDidSkipPartnerRef.current) {
      // User just skipped someone - auto-search should start
      updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_PARTNER_DISCONNECTED.toLowerCase());
      updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_YOU_DISCONNECTED.toLowerCase());
      updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_PARTNER_SKIPPED.toLowerCase());
      updatedMessages = addSystemMessageIfNotPresentIn(updatedMessages, SYS_MSG_YOU_SKIPPED, 'you-skipped');
    } else if (isSelfDisconnectedRecently && !wasSkippedByPartner && !didSkipPartner) { 
      // Regular self-disconnect (not skip-related)
      updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_PARTNER_DISCONNECTED.toLowerCase());
      updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_STOPPED_SEARCHING.toLowerCase());
      updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_PARTNER_SKIPPED.toLowerCase());
      updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_YOU_SKIPPED.toLowerCase());
      if (isFindingPartner) {
        updatedMessages = addSystemMessageIfNotPresentIn(updatedMessages, SYS_MSG_SEARCHING_PARTNER, 'search-after-disconnect');
      } else {
        updatedMessages = addSystemMessageIfNotPresentIn(updatedMessages, SYS_MSG_YOU_DISCONNECTED, 'you-disconnected');
      }
    } else if (isPartnerLeftRecently && !wasSkippedByPartner && !didSkipPartner) { 
      // Regular partner left (not skip-related)
      updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_SEARCHING_PARTNER.toLowerCase());
      updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_STOPPED_SEARCHING.toLowerCase());
      updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_YOU_DISCONNECTED.toLowerCase());
      updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_PARTNER_SKIPPED.toLowerCase());
      updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_YOU_SKIPPED.toLowerCase());
      updatedMessages = addSystemMessageIfNotPresentIn(updatedMessages, SYS_MSG_PARTNER_DISCONNECTED, 'partner-left');
    } else if (isFindingPartner && !wasSkippedByPartner) { 
      // Only show searching message if user wasn't skipped
      if (!prevIsFindingPartnerRef.current || 
          (prevIsSelfDisconnectedRecentlyRef.current && !wasSkippedByPartner) || 
          (prevIsPartnerLeftRecentlyRef.current && !wasSkippedByPartner)) {
        updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_PARTNER_DISCONNECTED.toLowerCase());
        updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_STOPPED_SEARCHING.toLowerCase());
        updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_YOU_DISCONNECTED.toLowerCase());
        updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_PARTNER_SKIPPED.toLowerCase());
        // Don't remove "you skipped" message when auto-searching after skip
        if (!didSkipPartner) {
          updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_YOU_SKIPPED.toLowerCase());
        }
        updatedMessages = addSystemMessageIfNotPresentIn(updatedMessages, SYS_MSG_SEARCHING_PARTNER, 'search');
      }
    } else if (isPartnerConnected) { 
      if (!prevIsPartnerConnectedRef.current) { 
        // Clear all previous messages when connected
        updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_SEARCHING_PARTNER.toLowerCase());
        updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_PARTNER_DISCONNECTED.toLowerCase());
        updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_STOPPED_SEARCHING.toLowerCase());
        updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_YOU_DISCONNECTED.toLowerCase());
        updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_PARTNER_SKIPPED.toLowerCase());
        updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_YOU_SKIPPED.toLowerCase());
        updatedMessages = addSystemMessageIfNotPresentIn(updatedMessages, SYS_MSG_CONNECTED_PARTNER, 'connect');
        
        // Add common interests message
        if (interests.length > 0 && partnerInterests.length > 0) {
          const common = interests.filter(i => partnerInterests.includes(i));
          if (common.length > 0) {
            updatedMessages = addSystemMessageIfNotPresentIn(updatedMessages, `${SYS_MSG_COMMON_INTERESTS_PREFIX}${common.join(', ')}.`, 'common');
          }
        }
      }
    } else if (prevIsFindingPartnerRef.current && !isFindingPartner && !isPartnerConnected && !connectionError && !isPartnerLeftRecently && !isSelfDisconnectedRecently && !wasSkippedByPartner && !didSkipPartner) {
      // Only show stopped searching for manual stops (not skip-related)
      if (updatedMessages.some(msg => msg.sender === 'system' && msg.text.toLowerCase().includes(SYS_MSG_SEARCHING_PARTNER.toLowerCase()))) {
        updatedMessages = filterSystemMessagesFrom(updatedMessages, SYS_MSG_SEARCHING_PARTNER.toLowerCase());
        updatedMessages = addSystemMessageIfNotPresentIn(updatedMessages, SYS_MSG_STOPPED_SEARCHING, 'stopsearch');
      }
    }

    // Update messages only if they actually changed
    if (updatedMessages.length !== messages.length || !updatedMessages.every((v, i) => v.id === messages[i]?.id && v.text === messages[i]?.text)) {
      setMessages(updatedMessages);
    }

    // Update all previous state refs
    prevIsFindingPartnerRef.current = isFindingPartner;
    prevIsPartnerConnectedRef.current = isPartnerConnected;
    prevIsSelfDisconnectedRecentlyRef.current = isSelfDisconnectedRecently;
    prevIsPartnerLeftRecentlyRef.current = isPartnerLeftRecently;
    prevWasSkippedByPartnerRef.current = wasSkippedByPartner;
    prevDidSkipPartnerRef.current = didSkipPartner;
  }, [state]);
};