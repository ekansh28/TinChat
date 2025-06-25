// src/hooks/useStableCallback.ts - Missing hook that's referenced in useSocketCore

import { useCallback, useRef } from 'react';

/**
 * Creates a stable callback that doesn't change between renders
 * but always calls the latest version of the function
 */
export const useStableCallback = <T extends (...args: any[]) => any>(
  callback: T
): T => {
  const callbackRef = useRef<T>(callback);
  
  // Update ref with latest callback
  callbackRef.current = callback;
  
  // Return stable callback that calls the latest version
  const stableCallback = useCallback(
    ((...args: any[]) => {
      return callbackRef.current(...args);
    }) as T,
    []
  );
  
  return stableCallback;
};