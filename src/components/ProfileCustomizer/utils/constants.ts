// src/components/ProfileCustomizer/utils/constants.ts

export const STATUS_OPTIONS = [
  { value: 'online', label: 'Online', icon: '/icons/online.png' },
  { value: 'idle', label: 'Idle', icon: '/icons/idle.png' },
  { value: 'dnd', label: 'Do Not Disturb', icon: '/icons/dnd.png' },
  { value: 'offline', label: 'Offline', icon: '/icons/offline.png' }
] as const;

export const DISPLAY_NAME_ANIMATIONS = [
  { value: 'none', label: 'None' },
  { value: 'rainbow', label: 'Rainbow' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'pulse', label: 'Pulse' },
  { value: 'glow', label: 'Glow' }
] as const;

export const FONT_FAMILIES = [
  { value: 'default', label: 'Default' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Helvetica, sans-serif', label: 'Helvetica' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Times New Roman, serif', label: 'Times New Roman' },
  { value: 'Courier New, monospace', label: 'Courier New' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: 'Impact, sans-serif', label: 'Impact' },
  { value: 'Comic Sans MS, cursive', label: 'Comic Sans MS' },
  { value: 'Trebuchet MS, sans-serif', label: 'Trebuchet MS' },
  { value: 'Palatino, serif', label: 'Palatino' },
  { value: 'Garamond, serif', label: 'Garamond' }
] as const;

export const GRADIENT_DIRECTIONS = [
  { value: '0deg', label: 'Top to Bottom' },
  { value: '45deg', label: 'Diagonal ↗' },
  { value: '90deg', label: 'Left to Right' },
  { value: '135deg', label: 'Diagonal ↘' },
  { value: '180deg', label: 'Bottom to Top' },
  { value: '225deg', label: 'Diagonal ↙' },
  { value: '270deg', label: 'Right to Left' },
  { value: '315deg', label: 'Diagonal ↖' },
  { value: 'radial', label: 'Radial' }
] as const;

export const AVATAR_FRAMES = [
  { value: 'circle', label: 'Circle' },
  { value: 'square', label: 'Square' }
] as const;

export const TEXT_ELEMENTS = [
  'profile-display-name',
  'profile-username',
  'profile-bio',
  'profile-pronouns'
] as const;

export const PROFILE_ELEMENTS = [
  'profile-avatar',
  'profile-display-name',
  'profile-username',
  'profile-pronouns',
  'profile-bio',
  'profile-status',
  'profile-banner',
  'profile-divider',
  'profile-badges'
] as const;

export const GRID_SIZE = 10; // Grid snap size in pixels

// FIXED: More robust default customization with all required properties
export const DEFAULT_EASY_CUSTOMIZATION = {
  backgroundColor: '#667eea',
  backgroundGradient: {
    enabled: true,
    color1: '#667eea',
    color2: '#764ba2',
    direction: '135deg'
  },
  borderRadius: 16,
  bannerHeight: 140,
  avatarSize: 100,
  avatarFrame: 'circle' as const,
  textShadow: true,
  textGlow: false,
  textBold: false,
  fontFamily: 'default',
  fontSize: 16,
  contentPadding: 24,
  shadow: true,
  glow: false,
  border: false,
  elements: {
    'profile-avatar': { 
      x: 0, 
      y: 0, 
      scale: 1, 
      visible: true,
      color: undefined,
      fontFamily: undefined,
      fontSize: undefined,
      width: undefined,
      height: undefined
    },
    'profile-display-name': { 
      x: 0, 
      y: 0, 
      scale: 1, 
      visible: true,
      color: '#ffffff',
      fontFamily: 'default',
      fontSize: 26,
      width: undefined,
      height: undefined
    },
    'profile-username': { 
      x: 0, 
      y: 0, 
      scale: 1, 
      visible: true,
      color: '#ffffff',
      fontFamily: 'default',
      fontSize: 16,
      width: undefined,
      height: undefined
    },
    'profile-pronouns': { 
      x: 0, 
      y: 0, 
      scale: 1, 
      visible: true,
      color: '#ffffff',
      fontFamily: 'default',
      fontSize: 14,
      width: undefined,
      height: undefined
    },
    'profile-bio': { 
      x: 0, 
      y: 0, 
      scale: 1, 
      visible: true,
      color: '#ffffff',
      fontFamily: 'default',
      fontSize: 14,
      width: undefined,
      height: undefined
    },
    'profile-status': { 
      x: 0, 
      y: 0, 
      scale: 1, 
      visible: true,
      color: undefined,
      fontFamily: undefined,
      fontSize: undefined,
      width: undefined,
      height: undefined
    },
    'profile-banner': { 
      x: 0, 
      y: 0, 
      scale: 1, 
      visible: true,
      color: undefined,
      fontFamily: undefined,
      fontSize: undefined,
      width: undefined,
      height: undefined
    },
    'profile-divider': { 
      x: 0, 
      y: 0, 
      scale: 1, 
      visible: true,
      color: undefined,
      fontFamily: undefined,
      fontSize: undefined,
      width: undefined,
      height: undefined
    },
    'profile-badges': { 
      x: 0, 
      y: 0, 
      scale: 1, 
      visible: true,
      color: undefined,
      fontFamily: undefined,
      fontSize: undefined,
      width: undefined,
      height: undefined
    },
    'profile-status-text': { 
      x: 0, 
      y: 0, 
      scale: 1, 
      visible: true,
      color: '#ffffff',
      fontFamily: 'default',
      fontSize: 14,
      width: undefined,
      height: undefined
    }
  }
};