// src/components/ProfileCustomizer/index.ts - Fixed Export Structure
import React from 'react';

// FIXED: Import and export ProfileCustomizer correctly
import ProfileCustomizer from './ProfileCustomizer';

// Enhanced preview component
export { EnhancedProfilePreview } from './EnhancedProfilePreview';

// Core components
export { BasicInfoSection } from './components/BasicInfoSection';
export { DisplayNameStyling } from './components/DisplayNameStyling';
export { ImageUploadSection } from './components/ImageUploadSection';
export { BadgeManager } from './components/BadgeManager';
export { ContextMenu } from './components/ContextMenu';
export { TypographyPopup } from './components/TypographyPopup';

// Advanced components
export { AdvancedCustomization } from './components/AdvancedCustomization';
export { ThemeSelector } from './components/ThemeSelector';
export { LayoutPresets } from './components/LayoutPresets';
export { AnimationControls } from './components/AnimationControls';

// Error handling
export { 
  ProfileCustomizerErrorBoundary, 
  withErrorBoundary, 
  useErrorHandler 
} from './components/ErrorBoundary';

// Hooks
export { useProfileCustomizer } from './hooks/useProfileCustomizer';
export { useProfileData } from './hooks/useProfileData';
export { useEasyMode } from './hooks/useEasyMode';
export { useBadgeManager } from './hooks/useBadgeManager';

// Types
export type { 
  ProfileCustomizerProps,
  EasyCustomization,
  Badge,
  TypographyOptions,
  ContextMenuState,
  TypographyPopupState,
  DragState,
  StatusType,
  DisplayNameAnimation,
  ResizeHandle
} from './types';

// Utilities
export { 
  generateEasyCSS, 
  clearCSSCache, 
  getCSSCacheStats 
} from './utils/cssGenerator';

export { 
  uploadFile, 
  validateImageFile, 
  createFilePreview, 
  validateImageUrl 
} from './utils/fileHandlers';

export {
  STATUS_OPTIONS,
  DISPLAY_NAME_ANIMATIONS,
  FONT_FAMILIES,
  GRADIENT_DIRECTIONS,
  AVATAR_FRAMES,
  TEXT_ELEMENTS,
  PROFILE_ELEMENTS,
  GRID_SIZE,
  DEFAULT_EASY_CUSTOMIZATION
} from './utils/constants';

// Performance and utility exports
export type { Theme } from '@/components/theme-provider';

// Re-export UI components for external use
export { Button } from '@/components/ui/button-themed';
export { Input } from '@/components/ui/input-themed';
export { Label } from '@/components/ui/label-themed';
export { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select-themed';

// Enhanced features
export const PROFILE_CUSTOMIZER_VERSION = '2.0.0';

export const FEATURE_FLAGS = {
  PERFORMANCE_MONITORING: true,
  ADVANCED_ANIMATIONS: true,
  PARTICLE_EFFECTS: true,
  THEME_PRESETS: true,
  LAYOUT_PRESETS: true,
  DISCORD_STYLE: true,
  MOBILE_OPTIMIZED: true,
  ACCESSIBILITY_ENHANCED: true,
  REAL_TIME_PREVIEW: true,
  DRAG_AND_DROP: true,
  MULTI_SELECT: true,
  KEYBOARD_SHORTCUTS: true,
  AUTO_SAVE: false, // Could be enabled in future
  COLLABORATION: false, // Future feature
  TEMPLATE_SHARING: false, // Future feature
} as const;

// Configuration options
export const CUSTOMIZER_CONFIG = {
  MAX_BADGES: 10,
  MAX_BIO_LENGTH: 500,
  MAX_USERNAME_LENGTH: 20,
  MAX_DISPLAY_NAME_LENGTH: 32,
  MAX_PRONOUNS_LENGTH: 20,
  MAX_BADGE_NAME_LENGTH: 30,
  
  // File upload limits
  MAX_AVATAR_SIZE_MB: 2,
  MAX_BANNER_SIZE_MB: 5,
  MAX_BADGE_SIZE_MB: 1,
  
  // Animation settings
  DEFAULT_RAINBOW_SPEED: 3,
  MIN_RAINBOW_SPEED: 1,
  MAX_RAINBOW_SPEED: 10,
  
  // Layout constraints
  MIN_AVATAR_SIZE: 60,
  MAX_AVATAR_SIZE: 120,
  MIN_BANNER_HEIGHT: 80,
  MAX_BANNER_HEIGHT: 200,
  MIN_BORDER_RADIUS: 0,
  MAX_BORDER_RADIUS: 50,
  MIN_PADDING: 12,
  MAX_PADDING: 40,
  
  // Performance settings
  CACHE_SIZE: 5,
  DEBOUNCE_DELAY: 500,
  COOLDOWN_MS: 2000,
  
  // Grid settings
  GRID_SIZE: 10,
  SNAP_THRESHOLD: 5,
  
  // Animation frame budget
  MAX_FPS: 60,
  FRAME_BUDGET_MS: 16,
  
  // Supported file types
  SUPPORTED_IMAGE_TYPES: [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ] as const,
  
  // Supported image extensions
  SUPPORTED_IMAGE_EXTENSIONS: [
    '.jpg',
    '.jpeg',
    '.png', 
    '.gif',
    '.webp',
    '.svg'
  ] as const,
  
  // Theme settings
  DEFAULT_THEMES: [
    'discord-dark',
    'ocean-breeze',
    'sunset-glow',
    'forest-green',
    'purple-haze',
    'midnight-blue'
  ] as const,
  
  // Accessibility settings
  ACCESSIBILITY: {
    MIN_CONTRAST_RATIO: 4.5,
    FOCUS_RING_WIDTH: 2,
    REDUCED_MOTION_DURATION: 0.01,
    HIGH_CONTRAST_MODE: false,
    SCREEN_READER_ANNOUNCEMENTS: true
  }
} as const;

// Utility functions for external use
export const getProfileCustomizerInfo = () => ({
  version: PROFILE_CUSTOMIZER_VERSION,
  features: FEATURE_FLAGS,
  config: CUSTOMIZER_CONFIG,
  buildDate: new Date().toISOString(),
  environment: process.env.NODE_ENV || 'development'
});

// Performance utilities
export const createPerformanceMonitor = () => {
  let frameCount = 0;
  let lastTime = performance.now();
  let fps = 60;
  
  return {
    startFrame: () => {
      frameCount++;
    },
    
    endFrame: () => {
      const now = performance.now();
      if (now - lastTime >= 1000) {
        fps = Math.round((frameCount * 1000) / (now - lastTime));
        frameCount = 0;
        lastTime = now;
      }
    },
    
    getFPS: () => fps,
    
    isPerformanceGood: () => fps >= 30,
    
    reset: () => {
      frameCount = 0;
      lastTime = performance.now();
      fps = 60;
    }
  };
};

// Validation utilities
export const validateProfileData = (data: any) => {
  const errors: string[] = [];
  
  if (data.username && data.username.length < 3) {
    errors.push('Username must be at least 3 characters long');
  }
  
  if (data.username && data.username.length > CUSTOMIZER_CONFIG.MAX_USERNAME_LENGTH) {
    errors.push(`Username must be less than ${CUSTOMIZER_CONFIG.MAX_USERNAME_LENGTH} characters`);
  }
  
  if (data.displayName && data.displayName.length > CUSTOMIZER_CONFIG.MAX_DISPLAY_NAME_LENGTH) {
    errors.push(`Display name must be less than ${CUSTOMIZER_CONFIG.MAX_DISPLAY_NAME_LENGTH} characters`);
  }
  
  if (data.bio && data.bio.length > CUSTOMIZER_CONFIG.MAX_BIO_LENGTH) {
    errors.push(`Bio must be less than ${CUSTOMIZER_CONFIG.MAX_BIO_LENGTH} characters`);
  }
  
  if (data.pronouns && data.pronouns.length > CUSTOMIZER_CONFIG.MAX_PRONOUNS_LENGTH) {
    errors.push(`Pronouns must be less than ${CUSTOMIZER_CONFIG.MAX_PRONOUNS_LENGTH} characters`);
  }
  
  if (data.badges && data.badges.length > CUSTOMIZER_CONFIG.MAX_BADGES) {
    errors.push(`Maximum ${CUSTOMIZER_CONFIG.MAX_BADGES} badges allowed`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Theme utilities
export const getThemePreview = (themeName: string) => {
  const themeMap = {
    'discord-dark': 'linear-gradient(135deg, #36393f, #2f3136)',
    'ocean-breeze': 'linear-gradient(135deg, #667eea, #764ba2)',
    'sunset-glow': 'linear-gradient(135deg, #ff6b6b, #ffa726)',
    'forest-green': 'linear-gradient(135deg, #56ab2f, #a8e6cf)',
    'purple-haze': 'linear-gradient(135deg, #8360c3, #2ebf91)',
    'midnight-blue': 'linear-gradient(135deg, #2c3e50, #3498db)'
  };
  
  return themeMap[themeName as keyof typeof themeMap] || themeMap['ocean-breeze'];
};

// Accessibility utilities
export const checkContrast = (foreground: string, background: string): number => {
  // Simple contrast calculation (in real implementation, would use proper color library)
  const rgb1 = hexToRgb(foreground);
  const rgb2 = hexToRgb(background);
  
  if (!rgb1 || !rgb2) return 0;
  
  const luminance1 = getLuminance(rgb1);
  const luminance2 = getLuminance(rgb2);
  
  const brighter = Math.max(luminance1, luminance2);
  const darker = Math.min(luminance1, luminance2);
  
  return (brighter + 0.05) / (darker + 0.05);
};

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

const getLuminance = (rgb: { r: number; g: number; b: number }) => {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// Debug utilities (development only)
export const debug = process.env.NODE_ENV === 'development' ? {
  logProfileData: (data: any) => {
    console.group('🎨 Profile Customizer Debug');
    console.log('Profile Data:', data);
    console.log('Validation:', validateProfileData(data));
    console.log('Performance:', createPerformanceMonitor());
    console.groupEnd();
  },
  
  logPerformanceStats: () => {
    const monitor = createPerformanceMonitor();
    console.log('📊 Performance Stats:', {
      fps: monitor.getFPS(),
      isGood: monitor.isPerformanceGood(),
      memory: (performance as any).memory ? {
        used: Math.round(((performance as any).memory.usedJSHeapSize / 1048576)),
        total: Math.round(((performance as any).memory.totalJSHeapSize / 1048576))
      } : 'N/A'
    });
  },
  
  enableVerboseLogging: () => {
    (window as any).__PROFILE_CUSTOMIZER_DEBUG__ = true;
    console.log('🔧 Profile Customizer verbose logging enabled');
  }
} : {};

// FIXED: Export ProfileCustomizer as both named and default export
export { ProfileCustomizer };
export default ProfileCustomizer;