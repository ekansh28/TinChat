// src/components/ProfileCustomizer.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button-themed';
import { Input } from '@/components/ui/input-themed';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/components/theme-provider';
import { supabase } from '@/lib/supabase';
import { sanitizeCSS, getDefaultProfileCSS } from '@/lib/SafeCSS';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

interface ProfileCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_OPTIONS = [
  { value: 'online', label: 'Online', icon: '/icons/online.png' },
  { value: 'idle', label: 'Idle', icon: '/icons/idle.png' },
  { value: 'dnd', label: 'Do Not Disturb', icon: '/icons/dnd.png' },
  { value: 'offline', label: 'Offline', icon: '/icons/offline.png' }
] as const;

const DISPLAY_NAME_ANIMATIONS = [
  { value: 'none', label: 'None' },
  { value: 'rainbow', label: 'Rainbow' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'pulse', label: 'Pulse' },
  { value: 'glow', label: 'Glow' }
] as const;

const PRESET_COLORS = [
  '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', 
  '#ff00ff', '#00ffff', '#ffa500', '#800080', '#ffc0cb',
  '#90ee90', '#87ceeb', '#dda0dd', '#f0e68c', '#ff6347'
];

export const ProfileCustomizer: React.FC<ProfileCustomizerProps> = ({ 
  isOpen, 
  onClose 
}) => {
  const [customCSS, setCustomCSS] = useState('');
  const [bio, setBio] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [status, setStatus] = useState<'online' | 'idle' | 'dnd' | 'offline'>('online');
  const [displayNameColor, setDisplayNameColor] = useState('#ffffff');
  const [displayNameAnimation, setDisplayNameAnimation] = useState<'none' | 'rainbow' | 'gradient' | 'pulse' | 'glow'>('none');
  
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null | 'checking'>(null);
  const [originalUsername, setOriginalUsername] = useState('');

  const { toast } = useToast();
  const { currentTheme } = useTheme();
  
  const debouncedUsername = useDebounce(username, 500);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadCurrentProfile();
    }
  }, [isOpen]);

  // Username availability check
  useEffect(() => {
    const checkUsername = async () => {
      if (!debouncedUsername || debouncedUsername.length < 3 || !currentUser || !mountedRef.current) {
        setUsernameAvailable(null);
        return;
      }

      // If username is the same as original, it's available
      if (debouncedUsername === originalUsername) {
        setUsernameAvailable(true);
        return;
      }

      setUsernameAvailable('checking');
      
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('username')
          .eq('username', debouncedUsername)
          .neq('id', currentUser.id);

        if (!mountedRef.current) return;

        if (error) {
          console.error('Error checking username availability:', error);
          setUsernameAvailable(null);
        } else {
          // Username is available if no rows are returned
          setUsernameAvailable(!data || data.length === 0);
        }
      } catch (error) {
        console.error('Exception checking username:', error);
        if (mountedRef.current) {
          setUsernameAvailable(null);
        }
      }
    };

    checkUsername();
  }, [debouncedUsername, currentUser, originalUsername]);

  const loadCurrentProfile = async () => {
    if (!mountedRef.current) return;
    
    setLoading(true);
    try {
      console.log('ProfileCustomizer: Getting current user...');
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('ProfileCustomizer: Auth error:', userError);
        toast({
          title: "Authentication Error",
          description: "Please sign in to customize your profile",
          variant: "destructive"
        });
        onClose();
        return;
      }

      if (!mountedRef.current) return;

      console.log('ProfileCustomizer: Loading profile for user:', user.id);
      setCurrentUser(user);

      // Fetch all profile data including new fields
      const { data, error } = await supabase
        .from('user_profiles')
        .select(`
          profile_card_css, 
          bio, 
          display_name, 
          username, 
          avatar_url, 
          banner_url,
          pronouns,
          status,
          display_name_color,
          display_name_animation
        `)
        .eq('id', user.id);

      if (!mountedRef.current) return;

      if (error) {
        console.error('ProfileCustomizer: Error loading profile:', error);
        // Initialize with empty values
        setCustomCSS('');
        setBio('');
        setDisplayName('');
        setUsername('');
        setOriginalUsername('');
        setPronouns('');
        setStatus('online');
        setDisplayNameColor('#ffffff');
        setDisplayNameAnimation('none');
        setAvatarUrl(null);
        setAvatarPreview(null);
        setBannerUrl(null);
        setBannerPreview(null);
      } else if (data && data.length > 0) {
        const profile = data[0];
        console.log('ProfileCustomizer: Profile data loaded:', profile);
        setCustomCSS(profile.profile_card_css || '');
        setBio(profile.bio || '');
        setDisplayName(profile.display_name || '');
        setUsername(profile.username || '');
        setOriginalUsername(profile.username || '');
        setPronouns(profile.pronouns || '');
        setStatus(profile.status || 'online');
        setDisplayNameColor(profile.display_name_color || '#ffffff');
        setDisplayNameAnimation(profile.display_name_animation || 'none');
        setAvatarUrl(profile.avatar_url);
        setBannerUrl(profile.banner_url);
        
        if (profile.avatar_url) {
          setAvatarPreview(profile.avatar_url);
        }
        if (profile.banner_url) {
          setBannerPreview(profile.banner_url);
        }
      } else {
        console.log('ProfileCustomizer: No existing profile data found');
        setCustomCSS('');
        setBio('');
        setDisplayName('');
        setUsername('');
        setOriginalUsername('');
        setPronouns('');
        setStatus('online');
        setDisplayNameColor('#ffffff');
        setDisplayNameAnimation('none');
        setAvatarUrl(null);
        setAvatarPreview(null);
        setBannerUrl(null);
        setBannerPreview(null);
      }
    } catch (error) {
      console.error('ProfileCustomizer: Exception loading profile:', error);
      if (mountedRef.current) {
        toast({
          title: "Error",
          description: "Failed to load profile data",
          variant: "destructive"
        });
        setCustomCSS('');
        setBio('');
        setDisplayName('');
        setUsername('');
        setOriginalUsername('');
        setPronouns('');
        setStatus('online');
        setDisplayNameColor('#ffffff');
        setDisplayNameAnimation('none');
        setAvatarUrl(null);
        setAvatarPreview(null);
        setBannerUrl(null);
        setBannerPreview(null);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>, 
    type: 'avatar' | 'banner',
    setFile: React.Dispatch<React.SetStateAction<File | null>>,
    setPreview: React.Dispatch<React.SetStateAction<string | null>>,
    maxSize: number = 2,
    recommendedDimensions?: string
  ) => {
    if (!e.target.files || !e.target.files[0] || !mountedRef.current) return;

    const file = e.target.files[0];
    
    // Check file type
    if (!file.type.startsWith('image/')) {
      toast({ 
        title: "Invalid File", 
        description: "Please select an image file.", 
        variant: "destructive" 
      });
      return;
    }
    
    if (file.size > maxSize * 1024 * 1024) {
      toast({ 
        title: "Image too large", 
        description: `Please select an image smaller than ${maxSize}MB.`, 
        variant: "destructive" 
      });
      return;
    }
    
    setFile(file);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      if (mountedRef.current) {
        setPreview(reader.result as string);
      }
    };
    reader.onerror = () => {
      toast({
        title: "Error",
        description: `Failed to read ${type} file`,
        variant: "destructive"
      });
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileChange(e, 'avatar', setAvatarFile, setAvatarPreview, 2);
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileChange(e, 'banner', setBannerFile, setBannerPreview, 5);
  };

  const uploadFile = async (file: File, bucket: string, userId: string): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
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

  const handleSave = async () => {
    if (saving || !mountedRef.current) {
      console.log('ProfileCustomizer: Save already in progress or component unmounted');
      return;
    }

    if (!currentUser) {
      toast({
        title: "Authentication Error",
        description: "No user found - please refresh and try again",
        variant: "destructive"
      });
      return;
    }

    if (!username || username.length < 3) {
      toast({
        title: "Invalid Username",
        description: "Username must be at least 3 characters long",
        variant: "destructive"
      });
      return;
    }

    if (usernameAvailable === false) {
      toast({
        title: "Username Taken",
        description: "Please choose a different username",
        variant: "destructive"
      });
      return;
    }

    if (usernameAvailable === 'checking') {
      toast({
        title: "Username Check Pending",
        description: "Please wait for username availability check",
        variant: "default"
      });
      return;
    }

    setSaving(true);
    
    try {
      console.log('ProfileCustomizer: Starting save process for user:', currentUser.id);

      let finalAvatarUrl = avatarUrl;
      let finalBannerUrl = bannerUrl;

      // Upload avatar if a new file was selected
      if (avatarFile) {
        console.log('ProfileCustomizer: Uploading new avatar...');
        finalAvatarUrl = await uploadFile(avatarFile, 'avatars', currentUser.id);
        console.log('ProfileCustomizer: Avatar uploaded successfully');
      }

      // Upload banner if a new file was selected
      if (bannerFile) {
        console.log('ProfileCustomizer: Uploading new banner...');
        finalBannerUrl = await uploadFile(bannerFile, 'banners', currentUser.id);
        console.log('ProfileCustomizer: Banner uploaded successfully');
      }

      // Sanitize CSS before saving
      const sanitizedCSS = sanitizeCSS(customCSS);
      console.log('ProfileCustomizer: CSS sanitized, original length:', customCSS.length, 'sanitized length:', sanitizedCSS.length);

      // Prepare the data to save
      const profileData = {
        profile_card_css: sanitizedCSS,
        bio: bio.trim(),
        display_name: displayName.trim() || null,
        username: username.trim(),
        pronouns: pronouns.trim() || null,
        status: status,
        display_name_color: displayNameColor,
        display_name_animation: displayNameAnimation,
        avatar_url: finalAvatarUrl,
        banner_url: finalBannerUrl,
        last_seen: new Date().toISOString()
      };

      console.log('ProfileCustomizer: Attempting to save profile data:', profileData);

      // Check if profile exists first
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', currentUser.id);

      if (existingProfile && existingProfile.length > 0) {
        // Update existing profile
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update(profileData)
          .eq('id', currentUser.id);

        if (updateError) {
          console.error('ProfileCustomizer: Update error:', updateError);
          throw new Error(`Failed to update profile: ${updateError.message}`);
        }

        console.log('ProfileCustomizer: Profile updated successfully');
      } else {
        // Insert new profile
        console.log('ProfileCustomizer: No existing profile found, creating new one');
        
        const insertData = {
          id: currentUser.id,
          ...profileData,
          profile_complete: true
        };

        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert(insertData);

        if (insertError) {
          console.error('ProfileCustomizer: Insert error:', insertError);
          throw new Error(`Failed to create profile: ${insertError.message}`);
        }

        console.log('ProfileCustomizer: Profile created successfully');
      }

      // Update original username for future checks
      setOriginalUsername(username);

      toast({
        title: "Success",
        description: "Profile customization saved!",
        variant: "default"
      });

      setTimeout(() => {
        if (mountedRef.current) {
          onClose();
        }
      }, 500);

    } catch (error: any) {
      console.error('ProfileCustomizer: Save error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save profile customization",
        variant: "destructive"
      });
    } finally {
      if (mountedRef.current) {
        setSaving(false);
      }
    }
  };

  const handleReset = () => {
    setCustomCSS(getDefaultProfileCSS());
  };

  const handleClose = () => {
    if (saving) {
      console.log('ProfileCustomizer: Cannot close while saving');
      return;
    }
    onClose();
  };

  const removeFile = (type: 'avatar' | 'banner') => {
    if (type === 'avatar') {
      setAvatarFile(null);
      setAvatarPreview(null);
      setAvatarUrl(null);
    } else {
      setBannerFile(null);
      setBannerPreview(null);
      setBannerUrl(null);
    }
  };

  if (!isOpen) return null;

  const isTheme98 = currentTheme === 'theme-98';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={cn(
        'window flex flex-col relative',
        'max-w-7xl w-full mx-4 max-h-[95vh]',
        isTheme98 ? '' : 'bg-white dark:bg-gray-800 rounded-lg'
      )} style={{ width: '95vw', height: '95vh' }}>
        
        <div className={cn("title-bar", isTheme98 ? '' : 'border-b p-4')}>
          <div className="flex items-center justify-between">
            <div className="title-bar-text">Enhanced Profile Customizer</div>
            <Button 
              onClick={handleClose} 
              className={cn(isTheme98 ? '' : 'ml-auto')}
              variant={isTheme98 ? undefined : "outline"}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Close'}
            </Button>
          </div>
        </div>

        <div className={cn(
          'window-body window-body-content flex-grow overflow-hidden',
          isTheme98 ? 'p-2' : 'p-6'
        )}>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-black dark:text-white animate-pulse">Loading profile data...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-full">
              {/* Left Column - Form Controls */}
              <div className="space-y-6 overflow-y-auto pr-2">
                {/* Banner Section */}
                <div className={cn(
                  "p-4 rounded-lg border",
                  isTheme98 ? "sunken-panel" : "bg-gray-50 dark:bg-gray-800"
                )}>
                  <h3 className="text-lg font-semibold mb-4">Banner</h3>
                  <div className="space-y-4">
                    <div className="aspect-[3/1] w-full max-w-md mx-auto relative overflow-hidden rounded-lg border bg-gray-100">
                      {bannerPreview ? (
                        <Image 
                          src={bannerPreview} 
                          alt="Banner preview" 
                          fill
                          className="object-cover" 
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                          <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-center space-x-2">
                      <Button 
                        type="button" 
                        onClick={() => bannerFileInputRef.current?.click()}
                        disabled={saving}
                        variant="outline"
                        size="sm"
                      >
                        Upload Banner
                      </Button>
                      {bannerPreview && (
                        <Button 
                          type="button" 
                          onClick={() => removeFile('banner')}
                          disabled={saving}
                          variant="outline"
                          size="sm"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <input
                      type="file"
                      ref={bannerFileInputRef}
                      onChange={handleBannerChange}
                      accept="image/png, image/jpeg, image/gif, image/webp"
                      className="hidden"
                    />
                    <div className="text-xs text-gray-500 text-center">
                      Recommended: 3:1 aspect ratio (e.g., 900x300px), max 5MB
                    </div>
                  </div>
                </div>

                {/* Avatar Section */}
                <div className={cn(
                  "p-4 rounded-lg border",
                  isTheme98 ? "sunken-panel" : "bg-gray-50 dark:bg-gray-800"
                )}>
                  <h3 className="text-lg font-semibold mb-4">Profile Picture</h3>
                  <div className="flex items-center space-x-4">
                    <span className="inline-block h-20 w-20 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                      {avatarPreview ? (
                        <Image 
                          src={avatarPreview} 
                          alt="Avatar preview" 
                          width={80} 
                          height={80} 
                          className="object-cover h-full w-full" 
                        />
                      ) : (
                        <svg className="h-full w-full text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      )}
                    </span>
                    <div className="flex flex-col space-y-2">
                      <div className="flex space-x-2">
                        <Button 
                          type="button" 
                          onClick={() => avatarFileInputRef.current?.click()}
                          disabled={saving}
                          variant="outline"
                          size="sm"
                        >
                          Change Avatar
                        </Button>
                        {avatarPreview && (
                          <Button 
                            type="button" 
                            onClick={() => removeFile('avatar')}
                            disabled={saving}
                            variant="outline"
                            size="sm"
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        Recommended: Square images, max 2MB
                      </div>
                    </div>
                    <input
                      type="file"
                      ref={avatarFileInputRef}
                      onChange={handleAvatarChange}
                      accept="image/png, image/jpeg, image/gif, image/webp"
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Basic Info Section */}
                <div className={cn(
                  "p-4 rounded-lg border space-y-4",
                  isTheme98 ? "sunken-panel" : "bg-gray-50 dark:bg-gray-800"
                )}>
                  <h3 className="text-lg font-semibold">Basic Information</h3>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        value={username}
                        onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20))}
                        placeholder="Your username"
                        maxLength={20}
                        minLength={3}
                        disabled={saving}
                        className={cn(
                          usernameAvailable === true && username.length >= 3 && 'border-green-500 focus:border-green-500',
                          usernameAvailable === false && username.length >= 3 && 'border-red-500 focus:border-red-500'
                        )}
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm pointer-events-none">
                        {usernameAvailable === 'checking' && <span className="text-gray-500 animate-pulse">Checking...</span>}
                        {usernameAvailable === true && username.length >= 3 && <span className="text-green-500">✔️ Available</span>}
                        {usernameAvailable === false && username.length >= 3 && <span className="text-red-500">❌ Taken</span>}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      3-20 characters. Letters, numbers, and underscores only.
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Display Name
                    </label>
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your display name"
                      maxLength={50}
                      disabled={saving}
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      This will be shown in chats and on your profile
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Pronouns
                    </label>
                    <Input
                      value={pronouns}
                      onChange={(e) => setPronouns(e.target.value)}
                      placeholder="e.g., they/them, he/him, she/her"
                      maxLength={20}
                      disabled={saving}
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      Optional: How others should refer to you
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Status
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {STATUS_OPTIONS.map((option) => (
                        <label
                          key={option.value}
                          className={cn(
                            "flex items-center p-3 rounded-lg border cursor-pointer transition-colors",
                            status === option.value 
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                              : "border-gray-300 hover:border-gray-400",
                            saving && "pointer-events-none opacity-50"
                          )}
                        >
                          <input
                            type="radio"
                            name="status"
                            value={option.value}
                            checked={status === option.value}
                            onChange={(e) => setStatus(e.target.value as any)}
                            disabled={saving}
                            className="sr-only"
                          />
                          <Image
                            src={option.icon}
                            alt={option.label}
                            width={16}
                            height={16}
                            className="mr-2"
                          />
                          <span className="text-sm">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Bio
                    </label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell people about yourself..."
                      className={cn(
                        "w-full h-24 p-3 resize-none",
                        isTheme98 
                          ? "sunken-panel" 
                          : "border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                      )}
                      maxLength={200}
                      disabled={saving}
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {bio.length}/200 characters
                    </div>
                  </div>
                </div>

                {/* Display Name Styling Section */}
                <div className={cn(
                  "p-4 rounded-lg border space-y-4",
                  isTheme98 ? "sunken-panel" : "bg-gray-50 dark:bg-gray-800"
                )}>
                  <h3 className="text-lg font-semibold">Display Name Styling</h3>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Color
                    </label>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Input
                          type="color"
                          value={displayNameColor}
                          onChange={(e) => setDisplayNameColor(e.target.value)}
                          disabled={saving}
                          className="w-16 h-10 p-1 border rounded"
                        />
                        <Input
                          type="text"
                          value={displayNameColor}
                          onChange={(e) => setDisplayNameColor(e.target.value)}
                          placeholder="#ffffff"
                          maxLength={7}
                          disabled={saving}
                          className="flex-1"
                        />
                      </div>
                      
                      <div className="grid grid-cols-8 gap-1">
                        {PRESET_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setDisplayNameColor(color)}
                            disabled={saving}
                            className={cn(
                              "w-8 h-8 rounded border-2 transition-transform hover:scale-110",
                              displayNameColor === color ? "border-gray-800 dark:border-gray-200" : "border-gray-300"
                            )}
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Animation
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {DISPLAY_NAME_ANIMATIONS.map((animation) => (
                        <label
                          key={animation.value}
                          className={cn(
                            "flex items-center p-3 rounded-lg border cursor-pointer transition-colors",
                            displayNameAnimation === animation.value 
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                              : "border-gray-300 hover:border-gray-400",
                            saving && "pointer-events-none opacity-50"
                          )}
                        >
                          <input
                            type="radio"
                            name="displayNameAnimation"
                            value={animation.value}
                            checked={displayNameAnimation === animation.value}
                            onChange={(e) => setDisplayNameAnimation(e.target.value as any)}
                            disabled={saving}
                            className="sr-only"
                          />
                          <span className="text-sm font-medium mr-2">{animation.label}</span>
                          {animation.value !== 'none' && (
                            <span 
                              className={cn(
                                "text-sm ml-auto",
                                animation.value === 'rainbow' && "animate-pulse text-red-500",
                                animation.value === 'gradient' && "bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent",
                                animation.value === 'pulse' && "animate-pulse text-blue-500",
                                animation.value === 'glow' && "text-yellow-500 drop-shadow-lg"
                              )}
                            >
                              Preview
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Preview:</p>
                    <span 
                      className={cn(
                        "text-lg font-bold",
                        displayNameAnimation === 'rainbow' && "animate-pulse",
                        displayNameAnimation === 'gradient' && "bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent",
                        displayNameAnimation === 'pulse' && "animate-pulse",
                        displayNameAnimation === 'glow' && "drop-shadow-lg"
                      )}
                      style={{ 
                        color: displayNameAnimation === 'gradient' ? undefined : displayNameColor 
                      }}
                    >
                      {displayName || username || 'Display Name'}
                    </span>
                  </div>
                </div>

                {/* Custom CSS Section */}
                <div className={cn(
                  "p-4 rounded-lg border space-y-4",
                  isTheme98 ? "sunken-panel" : "bg-gray-50 dark:bg-gray-800"
                )}>
                  <h3 className="text-lg font-semibold">Custom CSS</h3>
                  <div>
                    <textarea
                      value={customCSS}
                      onChange={(e) => setCustomCSS(e.target.value)}
                      placeholder="/* Add your custom CSS here */&#10;.profile-card-container {&#10;  background: linear-gradient(45deg, #ff6b6b, #4ecdc4);&#10;  border-radius: 15px;&#10;}"
                      className={cn(
                        "w-full h-48 p-3 font-mono text-sm resize-none",
                        isTheme98 
                          ? "sunken-panel" 
                          : "border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                      )}
                      disabled={saving}
                    />
                    <div className="text-xs text-gray-500 mt-2">
                      <p className="mb-1">Allowed selectors:</p>
                      <code className="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">
                        .profile-card-container, .profile-banner, .profile-avatar, .profile-display-name, 
                        .profile-username, .profile-pronouns, .profile-bio, .profile-divider, .profile-status
                      </code>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button 
                      onClick={handleReset} 
                      variant="outline"
                      disabled={saving}
                      size="sm"
                    >
                      Reset CSS
                    </Button>
                  </div>
                </div>

                {/* Save Button */}
                <div className="sticky bottom-0 bg-white dark:bg-gray-800 pt-4">
                  <Button 
                    onClick={handleSave} 
                    disabled={
                      saving || 
                      usernameAvailable === 'checking' || 
                      (usernameAvailable === false && username.length >= 3) ||
                      !username ||
                      username.length < 3
                    }
                    className="w-full"
                    size="lg"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>

                  {saving && (
                    <div className="text-xs text-gray-500 text-center mt-2 animate-pulse">
                      Please wait while we save your changes...
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column - Preview */}
              <div className={cn(
                "flex flex-col",
                isTheme98 ? "" : "xl:border-l xl:pl-6"
              )}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Live Preview</h3>
                  <div className="text-xs text-gray-500">
                    Updates in real-time
                  </div>
                </div>
                <div className={cn(
                  "flex-1 p-4 overflow-auto",
                  isTheme98 
                    ? "sunken-panel" 
                    : "bg-gray-100 dark:bg-gray-900 rounded-lg"
                )}>
                  <div className="flex justify-center">
                    <EnhancedProfilePreview 
                      customCSS={customCSS}
                      bio={bio}
                      displayName={displayName}
                      username={username}
                      pronouns={pronouns}
                      status={status}
                      displayNameColor={displayNameColor}
                      displayNameAnimation={displayNameAnimation}
                      avatarPreview={avatarPreview}
                      bannerPreview={bannerPreview}
                      currentUser={currentUser}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface EnhancedProfilePreviewProps {
  customCSS: string;
  bio: string;
  displayName: string;
  username: string;
  pronouns: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  displayNameColor: string;
  displayNameAnimation: string;
  avatarPreview: string | null;
  bannerPreview: string | null;
  currentUser: any;
}

const EnhancedProfilePreview: React.FC<EnhancedProfilePreviewProps> = ({ 
  customCSS, 
  bio, 
  displayName,
  username,
  pronouns,
  status,
  displayNameColor,
  displayNameAnimation,
  avatarPreview,
  bannerPreview,
  currentUser
}) => {
  const defaultCSS = `
    .profile-card-container {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 16px;
      padding: 0;
      color: white;
      font-family: Arial, sans-serif;
      width: 320px;
      min-height: 480px;
      position: relative;
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }
    
    .profile-banner {
      width: 100%;
      height: 120px;
      background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
      position: relative;
      overflow: hidden;
    }
    
    .profile-banner img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .profile-content {
      padding: 20px;
      position: relative;
      margin-top: -40px;
    }
    
    .profile-avatar {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      border: 4px solid white;
      margin-bottom: 15px;
      object-fit: cover;
      background: #ccc;
      position: relative;
      z-index: 2;
    }
    
    .profile-status {
      position: absolute;
      bottom: 4px;
      right: 4px;
      width: 20px;
      height: 20px;
      border: 3px solid white;
      border-radius: 50%;
      z-index: 3;
    }
    
    .profile-display-name {
      font-size: 22px;
      font-weight: bold;
      margin-bottom: 8px;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      word-wrap: break-word;
    }
    
    .profile-username {
      font-size: 14px;
      opacity: 0.9;
      margin-bottom: 8px;
      font-weight: 500;
    }
    
    .profile-pronouns {
      font-size: 12px;
      opacity: 0.8;
      margin-bottom: 12px;
      font-style: italic;
    }
    
    .profile-bio {
      font-size: 13px;
      line-height: 1.5;
      opacity: 0.95;
      margin-top: 12px;
      word-wrap: break-word;
    }
    
    .profile-divider {
      height: 1px;
      background: rgba(255, 255, 255, 0.3);
      margin: 15px 0;
    }

    /* Display name animations */
    .display-name-rainbow {
      background: linear-gradient(45deg, #ff0000, #ff8000, #ffff00, #80ff00, #00ff00, #00ff80, #00ffff, #0080ff, #0000ff, #8000ff, #ff00ff, #ff0080);
      background-size: 400% 400%;
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: rainbow 3s ease-in-out infinite;
    }

    @keyframes rainbow {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }

    .display-name-gradient {
      background: linear-gradient(45deg, #667eea, #764ba2, #f093fb, #f5576c);
      background-size: 300% 300%;
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: gradientShift 4s ease-in-out infinite;
    }

    @keyframes gradientShift {
      0%, 100% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
    }

    .display-name-pulse {
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.8; transform: scale(1.05); }
    }

    .display-name-glow {
      text-shadow: 0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor;
      animation: glow 2s ease-in-out infinite alternate;
    }

    @keyframes glow {
      from { text-shadow: 0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor; }
      to { text-shadow: 0 0 20px currentColor, 0 0 30px currentColor, 0 0 40px currentColor; }
    }
  `;

  const sanitizedCSS = sanitizeCSS(customCSS);
  const finalCSS = defaultCSS + '\n' + sanitizedCSS;

  const getDisplayNameClass = () => {
    switch (displayNameAnimation) {
      case 'rainbow':
        return 'display-name-rainbow';
      case 'gradient':
        return 'display-name-gradient';
      case 'pulse':
        return 'display-name-pulse';
      case 'glow':
        return 'display-name-glow';
      default:
        return '';
    }
  };

  const getStatusIcon = () => {
    const statusOption = STATUS_OPTIONS.find(opt => opt.value === status);
    return statusOption ? statusOption.icon : '/icons/offline.png';
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: finalCSS }} />
      <div className="profile-card-container">
        <div className="profile-banner">
          {bannerPreview ? (
            <img src={bannerPreview} alt="Profile Banner" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500" />
          )}
        </div>
        
        <div className="profile-content">
          <div className="relative inline-block">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Profile Avatar" className="profile-avatar" />
            ) : (
              <div className="profile-avatar bg-gray-300 flex items-center justify-center">
                <svg className="w-10 h-10 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            )}
            <Image
              src={getStatusIcon()}
              alt={status}
              width={20}
              height={20}
              className="profile-status"
            />
          </div>
          
          <div 
            className={cn("profile-display-name", getDisplayNameClass())}
            style={{ 
              color: displayNameAnimation === 'rainbow' || displayNameAnimation === 'gradient' 
                ? undefined 
                : displayNameColor 
            }}
          >
            {displayName || 'Display Name'}
          </div>
          
          <div className="profile-username">
            @{username || currentUser?.email?.split('@')[0] || 'username'}
          </div>
          
          {pronouns && (
            <div className="profile-pronouns">
              {pronouns}
            </div>
          )}
          
          {bio && (
            <>
              <div className="profile-divider"></div>
              <div className="profile-bio">
                {bio}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};