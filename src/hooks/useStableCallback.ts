// src/hooks/useStableCallback.ts - FIXED TO PREVENT UNMOUNTED COMPONENT UPDATES
import { useCallback, useRef, useEffect } from 'react';

/**
 * Creates a stable callback that won't cause re-renders and prevents updates on unmounted components
 */
export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const callbackRef = useRef<T>(callback);
  const isMountedRef = useRef(true);

  // Update the callback ref when the callback changes
  callbackRef.current = callback;

  // Track component mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Return a stable callback that checks mount state
  const stableCallback = useCallback((...args: any[]) => {
    if (isMountedRef.current) {
      return callbackRef.current(...args);
    } else {
      console.warn('[useStableCallback] Attempted to call callback on unmounted component');
      return undefined;
    }
  }, []) as T;

  return stableCallback;
}