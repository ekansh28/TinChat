// src/components/ProfileCustomizer/types/index.ts

export interface ProfileCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface EasyCustomization {
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
  avatarFrame: 'circle' | 'square';
  textShadow: boolean;
  textGlow: boolean;
  textBold: boolean;
  fontFamily: string;
  fontSize: number;
  contentPadding: number;
  shadow: boolean;
  glow: boolean;
  border: boolean;
    elements: {
    [key: string]: {
        x: number;
        y: number;
        scale: number;
        width?: number;
        height?: number;
        color?: string;
        fontFamily?: string;     // ← Make sure this line exists
        fontSize?: number;       // ← Make sure this line exists
        visible: boolean;
    };
    };
}

export interface Badge {
  id: string;
  url: string;
  name?: string;
}

export interface TypographyOptions {
  textAlign: 'left' | 'center' | 'right';
  fontFamily: string;
  fontSize: number;
  borderWidth: number;
  borderColor: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  textColor: string;
  lineSpacing: number;
  paragraphSpacing: number;
}

export interface ContextMenuState {
  x: number;
  y: number;
  element: string;
}

export interface TypographyPopupState {
  x: number;
  y: number;
  element: string;
  options: TypographyOptions;
}

export interface DragState {
  x: number;
  y: number;
  elementX: number;
  elementY: number;
  elementWidth: number;
  elementHeight: number;
}

export type StatusType = 'online' | 'idle' | 'dnd' | 'offline';
export type DisplayNameAnimation = 'none' | 'rainbow' | 'gradient' | 'pulse' | 'glow';
export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null;