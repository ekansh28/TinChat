// src/components/ProfileCustomizer/hooks/useProfileCustomizer.ts
import { useState, useRef, useEffect, useCallback } from 'react';
import { z } from 'zod';
import { useTheme } from '@/components/theme-provider';
import { generateEasyCSS } from '../utils/cssGenerator';
import { getDefaultProfileCSS } from '@/lib/SafeCSS';
import { DEFAULT_EASY_CUSTOMIZATION } from '../utils/constants';
import type { 
  EasyCustomization, 
  Badge, 
  StatusType, 
  DisplayNameAnimation 
} from '../types';

// Add runtime validation schemas
const ElementPropsSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  scale: z.number().min(0.1).max(5).default(1),
  visible: z.boolean().default(true),
  color: z.string().optional(),
  fontFamily: z.string().optional(),
  fontSize: z.number().positive().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  background: z.string().optional(),
  padding: z.string().optional(),
  borderRadius: z.string().optional(),
  border: z.string().optional(),
  zIndex: z.number().optional()
});

const EasyCustomizationSchema = z.object({
  backgroundColor: z.string().default('#667eea'),
  backgroundGradient: z.object({
    enabled: z.boolean().default(true),
    color1: z.string().default('#667eea'),
    color2: z.string().default('#764ba2'),
    direction: z.string().default('135deg')
  }).optional(),
  borderRadius: z.number().min(0).max(50).default(16),
  bannerHeight: z.number().min(80).max(200).default(120),
  avatarSize: z.number().min(60).max(120).default(80),
  avatarFrame: z.enum(['circle', 'square']).default('circle'),
  textShadow: z.boolean().default(false),
  textGlow: z.boolean().default(false),
  textBold: z.boolean().default(false),
  fontFamily: z.string().default('MS Sans Serif'),
  fontSize: z.number().min(8).max(24).default(14),
  contentPadding: z.number().min(8).max(40).default(16),
  shadow: z.boolean().default(true),
  glow: z.boolean().default(false),
  border: z.boolean().default(false),
  elements: z.record(ElementPropsSchema).default({})
});

export const useProfileCustomizer = () => {
  // CSS and mode states - Initialize with proper defaults
  const [customCSS, setCustomCSS] = useState(() => getDefaultProfileCSS());
  const [cssMode, setCSSMode] = useState<'custom' | 'easy'>('easy');
  const [positionMode, setPositionMode] = useState<'normal' | 'grid'>('normal');
  
  // Easy customization state - Ensure proper initialization
  const [easyCustomization, setEasyCustomization] = useState<EasyCustomization>(() => ({
    ...DEFAULT_EASY_CUSTOMIZATION
  }));
  
  // Profile data states
  const [bio, setBio] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [status, setStatus] = useState<StatusType>('online'); // Default to online
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

  // Safe customization setter with validation
  const safeSetEasyCustomization = useCallback((
    customization: EasyCustomization | ((prev: EasyCustomization) => EasyCustomization)
  ) => {
    if (typeof customization === 'function') {
      setEasyCustomization(prev => {
        try {
          const result = customization(prev);
          
          // Validate with schema
          const validated = EasyCustomizationSchema.parse({
            ...DEFAULT_EASY_CUSTOMIZATION,
            ...result,
            elements: {
              ...DEFAULT_EASY_CUSTOMIZATION.elements,
              ...result.elements
            }
          });
          
          return validated;
        } catch (error) {
          console.error('Error in safeSetEasyCustomization:', error);
          return prev;
        }
      });
    } else {
      try {
        const validated = EasyCustomizationSchema.parse({
          ...DEFAULT_EASY_CUSTOMIZATION,
          ...customization,
          elements: {
            ...DEFAULT_EASY_CUSTOMIZATION.elements,
            ...customization.elements
          }
        });
        setEasyCustomization(validated);
      } catch (error) {
        console.error('Error validating customization:', error);
        setEasyCustomization(DEFAULT_EASY_CUSTOMIZATION);
      }
    }
  }, []);

  // Update custom CSS when easy customization changes - with proper safety checks
  useEffect(() => {
    if (cssMode === 'easy' && easyCustomization && easyCustomization.elements) {
      try {
        const generatedCSS = generateEasyCSS(easyCustomization, displayNameAnimation, rainbowSpeed);
        if (generatedCSS) {
          setCustomCSS(generatedCSS);
        }
      } catch (error) {
        console.error('Error generating CSS from easy customization:', error);
        // Fallback to default CSS if generation fails
        setCustomCSS(getDefaultProfileCSS());
      }
    }
  }, [easyCustomization, cssMode, displayNameAnimation, rainbowSpeed]);

  // Ensure CSS is never empty
  useEffect(() => {
    if (!customCSS || customCSS.trim() === '') {
      console.log('Setting default CSS as customCSS was empty');
      setCustomCSS(getDefaultProfileCSS());
    }
  }, [customCSS]);

  // Safe state update functions with validation
  const safeSetCustomCSS = useCallback((css: string) => {
    if (typeof css === 'string' && css.trim()) {
      setCustomCSS(css);
    } else {
      setCustomCSS(getDefaultProfileCSS());
    }
  }, []);

  // Computed values with safe fallbacks
  const safeCurrentTheme = currentTheme || 'default';
  const isTheme98 = safeCurrentTheme === 'theme-98' || safeCurrentTheme === 'theme98';
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return {
    // CSS and mode states
    customCSS,
    setCustomCSS: safeSetCustomCSS,
    cssMode,
    setCSSMode,
    positionMode,
    setPositionMode,
    
    // Easy customization
    easyCustomization,
    setEasyCustomization: safeSetEasyCustomization,
    
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