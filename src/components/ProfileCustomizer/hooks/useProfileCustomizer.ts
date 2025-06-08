// src/components/ProfileCustomizer/hooks/useProfileCustomizer.ts
import { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/components/theme-provider';
import { generateEasyCSS } from '../utils/cssGenerator';
import { DEFAULT_EASY_CUSTOMIZATION } from '../utils/constants';
import type { 
  EasyCustomization, 
  Badge, 
  StatusType, 
  DisplayNameAnimation 
} from '../types';

export const useProfileCustomizer = () => {
  // CSS and mode states
  const [customCSS, setCustomCSS] = useState('');
  const [cssMode, setCSSMode] = useState<'custom' | 'easy'>('easy');
  const [positionMode, setPositionMode] = useState<'normal' | 'grid'>('normal');
  
  // Easy customization state
  const [easyCustomization, setEasyCustomization] = useState<EasyCustomization>(DEFAULT_EASY_CUSTOMIZATION);
  
  // Profile data states
  const [bio, setBio] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [status, setStatus] = useState<StatusType>('online');
  const [displayNameColor, setDisplayNameColor] = useState('#ffffff');
  const [displayNameAnimation, setDisplayNameAnimation] = useState<DisplayNameAnimation>('none');
  const [rainbowSpeed, setRainbowSpeed] = useState(3);
  
  // File states
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  
  // Badge states
  const [badges, setBadges] = useState<Badge[]>([]);
  const [isBadgeManagerOpen, setIsBadgeManagerOpen] = useState(false);
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [originalUsername, setOriginalUsername] = useState('');

  // Refs
  const mountedRef = useRef(true);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Theme
  const { currentTheme } = useTheme();

  // Component mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Update custom CSS when easy customization changes
  useEffect(() => {
    if (cssMode === 'easy') {
      const generatedCSS = generateEasyCSS(easyCustomization, displayNameAnimation, rainbowSpeed);
      setCustomCSS(generatedCSS);
    }
  }, [easyCustomization, cssMode, displayNameAnimation, rainbowSpeed]);

  // Computed values
  const isTheme98 = currentTheme === 'theme-98';
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return {
    // CSS and mode states
    customCSS,
    setCustomCSS,
    cssMode,
    setCSSMode,
    positionMode,
    setPositionMode,
    
    // Easy customization
    easyCustomization,
    setEasyCustomization,
    
    // Profile data
    bio,
    setBio,
    displayName,
    setDisplayName,
    username,
    setUsername,
    pronouns,
    setPronouns,
    status,
    setStatus,
    displayNameColor,
    setDisplayNameColor,
    displayNameAnimation,
    setDisplayNameAnimation,
    rainbowSpeed,
    setRainbowSpeed,
    
    // Files
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
    
    // Badges
    badges,
    setBadges,
    isBadgeManagerOpen,
    setIsBadgeManagerOpen,
    
    // Loading states
    loading,
    setLoading,
    saving,
    setSaving,
    currentUser,
    setCurrentUser,
    originalUsername,
    setOriginalUsername,
    
    // Refs
    mountedRef,
    avatarFileInputRef,
    bannerFileInputRef,
    previewRef,
    
    // Computed
    isTheme98,
    isMobile,
  };
};