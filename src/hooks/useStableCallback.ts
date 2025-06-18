// src/hooks/useStableCallback.ts - NEW HOOK

import { useCallback, useRef } from 'react';

/**
 * Creates a stable callback that doesn't change identity on re-renders
 * but always calls the latest version of the function
 */
export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const callbackRef = useRef<T>(callback);
  
  // Update the ref to point to the latest callback
  callbackRef.current = callback;
  
  // Create a stable callback that calls the latest version
  const stableCallback = useCallback(
    ((...args: Parameters<T>) => {
      return callbackRef.current(...args);
    }) as T,
    []
  );
  
  return stableCallback;
}