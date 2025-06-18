import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { getDisplayNameClass } from '../utils/ChatHelpers';

interface PartnerTypingIndicatorProps {
  isTyping: boolean;
  partnerName?: string;
  theme: string;
  partnerInfo?: {
    username: string;
    displayName?: string;
    displayNameColor?: string;
    displayNameAnimation?: string;
    rainbowSpeed?: number;
  };
  recentPartnerData?: {
    senderUsername?: string;
    senderDisplayNameColor?: string;
    senderDisplayNameAnimation?: string;
    senderRainbowSpeed?: number;
  } | null;
  className?: string;
  isMobile?: boolean; // Keep prop but don't use for different layouts
}

const PartnerTypingIndicator: React.FC<PartnerTypingIndicatorProps> = ({ 
  isTyping, 
  partnerName = 'Partner',
  theme,
  partnerInfo,
  recentPartnerData,
  className,
  isMobile = false // Ignored for layout purposes
}) => {
  const [dots, setDots] = useState('.');

  useEffect(() => {
    if (!isTyping) {
      setDots('.');
      return;
    }

    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '.' : prev + '.');
    }, 500);

    return () => clearInterval(interval);
  }, [isTyping]);

  if (!isTyping) return null;

  // Safe handling of potentially null recentPartnerData
  const displayName = recentPartnerData?.senderUsername || 
                     partnerInfo?.displayName || 
                     partnerInfo?.username || 
                     partnerName;
  
  const displayNameColor = recentPartnerData?.senderDisplayNameColor || 
                          partnerInfo?.displayNameColor || 
                          '#ff6b6b';
  
  const displayNameAnimation = recentPartnerData?.senderDisplayNameAnimation || 
                              partnerInfo?.displayNameAnimation || 
                              'none';
  
  const rainbowSpeed = recentPartnerData?.senderRainbowSpeed || 
                      partnerInfo?.rainbowSpeed || 
                      3;

  const displayNameClass = getDisplayNameClass(displayNameAnimation);

  // ✅ UNIFIED LAYOUT: Always use desktop-style typing indicator (no mobile bubbles)
  return (
    <div className={cn(
      "text-xs italic text-left pl-1 py-0.5 flex items-center gap-2",
      theme === 'theme-7' ? 'theme-7-text-shadow text-gray-100' : 'text-gray-500 dark:text-gray-400',
      className
    )}>
      <span 
        className={cn(displayNameClass)}
        style={{ 
          color: displayNameAnimation === 'rainbow' || displayNameAnimation === 'gradient'
            ? undefined 
            : displayNameColor,
          animationDuration: displayNameAnimation === 'rainbow' ? `${rainbowSpeed}s` : undefined
        }}
      >
        {displayName}
      </span>
      is typing{dots}
    </div>
  );
};

export default PartnerTypingIndicator;