// src/components/ProfileCustomizer.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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

const CSS_MODES = [
  { value: 'custom', label: 'Custom CSS' },
  { value: 'easy', label: 'Easy Customization' }
] as const;

interface EasyCustomization {
  backgroundColor: string;
  backgroundGradient?: {
    enabled: boolean;
    color1: string;
    color2: string;
    direction: string;
  };
  borderRadius: number;
  bannerHeight: number;
  avatarSize: number;
  textShadow: boolean;
  elements: {
    [key: string]: {
      x: number;
      y: number;
      scale: number;
      color?: string;
    };
  };
}

export const ProfileCustomizer: React.FC<ProfileCustomizerProps> = ({ 
  isOpen, 
  onClose 
}) => {
  const [customCSS, setCustomCSS] = useState('');
  const [cssMode, setCSSMode] = useState<'custom' | 'easy'>('easy');
  const [easyCustomization, setEasyCustomization] = useState<EasyCustomization>({
    backgroundColor: '#667eea',
    backgroundGradient: {
      enabled: true,
      color1: '#667eea',
      color2: '#764ba2',
      direction: '135deg'
    },
    borderRadius: 16,
    bannerHeight: 120,
    avatarSize: 80,
    textShadow: true,
    elements: {}
  });

  const [bio, setBio] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [status, setStatus] = useState<'online' | 'idle' | 'dnd' | 'offline'>('online');
  const [displayNameColor, setDisplayNameColor] = useState('#ffffff');
  const [displayNameAnimation, setDisplayNameAnimation] = useState<'none' | 'rainbow' | 'gradient' | 'pulse' | 'glow'>('none');
  const [rainbowSpeed, setRainbowSpeed] = useState(3);
  
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

  // Easy mode states
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; element: string } | null>(null);
  const [colorPicker, setColorPicker] = useState<{ element: string; type: 'color' | 'gradient' } | null>(null);

  const { toast } = useToast();
  const { currentTheme } = useTheme();
  
  const debouncedUsername = useDebounce(username, 500);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const previewRef = useRef<HTMLDivElement>(null);

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

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
      setColorPicker(null);
    };

    if (contextMenu || colorPicker) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu, colorPicker]);

  // Username availability check
  useEffect(() => {
    const checkUsername = async () => {
      if (!debouncedUsername || debouncedUsername.length < 3 || !currentUser || !mountedRef.current) {
        setUsernameAvailable(null);
        return;
      }

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
          display_name_animation,
          rainbow_speed,
          easy_customization_data
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
        setRainbowSpeed(3);
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
        setRainbowSpeed(profile.rainbow_speed || 3);
        setAvatarUrl(profile.avatar_url);
        setBannerUrl(profile.banner_url);
        
        // Load easy customization data
        if (profile.easy_customization_data) {
          try {
            const easyData = JSON.parse(profile.easy_customization_data);
            setEasyCustomization({ ...easyCustomization, ...easyData });
          } catch (e) {
            console.warn('Failed to parse easy customization data');
          }
        }
        
        if (profile.avatar_url) {
          setAvatarPreview(profile.avatar_url);
        }
        if (profile.banner_url) {
          setBannerPreview(profile.banner_url);
        }
      } else {
        // Initialize defaults
        setCustomCSS('');
        setBio('');
        setDisplayName('');
        setUsername('');
        setOriginalUsername('');
        setPronouns('');
        setStatus('online');
        setDisplayNameColor('#ffffff');
        setDisplayNameAnimation('none');
        setRainbowSpeed(3);
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
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const generateEasyCSS = useCallback(() => {
    let css = '';
    
    // Background
    if (easyCustomization.backgroundGradient?.enabled) {
      css += `.profile-card-container {
        background: linear-gradient(${easyCustomization.backgroundGradient.direction}, ${easyCustomization.backgroundGradient.color1}, ${easyCustomization.backgroundGradient.color2});
      }\n`;
    } else {
      css += `.profile-card-container {
        background: ${easyCustomization.backgroundColor};
      }\n`;
    }
    
    // Border radius
    css += `.profile-card-container {
      border-radius: ${easyCustomization.borderRadius}px;
    }\n`;
    
    // Banner height
    css += `.profile-banner {
      height: ${easyCustomization.bannerHeight}px;
    }\n`;
    
    // Avatar size
    css += `.profile-avatar {
      width: ${easyCustomization.avatarSize}px;
      height: ${easyCustomization.avatarSize}px;
    }\n`;
    
    // Text shadow
    if (easyCustomization.textShadow) {
      css += `.profile-display-name, .profile-username {
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      }\n`;
    }
    
    // Rainbow speed
    if (displayNameAnimation === 'rainbow') {
      css += `@keyframes rainbow {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      .display-name-rainbow {
        animation: rainbow ${rainbowSpeed}s ease-in-out infinite;
      }\n`;
    }
    
    // Element positions and scales
    Object.entries(easyCustomization.elements).forEach(([element, props]) => {
      css += `.${element} {
        transform: translate(${props.x}px, ${props.y}px) scale(${props.scale});
      }\n`;
      
      if (props.color) {
        css += `.${element} {
          color: ${props.color};
        }\n`;
      }
    });
    
    return css;
  }, [easyCustomization, displayNameAnimation, rainbowSpeed]);

  // Easy mode event handlers
  const handlePreviewMouseDown = (e: React.MouseEvent, element: string) => {
    if (cssMode !== 'easy') return;
    
    e.preventDefault();
    setSelectedElement(element);
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handlePreviewMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedElement || cssMode !== 'easy') return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    setEasyCustomization(prev => ({
      ...prev,
      elements: {
        ...prev.elements,
        [selectedElement]: {
          ...prev.elements[selectedElement],
          x: (prev.elements[selectedElement]?.x || 0) + deltaX,
          y: (prev.elements[selectedElement]?.y || 0) + deltaY,
        }
      }
    }));
    
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handlePreviewMouseUp = () => {
    setIsDragging(false);
    setSelectedElement(null);
  };

  const handlePreviewContextMenu = (e: React.MouseEvent, element: string) => {
    if (cssMode !== 'easy') return;
    
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      element
    });
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>, 
    type: 'avatar' | 'banner',
    setFile: React.Dispatch<React.SetStateAction<File | null>>,
    setPreview: React.Dispatch<React.SetStateAction<string | null>>,
    maxSize: number = 2
  ) => {
    if (!e.target.files || !e.target.files[0] || !mountedRef.current) return;

    const file = e.target.files[0];
    
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
    if (saving || !mountedRef.current) return;

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

    setSaving(true);
    
    try {
      let finalAvatarUrl = avatarUrl;
      let finalBannerUrl = bannerUrl;

      if (avatarFile) {
        finalAvatarUrl = await uploadFile(avatarFile, 'avatars', currentUser.id);
      }

      if (bannerFile) {
        finalBannerUrl = await uploadFile(bannerFile, 'banners', currentUser.id);
      }

      const finalCSS = cssMode === 'easy' ? generateEasyCSS() : customCSS;
      const sanitizedCSS = sanitizeCSS(finalCSS);

      const profileData = {
        profile_card_css: sanitizedCSS,
        bio: bio.trim(),
        display_name: displayName.trim() || null,
        username: username.trim(),
        pronouns: pronouns.trim() || null,
        status: status,
        display_name_color: displayNameColor,
        display_name_animation: displayNameAnimation,
        rainbow_speed: rainbowSpeed,
        avatar_url: finalAvatarUrl,
        banner_url: finalBannerUrl,
        easy_customization_data: JSON.stringify(easyCustomization),
        last_seen: new Date().toISOString()
      };

      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', currentUser.id);

      if (existingProfile && existingProfile.length > 0) {
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update(profileData)
          .eq('id', currentUser.id);

        if (updateError) {
          throw new Error(`Failed to update profile: ${updateError.message}`);
        }
      } else {
        const insertData = {
          id: currentUser.id,
          ...profileData,
          profile_complete: true
        };

        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert(insertData);

        if (insertError) {
          throw new Error(`Failed to create profile: ${insertError.message}`);
        }
      }

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
    if (cssMode === 'custom') {
      setCustomCSS(getDefaultProfileCSS());
    } else {
      setEasyCustomization({
        backgroundColor: '#667eea',
        backgroundGradient: {
          enabled: true,
          color1: '#667eea',
          color2: '#764ba2',
          direction: '135deg'
        },
        borderRadius: 16,
        bannerHeight: 120,
        avatarSize: 80,
        textShadow: true,
        elements: {}
      });
    }
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
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-2 overflow-hidden">
      <div className={cn(
        'window flex flex-col relative',
        'w-full h-full max-w-none max-h-none',
        isMobile ? 'mx-0 my-0' : 'max-w-7xl max-h-[95vh] mx-4',
        isTheme98 ? '' : 'bg-white dark:bg-gray-800 rounded-lg'
      )}>
        
        <div className={cn("title-bar", isTheme98 ? '' : 'border-b p-4')}>
          <div className="flex items-center justify-between">
            <div className="title-bar-text">Enhanced Profile Customizer</div>
            <Button 
              onClick={onClose} 
              className={cn(isTheme98 ? '' : 'ml-auto')}
              variant={isTheme98 ? undefined : "outline"}
              disabled={saving}
              size={isMobile ? "sm" : "default"}
            >
              {saving ? 'Saving...' : (isMobile ? '✕' : 'Close')}
            </Button>
          </div>
        </div>

        <div className={cn(
          'window-body window-body-content flex-grow overflow-hidden',
          isTheme98 ? 'p-2' : 'p-4',
          isMobile && 'p-2'
        )}>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-black dark:text-white animate-pulse">Loading profile data...</p>
            </div>
          ) : (
            <div className={cn(
              "grid gap-4 h-full",
              isMobile ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-2"
            )}>
              {/* Left Column - Form Controls */}
              <div className={cn(
                "space-y-4 overflow-y-auto pr-2",
                isMobile && "max-h-[50vh]"
              )}>
                {/* CSS Mode Selection */}
                <div className={cn(
                  "p-3 rounded-lg border",
                  isTheme98 ? "sunken-panel" : "bg-gray-50 dark:bg-gray-800"
                )}>
                  <h3 className="text-lg font-semibold mb-3">Customization Mode</h3>
                  <select
                    value={cssMode}
                    onChange={(e) => setCSSMode(e.target.value as 'custom' | 'easy')}
                    disabled={saving}
                    className={cn(
                      "w-full p-2 border rounded",
                      isTheme98 ? "sunken-panel" : "bg-white dark:bg-gray-700"
                    )}
                  >
                    {CSS_MODES.map((mode) => (
                      <option key={mode.value} value={mode.value}>
                        {mode.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Basic Info Section */}
                <div className={cn(
                  "p-4 rounded-lg border space-y-4",
                  isTheme98 ? "sunken-panel" : "bg-gray-50 dark:bg-gray-800"
                )}>
                  <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
                  
                  {/* Username and Display Name Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            "text-sm pr-8",
                            usernameAvailable === true && username.length >= 3 && 'border-green-500 focus:border-green-500',
                            usernameAvailable === false && username.length >= 3 && 'border-red-500 focus:border-red-500'
                          )}
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm pointer-events-none">
                          {usernameAvailable === 'checking' && <span className="text-gray-500 animate-spin">⏳</span>}
                          {usernameAvailable === true && username.length >= 3 && <span className="text-green-500">✔️</span>}
                          {usernameAvailable === false && username.length >= 3 && <span className="text-red-500">❌</span>}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        3-20 characters, letters/numbers/underscore only
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Display Name</label>
                      <Input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your display name"
                        maxLength={50}
                        disabled={saving}
                        className="text-sm"
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        Shown in chats and on your profile
                      </div>
                    </div>
                  </div>

                  {/* Pronouns Row */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Pronouns</label>
                    <Input
                      value={pronouns}
                      onChange={(e) => setPronouns(e.target.value)}
                      placeholder="e.g., they/them, he/him, she/her"
                      maxLength={20}
                      disabled={saving}
                      className="text-sm max-w-xs"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      Optional: How others should refer to you
                    </div>
                  </div>

                  {/* Status Dropdown */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Status</label>
                    <div className="relative max-w-xs">
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                        disabled={saving}
                        className={cn(
                          "w-full p-2 pr-8 border rounded-md text-sm appearance-none bg-white dark:bg-gray-700",
                          isTheme98 ? "sunken-panel" : "border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        )}
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex items-center mt-2 text-xs text-gray-500">
                      <Image
                        src={STATUS_OPTIONS.find(opt => opt.value === status)?.icon || '/icons/offline.png'}
                        alt={status}
                        width={12}
                        height={12}
                        className="mr-1"
                      />
                      Currently: {STATUS_OPTIONS.find(opt => opt.value === status)?.label}
                    </div>
                  </div>

                  {/* Bio Section */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Bio</label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell people about yourself..."
                      className={cn(
                        "w-full h-24 p-3 resize-none text-sm transition-colors",
                        isTheme98 
                          ? "sunken-panel" 
                          : "border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      )}
                      maxLength={200}
                      disabled={saving}
                    />
                    <div className="flex justify-between items-center mt-1">
                      <div className="text-xs text-gray-500">
                        Share your interests, hobbies, or anything about yourself
                      </div>
                      <div className={cn(
                        "text-xs font-mono",
                        bio.length > 180 ? "text-orange-500" : "text-gray-500"
                      )}>
                        {bio.length}/200
                      </div>
                    </div>
                  </div>
                </div>

                {/* Display Name Styling Section */}
                <div className={cn(
                  "p-4 rounded-lg border space-y-4",
                  isTheme98 ? "sunken-panel" : "bg-gray-50 dark:bg-gray-800"
                )}>
                  <h3 className="text-lg font-semibold mb-4">Display Name Styling</h3>
                  
                  {/* Color Section */}
                  <div>
                    <label className="block text-sm font-medium mb-3">Color</label>
                    <div className="space-y-3">
                      {/* Color Picker Row */}
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <Input
                            type="color"
                            value={displayNameColor}
                            onChange={(e) => setDisplayNameColor(e.target.value)}
                            disabled={saving}
                            className="w-12 h-10 p-1 border rounded cursor-pointer"
                            title="Pick a color"
                          />
                        </div>
                        <Input
                          type="text"
                          value={displayNameColor}
                          onChange={(e) => setDisplayNameColor(e.target.value)}
                          placeholder="#ffffff"
                          maxLength={7}
                          disabled={saving}
                          className="flex-1 text-sm font-mono"
                        />
                      </div>
                      
                      {/* Preset Colors Grid */}
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Quick colors:</p>
                        <div className="grid grid-cols-8 gap-2">
                          {PRESET_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setDisplayNameColor(color)}
                              disabled={saving}
                              className={cn(
                                "w-8 h-8 rounded border-2 transition-all duration-200 hover:scale-110 focus:scale-110 focus:outline-none",
                                displayNameColor === color 
                                  ? "border-gray-800 dark:border-gray-200 shadow-lg" 
                                  : "border-gray-300 hover:border-gray-500"
                              )}
                              style={{ backgroundColor: color }}
                              title={color}
                              aria-label={`Select color ${color}`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Animation Section */}
                  <div>
                    <label className="block text-sm font-medium mb-3">Animation Effect</label>
                    <div className="relative">
                      <select
                        value={displayNameAnimation}
                        onChange={(e) => setDisplayNameAnimation(e.target.value as any)}
                        disabled={saving}
                        className={cn(
                          "w-full p-3 pr-10 border rounded-md text-sm appearance-none bg-white dark:bg-gray-700 transition-colors",
                          isTheme98 ? "sunken-panel" : "border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        )}
                      >
                        {DISPLAY_NAME_ANIMATIONS.map((animation) => (
                          <option key={animation.value} value={animation.value}>
                            {animation.label}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Conditional Controls */}
                    {displayNameAnimation === 'rainbow' && (
                      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <label className="block text-sm font-medium mb-2 text-blue-700 dark:text-blue-300">
                          Rainbow Speed
                        </label>
                        <div className="field-row flex items-center space-x-3">
                          <label className="text-xs text-blue-600 dark:text-blue-400 font-medium">Slow</label>
                          <input
                            type="range"
                            min="1"
                            max="10"
                            value={rainbowSpeed}
                            onChange={(e) => setRainbowSpeed(parseInt(e.target.value))}
                            disabled={saving}
                            className="flex-1 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer slider"
                            style={{
                              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(rainbowSpeed - 1) * 11.11}%, #e5e7eb ${(rainbowSpeed - 1) * 11.11}%, #e5e7eb 100%)`
                            }}
                          />
                          <label className="text-xs text-blue-600 dark:text-blue-400 font-medium">Fast</label>
                          <span className="text-xs font-mono bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded text-blue-700 dark:text-blue-300">
                            {rainbowSpeed}s
                          </span>
                        </div>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                          Controls how fast the rainbow colors cycle through your name
                        </p>
                      </div>
                    )}

                    {displayNameAnimation === 'gradient' && (
                      <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                        <label className="block text-sm font-medium mb-2 text-purple-700 dark:text-purple-300">
                          Gradient Colors
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs mb-1 text-purple-600 dark:text-purple-400">Start Color</label>
                            <Input
                              type="color"
                              value="#667eea"
                              className="w-full h-10"
                              disabled={saving}
                            />
                          </div>
                          <div>
                            <label className="block text-xs mb-1 text-purple-600 dark:text-purple-400">End Color</label>
                            <Input
                              type="color"
                              value="#764ba2"
                              className="w-full h-10"
                              disabled={saving}
                            />
                          </div>
                        </div>
                        <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                          Creates a smooth color transition effect across your name
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Live Preview */}
                  <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Live Preview:</p>
                      <div className="text-xs text-gray-500">
                        {displayNameAnimation !== 'none' ? `${displayNameAnimation} effect` : 'No animation'}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-3 rounded border">
                      <span 
                        className={cn(
                          "text-lg font-bold transition-all duration-300",
                          displayNameAnimation === 'rainbow' && "bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 bg-[length:400%] animate-pulse bg-clip-text text-transparent",
                          displayNameAnimation === 'gradient' && "bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent",
                          displayNameAnimation === 'pulse' && "animate-pulse",
                          displayNameAnimation === 'glow' && "drop-shadow-lg"
                        )}
                        style={{ 
                          color: displayNameAnimation === 'gradient' || displayNameAnimation === 'rainbow' 
                            ? undefined 
                            : displayNameColor,
                          animationDuration: displayNameAnimation === 'rainbow' ? `${rainbowSpeed}s` : undefined,
                          textShadow: displayNameAnimation === 'glow' 
                            ? `0 0 10px ${displayNameColor}, 0 0 20px ${displayNameColor}, 0 0 30px ${displayNameColor}` 
                            : undefined
                        }}
                      >
                        {displayName || username || 'Display Name'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Avatar & Banner Section */}
                <div className={cn(
                  "p-4 rounded-lg border space-y-4",
                  isTheme98 ? "sunken-panel" : "bg-gray-50 dark:bg-gray-800"
                )}>
                  <h3 className="text-lg font-semibold mb-4">Profile Images</h3>
                  
                  {/* Avatar Section */}
                  <div>
                    <label className="block text-sm font-medium mb-3">Profile Picture</label>
                    <div className="flex items-start space-x-4">
                      {/* Avatar Preview */}
                      <div className="relative group">
                        <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200 dark:border-gray-600 flex-shrink-0">
                          {avatarPreview ? (
                            <Image 
                              src={avatarPreview} 
                              alt="Avatar preview" 
                              width={80} 
                              height={80} 
                              className="object-cover w-full h-full transition-transform group-hover:scale-105" 
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        {avatarPreview && (
                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 border-2 border-white rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                      
                      {/* Controls */}
                      <div className="flex-1 space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <Button 
                            type="button" 
                            onClick={() => avatarFileInputRef.current?.click()}
                            disabled={saving}
                            variant="outline"
                            size="sm"
                            className="text-sm"
                          >
                            {avatarPreview ? 'Change Avatar' : 'Upload Avatar'}
                          </Button>
                          {avatarPreview && (
                            <Button 
                              type="button" 
                              onClick={() => removeFile('avatar')}
                              disabled={saving}
                              variant="outline"
                              size="sm"
                              className="text-sm text-red-600 hover:text-red-700"
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 space-y-1">
                          <p>• Square images work best (1:1 ratio)</p>
                          <p>• Maximum file size: 2MB</p>
                          <p>• Supported: JPG, PNG, GIF, WebP</p>
                        </div>
                      </div>
                    </div>
                    <input
                      type="file"
                      ref={avatarFileInputRef}
                      onChange={handleAvatarChange}
                      accept="image/png,image/jpeg,image/gif,image/webp"
                      className="hidden"
                    />
                  </div>

                  {/* Banner Section */}
                  <div>
                    <label className="block text-sm font-medium mb-3">Cover Banner</label>
                    <div className="space-y-3">
                      {/* Banner Preview */}
                      <div className="relative group">
                        <div className="aspect-[3/1] w-full max-w-md mx-auto overflow-hidden rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-gray-100">
                          {bannerPreview ? (
                            <Image 
                              src={bannerPreview} 
                              alt="Banner preview" 
                              fill
                              className="object-cover transition-transform group-hover:scale-105" 
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">
                              <div className="text-center">
                                <svg className="w-16 h-16 mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                                </svg>
                                <p className="text-sm">No banner uploaded</p>
                              </div>
                            </div>
                          )}
                        </div>
                        {bannerPreview && (
                          <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 border-2 border-white rounded-full flex items-center justify-center shadow-sm">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                      
                      {/* Controls */}
                      <div className="flex justify-center space-x-2">
                        <Button 
                          type="button" 
                          onClick={() => bannerFileInputRef.current?.click()}
                          disabled={saving}
                          variant="outline"
                          size="sm"
                          className="text-sm"
                        >
                          {bannerPreview ? 'Change Banner' : 'Upload Banner'}
                        </Button>
                        {bannerPreview && (
                          <Button 
                            type="button" 
                            onClick={() => removeFile('banner')}
                            disabled={saving}
                            variant="outline"
                            size="sm"
                            className="text-sm text-red-600 hover:text-red-700"
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                      
                      {/* Guidelines */}
                      <div className="text-xs text-gray-500 text-center space-y-1">
                        <p>• Recommended ratio: 3:1 (e.g., 900×300px)</p>
                        <p>• Maximum file size: 5MB</p>
                        <p>• Supported: JPG, PNG, GIF, WebP</p>
                      </div>
                    </div>
                    <input
                      type="file"
                      ref={bannerFileInputRef}
                      onChange={handleBannerChange}
                      accept="image/png,image/jpeg,image/gif,image/webp"
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Customization Section */}
                {cssMode === 'easy' ? (
                  <div className={cn(
                    "p-4 rounded-lg border space-y-6",
                    isTheme98 ? "sunken-panel" : "bg-gray-50 dark:bg-gray-800"
                  )}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Easy Customization</h3>
                      <div className="flex items-center space-x-2">
                        <Button
                          onClick={() => setEasyCustomization({
                            backgroundColor: '#667eea',
                            backgroundGradient: { enabled: true, color1: '#667eea', color2: '#764ba2', direction: '135deg' },
                            borderRadius: 16, bannerHeight: 120, avatarSize: 80, textShadow: true, elements: {}
                          })}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                        >
                          Reset All
                        </Button>
                      </div>
                    </div>
                    
                    {/* Background Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Background Style</label>
                        <div className="flex items-center space-x-2 text-xs">
                          <span className="text-gray-500">Preview updates live</span>
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Background Type Selector */}
                        <div className="md:col-span-3">
                          <div className="flex space-x-2">
                            {[
                              { key: 'solid', label: 'Solid Color', icon: '🎨' },
                              { key: 'gradient', label: 'Gradient', icon: '🌈' },
                              { key: 'pattern', label: 'Pattern', icon: '🔲' }
                            ].map((type) => (
                              <button
                                key={type.key}
                                onClick={() => setEasyCustomization(prev => ({
                                  ...prev,
                                  backgroundType: type.key as any,
                                  backgroundGradient: { 
                                    ...prev.backgroundGradient!, 
                                    enabled: type.key === 'gradient' 
                                  }
                                }))}
                                className={cn(
                                  "flex-1 p-3 rounded-lg border text-sm font-medium transition-all",
                                  (type.key === 'gradient' && easyCustomization.backgroundGradient?.enabled) ||
                                  (type.key === 'solid' && !easyCustomization.backgroundGradient?.enabled)
                                    ? "bg-blue-100 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                    : "bg-white border-gray-300 hover:border-gray-400 dark:bg-gray-700 dark:border-gray-600"
                                )}
                              >
                                <span className="mr-2">{type.icon}</span>
                                {type.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Background Controls */}
                        {easyCustomization.backgroundGradient?.enabled ? (
                          <>
                            <div className="space-y-2">
                              <label className="block text-xs font-medium text-blue-700 dark:text-blue-300">Start Color</label>
                              <div className="relative">
                                <Input
                                  type="color"
                                  value={easyCustomization.backgroundGradient.color1}
                                  onChange={(e) => setEasyCustomization(prev => ({
                                    ...prev,
                                    backgroundGradient: { ...prev.backgroundGradient!, color1: e.target.value }
                                  }))}
                                  disabled={saving}
                                  className="w-full h-12 cursor-pointer border-2 border-blue-300"
                                />
                                <div className="absolute inset-0 rounded-md border-2 border-blue-300 pointer-events-none"></div>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="block text-xs font-medium text-blue-700 dark:text-blue-300">End Color</label>
                              <div className="relative">
                                <Input
                                  type="color"
                                  value={easyCustomization.backgroundGradient.color2}
                                  onChange={(e) => setEasyCustomization(prev => ({
                                    ...prev,
                                    backgroundGradient: { ...prev.backgroundGradient!, color2: e.target.value }
                                  }))}
                                  disabled={saving}
                                  className="w-full h-12 cursor-pointer border-2 border-blue-300"
                                />
                                <div className="absolute inset-0 rounded-md border-2 border-blue-300 pointer-events-none"></div>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="block text-xs font-medium text-blue-700 dark:text-blue-300">Direction</label>
                              <select
                                value={easyCustomization.backgroundGradient.direction}
                                onChange={(e) => setEasyCustomization(prev => ({
                                  ...prev,
                                  backgroundGradient: { ...prev.backgroundGradient!, direction: e.target.value }
                                }))}
                                className="w-full p-2 border rounded-md text-sm bg-white dark:bg-gray-700"
                              >
                                <option value="135deg">↘️ Diagonal</option>
                                <option value="90deg">⬇️ Vertical</option>
                                <option value="0deg">➡️ Horizontal</option>
                                <option value="45deg">↗️ Diagonal Up</option>
                                <option value="radial">🎯 Radial</option>
                              </select>
                            </div>
                          </>
                        ) : (
                          <div className="md:col-span-3 space-y-3">
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Solid Background Color</label>
                            <div className="flex items-center space-x-4">
                              <Input
                                type="color"
                                value={easyCustomization.backgroundColor}
                                onChange={(e) => setEasyCustomization(prev => ({ ...prev, backgroundColor: e.target.value }))}
                                disabled={saving}
                                className="w-20 h-12 cursor-pointer"
                              />
                              <div className="flex-1 grid grid-cols-8 gap-2">
                                {['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe', '#43e97b', '#38f9d7', '#ffecd2', '#fcb69f', '#a8edea', '#fed6e3', '#ff9a9e', '#fecfef', '#ffeef6', '#d299c2'].map((color) => (
                                  <button
                                    key={color}
                                    onClick={() => setEasyCustomization(prev => ({ ...prev, backgroundColor: color }))}
                                    className="w-8 h-8 rounded-md border-2 border-gray-300 hover:scale-110 transition-transform"
                                    style={{ backgroundColor: color }}
                                    title={color}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Shape & Style */}
                    <div className="space-y-4">
                      <label className="text-sm font-medium flex items-center">
                        <span className="mr-2">🔳</span>
                        Card Shape & Style
                      </label>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Corner Roundness */}
                        <div className="space-y-3">
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Corner Roundness</label>
                          <div className="space-y-2">
                            <div className="flex items-center space-x-3">
                              <span className="text-xs text-gray-500 w-12">Square</span>
                              <input
                                type="range"
                                min="0"
                                max="50"
                                value={easyCustomization.borderRadius}
                                onChange={(e) => setEasyCustomization(prev => ({ ...prev, borderRadius: parseInt(e.target.value) }))}
                                disabled={saving}
                                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                                style={{
                                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${easyCustomization.borderRadius * 2}%, #e5e7eb ${easyCustomization.borderRadius * 2}%, #e5e7eb 100%)`
                                }}
                              />
                              <span className="text-xs text-gray-500 w-12">Round</span>
                            </div>
                            <div className="flex justify-center">
                              <span className="text-xs font-mono bg-blue-100 dark:bg-blue-900 px-3 py-1 rounded-full text-blue-700 dark:text-blue-300">
                                {easyCustomization.borderRadius}px
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Shadow & Effects */}
                        <div className="space-y-3">
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Shadow & Effects</label>
                          <div className="space-y-2">
                            {[
                              { key: 'shadow', label: 'Drop Shadow', desc: 'Adds depth to the card' },
                              { key: 'glow', label: 'Outer Glow', desc: 'Soft light around card' },
                              { key: 'border', label: 'Border', desc: 'Outline around card' }
                            ].map((effect) => (
                              <label key={effect.key} className="flex items-start space-x-3 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={easyCustomization[effect.key as keyof typeof easyCustomization] as boolean}
                                  onChange={(e) => setEasyCustomization(prev => ({ ...prev, [effect.key]: e.target.checked }))}
                                  className="mt-0.5 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <div>
                                  <div className="text-sm font-medium">{effect.label}</div>
                                  <div className="text-xs text-gray-500">{effect.desc}</div>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Layout & Spacing */}
                    <div className="space-y-4">
                      <label className="text-sm font-medium flex items-center">
                        <span className="mr-2">📐</span>
                        Layout & Spacing
                      </label>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Banner Height */}
                        <div className="space-y-3">
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Banner Height</label>
                          <div className="space-y-2">
                            <div className="flex items-center space-x-3">
                              <span className="text-xs text-gray-500 w-12">80px</span>
                              <input
                                type="range"
                                min="80"
                                max="200"
                                value={easyCustomization.bannerHeight}
                                onChange={(e) => setEasyCustomization(prev => ({ ...prev, bannerHeight: parseInt(e.target.value) }))}
                                disabled={saving}
                                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                              />
                              <span className="text-xs text-gray-500 w-12">200px</span>
                            </div>
                            <div className="flex justify-center">
                              <span className="text-xs font-mono bg-green-100 dark:bg-green-900 px-3 py-1 rounded-full text-green-700 dark:text-green-300">
                                {easyCustomization.bannerHeight}px
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Avatar Size */}
                        <div className="space-y-3">
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Avatar Size</label>
                          <div className="space-y-2">
                            <div className="flex items-center space-x-3">
                              <span className="text-xs text-gray-500 w-12">60px</span>
                              <input
                                type="range"
                                min="60"
                                max="120"
                                value={easyCustomization.avatarSize}
                                onChange={(e) => setEasyCustomization(prev => ({ ...prev, avatarSize: parseInt(e.target.value) }))}
                                disabled={saving}
                                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                              />
                              <span className="text-xs text-gray-500 w-12">120px</span>
                            </div>
                            <div className="flex justify-center">
                              <span className="text-xs font-mono bg-purple-100 dark:bg-purple-900 px-3 py-1 rounded-full text-purple-700 dark:text-purple-300">
                                {easyCustomization.avatarSize}px
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Content Padding */}
                        <div className="space-y-3">
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Content Padding</label>
                          <div className="space-y-2">
                            <div className="flex items-center space-x-3">
                              <span className="text-xs text-gray-500 w-12">Tight</span>
                              <input
                                type="range"
                                min="10"
                                max="40"
                                value={easyCustomization.contentPadding || 20}
                                onChange={(e) => setEasyCustomization(prev => ({ ...prev, contentPadding: parseInt(e.target.value) }))}
                                disabled={saving}
                                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                              />
                              <span className="text-xs text-gray-500 w-12">Loose</span>
                            </div>
                            <div className="flex justify-center">
                              <span className="text-xs font-mono bg-orange-100 dark:bg-orange-900 px-3 py-1 rounded-full text-orange-700 dark:text-orange-300">
                                {easyCustomization.contentPadding || 20}px
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Typography & Text Effects */}
                    <div className="space-y-4">
                      <label className="text-sm font-medium flex items-center">
                        <span className="mr-2">✏️</span>
                        Typography & Text Effects
                      </label>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Text Effects */}
                        <div className="space-y-3">
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Text Effects</label>
                          <div className="space-y-2">
                            {[
                              { key: 'textShadow', label: 'Text Shadow', desc: 'Adds depth to text', icon: '🌫️' },
                              { key: 'textGlow', label: 'Text Glow', desc: 'Soft light around text', icon: '✨' },
                              { key: 'textBold', label: 'Bold Text', desc: 'Makes text thicker', icon: '🔤' }
                            ].map((effect) => (
                              <label key={effect.key} className="flex items-center space-x-3 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                                <span className="text-sm">{effect.icon}</span>
                                <input
                                  type="checkbox"
                                  checked={easyCustomization[effect.key as keyof typeof easyCustomization] as boolean}
                                  onChange={(e) => setEasyCustomization(prev => ({ ...prev, [effect.key]: e.target.checked }))}
                                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <div className="flex-1">
                                  <div className="text-sm font-medium">{effect.label}</div>
                                  <div className="text-xs text-gray-500">{effect.desc}</div>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* Font Settings */}
                        <div className="space-y-3">
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Font Settings</label>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs mb-1">Font Family</label>
                              <select
                                value={easyCustomization.fontFamily || 'default'}
                                onChange={(e) => setEasyCustomization(prev => ({ ...prev, fontFamily: e.target.value }))}
                                className="w-full p-2 border rounded-md text-sm bg-white dark:bg-gray-700"
                              >
                                <option value="default">Default (System)</option>
                                <option value="serif">Serif (Times)</option>
                                <option value="monospace">Monospace (Code)</option>
                                <option value="cursive">Cursive (Handwriting)</option>
                                <option value="fantasy">Fantasy (Decorative)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs mb-1">Text Size</label>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs w-8">Small</span>
                                <input
                                  type="range"
                                  min="12"
                                  max="24"
                                  value={easyCustomization.fontSize || 16}
                                  onChange={(e) => setEasyCustomization(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                />
                                <span className="text-xs w-8">Large</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Help Section */}
                    <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                            🎨 Easy Mode Pro Tips
                          </h4>
                          <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                            <li>• <strong>Drag & Drop:</strong> Click and drag elements in the preview to reposition them</li>
                            <li>• <strong>Right-Click:</strong> Right-click any element for quick color and style options</li>
                            <li>• <strong>Live Preview:</strong> All changes update instantly in the preview panel</li>
                            <li>• <strong>Responsive:</strong> Your design will look great on all devices</li>
                            <li>• <strong>CSS Generated:</strong> All your changes are converted to CSS automatically</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={cn(
                    "p-4 rounded-lg border space-y-4",
                    isTheme98 ? "sunken-panel" : "bg-gray-50 dark:bg-gray-800"
                  )}>
                    <h3 className="text-lg font-semibold mb-4">Custom CSS</h3>
                    <div className="space-y-3">
                      <textarea
                        value={customCSS}
                        onChange={(e) => setCustomCSS(e.target.value)}
                        placeholder="/* Add your custom CSS here */&#10;.profile-card-container {&#10;  background: linear-gradient(45deg, #ff6b6b, #4ecdc4);&#10;  border-radius: 15px;&#10;  box-shadow: 0 20px 40px rgba(0,0,0,0.3);&#10;}&#10;&#10;.profile-display-name {&#10;  font-size: 24px;&#10;  color: #ffffff;&#10;}"
                        className={cn(
                          "w-full h-40 p-3 font-mono text-sm resize-none transition-colors",
                          isTheme98 
                            ? "sunken-panel" 
                            : "border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        )}
                        disabled={saving}
                      />
                      <div className="text-xs text-gray-500 space-y-1">
                        <p className="font-medium mb-2">Allowed CSS selectors:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                          <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">.profile-card-container</code>
                          <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">.profile-banner</code>
                          <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">.profile-avatar</code>
                          <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">.profile-display-name</code>
                          <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">.profile-username</code>
                          <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">.profile-bio</code>
                        </div>
                      </div>
                    </div>

                    {/* CSS Help */}
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="flex items-start space-x-2">
                        <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <div className="text-xs text-green-700 dark:text-green-300">
                          <p className="font-medium mb-1">CSS Tips:</p>
                          <p>• Use CSS variables for consistent theming</p>
                          <p>• Add transitions for smooth animations</p>
                          <p>• Test responsiveness with different screen sizes</p>
                          <p>• Malicious code is automatically filtered out</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col space-y-3">
                  <div className="flex space-x-3">
                    <Button 
                      onClick={handleReset} 
                      variant="outline"
                      disabled={saving}
                      size="sm"
                      className="flex-1 text-sm"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Reset {cssMode === 'easy' ? 'Settings' : 'CSS'}
                    </Button>
                  </div>

                  {/* Save Button */}
                  <Button 
                    onClick={handleSave} 
                    disabled={
                      saving || 
                      usernameAvailable === 'checking' || 
                      (usernameAvailable === false && username.length >= 3) ||
                      !username ||
                      username.length < 3
                    }
                    className="w-full relative"
                    size="lg"
                  >
                    {saving ? (
                      <div className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving Changes...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Save Profile Changes
                      </div>
                    )}
                  </Button>

                  {/* Validation Messages */}
                  {!username || username.length < 3 ? (
                    <div className="text-xs text-red-600 dark:text-red-400 text-center">
                      Username must be at least 3 characters long
                    </div>
                  ) : usernameAvailable === false ? (
                    <div className="text-xs text-red-600 dark:text-red-400 text-center">
                      Username is already taken, please choose another
                    </div>
                  ) : usernameAvailable === 'checking' ? (
                    <div className="text-xs text-blue-600 dark:text-blue-400 text-center">
                      Checking username availability...
                    </div>
                  ) : saving ? (
                    <div className="text-xs text-gray-500 text-center animate-pulse">
                      Please wait while we save your changes. This may take a few moments...
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Right Column - Preview */}
              <div className={cn(
                "flex flex-col",
                isMobile && "mt-4",
                !isMobile && "xl:border-l xl:pl-4"
              )}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold">Live Preview</h3>
                  <div className="text-xs text-gray-500">
                    {cssMode === 'easy' ? 'Click & drag to move elements' : 'Updates in real-time'}
                  </div>
                </div>
                <div className={cn(
                  "flex-1 p-3 overflow-auto",
                  isTheme98 
                    ? "sunken-panel" 
                    : "bg-gray-100 dark:bg-gray-900 rounded-lg"
                )}>
                  <div className="flex justify-center">
                    <EnhancedProfilePreview 
                      customCSS={cssMode === 'easy' ? generateEasyCSS() : customCSS}
                      bio={bio}
                      displayName={displayName}
                      username={username}
                      pronouns={pronouns}
                      status={status}
                      displayNameColor={displayNameColor}
                      displayNameAnimation={displayNameAnimation}
                      rainbowSpeed={rainbowSpeed}
                      avatarPreview={avatarPreview}
                      bannerPreview={bannerPreview}
                      currentUser={currentUser}
                      cssMode={cssMode}
                      onElementMouseDown={handlePreviewMouseDown}
                      onElementContextMenu={handlePreviewContextMenu}
                      onMouseMove={handlePreviewMouseMove}
                      onMouseUp={handlePreviewMouseUp}
                    />
                  </div>
                  
                  {/* Example chat message */}
                  <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg border max-w-sm mx-auto">
                    <div className="text-xs text-gray-500 mb-2">Chat Preview:</div>
                    <div className="flex items-start gap-2">
                      <span 
                        className={cn(
                          "font-bold text-sm",
                          displayNameAnimation === 'rainbow' && "animate-pulse",
                          displayNameAnimation === 'gradient' && "bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent",
                          displayNameAnimation === 'pulse' && "animate-pulse",
                          displayNameAnimation === 'glow' && "drop-shadow-lg"
                        )}
                        style={{ 
                          color: displayNameAnimation === 'gradient' || displayNameAnimation === 'rainbow' ? undefined : displayNameColor,
                          animationDuration: displayNameAnimation === 'rainbow' ? `${rainbowSpeed}s` : undefined
                        }}
                      >
                        {displayName || username || 'Display Name'}:
                      </span>
                      <span className="text-sm">Hello!</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Context Menu */}
        {contextMenu && cssMode === 'easy' && (
          <div
            className="fixed bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg z-[10000] py-1"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="block w-full text-left px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
              onClick={() => {
                setColorPicker({ element: contextMenu.element, type: 'color' });
                setContextMenu(null);
              }}
            >
              Change Color
            </button>
            <button
              className="block w-full text-left px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
              onClick={() => {
                setColorPicker({ element: contextMenu.element, type: 'gradient' });
                setContextMenu(null);
              }}
            >
              Add Gradient
            </button>
            <button
              className="block w-full text-left px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
              onClick={() => {
                // Reset element position
                setEasyCustomization(prev => ({
                  ...prev,
                  elements: {
                    ...prev.elements,
                    [contextMenu.element]: {
                      x: 0,
                      y: 0,
                      scale: 1
                    }
                  }
                }));
                setContextMenu(null);
              }}
            >
              Reset Position
            </button>
          </div>
        )}

        {/* Color Picker Modal */}
        {colorPicker && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10001]">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
              <h4 className="text-lg font-semibold mb-3">
                {colorPicker.type === 'gradient' ? 'Gradient Colors' : 'Element Color'}
              </h4>
              
              {colorPicker.type === 'gradient' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm mb-1">Color 1</label>
                    <Input type="color" className="w-full h-8" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Color 2</label>
                    <Input type="color" className="w-full h-8" />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm mb-1">Color</label>
                  <Input type="color" className="w-full h-8" />
                </div>
              )}
              
              <div className="flex space-x-2 mt-4">
                <Button
                  onClick={() => setColorPicker(null)}
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => setColorPicker(null)}
                  size="sm"
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
        )}
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
  rainbowSpeed: number;
  avatarPreview: string | null;
  bannerPreview: string | null;
  currentUser: any;
  cssMode: 'custom' | 'easy';
  onElementMouseDown?: (e: React.MouseEvent, element: string) => void;
  onElementContextMenu?: (e: React.MouseEvent, element: string) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseUp?: () => void;
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
  rainbowSpeed,
  avatarPreview,
  bannerPreview,
  currentUser,
  cssMode,
  onElementMouseDown,
  onElementContextMenu,
  onMouseMove,
  onMouseUp
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
      user-select: none;
    }
    
    .profile-banner {
      width: 100%;
      height: 120px;
      background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
      position: relative;
      overflow: hidden;
      cursor: ${cssMode === 'easy' ? 'move' : 'default'};
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
      cursor: ${cssMode === 'easy' ? 'move' : 'default'};
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
      cursor: ${cssMode === 'easy' ? 'move' : 'default'};
    }
    
    .profile-username {
      font-size: 14px;
      opacity: 0.9;
      margin-bottom: 8px;
      font-weight: 500;
      cursor: ${cssMode === 'easy' ? 'move' : 'default'};
    }
    
    .profile-pronouns {
      font-size: 12px;
      opacity: 0.8;
      margin-bottom: 12px;
      font-style: italic;
      cursor: ${cssMode === 'easy' ? 'move' : 'default'};
    }
    
    .profile-bio {
      font-size: 13px;
      line-height: 1.5;
      opacity: 0.95;
      margin-top: 12px;
      word-wrap: break-word;
      cursor: ${cssMode === 'easy' ? 'move' : 'default'};
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
      animation: rainbow ${rainbowSpeed}s ease-in-out infinite;
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

    ${cssMode === 'easy' ? `
    .profile-card-container * {
      transition: transform 0.1s ease;
    }
    
    .profile-card-container *:hover {
      transform: scale(1.02);
    }
    ` : ''}
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
    <div
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      className={cssMode === 'easy' ? 'select-none' : ''}
    >
      <style dangerouslySetInnerHTML={{ __html: finalCSS }} />
      <div className="profile-card-container">
        <div 
          className="profile-banner"
          onMouseDown={cssMode === 'easy' ? (e) => onElementMouseDown?.(e, 'profile-banner') : undefined}
          onContextMenu={cssMode === 'easy' ? (e) => onElementContextMenu?.(e, 'profile-banner') : undefined}
        >
          {bannerPreview ? (
            <img src={bannerPreview} alt="Profile Banner" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500" />
          )}
        </div>
        
        <div className="profile-content">
          <div className="relative inline-block">
            {avatarPreview ? (
              <img 
                src={avatarPreview} 
                alt="Profile Avatar" 
                className="profile-avatar"
                onMouseDown={cssMode === 'easy' ? (e) => onElementMouseDown?.(e, 'profile-avatar') : undefined}
                onContextMenu={cssMode === 'easy' ? (e) => onElementContextMenu?.(e, 'profile-avatar') : undefined}
              />
            ) : (
              <div 
                className="profile-avatar bg-gray-300 flex items-center justify-center"
                onMouseDown={cssMode === 'easy' ? (e) => onElementMouseDown?.(e, 'profile-avatar') : undefined}
                onContextMenu={cssMode === 'easy' ? (e) => onElementContextMenu?.(e, 'profile-avatar') : undefined}
              >
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
                : displayNameColor,
              animationDuration: displayNameAnimation === 'rainbow' ? `${rainbowSpeed}s` : undefined
            }}
            onMouseDown={cssMode === 'easy' ? (e) => onElementMouseDown?.(e, 'profile-display-name') : undefined}
            onContextMenu={cssMode === 'easy' ? (e) => onElementContextMenu?.(e, 'profile-display-name') : undefined}
          >
            {displayName || 'Display Name'}
          </div>
          
          <div 
            className="profile-username"
            onMouseDown={cssMode === 'easy' ? (e) => onElementMouseDown?.(e, 'profile-username') : undefined}
            onContextMenu={cssMode === 'easy' ? (e) => onElementContextMenu?.(e, 'profile-username') : undefined}
          >
            @{username || currentUser?.email?.split('@')[0] || 'username'}
          </div>
          
          {pronouns && (
            <div 
              className="profile-pronouns"
              onMouseDown={cssMode === 'easy' ? (e) => onElementMouseDown?.(e, 'profile-pronouns') : undefined}
              onContextMenu={cssMode === 'easy' ? (e) => onElementContextMenu?.(e, 'profile-pronouns') : undefined}
            >
              {pronouns}
            </div>
          )}
          
          {bio && (
            <>
              <div className="profile-divider"></div>
              <div 
                className="profile-bio"
                onMouseDown={cssMode === 'easy' ? (e) => onElementMouseDown?.(e, 'profile-bio') : undefined}
                onContextMenu={cssMode === 'easy' ? (e) => onElementContextMenu?.(e, 'profile-bio') : undefined}
              >
                {bio}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};