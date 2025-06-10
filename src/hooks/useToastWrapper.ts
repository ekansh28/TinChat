// src/hooks/useToastWrapper.ts
import { useToast as useOriginalToast } from '@/hooks/use-toast';

export interface CustomToastProps {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  duration?: number;
}

export function useToast() {
  const { toast: originalToast, ...rest } = useOriginalToast();
  
  const toast = ({ title, description, variant = "default", duration }: CustomToastProps) => {
    return originalToast({
      title: title || 'Notification', // Provide fallback for undefined title
      description,
      variant,
      duration,
      // Map variant if needed based on your toast implementation
      ...(variant === "destructive" && { 
        className: "destructive group border-destructive bg-destructive text-destructive-foreground" 
      })
    });
  };

  return { toast, ...rest };
}