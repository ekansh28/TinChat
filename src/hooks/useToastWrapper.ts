// Alternative: Update your useToast hook or create a wrapper
// src/hooks/useToastWrapper.ts
import { useToast as useOriginalToast } from '@/hooks/use-toast';

export interface CustomToastProps {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}

export function useToast() {
  const { toast: originalToast, ...rest } = useOriginalToast();
  
  const toast = ({ title, description, variant = "default" }: CustomToastProps) => {
    return originalToast({
      title,
      description,
      // Map variant if needed based on your toast implementation
      ...(variant === "destructive" && { 
        className: "destructive group border-destructive bg-destructive text-destructive-foreground" 
      })
    });
  };

  return { toast, ...rest };
}