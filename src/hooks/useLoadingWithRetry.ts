// src/hooks/useLoadingWithRetry.ts - Reusable loading and retry hook
import { useState, useCallback, useRef } from 'react';

export interface LoadingState {
  loading: boolean;
  error: string | null;
  retryCount: number;
  isRetrying: boolean;
  progress: number;
  canRetry: boolean;
}

export interface RetryConfig {
  maxRetries?: number;
  retryDelays?: number[];
  autoRetry?: boolean;
  progressSimulation?: boolean;
}

export interface UseLoadingWithRetryReturn<T> extends LoadingState {
  execute: (params?: any) => Promise<T | null>;
  retry: () => Promise<T | null>;
  cancel: () => void;
  reset: () => void;
  data: T | null;
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  retryDelays: [1000, 2000, 4000], // Exponential backoff
  autoRetry: true,
  progressSimulation: true,
};

export function useLoadingWithRetry<T>(
  asyncFunction: (params?: any, signal?: AbortSignal) => Promise<T>,
  config: RetryConfig = {}
): UseLoadingWithRetryReturn<T> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [data, setData] = useState<T | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastParamsRef = useRef<any>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const canRetry = retryCount < finalConfig.maxRetries;

  // Simulate progress for better UX
  const startProgressSimulation = useCallback(() => {
    if (!finalConfig.progressSimulation) return;
    
    setProgress(0);
    progressIntervalRef.current = setInterval(() => {
      setProgress(prev => {
        const next = prev + Math.random() * 15;
        return next >= 90 ? 90 : next; // Stop at 90%, complete when done
      });
    }, 200);
  }, [finalConfig.progressSimulation]);

  const stopProgressSimulation = useCallback((complete = false) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (complete) {
      setProgress(100);
      setTimeout(() => setProgress(0), 500);
    } else {
      setProgress(0);
    }
  }, []);

  // Cancel any ongoing operation
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    stopProgressSimulation();
    setLoading(false);
    setIsRetrying(false);
    setError('Operation was cancelled');
  }, [stopProgressSimulation]);

  // Reset all state
  const reset = useCallback(() => {
    cancel();
    setLoading(false);
    setError(null);
    setRetryCount(0);
    setIsRetrying(false);
    setProgress(0);
    setData(null);
    lastParamsRef.current = null;
  }, [cancel]);

  // Execute the async function with retry logic
  const execute = useCallback(async (params?: any): Promise<T | null> => {
    // Cancel any previous operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    // Store params for retry
    lastParamsRef.current = params;

    setLoading(true);
    setError(null);
    
    if (finalConfig.progressSimulation) {
      startProgressSimulation();
    }

    try {
      console.log(`Executing operation ${retryCount > 0 ? `(retry ${retryCount}/${finalConfig.maxRetries})` : ''}`);
      
      const result = await asyncFunction(params, signal);
      
      if (signal.aborted) {
        console.log('Operation was cancelled');
        return null;
      }

      // Success
      setData(result);
      setError(null);
      setRetryCount(0);
      stopProgressSimulation(true);
      
      console.log('Operation completed successfully');
      return result;

    } catch (err: any) {
      if (signal.aborted) {
        console.log('Operation was cancelled, ignoring error');
        return null;
      }

      console.error('Operation failed:', err);
      const errorMessage = err.message || 'Operation failed';
      setError(errorMessage);

      // Auto-retry logic
      if (finalConfig.autoRetry && retryCount < finalConfig.maxRetries && !errorMessage.includes('cancelled')) {
        const delay = finalConfig.retryDelays[retryCount] || finalConfig.retryDelays[finalConfig.retryDelays.length - 1];
        
        console.log(`Auto-retrying in ${delay}ms... (${retryCount + 1}/${finalConfig.maxRetries})`);
        setIsRetrying(true);
        
        retryTimeoutRef.current = setTimeout(() => {
          setRetryCount(prev => prev + 1);
          setIsRetrying(false);
          execute(params);
        }, delay);
      } else {
        stopProgressSimulation();
        console.log(`Max retries reached or auto-retry disabled`);
      }

      return null;
    } finally {
      setLoading(false);
    }
  }, [asyncFunction, retryCount, finalConfig, startProgressSimulation, stopProgressSimulation]);

  // Manual retry function
  const retry = useCallback(async (): Promise<T | null> => {
    if (!canRetry) {
      console.warn('Cannot retry: max retries reached');
      return null;
    }

    setRetryCount(prev => prev + 1);
    return execute(lastParamsRef.current);
  }, [canRetry, execute]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  return {
    loading,
    error,
    retryCount,
    isRetrying,
    progress,
    canRetry,
    data,
    execute,
    retry,
    cancel,
    reset,
  };
}

// ✅ Specific hook for profile loading
export function useProfileLoader() {
  return useLoadingWithRetry(
    async (userId: string, signal?: AbortSignal) => {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .abortSignal(signal)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No profile found - return null for new users
          return null;
        }
        throw new Error(error.message || 'Failed to load profile');
      }

      return data;
    },
    {
      maxRetries: 3,
      retryDelays: [1000, 2000, 4000],
      autoRetry: true,
      progressSimulation: true,
    }
  );
}

// ✅ Specific hook for profile saving
export function useProfileSaver() {
  return useLoadingWithRetry(
    async (profileData: any, signal?: AbortSignal) => {
      if (!profileData) {
        throw new Error('Profile data is required');
      }

      const { error } = await supabase
        .from('user_profiles')
        .upsert(profileData, { onConflict: 'id' })
        .abortSignal(signal);

      if (error) {
        throw new Error(error.message || 'Failed to save profile');
      }

      return true;
    },
    {
      maxRetries: 2,
      retryDelays: [1000, 2000],
      autoRetry: false, // Don't auto-retry saves
      progressSimulation: false,
    }
  );
}

// ✅ Hook for any Supabase operation
export function useSupabaseOperation<T>() {
  return useLoadingWithRetry<T>(
    async (operation: () => Promise<T>, signal?: AbortSignal) => {
      return await operation();
    },
    {
      maxRetries: 3,
      retryDelays: [1000, 2000, 4000],
      autoRetry: true,
      progressSimulation: true,
    }
  );
}