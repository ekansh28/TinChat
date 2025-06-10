// src/components/ProfileCustomizer/utils/fileHandlers.ts
import { supabase } from '@/lib/supabase';

// Simple UUID generator for compatibility
const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'file-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
};

export const uploadFile = async (file: File, bucket: string, userId: string): Promise<string | null> => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${generateId()}.${fileExt}`;
  const storagePath = `public/${userId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, file, { upsert: true });

  if (uploadError) {
    console.error(`${bucket} upload error:`, uploadError);
    throw new Error(`Failed to upload ${bucket}: ${uploadError.message}`);
  }
  
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  if (!urlData || !urlData.publicUrl) {
    throw new Error(`Could not get public URL for ${bucket}`);
  }
  
  return urlData.publicUrl;
};

export const validateImageFile = (file: File, maxSizeMB: number = 2): { valid: boolean; error?: string } => {
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: "Please select an image file." };
  }
  
  if (file.size > maxSizeMB * 1024 * 1024) {
    return { valid: false, error: `Please select an image smaller than ${maxSizeMB}MB.` };
  }
  
  return { valid: true };
};

export const createFilePreview = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

export const validateImageUrl = (url: string): { valid: boolean; error?: string } => {
  try {
    new URL(url);
  } catch {
    return { valid: false, error: "Please enter a valid URL" };
  }

  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  const isImageUrl = imageExtensions.some(ext => 
    url.toLowerCase().includes(ext)
  ) || url.includes('image') || url.includes('img');

  if (!isImageUrl) {
    return { valid: false, error: "URL must point to an image file" };
  }

  return { valid: true };
};