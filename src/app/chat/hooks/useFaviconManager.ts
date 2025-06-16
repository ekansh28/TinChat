// src/app/chat/hooks/useFaviconManager.ts
import { useEffect, useRef } from 'react';
import { changeFavicon } from '../utils/ChatHelpers';

const FAVICON_IDLE = '/Idle.ico';
const FAVICON_SEARCHING = '/Searching.ico';
const FAVICON_SUCCESS = '/Success.ico';
const FAVICON_SKIPPED = '/Skipped.ico';
const FAVICON_DEFAULT = '/favicon.ico';

interface FaviconState {
  isPartnerConnected: boolean;
  isFindingPartner: boolean;
  connectionError: string | null;
  isSelfDisconnectedRecently: boolean;
  isPartnerLeftRecently: boolean;
}

export const useFaviconManager = (state: FaviconState) => {
  const successTransitionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const successTransitionEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const skippedFaviconTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevIsPartnerConnectedRef = useRef(false);

  useEffect(() => {
    const {
      isPartnerConnected,
      isFindingPartner,
      connectionError,
      isSelfDisconnectedRecently,
      isPartnerLeftRecently
    } = state;

    // Clear existing timeouts
    if (successTransitionIntervalRef.current) clearInterval(successTransitionIntervalRef.current);
    if (successTransitionEndTimeoutRef.current) clearTimeout(successTransitionEndTimeoutRef.current);
    if (skippedFaviconTimeoutRef.current) clearTimeout(skippedFaviconTimeoutRef.current);

    if (connectionError) {
      changeFavicon(FAVICON_SKIPPED);
    } else if (isSelfDisconnectedRecently) { 
      changeFavicon(FAVICON_SKIPPED);
      skippedFaviconTimeoutRef.current = setTimeout(() => {
        if (isFindingPartner) changeFavicon(FAVICON_SEARCHING); 
      }, 500);
    } else if (isPartnerLeftRecently) { 
      changeFavicon(FAVICON_SKIPPED);
      skippedFaviconTimeoutRef.current = setTimeout(() => {
        if (!isFindingPartner && !isPartnerConnected) changeFavicon(FAVICON_IDLE); 
      }, 1000);
    } else if (isFindingPartner) { 
      changeFavicon(FAVICON_SEARCHING);
    } else if (isPartnerConnected) { 
      if (!prevIsPartnerConnectedRef.current) { 
        let count = 0; 
        changeFavicon(FAVICON_SUCCESS);
        successTransitionIntervalRef.current = setInterval(() => { 
          changeFavicon(count % 2 === 0 ? FAVICON_IDLE : FAVICON_SUCCESS); 
          count++; 
        }, 750);
        successTransitionEndTimeoutRef.current = setTimeout(() => { 
          if (successTransitionIntervalRef.current) clearInterval(successTransitionIntervalRef.current); 
          if (isPartnerConnected) changeFavicon(FAVICON_SUCCESS); 
        }, 3000);
      } else if (!successTransitionIntervalRef.current && !successTransitionEndTimeoutRef.current) {
        changeFavicon(FAVICON_SUCCESS);
      }
    } else { 
      changeFavicon(FAVICON_IDLE);
    }

    prevIsPartnerConnectedRef.current = isPartnerConnected;
  }, [state]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (successTransitionIntervalRef.current) clearInterval(successTransitionIntervalRef.current);
      if (successTransitionEndTimeoutRef.current) clearTimeout(successTransitionEndTimeoutRef.current);
      if (skippedFaviconTimeoutRef.current) clearTimeout(skippedFaviconTimeoutRef.current);
      changeFavicon(FAVICON_DEFAULT, true);
    };
  }, []);
};