// src/components/ProfileCustomizer/components/ImageUploadSection.tsx
import React from 'react';
import { Button } from '@/components/ui/button-themed';
import { Label } from '@/components/ui/label-themed';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { validateImageFile, createFilePreview } from '../utils/fileHandlers';

interface ImageUploadSectionProps {
  avatarFile: File | null;
  setAvatarFile: React.Dispatch<React.SetStateAction<File | null>>;
  avatarPreview: string | null;
  setAvatarPreview: React.Dispatch<React.SetStateAction<string | null>>;
  avatarUrl: string | null;
  setAvatarUrl: React.Dispatch<React.SetStateAction<string | null>>;
  bannerFile: File | null;
  setBannerFile: React.Dispatch<React.SetStateAction<File | null>>;
  bannerPreview: string | null;
  setBannerPreview: React.Dispatch<React.SetStateAction<string | null>>;
  bannerUrl: string | null;
  setBannerUrl: React.Dispatch<React.SetStateAction<string | null>>;
  avatarFileInputRef: React.RefObject<HTMLInputElement>;
  bannerFileInputRef: React.RefObject<HTMLInputElement>;
  saving: boolean;
  isTheme98: boolean;
  mountedRef: React.MutableRefObject<boolean>;
}

export const ImageUploadSection: React.FC<ImageUploadSectionProps> = ({
  avatarFile,
  setAvatarFile,
  avatarPreview,
  setAvatarPreview,
  avatarUrl,
  setAvatarUrl,
  bannerFile,
  setBannerFile,
  bannerPreview,
  setBannerPreview,
  bannerUrl,
  setBannerUrl,
  avatarFileInputRef,
  bannerFileInputRef,
  saving,
  isTheme98,
  mountedRef
}) => {
  const { toast } = useToast();

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>, 
    type: 'avatar' | 'banner',
    setFile: React.Dispatch<React.SetStateAction<File | null>>,
    setPreview: React.Dispatch<React.SetStateAction<string | null>>,
    maxSize: number = 2
  ) => {
    if (!e.target.files || !e.target.files[0] || !mountedRef.current) return;

    const file = e.target.files[0];
    
    const validation = validateImageFile(file, maxSize);
    if (!validation.valid) {
      toast({ 
        title: "Invalid File", 
        description: validation.error
      });
      return;
    }
    
    setFile(file);
    
    try {
      const preview = await createFilePreview(file);
      if (mountedRef.current) {
        setPreview(preview);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to read ${type} file`
      });
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileChange(e, 'avatar', setAvatarFile, setAvatarPreview, 2);
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileChange(e, 'banner', setBannerFile, setBannerPreview, 5);
  };

  const removeFile = (type: 'avatar' | 'banner') => {
    if (type === 'avatar') {
      setAvatarFile(null);
      setAvatarPreview(null);
      setAvatarUrl(null);
      if (avatarFileInputRef.current) {
        avatarFileInputRef.current.value = '';
      }
    } else {
      setBannerFile(null);
      setBannerPreview(null);
      setBannerUrl(null);
      if (bannerFileInputRef.current) {
        bannerFileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className={cn(
      "p-4 rounded-lg border space-y-6",
      isTheme98 ? "sunken-panel" : "bg-gray-50 dark:bg-gray-800"
    )}>
      <h3 className="text-lg font-semibold mb-4">Images</h3>
      
      {/* Avatar Upload */}
      <div>
        <Label htmlFor="avatar-upload">Avatar Image</Label>
        <div className="mt-2 space-y-3">
          {(avatarPreview || avatarUrl) && (
            <div className="relative inline-block">
              <img 
                src={avatarPreview || avatarUrl || ''} 
                alt="Avatar preview" 
                className="w-24 h-24 rounded-full object-cover border-2 border-gray-300"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => removeFile('avatar')}
                disabled={saving}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full p-0 text-xs"
              >
                ×
              </Button>
            </div>
          )}
          
          <div className="flex gap-2">
            <input
              ref={avatarFileInputRef}
              id="avatar-upload"
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              disabled={saving}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => avatarFileInputRef.current?.click()}
              disabled={saving}
              size="sm"
            >
              {avatarPreview || avatarUrl ? 'Change' : 'Upload'} Avatar
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Recommended: Square image, max 2MB. JPG, PNG, GIF, WebP supported.
          </p>
        </div>
      </div>

      {/* Banner Upload */}
      <div>
        <Label htmlFor="banner-upload">Banner Image</Label>
        <div className="mt-2 space-y-3">
          {(bannerPreview || bannerUrl) && (
            <div className="relative inline-block">
              <img 
                src={bannerPreview || bannerUrl || ''} 
                alt="Banner preview" 
                className="w-full max-w-sm h-24 rounded object-cover border-2 border-gray-300"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => removeFile('banner')}
                disabled={saving}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full p-0 text-xs"
              >
                ×
              </Button>
            </div>
          )}
          
          <div className="flex gap-2">
            <input
              ref={bannerFileInputRef}
              id="banner-upload"
              type="file"
              accept="image/*"
              onChange={handleBannerChange}
              disabled={saving}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => bannerFileInputRef.current?.click()}
              disabled={saving}
              size="sm"
            >
              {bannerPreview || bannerUrl ? 'Change' : 'Upload'} Banner
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Recommended: Wide image (16:9 ratio), max 5MB. JPG, PNG, GIF, WebP supported.
          </p>
        </div>
      </div>
    </div>
  );
};