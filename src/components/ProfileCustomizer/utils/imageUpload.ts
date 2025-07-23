// src/components/ProfileCustomizer/utils/imageUpload.ts
import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile } from '../types';

// Enhanced image validation
export const validateImageFile = (file: File): Promise<{valid: boolean, error?: string}> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve({ valid: false, error: 'File must be an image' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      resolve({ valid: false, error: 'File size must be under 10MB' });
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);
    
    const cleanup = () => URL.revokeObjectURL(url);
    
    const timeout = setTimeout(() => {
      cleanup();
      resolve({ valid: false, error: 'Image validation timeout' });
    }, 5000);
    
    img.onload = () => {
      clearTimeout(timeout);
      cleanup();
      
      if (img.width < 32 || img.height < 32) {
        resolve({ valid: false, error: 'Image must be at least 32x32 pixels' });
        return;
      }
      
      if (img.width > 4096 || img.height > 4096) {
        resolve({ valid: false, error: 'Image must be smaller than 4096x4096 pixels' });
        return;
      }
      
      resolve({ valid: true });
    };
    
    img.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      resolve({ valid: false, error: 'Invalid or corrupted image file' });
    };
    
    img.src = url;
  });
};

// Hook for handling image uploads
export const useImageUpload = (
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>
) => {
  const { toast } = useToast();

  const handleAvatarUpload = useCallback(async (file: File) => {
    try {
      const validation = await validateImageFile(file);
      
      if (!validation.valid) {
        toast({
          title: "Invalid File",
          description: validation.error,
          variant: "destructive"
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setProfile(prev => ({ ...prev, avatar_url: dataUrl }));
        toast({
          title: "Avatar Uploaded",
          description: "Profile picture updated successfully",
          variant: "default"
        });
      };
      reader.onerror = () => {
        toast({
          title: "Upload Error",
          description: "Failed to read the image file",
          variant: "destructive"
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast({
        title: "Upload Error",
        description: "Failed to process the uploaded file",
        variant: "destructive"
      });
    }
  }, [setProfile, toast]);

  const handleBannerUpload = useCallback(async (file: File) => {
    try {
      const validation = await validateImageFile(file);
      
      if (!validation.valid) {
        toast({
          title: "Invalid File",
          description: validation.error,
          variant: "destructive"
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setProfile(prev => ({ ...prev, banner_url: dataUrl }));
        toast({
          title: "Banner Uploaded",
          description: "Banner image updated successfully",
          variant: "default"
        });
      };
      reader.onerror = () => {
        toast({
          title: "Upload Error",
          description: "Failed to read the image file",
          variant: "destructive"
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Banner upload error:', error);
      toast({
        title: "Upload Error",
        description: "Failed to process the uploaded file",
        variant: "destructive"
      });
    }
  }, [setProfile, toast]);

  return {
    handleAvatarUpload,
    handleBannerUpload
  };
};