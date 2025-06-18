// src/hooks/use-toast.ts
'use client';

import { useState, useCallback } from 'react';

export interface ToastProps {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success';
  duration?: number;
}

interface Toast extends ToastProps {
  id: string;
  timestamp: number;
  duration: number; // Make duration required in Toast interface
}

let toastCount = 0;

// Simple toast state management
const toastState = {
  toasts: [] as Toast[],
  listeners: new Set<(toasts: Toast[]) => void>(),
  
  addToast(toast: ToastProps) {
    const id = (++toastCount).toString();
    const duration = toast.duration ?? 5000; // Default to 5 seconds
    
    const newToast: Toast = {
      id,
      timestamp: Date.now(),
      title: toast.title || undefined,
      description: toast.description || undefined,
      variant: toast.variant || 'default',
      duration: duration,
    };

    this.toasts = [...this.toasts, newToast];
    this.notifyListeners();

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => {
        this.removeToast(id);
      }, duration);
    }

    return { id };
  },

  removeToast(id: string) {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.notifyListeners();
  },

  subscribe(listener: (toasts: Toast[]) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },

  notifyListeners() {
    this.listeners.forEach(listener => listener([...this.toasts]));
  },
};

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Subscribe to toast state changes
  const updateToasts = useCallback((newToasts: Toast[]) => {
    setToasts(newToasts);
  }, []);

  // Subscribe on mount, unsubscribe on unmount
  useState(() => {
    const unsubscribe = toastState.subscribe(updateToasts);
    setToasts([...toastState.toasts]); // Initial state
    return unsubscribe;
  });

  const toast = useCallback((props: ToastProps) => {
    return toastState.addToast(props);
  }, []);

  const dismiss = useCallback((toastId: string) => {
    toastState.removeToast(toastId);
  }, []);

  const dismissAll = useCallback(() => {
    toastState.toasts = [];
    toastState.notifyListeners();
  }, []);

  return {
    toast,
    dismiss,
    dismissAll,
    toasts,
  };
}

// Convenience functions
export const toast = (props: ToastProps) => toastState.addToast(props);

export const showToast = {
  success: (title: string, description?: string) => 
    toast({ title, description, variant: 'success' }),
  
  error: (title: string, description?: string) => 
    toast({ title, description, variant: 'destructive' }),
  
  info: (title: string, description?: string) => 
    toast({ title, description, variant: 'default' }),
};